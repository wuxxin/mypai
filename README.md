# mypai --- my Personal-AI

Complete configuration for Oh-my-PI (`omp`) with multi-agent orchestration, local OpenAI-compatible inference routing (`local-router`), native Hindsight long-term memory and additional MCP Services.

## Setup, Installation, and Teardown

Dependencies:
- Uses `~/agent-shared/code/agents-shared` for sandboxctl
- 
### 1. Create and Provision Sandbox

Run `sandbox-ctl` from `agents-shared/scripts/` to provision the sandbox environment and create the `omp` binary launcher in `~/.local/bin`:

```bash
sandbox-ctl install omp --no-start --new-config-from ./omp.env
```

Running `sandbox-ctl install` automatically recursively copies `sandbox-templates/omp/omp/*` into `$HOME/.omp/` and executes 'LAUNCHER_UNINSTALL_CMDS' and `LAUNCHER_INSTALL_CMDS`.

### 2. Start Oh-my-PI

```bash
omp
```

## Repo Directory Structure

- omp.env                   # sandbox-ctl environment config
- omp/agent/                # resolves to ~/.omp/agent on target
  - agents/                 # Custom subagents (*.md)
  - commands/               # Custom slash commands & macros
  - config.yml              # OMP main engine configuration
  - extensions/             # OMP plugins & extension modules
- research                  # Research Findings
- scratch/                  # temporary workdir
- submodules/                # Submodules (omp-mypai, agents-shared) & private-seeds

## Configured Local Services & Environment

| Service | Protocol / Endpoint | Port | Environment Variable / Setting | Purpose |
|---|---|:---:|---|---|
| **Local Router** | OpenAI Compatible (`http://localhost:51080/v1`) | `51080` | `OPENAI_BASE_URL` in `omp.env` | Unified routing for chat completions, embeddings, reranking, transcription, speech, and image generation. |
| **Hindsight Memory** | REST API (`http://localhost:8888`) | `8888` | `HINDSIGHT_API_URL` & `hindsight.apiUrl` in `config.yml` | Long-term vector memory recall, turn retention, and mental model reflection. |
| **Speech-to-Text** | OpenAI Audio (`http://localhost:50090/v1`) | `50090` | `stt.enabled` in `config.yml` | Local speech-to-text audio transcription. |
| **Text-to-Speech** | Local Neural Kokoro / OpenAI (`http://localhost:50095/v1`) | `50095` | `providers.tts` in `config.yml` | Speech synthesis for `omp say` and voice output. |
| **Image Generation** | OpenAI Images (`http://localhost:50100/v1`) | `50100` | `generate_image.enabled` in `config.yml` | Local image generation. |


## Hindsight Bank Configuration & Auto-Seeding

Hindsight long-term memory is natively integrated into OMP's core engine:

- **Auto-Seeding**: Enabled via `hindsight.mentalModelAutoSeed: true`. OMP automatically creates built-in seed mental models (`principal-telos`, `user-preferences`, `project-conventions`, `project-decisions`, `active-initiatives-and-commitments`) on the server at session start.
- **Scoping**: `per-project-tagged` ensures global memories and project-specific memories are seamlessly merged on recall.
- **Smart Idempotent Updates**: `update-memory-banks.sh` inspects existing bank configs and mental models via `GET /v1/default/banks/<bank_id>/config` and `GET /v1/default/banks/<bank_id>/mental-models`. It issues `PATCH`/`POST`/`DELETE` requests **only when local definitions differ from server state**. Pass `--prune` to remove leftover mental models on the server.

### Private Information Seeding (Optional)

You can manage personal or private seeds in `submodules/private-seeds/` in three ways:

1. **Local Un-tracked Files**: Copy seed files directly into `submodules/private-seeds/`.
2. **Local-Only Git Repository**: Initialize an independent local Git repository:
   ```bash
   cd submodules/private-seeds && git init -b main
   git add . && git commit -m "initial local seeds commit"
   ```
3. **Private Submodule**: Clone your private remote seeds repository as a Git submodule:
   ```bash
   git submodule add git@github.com:yourusername/private-seeds.git submodules/private-seeds
   ```

*Note: Contents of `submodules/private-seeds/` (including nested local `.git` repos) are git-ignored (except `.gitkeep`) to guarantee your private seeds are never committed.*



