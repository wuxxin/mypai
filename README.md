# mypai — my Personal-AI

Local, Private, Experimental, and Opinionated Personal Artificial Intelligence (PAI) infrastructure based on **Oh-my-PI** (`omp`) and **Hindsight** long-term vector memory.

`mypai` provides a complete local multi-agent orchestration harness, integrated local OpenAI-compatible inference routing (`local-router`), containerized sandbox containment (`sandbox-ctl`), and custom ROCm/HIP hardware-accelerated binaries.

---

## Table of Contents

- [Architecture & Submodules](#architecture--submodules)
- [Setup & Installation](#setup--installation)
  - [1. Clone Repository & Initialize Submodules](#1-clone-repository--initialize-submodules)
  - [2. Download Local AI Models](#2-download-local-ai-models)
  - [3. Provision Sandbox Environment](#3-provision-sandbox-environment)
  - [4. Launch Oh-my-PI](#4-launch-oh-my-pi)
- [Oh-my-PI Plugin (`submodules/omp-mypai`)](#oh-my-pi-plugin-submodulesomp-mypai)
- [Local Inference Services (`submodules/agents-shared`)](#local-inference-services-submodulesagents-shared)
- [Custom AUR Packages (`submodules/aur-packages`)](#custom-aur-packages-submodulesaur-packages)
- [Hindsight Long-Term Memory Configuration](#hindsight-long-term-memory-configuration)
- [Private Information Management (`submodules/private-seeds`)](#private-information-management-submodulesprivate-seeds)
- [Repository Structure](#repository-structure)
- [Workspace Isolation Guidelines](#workspace-isolation-guidelines)

---

## Architecture & Submodules

`mypai` is composed of a core configuration layer and specialized submodules:

| Submodule Path | Repository | Purpose |
|---|---|---|
| `submodules/omp-mypai` | [omp-mypai](https://github.com/wuxxin/omp-mypai) | Main **Oh-my-PI plugin** providing custom agents, tools (`mypai_tools`), MCP services, skills, and execution rules. |
| `submodules/agents-shared` | [agents-shared](https://github.com/wuxxin/agents-shared) | Shared infrastructure: sandbox control scripts (`sandbox-ctl`), inference service wrappers, benchmark tools, and model downloaders. |
| `submodules/aur-packages` | [aur-packages](https://github.com/wuxxin/aur-packages) | Private Arch User Repository (AUR) PKGBUILDs for hardware-accelerated dependencies (e.g. `libggml-git-hip`, `tei-rocm`, `mlc-llm`) tailored for ROCm/HIP local inference. |
| `submodules/private-seeds` | *Private / Local* | Git-ignored directory for managing personal mental models, credentials, and private seed data. |

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

### 3. Provision Sandbox Environment

Provision the sandbox environment and generate the `omp` binary launcher in `~/.local/bin` using `sandbox-ctl`:

```bash
./submodules/agents-shared/scripts/sandbox-ctl install omp --no-start --new-config-from ./omp.env
```

`sandbox-ctl install` performs the following automated steps:
1. Copies configuration files from `sandbox-templates/omp/omp/*` into `$HOME/.omp/`.
2. Creates a dedicated Python virtual environment at `$HOME/.omp/venv`.
3. Installs `mypai_tools` python package into the sandbox environment.
4. Installs required tools (`arbor-agent[mcp]`, `openadapt[browser,capture]`).
5. Executes `update-memory-banks.sh` to initialize and auto-seed Hindsight long-term memory banks.

### 4. Launch Oh-my-PI

Launch the interactive PAI session:

```bash
omp
```

---

## Oh-my-PI Plugin (`submodules/omp-mypai`)

The `omp-mypai` submodule serves as the core extension plugin for Oh-my-PI. It includes:

- **Custom Python Tools (`mypai_tools`)**: Native tools installed directly into the sandbox virtual environment (`$HOME/.omp/venv`).
- **Model Context Protocol (MCP) Servers**:
  - `arbor`: File and system management MCP service.
  - `chat-channel`: Channel messaging MCP service (`mypai_tools.chat_mcp`).
  - `cron-scheduler`: Task & reminder background scheduling (`mypai_tools.cron_mcp`).
  - `local-speech`: Local speech synthesis & audio output (`mypai_tools.speech_mcp`).
- **Agent Definitions & System Prompts**: Specialized subagent profiles and operating procedures.

---

## Local Inference Services (`submodules/agents-shared`)

Local inference services run in background containers or user systemd services and are exposed through unified endpoints:

| Service | Protocol / Endpoint | Port | Configuration Setting (`omp.env` / `config.yml`) | Description |
|---|---|:---:|---|---|
| **Local Router** | OpenAI Compatible (`http://localhost:51080/v1`) | `51080` | `OPENAI_BASE_URL` | Unified routing for chat completions, embeddings, reranking, transcription, and image generation. |
| **Hindsight Memory** | REST API (`http://localhost:8888`) | `8888` | `HINDSIGHT_API_URL` / `hindsight.apiUrl` | Long-term vector memory recall, turn retention, and mental model reflection. |
| **Speech-to-Text** | OpenAI Audio (`http://localhost:50090/v1`) | `50090` | `stt.baseUrl` | Local Whisper/Speech-to-Text audio transcription. |
| **Text-to-Speech** | Local Neural / OpenAI (`http://localhost:50095/v1`) | `50095` | `providers.tts` | Speech synthesis for voice output (`omp say`). |
| **Image Generation** | OpenAI Images (`http://localhost:50100/v1`) | `50100` | `generate_image.enabled` | Local Z-Image-Turbo / Flux image generation. |

---

## Custom AUR Packages (`submodules/aur-packages`)

The `aur-packages` submodule contains custom Arch Linux PKGBUILDs designed specifically for ROCm/HIP hardware acceleration and bleeding-edge local inference:

- **`libggml-git-hip`**: Custom build of GGML, `llama.cpp`, `whisper.cpp`, and `stable-diffusion.cpp` linking dynamically against a single, system-wide `libggml-git-hip.so` shared library. Ensures consistent backend behavior and optimal RDNA2/RDNA3 HIP performance across all binaries.
- **`tei-rocm`**: Hugging Face Text Embeddings Inference (TEI) built with native ROCm/HIP support for low-latency embedding and reranking.
- **`mlc-llm`**: Machine Learning Compilation engine patched for ROCm hipBLAS API compatibility.
- **PyTorch ROCm Stack**: `python-torchao-rocm`, `python-torchaudio-rocm`, `python-torchvision-rocm`, `python-bitsandbytes-rocm-git`.
- **Agent Engines**: `hermes-agent-git`, `zeroclaw-git`, `librefang-git`, `moltis-git`, `picoclaw-git`, `oh-my-pi-git-tag`.

---

## Hindsight Long-Term Memory Configuration

Hindsight vector memory is natively integrated into OMP's orchestration engine:

- **Auto-Seeding**: Configured via `hindsight.mentalModelAutoSeed: true`. Built-in mental models (`principal-telos`, `user-preferences`, `project-conventions`, `project-decisions`, `active-initiatives-and-commitments`) are automatically seeded into the server on startup.
- **Project Scoping**: `per-project-tagged` scoping seamlessly merges global user preferences with project-specific memories on every recall query.
- **Idempotent Updates**: `update-memory-banks.sh` inspects existing bank configurations via `GET /v1/default/banks/<bank_id>/config` and issues `PATCH`/`POST`/`DELETE` requests only when local definitions differ from server state.
  ```bash
  # Prune obsolete mental models on the server
  ./submodules/omp-mypai/agent/update-memory-banks.sh ./omp/agent/hindsight-bankconfig "http://localhost:8888" --prune
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

---

## Repository Structure

- `omp.env` — Sandbox launcher environment config
- `omp/agent/` — Target `~/.omp/agent/` templates (`config.yml`, commands, extensions)
- `submodules/`
  - `agents-shared` — Infrastructure, `sandbox-ctl`, and model downloaders
  - `aur-packages` — Custom ROCm/HIP Arch Linux PKGBUILDs
  - `omp-mypai` — Core Oh-my-PI plugin (tools, MCP, rules)
  - `private-seeds` — Git-ignored directory for private credentials and seeds
- `research/` — Architecture reports, benchmarks, and research notes
- `scratch/` — Workspace for temporary files and checkout sources (`scratch/*-sources`)

---

## Workspace Isolation Guidelines

When working in this repository or any of its submodules:

- **Workspace Isolation**: Always use `scratch/` for temporary files, build logs, and git checkouts (`scratch/*-sources`).
- **Submodule Behavior**:
  - If operating within a **submodule checkout**, agents and tools must defer to the top-level parent repository's root `scratch/` directory (`mypai/scratch/`).
  - If operating within a **standalone checkout** of a submodule, use the local repository's root `./scratch/`.
