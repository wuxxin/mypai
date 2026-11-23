# MyPAI Operational Guide & Repository Layout

Operational guide for **MyPAI** — running **Oh-My-Pi (`omp` 19.1.1+)** as the execution harness layered with **LifeOS** on a local-first Linux host.

---

## 1. Repository Layout

| Path | Role |
| :--- | :--- |
| `omp/agent/` | **Canonical source of truth** for the host `omp` profile (`config.yml`, `models.yml`, `lsp.json`, `agents/`, `commands/`, `skills/`, `extensions/`, `plugins/`, `memorybanks/`). Live `~/.omp` is a derived copy synced via `sandbox-ctl install omp --new-config-from .`. |
| `omp.env` | Sandbox launcher configuration: mounts, exported env vars (`LIFEOS_DIR`, `LIFEOS_CWD`, `LIFEOS_CONFIG_DIR`, `LIFEOS_TOOLS_MODEL_NAME`, `OPENAI_BASE_URL`), `omp.service` Pulse primary service, and install/uninstall hooks. |
| `bin/` | Host & sandbox launchers: `lifeos`, `ephemeral-omp`, `ephemeral-lifeos`, `sandboxed-omp`, `claude-shim.py` (installed as `~/.local/bin/claude`), `lifeos-workflows-tick.ts` (Pulse-hosted WORKFLOWS clock bridge), and `membank-ctl` (retired Hindsight fallback). |
| `src/omp-lifeos-overlay/` | Shadow copy + `MANIFEST.md` of host-owned (non-stock) LifeOS source modifications, regenerated via its `tools/` against each upstream LifeOS release tarball. |
| `src/mypai_runtime/`, `tests/` | Legacy Python runtime package (currently unused; removal/refactoring deferred until LifeOS integration settles). |
| `submodules/agents-shared` | Local inference service wrappers (`local-router` on `:21080`, chat, embedding, rerank, STT, TTS, imagegen) and `sandbox-ctl` container/systemd isolation. |
| `submodules/aur-packages` | Custom Arch Linux PKGBUILDs (notably `oh-my-pi-git` — its `src/oh-my-pi/` checkout is the ground truth for installed `omp` behavior). |
| `docs/` | Consolidated system documentation (this directory). |

---

## 2. Launching & Operating LifeOS under `omp`

### Interactive Launch
```bash
lifeos
```
`bin/lifeos` exports `OMP_VOICE=0`, `LIFEOS_DIR`, `LIFEOS_CWD`, and `LIFEOS_CONFIG_DIR`, then execs `omp --cwd "$LIFEOS_CWD"` with the concatenated LifeOS system prompt + `~/.omp/agent/LIFEOS_OMP_APPEND_SYSTEM.md`. Standard `omp` flags pass through (`--offline`, `--no-judge`, `--resume`, etc.).

### Ephemeral Sessions (Zero History & Transcripts)
`bin/ephemeral-omp` and `bin/ephemeral-lifeos` run with `HISTFILE=/dev/null`, a disposable `/tmp` `PI_CODING_AGENT_DIR`, `--no-session`, `--no-title`, `--no-judge`, `--no-spotlight`, and `OMP_EPHEMERAL=1` (rendering the `⚡ EPHEMERAL` badge), cleaning up `/tmp` on exit:
```bash
 ephemeral-omp
 ephemeral-omp -p "One-shot query"
 ephemeral-lifeos
```
*(Leading space keeps the invocation out of shell history.)*

### Host Dispatcher (`bin/sandboxed-omp`)
Install `bin/sandboxed-omp` to `~/.local/bin/sandboxed-omp` and symlink `lifeos`, `ephemeral-omp`, and `ephemeral-lifeos` to it so host terminals, scripts, and desktop launchers transparently enter the `omp` sandbox.

### Managing Pulse (`:31337`)
Pulse runs supervised as the **primary service** of the systemd user unit `~/.config/systemd/user/omp.service` (`Restart=always`, configured via `LAUNCHER_SERVICE_CMD` in `omp.env`). Periodic jobs run as `[[job]]` entries in `USER/CONFIG/PULSE.user.toml` (or via the single `workflows-clock` job calling `lifeos-workflows-tick`):
```bash
systemctl --user status omp.service
# Dashboard: http://localhost:31337
```
> **Caveat:** `pulse.ts` ignores `SIGTERM`/`SIGINT` (manual stop requires `SIGKILL`) and refuses a second instance on `:31337` — confirm the old PID is gone before restarting.

### Syncing Profile & Verifying Hooks
From the `mypai` repository root:
```bash
./submodules/agents-shared/scripts/sandbox-ctl install omp --new-config-from .
make bridge-test    # hermetic Bun behavior suite
make bridge-smoke   # end-to-end headless hook audit probe
```
For upgrading the LifeOS payload itself, follow [`LIFEOS_UPGRADE_RUNBOOK.md`](LIFEOS_UPGRADE_RUNBOOK.md).

---

## 3. Specialist Agent Roster

Delegate isolated subtasks via `task(agent: "...")` or `@<role>`:

| Agent | Role | Primary Scope |
| :--- | :--- | :--- |
| **`@orchestrator`** | Main Coordinator | Epic planning (`propose`), subagent delegation, diff verification (symlinked to `APPEND_SYSTEM.md`). |
| **`@scout`** | Codebase Mapper | Fast read-only symbol discovery, AST queries (`ast_grep`), dependency mapping. |
| **`@debugger`** | Root-Cause Forensic | 4-phase systematic debugging, DAP (`debug`), crash/log forensics. |
| **`@reviewer`** | Code & Safety Reviewer | Multi-perspective review, `pr://` / `github` diff inspection, P0–P3 findings. |
| **`@security-reviewer`** | Security Auditor | Tainted data-flow checks, authorization invariants, `security_scan`. |
| **`@task`** | Implementation Worker | Multi-file implementation, `lsp` refactors, `ast_edit` (`resolve`/`reject`), tests. |
| **`@writer`** | Docs & Memory | Technical docs, OpenAPI schemas, changelogs, Mnemopi `recall`/`retain`/`reflect`. |
| **`@librarian`** | External Source Researcher | Upstream API/source verification via `github` and `issue://`/`pr://`. |
| **`@designer`** | UI/UX Specialist | Token-first styling, accessibility, real-surface `browser` verification, `generate_image`. |
| **`@patcher`** | Mechanical Patcher | Fast single-file edits, typos, narrow `ast_edit` codemods. |

---

## 4. Skills & Custom Slash Commands

### Core Engineering Skills (`omp/agent/skills/`)
- `systematic-debugging` — Reproduce → Isolate → Hypothesize → Fix & Verify.
- `review-work` — Multi-pass review rubric (P0–P3).
- `lilac`, `archlinux-pkgbuild` — Arch Linux packaging and Lilac build automation.
- `system-prompts` — Prompt and agent-spec authoring.
- `arbor` — Graph-native code intelligence (`arbor --help` / `mcp__arbor__*`).
- `openadapt` — Headless browser DOM inspection & automation (`openadapt --help` / `mcp__openadapt__*`).
- `german` — Natural German prose style.
- **Plugin bundles (`omp/agent/plugins/`):** `diagram-design-plugin`, `modern-web-guidance-plugin` (`modern-web-guidance`, `chrome-extensions`).

### Slash Commands (`omp/agent/commands/` & Built-ins)
- `/debug`, `/patch`, `/scout`, `/security-review`, `/source-review`, `/writer` — Custom specialist workflow commands.
- `/plan` — Native plan mode (submits via the `propose` tool command).
- `/learn` — Distill turn insights into Mnemopi long-term memory.
- `/bridge-stats on|off` — Toggle rendering of `OmpHooksBridge` per-turn stats rows (hidden by default; set `OMP_BRIDGE_STATS=1` to start visible).

---

## 5. Local Inference & Retired Hindsight Fallback

```bash
# Download local weights (LLM, vision, embeddings, rerank, STT, TTS, imagegen)
./submodules/agents-shared/scripts/local-download.sh /data/public/machine-learning/models --all

# Provision & start local inference daemons
./submodules/agents-shared/assistants/local-inference.sh install --new-config

# Verify unified local router (:21080)
curl http://localhost:21080/v1/models
```

Primary long-term memory is `omp`'s internal **Mnemopi** store (`qwen3-embedding` via `:21080`). Hindsight (`:28888`, `bin/membank-ctl`) is retired and kept only as an inactive fallback — see [`OMP_RUNTIME.md`](OMP_RUNTIME.md#4-active-long-term-memory-mnemopi).
