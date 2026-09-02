# LifeOS CWD Template (`lifeos-cwd-template`)

This directory provides the template configuration for running **Oh-My-Pi (`omp`)** inside the **LifeOS private workspace** (`~/agent-private/lifeos`).

---

## 1. Directory Structure

```
lifeos-cwd-template/
├── .omp/
│   ├── config.yml            # Local model overrides, maxConcurrency: 1, Hindsight mypai bank
│   ├── APPEND_SYSTEM.md ─────► (Symlink) ──► ~/.claude/LIFEOS/LIFEOS_SYSTEM_PROMPT.md
│   └── append ───────────────► (Symlink) ──► APPEND_SYSTEM.md
├── USER/                     # Private user configuration, TELOS, and profiles
└── MEMORY/                   # Private memory vault (STATE, LEARNING, KNOWLEDGE)
```

---

## 2. Key Architectural Invariants Enforced

1. **100% Local Model Enforcement for Personal Data Safety**:
   - All `modelRoles` (`default`, `smol`, `task`, `slow`, `plan`, `review`, `debugger`, `security-reviewer`, `orchestrator`, `advisor`, `vision`, `tiny`) are explicitly mapped to local inference via `llama.cpp/qwen3` (`http://localhost:21080/v1`).
   - Ensures zero personal LifeOS context (TELOS, finances, health, identity, memories) is ever leaked to cloud providers.
   - `bin/claude-shim` strictly enforces `${LIFEOS_TOOLS_MODEL_NAME:-llama.cpp/qwen3}`, ignoring any CLI `--model` overrides from background scripts or hooks.
   - **Web Research Exception**: Only the `@librarian` subagent is configured to allow cloud fallback (`@smol`) when performing external web/library searches.

2. **Concurrency Limiting (`maxConcurrency: 1`)**:
   - Limits subagent concurrency to 1 to protect local GPU/inference memory on the host workstation.

3. **Automatic System Prompt Resolution**:
   - `.omp/APPEND_SYSTEM.md` symlinks directly to `~/.claude/LIFEOS/LIFEOS_SYSTEM_PROMPT.md`.
   - When running `omp` inside `~/agent-private/lifeos`, OMP automatically detects `.omp/APPEND_SYSTEM.md` and appends the full LifeOS system prompt without manual CLI flags.

4. **Silent Hook Execution**:
   - `OmpHooksBridge.ts` runs silently by default (no file logging to `~/.omp/lifeos-bridge.log` unless `$OMP_BRIDGE_LOG` is explicitly defined).

---

## 3. Usage & Deployment

To apply this configuration to your active private LifeOS workspace (`~/agent-private/lifeos`):

```bash
# Copy .omp configuration into private workspace:
cp -rf lifeos-cwd-template/.omp ~/agent-private/lifeos/

# Launch LifeOS session inside workspace:
cd ~/agent-private/lifeos && omp
```
