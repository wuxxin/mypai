# OMP Runtime Configuration & Prompt Architecture Reference

Comprehensive technical reference on `oh-my-pi` (`omp`) configuration lifecycle, system prompt construction, ACP session resolution, subagent execution model, and workspace orchestration.

---

## 1. Source Code Index & Ground Truth

Key implementation files in the `oh-my-pi` codebase:

- **System Prompt Templates & Prompt Engine:**
  - Default template: [`packages/coding-agent/src/prompts/system/system-prompt.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/prompts/system/system-prompt.md)
  - Custom template (`SYSTEM.md` active): [`packages/coding-agent/src/prompts/system/custom-system-prompt.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/prompts/system/custom-system-prompt.md)
  - Subagent template: [`packages/coding-agent/src/prompts/system/subagent-system-prompt.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/prompts/system/subagent-system-prompt.md)
  - Project footer template: [`packages/coding-agent/src/prompts/system/project-prompt.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/prompts/system/project-prompt.md)
  - System prompt compiler: [`packages/coding-agent/src/system-prompt.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/system-prompt.ts)
  - Core agent loop & tool normalization: [`packages/agent/src/agent-loop.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/agent/src/agent-loop.ts)
  - Session creation & SDK: [`packages/coding-agent/src/sdk.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/sdk.ts)
  - CLI entry & session options builder: [`packages/coding-agent/src/main.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/main.ts)
- **Embedded Workflow Commands:**
  - Init template: [`packages/coding-agent/src/prompts/agents/init.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/prompts/agents/init.md)
  - Command loader & registry: [`packages/coding-agent/src/task/commands.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/task/commands.ts)
- **Capability Discovery System:**
  - Native provider (`.omp`): [`packages/coding-agent/src/discovery/builtin.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/discovery/builtin.ts)
  - Context file discovery (`AGENTS.md`): [`packages/coding-agent/src/discovery/agents-md.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/discovery/agents-md.ts)
- **ACP (Agent Client Protocol) Server:**
  - Protocol handler & session manager: [`packages/coding-agent/src/modes/acp/acp-agent.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/modes/acp/acp-agent.ts)
  - Transport & factory lifecycle: [`packages/coding-agent/src/modes/acp/acp-mode.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/modes/acp/acp-mode.ts)
- **Task & Subagent Subsystem:**
  - Subagent spawning & prompt composition: [`packages/coding-agent/src/task/executor.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/task/executor.ts)
  - Subagent definition discovery: [`packages/coding-agent/src/task/discovery.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/task/discovery.ts)
  - Agent registry: [`packages/coding-agent/src/task/agents.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/task/agents.ts)
- **Hindsight Memory System:**
  - Backend resolution: [`packages/coding-agent/src/memory-backend/resolve.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/memory-backend/resolve.ts)
  - Config loader: [`packages/coding-agent/src/hindsight/config.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/hindsight/config.ts)
  - Bank scope computation: [`packages/coding-agent/src/hindsight/bank.ts`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/hindsight/bank.ts)
- **Installed Documentation & Examples (`/usr/share/doc/oh-my-pi`):**
  - Architecture specs, config reference, tool guides, and API docs are installed to `/usr/share/doc/oh-my-pi/`.
  - SDK, tool, extension, and hook examples are installed to `/usr/share/doc/oh-my-pi/examples/`.

---

## 2. Configuration Flow & Precedence Hierarchy

OMP uses a tiered configuration system combining global defaults, profile settings, repository-scoped overrides, environment variables, and CLI flags.

```
+-------------------------------------------------------------------------------+
|                             CONFIGURATION LAYERS                              |
|                                                                               |
|  1. Global / Profile Defaults: ~/.omp/profiles/<name>/agent/config.yml        |
|  2. Repository / Workspace:    <cwd>/.omp/config.yml (or settings.json)       |
|  3. Environment Variables:     PI_*, OMP_*, HINDSIGHT_*                       |
|  4. CLI Launch Flags:          --model, --thinking, --approval-mode, etc.      |
|  5. Runtime Session Hot-Swap:  ACP set_config_option / in-session commands    |
+-------------------------------------------------------------------------------+
```

### Deep Merge vs. Array Replacement Rules

- **Objects (Deep Merged):** Settings dictionaries are recursively merged. Repository keys override user/profile keys:
  - `modelRoles` (e.g. `default`, `fast`, `slow`, `review`, `smol`)
  - `task.agentModelOverrides` (per-agent model mappings)
  - `tools`, `tools.approval` (permissions and per-tool policies)
  - `compaction` (strategy, thresholdPercent)
  - `hindsight` (bankId, scoping, autoRecall, retainEveryNTurns)
  - `ttsr` (token-triggered sticky rules)
- **Arrays (Full Replacement):** Lists completely overwrite the parent array. Defining a list in `<cwd>/.omp/config.yml` discards all global entries for that setting:
  - `disabledProviders`
  - `enabledModels`
  - `extensions`
  - `task.disabledAgents`

---

## 3. System Prompt Layering & Construction Engine

OMP constructs system prompts in distinct layers depending on whether the session is a **Main Agent** or a **Spawned Subagent**.

```
============================= MAIN SESSION PROMPT =============================
Block 0: Core Harness Template (system-prompt.md or custom-system-prompt.md)
  ├── 1. System conventions (RFC 2119, XML tags, <system-directive> handling)
  ├── 2. Core engineering principles (correctness first, compiled code efficiency)
  ├── 3. Internal URI schemes (skill://, rule://, memory://root, agent://, xd://)
  ├── 4. Tool inventory & xd:// device protocol
  ├── 5. Discovered skills (~/.omp/agent/skills/ and <repo>/.omp/skills/)
  ├── 6. Always-apply sticky rules (RULES.md, alwaysApply=true)
  └── 7. Personality block (~/.omp/agent/PERSONALITY.md or settings preset)

Block 1: Project Prompt Footer (project-prompt.md)
  ├── <workstation> (OS, Distro, Kernel, Arch, CPU, GPU, Terminal, Model)
  ├── <repo-rules> (discovering and inlining AGENTS.md, CLAUDE.md)
  ├── <dir-context> (nested AGENTS.md directory pointers)
  ├── <workspace-tree> (working directory layout if enabled)
  ├── <workspace-roots> (additional multi-root workspace paths)
  ├── <critical> (core execution directives & verification rules)
  └── appendPrompt:
        ├── Memory backend developer instructions (Hindsight / Mnemosyne)
        ├── Auto-learn developer instructions (manage_skill / learn)
        ├── Connected MCP server instructions
        ├── MCP xd:// routing guidance
        └── Injected APPEND_SYSTEM.md (plain text persona / orchestrator role)

Block 2+: Safety & Nested Repo Reminders
  ├── Computer safety prompt (if 'computer' tool is active)
  └── Active nested repo context (if running in a sub-repo worktree)
================================================================================
```

### Template Selection

- **Default Template ([`system-prompt.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/prompts/system/system-prompt.md)):**
  Used when no `SYSTEM.md` or `--system-prompt` flag is passed. Contains the entire OMP engineering harness, RFC 2119 directives, tool catalog, `xd://` device protocol, and URI schemes.
- **Custom Template ([`custom-system-prompt.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/prompts/system/custom-system-prompt.md)):**
  Used when `SYSTEM.md` or `--system-prompt` is present. Replaces the default harness and strips built-in tool policy definitions unless explicitly written into the custom prompt.

---

## 4. Context Files, System Prompts & Roles

| File | Scope & Discovery | OMP Processing | System Impact |
| :--- | :--- | :--- | :--- |
| **`APPEND_SYSTEM.md`** | `<cwd>/.omp/APPEND_SYSTEM.md`<br>`~/.omp/agent/APPEND_SYSTEM.md` | Loaded as **plain text** via `Bun.file().text()`. Injected into `appendPrompt` in the project prompt footer. | **Preserves full harness.** Main session gets the added persona (e.g. `@orchestrator`); subagents do NOT receive it. |
| **`SYSTEM.md`** | `<cwd>/.omp/SYSTEM.md`<br>`~/.omp/agent/SYSTEM.md` | Switches template from `system-prompt.md` to `custom-system-prompt.md`. | **Replaces harness.** Omits default tool instructions and `xd://` device protocol unless manually specified. |
| **`AGENTS.md`** | `<cwd>/AGENTS.md`<br>`<ancestors>/AGENTS.md`<br>`.omp/AGENTS.md` | Loaded via `agents-md` capability provider. Injected into `<repo-rules>` and `<dir-context>`. | **Preserves full harness.** Provides codebase guidelines, architecture maps, and developer commands. |
| **`RULES.md`** | `<cwd>/.omp/RULES.md`<br>`~/.omp/agent/RULES.md` | Synthesized as sticky `alwaysApply: true` rules. | **Preserves full harness.** Re-injected near the current turn across long conversations for high salience. |
| **`TITLE_SYSTEM.md`** | `<cwd>/.omp/TITLE_SYSTEM.md`<br>`~/.omp/agent/TITLE_SYSTEM.md` | Passed to automatic titling engine. | Governs session title generation and replan summary names. |

### Plain-Text Behavior in `APPEND_SYSTEM.md`
When an agent specification (such as `agents/orchestrator.md`) is linked or copied to `APPEND_SYSTEM.md`:
- OMP reads it as plain markdown text.
- YAML frontmatter fields (e.g. `model: "@slow"`, `tools: [task, eval]`) are not executed as frontmatter metadata.
- The session default model is governed by `modelRoles.default` or CLI flags, and tools are governed by the tool registry.

---

## 5. Workflow Template `/init` (`packages/coding-agent/src/prompts/agents/init.md`)

The file [`packages/coding-agent/src/prompts/agents/init.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/prompts/agents/init.md) is embedded at build time into `EMBEDDED_COMMANDS` within `packages/coding-agent/src/task/commands.ts`.

### When `init.md` is Used
1. **Invocation:** Triggered whenever a user or agent invokes the `/init` slash command in a repository.
2. **Execution Flow:**
   - OMP resolves `/init` via `slashCommandCapability`.
   - The agent executes the instructions in `init.md`: spawns parallel `task` research agents targeting:
     - `core src` (main source directories, patterns, key modules)
     - `tests` (test frameworks, commands, coverage expectations)
     - `configs/build` (build tools, package manager, runtimes)
     - `scripts/docs` (documentation, scripts, environment preferences)
   - Synthesizes findings into a canonical `AGENTS.md` file written directly to the project root.
3. **Mandatory Output Schema:**
   - Must be titled `"Repository Guidelines"`.
   - Sections: *Project Overview*, *Architecture & Data Flow*, *Key Directories*, *Development Commands*, *Code Conventions & Common Patterns*, *Important Files*, *Runtime/Tooling Preferences*, *Testing & QA*.

---

## 6. Spawn Configurations & Session Topologies

OMP supports two primary runtime topologies: **Interactive TUI Session** and **ACP Server Session**.

```
                      +-----------------------------+
                      |   HOST SPAWN INITIALIZATION |
                      +-----------------------------+
                                     |
             +-----------------------+-----------------------+
             v                                               v
+-----------------------------+               +-----------------------------+
|   INTERACTIVE CLI (`omp`)   |               |   ACP SERVER (`omp acp`)    |
|                             |               |                             |
| • CWD = launch repo         |               | • Started headless (stdio)  |
| • Reads ~/.omp & repo .omp  |               | • Client calls session/new  |
| • Injects APPEND_SYSTEM.md  |               | • Clones settings for CWD   |
| • Top-level = @orchestrator |               | • Discovers CWD AGENTS.md   |
+-----------------------------+               +-----------------------------+
             |                                               |
             +-----------------------+-----------------------+
                                     v
                      +-----------------------------+
                      |     TASK SUBAGENT SPAWN     |
                      |    (task agent: "scout")    |
                      +-----------------------------+
                      |                             |
                      | • Template: subagent-prompt |
                      | • Role: agents/scout.md     |
                      | • APPEND_SYSTEM.md: OMITTED |
                      | • Isolated plan & yield     |
                      +-----------------------------+
```

### 1. Interactive CLI (`omp`) in a Workdir
- **Launch:** User runs `omp` inside a git repository.
- **Main Agent Session:**
  - Reads `~/.omp/agent/config.yml` merged with `<cwd>/.omp/config.yml`.
  - Discovers `<cwd>/AGENTS.md` and inlines it into `<repo-rules>`.
  - Discovers `APPEND_SYSTEM.md` (project `.omp/APPEND_SYSTEM.md` or user `~/.omp/agent/APPEND_SYSTEM.md`).
  - Appends `@orchestrator` instructions to the main session's `appendPrompt`.
- **Spawned Subagents:**
  - Subagents invoked via `task(agent: "<name>")` run [`subagent-system-prompt.md`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/prompts/system/subagent-system-prompt.md).
  - Subagents **never** inherit `APPEND_SYSTEM.md` or the orchestrator role. They only receive their dedicated specialist role from `agents/<name>.md`.

### 2. ACP Server (`omp acp`) Session Resolution
- **Launch:** Daemon host (`aoe` on `:28080` or an IDE client) spawns `omp acp` over stdio.
- **Client Workspace Selection:** The client issues `session/new` with `cwd: "/path/to/repo"`.
- **Factory Execution ([`packages/coding-agent/src/main.ts#L402`](../submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi/packages/coding-agent/src/main.ts#L402)):**
  1. Clones settings for target workspace via `settings.cloneForCwd(cwd)`.
  2. Creates session manager for the target `cwd`.
  3. Re-discovers `TITLE_SYSTEM.md` for target `cwd`.
  4. Inherits `baseOptions` (carrying `appendSystemPrompt` and `customSystemPrompt` from the server's active profile).
- **Case A: Workdir has NO `.omp/` directory:**
  - The interactive ACP agent inherits the `@orchestrator` role from the global profile's `APPEND_SYSTEM.md`.
  - Automatically discovers and inlines the repository's root `AGENTS.md`.
  - Spawned subagents do not inherit `APPEND_SYSTEM.md`.
  - **Result:** Identical behavior to running `omp` interactively in that workdir.
- **Case B: Workdir HAS `.omp/` directory:**
  - `<cwd>/.omp/config.yml` overrides settings: Hindsight memory banks, `modelRoles`, tool settings, compaction policies.
  - `<cwd>/.omp/APPEND_SYSTEM.md` overrides or extends the top-level main session instructions.
  - Common runtime knowledge (e.g. MyPAI runtime APIs, Hindsight REST client, `amux` message bus) is injected via shared skill references (`skill://mypai_runtime` or `.omp/skills/mypai_runtime/SKILL.md`), eliminating the need to duplicate runtime API docs across every repository's `AGENTS.md`.

---

## 7. Subagent Model Routing & Execution Isolation

Subagents are defined as markdown files with YAML frontmatter in `~/.omp/agent/agents/*.md` or `.omp/agents/*.md`.

```yaml
---
name: scout
description: Fast read-only codebase discovery and symbol grapher.
model: "@fast"
tools: [read, grep, glob, yield]
---

You are @scout. Map code structure, trace call graphs, and emit findings via yield.
```

### Main Agent vs. Subagent View
- **Main Agent:** Reads only `name` and `description` to build parameter documentation for the `task` tool.
- **Subagent:** Executes in an isolated session running `subagent-system-prompt.md`:
  - `§ Role`: Body of `agents/scout.md`.
  - `§ Context`: Exact assignment string passed to the `task` tool.
  - `§ Plan`: Approved plan slice (if operating under a plan).
  - `§ Coop`: Worktree path and IRC peer roster.
  - `§ Completion`: Structured JSON schema and `yield` protocol.

### Subagent Model Selection Precedence
1. `task.agentModelOverrides[agentName]` in `<cwd>/.omp/config.yml` (highest priority).
2. `model` in `agents/<name>.md` frontmatter.
3. Role expansion via `modelRoles.<role>` in effective `config.yml` (e.g. `@fast` -> `deepseek/deepseek-v4-flash`).
4. Thinking effort suffix (e.g. `:high`) clamped to `task.maxEffort`.
5. Fallback: Parent session's active model.

---

## 8. Hindsight Memory Resolution Per Workspace

Memory configuration in OMP is scoped per workspace (`cwd`).

### Resolution Path
1. `Settings.cloneForCwd(cwd)` deep-merges `<cwd>/.omp/config.yml`.
2. `resolveMemoryBackend(settings)` reads `memory.backend` (`hindsight`).
3. `loadHindsightConfig(settings)` reads `hindsight.*` settings.
4. `computeBankScope(config, directory)` derives the active bank and project tag.
5. `git.repo.primaryRootSync` traverses to the primary git root, ensuring all worktrees of a project share identical memory scope.

### Scoping Modes (`hindsight.scoping`)
- **`global`**: Uses `hindsight.bankId` directly without sub-project tagging.
- **`per-project`**: Automatically isolates projects into discrete banks: `<bankIdPrefix>-<bankId>-<projectLabel(cwd)>` (e.g. `omp-mypai`).
- **`per-project-tagged`** (default): Writes to `hindsight.bankId` with tag `project:<projectLabel(cwd)>`. Recall queries filter on that tag while surfacing untagged global memories.

### Repository Override Example
```yaml
# <repo>/.omp/config.yml
memory:
  backend: hindsight

hindsight:
  bankId: "my-repo-bank"
  scoping: global
  autoRecall: true
  autoRetain: true
  retainEveryNTurns: 2
  recallBudget: high
  bankMission: "Maintain architectural and implementation facts for repository X"
```

---

## 9. Intent Tracing, Display & Performance Settings

### Mechanism
- When `tools.intentTracing: true` (default), OMP adds `i: { type: "string", description: "concise intent" }` to tool schemas.
- The model generates 2–6 word present-participle summaries (`i: "Reading database schema"`).
- `EventController` intercepts `args.i` and updates status displays from `"Working…"` to `"<intent> (esc to interrupt)"`.

### Disabling for Low Latency / Worker Subagents
In `~/.omp/agent/config.yml` or `<cwd>/.omp/config.yml`:
```yaml
tools:
  intentTracing: false

display:
  shimmer: disabled
```
Or via environment variables:
```bash
export PI_INTENT_TRACING=0
export PI_NO_INTENT=1
```

---

## 10. Recommended Architecture for MyPAI Orchestrator & Workers

1. **Top-Level Orchestrator (`mypai-main`):**
   - Place persona and coordinator directives in `APPEND_SYSTEM.md` (or project `AGENTS.md`).
   - Retain full OMP harness (`system-prompt.md`) for full tool access, `xd://` device protocol, and loopback operations.
2. **Specialist Worker Agents (`agents/*.md`):**
   - Place worker definitions in `.omp/agents/` (`scout.md`, `debugger.md`, `reviewer.md`, `pythonista.md`, `designer.md`, `librarian.md`, `patcher.md`).
   - Use role aliases (`model: "@fast"`, `model: "@review"`) mapped in `config.yml` under `modelRoles`.
3. **ACP Workers:**
   - In repositories without `.omp/`, ACP workers inherit the global `@orchestrator` persona and read repo `AGENTS.md`.
   - In repositories with `.omp/`, repo configs override memory banks and prompts, while shared skills (`skill://mypai_runtime`) supply runtime API documentation without duplication.
