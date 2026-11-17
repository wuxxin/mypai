# LifeOS on Claude Code vs. LifeOS on omp — the real differences

Reference doc for running LifeOS under Oh My Pi (omp) on this host. It records where the two harnesses genuinely differ, what `OmpHooksBridge.ts` shims, what is shimmed with reduced fidelity, and what has no equivalent at all. AGENTS.md §1 points here. Companion references: host topology / OS translation / model+voice plumbing → `mypai-lifeos-host-linux.md`; LifeOS distro upgrade procedure + version semantics → `lifeos-upgrade-runbook.md`; per-version bridge mechanics → `omp-lifeos-OmpHooksBridge-changelog.md` (was `omp-hooks-bridge-upgrade-notes.md`, renamed 2026-11-16); bridge implementation details in `../omp/agent/extensions/OmpHooksBridge.md`. Verified state: 2026-11-16, omp 18.20.3.r60.g77fcce9, v8 hook layer; scheduling + web-verification sections added same day from live probes (Vigil tick ported and running).

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
- omp's real teeth: tool policy, `bashInterceptor.patterns` (a **tool-redirect** interceptor — `{pattern, tool, message}` regexes that refuse shell usage of commands with dedicated tools; global config, from 18.20.3 project/`--config` overlays **prepend** per-path rule lists; not an approval gate), the `bash.patterns` approval rules (§ Guard enforcement map), and the native TUI approval dialog which self-reports its blocked state. LifeOS gates reach approvals only through hook `permissionDecision: deny|ask` via PreToolUse.
- Consequence of Fix A: on this host an approval prompt is visible natively (omp's own UI) and stamps the tab via PermissionRequest, but produces no BlockerText announcement text.

## Guard enforcement map (what has teeth today)

Full audit chain: `$HOME/agent-private/lifeos/lifeos-guard-audit-2026-11.md`. v8 retired 19 LifeOS guard hooks (moved to `.retired-…/hooks/`) that relied on CC permission rules / git hooks / Seatbelt; principal's call 2026-11-11: no restoration.

- **Enforced:** omp-native loop guards and built-in critical-command refusals (`CRITICAL_BASH_PATTERNS`: `rm -rf /`, `sudo rm`, mkfs, dd-to-device, `curl|sh`, chmod/chown -R on `/`, fork bomb, shutdown, `nc -e` exfil); `edit.enforceSeenLines` (stale-write analogue); task-tool governance; `secrets.enabled` value redaction. **Extension `~/.omp/agent/extensions/LoopGuard.ts`** (source in mypai) covers a-b-a-b oscillation, failure-hammering (≥5 calls/tool in last 8, ≥3 failed), and non-consecutive exact repeats; armed by file presence, `wait` exempt.
- **Approval-rule set: deliberately removed (solved 2026-11-16).** A ported 18-rule `bash.patterns` list was installed 2026-11-11 (`.claude/.env` reads → prompt; force-push main/master incl. `--force-with-lease` → deny; `rm -rf ~*|$HOME*|.git`, `chmod -R 777 ~*` → deny; inline python/perl/ruby/php → deny; `cf`/`wrangler` → prompt) and **removed by the principal: globs were too broad and produced false positives.** Nothing to restore — treat the current state (no `bash.patterns` in any layer, verified 2026-11-16 across live config, its Nov-15 `.bak`, and source-of-truth `mypai/omp/agent/config.yml`) as intended. If any rule is ever reinstated it must be a narrow per-command glob, not a wildcard blanket; verify each candidate against real command history before adding it.
  - **Don't confuse the two keys** (source check, omp 18.20.3 at `submodules/aur-packages/oh-my-pi-git-tag/src/oh-my-pi`): `bashInterceptor.patterns` = tool-redirect rules (`{pattern: <regex>, tool, message}`, merge `prepend`) that block shell usage of commands with dedicated tools — **present on this host** (8 rules). The approval gate is **`bash.patterns`** = ordered `{match, approval}` globs (`*` wildcards only; optional per-rule `env` allowlist via `bash.allowedEnvVars`; `deny` refuses, `prompt` asks, matched against the whole command AND every segment of a compound one) — intentionally empty here.
  - A headless run cannot answer a `prompt` rule — treat prompt as refuse when automating.
- **Rule-only (no teeth):** ISA-code-sync and done-claim verification. The upstream gates (`IsaCodeSyncGate`, `VerificationGate`) ran every turn via `StopGates.hook.ts` on the bridge, but their `{decision:"block"}` verdict is discarded by the bridge (no stop-block mechanism in omp); retired from StopGates v1.3.2 on 2026-11-12 — logic files untouched. Replacement path: advisor subsystem + `.omp/WATCHDOG.{md,yml}` roster (project-scoped, transcribed from the gate contracts) — parked; `advisor.enabled: false` by principal's call. Load if enabled ≈ 5–10 min shared-GPU/day, $0 local (measured 2026-11-12).
- **Exempt by explicit principal decision (2026-11-12, keep off):** system-file write protection (`tools.restrictedFolders` stays UNSET); PublicPushGate content scrub. Not enforced: VoiceEgressGuard (voice off), ReminderRouter, ConfigEvalFire, ComplexityRatchet; path references like `USER/**` have no native secret twin.
- **Bypass to remember:** pushes made through the `github` tool go via omp's vcs layer, not Bash — they clear every `bash.patterns` rule and any future restored PreToolUse:Bash lane. A real push gate must hook that path too.

## Inference path per prompt

One inference call per user prompt: `PromptProcessing.hook.ts` (~6–12s through shared-router at :21080). All lifecycle hooks are token-free. Shim-routed headless calls (`claude` → `omp`) run isolated with the bridge **off** by default; callers opt in per spawn with `LIFEOS_BRIDGE=1`.

## Files, dirs, launch

- Config root: `~/.omp`, symlinked as `~/.claude`; LifeOS payload at `~/.claude/LIFEOS` (real repo: `~/agent-private/lifeos`). Vendor edits in `~/.omp` stay untracked per the payload-untracked convention; personal data lives in the workdir repo.
- Skills dir is shared three ways: workdir `.omp/skills → ~/.omp/skills ≡ ~/.claude/skills`.
- Launch: `lifeos` = `exec omp --cwd "$LIFEOS_CWD" --append-system-prompt "$prompt_file" "$@"` — flags pass through (`--offline`, `--no-judge` from 18.20.3 are usable for router-contention-free runs).
- Headless probe/CI: `make bridge-test` (bun suite, 15 tests) and `make bridge-smoke` (full event sequence + zero-failure gate) in mypai.

## Scheduling: launchd vs Pulse job runner

- Stock LifeOS keeps its clocks in launchd: ~23 `com.lifeos.*` plist templates (`Services.ts` registry + per-service `Install*.ts`); the 2026-10-22 reorganization moved the scheduled-job set (Conduit capture, iMessage reader, derived sync, model sync, Socrates/Achilles ticks…) into Workflows.
- Upstream v8 **already speaks systemd on Linux**: each `Install*.ts` materializes a `systemd --user` unit and `Services.ts status/doc` branches on `process.platform` (`Services.ts:22-29`). The gap here is host topology, not upstream code.
- This host's session scope sets `TemporaryFileSystem=/run/user/1000` binding only named sockets — no user bus inside a session, so `systemctl --user` fails there. Topology settled 2026-11-16 (principal's call): the long-lived daemon runs as the **primary service of the static `~/.config/systemd/user/omp.service` unit** (`LAUNCHER_SERVICE_CMD` in mypai `omp.env`; generated with `Restart=always`) — deliberately outside session containment, trading it for supervision; interactive launches stay separate transient units. Verified same day: unit-owned Pulse took :31337 30s after a manual instance released it (cgroup `app.slice/omp.service`). No cron daemon exists (`systemctl is-active cron|crond` → inactive), no launchd semantics exist at all.
- Replacement mechanism, one per class: daemons = the static unit's primary service (`LAUNCHER_SERVICE_CMD` in mypai `omp.env`; Pulse on :31337 — sidecars were retired 2026-11-16 as monitored-not-supervised); periodic scripts = `[[job]]` entries in `USER/CONFIG/PULSE.user.toml`. Pulse's runner executes them with `bash -c` via `spawnScript` (`PULSE/lib.ts:614-620`) **inheriting Pulse's env** (unit environment carries `LIFEOS_CONFIG_DIR` etc.; verified via capture job writing the right data home). Cadence, stated exactly: scheduled LifeOS work runs while the user's systemd instance is up (login → logout / reboot), supervised with restart-on-failure — not per omp session.
- Ported 2026-11-16: `[[job]] vigil-tick */5` → `VIGIL_SEND=off bun …/VIGIL/Tick.ts`. The first run seeds the baseline cursor from the outbox (no flood) and writes `last-tick.json {baseline:true}`; verified live — healthz cron row `vigil-tick ok, failures 0`, `/api/vigil/status` `stale:false`, clock `next_at = last+300s`.
- Vigil's text channel: `sendText` resolves a RELAY bridge line (`VIGIL/Tick.ts:93-99`); RELAY is not used on this host (Trusted channels = none), so the job sets `VIGIL_SEND=off` — decisions are recorded, sends are explicit-not-sent until an outbound channel exists. Policy file is the shipped template (`USER/VIGIL/policy.json`, `decider_mode: "shadow"`, ceiling 4/24h); tuning is a principal decision, not part of the port.
- Roster classification (from live `bun TOOLS/Services.ts status`, 29 rows): **ported** = pulse (unit primary service), conduit-capture, vigil-tick, conduit-insight (`*/7`), deriver-hypothesize (`15 3 * * *`) — the last two stood up 2026-11-16; Pulse's built-in system jobs already carry cost-aggregation, memory-consolidation, proposal-gc. **Portable opt-ins, stand up on demand**: interviewdue, worksweep, atlas (Atlas ships a Systemd collector), commitmentsweep, lifelogideasweep, conveyor-watcher/runner, derivedsync, velocity, synthesis, distill, coach, socrates, usage-aggregator, orphanreaper, pegwatch, bunkermonitor. **Never ported** (macOS-only): pulse-menubar, messages reader (iMessage DB), healthsync, herdr-bridge; **declined with notes**: modelsync (principal: not using it), codexupdate — recorded in `USER/CONFIG/services.json` `_declined`; the Conduit appFocus source is declined pending a display-socket pass-through.
- Registration discipline: every clock stood up gets a `services.json` entry so `Services.ts status`, the Pulse dashboard, and the Workflows inventory report reality with no hand-kept lists.
- Pulse lifecycle facts (probed 2026-11-16): `pulse.ts` **ignores SIGTERM and SIGINT** — stopping it needs SIGKILL; a second instance refuses ("Another pulse.ts is already running", exit 1), so a restart must confirm the old pid gone / port free before launching the replacement.

## Web verification: Interceptor vs omp's internal browser

- Stock LifeOS verifies web output through **Interceptor** (macOS `.pkg` app + CLI) driving real Chrome in the user's real profile — the ONLY sanctioned browser automation; modality fidelity depends on a logged-in, real-browser session. It has no Linux build; ticket `ERR-20261110-234334-2330` stands (upstream PR owed).
- Here: **omp's internal browser tool is the standing verifier class** (principal directive 2026-11-16). It is the eval `browser` namespace (`await browser.open(...)` → managed headless shared tabs); there is no `xd://browser` device. Verified live against the Pulse dashboard (tab titled "Pulse | Home", DOM observed, clean close).
- Fidelity (settled 2026-11-16): **full-capability web verifier** — navigation, interaction, console/network, `screenshot()` + `diffScreenshot()` visual regression, `pdf()`, device emulation; via the relay it adopts the user's real Chrome session (login state included). Appearance/layout claims close on screenshots from a real navigation; the only deferral is login-state without the relay. The `openadapt` skill (headless Playwright) was **deleted 2026-11-16**; `/usr/bin/chromium` remains for raw probes (`--dump-dom`, `--screenshot`) via bash.

## Known gaps summary (accepted on this host)

1. ConfigChange never fires (no upstream event).
2. Transcript mirror Stop/SessionEnd only; other hooks allow-without-record.
3. PermissionRequest lacks `tool_input` (omp event has no field).
4. No BlockerText announcement text for approvals (Fix A, deliberate — native blocked-reporting is the single stamp source).
5. Interactive sessions share session key `"omp"` for per-session hook state.
6. No scheduler inside the session scope: launchd absent, cron daemon inactive, systemd --user has no bus in bwrap → all periodic LifeOS work runs as Pulse `[[job]]`s. Since 2026-11-16 these run on the machine's cadence (Pulse = primary service of the static `omp.service` user unit, Restart=always) — while the user's systemd instance is up, not per session (§ Scheduling). The portable launchd roster is classified there.
7. No Interceptor (macOS-only): **omp's internal browser is the full-capability verifier here** — navigation, interaction, console/network, screenshots + baseline diffs, emulation; real Chrome via relay when needed (§ Web verification). Only login-state claims without an active relay stay `[DEFERRED-VERIFY]`.
8. `pulse.ts` ignores SIGTERM/SIGINT — stop needs SIGKILL, and restarts must confirm port free (duplicate guard exits 1).
9. *(resolved 2026-11-16 — not a gap)* The ported `bash.patterns` approval rules are absent **by decision**: the globs were too broad and caused false positives, so the principal removed them. omp's built-in critical-command refusals + loop guards remain the standing teeth. Details: § Guard enforcement map.

## Inactive stock features (Claude Code + macOS): status here, potential replacement

Live sources: `bun TOOLS/Doctor.ts` rows (declined set persists in gitignored `USER/MEMORY/STATE/capabilities.json`), `services.json` `_declined`, OPERATIONAL_PREFERENCES § Trusted channels (none/disabled by decision 2026-11-11), voice directive 2026-11-11.

| Stock feature | Why inert here | Potential replacement on this host |
|---|---|---|
| Pulse menu-bar app `com.lifeos.pulse-menubar` | macOS menubar app; declined (macOS-only) | Pulse dashboard + statusline chips — already the surface here ✅ |
| iMessage reader / Messages inbox (`com.lifeos.messages`, TextingGuard channel) | Reads the macOS Messages DB; no Messages.app on Linux | Any inbound channel is a deliberate none today. Path: RELAY bridge, or Slack DM mirror (Vigil policy `dm_mirror_user_id` + `VIGIL_SLACK_BOT_TOKEN`) — both plumbed, none enabled |
| Voice **output** (VoiceServer → Fish-SaaS; 🗣️ voice mode) | `FISH_ONLY_PREFIX`, no `FISH_API_KEY`; Doctor voice row `off` | Local TTS service (:20095, router-fronted at :21080 as model `qwen3-tts`) **defaults to kokoro** (ONNX, 4.6× RT, voices en `af_heart` / de `df_victoria`; qwen3 switchable) — verified 2026-11-16: direct + router synthesis produce valid WAVs, playback via sox, and omp's `xd://tts` role path synthesizes through it (role label ≠ engine). omp also has a built-in **vocalizer** that speaks replies/ask prompts natively (gapless PCM, PulseAudio; Esc silences) — `speech.enabled` defaults false, unset here; enable = `omp setup speech` (Phonon 31M, keyless local) + set the key; vocalizer is local-only, ignores the cloud role (`vocalizer.ts:69-77`). `omp say <text>` same path. LifeOS VoiceServer lacks a local provider — upstream ask unchanged. STT/dictation fully live ✅ |
| Interceptor browser verification | macOS `.pkg` only, no Linux build (`ERR-20261110-234334-2330`) | omp internal browser = DOM/state/screenshot class (§ Web verification); upstream port owed |
| Conduit `appFocus` source (frontmost-app capture) | macOS-only poller; source off (`ERR-20261110-171607-768b`) | Linux active-window poller (X11/Wayland); sandbox currently sets DISABLE_X11/DISABLE_WAYLAND=true, so needs a socket pass-through first |
| launchd service fleet + Workflows clocks | No launchd/cron; systemd --user bus not in scope (§ Scheduling) | Pulse `[[job]]`s — established; 16 portable opt-ins listed there; `gh` workrepo filing: works once `gh auth login`/`GH_TOKEN` is set (currently unauthenticated → degrades to a recorded failure row, non-fatal) |
| CC permission layer (167 allow / 86 deny) + Seatbelt sandbox | omp has no CC-permissions reader; no Seatbelt on Linux | Replaced by omp tool policy, native critical-command refusals, loop guards, LoopGuard extension (`tools.restrictedFolders` left unset by explicit decision). The ported `bash.patterns` rule set was removed by the principal — too broad, false positives (§ Guard enforcement map) |
| Keychain for secrets | No macOS Keychain | `.env` under config root + omp `secrets.enabled` value redaction — in use ✅ |
| fabric CLI (`fabric -y` transcript fetch) | fixCmd is macOS-only (`ERR-20261110-234334-a83c`) | Fabric patterns run natively via bun already; only the `-y` fetch wants the CLI — a Linux branch upstream fixes it |
| codex row (Astra-style audits) | Not installed, needs OpenAI login; declined 2026-11-10 | `bun install -g @openai/codex` + login if wanted; local models carry audit roles meanwhile |
| cloudflare row (`CfEnv.ts`, P6 deploy teeth) | Needs `CLOUDFLARE_API_TOKEN` in `<configRoot>/.env`; declined | Set the token → full cf path works on Linux (it's bun, not macOS-bound) |
| healthsync (HealthKit export) | No HealthKit; no wearable pipeline mounted | No clean equivalent; manual file drops into `USER/` state paths remain possible |
| pbcopy / osascript / launchctl plumbing | macOS APIs | Not used by core paths here; Linux equivalents exist per need — no gap observed |
| Workflows engine (incl. a `vigil-tick` workflow definition) | Definitions dir empty on this install; upstream prefers it over a second clock | Adopting WORKFLOWS as the scheduler is the upstream-aligned end state; Pulse jobs are the sanctioned interim (InstallVigil refuses to add a clock beside an existing vigil-tick workflow — keep exactly one) |
| ISA-code-sync + done-claim Stop gates | `{decision:"block"}` verdict discarded by bridge (no stop-block in omp); retired from StopGates v1.3.2 2026-11-12 | Advisor subsystem + `.omp/WATCHDOG.md` roster — built, parked (`advisor.enabled: false`, principal's call) |
| Hermes gateway sidecar (`ai.hermes.gateway`) | No Hermes home mounted; not applicable to this install | Mount a Hermes home if a second front door is ever wanted |
| Pulse healthcheck job (public-site probes) | `checks/health.ts` exits 78 — no sites configured; disabled by decision 2026-11-10 | Set `LIFEOS_PULSE_HEALTH_SITES` in the unit env + delete the disable block → system job runs as shipped |
| CORPUS / HOUSE Pulse pages | Need a deployed Corpus Worker endpoint / home-device poller (`MEMORY/_HOUSE/latest.json`) — not macOS-bound, just unconfigured | Deploy the worker (Cloudflare row above) / run a home poller; both are config, not porting |

Rule of thumb for anything on this table: the replacement is always an **observable mechanism already present on Linux** (Pulse job, sidecar, omp policy, local model, env token) — never a new daemon outside the session scope, and never a prose promise.

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

## Local LifeOS overlay (divergence record, checked 2026-11-16)

The active tree (`~/.claude`) vs stock **v8.761.0** (tarball fb9aef4), sha256-compared file-by-file, each diff reviewed 2026-11-16. The shadow copy at `src/omp-lifeos-overlay/` carries **only source-level divergences this host owns**, by category: hooks behavior fixes (`BlockerText.hook.ts` + `lib/blocker-text.ts` v1.1.0 clear-on-resolve, `StopGates.hook.ts` v1.3.2 gate retirement), LifeOS tool code (`AgentJob`, `HarvestExecutor`, `MemoryReviewer` — all the `LIFEOS_BRIDGE=1` durable-work opt-in), local doctrine (`RULES/Verification.md` Linux host-translation paragraph), skill content (`skills/LifeOS/SKILL.md` installed-copy header) — 8 files. Full record + regenerator scripts: that dir's `MANIFEST.md`.

Not copied (recorded in MANIFEST): **77 rendered** personalizations — the classifier now matches both placeholder shapes, so three docs and `Prompting/Templates/Data/Agents.yaml` moved out of "edit" into this class; ⚠️ Agents.yaml was a **wrong-place edit** (naming hand-filled into the distribution template) — **fixed 2026-11-16**: live file reverted byte-identical to stock, name canonical in `DA_IDENTITY.md` (`name: "Noben"`), which RenderIdentity fills. Also not copied: the **bridge duplicates** under `LIFEOS/TOOLS|DOCUMENTATION/OmpHooksBridge.*` (live bridge is byte-identical to this repo's canonical extension — a copy would duplicate mypai); generated/merge outputs (`VERSION` newline artifact, `settings.system.json`, rendered `CLAUDE.md`, stray lockfiles); 4213 payload-staging files under `skills/LifeOS/install/**`.

**Missing from disk (6):** all of `LIFEOS/RINGS/*` — NOT in upstream `RETIREMENTS.json`, not in `.retired-2026-11-09*`; unexplained, raise at next Doctor/upgrade pass.

Privacy: the copied tree carries **no principal name, no absolute user paths, no secrets** (hook comments genericized to "the user"; rendered docs excluded). P7 judgment still applies before publishing.
