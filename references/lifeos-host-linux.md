# LifeOS on this Linux host — topology, config plumbing, OS translation

Live setup reference for the LifeOS deployment on host `power` (Manjaro x64, bare metal). Supersedes `old-lifeos-setup.md` (archived; its §1 topology predates v8's MEMORY move and its §3-4 inference diagnostic is resolved by claude-shim). Harness deltas between Claude Code and omp: `lifeos-omp-difference.md`. Bridge implementation: `../omp/agent/extensions/OmpHooksBridge.md`; version history: `omp-lifeos-OmpHooksBridge-changelog.md`. Verified 2026-11-16 against the running host; hardware/services/account inventory: `$HOME/agent-private/lifeos/USER/GEAR.md`.

## Live topology & mounts (v8 layout)

```
$HOME/.claude ──symlink──► $HOME/.omp          (config root; stock paths resolve)
  ├─ LIFEOS/            framework payload (vendor tree, untracked — see § Git reality)
  │   ├─ PULSE/  TOOLS/  hooks/  ALGORITHM/ …
  │   ├─ USER    ──symlink──► $HOME/agent-private/lifeos/USER
  │   └─ MEMORY  ──symlink──► $HOME/agent-private/lifeos/USER/MEMORY   (v8: under USER)
  ├─ settings.json        merged registry product (see difference doc § Hook registry)
  └─ skills/              shared: workdir .omp/skills → ~/.omp/skills ≡ ~/.claude/skills

$HOME/agent-private/lifeos    private data repo of record (USER/, MEMORY/, TELOS.md, AGENTS.md); git-managed, NO remote
```

- v8 moved `MEMORY` under `USER` — the old top-level `$HOME/agent-private/lifeos/MEMORY` was `git mv`'d on 2026-11-09. Any doc showing MEMORY as a sibling of USER is pre-v8.
- The stale `.config/LIFEOS/USER` scaffold (stock default) is a harmless leftover — never treat it as live data; Doctor flags the real mounts as "broken" when `LIFEOS_CONFIG_DIR` is absent.

## Data home & `LIFEOS_CONFIG_DIR` contract

- **`LIFEOS_CONFIG_DIR=$HOME/agent-private/lifeos` is exported by the launcher, not by settings.json.** Sources of truth: `mypai/omp.env` (`LIFEOS_CONFIG_DIR=` + a `LAUNCHER_EXPORTS` entry) and `mypai/bin/lifeos` (default for direct launches) — both added 2026-11-11.
- The `env` block in `~/.claude/settings.json` is **not applied to tool shells** (probe: none of its keys, e.g. `BASH_DEFAULT_TIMEOUT_MS`, appear in a session env) and its stored value there still says `.config/LIFEOS`; treat that file as decorative for env purposes.
- Every tool that honors the variable (LinkUser, ScaffoldUser, Migrate, Doctor) resolves to the private repo; without it they scaffold into `~/.config/LIFEOS`. Check with `printenv LIFEOS_CONFIG_DIR` in a fresh session.

## Git reality of `~/.claude` (teeth audit 2026-11-11)

- The `~/.claude` git repo tracks **exactly one file: `.gitignore`**. The whole payload (`LIFEOS/`, `USER/` via symlink, `hooks/`, skills) is deliberately untracked — a probe commit of three `LIFEOS/TOOLS/*.ts` edits on 2026-11-10 added them as 2955 new insertions and was reverted for that reason.
- Vendor-file edits are protected by InstallAll's `.lifeos-overlay-backups/<ts>/`, not by git; durable changes belong upstream in LifeOS, personal data lives in the workdir repo. **"Commit my change" is never a `~/.claude` action.**
- **No git hooks exist on this host** (`~/.claude`, the workdir and mypai all have empty `.git/hooks`, no `core.hooksPath`), and `~/.claude` has **no remote at all**. So "the private trees' pre-push hook refuses public destinations" describes upstream, not here: the real teeth is that no public remote is configured anywhere in the private trees, and mypai (`github.com/wuxxin/mypai`, public) is the only push-able tree — privacy there rests on judgment. Restoring a deterministic check = an omp `bash.patterns` deny rule or a real git hook; neither exists today.
- **Bypass to remember:** pushes made through omp's `github` tool go via its vcs layer, not Bash — they clear every `bash.patterns` rule and any future restored PreToolUse:Bash lane. A real push gate must hook that path too.

## OS translation (stock LifeOS assumes macOS)

- Bare-metal host `power` (`systemd-detect-virt` → none; ZFS `rpool`/`dpool`). No launchctl/osascript/pbcopy/iMessage/Keychain/Seatbelt/menubar semantics here.
- **A systemd user manager does run** — the launcher starts each session with `systemd-run --user`. "No user bus" is narrower than it looked: the scope sets `TemporaryFileSystem=/run/user/1000` and binds only named sockets (pipewire, pulse, podman), so `/run/user/1000/bus` is missing *inside a session* → `systemctl --user` fails there. Host-side user units exist, but LifeOS keeps everything inside the sandbox scope by design — a separate unit would run outside that containment (principal's call, 2026-11-11). Consequences for scheduling: difference doc § Scheduling.
- **No cron daemon** (`systemctl is-active cron|crond` → inactive): a crontab entry never fires here. Scheduled work = Pulse's job runner only.
- **`/data` (dpool/data, 3.7 T free) is mounted read-only system-wide**, not sandbox-side; a local backup target needs `zfs set readonly=off dpool/data` (root op).
- Keychain → `.env` under the config root + omp `secrets.enabled` value redaction (in use).

## Model & inference topology

- Model execution is local by design: `$HOME/agent-private/lifeos/.omp/config.yml` **deep-merges over** `$HOME/.omp/agent/config.yml` and pins **every** chat role + fallback chain to llama.cpp (`qwen3.8-flash-next`, plus z-image-turbo / qwen3-tts / whisper-1); the global config's cloud roles are fully overridden inside this workspace.
- **One deliberate exception (read before briefing a `librarian`): `task.agentModelOverrides.librarian = google-antigravity/gemini-3.1-flash-lite` — a cloud model.** Librarian briefs therefore carry no `/USER` data, no secrets, no local paths beyond public repo names.
- Port allocations (all services :20000–:29000 + Pulse :31337): `mypai-portmap.md`. Service topology record: `USER/CONFIG/services.json`; sidecar mechanics: difference doc § Scheduling.
- **claude-shim** at `$HOME/.local/bin/claude` serves the `claude` binary that `LIFEOS/TOOLS/Inference.ts` resolves (`resolveClaudeBin()` → PATH, then `~/.local/bin/claude`). It routes LifeOS utility inference into omp headless runs; shim-routed calls run with the hooks bridge **off** by default (opt in per spawn with `LIFEOS_BRIDGE=1`) — difference doc § Inference path.
- `Inference.ts` mechanics worth knowing: four effort levels map to Claude tiers (`max→fable`, `high→opus`, `medium→sonnet`, `low→haiku`) and the shim maps those tiers to local roles; prompt goes via stdin (ARG_MAX); env scrubbing deletes `CLAUDECODE`, `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL` (subscription-billing intent, inherited from stock).

## Voice: STT in; TTS live via local engines behind the router

- **Directive 2026-11-11: "don't use tts only use stt."** Dictation path verified end-to-end 2026-11-11: omp config `stt:` block (`enabled`, `provider: local`, `baseUrl http://localhost:21080/v1`) + role `dictation: llama.cpp/whisper-1` → **local-router :21080** `/v1/audio/transcriptions` (health shows `stt: online`) proxies to user unit `local-speech-to-text.service` = whisper-server **:20090**, model `ggml-large-v3-turbo-q5_0`. Trigger in the interactive editor is **hold Space** (`dictationSpaceHold` in c…
- **TTS status changed 2026-11-16:** local TTS is running and is the configured speech provider. Engine default = **kokoro** (unit `local-text-to-speech.service`, kokoro-onnx FastAPI **:20095**, voices en `af_heart` / de `df_victoria`; qwen3-tts switchable via agents-shared `TTS_ENGINE`). omp role `speech: llama.cpp/kokoro` → router :21080 `/v1/audio/speech` (router answers any model string; the engine is invisible above it). Verified 2026-11-16 with generated+played audio for both voices. The old "deliberately NOT started / qwen3-only" row and the directive's TTS half are superseded; STT-first preference unchanged.
- LifeOS's own voice server remains Fish-SaaS-only (`PULSE/VoiceServer/voice.ts` `FISH_ONLY_PREFIX`; Doctor's voice row reads `off` pending `FISH_API_KEY`) — it does NOT use the local stack. Upstream ask if ever wanted: a local/openai-speech provider in VoiceServer. omp's built-in vocalizer is separate again and **phonon-only**: `speech.enabled` (default false) drives an in-process worker whose model list is exactly `phonon-31m` (`tts/models.ts` TTS_LOCAL_MODELS), voices are Phonon ids, `omp say` shares the same path (`resolveLocalSpeechModelId`, say.ts:153); no HTTP/provider option exists. Enabling it requires `omp setup speech` (Phonon download) — declined by principal 2026-11-16 in favor of "our setup"; with our stack, assistant audio runs through the role path (xd://tts tool → :21080 → kokoro), not the vocalizer. Upstream ask #2: openai-speech provider for vocalizer/say.
- `OMP_VOICE=0` in settings env.

## Doctor declines (host-trimmed capability rows)

- Declined 2026-11-10 with `bun LIFEOS/TOOLS/Doctor.ts decline <name>` (`enable <name>` re-probes): codex (installable via `bun install -g @openai/codex`, needs OpenAI login), cloudflare (needs `CLOUDFLARE_API_TOKEN` in `<configRoot>/.env`), fabric (patterns run natively; only `fabric -y` transcript fetch wants the CLI — its fixCmd is macOS-only, ticket `ERR-20261110-234334-a83c`), interceptor (macOS `.pkg` only, ticket `ERR-20261110-234334-2330`). Doctor exits 0: 10 live rows, 4 ⏸ declined, voice `off`.
- Declines persist in `USER/MEMORY/STATE/capabilities.json`, which is **gitignored** (`USER/MEMORY/STATE/*`) — disk-local, not versioned. Replacement paths per row: difference doc § Inactive stock features.
