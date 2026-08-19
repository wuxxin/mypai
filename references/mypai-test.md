# Next-Generation MyPAI Testing & Quality Architecture (`references/mypai-test.md`)

## Executive Summary

The **Next-Generation MyPAI Test Architecture** establishes a rigorous, automated verification matrix spanning in-kernel Python runtime packages, the `amux` inter-worker message bus, `Hindsight` vector memory integration, and end-to-end multi-session workflows. Driven by `pytest`, `pytest-cov`, `ruff`, `mypy`, and a modern GNU `Makefile`, the test suite guarantees **97%+ line coverage**, strict type safety, and zero regressions across distributed multi-agent sessions.

---

## 1. Testing Philosophy & Test Layering

```mermaid
flowchart TD
    subgraph Layers["Testing Pyramid"]
        E2E["End-to-End Multi-Session Simulation (tests/e2e)<br/>• Channel -> Main -> Worker -> Cron Pipeline<br/>• Full Turn Correlation & State Machines<br/>• Anomaly Detection & Recovery"]
        Component["Component & Contract Tests (tests/unit)<br/>• amux.py (Full REST API Client, Kanban, Sessions, Schedules)<br/>• hindsight.py (Reflect, Recall, Retain, Models)<br/>• diagnostics.py (Traceback & Failure Context)<br/>• bin/membank-ctl (CLI Flags & YAML Parser)"]
        Static["Static Analysis & Type Verification<br/>• mypy --strict (Type Safety, Python 3.14)<br/>• ruff check & ruff format (PEP 8, Clean Code)"]
    end
    
    Static --> Component
    Component --> E2E
```

1. **Unit & Component Testing:** Isolates each runtime component (`AmuxClient`, `HindsightClient`, `diagnostics`, `membank-ctl`) using mock HTTP transports (`httpx.MockTransport`), verifying status codes, payload serialization, and exception paths.
2. **End-to-End (E2E) Multi-Session Simulation:** Tests complete multi-agent workflows across simulated `mypai-channel`, `mypai-main`, `amux-task-worker`, and `mypai-cron` sessions, verifying end-to-end turn routing and Kanban state transitions.
3. **Strict Type Safety & Zero-Defect Linting:** Enforces full type annotations verified by `mypy` and code formatting verified by `ruff`.

---

## 2. Component Test Matrix

| Component | Tested Module | Test File | Test Cases & Invariants Checked |
| :--- | :--- | :--- | :--- |
| **Inter-Worker & Control Plane Client** | `mypai_runtime.amux` | `tests/unit/test_amux_client.py` | • Structured message dispatch & deletion (`POST /api/messages`, `DELETE /api/messages/{id}`)<br/>• In-cell synchronous response polling (`wait_for_response`)<br/>• Timeout handling (`TimeoutError` on unread expiry)<br/>• Kanban card lifecycle (Create, Update, Lanes, Delete)<br/>• Worker session lifecycle (`list_sessions`, `create_session`, `kill_session`, `restart_session`)<br/>• Schedule automation (`create_schedule`, `update_schedule`, `trigger_schedule`, `delete_schedule`)<br/>• Control plane telemetry (`GET /api/metrics`, `GET /api/health`, `GET /api/status`) |
| **Vector Memory Client** | `mypai_runtime.hindsight` | `tests/unit/test_hindsight_client.py` | • Mental model reflection (`POST /v1/banks/{id}/reflect`)<br/>• Semantic vector recall (`GET /v1/banks/{id}/recall`)<br/>• Durable fact retention (`POST /v1/banks/{id}/retain`)<br/>• Model schema enumeration (`GET /v1/banks/{id}/mental-models`)<br/>• Database consolidation (`POST /v1/banks/{id}/consolidate`) |
| **Failure Diagnostics** | `mypai_runtime.diagnostics` | `tests/unit/test_diagnostics.py` | • Full exception context & traceback capture<br/>• Main failure formatting (`analyze_main_failure`)<br/>• Scheduled cron sweep diagnostics (`analyze_cron_failure`)<br/>• Chat gateway ingress diagnostics (`analyze_channel_failure`)<br/>• Task worker crash analysis (`analyze_worker_failure`) |
| **Memory Bank CLI** | `bin/membank-ctl` | `tests/unit/test_membank_ctl.py` | • CLI help display (`--help`)<br/>• Graceful failure on missing arguments<br/>• Subcommand dispatch (`update`, `export`) |
| **Multi-Session E2E** | Multi-Agent Mesh | `tests/e2e/test_multi_session_flow.py` | • Ingress -> Channel -> Main -> Worker -> Done pipeline<br/>• Cron sweep -> Probing -> Anomaly Detection -> Kanban Alert card |

---

## 3. Modern Makefile Automation Matrix

The root `Makefile` provides an interactive, self-documenting build and test interface:

```bash
make help
```

```
========================================================================
                   Next-Generation MyPAI Build & Test Matrix            
========================================================================
Usage: make [target]

Primary Targets:
  all                Run complete CI pipeline (format, lint, typecheck, test, coverage)
  buildenv           Provision local virtual environment with uv and install test dependencies
  clean              Remove temporary caches, coverage reports, and Python bytecode
  cleanenv           Remove virtual environment and all caches
  coverage           Run test suite with line-level code coverage report
  format             Automatically fix and format all Python code
  help               Show this help message and reconstruct all primary targets
  lint               Run ruff linter and format checking across codebase
  test               Run complete test suite (unit + e2e)
  test-unit          Run fast unit tests only
  test-e2e           Run end-to-end multi-session and protocol integration tests
  typecheck          Run static type analysis with mypy

Active Runtime Configuration:
  Virtualenv:       .venv
  Python Binary:    python3
  Pytest Binary:    pytest
========================================================================
```

### Command Execution Reference

| Command | Purpose | Underlying Tools |
| :--- | :--- | :--- |
| `make buildenv` | Provision `.venv` and install `mypai_runtime` in editable mode with test tools | `uv venv`, `uv pip install -e ".[test]"` |
| `make test` | Execute full test suite (unit + e2e) with verbose output | `pytest tests -v` |
| `make test-unit` | Execute fast unit tests only | `pytest tests/unit -v` |
| `make test-e2e` | Execute end-to-end multi-session simulation tests | `pytest tests/e2e -v` |
| `make coverage` | Generate line-level test coverage report and XML artifact | `pytest --cov=mypai_runtime --cov-report=term-missing` |
| `make lint` | Verify code quality and formatting without mutating files | `ruff check src/ tests/ bin/`, `ruff format --check` |
| `make format` | Automatically fix and format Python code | `ruff check --fix`, `ruff format` |
| `make typecheck` | Run static type analysis for Python 3.14 type compliance | `mypy src/` |
| `make clean` | Clean all `__pycache__`, `.pytest_cache`, `.ruff_cache`, `.coverage` | `find`, `rm` |
| `make all` | Run the complete pipeline (`format` -> `lint` -> `typecheck` -> `test` -> `coverage`) | All of the above |

---

## 4. End-to-End (E2E) Multi-Session Workflow Testing

### The 5-Step E2E User Request Pipeline

In `tests/e2e/test_multi_session_flow.py`, the complete multi-session lifecycle is verified:

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Signal / Chat)
    participant Channel as mypai-channel
    participant Main as mypai-main
    participant Board as amux Kanban Board
    participant Worker as amux-task-worker-1
    participant Memory as Hindsight Bank

    User->>Channel: "Refactor DB connection pool"
    Channel->>Memory: hindsight.reflect("Refactor DB connection pool")
    Memory-->>Channel: User preferences (asyncpg, pool_size=100)
    Channel->>Main: amux.send_message("mypai-main", correlation_id="req-1001")
    
    Main->>Board: amux.create_card("Refactor DB", lane="Todo")
    Main->>Worker: amux.spawn_task_worker("task-worker-db-1", prompt="...")
    Main->>Board: amux.update_card(lane="Doing")
    
    Worker->>Worker: Executes refactoring & runs pytest
    Worker->>Main: amux.send_message("mypai-main", correlation_id="report-1001")
    
    Main->>Memory: hindsight.retain("Increased asyncpg max_size to 100")
    Main->>Board: amux.update_card(lane="Done")
    Main->>Channel: amux.send_message("mypai-channel", correlation_id="req-1001")
    Channel->>User: "Completed DB pool upgrade with 0 test failures."
```

### Anomaly Recovery & Chaos Testing

The E2E suite tests fault tolerance and error recovery:
1. **Network Disconnects:** Injects simulated connection resets (`ConnectionResetError`) during background cron sweeps.
2. **Failure Analysis:** Verifies `analyze_worker_failure` captures the exact stack trace and error type.
3. **Automated Kanban Alerting:** Verifies that cron automatically posts an alert card to the `Todo` lane with diagnostic context, notifying main without crashing the scheduler.

---

## 5. Adding New Tests & Guidelines

### Unit Test Pattern
When adding a new feature or API method to `mypai_runtime`:
1. Add test case under `tests/unit/test_<feature>.py`.
2. Use the `mock_amux_client` or `mock_hindsight_client` fixtures from `tests/conftest.py`.
3. Assert both positive paths and explicit error paths (e.g. `pytest.raises(TimeoutError)`).

### E2E Test Pattern
When adding a new inter-agent workflow or slash command:
1. Add workflow simulation under `tests/e2e/test_<flow>.py`.
2. Validate turn messages with explicit correlation IDs (`correlation_id="corr-..."`).
3. Verify state transitions on the amux Kanban board (`Todo` -> `Doing` -> `Done`).
4. Run `make all` to verify 100% linter and typecheck compliance.
