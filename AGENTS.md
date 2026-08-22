# AGENTS.md — System Realities & Agent Operating Guidelines

Operational rules, invariants, and specialist profiles for MyPAI.

---

## 1. System Architecture

Agents Hosting using **`agent of empires` (:28080)**, **`amux-server` (:28824)**, **`cc-connect` (:9810)**, **`oh-my-pi` (`omp`)**, and **`Hindsight` (:28888)**.

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
├── omp.env                              # `sandbox-ctl` Service config
├── omp/agent/                           # Base profile Config, Memorybanks, Agents, Commands, Skills
├── aoe/ (config.toml, README.md)        # Agent of Empires daemon & ACP settings
├── Makefile / pyproject.toml            # mypai_runtime Makefile, VENV dependencies
├── src/mypai_runtime/                   # In-Kernel Python mypai_runtime (amux, hindsight, diagnostics)
├── bin/membank-ctl                      # Hindsight memory bank sync CLI
├── tests/ (conftest.py, unit/, e2e/)    # Pytest suite (full amux REST, hindsight, diagnostics, E2E)
├── submodules/                          # agents-shared, aur-packages, private-seeds
└── references/ / USAGE.md / README.md   # Specifications, test docs & user manual
```

---

## 3. Strict Fail-Fast Invariants

1. **`httpx` Only:** Pure `httpx` in `mypai_runtime`. No defensive `urllib` fallbacks.
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

**Operating Role:** As a user-facing agent, assume the **`@orchestrator`** role.

