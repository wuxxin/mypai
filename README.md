# mypai — my Personal-AI

Local, private, experimental and opinionated Personal Artificial Intelligence (PAI) infrastructure based on **Oh-my-PI** (`omp`) and **Hindsight** long-term memory service.

---

## About

`mypai` provides a complete local multi-agent orchestration harness, with
  - integrated local OpenAI-compatible inference and routing (`local-router`)
  - containerized sandbox containment (`sandbox-ctl`)
  - custom ROCm/HIP hardware-accelerated binaries


It is based on ideas from LifeOS, and Openclaw like agent harnesses for implementing a **minimal version of a PAI**.

---

## Setup & Installation

### Prerequisites

- **OS**: Arch Linux (or Arch-based distribution) recommended for `aur-packages`.
- **Hardware**: AMD GPU with ROCm/HIP support (or CUDA/CPU fallback).
- **Tooling**: `git`, `python3`, `uv` package manager, `curl`.

### 1. Clone Repository & Initialize Submodules

Clone the repository recursively to fetch all submodules:

```bash
git clone --recursive https://github.com/wuxxin/mypai.git
cd mypai
```

If already cloned without submodules, initialize them manually:

```bash
git submodule update --init --recursive
```

### 2. Download Local AI Models

Download required LLM, vision, embedding, reranking, STT, and TTS models using the automated downloader script from `agents-shared`:

```bash
./submodules/agents-shared/scripts/local-download.sh /data/public/machine-learning/models --all
```

*Or select specific model suites (e.g., `--llm --embedding --reranker`).*

### 3. Provision Local Inference

Provision local inference services:

```bash
./submodules/agents-shared/assistants/local-inference.sh install --new-config
```

### 4. Provision oh-my-pi Environment

Provision the sandbox environment and generate the `omp` binary launcher in `~/.local/bin` using `sandbox-ctl`:

```bash
./submodules/agents-shared/scripts/sandbox-ctl install omp --no-start --new-config-from ./
```

`sandbox-ctl install` performs the following automated steps:
1. Copies configuration files from `./omp/agent/*` into `$HOME/.omp/agent/`.
2. Creates a managed Python virtual environment at `$HOME/.omp/python-env` (containing `openadapt` and `arbor`).
3. Provisions the plugin virtual environment at `$HOME/.omp/data/omp-mypai/venv` (containing `mypai_tools` and `omp-rpc`).
4. Imports default scheduled cron jobs from `submodules/omp-mypai/config/default_jobs.yaml` into the project SQLite database.
5. Executes `membank-ctl update` to initialize and auto-seed Hindsight long-term memory banks.

### 5. Launch Oh-my-PI

Launch the interactive PAI session:

```bash
omp
```

---


## Repository Structure

- `omp.env` — Sandbox launcher environment config
- `omp/agent/` — Target `~/.omp/agent/` configuration templates
  - `config.yml` — Main OMP configuration
  - `mcp.json` — Model Context Protocol servers
  - `models.yml` — Local model inference mapping
  - `agents/` — Custom agent roles
  - `commands/` — Custom slash commands
  - `extensions/` — Extension scripts
  - `memorybanks/` — Memory bank definitions (.json / .yaml)
  - `skills/` — Skill instruction packs
    - **`arbor`**: [SKILL.md](omp/agent/skills/arbor/SKILL.md) — Graph-native AST code intelligence and workspace navigation.
    - **`openadapt`**: [SKILL.md](omp/agent/skills/openadapt/SKILL.md) — Browser capture and UI automation.
- `submodules/`
  - `omp-mypai` — Core Oh-my-PI plugin (`bin/membank-ctl`, `mypai_tools`, skills, MCP, rules)
  - `agents-shared` — Shared Infrastructure, `sandbox-ctl`, Inference and model downloaders
  - `aur-packages` — Custom hardware-accelerated ROCm/HIP Arch Linux PKGBUILDs
  - `private-seeds` — Git-ignored directory for private credentials and seeds
- `research/` — Architecture reports, benchmarks, and research notes
- `scratch/` — Workspace for temporary files and checkout sources (`scratch/*-sources`)

## Modules

### Oh-my-PI myPAI Plugin (`submodules/omp-mypai`)

The `omp-mypai` submodule serves as the core extension plugin for Oh-my-PI. It includes:

- **CLI Control Utilities (`bin/membank-ctl`)**: Management CLI tool for Hindsight memory bank updates, JSON/YAML parsing, and exports.
- **Custom Python Tools (`mypai_tools`)**: Native tools installed directly into the plugin virtual environment (`$HOME/.omp/data/omp-mypai/venv`).
- **Model Context Protocol (MCP) Servers**:
  - `chat-channel`: Channel messaging MCP service (`mypai_tools.chat_mcp`).
  - `cron-scheduler`: Task & reminder background scheduling (`mypai_tools.cron_mcp`).
  - `local-speech`: Local speech synthesis & audio output (`mypai_tools.speech_mcp`).
- **Agent Definitions & System Prompts**: Specialized subagent profiles and operating procedures.

---

### Local Inference Services (`submodules/agents-shared`)

Local inference services run in background containers or user systemd services and are exposed through unified endpoints:

| Service | Protocol / Endpoint | Port | Configuration Setting (`omp.env` / `config.yml`) | Description |
|---|---|:---:|---|---|
| **Local Router** | OpenAI Compatible (`http://localhost:51080/v1`) | `51080` | `OPENAI_BASE_URL` | Unified routing for chat completions, embeddings, reranking, transcription, and image generation. |
| **Hindsight Memory** | REST API (`http://localhost:8888`) | `8888` | `HINDSIGHT_API_URL` / `hindsight.apiUrl` | Long-term vector memory recall, turn retention, and mental model reflection. |
| **Speech-to-Text** | OpenAI Audio (`http://localhost:50090/v1`) | `50090` | `stt.baseUrl` | Local Whisper/Speech-to-Text audio transcription. |
| **Text-to-Speech** | Local Neural / OpenAI (`http://localhost:50095/v1`) | `50095` | `providers.tts` | Speech synthesis for voice output (`omp say`). |
| **Image Generation** | OpenAI Images (`http://localhost:50100/v1`) | `50100` | `generate_image.enabled` | Local Z-Image-Turbo / Flux image generation. |

---

### Custom AUR Packages (`submodules/aur-packages`)

The `aur-packages` submodule contains custom Arch Linux PKGBUILDs designed specifically for ROCm/HIP hardware acceleration and bleeding-edge local inference:

- **`libggml-git-hip`**: Custom build of GGML, `llama.cpp`, `whisper.cpp`, and `stable-diffusion.cpp` linking dynamically against a single, system-wide `libggml-git-hip.so` shared library. Ensures consistent backend behavior and optimal RDNA2/RDNA3 HIP performance across all binaries.
- **`tei-rocm`**: Hugging Face Text Embeddings Inference (TEI) built with native ROCm/HIP support for low-latency embedding and reranking.
- **`mlc-llm`**: Machine Learning Compilation engine patched for ROCm hipBLAS API compatibility.
- **PyTorch ROCm Stack**: `python-torchao-rocm`, `python-torchaudio-rocm`, `python-torchvision-rocm`, `python-bitsandbytes-rocm-git`.
- **Agent Engines**: `hermes-agent-git`, `zeroclaw-git`, `librefang-git`, `moltis-git`, `picoclaw-git`, `oh-my-pi-git-tag`.

---

## Hindsight Memory Banks Configuration

Hindsight vector memory is natively integrated into OMP's orchestration engine:

- **Auto-Seeding**: Configured via `hindsight.mentalModelAutoSeed: true`. Built-in mental models (`principal-telos`, `user-preferences`, `project-conventions`, `project-decisions`, `active-initiatives-and-commitments`) are automatically seeded into the server on startup.
- **Project Scoping**: `per-project-tagged` scoping seamlessly merges global user preferences with project-specific memories on every recall query.
- **Idempotent Updates**: `membank-ctl update` inspects existing bank configurations via `GET /v1/default/banks/<bank_id>/config` and issues `PATCH`/`POST`/`DELETE` requests only when local definitions differ from server state. Supports JSON and YAML bank definitions.
  ```bash
  # Update memory banks and prune obsolete mental models on the server
  ./submodules/omp-mypai/bin/membank-ctl update "http://localhost:8888" ./omp/agent/memorybanks --yes --prune

  # Export a memory bank to JSON or YAML
  ./submodules/omp-mypai/bin/membank-ctl export "http://localhost:8888" oh-my-pi --yaml --out oh-my-pi.yaml
  ```

---

## Private Information Management (`submodules/private-seeds`)

Personal credentials, private memory seeds, and custom prompt overrides can be stored in `submodules/private-seeds/` using one of three workflows:

1. **Local Untracked Files**: Place private seed files directly into `submodules/private-seeds/`.
2. **Local-Only Git Repository**:
   ```bash
   cd submodules/private-seeds
   git init -b main
   git add . && git commit -m "Initial private seeds commit"
   ```
3. **Private Remote Submodule**:
   ```bash
   git submodule add git@github.com:yourusername/private-seeds.git submodules/private-seeds
   ```

*Note: All contents of `submodules/private-seeds/` (except `.gitkeep`) are git-ignored in the parent repository to prevent accidental credential leakage.*

