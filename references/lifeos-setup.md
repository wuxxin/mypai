# LifeOS Setup Reference & Harness Architecture

> [!IMPORTANT]
> **Current Focus & Status**:
> - **LifeOS Integration:** The primary active engineering focus is layering and stabilizing LifeOS into OMP. The integration is currently basically working, but actively undergoing adjustments.
> - **`mypai_runtime`:** The Python runtime package (`src/mypai_runtime/`) will be used in the target setup, but is **not currently used or ported to be used correctly** yet. Porting is scheduled once LifeOS integration adjustments are stabilized.

This document details the architectural topology of LifeOS, its integration with Oh My Pi (OMP), the mechanics of utility inference vs. agent harness execution, and diagnostics for background inference.

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

| Port | Service | Status | Process / Command | Responsibility |
|---|---|---|---|---|
| `:31337` | **Pulse** | **Active** | `bun run --cwd ~/.claude/LIFEOS/PULSE pulse.ts` | LifeOS dashboard, background hooks, voice server, and metrics. |
| `:28888` | **Hindsight** | **Active** | `hindsight-server` | Long-term vector/lexical memory bank sync and mental model recall. |
| `:21080` | **local-router / Local LLM** | **Active** | `local-router.py` (or `llama-server`) | Unified OpenAI-compatible local inference gateway (`http://localhost:21080/v1`). |
| `:20080`–`:20100` | **Local Inference Engines** | **Active** | `llama-server`, `whisper-server`, etc. | Dedicated engines for chat, embeddings, reranking, STT, TTS, image generation. |
| `:28080` | **Agent of Empires (AoE)** | *Retired (Gen-2)* | `aoe serve --port 28080` | Legacy ACP execution host and TUI cockpit (superseded by direct OMP harness). |
| `:28824` | **amux-server** | *Retired (Gen-2)* | `amux-server` | Legacy cognitive state store, Kanban board, and cron bus (superseded by LifeOS + OMP). |
| `:9810` | **cc-connect** | *Retired (Gen-2)* | `cc-connect` | Legacy chat ingress bridge (superseded by direct OMP channels / Pulse). |
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
          Oh-My-Pi (OMP)                               LifeOS PULSE / Tools / Hooks
    (~/.omp/agent/config.yml)                    (e.g., algorithm-tab.ts)
               │                                             │
               ▼                                             ▼
     Local / API Providers                         LIFEOS/TOOLS/Inference.ts
  (e.g., local-router :21080)                                │
                                                             ▼
                                                Subprocess: `claude` CLI / shim
                                                (--output-format json)
                                                             │
                                                             ▼
                                                Anthropic API or Local OMP Shim

### A. OMP Agent Execution (`~/.omp/agent/`)

- **Configuration:** `~/.omp/agent/config.yml` and `~/.omp/agent/models.yml`.
- **Primary Model Role:** Defaults to configured models (`local-router`, cloud providers) configured in `models.yml`.
- **Role:** Drives the primary agent loop, conversational turns, MCP tools, and subagents (`task(agent: "...")`).
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
