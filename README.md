# mypai — my Personal-AI

**mypai** is a local, private, and experimental **Personal Artificial Intelligence (PAI)** infrastructure powered by:

- **Oh-my-PI** (`omp`) — High-performance agent execution harness with in-kernel `eval` and loopback tool bridge
- **Hindsight** — Persistent vector memory, temporal observation tracking, and mental model reflection service
- **amux** — Distributed control plane, process supervisor, durable scheduler, and inter-worker message bus
- **cc-connect** — Multi-platform external chat gateway (Signal, Telegram, Discord)
- **Agent of Empires** (`aoe`) — Visual TUI matrix, ACP inspector, and Web PWA cockpit

## Documentation

- User guide, agent roster, skills, and command catalog, see [USAGE.md](USAGE.md).
- myPAI Overview , see [references/mypai-overview.md](references/mypai-overview.md)
- Technical and architectural Specification, see [references/mypai-spec.md](references/mypai-spec.md).
- Testing, component test matrix, and Makefile reference, see [references/mypai-test.md](references/mypai-test.md)

## Components

- **`mypai_runtime`**: Unified in-kernel Python runtime library for inter-worker turn messaging, synchronous response polling, and Hindsight memory reflection.
- **Local Inference (`local-router`)**: Unified OpenAI-compatible API routing for chat, vision, embeddings, reranking, STT, TTS, and image generation.
- **Sandbox Containment (`sandbox-ctl`)**: Containerized sandbox isolation and automated sidecar process management.
- **ROCm/HIP Hardware Acceleration**: Custom Arch Linux PKGBUILD stack optimized for low-latency AMD GPU local inference.



---


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

`sandbox-ctl install` performs the following automated steps:
1. Copies configuration templates from `./omp/agent/*` into `$HOME/.omp/agent/` for Base OMP.
2. Copies configuration templates from `./omp/profiles/mypai/*` into `$HOME/.omp/profiles/mypai/agent/` for the MyPai profile.
3. Provisions the managed Base Python virtual environment at `$HOME/.omp/python-env` (containing `omp-rpc`, `mypai_runtime`, `arbor`, and `openadapt`).
4. Provisions the MyPai Profile Python virtual environment at `$HOME/.omp/profiles/mypai/python-env` (containing `omp-rpc`, `mypai_runtime`, `httpx`, `pydantic`).
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

## Development, Testing & Quality Automation

MyPAI ships with a comprehensive GNU Makefile automating test execution, type safety, and linting:

```bash
# Display all targets and runtime configuration
make help

# Provision local virtual environment with test tools
make buildenv

# Run all unit and end-to-end tests
make test

# Run tests with code coverage report
make coverage

# Run static type analysis and code linting
make typecheck
make lint

# Execute complete CI validation pipeline
make all
```

For complete details on test layers, E2E multi-session simulation, and component matrices, see [references/mypai-test.md](references/mypai-test.md).

---

## Repository Structure

```
mypai/
├── Makefile                         # Modern GNU Makefile (buildenv, test, lint, coverage)
├── pyproject.toml                   # Root package and test dependency definition
├── omp.env                          # Sandbox launcher & amux supervisor config
├── amux/                            # amux server env, starter templates & fleet hooks (~/.amux/)
│   ├── server.env                   # Process-level environment configuration
│   ├── templates/                   # Session starter templates (software-project, etc.)
│   └── hooks/                       # git-shared-guard.py, hook-report.sh
├── bin/
│   └── membank-ctl                  # Hindsight sync CLI utility
├── src/
│   └── mypai_runtime/               # In-Kernel Python runtime library
│       ├── __init__.py              # Exports amux, hindsight, diagnostics
│       ├── amux.py                  # Full REST API client & Kanban manager
│       ├── hindsight.py             # Memory reflection & retention client
│       └── diagnostics.py           # Trapped error analyzers
├── tests/
│   ├── conftest.py                  # Pytest fixtures and mock HTTP servers
│   ├── unit/                        # Unit tests for amux, hindsight, diagnostics, membank-ctl
│   └── e2e/                         # End-to-End multi-session workflow simulations
├── omp/
│   ├── agent/                       # Base OMP Profile (~/.omp/agent/)
│   │   ├── config.yml, models.yml, mcp.json
│   │   ├── memorybanks/             # oh-my-pi.yaml
│   │   ├── agents/                  # orchestrator, debugger, pythonista, writer, patcher, scout, ...
│   │   ├── skills/                  # ulw-plan, systematic-debugging, git-master, review-work, tdd
│   │   └── commands/                # plan, ulw-plan, debug, review, git, scout, security, ...
│   ├── profiles/
│   │   └── mypai/                   # MyPai Profile (~/.omp/profiles/mypai/agent/)
│   │       ├── config.yml, models.yml, mcp.json
│   │       ├── memorybanks/         # mypai.yaml (8-model LifeOS bank)
│   │       ├── agents/              # mypai.md (mypai-main, mypai-channel, mypai-cron)
│   │       └── commands/            # learn.md, reflect.md
│   └── sessions/                    # Canonical session starter instructions
│       ├── mypai-main/              # CLAUDE.md for central brain & orchestrator
│       ├── mypai-channel/           # CLAUDE.md for chat ingress gateway
│       └── mypai-cron/              # CLAUDE.md for automation reactor
├── submodules/
│   ├── agents-shared                # Shared infrastructure, sandbox-ctl, model downloaders
│   ├── aur-packages                 # Custom ROCm/HIP PKGBUILDs
│   └── private-seeds                # Private memory seeds and credentials
├── references/                      # mypai-spec.md, mypai-test.md, etc.
├── USAGE.md                         # Complete user & operator manual
└── README.md                        # Project landing page
```

---

## Modules

### In-Kernel Runtime Library (`mypai_runtime`)

The root `src/mypai_runtime` package provides the in-kernel Python runtime library:

- **CLI Control Utilities (`bin/membank-ctl`)**: Management CLI tool for Hindsight memory bank updates, JSON/YAML parsing, and exports.
- **Inter-Worker Client (`amux`)**: High-performance HTTP client for structured inter-agent turn messaging, synchronous response polling, and Kanban card operations.
- **Memory Reflection Client (`hindsight`)**: Programmatic REST interface for cross-bank vector memory recall, fact retention, and mental model reflection (for session default banks, in-process OMP loopback tools `tool.reflect()`, `tool.recall()`, `tool.retain()` are used).
- **Trapped Error Diagnostics**: Automated error capture and diagnostic reporting across main, cron, and worker sessions.

---

## Hindsight Memory Banks Configuration

Hindsight vector memory is natively integrated into OMP's orchestration engine:

- **Auto-Seeding**: Configured via `hindsight.mentalModelAutoSeed: true`. Built-in mental models are automatically seeded into the server on startup.
- **Project Scoping**: `per-project-tagged` scoping seamlessly merges global user preferences with project-specific memories on every recall query.
- **Idempotent Updates**: `bin/membank-ctl update` inspects existing bank configurations via `GET /v1/default/banks/<bank_id>/config` and issues `PATCH`/`POST`/`DELETE` requests only when local definitions differ from server state. Supports JSON and YAML bank definitions.
  ```bash
  # Update memory banks and prune obsolete mental models on the server
  ./bin/membank-ctl update "http://localhost:8888" ./omp/agent/memorybanks --yes --prune

  # Export a memory bank to JSON or YAML
  ./bin/membank-ctl export "http://localhost:8888" oh-my-pi --yaml --out oh-my-pi.yaml
  ```

---

## Private Information Management (`submodules/private-seeds`)

Personal credentials, private memory seeds, and custom prompt overrides can be stored in `submodules/private-seeds/`:

*Note: All contents of `submodules/private-seeds/` (except `.gitkeep`) are git-ignored in the parent repository to prevent accidental credential leakage.*

## About

Inspired by concepts from **LifeOS** and **OpenClaw** like agent loops, `mypai` delivers a robust, autonomous, 24/7-capable multi-session agent mesh.
