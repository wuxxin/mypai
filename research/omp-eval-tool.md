# Overview of `omp eval`

**`omp` (oh-my-pi)** is an open-source, terminal-based AI coding harness built with a native Rust core and high-performance agent tooling. 

While most AI coding harnesses handle execution by spawning isolated, stateless shell sub-processes (or isolated Docker sandboxes), `omp` features a dedicated **`eval` tool**. The `eval` tool provides a persistent, multi-language execution runtime (Python and JavaScript via Bun) that integrates directly into the agent’s internal tool system via a **loopback bridge**.

---

## 1. How the Python Interpreter Works

The Python backend in `omp eval` is designed around **long-running, session-scoped execution** rather than short-lived `python -c` invocations.

### **A. Persistent Subprocess Process Kernel**
* **Process Lifecycle:** `omp` spawns a background Python kernel using a dedicated `py` subprocess.
* **Session Persistence:** State (variables, functions, imports, objects, dataframes) persists across turns and execution cells. Heavy libraries like `pandas`, `torch`, or `numpy` stay loaded in memory rather than incurring re-import overhead on every interaction.
* **Configurable Isolation:** By default, kernels are **session-scoped**. However, `omp` supports per-cell resets or isolated execution modes when clean-state execution or parallel subagent worktrees are required.

### **B. Built-in Magics and Shell Execution**
The Python execution environment intercepts IPython-style cell/line magics before code evaluation:
* `%pip` / `%pip install ...`: Allows dynamic package installation without leaving the session state or shelling out.
* `%time` / `%timeit`: Profiles line or cell execution times inside the active kernel.
* `%%bash` / `!cmd`: Executes raw shell commands within the cell context using `omp`’s native in-process shell engine.

---

## 2. The Loopback Bridge ("Code Execution w/ Tool-Calling")

### **How the `omp` Loopback Bridge Architecture Works**
`omp` implements **Programmatic Tool Calling** over a **Loopback Bridge**:

```
┌────────────────────────────────────────────────────────┐
│                   omp Agent Runtime                    │
│    (Native Rust Engine / In-Process Tools / LSP / DAP) │
└──────────────────────────▲─────────────────────────────┘
                           │ IPC / Loopback Bridge
                           │ (read, search, task, etc.)
┌──────────────────────────▼─────────────────────────────┐
│                 Persistent Kernel                      │
│      Python Subprocess  OR  JS (Bun Worker) Process     │
│   ┌────────────────────────────────────────────────┐   │
│   │ Prelude: Exposes `tool.<name>()` Namespace     │   │
│   └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

1. **Injected Preludes:** When the Python (or Bun JS) kernel starts, `omp` injects a client library/prelude into the kernel's runtime.
2. **Exposed Namespace:** The prelude exposes a global `tool` object (and helpers like `read()`, `write()`, `agent()`) inside Python/JS.
3. **IPC Interception:** When code calls `tool.read("data.csv")` or `tool.search(...)`, the library serializes the function call and sends it across a loopback socket/IPC channel back to the parent `omp` process.
4. **Native Execution:** The main `omp` agent executes the request using its native, ultra-fast tools (e.g., in-process `ripgrep`, LSP diagnostics, or file summarizers).
5. **Synchronous/Async Return:** The output is passed back over the loopback bridge directly into the running Python/JS variable context.

The model writes a single code block to orchestrate complex tool pipelines without forcing a full LLM inference pass at every step.

---

## 3. Calling `omp` Tools from Inside Python

Inside an `omp eval` cell, tools are callable as standard Python functions under the `tool` module/namespace:

#### **Example 1: In-Memory Data Analysis using `tool.read`**
Instead of dumping file contents into the LLM context prompt, Python reads the file programmatically through `omp`'s native reader:

```python
import pandas as pd

# Call omp's native `read` tool from inside Python
raw_csv_data = tool.read("server_logs.csv")

# Process, filter, and inspect using pandas in the persistent kernel
df = pd.read_csv(raw_csv_data)
summary = df[df["status"] == 500].describe()

print(summary)
```

#### **Example 2: Batch Searching & Inspection**
Loop over search results programmatically without returning control to the LLM turn-by-turn:

```python
# Query codebase via omp's native search/grep tool
search_hits = tool.search(query="deprecated_api_call", glob="*.py")

for hit in search_hits:
    # Programmatically load file snippets using native tool
    content = tool.read(hit["path"])
    print(f"Found in {hit['path']}: {len(content)} bytes")
```

#### **Example 3: Cross-Kernel Execution (Python + JS)**
Because `omp` maintains both Python and Bun JavaScript execution backends in the same session, code execution and data can cross surfaces:

* **In Python:**
  ```python
  # Fetch data via tool bridge and compute metrics
  df = pd.read_csv(tool.read("metrics.csv"))
  chart_data = df.to_json()
  ```
* **In JavaScript (Bun Kernel):**
  ```javascript
  // Read from the persistent environment and generate a chart/visualization
  const data = await tool.read("chart_data.json");
  // Render / Chart using JS tooling without leaving the cell
  ```

#### **Example 4: Parallel Subagent Fan-out (`tool.task` / `agent()`)**
`omp` allows orchestrating parallel child subagents from inside code:

```python
# Dispatch subagents concurrently over the loopback bridge
results = parallel([
    lambda: agent("Run unit tests on package A", isolated=True),
    lambda: agent("Run unit tests on package B", isolated=True)
])

for res in results:
    print(res.status)
```

---

### Key Benefits Summary

| Feature | Standard Harnesses | `omp eval` Architecture |
| :--- | :--- | :--- |
| **Execution State** | Per-command stateless executions (`exec`) | Session-scoped persistent Python / Bun JS kernels |
| **Tool Calling** | Round-trip via LLM context prompt on every action | In-code native bridge via `tool.<name>` (Programmatic Tool Calling) |
| **Token Usage** | High (dumps all intermediate tool outputs into prompt) | Very Low (filters data in memory before displaying output) |
| **Control Flow** | Expressed through LLM multi-turn prompting | Expressed through native Python loops, conditionals, and functions |


## Integration

To prompt the `omp` agent harness to use its `eval` tool effectively, you can steer it at two levels:
1. **User-level CLI Prompts:** Instructions given during chat or CLI sessions asking the agent to execute Python code via `eval`.
2. **Harness/System Prompt Rules:** Guidelines in `.omp/instructions.md` or system prompt overrides that force the agent to default to `eval` for data processing and multi-tool orchestration.

---

### Category 1: User-Level Direct Prompts (CLI / Chat)

These examples instruct `omp` to execute Python code via `eval`, keep intermediate outputs out of the LLM context, and bridge back into harness tools via `tool.<name>()`.

#### **Prompt Example 1: In-Memory Large Data Processing**
> *"Analyze `production_logs.json.gz`. Use the Python `eval` kernel with `tool.read()` to stream-parse the logs, aggregate all `500` error status codes, calculate hourly frequency, and save a summary CSV to `dist/error_summary.csv`. **Do not dump raw logs into our chat context—process everything inside the persistent Python kernel.**"*

* **Why it works:** It explicitly tells the harness to use `eval` and `tool.read()`, keeping large payloads inside Python memory rather than clogging the LLM context window.

---

#### **Prompt Example 2: Codebase Auditing using In-Kernel Tool Loops**
> *"Audit our codebase for usages of `legacy_auth_v1`. Execute a Python `eval` cell that uses `tool.search()` to find all occurrences, uses `tool.read()` inside a Python loop to pull line contexts, filters out tests and mocks, and writes a summary report using `tool.write('audit_report.md')`."*

* **Why it works:** Instead of making `omp` run 20 sequential tool calls turn-by-turn (Search → Read → Read → Read...), it condenses the entire discovery loop into a **single `eval` cell execution**.

---

#### **Prompt Example 3: Environment Setup & Data Pipeline (Using Kernel Magics)**
> *"Use the `eval` Python tool. First run `%pip install pandas duckdb` in the kernel, then query `orders.sqlite` using `tool.read()`, calculate monthly revenue growth in pandas, and display the result table."*

* **Why it works:** Leverages `%pip` magic inside the persistent Python kernel to install dependencies dynamically without shelling out to raw terminal sub-processes.

---

#### **Prompt Example 4: Parallel Subagent Fan-Out (`workflowz` / `agent()`)**
> *"workflowz: Refactor our microservices to add OpenTelemetry tracing headers. Use Python `eval` to spawn parallel subagents using `parallel()` for `services/auth`, `services/payments`, and `services/billing`. Inspect their outputs inside Python before finalizing."*

* **Why it works:** Includes the magic trigger `workflowz` and directs `omp` to use `eval`'s programmatic agent wrapper (`parallel([lambda: agent(...)])`) to execute subagents concurrently.

---

### Category 2: System Prompt Steering (`.omp/instructions.md`)

To prevent `omp` from falling back to traditional turn-by-turn tool calls, place programmatic execution guidelines in your project's `.omp/instructions.md` or system instructions.

#### **System Prompt Policy Template**

```markdown
# Agent Execution Guidelines: Programmatic Tool Calling (`eval`)

## Primary Policy
For tasks involving multi-file searches, large data processing (>50KB), or batch operations, **you MUST use the `eval` tool running Python (`lang: "py"`) rather than issuing sequential individual tool calls.**

## Standard Patterns to Follow

### 1. Data Processing Pattern
Always load data via `tool.read()` inside Python cells. Process, filter, and aggregate inside the Python runtime.
```python
# GOOD: Clean context, fast in-memory execution
data = tool.read("large_dataset.json")
df = pd.read_json(data)
filtered_result = df[df["score"] > 0.9].to_dict()
print(filtered_result)
```

### 2. Multi-File Search & Batch Modification Pattern
Do NOT call `tool.search` followed by 10 separate `tool.read` calls. Instead, wrap them inside a Python script inside `eval`:
```python
hits = tool.search(query="deprecate_me")
for hit in hits:
    content = tool.read(hit["path"])
    # Process or modify
```

### 3. Orchestration & Parallel Tasks
When delegating work across subdirectories, use `parallel()` or `agent()` inside an `eval` cell:
```python
results = parallel([
    lambda: agent("Run unit tests in backend/", isolated=True),
    lambda: agent("Run linting in frontend/", isolated=True)
])
```
```

---

### Category 3: Under the Hood — What `omp` Executes

When the LLM receives a prompt like Example 2 above, it converts the request into an `eval` tool call payload:

#### **1. Tool Invocation JSON Generated by Model**
```json
{
  "tool": "eval",
  "parameters": {
    "lang": "py",
    "code": "hits = tool.search(query='legacy_auth_v1', glob='*.py')\naudit = []\nfor h in hits:\n    content = tool.read(h['path'])\n    if 'test' not in h['path']:\n        audit.append({'path': h['path'], 'lines': len(content.splitlines())})\n\ntool.write('audit_report.md', str(audit))\nprint(f'Audited {len(audit)} files successfully.')"
  }
}
```

#### **2. Execution Trace in `omp` Kernel**
1. **Host Agent:** Receives the `eval` request and routes `code` to the active `py` subprocess.
2. **Python Subprocess:** Evaluates `hits = tool.search(...)`. The prelude intercepts `tool.search()`, sends an IPC frame over the loopback socket to `omp`.
3. **Rust Engine:** Executes in-process `ripgrep` and responds over IPC to Python with search matches.
4. **Python Subprocess:** Runs the loop, calls `tool.read()` for each path over IPC, writes `audit_report.md` via `tool.write()`, and returns `Audited 12 files successfully.` to the terminal output.
5. **LLM Context:** Receives **1 single result string** instead of dozens of raw file dumps.
6. 