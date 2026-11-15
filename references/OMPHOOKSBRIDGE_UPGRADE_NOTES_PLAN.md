# omp-hooks-bridge-upgrade-notes

## Context

`omp/agent/extensions/OmpHooksBridge.ts` shims Claude Code hooks onto omp's event bus; it is the load-bearing piece of the LifeOS layering. The installed build is `omp/18.18.8` compiled from upstream commit `9369103e4a06d099f3060aea95dae2fb7782cd9b` (package `oh-my-pi-git-tag 18.18.8.r212.g9369103-1`); upstream's latest tag is `v18.20.0`. The ask is the *knowledge* for that upgrade path: what changes for this bridge, and a prompt handed to the agent that bumps/rebuilds the AUR package.

End state: `references/omp-hooks-bridge-upgrade-notes.md` exists with the verified facts below plus the copy-paste rebuild prompt, one pointer line in `AGENTS.md`. Deliverable is documentation only — the PKGBUILD bump itself is not executed here.

All facts below were measured this session against upstream `9369103…v18.20.0`; transcribe them as-is. Re-run each command before writing; if a number moves, write the new one and say which tag it was taken against.

## Approach

### Step 1 — write the note

Create `references/omp-hooks-bridge-upgrade-notes.md` (same house style as `references/lifeos-setup.md`: prose + fenced commands, no decorative separators) with exactly these sections:

**1. Baseline and delta.** State: installed `omp/18.18.8`, built from commit `9369103e4a06d099f3060aea95dae2fb7782cd9b` (upstream v18.18.8 + 212 commits, dated 2026-11-11); target `v18.20.0` (published 2026-11-12T23:40:30Z). Give the commands that recompute it:

```sh
omp --version; pacman -Q oh-my-pi-git-tag
gh api repos/can1357/oh-my-pi/releases --paginate -q '.[] | [.tag_name, .published_at] | @tsv' | head -4
gh api "repos/can1357/oh-my-pi/compare/<base>...<target>" -q '"commits: \(.total_commits)"'
```

**2. Extension API surface: unchanged.** Verified by byte-diff of the two refs (each printed `changed lines: 0`): `packages/coding-agent/src/extensibility/extensions/types.ts`, `docs/extensions.md`, `packages/agent/src/types.ts`; and no file added or removed under `packages/coding-agent/src/extensibility/extensions/`. Consequence to state plainly: the event names, payloads, and session-entry shapes this bridge consumes (`session_start`, `turn_start` payload-less, `message_start`, `tool_call` → `{block, reason}`, `tool_result` with `content[]` + `isError`, `turn_end`, `session_shutdown`, `tool_approval_requested.{toolName,toolCallId,reason}`, the `context` handler's `{messages}` return, and `ctx.sessionManager.getBranch()/getSessionId()` used by `branchToTranscriptLines`) are identical across the delta — **no code change in the bridge is required by the upgrade**. The bridge imports only `type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent"` (line 62), so PR #18849's package-root export additions do not affect it.

**3. Runtime behavior that does change.** Record each with its upstream identifier:
- **#18869 prompt-cache fix for context hooks** — `extensibility/extensions/runner.ts` gained `#contextProjections = new WeakMap<AgentMessage, number | bigint | null>()` and `#isRepeatedProjection()`: a hook-rewritten history message is marked per-call only when its bytes (`Bun.hash(JSON.stringify(message))`) differ from the previous pass; first sighting counts as repeated. Effect here: LifeOS context injection stops breaking the rolling Anthropic cache breakpoint, so a tool loop no longer re-bills the whole tail every step. Note that this bridge drains `pendingContext` once per queued batch (lines 684-694), i.e. it appends rather than rewrites — record both facts so nobody "fixes" the bridge for a problem it does not have.
- **#15107 / #18868** every TUI dialog, including `ctx.ui.confirm` opened from a `tool_call` handler (lines 535-544), now reports state `blocked` with what it asks until answered. Check for double-stamping against LifeOS's own ⏳/BlockerText path (`PermissionRequest` + `Notification{notification_type:"permission_prompt"}` dispatch, lines 649-680) — marked **unverified**, confirm on a real approval prompt after the upgrade.
- **#18920** MCP tools no longer deliver their payload twice through SDK-wrapped structured content → `PostToolUse` hook payloads for MCP tools arrive once; hooks that de-duplicated by hand should be re-checked.
- **#18980** worker-thread subagents stopped logging per-spawn extension bind failures and no longer report themselves as separate sessions → affects PULSE board counts, and the bridge now runs in every subagent: hook fan-out is per session, so `task` + new `task.autoParallel`/`task.steps` (#19.0) multiplies SessionStart/Stop dispatches against `HOOK_TIMEOUT_MS = 30_000`.
- **Secrets codec v2 (#18965 / #19014)** — placeholders become four camelCased words after the friendly name (`GitHubToken_correctHorseStapleBattery`) with no `$$…$$`; text written from them replays byte-identical; **placeholders in sessions saved before the change stay literal**, including inside tool calls copied from them. Consequence: `transcript_path` mirrors and hook payloads carry word-form placeholders, and old sessions must be started fresh to get working redaction. `secrets.yml` regex rules become Rust `regex` (linear time; no lookarounds/backreferences; `(?P<secret>…)` marks the redacted part) — this machine has no `~/.omp/agent/secrets.yml`, so only built-in defaults apply and no rule migration is needed.
- **Prompt trim** — the default system prompt shrank (tool-choice rules now point at `read`/`edit`/`find`; reasoning-format, AST and subagent-limit guidance removed; `read`'s detailed selectors moved to on-demand `xd://read/sources`, `xd://read/urls`) and `encourageEdits` (default on) now gates the "use `edit`, never sed/perl/python" line. Any LifeOS rule text that relied on the dropped global guidance must be restated in the constitution, not assumed.
- **#17971** `/context` and the Context Viewer itemize instruction files and skills as their own categories — name this as the tool to measure LifeOS injection weight with after the upgrade.

**4. Build/packaging facts for `submodules/aur-packages/oh-my-pi-git-tag/PKGBUILD`.** Per-file upstream change counts over the delta, measured with:
`gh api "repos/can1357/oh-my-pi/commits" -X GET -f path=<p> -f sha=v18.20.0 -f since=2026-11-11T15:41:35Z -q 'length'`
- `packages/coding-agent/scripts/compile-binary.ts`: **0** → `skip-native-embed-for-aur.patch` untouched upstream.
- `packages/coding-agent/scripts/json-parse-plugin.ts`: **0** → `relative-json-asset-paths.patch` untouched upstream.
- `MODULE.bazel`: **3** commits, in two hunks only — the `xwin_sysroot(name = "xwin_sysroot")` call gains `sdk_version = "10.0.22621"` (upstream old lines 271-274) and a new `crate.annotation{ build_script_env = { "CC_aarch64_pc_windows_msvc": … }, crate = "psm" }` block is inserted after the `ring` annotation (new lines 318-329). The two patches that touch this file patch at upstream lines ~192, ~205, ~245 (`use-system-opus-pcre2.patch`) and ~225, ~253 (`tree-sitter-no-strict-aliasing.patch`); the changed regions are **disjoint** from every patched hunk, so `prepare()`'s `patch -p1` calls (PKGBUILD lines 56-60) apply with offset only. State that reasoning, not just the conclusion.
- `.bazelversion` and `rust-toolchain.toml`: byte-identical across the delta → no toolchain bump; `package.json` differs only in the workspace package version strings (`18.18.8` → `18.20.0`). The existing `CARGO_BAZEL_REPIN=1 bazel fetch @crates//...` repin step and the JDK-21/`USE_BAZEL_VERSION` handling in `prepare()` stay as they are.
- New optional runtime dependency: browser use now prefers a bundled WebKit engine (ABKit) downloaded from `build.stencil.so` into `~/.o2/lib/abkit` (SHA-256 checked), overridable by `browser.webkitPath` / `PI_BROWSER_WEBKIT_PATH`; Chromium stays the fallback. No new system package; record it for offline/sandboxed builds.

**5. Post-upgrade smoke checklist.** Copy the probe already documented in `omp/agent/extensions/OmpHooksBridge.md` (line 54) and state expected log lines:

```sh
OMP_BRIDGE_LOG=/tmp/bridge.jsonl omp -p --auto-approve "run: echo bridge-test"
jq -r '.event // .cc' /tmp/bridge.jsonl | sort | uniq -c
```
Expected: a `bridge_init` line with a non-zero `hooks` count and the resolved `settings` path, one `user_message`, `tool_call` + `PostToolUse` for the echo, `Stop`, `SessionEnd`, and no `registry_not_found` / `registry_load_failed`. Then in an interactive session: approve one gated tool call and confirm exactly one ⏳/blocker stamp reaches PULSE (the double-stamp check from section 3), and confirm `$TMPDIR/lifeos-bridge-transcripts/<sessionId>.jsonl` still contains `tool_use`/`tool_result` lines with Claude tool names.

### Step 2 — the rebuild prompt

Append to the same file a section `## Prompt for the agent rebuilding omp` containing exactly this block, copied character-for-character (it is written for a fresh session with no other context):

```text
Task: bump and rebuild the AUR package oh-my-pi-git-tag in
submodules/aur-packages/oh-my-pi-git-tag from its current source to upstream tag v18.20.0
(or the newest release tag), install it, and prove the local LifeOS hooks bridge still works.

Read first: references/omp-hooks-bridge-upgrade-notes.md (patch-safety analysis, post-upgrade
checklist) and omp/agent/extensions/OmpHooksBridge.md (probe commands).

Do, in order:
1. Record the baseline: `omp --version`, `pacman -Q oh-my-pi-git-tag`.
2. Update PKGBUILD to build the tag: add `#tag=v18.20.0` (or the newest release tag) to the
   `git+https://github.com/can1357/oh-my-pi.git` source entry, delete the `pkgver()` function so
   the version comes from the tag, and keep the four patch entries in `source=()` with their
   sha256sums (first entry stays `'SKIP'`).
3. Apply each patch against the new tree and report per-patch status before building:
   `for p in *.patch; do patch -p1 --dry-run -i "$p"; done` inside the prepared source.
   Expect all four to apply (offset at most). If one rejects, re-cut it minimally against the
   new file; never delete a patch to make the build pass:
   skip-native-embed-for-aur.patch (packages/coding-agent/scripts/compile-binary.ts) and
   relative-json-asset-paths.patch (scripts/json-parse-plugin.ts) are untouched upstream;
   MODULE.bazel changed only at the xwin_sysroot call and a new psm crate.annotation, both
   outside the opus/pcre2/tree-sitter hunks.
4. Keep prepare() as-is: JDK 21 on PATH, USE_BAZEL_VERSION=latest, CARGO_BAZEL_REPIN=1 repin.
5. Build and install (`makepkg -si`), then verify: `omp --version` reports the new version;
   `pacman -Qk oh-my-pi-git-tag` is clean; the native addons are loose .node files (the AUR
   layout, PI_SKIP_NATIVE_EMBED=1).
6. Prove the bridge: run the OMP_BRIDGE_LOG headless probe from the notes file and check for
   bridge_init with a non-zero hooks count, one user_message, tool_call + PostToolUse, Stop,
   SessionEnd, and no registry_not_found. Then in an interactive session approve one gated tool
   call: exactly one blocker stamp must reach PULSE (omp now reports `blocked` natively while a
   dialog waits — remove any double-stamping you introduced, do not add one).
7. Report: versions before/after, per-patch apply status, any re-cut patch with its diff, and the
   bridge probe output.

Do not change omp/agent/config.yml, agents/, skills/, or the extension itself unless a step above
proves it is broken; do not enable cloud features (no Stencil sign-in); do not commit anything in
submodules/aur-packages beyond PKGBUILD and *.patch files.
```

### Step 3 — pointer line (independent of steps 1-2)

In `AGENTS.md`, under `### Current Architectural Focus: LifeOS Integration`, immediately after the existing `- Detailed setup notes:` bullet, add exactly:

```
- Upgrade-path notes for the hooks bridge: `references/omp-hooks-bridge-upgrade-notes.md`.
```

## Critical files & anchors

- `references/lifeos-setup.md` — the house style to copy for the new note (prose + fenced commands).
- `omp/agent/extensions/OmpHooksBridge.md:40-90` — existing probe invocation and expected audit-log lines; source of section 5's commands. Its sample shows `"hooks":76`, so "non-zero hooks count" has a concrete reference value.
- `omp/agent/extensions/OmpHooksBridge.ts:684-694` (`context` handler draining `pendingContext`), `:512-547` (`tool_call` deny/ask with `ctx.ui.confirm`), `:351-404` (`branchToTranscriptLines`, transcript mirror) — the anchors section 3's claims attach to.
- `submodules/aur-packages/oh-my-pi-git-tag/PKGBUILD:51-76` — `pkgver()` and `prepare()`: patch order, JDK 21 path, `USE_BAZEL_VERSION`, crate repin.
- `AGENTS.md` "Current Architectural Focus: LifeOS Integration" — the exact insertion point for step 3's line (after the existing `Detailed setup notes:` bullet).

## Verification

Run from the repo root; every check must pass before yielding.

```sh
# API surface unchanged (each prints changed lines: 0)
R=can1357/oh-my-pi B=9369103e4a06d099f3060aea95dae2fb7782cd9b T=v18.20.0
for P in packages/coding-agent/src/extensibility/extensions/types.ts docs/extensions.md packages/agent/src/types.ts; do
  diff <(gh api "repos/$R/contents/$P?ref=$B" -q .content | base64 -d) \
       <(gh api "repos/$R/contents/$P?ref=$T" -q .content | base64 -d) | grep -c '^[<>]'
done
# note is complete: prints 1 for each required anchor
for k in '#18869' '#19014' 'MODULE.bazel' 'abkit' 'bridge_init' 'Prompt for the agent rebuilding omp'; do
  printf '%s %s\n' "$(grep -c -- "$k" references/omp-hooks-bridge-upgrade-notes.md)" "$k"; done
# pointer line present, and no source file touched by this plan
grep -n 'omp-hooks-bridge-upgrade-notes' AGENTS.md; git status --porcelain omp/agent/extensions
```

Expected: the three diffs print `0`; every anchor count ≥ 1; one AGENTS.md hit; `git status --porcelain` prints nothing. No build runs in this plan, so no runtime check applies beyond these.


## Assumptions & contingencies

- Target version: `v18.20.0` was upstream's newest release tag when these facts were measured (published 2026-11-12T23:40:30Z). If a newer tag exists at execution time, recompute section 1's numbers with the commands given and keep every other claim tied to `9369103…<that tag>`; state the pair in the note.
- If `references/omp-hooks-bridge-upgrade-notes.md` already exists, append the sections under a `## Updated <date>` heading instead of replacing it.
- The two runtime items marked **unverified** (double blocker stamping after #18868; hook fan-out cost with `task.autoParallel`) are specified as checks to perform on the upgraded build, not as facts. If the double-stamp check fails, fix it in the bridge's `tool_approval_requested` dispatch (lines 649-680) by suppressing the `Notification{notification_type:"permission_prompt"}` hook when omp reports the state natively; do not suppress `PermissionRequest`.
- The note is written in English to match `references/`; no changelog entry, no PKGBUILD change, and no code edit belong to this plan.

