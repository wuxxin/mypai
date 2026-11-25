# Linux Host Topology, Ports, VRAM Map & Scheduling

Live host reference for running **MyPAI** (`omp` + LifeOS + `agents-shared` local inference) on bare-metal Linux (Manjaro/Arch x86_64, AMD RX 7900 XTX 24 GiB dGPU + integrated Radeon iGPU).

---

## 1. Filesystem Topology & Data-Home Contract (LifeOS v8)

```text
$HOME/.claude ──symlink──► $HOME/.omp          (config root inside omp sandbox)
  ├─ LIFEOS/            framework payload (vendor tree, untracked in git)
  │   ├─ PULSE/  TOOLS/  WORKFLOWS/  hooks/  ALGORITHM/ …
  │   ├─ USER    ──symlink──► $HOME/agent-private/lifeos/USER
  │   └─ MEMORY  ──symlink──► $HOME/agent-private/lifeos/USER/MEMORY   (v8 layout)
  ├─ settings.json      merged hook registry (settings.system.json ⊕ settings.user.json)
  └─ skills/            shared: workdir .omp/skills → ~/.omp/skills ≡ ~/.claude/skills

$HOME/agent-private/lifeos   private data repo of record (USER/, MEMORY/, TELOS.md, AGENTS.md; local git, NO remote)
```

- **`LIFEOS_CONFIG_DIR=$HOME/agent-private/lifeos`** is exported by `omp.env` (`LAUNCHER_EXPORTS`) and `bin/lifeos`. Without it, LifeOS tools (`LinkUser`, `ScaffoldUser`, `Migrate`, `Doctor`) default to `~/.config/LIFEOS` and report the real mounts as broken.
- The `env` block inside `~/.claude/settings.json` is **not** applied to `omp` tool shells; treat it as decorative.
- **Git reality of `~/.claude`:** tracks only `.gitignore`. Never commit vendor payload files there; source-owned divergences live in `src/omp-lifeos-overlay/` (`MANIFEST.md`).
- **Root `node_modules`:** `<configRoot>/package.json` is the shared dependency root for `hooks/` and `LIFEOS/`. `omp.env` runs `cd "$HOME/.claude" && bun install` on every apply so `yaml` and other shared deps never go missing.

---

## 2. OS Translation (macOS Stock LifeOS → Linux Sandbox)

- **No `launchd`, no `cron` daemon, no macOS APIs** (`osascript`, `pbcopy`, Keychain, Seatbelt, iMessage, HealthKit, menubar).
- **Systemd user bus boundary:** `sandbox-ctl` mounts a private `TemporaryFileSystem=/run/user/1000` exposing only named sockets (PipeWire, PulseAudio, Podman) — `/run/user/1000/bus` is absent *inside* interactive sessions, so `systemctl --user` fails there by design.
- **Two process-visibility domains:** Every interactive `omp` session runs in its own bwrap sandbox; Pulse (`omp.service`) runs in a separate one. They share files, logs, and localhost ports, but `/proc/<pid>/environ` returns `EACCES` across sandboxes. Anything keyed on `PI_SESSION_ID` env tags therefore runs **in-process** inside `OmpHooksBridge.ts` (the 120 s `SessionTree.ts` reaper loop).
- **Secrets:** macOS Keychain is replaced by `<configRoot>/.env` + `omp` native `secrets.enabled` SIMD value redaction.

---

## 3. Canonical Port Map

All local services use unprivileged ports in **`20000`–`29000`** (below Linux's `32768–60999` ephemeral socket range) plus Pulse on `31337`:

| Port | Service | Status | Role |
| ---: | :--- | :--- | :--- |
| `31337` | Pulse Dashboard (`bun`, `omp.service`) | Active | LifeOS dashboard, observability, job runner |
| `21080` | `local-router` | Active | Unified OpenAI-compatible gateway |
| `20080` | `local-chat-strata` (`strata-engine`) | Active | Chat & vision MoE (`qwen3.8-flash-next` via Strata HIP; `qwen3.6-35B-A3B` fallback) |
| `20082` | `local-embedding` (`llama-server`) | Active | `Qwen3-Embedding-0.6B` (32K ctx, 6×8K parallel) |
| `20086` | `local-rerank` (`llama-server`/TEI) | Disabled | `Qwen3-Reranker-0.6B` / `ettin-reranker-400m-v1` |
| `20090` | `local-speech-to-text` (`whisper-server`) | Active | `ggml-large-v3-turbo-q5_0` |
| `20095` | `local-text-to-speech` (`kokoro-onnx`) | Active | Kokoro-82M default (`af_heart`, `df_victoria`); `qwen3-tts` switchable via `TTS_ENGINE` |
| `20100` | `local-image` (`sd-server`) | Disabled | `z_image_turbo-Q8_0` + `ae.safetensors` + `Qwen3-4B` |
| `28888` / `28889` | Hindsight / Worker | Inactive | Retired memory plane fallback |
| `8384` / `22000` | Syncthing UI / Sync | Active | Peer-to-peer file sync |
| `20887`–`20889` | `signal-cli` (TCP / HTTP / REST) | Active | Signal RPC & REST wrapper |

*(Retired Gen-2 ports: `28080`/`28081` `aoe`, `28823`/`28824` `amux-server`, `9810` `cc-connect`.)*

---

## 4. VRAM & RAM Co-Running Allocation Map

Hardware: AMD Radeon RX 7900 XTX (**24,576 MiB** dGPU VRAM, `vulkan1`) + integrated Radeon GPU (**16 GiB** shared RAM, `vulkan0`) + host CPU.

| Service | Backend / Device | dGPU VRAM (`vulkan1`) | iGPU (`vulkan0`) | System RAM |
| :--- | :--- | ---: | ---: | ---: |
| **Chat** (`llama-server`) | `vulkan1` (dGPU, `GGML_VK_DISABLE_MMVQ=1`) | 19,142 MiB | 0 MiB | ~851 MiB |
| **Embedding** (`Qwen3-Embedding-0.6B`) | `vulkan1` (dGPU) | ~2,940 MiB | 0 MiB | ~400 MiB |
| **Rerank** (`Qwen3-Reranker-0.6B`) | `vulkan1` (dGPU) | ~1,308 MiB | 0 MiB | ~200 MiB |
| **Speech-to-Text** (`whisper-server`) | `vulkan0` (iGPU) | 0 MiB | 809 MiB | ~126 MiB |
| **Text-to-Speech** (`kokoro-onnx`) | CPU (`LTTS_MODE="cpu"`) | 0 MiB | 0 MiB | ~350 MiB |
| **Image** (`sd-server`, TE on CPU) | `vulkan0,te=cpu` | 0 MiB | 6,368 MiB | ~3,812 MiB |
| **Total** | | **23,390 MiB** (~1,186 MiB free) | **7,177 MiB** (~9,207 MiB free) | **~8,324 MiB** |

---

## 5. Model & Voice Plumbing

- **LifeOS workspace model pin:** `$HOME/agent-private/lifeos/.omp/config.yml` deep-merges over `~/.omp/agent/config.yml` and pins all chat roles + fallback chains to local `llama.cpp` (`qwen3.8-flash-next`), with one deliberate exception: `task.agentModelOverrides.librarian = google-antigravity/gemini-3.1-flash-lite` (never send `/USER` data or secrets to `@librarian`).
- **STT (live):** `stt.provider: local` → `:21080/v1/audio/transcriptions` → `:20090` (`whisper-server`).
- **TTS (live):**
  - `tts` tool command → `modelRoles.speech: llama.cpp/kokoro` → `:21080/v1/audio/speech` → `:20095` (`kokoro-onnx`, en `af_heart`, de `df_victoria`; pass `voice_id` explicitly).
  - `say` builtin v2 (`omp >= 19.0.0`) resolves the `speech` role chain (with bundled Phonon 31M as fallback), though `say -v` is not plumbed for `openai-speech` — use the `tts` tool command when selecting German voices.
  - `LIFEOS/PULSE/VoiceServer/voice.ts` (overlay) routes local speech via `:21080` and plays via `pw-play → paplay → ffplay` (`VoiceCompletion.hook.ts` reads the bridge transcript mirror; `OMP_VOICE=0` disables it per launch).

---

## 6. Scheduling: Pulse `[[job]]`s & Native LifeOS `WORKFLOWS` Bridge

All periodic LifeOS clocks run inside the supervised `omp.service` Pulse daemon (never `launchd`, `cron`, or per-job `systemd --user` timers).

### Current Pulse `[[job]]` Roster (`USER/CONFIG/PULSE.user.toml`)

| Job | Cadence | Replaces |
| :--- | :--- | :--- |
| `conduit-capture` | `*/2 * * * *` | `com.lifeos.conduit` capture |
| `vigil-tick` | `*/5 * * * *` | `com.lifeos.vigil` (`VIGIL_SEND=off`, shadow mode) |
| `conduit-insight` | `7 * * * *` | `com.lifeos.conduit.insight` |
| `deriver-hypothesize` | `15 3 * * *` | `com.lifeos.deriver` |
| `session-tree-sweep` | `*/2 * * * *` | `com.lifeos.orphanreaper` (paired with `OmpHooksBridge` in-sandbox reaper) |

### Adopting Native LifeOS `WORKFLOWS` Without Modifying Host `systemd`
To run upstream declarative `LIFEOS/WORKFLOWS` definitions with **zero** host `systemd` unit generation and minimal upstream diff:

1. `omp.env` installs [`bin/lifeos-workflows-tick.ts`](../bin/lifeos-workflows-tick.ts) to `~/.local/bin/lifeos-workflows-tick`.
2. Add **one** 1-minute clock job to `USER/CONFIG/PULSE.user.toml`:
   ```toml
   [[job]]
   name = "workflows-clock"
   schedule = "* * * * *"
   command = "lifeos-workflows-tick"
   ```
3. Place stock workflow definitions in `USER/WORKFLOWS/` (or `LIFEOS/WORKFLOWS/definitions/`). `lifeos-workflows-tick` evaluates 5-field cron schedules idempotently per minute (state in `USER/MEMORY/STATE/workflows-clock.json`), delegates to `LIFEOS/WORKFLOWS/clock/tick.ts` if upstream adds one, and runs due workflows via `LIFEOS/WORKFLOWS/cli.ts` or the definition's `command` inside Pulse's environment.
4. Remove any duplicate `[[job]]` entry from `PULSE.user.toml` once its workflow definition is active — keep **exactly one** clock per job.

---

## 7. Doctor Declines & LifeOS Capability Status

Declined in `USER/MEMORY/STATE/capabilities.json` (gitignored, disk-local):

- `codex` (needs OpenAI login; local models handle audits), `cloudflare` (no `CLOUDFLARE_API_TOKEN`), `fabric` (`-y` fixCmd is macOS-only; patterns run natively via bun), `interceptor` (macOS `.pkg` only; replaced by `omp` internal `browser` + Chrome native messaging host).
- Active subsystems: Pulse, Conduit, Vigil (records only, `VIGIL_SEND=off`), Observability, Hooks (`OmpHooksBridge`), Memory (Mnemopi), Router (`:21080`), Algorithm/ISA/Assay, Skills, Config/Sessions.
- Inactive/macOS-only: `pulse-menubar`, iMessage/Tex, HealthKit, Conduit `appFocus` (requires X11/Wayland socket pass-through), Bunker monitor (maintainer-private; `DeployRegistrationGate` ported).
