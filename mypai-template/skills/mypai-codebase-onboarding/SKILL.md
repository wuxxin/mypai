---
name: mypai-codebase-onboarding
description: "Onboard new agents to the MyPAI codebase structure, runtime modules, test conventions, and quality gates."
---

# MyPAI Codebase Onboarding

## Structure
- `src/mypai_runtime/` — core runtime (amux.py, hindsight.py, diagnostics.py)
- `bin/membank-ctl` — Hindsight memory bank CLI (bash+python; uses stdlib urllib)
- `tests/unit/`, `tests/e2e/` — 39 tests all passing; mock HTTP servers via httpx.MockTransport in conftest.py
- `omp/agent/` — OMP profiles, agents, skills, commands, memorybanks (oh-my-pi.yaml + mypai.yaml)
- `aoe/` — Agent of Empires config & daemon
- `omp.env` — sandbox launcher / amux supervisor env config

## Quality Gates (verified passing locally 2026-08-23)
- `make buildenv` → uv venv + editable install with test deps
- `make all` → format (ruff check --fix && ruff format) → lint (ruff check . + format --check) → typecheck (mypy src/) → test (pytest unit+e2e, 39 passed) → coverage (≥97% line; exactly 97%)
- All passing: 39 tests, ruff clean, mypy clean

## Runtime Modules
1. `amux.py` — REST client for amux-server :28824 (messages/sessions/board/cards/schedules/health/metrics/status). Base URL from env AMUX_API_URL defaulting to https://localhost:28824/api; appends /api if missing. Pre-instantiated singleton `amux`.
2. `hindsight.py` — HindsightClient for :28888 vector memory (reflect/recall/retain/mental-models/consolidate). Base URL from env HINDSIGHT_API_URL defaulting to http://localhost:28888. Pre-instantiated singleton `hindsight`.
3. `diagnostics.py` — failure formatters for 5 session kinds (main/cron/channel/worker/workspace) + capture_exception_context.

## Memory Protocol
- Session default bank: in-process OMP loopback tools (`tool.reflect()`, `tool.recall()`, `tool.retain()`).
- Cross-bank/target bank: `HindsightClient` REST client from mypai_runtime.
- Env URLs: AMUX_API_URL → https://localhost:28824/api; HINDSIGHT_API_URL → http://localhost:28888.

## Key Invariants
- httpx only (no urllib fallback) in runtime modules.
- Strict fail-fast, explicit errors with stack traces.
- Loopback tools over subshells for code intelligence.
- Cross-session comms through amux bus (send_message + wait_for_response polling by correlation_id).

## CLI: bin/membank-ctl
Subcommands: `update <API_URL> <BANKS_PATH> --yes [--prune]` and `export <API_URL> <bankname> [--json|--yaml] [--out file]`. Idempotent provisioning — diffs local bank definitions against server state via GET config + mental-models, issues PATCH/POST/DELETE only when changed. Supports .json/.yaml.

## Test Conventions
- conftest.py provides MockAmuxState (in-memory messages/cards/sessions/schedules) and httpx.MockTransport fixtures for both amux and hindsight.
- Unit tests cover full CRUD lifecycles, 404 error handling, diagnostics formatting, hindsight operations, membank-ctl help/arg validation.
- E2E tests simulate multi-session flow (channel→main→worker→main→channel) and cron sweep + anomaly recovery with structured diagnostics.

## Coverage note
`make coverage` reports exactly 97% line coverage on mypai_runtime (amux.py: 146-147, 162, 242, 315, 326 missing; diagnostics.py: 13; hindsight.py: 48, 81).
