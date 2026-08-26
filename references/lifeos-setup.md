# LifeOS Setup Reference & Harness Architecture

This document details the architectural topology of LifeOS, its integration with the Oh My Pi (OMP) / MyPAI runtime mesh, the mechanics of utility inference vs. agent harness execution, and a root cause diagnostic for background inference failures.

---

## 1. System Topology & Storage Architecture

LifeOS runs as a hybrid system with the core framework located in the OMP profile directory, persistent private state stored in an isolated git repository, and background observability services running via sidecars.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             Host Filesystem                              │
│                                                                          │
│  ~/.claude ───────► (Symlink) ───────► ~/.omp                            │
│                                           │                              │
│                                           ├── LIFEOS/ (Framework Core)   │
│                                           │    ├── PULSE/ (Dashboard)    │
│                                           │    ├── TOOLS/ (Utilities)    │
│                                           │    ├── USER ──┐ (Symlink)    │
│                                           │    └── MEMORY ┘              │
│                                           │           │                  │
│  ~/agent-private/lifeos ◄─────────────────┴───────────┘                  │
│    (Private Repository: TELOS, Identity, Long-Term Memory)               │
└──────────────────────────────────────────────────────────────────────────┘
```

### Directory Locations & Symlinks

| Component | Path | Description |
|---|---|---|
| **LifeOS Core** | `~/.omp/LIFEOS` (via `~/.claude/LIFEOS`) | Framework engine, system prompts, tools, and Pulse dashboard. |
| **Claude / OMP Profile** | `~/.claude` $\to$ `~/.omp` | User configuration directory. `~/.claude` symlinks to `~/.omp`. |
| **Private State** | `~/agent-private/lifeos` | User state of record (`USER/`, `MEMORY/`, `TELOS/`). |
| **LifeOS Mounts** | `~/.omp/LIFEOS/USER` $\to$ `~/agent-private/lifeos/USER`<br>`~/.omp/LIFEOS/MEMORY` $\to$ `~/agent-private/lifeos/MEMORY` | Symlinks binding private user state into the LifeOS engine. |
| **MyPAI Workspace** | `~/agent-shared/code/mypai` | Python runtime (`mypai_runtime`), test suites, and orchestration CLI. |

### Network Services & Port Mapping

| Port | Service | Process / Command | Responsibility |
|---|---|---|---|
| `:31337` | **Pulse** | `bun run --cwd ~/.claude/LIFEOS/PULSE pulse.ts` | LifeOS dashboard, background hooks, voice server, and metrics. |
| `:28080` | **Agent of Empires (AoE)** | `aoe serve --port 28080` | ACP execution host, TUI cockpit, worktree supervisor. |
| `:28824` | **amux-server** | `amux-server` | Cognitive state store, durable Kanban board, message bus, cron. |
| `:28888` | **Hindsight** | `hindsight-server` | Long-term vector/lexical memory bank sync and recall. |
| `:9810` | **cc-connect** | `cc-connect --config ~/.cc-connect/config.toml` | Chat ingress and bridge. |
| `:21080` | **llama.cpp / Local LLM** | `llama-server` (or proxy) | Local inference provider (`http://localhost:21080/v1`). |

---

## 2. Harness Execution vs. Utility Inference

In this environment, two distinct execution mechanisms govern AI calls:

1. **OMP / MyPAI Agent Execution (Interactive & Task Loops)**
2. **LifeOS Utility Inference (`Inference.ts` CLI Subprocess)**

```
                                  AI INVOCATION PATHS
                                 
   [ Interactive Agent Loop ]                  [ LifeOS Background / Pulse ]
               │                                             │
               ▼                                             ▼
   Agent of Empires / OMP                       LifeOS PULSE / Tools / Hooks
    (~/.omp/agent/config.yml)                    (e.g., algorithm-tab.ts)
               │                                             │
               ▼                                             ▼
     Local / API Providers                         LIFEOS/TOOLS/Inference.ts
  (e.g., llama.cpp :21080/v1)                                │
                                                             ▼
                                                Subprocess: `claude` CLI
                                                (--output-format json)
                                                             │
                                                             ▼
                                                Anthropic Subscription API
```

### A. OMP Agent Execution (`~/.omp/agent/`)

- **Configuration:** `~/.omp/agent/config.yml` and `~/.omp/agent/models.yml`.
- **Primary Model Role:** Defaults to `llama.cpp/qwen3` at `http://localhost:21080/v1` or configured cloud providers.
- **Role:** Drives the primary agent loop, conversational turns, MCP tools, and subagents (`aoe`).

### B. LifeOS Utility Inference (`LIFEOS/TOOLS/Inference.ts`)

LifeOS scripts, background hooks, and Pulse dashboard tabs execute targeted LLM calls (e.g., classifying amber items, summarizing the algorithm chain) using `LIFEOS/TOOLS/Inference.ts`.

#### 1. Executable Binary Resolution (`Inference.ts:60-65`)
The function `resolveClaudeBin()` locates the `claude` executable:
```typescript
export function resolveClaudeBin(): string {
  const fromPath = typeof Bun !== "undefined" ? Bun.which("claude") : null;
  if (fromPath) return fromPath;
  const fallback = join(homedir(), ".local", "bin", "claude");
  return existsSync(fallback) ? fallback : "claude";
}
```

#### 2. Model & Tier Resolution (`models.ts:26-31`, `70-75`)
LifeOS defines four effort levels mapping to Claude models:
```typescript
export const EFFORT_MODEL: Record<EffortLevel, ClaudeTier> = {
  max: "fable",     // top rung -> claude-fable-5
  high: "opus",     // high rung -> claude-opus-5
  medium: "sonnet", // medium rung -> claude-sonnet-5
  low: "haiku",     // low rung -> claude-haiku-4-5-20251001
};
```

#### 3. Execution Flags & Invocation (`Inference.ts:257-278`)
`Inference.ts` spawns `claude` as a headless child process:
```bash
claude \
  --print \
  --model <model> \
  --effort high \
  --tools '' \
  --output-format json \
  --exclude-dynamic-system-prompt-sections \
  --setting-sources '' \
  --system-prompt <prompt>
```
The user prompt is piped to `stdin` to avoid OS argument length limits (`ARG_MAX` / `MAX_ARG_STRLEN`).

#### 4. Credential Scrubbing & Precedence (`Inference.ts:215-234`)
`Inference.ts` strips environment variables to force Claude Code subscription billing and prevent API key / local gateway leaks:
```typescript
const env = { ...process.env };
delete env.CLAUDECODE;          // Prevent nested session detection
delete env.ANTHROPIC_API_KEY;   // Force OAuth subscription over API key
delete env.ANTHROPIC_AUTH_TOKEN;
delete env.ANTHROPIC_BASE_URL;  // Bypass LiteLLM / local proxies to reach Anthropic directly
```

---

## 3. Diagnostic Analysis: Background Inference Failure

### The Error

When Pulse boots or the Algorithm tab is requested, the following error is logged:
```
[algorithm-tab] inference(low) failed (exit 1): Error: api error: claude JSON envelope is_error=true api_error_status=null
```

### Failure Sequence

```
1. Pulse Module (algorithm-tab.ts:308)
   │  Calls: `bun Inference.ts --level low --timeout 45000 <system_prompt> <user_prompt>`
   ▼
2. Inference.ts (Inference.ts:257)
   │  Resolves level "low" -> "haiku" (claude-haiku-4-5-20251001).
   │  Scrubs ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, and ANTHROPIC_BASE_URL.
   │  Spawns `claude --print --model haiku --output-format json ...`.
   ▼
3. Claude CLI Subprocess
   │  Attempts to authenticate against Anthropic using cached OAuth session in ~/.claude/.
   │  Fails (no valid Claude Code subscription / session expired or missing on Linux host).
   │  Outputs error envelope to stdout:
   │    `{"is_error": true, "api_error_status": null, "result": "..."}`
   ▼
4. Inference.ts Envelope Parser (Inference.ts:383-392)
   │  Detects `envelope.is_error === true`.
   │  Writes to stderr:
   │    `Error: api error: claude JSON envelope is_error=true api_error_status=null`
   │  Exits with process code 1.
   ▼
5. Pulse Error Logger (algorithm-tab.ts:319)
   │  Catches exit code 1.
   │  Emits log: `[algorithm-tab] inference(low) failed (exit 1): ...`
```

### Root Cause
`Inference.ts` strictly requires a functioning `claude` CLI authenticated via an active Anthropic Claude Code subscription. In an environment running purely local models (e.g. OMP on `llama.cpp:21080`) or where Claude Code has not been logged in on the Linux host, any background LifeOS utility inference call will fail with `is_error=true`.

---

## 4. Configuration & Remediation Options

Depending on the operational goals, three solutions resolve or mitigate this failure:

### Option 1: Authenticate the `claude` CLI (Subscription Mode)
If Claude Code subscription inference is desired for LifeOS background tasks:
1. Run `claude login` in the terminal on the host.
2. Complete OAuth authentication in the browser.
3. Test inference manually:
   ```bash
   bun ~/.claude/LIFEOS/TOOLS/Inference.ts --level low "You are a helper" "Say hello"
   ```

### Option 2: Route `Inference.ts` to Local / Custom Model Provider
If background utility tasks should run through local models (such as `llama.cpp` on `:21080` or `LiteLLM`):
1. In `~/.omp/LIFEOS/TOOLS/Inference.ts`, adjust the environment scrubbing logic so `ANTHROPIC_BASE_URL` and `ANTHROPIC_API_KEY` are retained when explicit custom endpoints are configured.
2. Direct the CLI or HTTP client to point to `http://localhost:21080/v1` or an OpenAI-compatible bridge.

### Option 3: Graceful Degradation in Pulse
Pulse dashboard modules (such as `algorithm-tab.ts`) already handle inference failures gracefully:
- When `inference()` returns `null`, the tab displays fallback static documentation rather than crashing the HTTP server.
- The server remains fully operational on `:31337` while logging the diagnostic note to the journal.
