# AGENTS.md — System Realities & Agent Operating Guidelines

---

## 1. System Architecture

**UPDATE:** System architecture is currently in major restructuring.

### Current Architectural Focus: LifeOS Integration

Layering and stabilizing **LifeOS** (https://github.com/danielmiessler/LifeOS) into the OMP sandbox: basically working, under active adjustment. This file is an index — the knowledge lives in `references/`:

- Topology, mounts, data-home contract, OS translation, model & voice plumbing: `references/lifeos-host-linux.md`
- Claude Code vs. omp harness deltas (event-map fidelity, registry merge, permission split, scheduling, guard enforcement, accepted gaps): `references/lifeos-omp-difference.md` — the authority on harness deltas; §1 is only an index.
- LifeOS distro upgrade procedure & version semantics: `references/lifeos-upgrade-runbook.md`
- Bridge (`omp/agent/extensions/OmpHooksBridge.ts` + `.md`) per-version mechanics: `references/omp-lifeos-OmpHooksBridge-changelog.md`; implementation doc: `omp/agent/extensions/OmpHooksBridge.md`.
- Launch command: `lifeos`. Headless bridge checks: `make bridge-test` / `make bridge-smoke`.

### Repository Areas, Submodules and Sandboxing Discipline

- **Workspace:** `mypai` and `submodules/` form a single workspace. Temporary files go in `scratch/`. 
- **Source of truth:** this repo's `omp/agent/*` profile, `bin/` launchers and `omp.env` are canonical for omp + LifeOS host config; the live files under `~/.omp` are derived copies. Make config changes here, then apply/sync — never hand-edit only in `~/.omp`.
- Layout map (what lives in `omp/agent`, `submodules/agents-shared`, `submodules/aur-packages`, `bin/`, and the deferred status of `src/mypai_runtime/`): **`references/mypai-layout.md`**. `mypai_runtime` removal/refactoring is deferred until LifeOS integration adjustments are complete.
- **Submodule Boundaries:**
  - Because subagents inherit the root workspace context and cannot have arbitrary session `cwd` set at spawn time, any agent or subagent assigned work in a submodule or subdirectory (`submodules/aur-packages`, `submodules/agents-shared`, etc.) **MUST read that subdirectory's `AGENTS.md`** (e.g. `read submodules/aur-packages/AGENTS.md`) and any domain skills it mandates (e.g. `skill://archlinux-pkgbuild`) before running commands.
- **Source-of-truth for built packages:** Questions about the sources of packages we build on this system (many in `submodules/aur-packages/*`) MUST be answered from the makepkg source checkouts under `submodules/aur-packages/<pkg>/src/` — they match exactly what is installed (e.g. `oh-my-pi-git-tag/src/oh-my-pi/`). Never fetch upstream GitHub trees, raw files, or release pages for these questions when the local src checkout covers them.
- **Sandbox (`sandbox-ctl`) Check:** if env `SANDBOX_NAME` or `SANDBOX` is set read `submodules/agents-shared/scripts/sandbox-ctl.md` how to behave and use.


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

