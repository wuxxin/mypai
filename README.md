# mypai — my Personal-AI

**mypai** is an experimental, local, private **Personal Artificial Intelligence (PAI)** infrastructure powered by:

- **Oh-my-PI** (`omp`) — High-performance agent execution engine
- **LifeOS** (`LifeOS`) — An intent engineering platform that moves you from your current state to your ideal state, in life and work.

## Low Level Components

- **Local Inference (`local-router`)**: Unified OpenAI-compatible API routing for chat, vision, embeddings, reranking, STT, TTS, and image generation.
- **Sandbox Containment (`sandbox-ctl`)**: Containerized sandbox isolation and automated sidecar process management.
- **ROCm/HIP Hardware Acceleration**: Custom Arch Linux PKGBUILD stack optimized for low-latency AMD GPU local inference.

## Setup & Installation

### Prerequisites

- **OS**: Arch Linux (or Arch-based distribution) recommended for `aur-packages`.
- **Hardware**: AMD GPU with ROCm/HIP support (or CUDA/CPU fallback).
- **Tooling**: `git`, `python3`, `uv` package manager, `curl`, GNU `make`.

### 1. Clone Repository & Initialize Submodules

```bash
git clone --recursive https://github.com/wuxxin/mypai.git
cd mypai
```

### 2. Download Local AI Models

Download required LLM, vision, embedding, reranking, STT, and TTS models using the automated downloader script from `agents-shared`:

```bash
./submodules/agents-shared/scripts/local-download.sh /data/public/machine-learning/models --all
```

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

`sandbox-ctl install` performs installing and configuring the oh-my-pi environment.

---
