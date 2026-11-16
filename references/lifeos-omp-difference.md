# LifeOS on Claude Code vs. LifeOS on omp — the real differences

Reference doc for running LifeOS under Oh My Pi (omp) on this host. It records where the two harnesses genuinely differ, what `OmpHooksBridge.ts` shims, what is shimmed with reduced fidelity, and what has no equivalent at all. AGENTS.md §1 points here; per-version upgrade mechanics live in `references/omp-hooks-bridge-upgrade-notes.md`; bridge implementation details in `omp/agent/extensions/OmpHooksBridge.md`. Verified state: 2026-11-16, omp 18.20.3.r60.g77fcce9, v8 hook layer.

## Conceptual model

Claude Code executes LifeOS natively: it reads `${CLAUDE_CONFIG_DIR}/settings.json`, runs the hook contract itself (JSON stdin → JSON stdout), enforces permission rules, and writes a JSONL transcript per session. LifeOS's enforcement layer is CC-native there.

omp has no Claude Code code path at all. `~/.claude -> ~/.omp` is a symlink so stock paths resolve; DetectEnv reports "claude-code / detected" through the shim — intended, it keeps us on the CC registry path. The hook contract runs only because `OmpHooksBridge.ts`, an omp extension, subscribes to the omp event bus and invokes each registered hook command with Claude-shaped payloads. Everything below flows from that one fact: **the enforcement layer is a userland shim over an event bus, not a native contract.**

## Hook registry: layered merge vs. single file

- CC: one `settings.json`, read as-is.
- omp host: the live registry at `~/.claude/settings.json` is a **merge product**. `MergeSettings.ts` composes `settings.system.json` (v8-managed, rewritten by InstallAll) ⊕ `LIFEOS/USER/CONFIG/settings.user.json` (personal), runs every SessionStart.
- `hooks`, `statusLine`, `spinnerVerbs`, `spinnerTipsOverride` are **INSTALLER_OWNED keys**: a layer that defines the key wins wholesale; if neither defines it, the value carries forward from the existing merged output. Consequences, learned by incident 2026-11-16:
  - A plain array under `.hooks` in any layer replaces the sibling event arrays wholesale — a naive personal overlay dropped the 62-entry registry to 1 entry mid-session.
  - Personal hook additions belong at the user layer as `{ "__merge": "append", "values": [...] }`; append only unwraps when the system layer carries an array (it requires "array or absent"). The settled layout keeps the v8 registry in `settings.system.json` so append operates; merge is idempotent (63 entries across repeated runs) and `SettingsBackport.ts` verifies.
  - After a LifeOS upgrade, InstallAll rewrites `settings.system.json`; user-layer appends survive on top.

## Event map: what the bridge shims

| Claude Code event | omp source | fidelity |
|---|---|---|
| SessionStart | `session_start` | full |
| UserPromptSubmit | `message_start` (role=user) | full — real prompt text; identical-text re-emits deduped; `session_clear` resets the guard |
| PreToolUse | `tool_call` | full — `permissionDecision: deny/ask` honored, ask → UI confirm, headless fails closed |
| PostToolUse / PostToolUseFailure | `tool_result` (isError) | full |
| Stop | `turn_end` | full; transcript mirror written for evidence gates |
| SessionEnd | `session_shutdown` | full |
| PermissionRequest | `tool_approval_requested` | tab stamp only — `tool_input` has no field in the omp event, so TabState's `permissionDetail()` falls back to the tool name (documented behavior) |
| Notification(permission_prompt) | **suppressed 2026-11-16 (Fix A)** | omp ≥18.20.x natively reports dialogs as `blocked` with what they ask (#15107/#18868); the bridge text announcement double-stamped, so it is gone. BlockerText gets no *announcement* from approvals on this host; clear-on-resolve (PostToolUse) still runs. |
| StopFailure | synthesized on non-zero Stop exit | extra vs. upstream — omp has no such event; consumers are EventLogger and TabState ❌ |
| ConfigChange | **none, accepted gap** | omp's extension event union has no settings-change event (`mode_changed` is a harness mode switch). EventLogger misses config-change audit lines for omp sessions; do not synthesize from file watchers. |

## Transcripts, session identity, voice

- CC writes the session JSONL itself and hands `transcript_path` to every hook. omp keeps an internal session DB; the bridge converts the live branch (`ctx.sessionManager.getBranch()`) into Claude-format JSONL at `$TMPDIR/lifeos-bridge-transcripts/<sessionId>.jsonl`, so transcript-evidence gates judge real evidence — for **Stop and SessionEnd only**. Other events get `transcript_path: ""` and must allow-without-record (e.g. BlockerText's hook-io fallback note).
- Session identity: shim-spawned runs export a uuid4 via `OMP_SESSION_ID`; interactive omp sessions keep the historical `"omp"` key, so per-session state files (`STATE/isa-nudge/<id>.json`, memory queues) are keyed by that. Parallel headless runs stay isolated; parallel interactive runs share one key.
- Voice: `VoiceCompletion` (CC transcript reader) is bypassed; the bridge's omp-native path extracts the final `🗣️ <DA>:` closer from the turn's assistant message at `turn_end` and speaks it via Pulse `/notify`. Same semantics, no CC dependency.

## Permissions: two unrelated systems

- The 167 allow / 86 deny rules in `~/.claude/settings.json` are parsed by **nothing** on this host — omp has no Claude Code permissions reader (`tools/approval.ts`, `exec/settings.ts`, `config/settings.ts`). They are decorative.
- omp's real teeth: tool policy, `bashInterceptor.patterns` (global config; from 18.20.3 project/`--config` overlays **prepend** per-path rule lists), approval rules, and the native TUI approval dialog which self-reports its blocked state. LifeOS gates reach approvals only through hook `permissionDecision: deny|ask` via PreToolUse.
- Consequence of Fix A: on this host an approval prompt is visible natively (omp's own UI) and stamps the tab via PermissionRequest, but produces no BlockerText announcement text.

## Inference path per prompt

One inference call per user prompt: `PromptProcessing.hook.ts` (~6–12s through shared-router at :21080). All lifecycle hooks are token-free. Shim-routed headless calls (`claude` → `omp`) run isolated with the bridge **off** by default; callers opt in per spawn with `LIFEOS_BRIDGE=1`.

## Files, dirs, launch

- Config root: `~/.omp`, symlinked as `~/.claude`; LifeOS payload at `~/.claude/LIFEOS` (real repo: `~/agent-private/lifeos`). Vendor edits in `~/.omp` stay untracked per the payload-untracked convention; personal data lives in the workdir repo.
- Skills dir is shared three ways: workdir `.omp/skills → ~/.omp/skills ≡ ~/.claude/skills`.
- Launch: `lifeos` = `exec omp --cwd "$LIFEOS_CWD" --append-system-prompt "$prompt_file" "$@"` — flags pass through (`--offline`, `--no-judge` from 18.20.3 are usable for router-contention-free runs).
- Headless probe/CI: `make bridge-test` (bun suite, 15 tests) and `make bridge-smoke` (full event sequence + zero-failure gate) in mypai.

## Known gaps summary (accepted on this host)

1. ConfigChange never fires (no upstream event).
2. Transcript mirror Stop/SessionEnd only; other hooks allow-without-record.
3. PermissionRequest lacks `tool_input` (omp event has no field).
4. No BlockerText announcement text for approvals (Fix A, deliberate — native blocked-reporting is the single stamp source).
5. Interactive sessions share session key `"omp"` for per-session hook state.

## omp 18.20.2 → 18.20.3.r60 impact on this system (checked 2026-11-16)

No action required for the bridge: the extension event surface (`tool_approval_requested`, `session_clear`, `context`) is unchanged across .2→.3 and in the 60 unreleased commits at 77fcce9; smoke + suite green on the new build.

Checked against local config, no exposure:
- Breaking `seance` agent / `/seance` / task-tool `sourceSession` removal — not referenced anywhere in configs, workdir, or LIFEOS.
- Breaking `bash.patterns` prepend semantics — host has a single global config; no project/`--config` overlays exist at mypai or lifeos cwd.

Actionable (open recommendations, not applied):
- **mnemopi embedding prefixes**: new `mnemopi.embeddingQueryPrefix` / `embeddingInputType` explicitly target Qwen3-Embedding (this host's `embeddingModel`, via :21080). Setting the query prefix is a recall-quality win for asymmetric models — worth enabling.
- `--offline` / `--no-judge` in the lifeos launcher profile would pin auxiliary services to the active provider (shared-router contention policy).
- `bash.allowedEnvVars` + per-rule `env` allowlists exist now if bash allow-rules ever need env prefixes.
- Approval-flow fixes landed: pending approval closes when a turn aborts (#19242), TUI no longer freezes switching sessions from an open prompt — both reduce stale-blocker states the BlockerText clear-on-resolve path was compensating for.
