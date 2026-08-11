# MyPAI MVP Research & Architecture Plan

**Status:** `IMPLEMENTED & VERIFIED` (Completed in `submodules/omp-mypai` & Tested on 2026-08-11)

## Executive Overview

This plan defines the architectural specifications and step-by-step implementation roadmap for building the **MyPAI MVP**. The target is a fully compliant Agent-Plugin (`omp-mypai`), integrated virtual environment, merged Hindsight memory bank configuration, enhanced Heartbeat daemon with rich job execution capabilities, robust SQLite concurrency safety, and a headless agent spawning setup with live session observation/attachment options.

---

## 1. Agent Plugin Conformance (`submodules/omp-mypai/plugin.json`)

### Standard Compliance
The `omp-mypai` plugin must strictly comply with **Agent Plugins 1.0.0 Standard** (`https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`).

### Proposed `plugin.json` Manifest
```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "omp-mypai",
  "version": "0.1.0",
  "description": "MyPAI core agent plugin: daemons, cron scheduler, hindsight memory integration, and MCP tools",
  "author": {
    "name": "wuxxin <wuxxin@gmail.com>"
  },
  "license": "MIT",
  "keywords": [
    "mypai",
    "omp",
    "hindsight",
    "cron",
    "heartbeat",
    "speech",
    "mcp"
  ],
  "mcp": "mcp.json",
  "env": {
    "PYTHONPATH": "${PLUGIN_ROOT}/tools"
  }
}
```

### Proposed `mcp.json` Manifest
```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "chat-channel": {
      "type": "stdio",
      "command": "python3",
      "args": ["-m", "mypai_tools.chat_mcp"],
      "env": {
        "PYTHONPATH": "${PLUGIN_ROOT}/tools"
      }
    },
    "cron-scheduler": {
      "type": "stdio",
      "command": "python3",
      "args": ["-m", "mypai_tools.cron_mcp"],
      "env": {
        "PYTHONPATH": "${PLUGIN_ROOT}/tools"
      }
    },
    "local-speech": {
      "type": "stdio",
      "command": "python3",
      "args": ["-m", "mypai_tools.speech_mcp"],
      "env": {
        "PYTHONPATH": "${PLUGIN_ROOT}/tools"
      }
    },
    "arbor": {
      "type": "stdio",
      "command": "python3",
      "args": ["-m", "arbor", "mcp"]
    },
    "openadapt": {
      "type": "stdio",
      "command": "python3",
      "args": ["-m", "openadapt"]
    }
  }
}
```

---

## 2. Python Virtual Environment (`venv`) Integration

### Architecture
To ensure clean isolation and avoid system package conflicts, all dependencies required for `mypai_tools` are defined in `submodules/omp-mypai/tools/mypai_tools/pyproject.toml`.

### Installation Strategy in `omp.env`
1. Creation of virtual environment at `$HOME/.omp/venv`:
   ```bash
   uv venv --system-site-packages $HOME/.omp/venv
   ```
2. Editable installation of `mypai_tools`:
   ```bash
   uv pip install --python $HOME/.omp/venv/bin/python -e $HOME/.omp/agent/tools/mypai_tools
   ```
3. Activation & PATH propagation:
   In `omp.env`, export `PATH="$HOME/.omp/venv/bin:$PATH"` and `VIRTUAL_ENV="$HOME/.omp/venv"` so all MCP servers spawned by `omp` automatically execute within this venv.

---

## 3. Hindsight Memory Configuration Merging

### Hierarchy & Overrides
- **Can a project override default OMP hindsight config?**
  Yes. In `omp`, hindsight configuration is resolved per-project via the project's `.omp/agent/config.yml` or environment variable `HINDSIGHT_BANK_ID` (default: `omp-orchestrator`).
- **Merged Bank Configuration (`mypai-orchestrator.json`)**:
  Combines project context & architecture from `opencode-orchestrator.json` with TELOS goals, Anti-Criteria, and User Identity from `lifeos-pai.json`.

### Provisioning
The provisioning script `submodules/omp-mypai/config/update-memory-banks.sh` automatically patches bank configurations and syncs mental models via Hindsight's REST API (`http://localhost:8888`).

---

## 4. Heartbeat Daemon Redesign (`omp-mypai:heartbeat`)

### Architecture & Modularization
To maintain clean code standards, `mypai_tools` is structured into modular components:
- `mypai_tools/models.py`: SQLAlchemy database models & Pydantic schemas.
- `mypai_tools/db.py`: Database connection factory, migration helpers, and WAL mode configuration.
- `mypai_tools/executors/rpc_executor.py`: RPC job execution (`prompt`, `steer`, `followup`, `abort_and_prompt`, `switch_session`, `branch`).
- `mypai_tools/executors/http_executor.py`: HTTP request job execution (`GET`, `POST`, `PUT`, `DELETE`).
- `mypai_tools/executors/shell_executor.py`: Shell command execution with stdout/stderr capture and prompt/steer routing.
- `mypai_tools/executors/python_executor.py`: In-process async Python callable execution.
- `mypai_tools/heartbeat.py`: Core AsyncIOScheduler daemon & CLI.
- `mypai_tools/cron_mcp.py`: FastMCP tool interface for cron job CRUD operations.

### Job Metadata Tracking
Job execution records in the database track:
- `last_start`: ISO timestamp of execution start.
- `last_stop`: ISO timestamp of completion.
- `last_runtime`: Execution duration in seconds.
- `last_returncode`: Exit status code (0 for success, non-zero for error).
- `last_output`: Truncated stdout/stderr or API response summary.
- `total_calls`: Incremental counter of total job runs.

### SQLite Concurrency & Safety Assessment
- **Single-User Access Model**: When `cron_mcp` (MCP server) and `heartbeat` (daemon) access SQLite simultaneously, SQLite default rollback journal can experience `database is locked` errors.
- **WAL Mode Mitigation**: Enabling Write-Ahead Logging (`PRAGMA journal_mode=WAL;`) and setting `PRAGMA busy_timeout=30000;` allows concurrent readers and writers without blocking.
- **Postgres Alternative Evaluation**: For single-user local agent setups, SQLite with WAL mode is lightweight, self-contained, and safe. Postgres is only recommended if multi-tenant remote access is required.

---

## 5. Spawning Workspace & Headless Session Attach

### Spawning Workspace Setup
`omp.env` will configure the default project directory to `~/agent-shared/mypai-workspace`.

### Headless Execution & Attachment Workflow
1. **Headless Execution**:
   Start `omp` in headless daemon mode:
   ```bash
   omp daemon start --workspace ~/agent-shared/mypai-workspace
   ```
2. **Read-Only Session Observation**:
   View active session stream and logs using:
   ```bash
   omp share --readonly
   ```
3. **Read/Write Attachment**:
   Attach interactive TUI or steering RPC client to the running session:
   ```bash
   omp attach <session_id>
   ```

---

## 6. Verification Plan

1. **Idempotent Reinstallation**: Run `sandbox-ctl omp install` multiple times to verify clean environment teardown and reconstruction.
2. **Heartbeat Job Tests**:
   - Add RPC, HTTP, Shell, and Python jobs via `cron_mcp`.
   - Verify job execution, output capture, and metadata updates (`total_calls`, `last_runtime`).
   - Test CLI export (`heartbeat --export jobs.json`) and import (`heartbeat --import jobs.json`).
3. **Plugin Schema Validation**: Run JSON schema validator on `plugin.json` and `mcp.json`.
4. **Hindsight Memory Sync**: Run `update-memory-banks.sh` and check Hindsight REST API endpoints for bank and mental model status.
