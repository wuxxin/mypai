# Oh-My-Pi (`omp` 19.1.1+) Runtime Configuration, `eval` & `omp_rpc`

Reference for `omp`'s runtime configuration layering, prompt assembly, `eval` persistent kernel / loopback bridge, and the `omp_rpc` Python SDK. Grounded against the local `submodules/aur-packages/oh-my-pi-git/src/oh-my-pi/` checkout (`19.1.1.r184`).

---

## 1. Configuration Layering & Prompt Assembly

### Config Files (`~/.omp/agent/` ⊕ `<repo>/.omp/`)
Project `<repo>/.omp/config.yml` deep-merges over `~/.omp/agent/config.yml` (array rules like `bashInterceptor.patterns` prepend). Key host settings in [`omp/agent/config.yml`](../omp/agent/config.yml):
- **`tools.commands` / `tools.commandDocs: inline`** (`19.1.0+`, replaced `tools.xdev*`): mounts discoverable tools as bash commands (`<tool> --help`, `<tool> <args>`, docs via `help://<tool>/<topic>`).
- **`computer.takeover: fallback`** (`19.1.1+`, replaced `computer.backgroundFallback`).
- **`mcp.shared: true` / `mcp.idleStopMinutes: 5`** (`19.1.0+` defaults): per-user `omp` daemon hosts MCP servers with lazy startup and cached discovery; `/mcp list` and `omp ps` inspect live state.
- **`task.crossInstance: true`**: same-folder `omp` instances list via `agent://peers` and message each other via `agent://<pid>`.
- **`statusLine`**: `preset: custom` with `leftSegments: [vim, model, mode, path, git, pr, tree]` and `rightSegments: [session_name, token_total, cost, context_pct]`.
- **`compaction`**: `methodOrder: [snapcompact, remote, soft]`, `thresholdPercent: 85`, `handoffSaveToDisk: true`.

### System Prompt Assembly
```text
Block 0: Core Harness Template (system-prompt.md, or custom-system-prompt.md if SYSTEM.md is set)
  ├── 1. System conventions (RFC 2119, XML tags)
  ├── 2. Core engineering principles
  ├── 3. Internal URI schemes (skill://, rule://, memory://root, agent://, help://, local://, proc://, pr://, issue://, mcp://)
  ├── 4. Tool inventory & bash tool commands (`<tool> --help`, `help://<tool>/<topic>`)
  ├── 5. Discovered skills (~/.omp/agent/skills/ and <repo>/.omp/skills/)
  ├── 6. Sticky rules (RULES.md, alwaysApply: true)
  └── 7. Personality block

Block 1: Project Prompt Footer (project-prompt.md)
  ├── <workstation>, <repo-rules> (AGENTS.md / CLAUDE.md), <dir-context>, <workspace-tree>
  └── appendPrompt:
        ├── Memory backend instructions (Mnemopi)
        ├── Auto-learn instructions (learn / manage_skill)
        ├── Connected MCP server & tool-command routing guidance
        └── APPEND_SYSTEM.md (plain text — YAML frontmatter is NOT parsed here)
```

| File | Scope | Effect |
| :--- | :--- | :--- |
| `APPEND_SYSTEM.md` | `~/.omp/agent/` or `<cwd>/.omp/` | Appended as plain text; **preserves full harness**. Main session only (subagents do not inherit it). |
| `SYSTEM.md` | `~/.omp/agent/` or `<cwd>/.omp/` | Replaces default template — omits built-in tool instructions unless restated. |
| `AGENTS.md` | `<cwd>/`, ancestors, `.omp/` | Injected into `<repo-rules>` / `<dir-context>`. |
| `RULES.md` | `~/.omp/agent/` or `<cwd>/.omp/` | Sticky `alwaysApply: true` rules re-injected near the current turn. |

---

## 2. The `eval` Tool & Loopback Bridge

`omp`'s `eval` tool runs persistent, session-scoped **Python** and **JavaScript (Bun)** kernels (`python.kernelMode: session`, `eval.autoBackground.enabled: true`, default 30 s cell deadline) wired back into `omp`'s native tools via a **loopback IPC bridge**:

- **Persistent state:** Imports (`pandas`, `numpy`, `torch`), variables, and dataframes survive across turns. Supports IPython magics (`%pip`, `%time`, `%timeit`, `%%bash`, `!cmd`).
- **Programmatic tool calling:** Prelude exposes `tool.*` / `read()`, `write()`, `browser.*`, `dsm.*`, `commit.*`, `judge.*`, `wait()` (`agent://id` supported in `19.1.1+`) inside code cells so multi-step search/parse/verify loops run in one turn without round-tripping raw data through the LLM.
- **Inspecting failed `completion()` frames (`19.1.0+`):** Raw provider frames are recorded for `/debug` and saved on failure in the session's `local://` directory.

---

## 3. `omp_rpc` Python SDK

Installed system-wide by `oh-my-pi-git` (and mirrored offline to `/usr/share/oh-my-pi/python/omp-rpc` for plugin venvs). Drives headless `omp --mode rpc` over JSONL stdio:

```python
from omp_rpc import RpcClient

async with RpcClient(cwd="/path/to/repo") as client:
    client.on_session_event(lambda ev: print(ev))
    await client.prompt("Summarize recent commits")
```

- **Key capabilities (`19.1.0+`):** Remote model picker, thinking-level/role selection, `auto` thinking, `steer`/`follow_up`/`abort`/resume controls, and `config_warnings_changed`/`advisor_cost_changed`/`advisor_yielded` events (`#20254`).
- **Breaking in `19.1.0`:** RPC hosts must handle the `ask` tool as one complete HTML-form `form` request and return submitted data or cancellation (field-by-field prompts were removed).
- Full upstream protocol spec is installed at `/usr/share/doc/oh-my-pi/rpc.md`.
