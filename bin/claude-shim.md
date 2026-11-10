# `claude-shim` (`bin/claude-shim.py`)

Claude Code CLI compatibility shim routing LifeOS headless `claude` subprocess invocations onto Oh My Pi (`omp`) backed by local `llama.cpp` inference via `local-router`.

---

## 1. Role & Data-Safety Invariant

LifeOS subsystems, hooks, Pulse cron jobs, and evaluation harnesses spawn `claude` as an isolated headless subprocess (primarily through `LIFEOS/TOOLS/Inference.ts`, `LIFEOS/PULSE/lib.ts`, `LIFEOS/TOOLS/AgentJob.ts`, and `LIFEOS/RELAY/bridge/session.ts`). On this system, `USER/CONFIG/inference-vendor.json` selects `anthropic` as the default vendor, so those callers execute the `claude` binary on `PATH` / `~/.local/bin/claude`.

`bin/claude-shim.py` (installed to `~/.local/bin/claude` by `omp.env`) intercepts those invocations and enforces local execution:

```
LifeOS Caller (Inference.ts / PULSE / AgentJob / Relay)
   │  spawns ~/.local/bin/claude (--print --model <tier> ...)
   ▼
bin/claude-shim.py
   │  1. Forces model = $LIFEOS_TOOLS_MODEL_NAME (default: llama.cpp/qwen3.8-flash-next)
   │  2. Translates Claude flags, tools, system prompt, and stream-json image blocks
   │  3. Spawns `omp -p --mode=json --profile=isolated --no-session ...`
   ▼
local-router (:21080/v1) ──► Local llama-server
   │  JSONL events (message_end / turn_end / agent_end / error)
   ▼
bin/claude-shim.py
   │  Emits Claude-compatible text, JSON envelope, or stream-json NDJSON
   ▼
LifeOS Caller
```

### Data-Safety Pin
- **Model override invariant:** `--model` / `-m` passed by LifeOS scripts (such as `haiku`, `sonnet`, `opus`, `fable`, or pinned `claude-*` IDs) is parsed and deliberately **ignored**. `omp` always runs `$LIFEOS_TOOLS_MODEL_NAME` (set to `llama.cpp/qwen3.8-flash-next` in `omp.env`, defaulting to `llama.cpp/qwen3.8-flash-next` when unset).
- **Local endpoint routing:** `omp.env` sets `OPENAI_BASE_URL=http://localhost:21080/v1` and `LLAMA_CPP_BASE_URL=http://localhost:21080/v1`, matching the `llama.cpp` provider in `omp/agent/models.yml`.
- **Credential scrubbing compatibility:** LifeOS callers explicitly scrub `CLAUDECODE`, `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, and `ANTHROPIC_BASE_URL` before spawning `claude`. Because `omp` runs with `--profile=isolated` and routes `llama.cpp` to `local-router` (`auth: none`), neither Anthropic API keys nor OAuth subscriptions are needed or billed.
- **No personal-context leakage:** Personal LifeOS data (`USER/`, `MEMORY/`, `TELOS/`, hooks, eval prompts) never leaves the machine to upstream cloud APIs.

---

## 2. What LifeOS Expects from `claude` (Functional Contracts)

### Binary Discovery (`resolveClaudeBin`)
- `Inference.ts` (`resolveClaudeBin`), `AgentJob.ts`, `CarrierProbe.ts`, `PULSE/lib.ts`, and `PULSE/checks/github-work.ts` locate the CLI via `Bun.which("claude")` with fallback `~/.local/bin/claude`.
- The installed file must be a directly executable script (`#!/usr/bin/env python3`, mode `0755`) so callers using shell-free `spawn()` / `Bun.spawn()` can execute it without `shell: true`.

### CLI Invocation & Flags
LifeOS callers pass combinations of:
- **Execution mode & model:** `-p` / `--print`, `--model` / `-m`, `--effort`
- **Formats & verbosity:** `--output-format <json|text|stream-json>`, `--input-format <stream-json>`, `--verbose`, `--replay-user-messages`, `--include-partial-messages`
- **Tool controls:** `--tools`, `--allowedTools` / `--allowed-tools`, `--disallowedTools` / `--disallowed-tools`, `--add-dir`
- **Prompts:** `--system-prompt`, `--system-prompt-file`, `--append-system-prompt`, `--append-system-prompt-file`, `--system-prompt-snapshot`, `--exclude-dynamic-system-prompt-sections`
- **Isolation & session controls:** `--safe-mode`, `--strict-mcp-config`, `--mcp-config`, `--settings`, `--setting-sources`, `--no-session`, `--no-session-persistence`, `--restricted`, `--permission-mode`, `--session-id`, `--resume` / `-r`, `--continue` / `-c`
- **Metadata:** `-v` / `--version`, `-h` / `--help`

### Prompt & Stdin Contract
- Accepts prompts from `stdin`, positional CLI arguments, or both (`stdin + "\n\n" + positional`).
- Handles closed or empty `stdin` without hanging (`not sys.stdin.isatty()`).
- Preserves leading-slash prompts rewritten by callers (`User message: /...` in `Inference.ts`, `Job instructions: /...` in `AgentJob.ts`).
- When `--input-format stream-json` is set, reads NDJSON `user` message events carrying text blocks (or plain string content) and inline base64 `image` blocks (`image/png`, `image/jpeg`, `image/gif`, `image/webp` up to `3,750,000` raw bytes in `Inference.ts`).

### Output & Schema Contracts
- **`--output-format text`**:
  - Success: plain assistant text on `stdout`, exit `0`.
  - Failure: error message on `stderr`, exit `1`.
- **`--output-format json`** (default):
  - Success (`stdout`, exit `0`):
    ```json
    {
      "type": "result",
      "subtype": "success",
      "is_error": false,
      "result": "<assistant text>",
      "stop_reason": "end_turn",
      "usage": {
        "input_tokens": 210,
        "cache_read_input_tokens": 0,
        "cache_creation_input_tokens": 0,
        "output_tokens": 22
      },
      "modelUsage": {
        "llama.cpp/qwen3.8-flash-next": {
          "inputTokens": 210,
          "cacheReadInputTokens": 0,
          "cacheCreationInputTokens": 0,
          "outputTokens": 22
        }
      }
    }
    ```
  - Field requirements:
    - `result` (`string`) and `is_error` (`boolean`) are mandatory for `AgentJob.ts` (`interpretClaudeRun`) and `Inference.ts`.
    - `stop_reason` is inspected for `"refusal"` by `Inference.ts`.
    - `usage` keeps fresh `input_tokens` separate from `cache_read_input_tokens` and `cache_creation_input_tokens` because `claudeEnvelopeUsage()` sums all three.
    - `modelUsage` maps `<provider>/<model>` to `{ inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens }` for `verifyExecutedModel()` and `claudeEnvelopeUsage()`.
  - Failure (`stdout`, exit `1`):
    ```json
    {
      "type": "error",
      "is_error": true,
      "api_error_status": 500,
      "result": "<error message>",
      "error": "<error message>"
    }
    ```
- **`--output-format stream-json`**:
  - Emits strict single-line NDJSON objects with zero malformed lines (required by `BillingPathAssertion.ts` and `RELAY/bridge/progress.ts`):
    1. `{"type": "system", "subtype": "init", "session_id": "<uuid4>", "model": "<model>", "apiKeySource": "none"}` (`apiKeySource: "none"` signals non-API-key local/OAuth path to `BillingPathAssertion.ts`).
    2. `{"type": "assistant", "message": {"role": "assistant", "model": "<model>", "content": [{"type": "text", "text": "<assistant text>"}]}}` (omitted on error).
    3. Final `type: "result"` envelope line carrying the same fields as `--output-format json` (or `{"type": "result", "subtype": "error_during_execution", "is_error": true, "api_error_status": 500, "result": "<err>", "error": "<err>"}` on failure, exit `1`).
- **`--version` / `-v`**:
  - Outputs `1.0.0 (claude-shim omp backend)`.
  - First whitespace-delimited token (`1.0.0`) satisfies `STATUSLINE/producers/Versions.ts`, and the semver substring satisfies `TOOLS/lifeos.ts` (`getCurrentVersion()`).

### Process & Signal Contract
- Forwards `SIGTERM` and `SIGINT` directly to the child `omp` process (terminating with a 2s `SIGKILL` fallback) so `omp` never survives as an orphan holding `stdout`/`stderr` pipes open against `PULSE/lib.ts`'s `collectProc()` pipe-drain deadline.

---

## 3. LifeOS Callers (`~/.omp/LIFEOS/`, `~/.omp/hooks/`, `~/.omp/skills/`)

### Direct `claude` CLI Callers

| Caller | Entry / Function | Flags & Stdin | Output / Notes |
|---|---|---|---|
| `LIFEOS/TOOLS/Inference.ts` | `inferenceAttempt()` | `--print --model <m> --effort <e>`, `--tools ''` or `--allowedTools Read --add-dir ...`, `--output-format json` or `--input-format stream-json --output-format stream-json --verbose`, `--exclude-dynamic-system-prompt-sections`, `--safe-mode`, `--strict-mcp-config`, `--settings '{"verbose":false}'`, `--no-session-persistence`, `--system-prompt` / `--system-prompt-file` (>100 KB on Unix); leading-`/` escaped as `User message: ` | Parses final JSON / `type:"result"` line, checks `is_error`, `stop_reason`, `modelUsage`, `usage`. |
| `LIFEOS/PULSE/lib.ts` | `spawnClaude()` (called by `PULSE/pulse.ts`, `PULSE/run-job.ts`, `PULSE/pulse-old.ts`) | `--print --model <m> --tools "" --output-format text --safe-mode --system-prompt ""` + stdin | Trimmed `stdout` text, exit `0`, bounded by `collectProc()`. |
| `LIFEOS/PULSE/checks/github-work.ts` | `executeWork()` | `--print --model sonnet --tools "" --output-format text --safe-mode --system-prompt ""` + stdin | Trimmed `stdout` text, exit `0`. |
| `LIFEOS/TOOLS/AgentJob.ts` | `runDa()` | `--print --model <tier> --output-format json --setting-sources user`, `--allowedTools ...` or `--restricted --tools ... --permission-mode dontAsk --add-dir ... --disallowedTools ...`, `--append-system-prompt <JOB_SOUL>` + stdin | `interpretClaudeRun()` requires exit `0`, JSON object with `typeof result === "string"` and `typeof is_error === "boolean"`. |
| `LIFEOS/TOOLS/CarrierProbe.ts` | `runChild()` | `--print --model sonnet --allowedTools Task,Agent --output-format json --safe-mode --system-prompt "..."` + stdin | Reads JSON envelope (`session_id`, `modelUsage`, `result`). |
| `LIFEOS/RELAY/bridge/session.ts` | `askDA()` | `--print --output-format stream-json --verbose`, optional `--input-format stream-json --replay-user-messages`, `--allowedTools`, `--append-system-prompt`, `--resume` / `--session-id` | Reads NDJSON `system/init`, `assistant`, and `result` lines via `progress.ts`. **Shim limit:** `omp` runs single-shot (`--no-session`), so `--resume`, `--session-id`, and open-stdin mid-turn steering are not persistent across invocations. |
| `LIFEOS/STATUSLINE/producers/Versions.ts` | `liveCli()` | `claude --version` | First whitespace token on line 1. |
| `LIFEOS/TOOLS/lifeos.ts` | `getCurrentVersion()` | `claude --version` | Semver match `[0-9]+\.[0-9]+\.[0-9]+`. |

*Non-CLI exception:* `LIFEOS/PULSE/modules/siri.ts` imports `query()` from `@anthropic-ai/claude-agent-sdk` directly rather than spawning the `claude` CLI binary.

### Transitive Callers via `LIFEOS/TOOLS/Inference.ts`

- **Pulse modules & jobs:** `PULSE/modules/algorithm-tab.ts`, `PULSE/modules/atlas.ts`, `PULSE/Conduit/BuildInsight.ts`
- **Hooks (`~/.omp/hooks/`):** `MicroIntegrity.hook.ts`, `PromptProcessing.hook.ts` (uses `Inference.ts` standalone or HookBridge `model-run` when armed), `handlers/DocCrossRefIntegrity.ts` (opt-in via `DOCINTEGRITY_INFERENCE=1`)
- **Core tools (`LIFEOS/TOOLS/`):** `MemoryReviewer.ts`, `CoachReview.ts`, `FailureCapture.ts`, `IntegrityMaintenance.ts`, `CommitmentDetect.ts`, `HarvestExecutor.ts`, `WeekProposals.ts`, `KnowledgeDistill.ts`, `HarnessConformance.ts`
- **Evaluation, errata, & skills (`LIFEOS/ASSAY/`, `LIFEOS/ERRATA/`, `LIFEOS/IDEALSTATE/`, `~/.omp/skills/`):**
  - `ASSAY/Chain.ts`, `ASSAY/EngineJudge.ts`, `ASSAY/JudgeCall.ts`, `ASSAY/QuestionSystem.ts`, `ASSAY/UseCaseBakeoff.ts`
  - `ERRATA/Audit.ts`, `ERRATA/ClassTier.ts`, `ERRATA/Enrich.ts`, `ERRATA/Recommend.ts`
  - `IDEALSTATE/Recommend.ts`, `IDEALSTATE/Wants.ts`
  - `skills/Assay/Tools/{AnthropicVision,Compile,EvalRunner,IntentRubric,Judge,Proof}.ts`
  - `skills/ArtDirection/Tools/Critique.ts`

---

## 4. Shim Mechanics & Translation Rules

### Flag Handling
- **Mapped flags:**
  - `-p`, `--print` → `omp -p` (always set)
  - `--model`, `-m` → parsed and ignored; `$LIFEOS_TOOLS_MODEL_NAME` (`llama.cpp/qwen3.8-flash-next`) always wins
  - `--effort` → mapped via `EFFORT_MAP` (`$LIFEOS_TOOLS_MODEL_EFFORT` takes precedence)
  - `--output-format` → selects `json` (default), `text`, or `stream-json` envelope emission (`omp` always runs with `--mode=json`)
  - `--input-format` → `stream-json` parses NDJSON user turns and extracts inline base64 images
  - `--system-prompt`, `--system-prompt-file` → `omp --system-prompt=<value-or-path>`
  - `--append-system-prompt`, `--append-system-prompt-file` → `omp --append-system-prompt=<value-or-path>`
  - `--tools`, `--allowedTools`, `--allowed-tools`, `--disallowedTools`, `--disallowed-tools` → `omp --tools=<csv>` or `--no-tools`
- **Accepted & ignored compatibility flags:** `--setting-sources`, `--session-id`, `--session`, `-s`, `--resume`, `-r`, `--cwd`, `-C`, `--add-dir`, `--project`, `-d`, `--config-dir`, `--permission-mode`, `--timeout`, `--max-tokens`, `--max-turns`, `--temperature`, `--profile`, `--mcp-config`, `--api-key`, `--agent`, `--agent-type`, `--settings`, `--fallback-model`, `--json-schema`, `--system-prompt-snapshot`, `--max-budget-usd`, `--exclude-dynamic-system-prompt-sections`, `--dangerously-skip-permissions`, `--allow-dangerously-skip-permissions`, `--continue`, `-c`, `--fork-session`, `--no-session`, `--no-session-persistence`, `--verbose`, `--debug`, `--strict`, `--strict-mcp-config`, `--safe-mode`, `--restricted`, `--replay-user-messages`, `--include-partial-messages`.
- **Unknown-flag lookahead heuristic:** Unrecognized `--foo=bar` flags are discarded. Unrecognized `-x` / `--foo` flags followed by a non-flag argument consume that value when either more than 2 tokens remain (`remaining > 2`) or `stdin` is piped; otherwise the trailing token is preserved as the positional user prompt. `--` stops option parsing and keeps all remaining arguments as positional prompt tokens.

### Effort Mapping (`EFFORT_MAP`)
`$LIFEOS_TOOLS_MODEL_EFFORT` overrides `--effort`, defaulting to `high`:
- `off`, `none`, `0` → `off`
- `minimal`, `min` → `minimal`
- `low` → `low`
- `medium`, `med` → `medium`
- `high` → `high`
- `xhigh` → `xhigh`
- `max`, `highest` → `max`
- `auto` → `auto`
- Unrecognized values fall back to `high`.

### Tool Allowlist Mapping
If neither `--tools` nor `--allowedTools` is supplied, or `--tools` is empty (`""`, `"''"`, `'""'`, `"none"`), `omp` receives `--no-tools`. Otherwise tokens are split at parenthesis depth 0 (preserving `Bash(bun ...)` arguments), stripped of `(rule)` filters, deduplicated, and mapped via `TOOL_NAME_MAP`:

| Claude Tool | `omp` Tool |
|---|---|
| `Read`, `LS`, `WebFetch` | `read` |
| `Bash` | `bash` |
| `Edit`, `MultiEdit` | `edit` |
| `Write` | `write` |
| `Glob` | `glob` |
| `Grep` | `grep` |
| `WebSearch` | `web_search` |
| `Task`, `Agent` | `task` |
| `TodoWrite`, `Todo` | `todo` |
| `NotebookEdit` | `notebook` |
| `AskUserQuestion` | `ask` |

Bare tool names in `--disallowedTools` (without a `(rule)` suffix) remove the mapped `omp` tool; rule-scoped denials such as `Bash(bun ... send:*)` do not strip `bash`. If no tokens map to an `omp` tool, `--no-tools` is passed.

### System Prompt & `E2BIG` Prevention
- `omp` treats `--system-prompt=""` as falsy and falls back to its ~2,047-token default coding-assistant harness prompt. When a caller explicitly passes `--system-prompt ""` (such as `PULSE/lib.ts`) or an empty `--system-prompt-file`, the shim passes `--system-prompt=Follow the user prompt.` (~202 input tokens via `custom-system-prompt.md`) to eliminate coding-assistant bias and ~1,845 tokens of prompt overhead per call.
- When `--system-prompt` is omitted (e.g. `AgentJob.ts` passing only `--append-system-prompt`), `--system-prompt` is omitted so `omp` retains its base system prompt + `--append-system-prompt`.
- Because `omp --system-prompt=<path>` and `--append-system-prompt=<path>` read files natively when given a filesystem path, prompts exceeding 64 KiB (either from `--system-prompt-file` or spilled from large inline arguments) ride a `0600` file path rather than exceeding Linux `MAX_ARG_STRLEN` (`E2BIG`).

### `omp` Isolation Flags
Every `omp` child runs with:
```
omp -p --no-session --no-skills --no-rules --no-title --no-extensions --no-context-files --profile=isolated --mode=json
```
This prevents session disk persistence, skill/rule injection, automatic title generation, user extension loading, and workspace `AGENTS.md`/`CLAUDE.md` discovery from polluting utility inference calls.

Isolation is what silences LifeOS's hooks in these runs: the hook bridge is an omp **extension** (`~/.omp/agent/extensions/OmpHooksBridge.ts`), and both `--no-extensions` and `--profile=isolated` (its own config root, which has no extensions) drop it. Measured on this host: a bare `omp -p` logs `bridge_init hooks:60`; every shim-routed call logs nothing at all — ~357 calls/day with zero hook records, so Pulse and STATVS see only interactive sessions.

### Hook Bridge Opt-In (`LIFEOS_BRIDGE`)
- **Gate:** a caller sets `LIFEOS_BRIDGE=1` (also `true|yes|on`) in the environment of its `claude` spawn. The shim then appends `-e <bridge>` to the child command — `omp` honors an explicit `-e` even with `--no-extensions`, and `--profile=isolated` does not block it, because the bridge resolves its own config root (`~/.claude`).
- **Path:** `$LIFEOS_BRIDGE_EXTENSION`, defaulting to `~/.omp/agent/extensions/OmpHooksBridge.ts`. A missing file degrades to an isolated run; it never fails the call.
- **Non-recursive.** The gate is stripped from the child environment (`child_environment` pops `LIFEOS_BRIDGE`/`LIFEOS_BRIDGE_EXTENSION`). Inference hooks spawn `claude` again; an inherited gate loads the bridge in every nested child — measured 85 `SessionStart` + 72 `Stop` dispatches across ~85 processes for one prompt, which piled up the local inference queue. One bridged run per caller opt-in; everything it spawns stays isolated.
- **Default off.** Judges, Pulse text jobs and Relay calls pay no hook cost. Gate the callers that produce durable work — `AgentJob.ts`, `HarvestExecutor.ts`, `MemoryReviewer.ts` — not the hot path.
- **Cost:** measured +4.6 s on a one-shot call (1.94 s → 6.58 s) with all registrations loaded; blanket enablement is unusable, which is why the gate is per spawn.

### Session Identity (`OMP_SESSION_ID`)
Claude Code gives every run a session id and LifeOS hooks key their state files on it. The shim mints `uuid4` per child and exports `OMP_SESSION_ID`; the bridge reads it (falling back to `"omp"` for interactive sessions, which have no shim). Without this every headless run wrote into `STATE/*/unknown.json`, where parallel runs overwrote each other and records were unattributable.

### Inline Image Translation (`stream-json`)
When `--input-format stream-json` is active:
1. Each non-empty JSONL line on `stdin` is parsed; `user` messages (`type == "user"` or `message.role == "user"`) extract text blocks (`type == "text"` or string content) and base64 image blocks (`type == "image"`, `source.type == "base64"` for `image/png`, `image/jpeg`, `image/gif`, `image/webp`).
2. Decoded image bytes are written to `0600` files inside a temporary directory (`TemporaryDirectory`) and passed to `omp` as `@<path>` arguments, while text flows through `omp` `stdin`.
3. Temporary files are removed in `finally` on completion or signal termination.

### Event Parsing & Token Accounting
`omp --mode=json` emits `message_end`, `turn_end`, and `agent_end` events containing usage payloads for the same turns. To avoid double- or triple-counting across multi-turn tool runs while preserving all turns' token counts:
- Token totals (`input`, `cacheRead`, `cacheWrite`, `output`) are summed across `message_end` events with `role == "assistant"`.
- `turn_end` and `agent_end` serve only as fallbacks when no `message_end` assistant event was emitted.
- Assistant text and `stopReason` track the latest assistant `message_end` containing text (or error stop reason). `stopReason` maps `"stop" -> "end_turn"`, `"length" -> "max_tokens"`, `"toolUse" -> "tool_use"`, `"error" -> "error"`, `"aborted" -> "aborted"`.

### `model-verification.jsonl` Audit Behavior
`Inference.ts`'s `verifyExecutedModel()` compares the model reported in `modelUsage` (`llama.cpp/qwen3.8-flash-next`) against the requested Claude tier (`haiku`, `sonnet`, `opus`, `fable`). Because `llama.cpp/qwen3.8-flash-next` does not match those substrings, `Inference.ts` logs `downgraded: true` to `MEMORY/OBSERVABILITY/model-verification.jsonl` with `executed: "llama.cpp/qwen3.8-flash-next"`. This is expected and provides an explicit audit trail proving local inference executed instead of upstream cloud models.
