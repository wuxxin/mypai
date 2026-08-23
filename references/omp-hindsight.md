# Oh-My-Pi Hindsight Configuration & Architecture Guide (`oh-my-pi-hindsight.md`)

## Executive Summary

**Hindsight** is the native long-term vector memory, temporal observation tracking, and mental model reflection engine for **Oh-My-Pi (OMP)** and **MyPAI**. Operative via a local REST API (default `http://localhost:28888`), Hindsight intercepts conversation turns to autonomously retain facts, consolidate raw observations, synthesize mental models, and recall context for prompt injection.

This document serves as an exhaustive reference for all up-to-date Hindsight configuration parameters across `config.yml`, bank definition files (`.yaml`/`.json`), environment variables, `membank-ctl` CLI tooling, and REST endpoints.

---

## 1. Global Hindsight Configuration (`config.yml`)

Hindsight configuration is declared under the `memory:` and `hindsight:` blocks in `omp/agent/config.yml`.

```yaml
memory:
  backend: hindsight              # Active memory provider ('hindsight' | 'none')

autolearn:
  enabled: true                  # Enable dynamic knowledge extraction

hindsight:
  apiUrl: http://localhost:28888  # Base URL for Hindsight REST server (or $HINDSIGHT_API_URL)
  bankId: oh-my-pi               # Target memory bank identifier (or $HINDSIGHT_BANK_ID)
  scoping: per-project-tagged     # Memory scoping strategy ('per-project-tagged' | 'per-project' | 'global')
  retainMode: full-session        # Ingestion mode ('full-session' | 'concise' | 'turn' | 'manual')
  autoRecall: true               # Auto-query & inject vector memory facts on turn start
  autoRetain: true               # Auto-extract & store facts on turn completion
  mentalModelsEnabled: true      # Enable synthesis & injection of mental model blocks
  mentalModelAutoSeed: true      # Idempotently seed local YAML/JSON bank definitions on startup
```

### Parameter Reference Table

| Configuration Key | Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| **`memory.backend`** | `string` | `"hindsight"` | Selects the active memory provider backend (`hindsight` or `none`). |
| **`autolearn.enabled`** | `boolean` | `true` | Enables background learning, error self-correction, preference distillation, and mental model refinement. |
| **`hindsight.apiUrl`** | `string` | `"http://localhost:28888"` | Base URL of the Hindsight REST API server. Overridden by environment variable `HINDSIGHT_API_URL`. |
| **`hindsight.bankId`** | `string` | `"oh-my-pi"` | Memory bank namespace ID (e.g. `oh-my-pi` or `mypai`). Overridden by `HINDSIGHT_BANK_ID`. |
| **`hindsight.scoping`** | `enum` | `"per-project-tagged"` | Memory scoping strategy: `per-project-tagged` (filters by project tags, surfaces untagged global memories), `per-project` (hard per-directory bank isolation), `global` (single shared bank across all projects). |
| **`hindsight.retainMode`** | `enum` | `"full-session"` | Ingestion strategy for turn content: `full-session` (summarizes complete session), `concise` (extracts short key facts), `turn` (retains raw turn text), `manual` (requires explicit tool call). |
| **`hindsight.autoRecall`** | `boolean` | `true` | When `true`, automatically queries vector memory before generating model prompts to inject relevant facts on session start. |
| **`hindsight.autoRetain`** | `boolean` | `true` | When `true`, automatically extracts facts from completed turns and sends them to `/retain` asynchronously. |
| **`hindsight.mentalModelsEnabled`** | `boolean` | `true` | When `true`, synthesizes and injects mental model summary blocks into the agent system context. |
| **`hindsight.mentalModelAutoSeed`** | `boolean` | `true` | When `true`, provisions bank missions and mental model definitions from `./memorybanks/*.yaml` on launcher boot. |
| **`hindsight.retainContext`** | `string` | `"omp"` | Context tag attached to retained memories. |
| **`hindsight.recallBudget`** | `enum` | `"mid"` | Thinking depth budget for recall queries (`low`, `mid`, `high`). |

---

### Deep Dive: Scoping Rules & Preventing Duplicate Mental Models

When using `scoping: per-project-tagged`, Oh-My-Pi executes both a global prompt injection pass and a project-specific tagged pass (`project:<directory_name>`).

> [!WARNING]
> **Scoping Multi-Match Hazard**: If a mental model definition specifies multiple scopes simultaneously (e.g. `scopes: [global, per-project, per-project-tagged]`), Oh-My-Pi will evaluate and inject that mental model **twice** into the system prompt.

#### Correct Scoping Configuration:
- **Global Models** (e.g. `user-preferences`, developer profiles):
  ```yaml
  scopes:
    - global
  projectTagged: false
  tags: []
  ```
- **Project-Specific Models** (e.g. `project-conventions`, `project-decisions`):
  ```yaml
  scopes:
    - per-project-tagged
  projectTagged: true
  ```

---

### Deep Dive: `autolearn.enabled: true` Mechanics

`autolearn` is Oh-My-Pi's active knowledge distillation and self-correction engine. It operates at a higher semantic level than passive turn retention (`hindsight.autoRetain`).

#### 1. `autolearn.enabled` vs `hindsight.autoRetain`

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           MEMORY & LEARNING PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 1. PASSIVE INGESTION (hindsight.autoRetain: true)                               │
│    • Raw Turn Output ──> /retain Endpoint ──> Fact Chunks & Vector Database    │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 2. ACTIVE DISTILLATION (autolearn.enabled: true)                                │
│    • Ingestion Streams ──> Pattern & Rule Extractor ──> Mental Models          │
│    • Triggers: User Corrections, Mistakes, /learn Slash Command, Handoffs      │
│    • Produces: Durable User Preferences, Project Conventions, Anti-Criteria     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 2. Functional Behaviors when `autolearn.enabled: true`

1. **User Preference & Convention Distillation**:
   - Analyzes ongoing turns for recurring instructions, preferred tool flags, coding styles, and architectural guidelines.
   - Automatically distills these observations into persistent mental models (e.g. `user-preferences`, `project-conventions`).

2. **Self-Correction & Mistake Prevention**:
   - Detects user corrections (e.g. "Do not run cd in run_command", "Use shfmt with 4-space indent").
   - Immediately generates a **Negative Constraint / Anti-Criteria** rule in vector memory to prevent repeating the mistake in future turns.

3. **Mental Model Delta Refinement**:
   - Triggers background Hindsight re-synthesis passes (`/consolidate` and `/mental-models/{id}/refresh`).
   - Dynamically updates active mental model text blocks injected into system prompts without overwriting manually curated bootstrap seeds.

4. **Slash Command Synergy (`/learn`)**:
   - Powers the `/learn` slash command: when executed by the user, `autolearn` immediately distills recent turn context into permanent memory.

---

## 2. Memory Bank & Mental Model Definitions (`*.yaml` / `*.json`)

Bank definitions live in `omp/agent/memorybanks/`. They configure extraction missions, disposition weights, and synthesized mental model queries.

> [!NOTE]
> For an exhaustive, parameter-by-parameter manual covering every single field possible in a Hindsight bank definition (`bank:`, `mental_models:`, and `directives:`), see:
> 📖 [**Hindsight Memory Bank Configuration Reference (`references/hindsight-memorybank.md`)**](file:///home/wuxxin/agent-shared/code/mypai/references/hindsight-memorybank.md)

### Example: `omp/agent/memorybanks/oh-my-pi.yaml`

```yaml
version: '1'
bank:
  disposition_skepticism: 3
  disposition_literalism: 3
  disposition_empathy: 4
  retain_extraction_mode: concise
  enable_observations: true
  enable_auto_consolidation: true
  recall_max_tokens: 1536
  retain_mission: Extract overall project goals, technical decisions, architectural choices, coding patterns, and environment configuration...
  observations_mission: Track active project progress, ongoing task state, tech stack evolution, and codebase design patterns over time...
  reflect_mission: Synthesize an executive summary of project status, developer preferences, upcoming goals, and recent session handoffs...

mental_models:
- id: user-preferences
  name: User Preferences
  source_query: What does the user prefer in coding style, tooling, communication, and review?
  max_tokens: 600
  scopes:
    - global
  projectTagged: false
  trigger:
    mode: delta
    refresh_after_consolidation: true

- id: project-conventions
  name: Project Conventions
  source_query: What are this project's conventions for code style, build, testing, and review?
  max_tokens: 800
  scopes:
    - per-project-tagged
  projectTagged: true
  trigger:
    mode: delta
    refresh_after_consolidation: true
```

---

## 3. Environment Variables (`omp.env`)

Environment variables set will **override file configurations**, **do NOT** set HINDSIGHT_BANK_ID in the omp env, or omp will always use BANK_ID from env instead from config.

---

## 4. `membank-ctl` Management CLI Tool

`membank-ctl` is the management utility located at `bin/membank-ctl`.

### Commands & Usage

```bash
# 1. Update/Provision memory banks from JSON or YAML definitions (Idempotent):
membank-ctl update <API_URL> <BANKS_PATH> --yes [--prune]

# Example:
./bin/membank-ctl update http://localhost:28888 ./omp/agent/memorybanks --yes

# 2. Export server memory bank configuration and mental models to YAML or JSON:
membank-ctl export <API_URL> <bankname> [--json|--yaml] [--out filename]

# Example:
./bin/membank-ctl export http://localhost:28888 mypai --yaml --out mypai-exported.yaml
```

---

## 5. Hindsight REST API Endpoint Sitemap (`http://localhost:28888`)

All REST API endpoints operate under `/v1/default/banks/{bank_id}`:

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| **`/v1/default/banks/{bank_id}/config`** | `GET` | Fetch current bank configuration and active mission prompts. |
| **`/v1/default/banks/{bank_id}/config`** | `PATCH` | Update `retain_mission`, `observations_mission`, `reflect_mission`, or `enable_observations`. |
| **`/v1/default/banks/{bank_id}/stats`** | `GET` | Get document, fact, observation, and entity node count telemetry. |
| **`/v1/default/banks/{bank_id}/mental-models`** | `GET` | List all registered mental models for the bank. |
| **`/v1/default/banks/{bank_id}/mental-models`** | `POST` | Create or update a mental model (`id`, `name`, `source_query`, `max_tokens`). |
| **`/v1/default/banks/{bank_id}/mental-models/{id}`**| `DELETE` | Delete a specific mental model. |
| **`/v1/default/banks/{bank_id}/mental-models/{id}/refresh`** | `POST` | Force an immediate background re-synthesis pass for a mental model. |
| **`/v1/default/banks/{bank_id}/retain`** | `POST` | Retain raw text/turn data and trigger fact extraction. |
| **`/v1/default/banks/{bank_id}/recall`** | `POST` | Perform semantic vector + FTS hybrid search recall query. |
| **`/v1/default/banks/{bank_id}/reflect`** | `POST` | Execute a strategic reflection query using `reflect_mission`. |
| **`/v1/default/banks/{bank_id}/consolidate`** | `POST` | Trigger background memory consolidation pass for un-consolidated facts. |
