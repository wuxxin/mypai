# mypai repo layout & profile map (transferred from AGENTS.md §1, 2026-11-16)

Reference for what lives where in `~/agent-shared/code/mypai` and how it relates to the omp/LifeOS runtime. Operating rules (submodule discipline, source-of-truth, sandbox trigger) stay in `../AGENTS.md`. Status: architecture is in major restructuring; the active focus is layering/stabilizing LifeOS into the omp sandbox — basically working, under adjustment.

## Repository areas

| Path | Role |
|---|---|
| `omp/agent/` | Base omp profile for this host: `config.yml`, `models.yml`, `agents/`, `skills/`, `extensions/`, `memorybanks/`. This is the tracked source of truth for host config — e.g. restoring the ported approval rules means editing `omp/agent/config.yml`, not the live `~/.omp` copy. |
| `submodules/agents-shared` | Local inference wrappers (`local-router` on `:21080` for chat, embedding, rerank, STT, TTS, imagegen) and `sandbox-ctl` environment isolation. |
| `submodules/aur-packages` | Arch Linux AUR packages and private PKGBUILD forks (source-of-truth rule in AGENTS.md). |
| `bin/` | Host launchers: `lifeos` (omp wrapper with LifeOS prompt/profile), `ephemeral-*`, dispatcher entry points. |
| `src/mypai_runtime/`, `tests/` | Python runtime package — **not currently used, not ported**; removal/refactoring deferred until LifeOS integration adjustments complete. CI targets (`make all/test/lint/typecheck`) are its legacy gate. |
| `src/omp-lifeos-overlay/` | Shadow overlay of the host-owned LifeOS source modifications (8 files + `MANIFEST.md` inventory incl. rendered-only personalizations; `tools/` regenerates from a release tarball). Prose: `lifeos-omp-difference.md` § Local LifeOS overlay. Diff live tree vs tarball after every upgrade. |
| `references/` | This directory: durable host/reference docs (see index below). |

## Runtime relationship (summary)

- Harness = omp; config root `~/.omp`, symlinked as `~/.claude` so stock LifeOS paths resolve. LifeOS payload at `~/.claude/LIFEOS`; private data repo `$HOME/agent-private/lifeos`. Full topology + mounts: `mypai-lifeos-host-linux.md`.
- Hooks bridge: `omp/agent/extensions/OmpHooksBridge.ts` (+ `.md`) translates Claude Code hook events for omp; fidelity/gaps in `lifeos-omp-difference.md`; version history in `omp-lifeos-OmpHooksBridge-changelog.md`.
- Launch command: `lifeos`. Headless verification: `make bridge-test` / `make bridge-smoke`.

## references/ index (live)

| File | Scope |
|---|---|
| `mypai-lifeos-host-linux.md` | Live topology, data-home contract, git teeth, OS translation, model/voice plumbing, Doctor declines. Supersedes `old-lifeos-setup.md`. |
| `mypai-host-memorymap.md` | VRAM/RAM allocation map for co-running the local inference services (dGPU/iGPU/CPU split, headroom). |
| `lifeos-omp-difference.md` | Claude Code vs omp harness deltas: registry merge, event map fidelity, permissions split, scheduling, web verification, guard enforcement, accepted gaps. |
| `lifeos-upgrade-runbook.md` | LifeOS distro upgrade procedure, version semantics, stock invariants. |
| `omp-lifeos-OmpHooksBridge.md` / `-changelog.md` | Bridge implementation; per-version bridge mechanics (was `omp-hooks-bridge-upgrade-notes.md`). |
| `mypai-portmap.md` | Canonical port allocations (:20000–:29000, :31337). |
| `mypai-layout.md` | This file. |
| `omp-runtime-config.md`, `omp-rpc-functions.md`, `omp-eval-tool.md`, `omp-hindsight.md`, `hindsight-memorybank.md`, `omp-speedtests.md` | omp internals: runtime config layering, RPC surface, eval tool, Hindsight memory plane, speed benchmarks. |
| `old-lifeos-setup.md`, `old-install-lifeos`, `old-mypai/`, `gen2-mesh/`, `memorybanks-research/` | Archived; kept for history, not authoritative. |
