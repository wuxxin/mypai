# Agent Plugins Conformity Report for `omp-mypai`

**Target Plugin:** `submodules/omp-mypai`  
**Specification Reference:** Agent Plugins Specification 1.0.0 (`scratch/agent-plugins-spec`)  
**Validation Date:** 2026-08-11  

---

## 1. Conformance Executive Summary

The `omp-mypai` repository was audited against the **Agent Plugins Specification 1.0.0** published by agent-plugins.org (`github.com/agentplugins/agent-plugins-spec`).

| Spec Component | Status | Audit Result & Validation Details |
|---|---|---|
| **`plugin.json` Manifest (§5)** | **CONFORMANT** | Targets `$schema` `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`. Manifest name `omp-mypai` conforms to §5.5 naming rules. All fields conform strictly to closed JSON schema. |
| **`mcp.json` Registry (§7.2)** | **CONFORMANT** | Targets `$schema` `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json`. Registers 5 stdio MCP servers (`chat-channel`, `cron-scheduler`, `local-speech`, `arbor`, `openadapt`). Uses valid `${PLUGIN_ROOT}` and `${PLUGIN_DATA}` placeholders. |
| **Agent Skills (§7.1)** | **CONFORMANT** | 4 portable skills (`arbor`, `hindsight-api`, `mypai-tools`, `openadapt`) located in `skills/<skill_name>/SKILL.md`. All skills conform to the Agent Skills specification with valid YAML frontmatter. |
| **Subprocess Environment (§9.1 & §9.2)** | **CONFORMANT** | Standard stdio servers use bare commands (`python3`) and rely on `${PLUGIN_ROOT}` and `${PLUGIN_DATA}` placeholders. Variable substitution rule compliance verified. |
| **Package Containment (§4.1)** | **CONFORMANT** | All plugin paths remain isolated within filesystem-resolved `${PLUGIN_ROOT}`. |

---

## 2. Detailed Findings & Fixes Applied

### 2.1 Fixed `mcp.json` Environment Expansion (§9.2)
- **Issue Identified**: In `mcp.json`, the `PATH` environment variable under `chat-channel`, `cron-scheduler`, and `local-speech` was set to `"${PLUGIN_DATA}/venv/bin:${PATH}"`.
- **Spec Rule (§9.2)**: Spec §9.2 states that clients MUST expand only `${PLUGIN_ROOT}` and `${PLUGIN_DATA}` in supported configuration fields. Unrecognized placeholder-like text (such as `${PATH}`) MUST remain literal. Relying on ambient shell environment variable expansion is non-conformant.
- **Resolution**: Updated `PATH` values to `"${PLUGIN_DATA}/venv/bin"`, ensuring deterministic environment variables without literal `${PATH}` text.

### 2.2 Replaced Hardcoded Filesystem Paths in Skills & Docs (§4.1)
- **Issue Identified**: `skills/mypai-tools/SKILL.md` and `README.md` contained hardcoded user-specific file links (`file:///home/wuxxin/...`).
- **Spec Rule (§4.1)**: Package references and documentation within a portable plugin should be relative to maintain portability across hosts and environments.
- **Resolution**: Replaced all hardcoded absolute URI references with relative paths (`../../mcp.json`, `skills/mypai-tools/SKILL.md`, etc.).

### 2.3 Formatted Codebase Imports & Lint Cleanliness
- **Issue Identified**: Running `make check` flagged an unsorted import block in `tools/tests/test_heartbeat_and_cron_mcp.py`.
- **Resolution**: Executed `.venv/bin/ruff check --fix tools/` to resolve the import ordering issue. All 18 unit tests and linter checks pass cleanly.

---

## 3. Architecture & Non-Standard Layout Notes

- **Top-Level Framework Extensions (`agents/`, `rules/`, `config/`)**:
  - Agent Plugins Specification v1.0.0 standardizes **skills** (`skills/`) and **MCP servers** (`mcp.json`) as core portable components.
  - Framework-specific directories such as `agents/` (subagent prompt profiles), `rules/` (execution policies), `config/` (Hindsight bank templates), and `tools/` (Python package implementation) exist at the plugin root.
  - Per Spec §11.3, clients ignore unsupported top-level component types without failing plugin load. For full namespace isolation under §8, client extensions can also be referenced or grouped under client extension namespaces (e.g. `com.oh-my-pi`).

---

## 4. Verification Commands

The conformity checks can be re-validated at any time with:

```bash
# 1. Validate plugin.json and mcp.json against official 1.0.0 JSON schemas:
python3 -c "
import json, jsonschema
with open('scratch/agent-plugins-spec/schemas/1.0.0/plugin.schema.json') as f:
    jsonschema.validate(json.load(open('submodules/omp-mypai/plugin.json')), json.load(f))
with open('scratch/agent-plugins-spec/schemas/1.0.0/mcp.schema.json') as f:
    jsonschema.validate(json.load(open('submodules/omp-mypai/mcp.json')), json.load(f))
print('Schema Validation PASSED')
"

# 2. Run unit tests and linter in submodules/omp-mypai:
make -C submodules/omp-mypai check
```
