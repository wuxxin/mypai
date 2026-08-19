# mypai — my Personal-AI

**mypai** is a local, private, and experimental **Personal Artificial Intelligence (PAI)** infrastructure powered by:

- **Oh-my-PI** (`omp`) — High-performance agent execution harness with in-kernel `eval` and loopback tool bridge
- **amux** — Distributed control plane, process supervisor, durable scheduler, and inter-worker message bus
- **cc-connect** — Multi-platform external chat gateway (Signal, Telegram, Discord)
- **Agent of Empires** (`aoe`) — Visual TUI matrix, ACP inspector, and Web PWA cockpit
- **Hindsight** — Persistent vector memory, temporal observation tracking, and mental model reflection service

> [!TIP]
> - For a complete user guide, agent roster, skills, and command catalog, see [USAGE.md](USAGE.md).
> - For the exhaustive technical and architectural specification, see [references/mypai-spec.md](references/mypai-spec.md).

Core Architecture & Components:

- **`mypai_daemon`**: Central background coordinator, APScheduler engine, OMP RPC session host, turn-serializing event queue, and ACP intra-agent delegation manager.
- **Local Inference (`local-router`)**: Unified OpenAI-compatible API routing for chat, vision, embeddings, reranking, STT, TTS, and image generation.
- **Sandbox Containment (`sandbox-ctl`)**: Containerized sandbox isolation and automated sidecar process management.
- **ROCm/HIP Hardware Acceleration**: Custom Arch Linux PKGBUILD stack optimized for low-latency AMD GPU local inference.

Inspired by concepts from **LifeOS** and **OpenClaw** agent loops, `mypai` delivers a robust, autonomous, 24/7-capable background AI system.

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
1. Copies configuration templates from `./omp/agent/*` into `$HOME/.omp/agent/` for Base OMP.
2. Copies configuration templates from `./omp/profiles/mypai/*` into `$HOME/.omp/profiles/mypai/agent/` for the MyPai profile.
3. Provisions the managed Base Python virtual environment at `$HOME/.omp/python-env` (containing `omp-rpc`, `mypai_eval_runtime`, `arbor`, and `openadapt`).
4. Provisions the MyPai Profile Python virtual environment at `$HOME/.omp/profiles/mypai/python-env` (containing `omp-rpc`, `mypai_eval_runtime`, `httpx`, `pydantic`).
5. Executes `membank-ctl update` to provision and seed Hindsight memory banks for `oh-my-pi` and `mypai`.

### 5. Launch Oh-my-PI & MyPai Mesh

Launch interactive Base OMP session:

```bash
omp
```

Launch MyPai Profile session:

```bash
omp --profile mypai
```

Launch full autonomous multi-session mesh via `amux`:

```bash
amux-server --port 8824
```

---

## Repository Structure

- `omp.env` — Sandbox launcher environment config
- `omp/`
  - `agent/` — Target `~/.omp/agent/` configuration templates (Base OMP, bankId: `oh-my-pi`)
    - `config.yml` — Main Base OMP configuration
    - `mcp.json` — Base Model Context Protocol servers
    - `models.yml` — Local model inference mapping
    - `memorybanks/` — `oh-my-pi.yaml`
    - `agents/` — Reconciled subagent roster (`orchestrator`, `debugger`, `pythonista`, `writer`, `patcher`, `scout`, `task`, `reviewer`, `security-reviewer`, `designer`, `librarian`)
    - `skills/` — Engineering skill instruction packs (`ulw-plan`, `systematic-debugging`, `git-master`, `review-work`, `test-driven-development`, `arbor`, `openadapt`)
    - `commands/` — Custom slash command palette (`plan`, `ulw-plan`, `debug`, `review`, `git-master`, `scout`, `security`, `pythonista`, `writer`, `patch`, `learn`, `escalate`)
  - `profiles/`
    - `mypai/` — Target `~/.omp/profiles/mypai/agent/` configuration templates (MyPai Profile, bankId: `mypai`)
      - `config.yml` — MyPai Profile configuration (`bankId: mypai`)
      - `mcp.json` — Profile MCP servers
      - `models.yml` — Profile model mapping (`llama.cpp/qwen3`)
      - `memorybanks/` — `mypai.yaml` (LifeOS 8-model bank), `mypai-developer-profile.yaml`, `mypai-knowledge.yaml`
      - `agents/` — `mypai.md` (instructions for `mypai-workspace`, `mypai-channel`, `mypai-cron`)
- `submodules/`
  - `omp-mypai` — Core Oh-my-PI plugin (`bin/membank-ctl`, `mypai_eval_runtime`, skills, rules)
  - `agents-shared` — Shared Infrastructure, `sandbox-ctl`, Inference and model downloaders
  - `aur-packages` — Custom hardware-accelerated ROCm/HIP Arch Linux PKGBUILDs
  - `private-seeds` — Git-ignored directory for private credentials and seeds
- `research/` — Architecture reports, benchmarks, and research notes
- `scratch/` — Workspace for temporary files and checkout sources (`scratch/*-sources`)

## Modules

### In-Kernel Runtime Library (`mypai_eval_runtime`)

The `submodules/omp-mypai` submodule provides the in-kernel Python runtime library `mypai_eval_runtime`:

- **CLI Control Utilities (`bin/membank-ctl`)**: Management CLI tool for Hindsight memory bank updates, JSON/YAML parsing, and exports.
- **Inter-Worker Client (`amux`)**: High-performance HTTP client for structured inter-agent turn messaging, synchronous response polling, and Kanban card operations.
- **Memory Reflection Client (`hindsight`)**: Programmatic interface for vector memory recall, fact retention, and mental model reflection.
- **Trapped Error Diagnostics**: Automated error capture and diagnostic reporting across workspace, cron, and worker sessions.

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

