# AGENTS.md

## Repository Structure

- `omp.env` — Sandbox launcher config (provisions Base OMP and MyPai Profile)
- `omp/` — Target `~/.omp/` configuration templates
  - `agent/` — Target `~/.omp/agent/` (Base OMP configuration `oh-my-pi`)
    - `config.yml` — configuration (`bankId: oh-my-pi`)
    - `mcp.json` — MCP config
    - `models.yml` — model config (`x-client-id: oh-my-pi`)
    - `skills/` — skills 
    - `memorybanks/` — `oh-my-pi.yaml`
  - `profiles/`
    - `mypai/` — Target `~/.omp/profiles/mypai/agent/` (MyPai Profile configuration `mypai`)
      - `config.yml` — MyPai config (`bankId: mypai`)
      - `mcp.json` — MyPai MCP config
      - `models.yml` — MyPai model config (`llama.cpp/qwen3`, `x-client-id: mypai`)
      - `memorybanks/` — `mypai.yaml`, `mypai-developer-profile.yaml`, `mypai-knowledge.yaml`
- `submodules/` — Embedded repos (`agents-shared`, `aur-packages`, `omp-mypai`, `private-seeds`)
- `research/` — Development research notes and benchmark reports
- `scratch/` — Agent workspace for temporary files (`scratch/*`)

## Code Style & Commands

- **Style:** dont use long visual lines for comment sections, eg. "# -----------"

### Shell Scripts (`.sh`)

- **Style:** `#!/usr/bin/env bash`, 4-space indent, `set -euo pipefail`, quote `"$var"`, use `$(...)`, `lowercase_vars`, `UPPERCASE_CONSTANTS`.
- **Lint & Format:**
  ```bash
  shellcheck scripts/*.sh && shfmt -i 4 -w scripts/*.sh
  ```

### Python Scripts (`.py`)
- **Style:** `#!/usr/bin/env python3`, 4-space indent, type hints, `snake_case` (functions/vars), `PascalCase` (classes), triple-quote docstrings, explicit exception handling.
- **Lint, Test & Utility Commands:**
  ```bash
  ruff check scripts/*.py scripts/test/*.py
  ruff format scripts/*.py scripts/test/*.py
  mypy scripts/*.py scripts/test/*.py
  pytest tests/test_file.py::test_function -v
  ```

## Operating Guidelines

### Submodule & Monorepo Structure

- **Organic Repository Concept:** The root `mypai` repo and its `submodules/` (`agents-shared`, `aur-packages`, `omp-mypai`, `private-seeds`) form a single organic repository.
- **Commit Discipline:** Make edits and commits directly inside the target submodule repository (`submodules/<submodule-name>`) for submodule changes, then update the submodule commit pointer in the parent repository when appropriate.

### Workspace Guidelines

When working in this repository or any of its submodules:

- **Workspace Isolation**: Always use `scratch/` for temporary files, build logs and temporary git checkouts.
- **Submodule Behavior**:
  - If operating within a **submodule checkout**, agents and tools must defer to the top-level parent repository's root `scratch/` directory (`mypai/scratch/`).
  - If operating within a **standalone checkout** of a submodule, use the local repository's root `./scratch/`.

### Sandboxing & Bubblewrap (`bwrap`) Discipline

Check if running inside a bwrap sandbox:
```bash
[ -S "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/systemd/private" ] || echo "bwrapped"
```

**If bwrapped (systemd socket unavailable):**
- **Restriction:** Do **NOT** execute systemd service management commands (`systemctl start/stop/restart/status`).
- **Introspection:** You **can** however inspect all active processes and logs using `journalctl` (`--user`), `ps`, `/proc`, and `pgrep`.
- **Dummy Install:** You **can** however use the scripts install function to create the files in the bwrapped environment (they cant become active), to look at the created files, to check functionality of scripts. dont get fooled by files in systemd user dir, they are not active.

## Agent Delegation Rules

### Specialist Roles

Map `@rolename` references to your harness's available sub-agents according to these specialization profiles:

- `@orchestrator`: Workflow planning, delegation, context tracking, final review.
- `@explorer`: Read-only codebase search, symbol mapping, file and pattern discovery.
- `@oracle`: Deep architecture design, root-cause debugging, strategic decisions.
- `@librarian`: External web docs, API references, library research.
- `@designer`: UI/UX, CSS styling, layout structure, frontend components.
- `@fixer`: Code edits, refactoring, bug fixes, multi-file feature implementations.
- `@council`: Multi-perspective peer review, risk assessment and consensus validation before execution.
- `@observer`: Visual UI inspection, render validation, screenshot analysis.
- `@janitor`: Tech debt cleanup, dead code removal, doc alignment.

As a user facing agent assume the `@orchestrator` role.

### Rules

- Orchestrator Limits: Direct edits allowed only for single-file trivial tweaks, doc updates, and synthesis.
- Delegate Execution: Multi-file edits or complex tasks go to `@fixer`, except if running on antigravity or agy harness.
- Research: Use `@explorer` for codebase searches (no manual grep/glob) and `@librarian` for web/docs.
- Escalations: Route to `@oracle` for complex bugs or after 2 failed fix attempts. Route to `@council` before risky breaking changes.
