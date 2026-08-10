---
name: mypai-tools
description: Complete guide for using mypai_tools MCP services (cron-scheduler, chat-channel, local-speech) and background daemons (heartbeat, input_spooler, chat_bridge). Use when scheduling automated jobs, processing Signal messages, handling STT/TTS audio, or interacting with per-project cron entries.
---

# `mypai_tools` MCP Services & Background Daemons

`mypai_tools` provides a comprehensive suite of MCP tool servers, background daemons, and execution services.

---

## 1. Documentation Index & Location Matrix

| Component Type | Component Name | Implementation Module | Architectural Spec / File | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **MCP Server** | `cron-scheduler` | `mypai_tools.cron_mcp` | [mcp.json](file:///home/wuxxin/agent-shared/code/mypai/submodules/omp-mypai/mcp.json) | Cron schedule CRUD operations & job imports/exports |
| **MCP Server** | `chat-channel` | `mypai_tools.chat_mcp` | [mcp.json](file:///home/wuxxin/agent-shared/code/mypai/submodules/omp-mypai/mcp.json) | Signal messaging interface (`signal-cli-rest-api`) |
| **MCP Server** | `local-speech` | `mypai_tools.speech_mcp` | [mcp.json](file:///home/wuxxin/agent-shared/code/mypai/submodules/omp-mypai/mcp.json) | Local Speech-to-Text (Whisper) & Text-to-Speech synthesis |
| **Daemon** | `heartbeat` | `mypai_tools.heartbeat` | [heartbeat.md](file:///home/wuxxin/agent-shared/code/mypai/submodules/omp-mypai/tools/mypai_tools/heartbeat.md) | Cron runner daemon, SQLite WAL manager, & RPC poke engine |
| **Daemon** | `input_spooler` | `mypai_tools.input_spooler` | [input_spooler.md](file:///home/wuxxin/agent-shared/code/mypai/submodules/omp-mypai/tools/mypai_tools/input_spooler.md) | Inbox directory watcher, STT pipeline, & Hindsight retention |
| **Daemon** | `chat_bridge` | `mypai_tools.chat_bridge` | [chat_bridge.md](file:///home/wuxxin/agent-shared/code/mypai/submodules/omp-mypai/tools/mypai_tools/chat_bridge.md) | Signal chat event listener & OMP session steering bridge |

---

## 2. Task Scheduling (`cron-scheduler`)

Per-project cron tasks are stored in SQLite databases located at `$HOME/.omp/cron/projects/<project_hash>/cron.db`.

### Crontab Standard & Version Normalization
Always specify standard Unix crontab syntax where **`0` = Sunday** (or `7` = Sunday).
`mypai_tools` transparently detects whether `apscheduler < 4.0` or `apscheduler >= 4.0` is installed and normalizes the day-of-week field automatically so `0` always means Sunday.

### Distinctive `#[VARNAME]` Macro Delimiter & Standardized Internal Variables
- **`#[VARNAME]` Macro Syntax**: All string attributes (`action`, `url`, `args`, `kwargs`, `output_prompt`) substitute `#[VARNAME]` placeholders (e.g. `#[HINDSIGHT_API_URL]`, `#[HINDSIGHT_BANK_ID]`, `#[HOME]`) before execution.
- **Internal Execution Variables**: `output_prompt` supports standardized `_`-prefixed internal telemetry variables:
  - `#[_RETURNCODE]`: Process exit status code
  - `#[_STDOUT]`: Standard output text
  - `#[_STDERR]`: Standard error text
  - `#[_STDCOMBINED]`: Combined stdout + stderr text
  - `#[_RESULT]`: Result object / string
- **Environment Inheritance**: `shell` subprocesses explicitly inherit all active daemon environment variables (`PATH`, `VIRTUAL_ENV`, `PYTHONPATH`, etc.) via `env=os.environ.copy()`.

### Unified Supported Job Types (`type`) & Field Matrix

| Field | `rpc` | `http` | `shell` | `python` | Macro Substitution? | Exact Field Usage Explanation |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **`id`** | **Req** | **Req** | **Req** | **Req** | No | Unique job ID string. |
| **`name`** | **Req** | **Req** | **Req** | **Req** | `#[VARNAME]` | Human-readable job name. |
| **`cron_expression`** | **Req** | **Req** | **Req** | **Req** | No | Standard 5-field cron string (`0 8 * * 0` where `0` = Sun). |
| **`type`** | **Req** | **Req** | **Req** | **Req** | No | Primary engine selection: `"rpc"`, `"http"`, `"shell"`, `"python"`. |
| **`action`** | **Req** | **Req** | **Req** | **Req** | **`#[VARNAME]`** | **RPC**: RPC verb (`prompt`, `steer`, `followup`, `abort_and_prompt`, `switch_session`, `branch`).<br>**HTTP**: HTTP method (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`).<br>**Shell**: Base CLI executable (`python3`, `ls`, `echo`).<br>**Python**: Lambda expression (e.g. `lambda args, kwargs: ...`). |
| **`url`** | N/A | **Req** | N/A | N/A | **`#[VARNAME]`** | Target REST API endpoint URL. |
| **`args`** | Opt | Opt | Opt | Opt | **`#[VARNAME]`** | **RPC**: Positional args.<br>**HTTP**: Positional payload.<br>**Shell**: Positional argument list.<br>**Python**: Positional args passed to lambda. |
| **`kwargs`** | **Req** | Opt | Opt | Opt | **`#[VARNAME]`** | **RPC**: Keyword args dict containing `"prompt"` text.<br>**HTTP**: Request body dict + `headers` dict.<br>**Shell**: CLI flag dict (`{"inbox": "#[HOME]/Inbox"}`).<br>**Python**: Keyword args passed to lambda. |
| **`output_prompt`** | Opt | Opt | Opt | Opt | **`#[VARNAME]`** | Output context template supporting `#[_STDOUT]`, `#[_STDERR]`, `#[_RETURNCODE]`, `#[_RESULT]`. |
| **`output_type`** | N/A | N/A | Opt | N/A | No | Stream capture mode: `"stdout"` (default), `"stderr"`, `"combined"`. |
| **`output_action`** | N/A | N/A | Opt | N/A | No | Routing back to OMP: `"ignore"` (default), `"prompt"`, `"steer"`, `"followup"`, `"abort_and_prompt"`. |

### Telemetry Fields
Every registered job tracks execution metrics:
`last_start`, `last_stop`, `last_runtime` (seconds), `last_returncode`, `last_output`, and `total_calls`.

---

## 3. Signal Messaging (`chat-channel`)

Interacts with local `signal-cli-rest-api` daemon to send and receive Signal messages.

---

## 4. Audio & Speech Processing (`local-speech`)

Processes audio transcription (`transcribe_audio`) via local Whisper (port 50090) and speech synthesis (`synthesize_speech`) via TTS server (port 50095).
