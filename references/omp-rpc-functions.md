# `omp_rpc` Python SDK Reference Guide

This document provides a comprehensive reference of all classes, methods, functions, data structures, and exception types in the **`omp_rpc`** Python SDK (installed with Oh-My-Pi).

---

## 1. Overview & Setup

The `omp_rpc` module is the official asynchronous/synchronous Python client interface for controlling **Oh-My-Pi (`omp`)** running in headless JSON-RPC mode.

```python
from omp_rpc import RpcClient

client = RpcClient(cwd="/path/to/workspace")
client.start()
# ... perform operations ...
client.stop()
```

---

## 2. `RpcClient` Methods Reference

### 2.1 Lifecycle & Connection Management

| Method | Signature | Description |
| :--- | :--- | :--- |
| **`start()`** | `start() -> RpcClient` | Spawns the underlying `omp --mode rpc` process and initializes RPC event listeners. |
| **`stop()`** | `stop() -> None` | Gracefully closes stdin/stdout handles and terminates the child process. |
| **`wait_for_idle()`** | `wait_for_idle(timeout: float \| None = None) -> None` | Blocks execution until the active turn finishes processing and the agent becomes idle. |
| **`collect_events()`** | `collect_events(timeout: float \| None = None) -> tuple[RpcAgentEvent, ...]` | Flushes and returns buffered RPC events up to the given timeout. |

---

### 2.2 Session Management

| Method | Signature | Description |
| :--- | :--- | :--- |
| **`new_session()`** | `new_session(parent_session: str \| None = None) -> CancellationResult` | Starts a fresh session, cancelling any active turn. Returns `CancellationResult`. |
| **`switch_session()`** | `switch_session(session_path: str \| Path) -> CancellationResult` | Switches to an existing session stored at `session_path`. |
| **`set_session_name()`** | `set_session_name(name: str) -> None` | Assigns a user-friendly display name to the active session. |
| **`get_state()`** | `get_state() -> SessionState` | Fetches complete current session state (IDs, model, streaming status, todos, context usage, etc.). |
| **`get_session_stats()`** | `get_session_stats() -> SessionStats` | Retrieves statistics including total token usage, cost, message counts, and tool calls. |

---

### 2.3 Prompting & Turn Execution

| Method | Signature | Description |
| :--- | :--- | :--- |
| **`prompt()`** | `prompt(message: str, *, images: Sequence[ImageContent] \| None = None, streaming_behavior: StreamingBehavior \| None = None) -> None` | Queues a new user prompt (non-blocking). |
| **`prompt_and_wait()`** | `prompt_and_wait(message: str, *, images: Sequence[ImageContent] \| None = None, streaming_behavior: StreamingBehavior \| None = None, timeout: float \| None = None) -> PromptTurn` | Sends a user prompt and blocks until the turn finishes, returning a `PromptTurn`. |
| **`steer()`** | `steer(message: str, *, images: Sequence[ImageContent] \| None = None) -> None` | Injects mid-turn guidance to adjust agent behavior while running. |
| **`follow_up()`** | `follow_up(message: str, *, images: Sequence[ImageContent] \| None = None) -> None` | Appends a follow-up prompt to be executed after current turns complete. |
| **`abort()`** | `abort() -> None` | Aborts the currently active agent turn. |
| **`abort_and_prompt()`** | `abort_and_prompt(message: str, *, images: Sequence[ImageContent] \| None = None) -> None` | Immediately aborts active turn and queues a new prompt. |
| **`abort_retry()`** | `abort_retry() -> None` | Aborts an active auto-retry attempt. |

---

### 2.4 Model & Thinking Level Control

| Method | Signature | Description |
| :--- | :--- | :--- |
| **`get_available_models()`** | `get_available_models() -> tuple[ModelInfo, ...]` | Lists all available configured models. |
| **`set_model()`** | `set_model(provider: str, model_id: str) -> ModelInfo` | Switches the active language model. |
| **`cycle_model()`** | `cycle_model() -> ModelCycleResult \| None` | Cycles to the next configured model in sequence. |
| **`set_thinking_level()`** | `set_thinking_level(level: ThinkingLevel) -> None` | Adjusts reasoning intensity (`off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, `auto`). |
| **`cycle_thinking_level()`** | `cycle_thinking_level() -> ThinkingLevelCycleResult \| None` | Cycles through available reasoning effort levels. |
| **`set_fast_mode()`** | `set_fast_mode(enabled: bool) -> FastModeResult` | Enables or disables fast/smol mode. |

---

### 2.5 Execution & Behavior Modes

| Method | Signature | Description |
| :--- | :--- | :--- |
| **`set_steering_mode()`** | `set_steering_mode(mode: SteeringMode) -> None` | Configures steering behavior (`one-at-a-time`, `all`, etc.). |
| **`set_follow_up_mode()`** | `set_follow_up_mode(mode: SteeringMode) -> None` | Configures follow-up message handling mode. |
| **`set_interrupt_mode()`** | `set_interrupt_mode(mode: InterruptMode) -> None` | Sets interrupt policy (`immediate`, `tool_boundary`, etc.). |
| **`set_auto_retry()`** | `set_auto_retry(enabled: bool) -> None` | Toggles automatic error retry on API errors. |
| **`set_auto_compaction()`** | `set_auto_compaction(enabled: bool) -> None` | Toggles automatic context window compaction. |

---

### 2.6 Message History, Compaction & Branching

| Method | Signature | Description |
| :--- | :--- | :--- |
| **`get_messages()`** | `get_messages() -> tuple[AgentMessage, ...]` | Retrieves full list of session messages. |
| **`get_messages_page()`** | `get_messages_page(*, cursor: str \| None = None, limit: int \| None = None) -> MessagesPage` | Paginated retrieval of session messages. |
| **`get_last_assistant_text()`**| `get_last_assistant_text() -> str \| None` | Helper to extract the final text from the last assistant message. |
| **`compact()`** | `compact(custom_instructions: str \| None = None) -> CompactionResult` | Triggers immediate context compaction with optional instructions. |
| **`branch()`** | `branch(entry_id: str) -> BranchResult` | Branches the session history from a specific entry ID. |
| **`get_branch_messages()`** | `get_branch_messages() -> tuple[BranchMessage, ...]` | Retrieves branch navigation tree messages. |
| **`export_html()`** | `export_html(output_path: str \| Path \| None = None) -> Path` | Exports the session transcript to a HTML report file. |

---

### 2.7 Todo List Management

| Method | Signature | Description |
| :--- | :--- | :--- |
| **`get_todos()`** | `get_todos() -> tuple[TodoPhase, ...]` | Retrieves current active todo item phases. |
| **`set_todos()`** | `set_todos(todos: Sequence[TodoSeed \| TodoPhaseSeed]) -> tuple[TodoPhase, ...]` | Updates the session's active todo list. |
| **`clear_todos()`** | `clear_todos() -> tuple[TodoPhase, ...]` | Clears all current todo phases. |

---

### 2.8 Custom Host Tools & Custom URIs

| Method | Signature | Description |
| :--- | :--- | :--- |
| **`set_custom_tools()`** | `set_custom_tools(tools: Sequence[HostTool[Any, Any]]) -> tuple[str, ...]` | Registers Python functions as custom host tools executable by the model. |
| **`set_host_uris()`** | `set_host_uris(host_uris: Sequence[HostUri[Any]]) -> tuple[str, ...]` | Registers custom host URI scheme handlers. |
| **`bash()`** | `bash(command: str) -> BashResult` | Executes a direct bash command in the agent host environment. |
| **`abort_bash()`** | `abort_bash() -> None` | Aborts a running bash execution command. |

---

### 2.9 UI Request Handling (Headless & Interactive)

| Method | Signature | Description |
| :--- | :--- | :--- |
| **`install_headless_ui()`** | `install_headless_ui(..., confirm=False, select_value=..., input_value=...) -> Callable[[], None]` | Installs automatic response handlers for UI prompts (dialogs, selections). |
| **`next_ui_request()`** | `next_ui_request(timeout: float \| None = None) -> ExtensionUiRequest` | Blocks until the next UI request arrives from an extension. |
| **`send_ui_confirmation()`**| `send_ui_confirmation(request_id: str, confirmed: bool) -> None` | Responds to a binary confirmation prompt. |
| **`send_ui_value()`** | `send_ui_value(request_id: str, value: str) -> None` | Sends text or selection input back to a UI request. |
| **`cancel_ui_request()`** | `cancel_ui_request(request_id: str, *, timed_out: bool = False) -> None` | Cancels a pending UI request. |

---

### 2.10 Event Listener Registration (`on_*`)

The client provides type-safe event subscription methods returning un-subscribe callbacks:

- `on_event(listener)`
- `on_ready(listener)`
- `on_agent_start(listener)`
- `on_agent_end(listener)`
- `on_turn_start(listener)`
- `on_turn_end(listener)`
- `on_message_start(listener)`
- `on_message_update(listener)`
- `on_message_end(listener)`
- `on_tool_execution_start(listener)`
- `on_tool_execution_update(listener)`
- `on_tool_execution_end(listener)`
- `on_auto_compaction_start(listener)`
- `on_auto_compaction_end(listener)`
- `on_auto_retry_start(listener)`
- `on_auto_retry_end(listener)`
- `on_retry_fallback_applied(listener)`
- `on_retry_fallback_succeeded(listener)`
- `on_todo_reminder(listener)`
- `on_todo_auto_clear(listener)`
- `on_ui_request(listener)`
- `on_notification(listener)`
- `on_protocol_error(listener)`
- `on_extension_error(listener)`
- `on_listener_error(listener)`
- `on_unknown_notification(listener)`

---

## 3. Standalone Helper Functions

```python
from omp_rpc import (
    assistant_text,
    assistant_text_with_thinking,
    message_text,
    message_text_with_thinking,
    image_from_path,
    host_tool,
    host_uri,
    parse_notification,
    parse_session_state,
    parse_todo_phases,
)
```

| Function | Signature | Description |
| :--- | :--- | :--- |
| **`assistant_text()`** | `assistant_text(message: AgentMessage, *, include_thinking: bool = False) -> str \| None` | Extracts clean text content from an assistant message. |
| **`assistant_text_with_thinking()`** | `assistant_text_with_thinking(message: AgentMessage) -> str \| None` | Extracts assistant message text including reasoning/thinking blocks. |
| **`message_text()`** | `message_text(message: AgentMessage, *, include_thinking: bool = False) -> str \| None` | Extracts text from any `AgentMessage`. |
| **`message_text_with_thinking()`** | `message_text_with_thinking(message: AgentMessage) -> str \| None` | Extracts text with thinking blocks from any `AgentMessage`. |
| **`image_from_path()`** | `image_from_path(path: str \| Path, mime_type: str \| None = None) -> ImageContent` | Creates an `ImageContent` object from a local image file. |
| **`host_tool()`** | `host_tool(name=..., description=..., parameters=..., execute=...) -> HostTool` | Decorator/factory to create a `HostTool` definition for custom RPC tools. |
| **`host_uri()`** | `host_uri(scheme=..., read=..., write=...) -> HostUri` | Factory to register custom host URI schemes (`my-scheme://`). |
| **`parse_notification()`** | `parse_notification(payload: JsonObject) -> RpcNotification` | Parses raw JSON notification dict into typed `RpcNotification`. |
| **`parse_session_state()`** | `parse_session_state(payload: JsonObject) -> SessionState` | Parses raw JSON dict into typed `SessionState`. |
| **`parse_todo_phases()`** | `parse_todo_phases(payload: JsonValue \| None) -> tuple[TodoPhase, ...]` | Parses raw JSON into a tuple of `TodoPhase` objects. |

---

## 4. Key Data Models & Dataclasses

- **`SessionState`**: Contains `session_id`, `session_name`, `session_file`, `model`, `thinking_level`, `is_streaming`, `steering_mode`, `message_count`, `context_usage`, etc.
- **`SessionStats`**: Contains `session_id`, `session_file`, `user_messages`, `assistant_messages`, `tool_calls`, `tokens`, `cost`.
- **`CancellationResult`**: Contains `cancelled: bool`.
- **`PromptTurn`**: Output of `prompt_and_wait()`, holding turn events and response payload.
- **`ModelInfo`**: Contains `provider`, `model_id`, `name`, `context_window`, etc.
- **`ContextUsage`**: Tracks current context tokens, maximum window limit, and usage percentage.

---

## 5. Exception Hierarchy

- **`RpcError`** (Base Exception)
  - **`RpcProtocolError`**: Invalid protocol payload or version mismatch.
  - **`RpcCommandError`**: The RPC server returned an explicit error response.
  - **`RpcConcurrencyError`**: Turn lock or concurrent operation conflict.
  - **`RpcTimeoutError`**: Request timed out waiting for server response.
  - **`RpcProcessExitError`**: Underlying `omp` binary process terminated unexpectedly.
