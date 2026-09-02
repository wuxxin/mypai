# MyPAI & Oh-My-Pi (OMP) + LifeOS Operational Guide

This guide explains how to operate, develop with, and configure **MyPAI** using **Oh-My-Pi (`omp`)**, **LifeOS**, and **Hindsight Memory**.

---

## 1. System Architecture & Operating Model

MyPAI combines **Oh-My-Pi (`omp`)** as the high-performance agent execution harness with **LifeOS** as the cognitive intent engineering platform:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HOST WORKSPACE                                 │
│                                                                             │
│   ~/.claude ────────► (Symlink) ────────► ~/.omp                            │
│                                                │                            │
│                                                ├── LIFEOS/ (Framework Core) │
│                                                │    ├── PULSE/ (:31337)     │
│                                                │    ├── TOOLS/              │
│                                                │    ├── USER ──┐ (Symlink)  │
│                                                │    └── MEMORY ┘            │
│                                                │           │                │
│   ~/agent-private/lifeos ◄─────────────────────┴───────────┘                │
│     (Private User Vault: TELOS, Identity, Long-Term Memory)                 │
│                                                                             │
│   OMP Base Profile (~/.omp/agent/)                                          │
│     ├── config.yml & models.yml                                             │
│     ├── agents/ (@orchestrator, @scout, @debugger, @reviewer, @task, ...)   │
│     ├── skills/ (ulw-plan, systematic-debugging, git-master, review-work)   │
│     ├── extensions/ (OmpHooksBridge.ts -> LifeOS Hooks)                     │
│     └── memorybanks/ (oh-my-pi.yaml, mypai.yaml)                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Components:

1. **Oh-My-Pi (`omp`)**: The primary execution harness driving interactive CLI sessions, task subagents (`task(agent: "...")`), internal tool devices (`xd://`), and in-kernel Python runtimes (`eval`).
2. **LifeOS (`~/.omp/LIFEOS`)**: Intent engineering platform running the Algorithm, TELOS alignment, and Pulse dashboard on port `:31337`.
3. **`OmpHooksBridge.ts`**: Extension bridging Claude Code hook events (`SessionStart`, `UserPromptSubmit`, `PostToolExecution`, `SessionEnd`) to OMP native extension hooks.
4. **Local Inference Services (`submodules/agents-shared/`)**: Local model routing (`local-router` on `:21080`), chat, embeddings, reranking, STT, and TTS.
5. **Hindsight Memory (`:28888`)**: Long-term vector memory, observation consolidation, and mental models synced via `bin/membank-ctl`.

---

## 2. Launching & Operating LifeOS with OMP

### Quick Launch

Use the configured shell alias:
```bash
lifeos
```

Or execute directly:
```bash
OMP_VOICE=0 LIFEOS_DIR=~/.claude/LIFEOS omp --append-system-prompt ~/.claude/LIFEOS/LIFEOS_SYSTEM_PROMPT.md
```

### Managing the Pulse Dashboard

Pulse provides observability, work kanban, wiki, voice notifications, and system health on port `:31337`:

```bash
# Start Pulse dashboard
cd ~/.claude/LIFEOS/PULSE && bun run pulse.ts

# Open in browser:
# http://localhost:31337
```

### Re-Deploying & Managing LifeOS

To deploy, update, or uninstall the LifeOS scaffold in OMP:
```bash
# Idempotent install / update:
./bin/install-lifeos install

# Uninstall (preserves private user data):
./bin/install-lifeos uninstall
```

---

## 3. Specialist Agent Roster & Delegation

When interacting with Oh-My-Pi, delegate tasks to specialized subagents using `@<role>` or the `task` tool:

| Subagent | Role | Best Used For |
| :--- | :--- | :--- |
| **`@orchestrator`** | **Main Project Coordinator** | Epic planning, subagent delegation, diff validation, and strategic escalation. Default entry point. |
| **`@scout`** | **Discovery & Codebase Mapper** | Fast read-only symbol discovery, dependency tree mapping, AST grep searches. |
| **`@debugger`** | **Forensic Root-Cause Investigator** | 4-phase systematic debugging, stack trace analysis, memory profiling, and hypothesis testing. |
| **`@reviewer`** | **Code Quality & Safety Reviewer** | Multi-perspective code review, cross-boundary dispatch verification, P0–P3 structured findings. |
| **`@security-reviewer`** | **Vulnerability Scanner** | Invariant validation, tainted data flow analysis, broken authorization, and CVE detection. |
| **`@task`** | **General Implementation Worker** | Multi-language feature implementation, refactoring, and multi-file editing. |
| **`@writer`** | **Documentation & Memory Craftsman** | Technical documentation, OpenAPI schemas, changelogs, and memory bank distillation. |
| **`@librarian`** | **External API & Source Researcher** | Clones and inspects upstream source repos to verify API signatures and ground facts in truth. |
| **`@designer`** | **UI/UX & Design System Specialist** | Token-first CSS/HTML styling, responsive layouts, accessibility (a11y), visual consistency. |
| **`@patcher`** | **Ultra-Fast Mechanical Patcher** | Rapid single-file edits, typos, syntax fixes, and minimal latency data edits. |

---

## 4. Engineering Skills Catalog

MyPAI equips agents with high-rigor engineering workflows:

1. **`ulw-plan` (`skills/ulw-plan/SKILL.md`):** Ultralight planning featuring testable **Ideal State Criteria (ISC)**, gap analysis, and phased verification gates.
2. **`systematic-debugging` (`skills/systematic-debugging/SKILL.md`):** 4-phase root-cause methodology (Reproduce -> Isolate -> Hypothesize -> Fix & Verify).
3. **`git-master` (`skills/git-master/SKILL.md`):** Safe worktree isolation (`~/.omp/wt`), uncommitted state protection, atomic conventional semantic commits.
4. **`review-work` (`skills/review-work/SKILL.md`):** Structured multi-pass review rubric and P0–P3 finding schemas.
5. **`test-driven-development` (`skills/test-driven-development/SKILL.md`):** Red-Green-Refactor test cycle.
6. **`lilac` (`skills/lilac/SKILL.md`):** Lilac automated build system and repository management for Arch Linux packages.
7. **`archlinux-pkgbuild` (`skills/archlinux-pkgbuild/SKILL.md`):** PKGBUILD creation, review, and AUR packaging standards.
8. **`system-prompts` (`skills/system-prompts/SKILL.md`):** Authoring and editing system prompts, tool docs, and agent specifications.

---

## 5. Custom Slash Command Palette

In any interactive OMP session, you can invoke specialized workflows using slash commands:

* **`/plan`**: Enters native OMP plan mode (uses `write xd://propose` to submit plan proposals for user confirmation).
* **`/ulw-plan`**: Generates a high-rigor Ultralight plan with testable Ideal State Criteria (ISC).
* **`/debug`**: Invokes `@debugger` and the `systematic-debugging` workflow.
* **`/review`**: Spawns `@reviewer` to audit uncommitted diffs or PR branch changes.
* **`/git`** (or `/git-master`): Safe git inspection, worktree branching, and conventional commits.
* **`/scout`**: Spawns `@scout` to explore repository architecture.
* **`/security`**: Runs security vulnerability scan with `@security-reviewer`.
* **`/writer`**: Generates documentation or updates memory banks.
* **`/patch`**: Spawns `@patcher` for quick mechanical edits.
* **`/learn`**: Distills recent turn insights into Hindsight mental models.

---

## 6. Hindsight Long-Term Memory Management (`bin/membank-ctl`)

Hindsight (`:28888`) maintains persistent vector memory and auto-synthesizes mental models.

### Provisioning & Updating Memory Banks

```bash
# Idempotently sync bank configurations and mental models from local definitions:
./bin/membank-ctl update http://localhost:28888 ./omp/agent/memorybanks --yes

# Sync and prune obsolete server-side mental models:
./bin/membank-ctl update http://localhost:28888 ./omp/agent/memorybanks --yes --prune
```

### Exporting Server Memory Bank State

```bash
# Export bank config to YAML:
./bin/membank-ctl export http://localhost:28888 oh-my-pi --yaml --out oh-my-pi.yaml
```

---

## 7. Local Inference Management (`submodules/agents-shared/`)

Local inference services are managed via scripts in `submodules/agents-shared`:

```bash
# 1. Download model weights (LLM, vision, embeddings, rerank, TTS, STT)
./submodules/agents-shared/scripts/local-download.sh /data/public/machine-learning/models --all

# 2. Provision and start local inference daemons
./submodules/agents-shared/assistants/local-inference.sh install --new-config

# 3. Query local router status (OpenAI-compatible port :21080)
curl http://localhost:21080/v1/models
```

---

## 8. Architectural Transition & Legacy Notes

> **Note on Architecture Evolution & Current Priorities:**
> - **Active Priority:** The primary focus is stabilizing and refining the **LifeOS integration** into OMP (`~/.omp/LIFEOS`, Pulse `:31337`, `OmpHooksBridge.ts`). It is currently basically working, but actively undergoing adjustments.
> - **`mypai_runtime` Status:** `src/mypai_runtime/` will be used in the target setup, but is **not currently used or ported to be used correctly** yet. Porting is scheduled once the LifeOS integration is stabilized.
> - **Generation 1 (Legacy-Legacy):** The monolithic `omp-mypai` FastAPI daemon (`:52080`) has been completely removed.
> - **Generation 2 (Transitional):** The `aoe` (:28080) ACP cockpit, `amux-server` (:28824) Kanban/message bus, `cc-connect` (:9810) chat bridge, and `mypai-channel`/`mypai-main`/`mypai-cron` 3-session model are **retired from the active trajectory**. Associated clients in `src/mypai_runtime/amux.py` and unit tests are preserved for historical reference and test suite integrity but are not used in the active OMP + LifeOS runtime path.
> - **Generation 3 (Current Active):** Direct **`oh-my-pi` (`omp`)** + **`LifeOS`** (`~/.omp/LIFEOS` with Pulse `:31337` and `OmpHooksBridge.ts`), backed by **`submodules/agents-shared`** local inference and **Hindsight** memory.
