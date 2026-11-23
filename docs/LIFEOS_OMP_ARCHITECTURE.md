# LifeOS on Oh-My-Pi (`omp`) — Architecture, Hooks Bridge & `claude-shim`

Authoritative reference on how **LifeOS** runs on **Oh-My-Pi (`omp` 19.1.1+)** instead of Claude Code: what `OmpHooksBridge.ts` shims, how `bin/claude-shim.py` keeps headless inference local, guard enforcement, web verification, and the complete `18.20 → 19.1.1` harness-delta record.

---

## 1. Conceptual Model & Hook Registry Merge

- **Claude Code** natively reads `${CLAUDE_CONFIG_DIR}/settings.json`, executes hook commands (JSON stdin → JSON stdout), enforces permission rules, and writes a JSONL transcript.
- **`omp`** has no Claude Code code path. `~/.claude → ~/.omp` is a symlink so stock paths resolve and `DetectEnv` stays on the Claude Code registry path. [`omp/agent/extensions/OmpHooksBridge.ts`](../omp/agent/extensions/OmpHooksBridge.ts) subscribes to the `omp` extension event bus and invokes each registered hook command (`sh -c <command>`) concurrently with Claude-shaped JSON payloads and per-hook `timeout` caps (30 s fallback).
- **Layered merge (`MergeSettings.ts`):** Live `~/.claude/settings.json` is `settings.system.json` (v8-managed, rewritten by `InstallAll`) ⊕ `LIFEOS/USER/CONFIG/settings.user.json`. `hooks`, `statusLine`, `spinnerVerbs`, and `spinnerTipsOverride` are **installer-owned keys**: a plain array under `.hooks` replaces sibling arrays wholesale. Always add personal hooks at the user layer as `{ "__merge": "append", "values": [...] }`.

---

## 2. `OmpHooksBridge.ts` Event Map & Mechanics

| Claude Code Event | `omp` Source Event | Fidelity & Behavior |
| :--- | :--- | :--- |
| `SessionStart` | `session_start` | Full; arms the 120 s in-sandbox `SessionTree.ts` reaper loop. |
| `UserPromptSubmit` | `message_start` (`role=user`) | Full; real submitted prompt text, identical-text re-emissions deduped, `session_clear` resets dedup + mirror state, live `transcript_path`. |
| `PreToolUse` | `tool_call` | Full; concurrent dispatch, `deny` wins over `ask`, `ask` → UI confirm (fail-closed headless), live `transcript_path`. |
| `PostToolUse` / `PostToolUseFailure` | `tool_result` (`isError`) | Full; live `transcript_path`. |
| `Stop` | `turn_end` | Full; live `transcript_path` for transcript-evidence gates & `VoiceCompletion.hook.ts` (`OMP_VOICE=0` drops voice hook). |
| `SessionEnd` | `session_shutdown` | Full; final `transcript_path`. |
| `PermissionRequest` | `tool_approval_requested` | Tab stamp (`TabState`). `tool_input` has no field in `ToolApprovalRequestedEvent` (falls back to tool name). |
| `Notification(permission_prompt)` | **Suppressed (Fix A)** | `omp >= 18.20` natively reports dialogs as `blocked`; suppressing avoids double-stamping. |
| `StopFailure` | Synthesized on non-zero `Stop` exit | Extra vs. upstream; drives `EventLogger` and `TabState` ❌ stamp. |
| `ConfigChange` | **None (accepted gap)** | `omp` has no settings-change extension event (`mode_changed` is harness mode only). |

### Key Bridge Features (Updated 2026-11-23)
- **Incremental append-only transcript mirror:** `syncTranscriptMirror()` converts `ctx.sessionManager.getBranch()` into Claude Code JSONL (`toolCall` → `tool_use` with `TOOL_UP` PascalCase mapping; `toolResult` → `user` `tool_result` paired by `tool_use_id`) under `~/.claude/lifeos-bridge-transcripts/<sid>.jsonl` (shared across sandboxes via `~/.claude → ~/.omp`, overridable with `OMP_BRIDGE_TRANSCRIPT_DIR`; never `/tmp`, which is sandbox-private). Growing branches append only new entries in O(delta); `/rewind`, `/clear`, or branch switches trigger a clean rewrite. Every event (`UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `SessionEnd`) now receives a valid `transcript_path`.
- **Per-session `session_id` resolution:** Headless `claude-shim.py` runs export a fresh uuid4 via `OMP_SESSION_ID`. Interactive `omp` sessions resolve their live `ctx.sessionManager.getSessionId()` (isolating parallel interactive terminals while preserving state across `omp --resume`), falling back to `"omp"` only when neither is available.
- **Context injection:** Hook `additionalContext` is queued and injected as a system message via `pi.on("context")` before the next model call.
- **Zero-context session stats rows:** Emits a registry-load row and per-turn counter row (`tools/blocked/ctx/voice`) via `pi.sendMessage(..., { excludeFromContext: true })` (zero model context cost on `omp >= 19.0.0`). Hidden by default; toggle with `/bridge-stats on|off` or start visible via `OMP_BRIDGE_STATS=1`.
- **In-sandbox `SessionTree.ts` reaper:** Runs every 120 s via `ctx.setInterval`, feeding `ctx.getAsyncJobSnapshot()` to `LIFEOS/TOOLS/SessionTree.ts snapshot` so `PI_SESSION_ID`-tagged work processes are reaped inside the owning sandbox and `MEMORY/STATE/session-tree/<id>.json` stays fresh for Vigil.
- **Config & logging env vars:**
  - `LIFEOS_CONFIG_ROOT` (default `~/.claude`), `LIFEOS_DIR` (payload `~/.claude/LIFEOS`), `OMP_BRIDGE_SETTINGS` (pass `/dev/null`, `none`, or `off` to disable completely).
  - Audit logs are silent by default (clean TUI): `OMP_BRIDGE_STDERR=1` for journald capture, `OMP_BRIDGE_LOG=<path>` for JSONL file logging.
- **Verification:** `make bridge-test` (21 hermetic Bun unit tests in `omp/agent/extensions/tests/OmpHooksBridge.test.ts`) and `make bridge-smoke`.

---

## 3. `claude-shim` (`bin/claude-shim.py`)

Installed to `~/.local/bin/claude` by `omp.env`. Intercepts every headless `claude` subprocess spawned by LifeOS (`Inference.ts`, `PULSE/lib.ts`, `AgentJob.ts`, `HarvestExecutor.ts`, `MemoryReviewer.ts`, `RELAY/bridge/session.ts`) and routes it to `omp -p --mode=json --profile=isolated --no-session`:

- **Data-safety invariant:** Ignores `--model`/`-m` tier names (`haiku`, `sonnet`, `opus`, `fable`, `claude-*`) and forces `$LIFEOS_TOOLS_MODEL_NAME` (`llama.cpp/qwen3.8-flash-next` via `local-router` `:21080`). Compatible with LifeOS's Anthropic credential scrubbing — zero cloud billing or personal-context leakage.
- **Contracts supported:** `--output-format <json|text|stream-json>`, `--input-format <text|stream-json>` (including inline base64 image blocks), `--version` (`1.0.0 (claude-shim omp backend)`), `SIGTERM`/`SIGINT` forwarding with 2 s `SIGKILL` fallback.
- **Bridge opt-in (`LIFEOS_BRIDGE=1`):** Isolated shim calls run with the hooks bridge **off** by default (so judges and Pulse text jobs pay zero hook overhead). Durable-work callers (`AgentJob`, `HarvestExecutor`, `MemoryReviewer`) opt in with `LIFEOS_BRIDGE=1`, which appends `-e ~/.omp/agent/extensions/OmpHooksBridge.ts` and exports a per-child uuid4 `OMP_SESSION_ID`.
- **`omp 19.1.0` RPC `ask` change:** Unaffected because `claude-shim.py` uses `--mode=json`, not `--mode=rpc`.

---

## 4. Guard Enforcement & Web Verification

### Guard Enforcement Map
- **Enforced:** `omp` built-in critical-command refusals (`CRITICAL_BASH_PATTERNS`), `bashInterceptor.patterns` (8 tool-redirect regexes in `omp/agent/config.yml`), `edit.enforceSeenLines`, `secrets.enabled` SIMD redaction, `PreToolUse` hooks via `OmpHooksBridge`, and [`omp/agent/extensions/LoopGuard.ts`](../omp/agent/extensions/LoopGuard.ts) (a-b-a-b oscillation, failure hammering ≥5/8 with ≥3 failed, non-consecutive exact repeats; `wait` exempt).
- **Intentionally absent:** Claude Code's 167 allow / 86 deny rules in `settings.json` are decorative; `bash.patterns` approval globs were deliberately removed (2026-11-16, too many false positives); `tools.restrictedFolders` stays unset by decision.
- **Rule-only (no Stop block):** `omp`'s `turn_end` cannot block turn completion, so `IsaCodeSyncGate` and `VerificationGate` stay retired from `StopGates.hook.ts` v1.3.2 (parked native alternative: advisor + `.omp/WATCHDOG.md`).
- **Bypass to remember:** Pushes via the `github` tool command use `omp`'s VCS layer, not `bash`.

### Web Verification (Interceptor Replacement)
Stock LifeOS's macOS-only **Interceptor** is replaced by:
1. **`omp` internal `browser` tool** (`eval` `browser` namespace / `browser` tool command) — full DOM, interaction, console/network, `screenshot()`, `diffScreenshot()`, `pdf()`, and device emulation.
2. **Chrome Native Messaging Host (`omp 19.1.0+`)** — `omp browser-relay install` writes `~/.omp/browser-relay/extension/` + Chrome `NativeMessagingHosts` manifests and auto-syncs in place on upgrades, giving turnkey logged-in real-Chrome tab control on Linux. Our Arch package (`oh-my-pi-git`) externalizes the zstd extension bundle to `/usr/share/oh-my-pi/browser-relay-extension.json.zst` (out of the `omp` binary) via `external-relay-extension-for-aur.patch`.

---

## 5. Remaining Accepted Gaps & Future Opportunities

- **Accepted gaps:** (1) `ConfigChange` has no `omp` event; (2) `Stop` cannot block turns; (3) `PermissionRequest` lacks `tool_input` (`ToolApprovalRequestedEvent` omits it).
- **Closed on 2026-11-23:** Mid-turn `transcript_path` (now incremental append-only in `OmpHooksBridge.ts`) and interactive `"omp"` session-key collisions (now resolved from `ctx.sessionManager.getSessionId()`).
- **Low-effort future wins (`omp 19.1.1+`):** Subscribe `OmpHooksBridge` to `tool_approval_resolved` for immediate ⏳/BlockerText clearing on deny/Esc; optionally register a Pulse live-checklist mirror via `pi.registerTodoBackend()`.

---

## 6. Harness Upgrade History (`18.20 → 19.1.1`)

- **`18.20.2` (2026-11-16):** Added `session_clear` dedup reset; switched bridge `dispatch()` from serial to concurrent with per-hook timeouts (wall 16.6 s → 8.4 s, Stop 2.8 s → 0.5 s); suppressed duplicate `Notification(permission_prompt)` (Fix A); added `BlockerText` v1.1.0 clear-on-resolve (Fix C).
- **`18.20.3` (2026-11-16):** Added `mnemopi.embeddingQueryPrefix` for Qwen3-Embedding; approval dialogs close cleanly on turn abort (#19242).
- **`18.22.2` (2026-11-19):** Per-user `omp` daemon consolidated; `artifact://` → `local://N.log`; `--no-judge` added to `ephemeral-*`; `composer.predictions: true` and `providers.webKeyless: true` kept by decision; `OmpHooksBridge.test.ts` moved into `extensions/tests/`.
- **`19.0.0` (2026-11-19):** `excludeFromContext: true` landed for zero-context stats rows; `tts` tool and `say` v2 verified working with local `llama.cpp/kokoro`; 120 s `SessionTree.ts` reaper added to bridge (2026-11-20); package renamed from `oh-my-pi-git-tag` to `oh-my-pi-git`.
- **`19.1.1.r184` (2026-11-23):** `xd://` devices replaced by bash tool commands (`tools.commandDocs`, `help://`, `propose`/`resolve`/`reject`/`report_issue`); `computer.backgroundFallback` → `computer.takeover`; MCP servers moved into daemon (`mcp.shared: true`, `mcp.idleStopMinutes: 5`); browser relay moved to Chrome native messaging host (externalized in AUR pkg); fixed `read` hang with `speculativeExecution` + `beforeToolCall` hooks; 2 s LSP project-load cap (#20204); incremental transcript mirror + live `session_id` + `lifeos-workflows-tick` added.
