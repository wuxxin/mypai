# AGENTS.md — System Realities & Agent Operating Guidelines

Operational rules, invariants, and specialist profiles for MyPAI.

---

## 1. Multi-Session System 

Agent Hosting using **`agent of empires` (:28080)**, **`amux-server` (:28824)**, **`cc-connect` (:9810)**, **`oh-my-pi` (`omp`)**, and **`Hindsight` (:28888)**.

- **`aoe` (:28080):** Execution host, ACP (Agent Client Protocol) runner, TUI cockpit, git worktrees, diff review, and mobile Web PWA.
- **`amux-server` (:28824):** Cognitive state store, durable Kanban board (`/api/board/cards`), turn-boundary message router (`/api/messages`), and cron scheduler (`/api/schedules`).
- **`mypai-main`:** Cognitive brain, governor, mental models, Kanban owner, and task worker coordinator.
- **`mypai-cron`:** Automation reactor triggered via `amux` message bus (`CRON: <action>`). Executes silent in-kernel sweeps.
- **`mypai-channel`:** Chat ingress (`cc-connect` bridge). Ingests user turns and forwards structured requests to main.
- **`code-worker-N`:** Isolated on-demand coding workers running in target repositories/worktrees via ACP.
- **In-Kernel Execution (`lang: "py"`):** Execute messaging, memory reflection, and bulk processing in Python kernel via `mypai_runtime`.
- **Hindsight Tooling Strategy:**
  - **Session Default Bank:** Use in-process OMP loopback tools (`tool.reflect()`, `tool.recall()`, `tool.retain()`).
  - **Cross-Bank / Non-Default Bank:** Use `mypai_runtime.hindsight` REST client (`HindsightClient(bank_id=...)`).
- **Loopback Tools:** Use `tool.read()`, `tool.write()`, `tool.search()`, `tool.reflect()`, `tool.recall()`, `tool.retain()`.
- **Silence Discipline:** Successful automated sweeps/probes must emit **0 stdout** (no conversational filler).

---

## 2. Repository Layout

```
mypai/
├── Makefile / pyproject.toml / omp.env  # GNU buildenv, dependencies & supervisor config
├── aoe/ (config.toml, README.md)        # Agent of Empires daemon & ACP settings
├── bin/membank-ctl                      # Hindsight memory bank sync CLI
├── src/mypai_runtime/                   # In-Kernel Python runtime (amux, hindsight, diagnostics)
├── tests/ (conftest.py, unit/, e2e/)    # Pytest suite (full amux REST, hindsight, diagnostics, E2E)
├── omp/ (agent/                         # Base profile, memorybanks, agents, skills, sessions
├── submodules/                          # agents-shared, aur-packages, private-seeds
└── references/ / USAGE.md / README.md   # Specifications, test docs & user manual
```

---

## 3. Strict Fail-Fast Invariants

1. **`httpx` Only:** Pure `httpx` in `mypai_runtime`. No defensive `urllib` fallbacks.
2. **Managed Venv:** Use `~/.omp/python-env` as omp default venv,   executing from shell.
4. **Loopback First:** Use in-kernel `tool.*` and AST tools over subshell spawning (`cat`, `grep`, `sed`).
5. **`xd://` Tools Only:** Discover tools and propose plans via `xd://` (`write xd://propose`, `write xd://resolve`, `write xd://reject`, `read xd://`).
6. **Explicit Errors:** Never use empty `except: pass`. Capture stack traces in `_LAST_ERROR` and raise typed domain exceptions.

---

## 4. Code Style & Verification Commands

- **Comments:** Do not use long visual separator lines (e.g. avoid `-----------` or "==========").
- **Shell (`bin/*`):** `set -euo pipefail`, 4-space indent, quoted variables. Lint: `shellcheck bin/* && shfmt -i 4 -w bin/*`.
- **Python (`src/`, `tests/`):** 4-space indent, type hints, `snake_case` functions/vars, `PascalCase` classes.
- **CI Commands:**
  - `make help` (target overview) | `make buildenv` (provision venv) | `make all` (full CI gate)
  - `make test` / `make test-unit` / `make test-e2e` | `make coverage` (97%+ line coverage)
  - `make lint` / `make format` (ruff) | `make typecheck` (mypy) | `make clean`

---

## 5. Workspace & Sandboxing Discipline

- **Workspace:** `mypai` and `submodules/` form a single workspace. Temporary files go in `scratch/`. Check root and submodules before creating new files.
- **Bubblewrap (`bwrap`) Check:** `[ -S "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/systemd/private" ] || echo "bwrapped"`
- **When bwrapped:** Do **NOT** run `systemctl`. Inspect processes via `journalctl --user`, `ps`, `/proc`, `pgrep`.

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
