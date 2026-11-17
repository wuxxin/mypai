# LifeOS Setup Reference & Harness Architecture

> **Superseded 2026-11-16.** Live topology, config plumbing and OS translation are now in `mypai-lifeos-host-linux.md` (renamed from `lifeos-host-linux.md`); harness deltas in `lifeos-omp-difference.md`. Kept for history: §1's topology predates v8's MEMORY-under-USER move, and the §3–4 inference failure is resolved by claude-shim (`~/.local/bin/claude`).

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
| `:21080` | **local-router / Local LLM** | **Active** | `local-router.py` (or `llama-server`) | Unified OpenAI-compatible local inference gateway (`http://localhost:21080/v1`). |
| `:20080`–`:20100` | **Local Inference Engines** | **Active** | `llama-server`, `whisper-server`, etc. | Dedicated engines for chat, embeddings, reranking, STT, TTS, image generation. |

---

## 2. Harness Execution vs. Utility Inference

> **Collapsed 2026-11-17.** The mechanics this section documented (claude binary resolution via `resolveClaudeBin()`, the four effort tiers max/high/medium/low → fable/opus/sonnet/haiku, headless invocation flags, and the credential scrubbing that forces subscription-billing intent) are duplicated verbatim in [`mypai-lifeos-host-linux.md`](mypai-lifeos-host-linux.md) § Model & inference topology, which is the maintained copy. The shim-routed path itself: `../bin/claude-shim.md`. Kept here only as an index; do not maintain two copies of the `Inference.ts` contract.

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
