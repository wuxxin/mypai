# AGENTS.md — System Realities & Agent Operating Guidelines

This document establishes the operational rules, repository realities, architectural invariants, and specialist delegation profiles for all autonomous agents executing within the **Next-Generation MyPAI** ecosystem.

---

## 1. System Reality & Multi-Session Mesh

Next-Generation MyPAI operates as a distributed multi-session mesh governed by **`amux-server` (:8824)**, **`cc-connect` (:9810)**, **`oh-my-pi` (`omp`)**, **`Agent of Empires` (`aoe`)**, and **`Hindsight` (:8888)**. The legacy monolithic Python daemon (`mypai_daemon`) and old MCP wrappers are retired.

### Core Session Topology
* **`amux-mypai-main` (profile: `mypai`):** Central cognitive brain, LifeOS mental model governor, amux Kanban board owner, and task worker coordinator.
* **`amux-mypai-channel` (profile: `mypai`):** Dedicated chat ingress gateway connected to `cc-connect` via tmux driver. Forwards structured requests to main.
* **`amux-mypai-cron` (profile: `mypai`):** Automation reactor triggered by `amux-server` (`CRON: <action>`). Runs in-kernel silent sweeps.
* **`amux-task-worker-N` (profile: `normal`):** Isolated on-demand coding workers running in target repositories.

### In-Kernel Execution (`eval`) & Silence Discipline
* **In-Kernel Python (`lang: "py"`):** Execute inter-agent messaging, memory reflection, and bulk processing directly in the persistent Python kernel using `mypai_runtime`.
* **Loopback Host Tools:** Use `tool.read()`, `tool.write()`, `tool.search()`, `tool.reflect()`, `tool.recall()`, and `tool.retain()` over the in-process IPC bridge.
* **Silence Discipline:** Successful automated sweeps, probes, and coordination tasks must emit **0 stdout** (no conversational filler).

---

## 2. Repository Structure

```
mypai/
├── Makefile                         # Modern GNU Makefile (buildenv, test, lint, typecheck, coverage)
├── pyproject.toml                   # Root package and test dependency definition
├── omp.env                          # Sandbox launcher & amux supervisor config
├── bin/
│   └── membank-ctl                  # Hindsight memory bank sync CLI
├── src/
│   └── mypai_runtime/               # In-Kernel Python runtime library
│       ├── __init__.py              # Exports amux, hindsight, diagnostics
│       ├── amux.py                  # Full REST API client & Kanban manager
│       ├── hindsight.py             # Memory reflection & retention client
│       └── diagnostics.py           # Trapped error analyzers
├── tests/
│   ├── conftest.py                  # Pytest fixtures and mock HTTP servers
│   ├── unit/                        # Unit tests for amux, hindsight, diagnostics, membank-ctl
│   └── e2e/                         # End-to-End multi-session workflow simulations
├── omp/
│   ├── agent/                       # Base OMP Profile (~/.omp/agent/)
│   │   ├── config.yml, models.yml, mcp.json
│   │   ├── memorybanks/             # oh-my-pi.yaml
│   │   ├── agents/                  # orchestrator, debugger, pythonista, writer, patcher, scout, ...
│   │   ├── skills/                  # ulw-plan, systematic-debugging, git-master, review-work, tdd
│   │   └── commands/                # plan, ulw-plan, debug, review, git, scout, security, ...
│   └── profiles/
│       └── mypai/                   # MyPai Profile (~/.omp/profiles/mypai/agent/)
│           ├── config.yml, models.yml, mcp.json
│           ├── memorybanks/         # mypai.yaml (8-model LifeOS bank)
│           ├── agents/              # mypai.md (mypai-main, mypai-channel, mypai-cron)
│           └── commands/            # learn.md, reflect.md
├── submodules/
│   ├── agents-shared                # Shared infrastructure, sandbox-ctl, model downloaders
│   ├── aur-packages                 # Custom ROCm/HIP PKGBUILDs
│   └── private-seeds                # Private memory seeds and credentials
├── references/                      # mypai-spec.md, mypai-test.md, etc.
├── USAGE.md                         # Complete user & operator manual
└── README.md                        # Project landing page
```

---

## 3. Strict Architectural Invariants & Anti-Fallback Rules

Agents must strictly adhere to the following fail-fast invariants:

1. **Strict `httpx` Invariant:** All HTTP operations in `mypai_runtime` use pure `httpx`. No defensive `urllib` fallbacks.
2. **Strict Managed Venv Invariant:** Execute within managed virtualenvs (`~/.omp/python-env` or `~/.omp/profiles/mypai/python-env`). Do not silently fall back to unprovisioned system Python.
3. **Strict `amux` HTTP Bus Invariant:** Inter-worker coordination must route through `amux-server` (`POST /api/messages`) with JSON payloads and correlation IDs. Never inject raw keystrokes across sessions.
4. **Strict Loopback Invariant:** Avoid subshell spawning (`cat`, `grep`, `sed`) when in-process loopback tools (`tool.*`) or AST tools (`ast_grep`) are available.
5. **Strict `xd://` Virtual Device Invariant:** Discover tools and propose plans via `xd://` (`write xd://propose`, `read xd://`).
6. **Strict Exception Visibility:** Never use empty `except Exception: pass`. Capture stack traces and raise typed domain exceptions.

---

## 4. Code Style, Tooling & Testing Commands

- **Style:** Do not use long visual lines for comment sections (e.g. avoid `# -----------`).

### Shell Scripts (`.sh`, `bin/*`)
- **Style:** `#!/usr/bin/env bash`, 4-space indent, `set -euo pipefail`, quote `"$var"`, use `$(...)`, `lowercase_vars`, `UPPERCASE_CONSTANTS`.
- **Lint & Format:**
  ```bash
  shellcheck bin/* && shfmt -i 4 -w bin/*
  ```

### Python Code (`src/`, `tests/`)
- **Style:** `#!/usr/bin/env python3`, 4-space indent, type hints, `snake_case` (functions/vars), `PascalCase` (classes), triple-quote docstrings, explicit exception handling.
- **Makefile & Testing Commands:**
  ```bash
  make help          # Show available targets and active configuration
  make buildenv      # Provision local venv with test dependencies
  make test          # Run full pytest suite (unit + e2e)
  make test-unit     # Run unit tests only
  make test-e2e      # Run end-to-end multi-session simulations
  make coverage      # Run pytest with line-level code coverage
  make lint          # Run ruff check and format verification
  make format        # Auto-format and fix code with ruff
  make typecheck     # Run mypy static type analysis
  make all           # Run complete CI validation pipeline
  ```

---

## 5. Operating & Sandboxing Guidelines

### Workspace Discipline
* **Unified Workspace:** `mypai` and its `submodules/` (`agents-shared`, `aur-packages`) form a single workspace.
* **Ephemeral Files:** Store build logs, temporary checkouts, and temp files in `scratch/`.
* **File Resolution:** If a user-referenced file is missing, check the root repository and submodules before creating a new file.

### Sandboxing & Bubblewrap (`bwrap`) Discipline
Check if running inside a bwrap sandbox:
```bash
[ -S "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/systemd/private" ] || echo "bwrapped"
```

**If bwrapped (systemd socket unavailable):**
- **Restriction:** Do **NOT** execute systemd service management commands (`systemctl start/stop/restart/status`).
- **Introspection:** You **can** inspect all active processes and logs using `journalctl` (`--user`), `ps`, `/proc`, and `pgrep`.
- **Dummy Install:** You **can** use the scripts install function to create files in the bwrapped environment.

---

## 6. Agent Delegation Rules & Specialist Roster

Map `@rolename` references to your harness's available subagents according to these specialization profiles:

| Subagent | Specialization Profile | Key Responsibilities |
| :--- | :--- | :--- |
| **`@orchestrator`** | **Primary Project Coordinator** | Epic workflow planning, delegation, diff verification, final review, and strategic escalation. Default user-facing agent. |
| **`@scout`** | **Codebase Discovery & Symbol Grapher** | Read-only AST symbol grapher, dependency call-tree mapper, and rapid architecture discovery. Emits structured findings via `yield`. |
| **`@debugger`** | **Forensic Root-Cause Investigator** | 4-phase systematic debugging (Reproduce -> Isolate -> Hypothesize -> Fix & Verify), DAP live stack tracing, memory leak profiling. |
| **`@pythonista`** | **Idiomatic Python Specialist** | Strict typing (mypy), async/await architectures, ruff/pytest compliance, and high-performance Python engineering. |
| **`@task`** | **General Implementation Worker** | Multi-language feature implementation, refactoring, and multi-file code editing across project boundaries. |
| **`@reviewer`** | **Code Quality & Safety Reviewer** | Multi-perspective code review, cross-boundary dispatch consistency, and P0–P3 structured severity findings. |
| **`@security-reviewer`** | **Vulnerability Scanner** | Invariant validation, tainted data flow tracing, authorization checks, and CWE vulnerability detection. |
| **`@designer`** | **UI/UX & Design System Specialist** | Token-first CSS/HTML, responsive layouts, accessibility (a11y), and visual design system integrity. |
| **`@librarian`** | **External API & Source Researcher** | Source-grounded documentation analysis, cloning and inspecting upstream library sources to verify exact API contracts. |
| **`@writer`** | **Technical Documentation Craftsman** | Technical guides, OpenAPI schemas, changelogs, and Hindsight memory bank distillation. |
| **`@patcher`** | **Ultra-Fast Mechanical Patcher** | Rapid mechanical single-file fixes, typos, syntax patches, and near-zero latency data edits. |

**Operating Role:** As a user-facing agent, assume the **`@orchestrator`** role.
