# AGENTS.md — System Realities & Agent Operating Guidelines

---

## 1. System Architecture

**UPDATE:** this is currently in major restructuring.

The current architecture trajectory is:

- using `submodules/agents-shared` repo for local inference service wrapper for chat,embedding,rerank,stt,tts,imagegen, and agents harness software
- using `submodules/aur-packages` repo for archlinux aur packages and private forks of packages needed for local-inference and agent harnesses
- using submodules/agents-shared/scripts/sandbox-ctl and this repo `omp.env` to configure an oh-my-pi sandbox service config
  - see omp/agent for base profile Config, Memorybanks, Agents, Commands, Skills, Extensions, Install CMDS, a.o.

- layer LifeOS (https://github.com/danielmiessler/LifeOS) into sandbox ~/.omp/LIFEOS 
    - this is currenty done manual, there is a rudementary script in `bin/install-lifeos`.
    - sandbox `~/.claude` is ymlinked to `~/.omp` for more compatibility for runnning _LifeOS under omp, instead of claude.
    - `omp/agent/extensions/OmpHooksBridge.ts` and .md is used to make omp compatible with claude-code hooks for lifeos
    - start lifeos with `OMP_VOICE=0 LIFEOS_DIR=~/.claude/LIFEOS omp --append-system-prompt ~/.claude/LIFEOS/LIFEOS_SYSTEM_PROMPT.md`

documentation and configuration in progress. See `references/lifeos-setup.md`.

## Harness Usage

- **Internal Tools First:** Discover and use internal tools before shelling out to do the same
- if running under oh-my-pi/omp: Discover and use `xd://` devices and tools and propose plans via `xd://` (`write xd://propose`, `write xd://resolve`, `write xd://reject`, `read xd://`).


## Code Style & Verification Commands

- **Comments:** Do not use long visual separator lines (e.g. avoid `-----------` or "==========").
- **Shell (`bin/*`):** `set -euo pipefail`, 4-space indent, quoted variables. Lint: `shellcheck bin/* && shfmt -i 4 -w bin/*`.
- **Python (`src/`, `tests/`):** 4-space indent, type hints, `snake_case` functions/vars, `PascalCase` classes.
- **CI Commands:**
  - `make help` (target overview) | `make buildenv` (provision venv) | `make all` (full CI gate)
  - `make test` / `make test-unit` / `make test-e2e` | `make coverage` (97%+ line coverage)
  - `make lint` / `make format` (ruff) | `make typecheck` (mypy) | `make clean`

## Code Strict Fail-Fast Invariants

- **`httpx` Only:** Pure `httpx` in `mypai_runtime`. No defensive `urllib` fallbacks.
- **Loopback First:** Use in-kernel `tool.*` and AST tools over subshell spawning (`cat`, `grep`, `sed`).
- **Explicit Errors:** Never use empty `except: pass`. Capture stack traces in `_LAST_ERROR` and raise typed domain exceptions.

## Workspace & Sandboxing Discipline

- **Workspace:** `mypai` and `submodules/` form a single workspace. Temporary files go in `scratch/`. Check root and submodules before creating new files.
- **Bubblewrap (`bwrap`) Check:** `[ -S "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/systemd/private" ] || echo "bwrapped"`
- **When bwrapped:** Do **NOT** run `systemctl`. Inspect processes via `journalctl --user`, `ps`, `/proc`, `pgrep`.

## Agent Delegation Rules & Specialist Roster

**Operating Role:** As a user-facing agent, assume the **`@orchestrator`** role.

