# AGENTS.md — System Realities & Agent Operating Guidelines

---

## 1. System Architecture

**UPDATE:** System architecture is currently in major restructuring.

### Current Architectural Focus: LifeOS Integration
The primary active focus is layering and stabilizing **LifeOS** (https://github.com/danielmiessler/LifeOS) into the OMP sandbox:
- **Integration Status:** Basically working, but actively undergoing adjustments.
- **Harness Layering:** `~/.omp/LIFEOS` (with `~/.claude` symlinked to `~/.omp`).
- **Setup & Lifecycle:** currently not automated.
- **Bridge Extension:** `omp/agent/extensions/OmpHooksBridge.ts` translates Claude Code hooks for OMP.
- **Launch Command:** `lifeos`
- Detailed setup notes: `references/lifeos-setup.md`.
- Upgrade-path notes for the hooks bridge: `references/omp-hooks-bridge-upgrade-notes.md`.
- **LifeOS-on-Claude-Code vs. LifeOS-on-omp differences** (event map fidelity, registry merge mechanics, permission-system split, accepted gaps): `references/lifeos-omp-difference.md`. This section is the index; that file is the authority on harness deltas.

### Target Trajectory & Submodules
- **`submodules/agents-shared`**: Local inference wrappers (`local-router` on `:21080` for chat, embedding, rerank, stt, tts, imagegen) and `sandbox-ctl` environment isolation.
- **`submodules/aur-packages`**: Arch Linux AUR packages and private PKGBUILD forks.
- **`omp/agent`**: Base profile configuration (`config.yml`, `models.yml`, `agents/`, `skills/`, `extensions/`, `memorybanks/`).

### `mypai_runtime` Status
- `src/mypai_runtime/` is **not currently used or ported to be used correctly** in the active harness yet. Its removal or refactoring and adaptation to OMP + LifeOS is deferred until LifeOS integration adjustments are complete.

## Harness Usage

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
- **Explicit Errors:** Never use empty `except: pass`. Capture stack traces in `_LAST_ERROR` and raise typed domain exceptions.

## Workspace & Sandboxing Discipline

- **Workspace:** `mypai` and `submodules/` form a single workspace. Temporary files go in `scratch/`. 
- **Submodule Boundaries:**
  - Because subagents inherit the root workspace context and cannot have arbitrary session `cwd` set at spawn time, any agent or subagent assigned work in a submodule or subdirectory (`submodules/aur-packages`, `submodules/agents-shared`, etc.) **MUST read that subdirectory's `AGENTS.md`** (e.g. `read submodules/aur-packages/AGENTS.md`) and any domain skills it mandates (e.g. `skill://archlinux-pkgbuild`) before running commands.
- **Source-of-truth for built packages:** Questions about the sources of packages we build on this system (many in `submodules/aur-packages/*`) MUST be answered from the makepkg source checkouts under `submodules/aur-packages/<pkg>/src/` — they match exactly what is installed (e.g. `oh-my-pi-git-tag/src/oh-my-pi/`). Never fetch upstream GitHub trees, raw files, or release pages for these questions when the local src checkout covers them.
- **Sandbox (`sandbox-ctl`) Check:** if env `SANDBOX_NAME` or `SANDBOX` is set read `submodules/agents-shared/scripts/sandbox-ctl.md` how to behave and use.
