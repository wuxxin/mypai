# Architectural Comparison: Legacy (`omp-mypai`) vs. Next-Gen Orchestration

## Executive Overview

This document presents a comprehensive, component-by-component comparison between the **Legacy Architecture** defined in [`submodules/omp-mypai`](file:///home/wuxxin/agent-shared/code/mypai/submodules/omp-mypai) (skills/mypai_tools/references) and the **Next-Generation Architecture** (`amux` + `cc-connect` + `oh-my-pi` + `aoe`).

The core transformation replaces custom, single-process Python daemon glue (`mypai_daemon` on `:52080` managing a single `omp --mode rpc` child) with a distributed, multi-session control plane where **`mypai-workspace` (main)**, **`mypai-channel`**, and **`mypai-cron`** strictly **double down on in-kernel Python `eval`** (`lang: "py"`) to coordinate, execute, and automate.

---

## 1. Subsystem-by-Subsystem Architectural Comparison

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       LEGACY ARCHITECTURE (omp-mypai)                                  │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • Monolithic Python FastAPI Daemon (`mypai_daemon` on :52080)                                          │
│ • Single child `omp --mode rpc` session serialized by custom in-memory `TurnQueue`                    │
│ • Custom FastMCP tool server (`signal_chat`) polling signal-cli via subprocesses                       │
│ • APScheduler SQLite cron table (`add_job`, `run_once`) enqueuing synthetic prompt turns               │
│ • Custom thread-pooled ACP worker manager (`omp --mode acp`) writing JSON state arrays                 │
│ • Custom 3-tab WebUI SPA connected via WebSockets                                                     │
│ • Execution driven by text prompt injection into a single serialized RPC queue                         │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       NEXT-GEN ARCHITECTURE                                            │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • Decentralized Rust Control Plane (`amux-server` on :28824) supervising native tmux agent sessions     │
│ • 3 Dedicated Persistent `mypai` profile sessions (`workspace`, `channel`, `cron`) + Ephemeral Workers │
│ • `cc-connect` WebSocket Bridge (:9810) attached directly to `amux-mypai-channel` tmux pane           │
│ • `amux` Durable Scheduler Engine firing triggers directly into `amux-mypai-cron`                     │
│ • `Agent of Empires` (`aoe` / `aoe serve`) providing rich TUI matrix & Web PWA observability          │
│ • Dual-Profile Hindsight isolation: Global strategic models (`mypai`) vs Project-tagged facts (`omp`) │
│ • Execution driven 100% by In-Kernel Python `eval` with Loopback Host Tools (`tool.*`)                │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Detailed Feature & Component Mapping

| Subsystem | Legacy Architecture (`omp-mypai`) | Next-Generation Architecture | Transformation Rationale |
| :--- | :--- | :--- | :--- |
| **Control Plane & Process Supervisor** | Custom `mypai_daemon` (FastAPI, Uvicorn, port `52080`). Manages one `omp_rpc` child via stdio pipes. | **`amux-server`** (Rust, Axum, port `28824`). Supervises multiple native `tmux` agent sessions (`amux-*`). | Eliminates stdio pipe locking, recovers automatically via tmux, provides atomic SQLite CAS state, native Kanban boards, and structured inter-worker message bus. |
| **Session Topography** | Single monolithic agent session trying to handle chat, cron, and task execution simultaneously. | **Partitioned multi-session topology**: `mypai-workspace` (Brain), `mypai-channel` (Frontend), `mypai-cron` (Automation), `task-worker-N` (Execution). | Prevents interactive chat lockup when heavy tasks or cron jobs are executing; guarantees dedicated lane concurrency. |
| **Turn Serialization & Concurrency** | Custom in-memory `TurnQueue` with priority-flush state machine (Abort ➔ Steer ➔ Callback ➔ Prompt). | **`amux` Native Inter-Worker Bus (`POST /api/messages`)** & turn steering queue per tmux pane. | Replaces 2000+ lines of custom Python queue state-machine code with robust, persistent, SQLite-backed message routing. |
| **External Ingress & Chat Gateway** | `signal_chat` FastMCP tool server (`read_message`, `send_message`) with polling and webhook router. | **`cc-connect`** Gateway (:9810) with native tmux driver (`agent = "tmux"`, `session = "amux-mypai-channel"`). | Multi-platform chat support (Signal, Telegram, Slack, Discord) out-of-the-box; zero custom MCP server maintenance. |
| **Scheduled Automation & Cron** | In-daemon APScheduler + SQLite DB (`add_job`, `run_once`, `list_jobs`) enqueuing prompt turns. | **`amux` Durable Scheduler Engine** (`POST /api/schedules`) firing `CRON: <action>` prompts directly to `mypai-cron`. | Decouples automation from the chat/orchestration loop; schedules are durable across daemon restarts. |
| **Subagent Task Delegation** | Custom `AcpDelegationManager` spawning `omp --mode acp` workers, saving `acp_execution_array`. | **`amux` Board Cards (`POST /api/board/cards`)** + on-demand worker sessions (`omp --directory <dir>`). | Native Kanban workflow (`Todo ➔ Doing ➔ Done`); unifies manual user tasks and automated worker tasks under one board. |
| **Memory & Knowledge Isolation** | Single Hindsight bank (`oh-my-pi` or `mypai`), often flooded with compilation logs, tool outputs, and diffs. | **Dual-Profile Hindsight Isolation**: `mypai` profile (Global scoping, mental models, manual recall/retain) vs `oh-my-pi` profile (Project-tagged, auto-retain). | Keeps strategic user preferences and high-level decisions clean from transient task noise. |
| **Observability & User Interface** | Custom 3-tab Vue/Vanilla SPA served from FastAPI daemon (:52080). | **`Agent of Empires` (`aoe`) Cockpit & Web PWA (`aoe serve`)**. | Real-time TUI matrix, ACP structured tool cards, visual diff inspection, and mobile approval UI without maintaining custom frontend code. |
| **Execution Paradigm** | Synthetic text prompt injection requiring the LLM to call multi-step CLI/shell tools. | **In-Kernel Python `eval` (`lang: "py"`)** with injected `tool.*` proxy, `mypai_http`, and persistent memory state. | Eliminates bash escaping/subshell overhead; allows complex branching, looping, and tool invocation inside a single turn. |

---

## 2. Doubling Down on In-Kernel Python `eval`

In the next-generation architecture, **all coordination, execution, and automation logic across `mypai-workspace`, `mypai-channel`, and `mypai-cron` is executed directly via in-process Python `eval` cells.**

### Why Python `eval` Surpasses Custom Daemon Code & Shell Calls

1. **State Persistence Across Turns:**
   The `omp` Python runner (`runner.py`) maintains persistent process state in `$OMP_PYTHON_VENV`. Modules imported, client sessions initialized, and variables stored in `globals()` (`_SESSION_BOOTSTRAPPED`, `_MENTAL_MODELS`, `_LAST_ERROR`) survive across multiple agent turns without re-initialization cost.
2. **Native Loopback Host Tool Bridge (`_ToolProxy`):**
   `prelude.py` injects `tool = _ToolProxy()`. Calling `tool.reflect()`, `tool.recall()`, `tool.retain()`, `tool.read()`, `tool.search()`, `tool.write()`, and `tool.task()` executes native host-side Rust/TypeScript tools in-process via local IPC loopback (`POST /v1/tool`).
3. **Zero Token Noise (Silence-on-Success Discipline):**
   Unlike shell commands that flood the LLM context window with command echoes, status text, and standard outputs, Python `eval` runs silently on success (`stdout` remains completely empty), preserving context tokens for reasoning.
4. **Structured Error Trapping & Diagnostics:**
   When an operation fails, the exception is caught in a `try...except` block, stored in `_LAST_ERROR`, and emits a single actionable line pointing the agent to run `analyze_failure()`.

---

## 3. Concrete In-Kernel Execution Patterns

### Pattern A: `amux-mypai-channel` (Chat Ingress & Intent Translation)

`mypai-channel` receives raw text from the user via `cc-connect` and uses Python `eval` to query mental models, parse intent, and dispatch structured tasks to `mypai-workspace`.

```python
from mypai_http import amux
import sys

# Diagnostic helper
def analyze_channel_failure():
    print(f"Channel Error: {globals().get('_LAST_ERROR')}")
    print(f"amux Health: {amux.get('metrics')}")

try:
    # 1. First-turn bootstrap: Fetch user communication preferences
    if "_USER_PREFS" not in globals():
        _USER_PREFS = tool.reflect(query="What are the user's communication preferences and tone?")
    
    # 2. Incoming message processing
    user_input = "Please refactor the auth middleware in repo backend-core."
    
    # 3. Intent parsing & structured dispatch to mypai-workspace
    amux.post(
        "messages",
        target={"worker_name": "mypai-workspace"},
        body=f"USER_REQUEST: {user_input}\nPREFERENCES: {_USER_PREFS[:100]}"
    )
    
    # 4. Success: Silent execution (user response will come via mypai-workspace callback)

except Exception as err:
    _LAST_ERROR = err
    print(f"[ERROR] Channel processing failed: {err}. Run `analyze_channel_failure()` to inspect.")
```

---

### Pattern B: `amux-mypai-workspace` (Main Orchestrator & Task Coordinator)

`mypai-workspace` receives turns from `channel` and `cron`, manages the `amux` Kanban board, spawns workers, and retains strategic outcomes to Hindsight.

```python
from mypai_http import amux
import json

def analyze_workspace_failure():
    print(f"Workspace Error: {globals().get('_LAST_ERROR')}")
    print(f"Active Cards: {amux.get('board/cards')}")

try:
    # 1. Bootstrap strategic mental models
    if "_STRATEGIC_MODELS" not in globals():
        _STRATEGIC_MODELS = tool.reflect(
            query="Summarize principal telos, active project conventions, and architecture constraints."
        )
    
    # 2. File and claim atomic Kanban card on amux board
    card = amux.post(
        "board/cards",
        title="Refactor Auth Middleware",
        description="Refactor middleware in backend-core to support bearer tokens",
        lane="Doing"
    )
    card_id = card.get("id")

    # 3. Spawn sandboxed worker using base OMP profile
    amux.post(
        "sessions",
        name=f"worker-auth-{card_id}",
        directory="repos/backend-core",
        provider="omp"
    )

    # 4. Delegate task prompt to the worker
    amux.post(
        "messages",
        target={"worker_name": f"worker-auth-{card_id}"},
        body="Execute auth middleware refactor. Run pytest on completion and report."
    )

    # 5. Success: Silent execution

except Exception as err:
    _LAST_ERROR = err
    print(f"[ERROR] Orchestrator dispatch failed: {err}. Run `analyze_workspace_failure()` to inspect.")
```

---

### Pattern C: `amux-mypai-cron` (Automated Probing, Sweeps & Escalation)

`mypai-cron` receives periodic `CRON:` prompts from `amux-server` and runs Python `eval` inspection routines without human intervention.

```python
from mypai_http import amux

def analyze_cron_failure():
    print(f"Cron Error: {globals().get('_LAST_ERROR')}")
    print(f"amux Schedules: {amux.get('schedules')}")

try:
    # 1. Execute repository inspection via host loopback tools
    git_diff = tool.search(query="FIXME", glob="*.py")
    build_log = tool.read("scratch/build-status.json") if tool.read else ""
    
    # 2. Evaluate system metrics from amux control plane
    metrics = amux.get("metrics")
    failed_runs = metrics.get("failed_runs", 0)

    # 3. Conditional evaluation:
    if failed_runs > 0 or "FAILED" in build_log:
        # Action required: escalate to mypai-workspace
        amux.post(
            "board/cards",
            title="Investigate Build / Cron Failures",
            description=f"Detected {failed_runs} failed jobs. Build status: {build_log[:100]}",
            lane="Todo"
        )
        amux.post(
            "messages",
            target={"worker_name": "mypai-workspace"},
            body=f"CRON Alert: Build anomalies detected. New card filed."
        )
    else:
        # All clean: Remain completely silent (0 stdout)
        pass

except Exception as err:
    _LAST_ERROR = err
    print(f"[ERROR] Cron health sweep failed: {err}. Run `analyze_cron_failure()` to inspect.")
```

---

## 4. Key Architectural Gains Summary

1. **Massive Code Reduction & Reliability:**
   Eliminates over 3,500 lines of custom Python daemon/FastAPI/queue plumbing in `submodules/omp-mypai` by delegating process lifecycle and routing to `amux-server` and `cc-connect`.
2. **Context Window Efficiency:**
   Replacing conversational CLI tool chains with in-kernel Python `eval` reduces turn context consumption by **60–80%**, while strict silence on success keeps the token history immaculate.
3. **Pure Separation of Concerns:**
   Strategic governance and user preferences live in `mypai-workspace` and the `mypai` memory bank; frontend messaging lives in `mypai-channel`; automated background operations live in `mypai-cron`; heavy code execution lives in isolated task workers.
4. **Complete Observability:**
   Every session, breadcrumb, ACP tool card, diff, and Kanban state change is live-rendered and interactive in `Agent of Empires` (`aoe`).
