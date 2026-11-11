---
version: 1.0.1
---

# OmpHooksBridge — LifeOS hooks in omp (Oh My Pi)

> The LifeOS hook layer runs on the Claude Code hook contract (`${LIFEOS_DIR}/settings.json`: JSON on stdin, JSON on stdout). omp does not execute that contract. `OmpHooksBridge.ts` is an omp extension that shims it onto the omp event bus, so LifeOS's enforcement layer — observability, memory capture, gates, permission guards — runs in every harness, not just Claude Code. This directly serves LifeOS's harness-agnostic design goal ("it's designed to run wherever your AI does").

## How it works

| omp event | Claude Code event | Effect |
|---|---|---|
| `session_start` | `SessionStart` | startup maintenance hooks |
| `message_start` (role=user) | `UserPromptSubmit` | prompt-side hooks, with the **real** submitted text — `turn_start` is payload-less, so it only logs. Repeats of identical text are skipped: omp re-emits the pending user message on every turn of a tool loop. |
| `tool_call` | `PreToolUse` | `permissionDecision: deny` → tool blocked; `ask` → UI confirm (fail-closed headless) |
| `tool_result` | `PostToolUse` | result-side hooks (isError → `PostToolUseFailure`) |
| `turn_end` | `Stop` | per-turn stop hooks |
| `session_shutdown` | `SessionEnd` | end-of-session maintenance |
| `tool_approval_requested` | `PermissionRequest` **+** `Notification` | one approval prompt is both events in Claude Code's contract: the tab stamp (`TabState`) and `notification_type:"permission_prompt"` (the only shape `BlockerText` accepts). `tool_input` has no field in `ToolApprovalRequestedEvent`, so `permissionDetail()` falls back to the tool name. |
| *(synthesized)* | `StopFailure` | emitted when a mapped `Stop` hook exits non-zero, carrying `error: "<hook> (exit N): <first stderr line>"`. omp emits no such event; the v8 consumers are `EventLogger` and TabState's ❌ stamp. Guarded on the observed failure — a clean Stop never fires it. |
| — | ✗ `ConfigChange` | **no source.** The extension event union (`packages/coding-agent/src/extensibility/extensions/types.ts`) has no settings-change event; `mode_changed` is a harness mode switch, not a config edit. Left unmapped on purpose. |

Hooks are invoked exactly as Claude Code invokes them: `sh -c <command>` with the Claude Code JSON payload on stdin. The registry (event → matcher → command) is read live from `${LIFEOS_DIR}/settings.json`, so there is no duplicated configuration.

**Context injection.** Any `additionalContext` a hook returns (e.g. `<lifeos-memory-delta>`, rule updates) is queued and injected as a system message before the next LLM call via the `context` event — the omp equivalent of Claude Code's implicit injection.

**Voice.** The `VoiceCompletion` hook requires a Claude transcript, which omp doesn't produce, so the bridge adds an omp-native voice path: at `turn_end` it reads the turn's own final assistant message and extracts the final `🗣️ <DA>:` closer (angle brackets optional — both `🗣️ <ZEN>:` and `🗣️ ZEN:` are accepted), and speaks it through Pulse's `/notify` (ElevenLabs). Same semantics as Claude Code — no `🗣️` line means silence. Disable with `OMP_VOICE=0`; override the voice id with `OMP_VOICE_ID`.

**Safety.** A hook returning `deny` blocks the tool. `ask` shows a UI confirm; headless runs fail closed (deny). Hook failures are logged, never crash the session. Per-hook timeout 30s. **A non-zero exit is a failure:** `ok` follows the process exit code and every result carries `exit`. It used to mean "not a timeout", so any hook that exited 1 logged `ok:true` — the audit trail said all was well while stop gates silently stopped running, and no synthesized `StopFailure` could ever fire. (2026-11-11)

## Install

```bash
mkdir -p ~/.omp/agent/extensions
cp OmpHooksBridge.ts ~/.omp/agent/extensions/
```

Restart omp — the extension auto-loads in every new session (user-level extension discovery from `~/.omp/agent/extensions`). Alternatively pass it explicitly: `omp --hook /path/to/OmpHooksBridge.ts`.

Configuration:

- `LIFEOS_CONFIG_ROOT` — harness settings root holding the merged hook registry (default `~/.claude`)
- `LIFEOS_DIR` — payload dir (`~/.claude/LIFEOS`); legacy settings location only, never the config root
- `OMP_BRIDGE_SETTINGS` — pins the registry file explicitly. Pass `/dev/null`, `none`, or `off` to **completely disable the bridge** (registers zero event handlers, skips voice/transcript mirroring, and leaves `tools.speculativeExecution` unlocked for benchmarks or non-LifeOS runs).
- `OMP_SESSION_ID` — the run's Claude-shaped session id, exported per child by `bin/claude-shim.py` (uuid4). Every dispatch payload carries it, so hook state files (`STATE/isa-nudge/<id>.json`, `memory-inject/<id>.queue.json`…) are attributable and parallel runs stop overwriting one file. Interactive sessions have no shim and keep the historical `"omp"` key.
- Audit logging is off by default. `OMP_BRIDGE_STDERR=1` writes every line to stderr prefixed `lifeos-bridge` (captured by the sidecar unit's journal: `journalctl --user -u omp.service | grep lifeos-bridge`). `OMP_BRIDGE_LOG=<path>` appends JSON lines to a file for probes and tailing.

## Loading in headless runs

Shim-routed inference (`claude` → `omp`) runs isolated, where neither extension discovery nor the profile's config root offers this bridge — so those calls fire no hooks at all. A caller opts its run in with `LIFEOS_BRIDGE=1`; the shim appends `-e <this file>` (honored even under `--no-extensions` and `--profile=isolated`). Gate is per spawn, default off: judges and Pulse text jobs keep paying nothing. Mechanics and measured cost: `bin/claude-shim.md` § Hook Bridge Opt-In.

## Verification evidence

Headless run (`omp -p --auto-approve "run: echo bridge-test"`, DeepSeek v4 flash via Ollama). Audit log (`${OMP_BRIDGE_LOG}`):

```
{"event":"bridge_init","hooks":76,"lifeosDir":"${LIFEOS_DIR}"}
{"hook":"HookHealer.hook.ts","cc":"SessionStart","ok":true,"ms":15}
{"hook":"LoadContext.hook.ts","cc":"SessionStart","ok":true,"ms":34}
{"hook":"PromptProcessing.hook.ts","cc":"UserPromptSubmit","ok":true,"ms":1593}
{"hook":"DriftReminder.hook.ts","cc":"UserPromptSubmit","ok":true,"context":true}
{"event":"tool_call","tool":"bash"}
{"hook":"ContextReduction.hook.sh","cc":"PreToolUse","tool":"bash","ok":true,"ms":5}
{"hook":"PreToolGuard.hook.ts","cc":"PreToolUse","tool":"bash","ok":true,"ms":23}
{"hook":"EventLogger.hook.ts","cc":"PostToolUse","tool":"bash","ok":true,"ms":32}
{"hook":"AtlasEventCapture.hook.ts","cc":"PostToolUse","tool":"bash","ok":true,"ms":13}
{"event":"context_inject","chars":118}
{"event":"session_shutdown"}
```

Observability proof — LifeOS `tool-activity.jsonl` gains a real entry written by the EventLogger hook from inside the omp session:

```json
{"event":"tool_use","tool_name":"Bash","tool_input_preview":"{\"command\":\"echo bridge-test\"}","ground_truth":{"command":"echo bridge-test"}}
```

Per-event hook execution in the same run: SessionStart 5 · UserPromptSubmit 24 · PreToolUse 2 · PostToolUse 4 · Stop 16 · SessionEnd 6. Zero hook crashes.

## Known limitations

- `transcript_path` is filled for **Stop and SessionEnd** dispatches: the bridge converts the live session branch (`ctx.sessionManager.getBranch()`) into Claude-format JSONL via `branchToTranscriptLines()` and writes a per-session mirror to `$TMPDIR/lifeos-bridge-transcripts/<sessionId>.jsonl`, so the transcript-evidence gates (IsaDeployMarkerGate, ISAFoldGate, DeployRegistrationGate…) judge real evidence instead of failing open. Tool names are mapped through `TOOL_UP` in the mirror because the gate readers match Claude names. Other events (PreToolUse/UserPromptSubmit) still receive an empty path — hooks parsing the transcript there degrade gracefully; extending the mirror to them is a per-tool-call file rewrite and intentionally not done.
- The voice line is handled by the omp-native path instead of `VoiceCompletion` (see Voice above); the mirror does not change that.
- UserPromptSubmit carries the **real** submitted text: omp's `turn_start` event is payload-less (`{ type: "turn_start" }` in `agent/src/types.ts`), so the bridge dispatches on `message_start` with `role === "user"` and reads the content there. One submission per prompt; assistant and toolResult messages are ignored. The placeholder shipped for two months, during which PromptProcessing judged a constant string.
- Hooks run sequentially; heavy prompt-side hooks (inference) add ~1–2s per turn. **In a gated headless run this compounds:** `PromptProcessing.hook.ts` calls `Inference.ts`, which spawns `claude` → the shim → another isolated `omp`; measured on 2026-11-10 that path hit its 30 s hook timeout (`ok:false`) inside one 53-char prompt. Gate only callers whose work justifies it, and expect to exclude inference-heavy registrations from headless runs — the interactive session is where those hooks belong.
- The bridge must not be loaded into an already-loaded session expecting new behavior: extension load happens at startup, and a live interactive session that loads the full registry can balloon (observed `Extension "…/OmpHooksBridge.ts" error: handler timed out after 30000ms` in `prompt-processing.jsonl`). Keep it disabled there; use the per-run gate.
- Changes take effect from the next session start.
