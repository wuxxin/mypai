# AGENTS.md — System Realities & Agent Operating Guidelines

## System Architecture

### Current Architectural Focus: LifeOS Integration

Layering and stabilizing **LifeOS** (https://github.com/danielmiessler/LifeOS) into the OMP sandbox: basically working, under active adjustment. This file is an index — the consolidated documentation lives in `docs/` (built with `make docs`):

- Topology, mounts, data-home contract, port map, VRAM map, OS translation, scheduling & `lifeos-workflows-tick`, model & voice plumbing: `docs/HOST_TOPOLOGY.md`
- Claude Code vs. omp harness deltas, `OmpHooksBridge.ts` (incremental transcript mirror under `~/.claude/lifeos-bridge-transcripts/`, live `session_id`, 120 s `SessionTree` reaper), `claude-shim.py`, guard enforcement, web verification, accepted gaps: `docs/LIFEOS_OMP_ARCHITECTURE.md`
- LifeOS distro upgrade procedure & version semantics: `docs/LIFEOS_UPGRADE_RUNBOOK.md`
- Operational guide, repo layout, agent roster, skills & commands: `docs/USAGE.md`
- `omp` 19.1.1+ runtime config, `eval` loopback bridge, `omp_rpc` SDK: `docs/OMP_RUNTIME.md`
- Mnemopi memory, retired Hindsight fallback, speed benchmarks: `docs/MEMORY_AND_BENCHMARKS.md`
- Launch command: `lifeos`. Headless bridge checks: `make bridge-test` / `make bridge-smoke`.

### Repository Areas, Submodules and Sandboxing Discipline

- **Workspace:** `mypai` and `submodules/` form a single workspace. Temporary files go in `scratch/`. 
- **Source of truth:** this repo's `omp/agent/*` profile, `bin/` launchers and `omp.env` are canonical for omp + LifeOS host config; the live files under `~/.omp` are derived copies. Make config changes here, then apply/sync — never hand-edit only in `~/.omp`. **The sanctioned sync is `sandbox-ctl install --new-config-from .` run from this repo root** (picks up `./omp.env`, sets `LAUNCHER_INSTALL_SOURCE`, runs the sandboxed install hooks that deploy the profile); in-session, apply changes to repo + live trees together interactively with the principal and diff them after.
- Layout map (what lives in `omp/agent`, `submodules/agents-shared`, `submodules/aur-packages`, `bin/`, and the deferred status of `src/mypai_runtime/`): **`docs/USAGE.md`**. `mypai_runtime` removal/refactoring is deferred until LifeOS integration adjustments are complete.
- **`src/omp-lifeos-overlay/`** — shadow copies + `MANIFEST.md` of the host-owned (non-stock) LifeOS source modifications; regenerate via its `tools/`, prose in `docs/LIFEOS_OMP_ARCHITECTURE.md` and `docs/LIFEOS_UPGRADE_RUNBOOK.md`. Diff live tree vs release tarball after every upgrade.
- **Submodule Boundaries:**
  - Because subagents inherit the root workspace context and cannot have arbitrary session `cwd` set at spawn time, any agent or subagent assigned work in a submodule or subdirectory (`submodules/aur-packages`, `submodules/agents-shared`, etc.) **MUST read that subdirectory's `AGENTS.md`** (e.g. `read submodules/aur-packages/AGENTS.md` or `read submodules/agents-shared/AGENTS.md`) and any domain skills it mandates (e.g. `skill://archlinux-pkgbuild`) before running commands.
- **Source-of-truth for built packages:** Questions about the sources of packages we build on this system (many in `submodules/aur-packages/*`) MUST be answered from the makepkg source checkouts under `submodules/aur-packages/<pkg>/src/` — they match exactly what is installed (e.g. `oh-my-pi-git/src/oh-my-pi/`). Never fetch upstream GitHub trees, raw files, or release pages for these questions when the local src checkout covers them.
- **Base setup chain for the harness (grab this first):** omp = **oh-my-pi**, upstream project `github.com/can1357/oh-my-pi`. We build it ourselves via the AUR package dir `submodules/aur-packages/oh-my-pi-git` (its PKGBUILD + local patches define what runs here); its `src/oh-my-pi/` checkout **is** the installed binary's source — pin every harness-behavior claim to that checkout's commit, never to a GitHub fetch. Layer map: `can1357/oh-my-pi` (upstream) → `aur-packages/oh-my-pi-git` (our build+patches) → `mypai omp/ + omp.env` (host profile; `~/.omp` is the derived copy). Behavior bugs found in the running harness (e.g. queue-steering re-injecting a pending user message on every model call of a tool loop — see the measured note in `omp/agent/extensions/OmpHooksBridge.ts`) are **upstream issues**: draft them from local source with commit-pinned file:line refs; our side carries only guards.
- **Sandbox (`sandbox-ctl`) Check:** if env `SANDBOX_NAME` or `SANDBOX` is set read `submodules/agents-shared/scripts/sandbox-ctl.md` how to behave and use.


## Code Style & Verification Commands

- **Comments:** Do not use long visual separator lines (e.g. avoid `-----------` or "==========").
- **Shell (`bin/*`):** `set -euo pipefail`, 4-space indent, quoted variables. Lint: `shellcheck bin/* && shfmt -i 4 -w bin/*`.
- **Python (`src/`, `tests/`):** 4-space indent, type hints, `snake_case` functions/vars, `PascalCase` classes.
- **CI Commands:**
  - `make help` (target overview) | `make buildenv` (provision venv) | `make all` (full CI gate)
  - `make test` / `make test-unit` / `make test-e2e` | `make coverage` (97%+ line coverage)
  - `make lint` / `make format` (ruff) | `make typecheck` (mypy) | `make clean`

