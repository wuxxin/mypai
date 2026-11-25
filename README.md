# mypai — a private, local-first **Personal AI Assistant**

- **LifeOS** — Intent engineering platform and DA (Digital Assistant) system that articulates done, hill-climbs from current state to ideal state, and verifies claims via tool evidence.
- **Oh-My-Pi (`omp`)** — High-performance agent execution harness with native tool orchestration, subagents, and extensibility.
- **Local inference service wrappers** `submodules/agents-shared` (local-router, chat, embeddings, reranking, STT, TTS, image generation) and `sandbox-ctl` environment isolation.
- **Arch Linux PKGBUILDs** for customized local inference and agents `submodules/aur-packages` binaries

---

## Core System Components

- **Local Inference & Sandboxing (`submodules/agents-shared/`)**:
    - `local-router` on port `:21080` (OpenAI-compatible unified router for chat, embedding, rerank, vision, stt, tts, imagegen).
    - `sandbox-ctl` script for bubblewrap / systemd cgroup sandboxing and harness launcher for generation using `omp.env`.
- **Agent Harness (`omp/agent/`)**:
    - Base configuration (`config.yml`, `models.yml`, `lsp.json`).
    - Specialist agent roster (`agents/orchestrator.md`, `scout.md`, `debugger.md`, `reviewer.md`, `security-reviewer.md`, `task.md`, `writer.md`, `patcher.md`, `librarian.md`, `designer.md`).
    - Engineering skills (`systematic-debugging`, `review-work`, `lilac`, `archlinux-pkgbuild`, `system-prompts`), MCP-backed tool-command skills (`arbor` code-graph intelligence, `openadapt` browser verification), the `german` language-style skill, and plugin bundles (`diagram-design-plugin`, `modern-web-guidance-plugin`).
    - Claude Code hooks bridge extension (`extensions/OmpHooksBridge.ts`).
- **LifeOS Integration (`~/.omp/LIFEOS` via `~/.claude` symlink)**:
    - Primary immediate engineering effort: layering LifeOS into OMP (basically working, actively undergoing adjustments).
    - Private data repo of record in `~/agent-private/lifeos` (v8 layout: `USER/` with `MEMORY/` under it, single-file `TELOS.md`; `LIFEOS_CONFIG_DIR` exported by the launcher).
    - Pulse dashboard on port `:31337`, supervised as the primary service of the systemd user unit `~/.config/systemd/user/omp.service` (`LAUNCHER_SERVICE_CMD` in `omp.env`; periodic jobs run as `[[job]]` entries in `USER/CONFIG/PULSE.user.toml` or via `bin/lifeos-workflows-tick.ts`).
    - `OmpHooksBridge.ts` translating Claude Code hook events (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`/`PostToolUseFailure`, `Stop`, `SessionEnd`, `PermissionRequest`) for OMP, with incremental transcript mirroring under `~/.claude/lifeos-bridge-transcripts/` and live per-session `session_id` isolation.
    - Utility inference compatibility via [`bin/claude-shim.py`](bin/claude-shim.py) (documented in [`docs/LIFEOS_OMP_ARCHITECTURE.md`](docs/LIFEOS_OMP_ARCHITECTURE.md)).

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

+ install arch and aur packages, build local packages

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

Deploy the LifeOS distribution payload per [`docs/LIFEOS_UPGRADE_RUNBOOK.md`](docs/LIFEOS_UPGRADE_RUNBOOK.md) (staged release tarball → `install/install.sh` bootstrap → `bun Tools/InstallAll.ts --yes ...` overlay → data-home re-link via `LinkUser.ts`/`ScaffoldUser.ts`/`Migrate.ts`). The omp profile + hooks bridge (`OmpHooksBridge.ts`) deploy through the sandboxed install hooks:

```bash
./submodules/agents-shared/scripts/sandbox-ctl install --new-config-from .   # run from this repo root
```

Headless bridge verification afterwards: `make bridge-test` / `make bridge-smoke`.

### 6. Launch LifeOS under OMP

```bash
lifeos        # bin/lifeos: exports OMP_VOICE/LIFEOS_DIR/LIFEOS_CWD/LIFEOS_CONFIG_DIR, execs omp --cwd ~/agent-private/lifeos
              # with the concatenated LifeOS system prompt + LIFEOS_OMP_APPEND_SYSTEM.md contract (when present)
```

---

## Ephemeral Execution (Zero Keyboard History & Session Data)

To perform research or execute tasks without recording shell command history, interactive prompt history, or session transcripts:

### Persistence Vectors & Countermeasures

| Layer | Persistent Location | Countermeasure |
| :--- | :--- | :--- |
| **Shell Command History** | `~/.bash_history` / `~/.zsh_history` | Leading space + `HISTFILE=/dev/null` |
| **Interactive Prompt History** | `~/.omp/agent/history.db` & `cache/composer.db` | Point `PI_CODING_AGENT_DIR` to ramdisk / temp directory |
| **Session Transcripts** | `~/.omp/agent/sessions/` (`session.jsonl`) | `--no-session` CLI flag |

### 1. Dedicated Wrappers (`bin/ephemeral-omp` & `bin/ephemeral-lifeos`)

`bin/ephemeral-omp` and `bin/ephemeral-lifeos` (copied to `~/.local/bin/` by `omp.env`) automate ephemeral containment:

- Sets `HISTFILE=/dev/null`
- Allocates an isolated scratch directory in `/tmp` for `PI_CODING_AGENT_DIR`
- Symlinks static configs (`config.yml`, `models.yml`, `lsp.json`, `mcp.json`, `extensions/`, `skills/`, `tools/`, `commands/`, `prompts/`, `APPEND_SYSTEM.md`, `RULES.md`) so existing models, tools, and append instructions remain fully active
- Passes `--no-session`, `--no-title`, `--no-judge` (judge calls would steal router slots from the main loop), and `--no-spotlight` (remote output-shaping aux service; nothing consumes shaped results in a one-shot run)
- Displays the `⚡ EPHEMERAL` statusline badge and `ephemeral` session tag via `OMP_EPHEMERAL=1`
- Unlinks and removes all traces from `/tmp` on exit (even in hotshell or real host `/tmp`)

```bash
# General ephemeral research session:
 ephemeral-omp

# One-shot non-interactive research query:
 ephemeral-omp -p "Analyze kernel seccomp filters for bwrap nesting"

# Ephemeral LifeOS session:
 ephemeral-lifeos
```
*(Note: The leading space prevents the invocation command from being recorded in shell history).*

### 2. Host Dispatcher Wrapper (`sandboxed-omp`)

To invoke sandboxed utilities seamlessly from the host outside the sandbox without relying on shell aliases (ensuring they work in scripts, subshells, desktop launchers, and terminal multiplexers):

#### 1. Install the `sandboxed-omp` host dispatcher
```bash
cat << 'EOF' > ~/.local/bin/sandboxed-omp
#!/usr/bin/env bash
set -euo pipefail

cmd="$(basename "$0")"

if [[ "$cmd" == "sandboxed-omp" ]]; then
    if [[ $# -eq 0 ]]; then
        exec sandbox-ctl run omp omp
    fi
    cmd="$1"
    shift
fi

target_bin="$HOME/.local/bin/$cmd"
if [[ "$cmd" == "omp" ]]; then
    target_bin="omp"
fi

exec sandbox-ctl run omp "$target_bin" "$@"
EOF
chmod +x ~/.local/bin/sandboxed-omp
```
*(Also available directly in the repository at `bin/sandboxed-omp`)*.

#### 2. Create host symlinks for each command
```bash
ln -sf ~/.local/bin/sandboxed-omp ~/.local/bin/lifeos
ln -sf ~/.local/bin/sandboxed-omp ~/.local/bin/ephemeral-omp
ln -sf ~/.local/bin/sandboxed-omp ~/.local/bin/ephemeral-lifeos
```

When any of `lifeos`, `ephemeral-omp`, or `ephemeral-lifeos` is called on the host, the symlink dispatches to `sandboxed-omp`, which dynamically routes to `$HOME/.local/bin/<cmd>` inside the sandbox with full environment isolation.

---

## Documentation Index

Build locally with `make docs` (MkDocs Material, `mkdocs.yml`) or browse directly in `docs/`:

- [**`AGENTS.md`**](AGENTS.md) — System realities, agent operating guidelines, and code style.
- [**`docs/USAGE.md`**](docs/USAGE.md) — Operational guide, repo layout, agent roster, skills, and slash commands.
- [**`docs/HOST_TOPOLOGY.md`**](docs/HOST_TOPOLOGY.md) — Linux host topology, data-home contract, canonical port map, VRAM allocation map, Pulse jobs & `lifeos-workflows-tick`.
- [**`docs/LIFEOS_OMP_ARCHITECTURE.md`**](docs/LIFEOS_OMP_ARCHITECTURE.md) — LifeOS-on-OMP architecture, `OmpHooksBridge.ts`, `claude-shim.py`, guard enforcement, web verification, and upgrade history.
- [**`docs/LIFEOS_UPGRADE_RUNBOOK.md`**](docs/LIFEOS_UPGRADE_RUNBOOK.md) — Step-by-step LifeOS payload upgrade procedure and overlay diffing.
- [**`docs/OMP_RUNTIME.md`**](docs/OMP_RUNTIME.md) — `omp` 19.1.1+ runtime configuration, prompt assembly, `eval` loopback bridge, `omp_rpc` Python SDK, Mnemopi memory, and retired Hindsight fallback.
- [**`docs/TODO.md`**](docs/TODO.md) — Research backlog, candidate models, MCP servers, and skills.

