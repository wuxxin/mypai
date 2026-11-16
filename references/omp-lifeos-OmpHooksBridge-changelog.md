# OmpHooksBridge upgrade notes (formerly `omp-hooks-bridge-upgrade-notes.md`)

`omp/agent/extensions/OmpHooksBridge.ts` shims Claude Code hooks onto omp's event bus; it is the load-bearing piece of the LifeOS layering. This note records the 18.18.8 → 18.20.2 upgrade path, what it changed for the bridge, and the timeout incident that followed. The plan this supersedes (`OMPHOOKSBRIDGE_UPGRADE_NOTES_PLAN.md`) was written against v18.20.0 as a future target; the upgrade has since been executed — installed is `omp/18.20.2` (`oh-my-pi-git-tag 18.20.2.r0.g7c49c1-1`, i.e. exactly tag v18.20.2), so its rebuild prompt is moot and the facts below are recomputed against `9369103…v18.20.2` on 2026-11-16.

## Baseline and delta

Base: installed `omp/18.18.8`, built from commit `9369103e4a06d099f3060aea95dae2fb7782cd9b` (upstream v18.18.8 + 212 commits, dated 2026-11-11). Shipped target: `v18.20.2` (published 2026-11-14T20:08:51Z); v18.20.1 published the same day at 17:29:17Z; `v18.20.3` is upstream's newest tag as of writing (published 2026-11-16T01:38:21Z). The compare over the shipped delta reports 1305 commits.

The installed string decodes exactly, with zero source drift: `oh-my-pi-git-tag 18.20.2.r0.g7c49c1-1` is git-describe tag `v18.20.2`, 0 commits past it (the `-1` is AUR pkgrel). Tag v18.20.2 → commit `7c49c11aa5bbaf3f418406583096168ad5b8c6dc` ("chore: bump version to 18.20.2", 2026-11-14T20:00:48Z); `compare/v18.20.2...7c49c11` reports ahead=0, behind=0 — the PKGBUILD's `#tag=` pin is authoritative and a non-zero `rN` in future `pkgver()`-free builds means post-tag commits are baked in. Recompute with:

```sh
omp --version; pacman -Q oh-my-pi-git-tag
curl -sf https://api.github.com/repos/can1357/oh-my-pi/releases?per_page=5 \
  | jq -r '.[] | [.tag_name, .published_at] | @tsv'
curl -sf "https://api.github.com/repos/can1357/oh-my-pi/compare/<base>...<target>" | jq '"commits: \(.total_commits)"'
```

`gh api` works identically where GH_TOKEN is present; the unauthenticated API (60 req/h) suffices for these reads.

## Extension API surface: one additive event over v18.20.0→v18.20.2

Verified byte-diff at `9369103…v18.20.0` (the original plan's measurement, re-confirmed 2026-11-16): `packages/coding-agent/src/extensibility/extensions/types.ts`, `docs/extensions.md`, and `packages/agent/src/types.ts` printed zero changed lines over that range, and no file was added or removed under `packages/coding-agent/src/extensibility/extensions/`. So the event names and payload shapes this bridge consumes — `session_start`, payload-less `turn_start`, `message_start`, `tool_call` → `{block, reason}`, `tool_result` with `content[]` + `isError`, `turn_end`, `session_shutdown`, `tool_approval_requested.{toolName,toolCallId,reason}`, the `context` handler's `{messages}` return, and `ctx.sessionManager.getBranch()/getSessionId()` used by `branchToTranscriptLines` — are identical across that delta.

Over v18.20.0→v18.20.2 the surface moved exactly once, additively: a `session_clear` event (`SessionClearEvent`, `pi.on("session_clear", …)`) was added to types.ts (+3 lines) and documented in docs/extensions.md (fires after an in-place `/clear` context reset; handlers awaited, cannot cancel). The bridge consumes none of it beyond one deliberate hygiene handler: on `session_clear` it resets the UserPromptSubmit dedup guard, so resubmitting identical text post-`/clear` dispatches again (queued `pendingContext` intentionally survives into the fresh context). Covered by a test; shipped with this note.

The bridge imports only `type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent"`, so package-root export additions (PR #18849) do not affect it.

## Runtime behavior changes in the shipped delta

Recorded with upstream identifiers, tied to `9369103…v18.20.0` where the original verification measured them:

- **#18869 prompt-cache fix for context hooks** — `extensibility/extensions/runner.ts` gained `#contextProjections = new WeakMap<AgentMessage, number | bigint | null>()` and `#isRepeatedProjection()`: a hook-rewritten history message is marked per-call only when its bytes (`Bun.hash(JSON.stringify(message))`) differ from the previous pass; first sighting counts as repeated. Effect: LifeOS context injection stops breaking the rolling Anthropic cache breakpoint, so a tool loop no longer re-bills the whole tail every step. This bridge drains `pendingContext` once per queued batch — it appends rather than rewrites; both facts recorded so nobody "fixes" the bridge for a problem it does not have.
- **#15107 / #18868** every TUI dialog, including `ctx.ui.confirm` opened from a `tool_call` handler, now reports state `blocked` with what it asks until answered. Double-stamping risk against LifeOS's own ⏳/BlockerText path (the bridge's `PermissionRequest` + `Notification{notification_type:"permission_prompt"}` dispatch) remains **unverified** — needs one interactive approval on the installed build: confirm exactly one blocker stamp reaches PULSE. If it double-stamps, suppress the Notification dispatch in the bridge, never PermissionRequest.
- **#18920** MCP tools deliver their payload once through SDK-wrapped structured content; hooks that de-duplicated by hand should be re-checked.
- **#18980 worker-thread subagents** no longer report as separate sessions (PULSE board counts change), and the bridge now runs in every subagent: hook fan-out is per session, so `task` + `task.autoParallel`/`task.steps` (#19.0) multiplies SessionStart/Stop dispatches against the bridge's timeout cap. This one bit for real — see the timeout incident below; it is fixed as of commit `f0dc417`.
- **Secrets codec v2 (#18965 / #19014)** — placeholders become four camelCased words after the friendly name (`GitHubToken_correctHorseStapleBattery`), no `$$…$$`; text written from them replays byte-identical; placeholders in sessions saved before the change stay literal. Transcript mirrors and hook payloads carry word-form placeholders; old sessions must be started fresh for working redaction. `secrets.yml` regex rules become Rust regex (linear time, no lookarounds/backreferences, `(?P<secret>…)` marks the part). This machine has no `~/.omp/agent/secrets.yml`; built-in defaults only, no rule migration needed.
- **Prompt trim** — the default system prompt shrank; `encourageEdits` (default on) gates the "use `edit`, never sed/perl/python" line. LifeOS rule text that relied on dropped global guidance must be restated in the constitution, not assumed.
- **#17971** `/context` and the Context Viewer itemize instruction files and skills as their own categories — the tool to measure LifeOS injection weight with.

## The bridge timeout incident (2026-11-16), root cause and fix

Symptom: with the full registry loaded, hook dispatches hit `timeout`; the bridge was disabled (`disabledExtensions`) as a workaround. Measurements on the installed 18.20.2:

- All Pre/PostToolUse hooks ~50ms; all 12 Stop hooks sum to ~1.6s standalone — not the cause.
- `PromptProcessing.hook.ts` (UserPromptSubmit) measures **6–12s every prompt**: it calls `Inference.ts`, which spawns `claude`; on this machine that shim routes to llama.cpp/qwen3.8-flash-next on local-router :21080 — the same router serving the live omp conversation. Every prompt makes its own naming inference queue behind itself: idle ~4s, 3-way concurrent load 7–9s+. This is intended topology (LifeOS inference runs fully offline); it is a floor, not a defect.
- The bridge amplified it twice over: hooks for one event ran **serially** (each prompt paid the sum of its hooks; 11 UserPromptSubmit children back-to-back), and `HOOK_TIMEOUT_MS = 30_000` was hardcoded, ignoring settings.json per-hook `timeout` — MicroIntegrity's 180s and MemoryIndexRefresh's 60s died at 30s with a spurious `err:"timeout"`.

Fix (commit `f0dc417`, mirrored to `~/.omp/agent/extensions/OmpHooksBridge.ts`): a `dispatch()` helper runs all hooks of one event concurrently (Claude Code semantics; PreToolUse deny-wins-over-ask preserved, `pendingContext` drained in registration order) and each hook is capped by its own registered timeout. Measured on identical headless probes before/after: wall 16.6s → 8.4s; Stop span (24 dispatches with fan-out) 2.8s → 0.5s; UserPromptSubmit = slowest single hook, no longer a sum; zero timeout/failure lines. Event latency is now max(hook), which for prompts means PromptProcessing's offline inference — expected and accepted.

## Build/packaging facts (recomputed at v18.20.2, 2026-11-16)

Per-file upstream change counts over `9369103…v18.20.2`, measured with
`curl -sf "https://api.github.com/repos/can1357/oh-my-pi/commits?path=<p>&sha=v18.20.2&since=2026-11-11T15:41:35Z" | jq length`:

- `packages/coding-agent/scripts/compile-binary.ts`: **0** → `skip-native-embed-for-aur.patch` untouched upstream.
- `packages/coding-agent/scripts/json-parse-plugin.ts`: **0** → `relative-json-asset-paths.patch` untouched upstream.
- `MODULE.bazel`: **3** commits, in two hunks only — the `xwin_sysroot(name = "xwin_sysroot")` call gains `sdk_version = "10.0.22621"` (upstream old lines 271-274) and a new `crate.annotation{ build_script_env = { "CC_aarch64_pc_windows_msvc": … }, crate = "psm" }` block is inserted after the `ring` annotation (new lines 318-329). The AUR patches touching this file patch at upstream lines ~192, ~205, ~245 (`use-system-opus-pcre2.patch`) and ~225, ~253 (`tree-sitter-no-strict-aliasing.patch`); the changed regions are disjoint from every patched hunk, so `prepare()`'s `patch -p1` calls apply with offset only. (Same counts and hunks as measured at v18.20.0 — no new MODULE.bazel commits landed in .1/.2.)
- `.bazelversion` and `rust-toolchain.toml`: byte-identical across the delta → no toolchain bump; the existing `CARGO_BAZEL_REPIN=1 bazel fetch @crates//...` repin and JDK-21/`USE_BAZEL_VERSION` handling in `prepare()` stay as they are.
- Browser use now prefers a bundled WebKit engine (ABKit) downloaded from `build.stencil.so` into `~/.o2/lib/abkit` (SHA-256 checked), overridable by `browser.webkitPath` / `PI_BROWSER_WEBKIT_PATH`; Chromium stays the fallback. No new system package; record for offline/sandboxed builds.

For the next bump (v18.20.3, 119 commits over .2): no changes to the extension API surface files and no hook-dispatch changes, so nothing is required for the bridge. One PR matters: #19242 / `d4d661c` wraps the tool-approval prompt in `untilAborted(signal, …)` (wrapper.ts +11 −6) — Esc/session-switch closes a pending approval instead of waiting on it. That is exactly the path the bridge's PreToolUse `ask` → `ctx.ui.confirm` uses; on 18.20.2 an aborted turn leaves that confirm hanging with no timeout. #19242 bounds the hang (it does not clear LifeOS's ⏳ stamp — no unblock signal reaches TabState). After any .3 build, re-run the probe below and extend the interactive checklist: Esc one gated approval and confirm the prompt closes cleanly.

## Post-upgrade smoke checklist and results on 18.20.2

```sh
OMP_BRIDGE_LOG=/tmp/bridge.jsonl omp -p --auto-approve "run: echo bridge-test"
jq -r '.event // .cc' /tmp/bridge.jsonl | sort | uniq -c
```

Expected: a `bridge_init` line with a non-zero `hooks` count and the resolved `settings` path, one `user_message`, `tool_call` + `PostToolUse` for the echo, Stop, SessionEnd, no `registry_not_found` / `registry_load_failed`. Run 2026-11-16 on 18.20.2 with the fixed bridge: event sequence complete (bridge_init, user_message, tool_call/tool_result, PostToolUse ×3, Stop ×24 — two turns × 12 hooks, confirming per-session fan-out is real), zero failures/timeouts, wall 8.4s. The interactive half of the checklist — approve one gated call, exactly one ⏳/blocker stamp reaches PULSE (the #18868 double-stamp check), and `$TMPDIR/lifeos-bridge-transcripts/<sessionId>.jsonl` carries `tool_use`/`tool_result` lines with Claude tool names — is **still open**.

## BlockerText clear-on-resolve (Fix C, implemented 2026-11-16)

The double-stamp observation (previous section) remains open; the source-agnostic half was shipped. `BlockerText.hook.ts` v1.1.0 (`~/.omp/hooks/`, commit `2e86db6`; registry entry at the user layer via `{ "__merge": "append", "values": [...] }` — `agent-private/lifeos` 0441238 superseded by a849a91; registration mechanics: `hooks` is an installer-owned MergeSettings key, plain arrays under `.hooks` replace wholesale and clobbered the merged registry mid-session today, so the v8 registry was moved into `settings.system.json` and merge is now idempotent at 63 entries with SettingsBackport verifying clean): its announcement dedupe (ISC-484, one text per session per blocker) already suppressed stacking — what was missing is resolution. State values became `{ts, sessionId, trigger}`; a PostToolUse dispatch for a session deletes that session's permission seen-keys, so the same blocker can legitimately re-text after the gate resolves, and stale stamps from aborted approvals age out at the next executed tool call. Critical-trigger keys are never cleared (re-derived every Stop). Legacy number-valued state entries are TTL-only, never cleared. Verified with an isolated `LIFEOS_DIR`: clear is surgical — other-session, critical, and legacy entries untouched; a `cleared` row lands in the observability log. Bridge-side Fix A (suppress Notification on native reporting) stays unimplemented pending the interactive observation.
