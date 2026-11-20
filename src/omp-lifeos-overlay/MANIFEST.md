# omp-lifeos-overlay — local divergence record

**Generated:** 2026-11-16 · **Against stock:** danielmiessler/LifeOS v8.761.0 (GitHub API tarball, commit fb9aef4) · **Live tree:** `~/.claude` (= `~/.omp`)

Shadow copy of the source-level divergences this host owns — nothing generated, rendered, merged, or duplicated from a canonical in-repo file. Regenerate with `tools/lifeos-diff.ts` + `tools/lifeos-overlay.ts` (stock at `/tmp/lifeos-stock/`); the classifier detects both placeholder shapes (`{{PRINCIPAL_NAME}}`, `{DA_IDENTITY.NAME}`).

## Categories (copied: 10 files)

### hooks (behavior fixes)

- `hooks/BlockerText.hook.ts`
- `hooks/lib/blocker-text.ts`
- `hooks/StopGates.hook.ts`
- `hooks/handlers/VoiceNotification.ts` — record honesty (2026-11-20): the hardcoded `voice_engine:'fish'` literal becomes `'pulse'` (the bus; the server picks Fish vs local endpoint), docstrings updated. Voice is now the single stock chain: OmpHooksBridge's built-in speak block was retired and `OMP_VOICE=0` filters this hook out of the session's Stop set instead.

### LifeOS tool code

- `LIFEOS/TOOLS/AgentJob.ts`
- `LIFEOS/TOOLS/HarvestExecutor.ts`
- `LIFEOS/TOOLS/MemoryReviewer.ts`
- `LIFEOS/PULSE/VoiceServer/voice.ts` — local speech provider (2026-11-20): OpenAI-compatible `/audio/speech` engine behind the Fish branch (agents-shared router :21080, WAV-only, tag-strip + pronunciations preprocessing), player list settled by listening tests to pw-play → paplay → ffplay (mpg123/aplay stall on PipeWire; all three decode WAV and MP3), honest `/voice/health` (`local-speech`, `speech_endpoint`). Moved from Appendix A: it is now source-diverged, not rendered-only. Personal-name comment mentions are generalized ("Noben" → "the DA") in BOTH trees (copied to live 2026-11-20), so overlay and live are byte-identical.

### local doctrine (rules)

- `LIFEOS/RULES/Verification.md`

### skill content

- `skills/LifeOS/SKILL.md`

Each was diffed against stock and reviewed 2026-11-16; all eight kept by the principal (2026-11-16): the TOOLS trio sets `LIFEOS_BRIDGE=1` for durable-work runs (claude-shim § Hook Bridge Opt-In); BlockerText/lib is v1.1.0 clear-on-resolve; StopGates v1.3.2 retires IsaCodeSyncGate + VerificationGate for this host (bridge discards `decision:"block"`); Verification.md adds the Linux host-translation paragraph — probe class updated 2026-11-16 to **omp's internal browser** (`screenshot()`, `diffScreenshot()` proven live on Pulse) after the `openadapt` skill was deleted; SKILL.md adds the installed-copy header pointing at `Intents/Update.md`.

## Record-only classes (not copied)

|class|count|why not copied|
|---|---|---|
|rendered|76|placeholder personalization (`{{...}}` and `{DA_IDENTITY.*}` filled), byte-identical to stock after substitution — Appendix A lists paths. Includes `skills/Prompting/Templates/Data/Agents.yaml`: a **wrong-place edit** (agent naming hand-filled into the distribution template). **Fixed 2026-11-16:** live file reverted byte-identical to stock; the name is canonical in `USER/DIGITAL_ASSISTANT/DA_IDENTITY.md` (`name: "Noben"`), which RenderIdentity fills from — no move needed. `LIFEOS/PULSE/VoiceServer/voice.ts` moved out of this class 2026-11-20 (source-diverged, copied).|
|bridge duplicates|2|`LIFEOS/TOOLS|DOCUMENTATION/OmpHooksBridge.*` deployed payloads; canonical advanced version is this repo's `omp/agent/extensions/OmpHooksBridge.ts`, byte-identical to the live extension.|
|generated / merge output|4|`LIFEOS/VERSION` newline artifact, `settings.system.json` + rendered `CLAUDE.md` (installer outputs), one local lockfile.|
|noise locks & state|~15|worker `bun.lock`s, Pulse runtime state.|
|staging copies|4213|files under `skills/LifeOS/install/**` — release-dir staging inside the skill placement.|

## Missing from disk (6)

- `LIFEOS/RINGS/Rings.ts`
- `LIFEOS/RINGS/policy.ts`
- `LIFEOS/RINGS/templates/ring-2.yaml`
- `LIFEOS/RINGS/templates/ring-3.yaml`
- `LIFEOS/RINGS/templates/ring-1.yaml`
- `LIFEOS/RINGS/templates/ring-0.yaml`

`LIFEOS/RINGS/*` (the whole subsystem) is absent here, **not** listed in upstream `RETIREMENTS.json`, and not in `.retired-2026-11-09T18-19-47-197Z/`. Unexplained local absence — open question for the next Doctor/upgrade pass.

## Privacy (mypai is public-pushable)

Copied tree: **no principal name, no absolute user paths, no secrets** (hook comments genericized to "the user"; rendered docs not copied). Push-safe at file content level; P7 judgment still applies before publishing.

## Appendix A — rendered-only paths (76), record, not copied

- `LIFEOS/ASSAY/Report.ts`
- `LIFEOS/ASSAY/ReviewEntry.ts`
- `LIFEOS/CODEX/Bridge.ts`
- `LIFEOS/DOCUMENTATION/Assay/AssaySystem.md`
- `LIFEOS/DOCUMENTATION/Hermes/HermesSidecar.md`
- `LIFEOS/DOCUMENTATION/Hooks/HookSystem.md`
- `LIFEOS/DOCUMENTATION/Notifications/NotificationSystem.md`
- `LIFEOS/DOCUMENTATION/Pulse/DaSubsystem.md`
- `LIFEOS/DOCUMENTATION/Statvs/StatvsSystem.md`
- `LIFEOS/DOCUMENTATION/SystemUserBoundary.md`
- `LIFEOS/HERMES/Policy.ts`
- `LIFEOS/LIFEOS_SYSTEM_PROMPT.md`
- `LIFEOS/PULSE/Observability/observability.ts`
- `LIFEOS/PULSE/Observability/src/app/telos/_v7/styles.css`
- `LIFEOS/PULSE/modules/content.ts`
- `LIFEOS/PULSE/modules/siri.ts`
- `LIFEOS/RELAY/bridge/Probe.ts`
- `LIFEOS/RELAY/bridge/call-turns.ts`
- `LIFEOS/RELAY/bridge/handler.ts`
- `LIFEOS/RELAY/bridge/health.ts`
- `LIFEOS/RELAY/bridge/index.ts`
- `LIFEOS/RELAY/bridge/linq.ts`
- `LIFEOS/RELAY/bridge/session.ts`
- `LIFEOS/RELAY/bridge/tapback.ts`
- `LIFEOS/RELAY/context/HeadsUp.ts`
- `LIFEOS/RELAY/context/LooseEnds.ts`
- `LIFEOS/RELAY/context/OnePager.ts`
- `LIFEOS/RELAY/worker/CHANGELOG.md`
- `LIFEOS/RELAY/worker/cloudflare.config.ts`
- `LIFEOS/RELAY/worker/deploy.ts`
- `LIFEOS/RELAY/worker/src/call-core.ts`
- `LIFEOS/RELAY/worker/src/classify.ts`
- `LIFEOS/RELAY/worker/src/inbox-core.ts`
- `LIFEOS/RELAY/worker/src/index.ts`
- `LIFEOS/RELAY/worker/src/voice.ts`
- `LIFEOS/STATUSLINE/sections/Ultracode.ts`
- `LIFEOS/STATUSLINE/sections/WorkQueue.ts`
- `LIFEOS/STATVS/core/tools/erase.ts`
- `LIFEOS/STATVS/core/worker/CHANGELOG.md`
- `LIFEOS/STATVS/core/worker/src/erasure.ts`
- `LIFEOS/STATVS/core/worker/src/index.ts`
- `LIFEOS/TOOLS/CommitmentDetect.ts`
- `LIFEOS/TOOLS/GenerateTelosSummary.ts`
- `LIFEOS/TOOLS/JobGate.ts`
- `LIFEOS/TOOLS/ReleaseRecord.ts`
- `LIFEOS/TOOLS/ReviewCases.ts`
- `LIFEOS/TOOLS/ReviewSuite.ts`
- `LIFEOS/TOOLS/VoiceMaster.ts`
- `LIFEOS/TOOLS/VoiceTags.ts`
- `LIFEOS/TOOLS/lib/DenyHistoryScan.ts`
- `LIFEOS/VIGIL/Advocate.ts`
- `LIFEOS/VIGIL/Handoff.ts`
- `LIFEOS/VIGIL/Outcome.ts`
- `LIFEOS/VIGIL/PaceCheck.ts`
- `LIFEOS/VIGIL/Policy.ts`
- `LIFEOS/VIGIL/WorldWatch.ts`
- `LIFEOS/WORKFLOWS/clock/core.ts`
- `LIFEOS/WORKFLOWS/engine/definitions.ts`
- `hooks/IsaCodeSyncGate.hook.ts`
- `hooks/lib/herdr-tabs.ts`
- `hooks/lib/micro-integrity.ts`
- `hooks/lib/presence-context.ts`
- `hooks/lib/route-label.ts`
- `hooks/lib/work-kind.ts`
- `skills/Fabric/Patterns/create_better_frame/system.md`
- `skills/Fabric/Patterns/extract_article_wisdom/README.md`
- `skills/Fabric/Patterns/extract_product_features/README.md`
- `skills/Fabric/Patterns/extract_wisdom/README.md`
- `skills/Fabric/Patterns/rate_value/README.md`
- `skills/Fabric/Patterns/show_fabric_options_markmap/system.md`
- `skills/HyperFrames/Intents/CapabilityVideo.md`
- `skills/LifeOSHooks/hooks/LifeOSHooks.ts`
- `skills/LifeOSHooks/hooks/lib/route-label.ts`
- `skills/Prompting/Templates/Data/Agents.yaml`
- `skills/VideoEssay/Intents/Explainer.md`
- `skills/VideoEssay/Tools/Theme.ts`
