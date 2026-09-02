# mypai — Personal AI Harness (OMP + LifeOS)

**mypai** is a private, local-first **Personal Artificial Intelligence (PAI)** infrastructure integrating:

- **Oh-My-Pi (`omp`)** — High-performance agent execution harness with native tool orchestration, subagents, and capability discovery.
- **LifeOS** — Intent engineering platform and DA (Digital Assistant) system that articulates done, hill-climbs from current state to ideal state, and verifies claims via tool evidence.
- **Submodules Ecosystem**:
  - `submodules/agents-shared` — Local inference service wrappers (`local-router`, chat, embeddings, reranking, STT, TTS, image generation) and `sandbox-ctl` environment isolation.
  - `submodules/aur-packages` — Arch Linux PKGBUILDs and local packages.
- **Hindsight Memory** — Long-term vector memory, temporal observations, and auto-synthesized mental models via `bin/membank-ctl` on `:28888`.

---

## Architectural Trajectory & Evolution

The system has transitioned through three architectural generations:

| Generation | Primary Architecture | Status |
| :--- | :--- | :--- |
| **Gen 1 (Legacy-Legacy)** | `omp-mypai` monolithic FastAPI daemon (`:52080`), single serialized RPC queue, custom FastMCP signal tools. | **Retired / Fully Removed** |
| **Gen 2 (Transitional)** | `omp-aoe-amux-hindsight` multi-session mesh (`aoe` on `:28080`, `amux-server` on `:28824`, `cc-connect` on `:9810`, `mypai-channel`/`mypai-main`/`mypai-cron`). | **Retired / Inactive** *(Preserved for reference only)* |
| **Gen 3 (Active Trajectory)** | Direct **`oh-my-pi` (`omp`)** + **`LifeOS`** (`~/.omp/LIFEOS` with Pulse dashboard on `:31337`, `OmpHooksBridge.ts`), backed by **`submodules/agents-shared`** local inference and **Hindsight** memory. | **Active Target Architecture** |

---

## Core System Components

1. **Active Focus — LifeOS Integration (`~/.omp/LIFEOS` via `~/.claude` symlink)**:
   - Primary immediate engineering effort: layering LifeOS into OMP (basically working, actively undergoing adjustments).
   - Private user vault in `~/agent-private/lifeos` (`USER/`, `MEMORY/`, `TELOS/`).
   - Pulse dashboard and sidecar server on port `:31337` (`bun run pulse.ts`).
   - `OmpHooksBridge.ts` translating Claude Code hook events (`SessionStart`, `UserPromptSubmit`, `PostToolExecution`, `SessionEnd`) for OMP.
   - Utility inference compatibility via `bin/claude-shim`.

2. **Agent Harness (`omp/agent/`)**:
   - Base configuration (`config.yml`, `models.yml`, `lsp.json`).
   - Specialist agent roster (`agents/orchestrator.md`, `scout.md`, `debugger.md`, `reviewer.md`, `security-reviewer.md`, `task.md`, `writer.md`, `patcher.md`, `librarian.md`, `designer.md`).
   - Engineering skills (`skills/ulw-plan`, `systematic-debugging`, `git-master`, `review-work`, `test-driven-development`, `lilac`, `archlinux-pkgbuild`, `system-prompts`).
   - Claude Code hooks bridge extension (`extensions/OmpHooksBridge.ts`).
   - Memory bank seeds (`memorybanks/oh-my-pi.yaml`, `memorybanks/mypai.yaml`).

3. **Local Inference & Sandboxing (`submodules/agents-shared/`)**:
   - `local-router` on port `:21080` (OpenAI-compatible unified router for chat, embedding, rerank, vision, stt, tts, imagegen).
   - `sandbox-ctl` script for bubblewrap / systemd cgroup sandboxing and launcher generation using `omp.env`.

4. **Hindsight Long-Term Memory (`:28888`)**:
   - REST API on port `:28888`.
   - `bin/membank-ctl` management CLI for bank configuration updates and mental model synchronization.

5. **`mypai_runtime` (`src/mypai_runtime/`) [Target Component — Pending Port]**:
   - In-kernel Python runtime library planned for the target architecture.
   - **Current Status:** Not currently used or ported to work with the active OMP + LifeOS setup yet; porting is scheduled once LifeOS integration adjustments are stabilized.
---

## Setup & Installation

### Prerequisites

- **OS**: Arch Linux (or Arch-based distribution like Manjaro / CachyOS).
- **Hardware**: AMD GPU with ROCm/HIP support (or CUDA / CPU fallback).
- **Tooling**: `git`, `python3`, `uv` package manager, `bun`, `curl`, GNU `make`.

### 1. Clone Repository & Initialize Submodules

```bash
git clone --recursive https://github.com/wuxxin/mypai.git
cd mypai
```

### 2. Download Local AI Models

```bash
./submodules/agents-shared/scripts/local-download.sh /data/public/machine-learning/models --all
```

### 3. Provision Local Inference Services

```bash
./submodules/agents-shared/assistants/local-inference.sh install --new-config
```

### 4. Provision OMP Sandbox Environment

```bash
./submodules/agents-shared/scripts/sandbox-ctl install omp --no-start --new-config-from ./
```

### 5. Install & Layer LifeOS into OMP

```bash
./bin/install-lifeos install
```

### 6. Launch LifeOS under OMP

Launch using the configured shell alias:
```bash
lifeos
```
Or directly via OMP:
```bash
OMP_VOICE=0 LIFEOS_DIR=~/.claude/LIFEOS omp --append-system-prompt ~/.claude/LIFEOS/LIFEOS_SYSTEM_PROMPT.md
```

---

## Documentation Index

- [**`USAGE.md`**](USAGE.md) — Complete operational guide for OMP, LifeOS, subagents, and skills.
- [**`AGENTS.md`**](AGENTS.md) — System realities, agent operating guidelines, and code style.
- [**`references/lifeos-setup.md`**](references/lifeos-setup.md) — LifeOS topology, harness execution, and inference diagnostic reference.
- [**`references/omp-runtime-config.md`**](references/omp-runtime-config.md) — OMP runtime configuration, prompt layering, and subagent resolution.
- [**`references/omp-hindsight.md`**](references/omp-hindsight.md) — Hindsight memory bank integration and auto-learn distillation.
- [**`references/hindsight-memorybank.md`**](references/hindsight-memorybank.md) — Exhaustive Hindsight bank schema reference.

