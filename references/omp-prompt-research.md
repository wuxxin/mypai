# OMP Prompt Architecture & Agent System Reference

Comprehensive technical reference on `oh-my-pi` (`omp`) prompt construction, system prompt hierarchy, ACP session resolution, subagent lifecycle, model routing, and workspace configuration.

---

## 1. Source Code Index & Ground Truth

Key implementation files in the `oh-my-pi` source tree:

- **System Prompt Templates:**
  - Default template: [`system-prompt.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/prompts/system/system-prompt.md)
  - Custom template (`SYSTEM.md` active): [`custom-system-prompt.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/prompts/system/custom-system-prompt.md)
  - Subagent template: [`subagent-system-prompt.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/prompts/system/subagent-system-prompt.md)
  - Project footer template: [`project-prompt.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/prompts/system/project-prompt.md)
- **Session & Prompt Construction Engine:**
  - Main CLI entry & file discovery: [`src/main.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/main.ts)
  - Session creation & prompt builder: [`src/sdk.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/sdk.ts)
  - System prompt compiler: [`src/system-prompt.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/system-prompt.ts)
  - Core agent loop & tool normalization: [`packages/agent/src/agent-loop.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/agent/src/agent-loop.ts)
- **ACP (Agent Client Protocol) Server:**
  - Protocol handler & session manager: [`src/modes/acp/acp-agent.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/modes/acp/acp-agent.ts)
  - Stdio transport & lifecycle: [`src/modes/acp/acp-mode.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/modes/acp/acp-mode.ts)
- **Task & Subagent Subsystem:**
  - Subagent spawning & prompt composition: [`src/task/executor.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/task/executor.ts)
  - Subagent definition discovery: [`src/task/discovery.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/task/discovery.ts)
  - Agent registry & frontmatter parsing: [`src/task/agents.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/task/agents.ts)
- **Hindsight Memory System:**
  - Memory backend resolution: [`src/memory-backend/resolve.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/memory-backend/resolve.ts)
  - Hindsight backend lifecycle: [`src/hindsight/backend.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/hindsight/backend.ts)
  - Hindsight config loader: [`src/hindsight/config.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/hindsight/config.ts)
  - Bank scope derivation: [`src/hindsight/bank.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/hindsight/bank.ts)
- **Status & Intent Lifecycle:**
  - Event controller & live working message: [`src/modes/controllers/event-controller.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/modes/controllers/event-controller.ts)
  - Settings schema: [`src/config/settings-schema.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/config/settings-schema.ts)
- **Upstream Documentation:**
  - [`docs/system-prompt-customization.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/docs/system-prompt-customization.md)
  - [`docs/context-files.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/docs/context-files.md)
  - [`docs/task-agent-discovery.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/docs/task-agent-discovery.md)
  - [`docs/settings.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/docs/settings.md)
  - [`docs/memory.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/docs/memory.md)
  - [`docs/models.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/docs/models.md)
  - [`docs/tools/task.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/docs/tools/task.md)

---

## 2. Executive Summary & Core Hierarchy

In Oh My Pi (`omp`), prompt construction is strictly layered. The runtime dynamically composes system prompts and context based on execution mode (Interactive TUI, ACP Server, or Task Subagent).

```
+-------------------------------------------------------------------------------+
|                             TOP-LEVEL MAIN SESSION                            |
|                                                                               |
|  1. Base Instructions: system-prompt.md OR custom-system-prompt.md (SYSTEM.md)|
|  2. Append Prompts: APPEND_SYSTEM.md (CLI or discovered file, plain text)    |
|  3. Discovered Context: AGENTS.md, CLAUDE.md, repo status                    |
|  4. Discovered Skills & Domain Rules: skill://, rule://, RULES.md             |
|  5. Memory Backend Guidance: Hindsight / Mnemosyne developer instructions    |
|  6. Dynamic Reminders: date-cwd-reminder.md (turn 1 system reminder)         |
+-------------------------------------------------------------------------------+
                                      |
                      Dispatches tool: "task" (agent: "scout")
                                      v
+-------------------------------------------------------------------------------+
|                            SPAWNED SUBAGENT SESSION                           |
|                                                                               |
|  1. Base Harness: Default tool rules & internal URI conventions               |
|  2. § Role: Markdown body of agents/scout.md (APPEND_SYSTEM.md is NOT passed) |
|  3. § Context: Explicit task assignment string from parent                    |
|  4. § Plan / § Coop: Approved plan slice, worktree path, IRC peer roster       |
|  5. § Completion: Strict yield protocol & structured JSON schema (if defined) |
+-------------------------------------------------------------------------------+
```

---

## 3. Main System Prompt Assembly

### Template Selection

OMP chooses between two primary Handlebars templates:

1. **Default Template ([`system-prompt.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/prompts/system/system-prompt.md)):**
   Used when neither `SYSTEM.md` nor `--system-prompt` is provided.
   Contains the complete OMP engineering harness:
   - System conventions (RFC 2119, XML tagging rules, `<system-directive>` handling).
   - Core engineering principles (correctness first, taste, compiled code efficiency).
   - Internal URI schemes (`skill://`, `rule://`, `memory://root`, `agent://`, `history://<agentId>`, `artifact://`, `local://`, `vault://`, `issue://`, `pr://`, `omp://`).
   - Tool inventory, `xd://` device protocol, and specialized tool rules (`read`, `edit`, `write`, `think`, `task`).
   - Terminal yield and completion protocols.

2. **Custom Template ([`custom-system-prompt.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/prompts/system/custom-system-prompt.md)):**
   Used when `SYSTEM.md` or `--system-prompt` is detected.
   - **Renders:** Custom prompt text, `appendPrompt`, discovered context files, skills, and rules.
   - **Strips:** All default tool policies, `xd://` protocol definitions, and internal URL descriptions.

---

## 4. Configuration & Prompt Customization Files

| File | Scope & Location | OMP Handling | Base Harness Impact | Source References |
| :--- | :--- | :--- | :--- | :--- |
| **`SYSTEM.md`** | `<cwd>/.omp/SYSTEM.md`<br>`~/.omp/agent/SYSTEM.md` | Replaces core prompt template with `custom-system-prompt.md`. | **Replaced.** Default tool rules and `xd://` are omitted unless manually declared. | [`src/main.ts#L860`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/main.ts#L860)<br>[`docs/system-prompt-customization.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/docs/system-prompt-customization.md) |
| **`APPEND_SYSTEM.md`** | `<cwd>/.omp/APPEND_SYSTEM.md`<br>`~/.omp/agent/APPEND_SYSTEM.md` | Injected into the prompt footer as **plain text**. Frontmatter is not parsed. | **Preserved.** Full tool engine and protocol support remain active. | [`src/main.ts#L874`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/main.ts#L874)<br>[`src/system-prompt.ts#L314`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/system-prompt.ts#L314) |
| **`AGENTS.md`** | `<cwd>/AGENTS.md`<br>`<cwd>/.omp/AGENTS.md` | Discovered as a project context file (`<project><instructions>`). | **Preserved.** Injected as repository architecture/guidelines. | [`docs/context-files.md#L20`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/docs/context-files.md#L20) |
| **`RULES.md`** | `<cwd>/.omp/RULES.md`<br>`~/.omp/agent/RULES.md` | Loaded as sticky always-apply rules re-attached near current turn. | **Preserved.** Retains high salience across long conversations. | [`docs/context-files.md#L26`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/docs/context-files.md#L26) |
| **`TITLE_SYSTEM.md`** | `<cwd>/.omp/TITLE_SYSTEM.md`<br>`~/.omp/agent/TITLE_SYSTEM.md` | Custom prompt for automatic session titling and replanning summary. | **Preserved.** Governs session title generation. | [`src/main.ts#L399`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/main.ts#L399) |

### Plain-Text Behavior in `APPEND_SYSTEM.md`
If you symlink an agent definition file (e.g. `agents/orchestrator.md`) to `APPEND_SYSTEM.md`:
- OMP loads it via `Bun.file().text()` as plain text.
- Frontmatter fields (`model: "@good"`, `tools: [task, hub]`) are **not** parsed or executed.
- The main session keeps its default tools and selects its model via `modelRoles.default` or CLI flags.

---

## 5. ACP (Agent Client Protocol) Session Resolution

When `omp acp` serves over stdio:

### Protocol Handshake (`initialize`)
Defined in [`packages/coding-agent/src/modes/acp/acp-agent.ts#L493`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/modes/acp/acp-agent.ts#L493):
```json
{
  "protocolVersion": "0.1",
  "agentInfo": {
    "name": "oh-my-pi",
    "title": "Oh My Pi",
    "version": "<version>"
  }
}
```

### Workspace Session Creation (`session/new`)
Defined in [`packages/coding-agent/src/main.ts#L389`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/main.ts#L389) and [`src/modes/acp/acp-agent.ts#L552`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/modes/acp/acp-agent.ts#L552):
1. **Agent ID:** `agentId = "acp:<sessionId>"` generated via `SessionManager.create(cwd)`.
2. **Settings Scoping:** Clones the server's base settings for the session cwd via `args.settings.cloneForCwd(cwd)`.
3. **Model Resolution:** Evaluates CLI launch flags (`--model`), then `<cwd>/.omp/config.yml` (`modelRoles.default`), then active profile `modelRoles.default`.
4. **Context Discovery:** Scans `<cwd>` for `AGENTS.md`, `CLAUDE.md`, `SYSTEM.md`, `APPEND_SYSTEM.md`, and `TITLE_SYSTEM.md`.
5. **MCP Tools:** Disables default host `.mcp.json` by default (`enableMCP: false`) so client-supplied servers shadow cleanly without collisions.

### Dynamic Model Switching via ACP
The client can switch models on an active ACP session at runtime via `session/set_config_option` (`configId: "model"`, `value: "provider/model"`). OMP hot-swaps the model via `AcpAgent.#setModelById` ([`src/modes/acp/acp-agent.ts#L647`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/modes/acp/acp-agent.ts#L647)).

---

## 6. Task Subagent Prompt Construction & Model Routing

Subagents are defined as Markdown files with YAML frontmatter under `~/.omp/agent/agents/*.md` or `.omp/agents/*.md` (see [`docs/task-agent-discovery.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/docs/task-agent-discovery.md)).

### Main Agent vs. Subagent View

```yaml
---
name: scout
description: Fast read-only codebase discovery and symbol grapher.
model: "@fast"
tools: [read, grep, glob, yield]
---

You are @scout. Map code structure, trace call graphs, and emit findings via yield.
```

- **In the Main Session:** OMP only reads `name` and `description` to build the `task` tool parameter documentation ([`src/task/agents.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/task/agents.ts)).
- **In the Subagent Session:** OMP spawns an isolated session running [`subagent-system-prompt.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/prompts/system/subagent-system-prompt.md).

### Subagent Template Assembly ([`src/task/executor.ts#L3091-L3106`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/task/executor.ts#L3091-L3106))

```markdown
§ Role
<--- Injected: Markdown body of agents/<agent-name>.md --->

§ Context
<--- Injected: Assignment string passed into task tool call --->

§ Plan
<--- Injected: Relevant plan section if running within an active plan --->

§ Coop
You are operating on a piece of work assigned to you by the main agent.
Working Tree: <worktree path if isolated>
Peers: <visible IRC peer roster if enabled>

§ Completion
No TODO tracking, no progress updates. Execute; report results with yield.
Yield protocol: <terminal yield schema, structured output definition>
```

### Subagent Model Selection Hierarchy
When `task(agent: "<name>")` executes:
1. `task.agentModelOverrides[agentName]` in `config.yml` (highest priority override).
2. `model` specified in `agents/<name>.md` frontmatter.
3. If it uses a role alias (e.g. `@fast`, `@review`, `@slow`), it expands via `modelRoles.<role>` in effective `config.yml`.
4. Thinking/effort suffix (`:high`, `:medium`) is extracted and clamped to `task.maxEffort`.
5. Fallback: parent session's active model.

### Isolation Invariant
- Subagent sessions do **not** inherit the parent's `APPEND_SYSTEM.md` or `customSystemPrompt` ([`src/task/executor.ts#L3059-L3090`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/task/executor.ts#L3059-L3090)).
- Symlinking `APPEND_SYSTEM.md` to `agents/orchestrator.md` configures the **main session** as `@orchestrator` while child workers (`@scout`, `@reviewer`, `@task`) remain isolated within their own specialist definitions.

---

## 7. Hindsight Memory Resolution Per CWD (Source-Verified)

In OMP, memory configuration is fully scoped and customizable per workspace (`cwd`).

### Source Verification Path
1. `Settings.cloneForCwd(cwd)` ([`src/main.ts#L391`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/main.ts#L391)) deep-merges `<cwd>/.omp/config.yml` with global/profile settings.
2. `resolveMemoryBackend(settings)` ([`src/memory-backend/resolve.ts#L19`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/memory-backend/resolve.ts#L19)) selects the backend via `settings.get("memory.backend")`.
3. `loadHindsightConfig(settings)` ([`src/hindsight/config.ts#L112`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/hindsight/config.ts#L112)) reads all `hindsight.*` keys from the effective scoped `settings`.
4. `computeBankScope(config, directory)` ([`src/hindsight/bank.ts#L88`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/hindsight/bank.ts#L88)) derives the target bank and project tag.

### Scoping Modes (`hindsight.scoping`)
- **`global`**: Uses `hindsight.bankId` (default `omp`) directly with no project tagging.
- **`per-project`**: Automatically isolates each project into its own bank: `<bankIdPrefix>-<bankId>-<projectLabel(cwd)>` (e.g. `omp-mypai` or `omp-csi-whofi`).
- **`per-project-tagged`** (default): Writes to base bank `<bankId>` with tag `project:<projectLabel(cwd)>`. Recall filters on that project tag while also surfacing untagged global memories.

> [!NOTE]
> `git.repo.primaryRootSync` walks up to the primary git repository root or common worktree directory, so all linked git worktrees of a project share the exact same project memory scope.

### Explicit Bank Overrides in `<cwd>/.omp/config.yml`
You can hardcode an explicit bank ID, custom missions, or different retention parameters per repository:
```yaml
# <repo>/.omp/config.yml
memory:
  backend: hindsight

hindsight:
  bankId: "my-custom-repo-bank"      # Hard bank override for this repo
  scoping: global                    # Use this bank exclusively without sub-project tagging
  autoRecall: true                   # Recall relevant context on turn 1
  autoRetain: true                   # Auto-retain every N turns
  retainEveryNTurns: 2               # Retain cadence
  recallBudget: high                 # low | mid | high
  bankMission: "Maintain architectural facts for project X"
```

### Precedence Rule
`HINDSIGHT_*` environment variables (e.g. `HINDSIGHT_BANK_ID`, `HINDSIGHT_API_URL`) take precedence over `config.yml` if exported in the environment. If environment variables are unset, `<cwd>/.omp/config.yml` is authoritative.

---

## 8. Workspace Configuration (`<cwd>/.omp/config.yml`)

Any setting in the OMP configuration schema can be overridden at the repository level via `<cwd>/.omp/config.yml`.

### Merge Behavior
- **Objects (Deep Merged):** Keys in dictionaries (`modelRoles`, `tools`, `compaction`, `hindsight`) merge with global/profile settings.
- **Arrays (Full Replacement):** Array settings (`disabledProviders`, `enabledModels`, `extensions`) **completely overwrite** the global array.

### Configuration Template

```yaml
# <cwd>/.omp/config.yml

# 1. Model Roles & Thinking Levels
modelRoles:
  default: anthropic/claude-sonnet-4-5:high  # Main session default
  smol: openai/gpt-4.1-mini                 # Fast / background jobs
  slow: anthropic/claude-opus-4-5:high      # Deep reasoning
  fast: deepseek/deepseek-v4-flash          # Rapid scans
  review: openai/gpt-5.4:high               # Code reviews
  advisor: anthropic/claude-3-7-sonnet      # Turn watchdog

# 2. Subagent Routing & Overrides
task:
  maxConcurrency: 4
  agentModelOverrides:
    scout: "@fast"
    debugger: "@slow"
    reviewer: "@review"
  agentAdvisor:
    task: "on"

# 3. Tool Permissions & Behavior
tools:
  approvalMode: write       # yolo | write | always-ask
  intentTracing: false      # disable "Marshalling forces..." spinner messages
  maxTimeout: 120           # per-tool timeout cap in seconds
  approval:
    bash: prompt            # prompt for shell execution
    edit: allow             # auto-approve edits

# 4. Bash Interception & Policy
bashInterceptor:
  enabled: true
  patterns:
    - pattern: '^\s*(cat|head|tail)\s+'
      tool: read
      message: "Use the read tool instead of cat/head/tail."

# 5. Tool Toggles
browser:
  enabled: false
computer:
  enabled: false
eval:
  py: true
  js: false
web_search:
  enabled: true

# 6. Provider Disabling (Overwrites global array)
disabledProviders:
  - ollama
  - claude

# 7. Context Compaction
compaction:
  strategy: snapcompact     # snapcompact | truncate | summary
  thresholdPercent: 80

# 8. Hindsight Memory Integration
memory:
  backend: hindsight
hindsight:
  bankId: "project-x-bank"
  scoping: per-project-tagged
  autoRecall: true
  autoRetain: true

# 9. UI & Display
display:
  shimmer: disabled         # classic | kitt | disabled
  hideToolActivity: false
  showTokenUsage: true
```

---

## 9. Intent Tracing & Spinner Messages

### Mechanism
1. When `tools.intentTracing: true` (default), OMP injects parameter `i: { type: "string", description: "concise intent" }` into all tool schemas ([`packages/agent/src/agent-loop.ts#L783-L843`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/agent/src/agent-loop.ts#L783-L843)).
2. The model generates 2–6 word present-participle summaries (e.g. `i: "Reading database schema"` or humorous model generations like `i: "Marshalling forces"`).
3. `EventController.#updateWorkingMessageFromIntent` ([`src/modes/controllers/event-controller.ts#L486-L495`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/modes/controllers/event-controller.ts#L486-L495)) intercepts `args.i` and updates the TUI/ACP status bar from `"Working…"` to `"<intent> (esc to interrupt)"`.

### How to Disable via `config.yml` or Environment

In `~/.omp/agent/config.yml` or `<cwd>/.omp/config.yml`:
```yaml
tools:
  intentTracing: false

display:
  shimmer: disabled
```

Or via environment variable:
```bash
export PI_INTENT_TRACING=0
# Or:
export PI_NO_INTENT=1
```

---

## 10. Recommended Setup for MyPAI Orchestrator & Workers

1. **Top-Level Main Brain (`mypai-main`):**
   - Place persona and coordinator mandate in `APPEND_SYSTEM.md` (or project `AGENTS.md`).
   - Retain full OMP default harness (`system-prompt.md`) for complete tool and protocol support.
2. **Worker Agents (`agents/*.md`):**
   - Place specialists in `.omp/agents/` (`scout.md`, `debugger.md`, `reviewer.md`, `pythonista.md`, `designer.md`, `librarian.md`, `patcher.md`).
   - Use role aliases (`model: "@fast"`, `model: "@review"`) mapped in `config.yml` under `modelRoles`.
3. **Zero-Overhead ACP Workers:**
   - Launch worker ACP instances with `tools.intentTracing: false` to minimize token overhead and latency.
