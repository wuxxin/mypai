# mypai — Personal AI Harness (OMP + LifeOS)

**mypai** is a private, local-first **Personal Artificial Intelligence (PAI)** infrastructure integrating:

- **Oh-My-Pi (`omp`)** — High-performance agent execution harness with native tool orchestration, subagents, and capability discovery.
- **LifeOS** — Intent engineering platform and DA (Digital Assistant) system that articulates done, hill-climbs from current state to ideal state, and verifies claims via tool evidence.
- **Submodules Ecosystem**:
  - `submodules/agents-shared` — Local inference service wrappers (`local-router`, chat, embeddings, reranking, STT, TTS, image generation) and `sandbox-ctl` environment isolation.
  - `submodules/aur-packages` — Arch Linux PKGBUILDs and local packages.
- **Hindsight Memory** — Long-term vector memory, temporal observations, and auto-synthesized mental models via `bin/membank-ctl` on `:28888`.

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

Launch using the dedicated launcher script (`bin/lifeos`, installed to `~/.local/bin/lifeos` via `omp.env`):
```bash
lifeos
```
Or directly via OMP:
```bash
OMP_VOICE=0 LIFEOS_DIR=~/.claude/LIFEOS omp --cwd ~/agent-private/lifeos --append-system-prompt ~/.claude/LIFEOS/LIFEOS_SYSTEM_PROMPT.md
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
- Symlinks static configs (`config.yml`, `models.yml`, `skills/`, `tools/`, `extensions/`, `APPEND_SYSTEM.md`) so existing models, tools, and append instructions remain fully active
- Passes `--no-session` and `--no-title`
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

### 2. Manual One-Liner (RAM-backed, Zero Trace)

If invoking directly without the wrapper scripts:

```bash
 (
    tmpdir=$(mktemp -d "${XDG_RUNTIME_DIR:-/dev/shm}/omp-XXXXXX")
    trap 'rm -rf "$tmpdir"' EXIT INT TERM
    HISTFILE=/dev/null PI_CODING_AGENT_DIR="$tmpdir" omp --no-session
)
```

### 3. Host Dispatcher Wrapper (`sandboxed-omp`)

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

- [**`USAGE.md`**](USAGE.md) — Complete operational guide for OMP, LifeOS, subagents, and skills.
- [**`AGENTS.md`**](AGENTS.md) — System realities, agent operating guidelines, and code style.
- [**`references/lifeos-setup.md`**](references/lifeos-setup.md) — LifeOS topology, harness execution, and inference diagnostic reference.
- [**`references/omp-runtime-config.md`**](references/omp-runtime-config.md) — OMP runtime configuration, prompt layering, and subagent resolution.
- [**`references/omp-hindsight.md`**](references/omp-hindsight.md) — Hindsight memory bank integration and auto-learn distillation.
- [**`references/hindsight-memorybank.md`**](references/hindsight-memorybank.md) — Exhaustive Hindsight bank schema reference.

