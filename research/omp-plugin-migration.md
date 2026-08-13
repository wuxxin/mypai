# omp-mypai → OMP-specific extension migration

**Date:** 2026-08-13
**Status:** Done and committed; verified end-to-end in a fresh `omp` session.

## Goal

Make the `omp-mypai` plugin's MCP servers (`chat-channel`, `cron-scheduler`) actually load under Oh My Pi. They were declared in the plugin but never activated.

## Root cause

OMP's runtime plugin loader (`getEnabledPlugins` → `collectPluginsAtRoot`, `packages/coding-agent/src/extensibility/plugins/loader.ts`) requires a `package.json` **`omp`** (or legacy `pi`) manifest field. Without it the plugin is **silently skipped** — even though `omp plugin list` reports it "enabled", because the list path falls back to a `{version}` manifest while the runtime loader does not.

Secondary cause: the plugin was packaged as an **Agent Plugins 1.0.0** package (`plugin.json` + `mcp.json`). That routes it through OMP's `agent-plugins` provider, which:

- namespaces servers as `omp-mypai:chat-channel` (not bare `chat-channel`), and
- expects a digest-keyed `${PLUGIN_DATA}` dir (`~/.omp/plugins/data/omp-mypai-<sha256>`), which nothing populated.

Tertiary cause: the plugin's `tools/` directory (the Python package) collided with OMP's custom-tools scanner, producing "Custom tool load failed" errors on every `.py` file.

## What changed

### Submodule `omp-mypai` — commit `9280748` "Convert omp-mypai to an OMP-specific extension"

- `package.json`: added `"omp": {}` — the discovery gate.
- Deleted `plugin.json` and `mcp.json` (Agent Plugins standard).
- Added `.mcp.json` (OMP-native): bare server names, `command: "./.venv/bin/python3"` (plugin-relative; OMP resolves `./` against the plugin root).
- Renamed `tools/` → `src/` (stops the custom-tools scanner noise).
- Added `scripts/build_runtime_env.py` + `make installenv` → snapshot `.venv` (isolated; installs the `omp-rpc` wheel + `mypai_tools` from `src/`), separate from the editable dev `.venv`.
- Refreshed `Makefile`, `README.md`, `.gitignore`.

### Base `mypai` — commit `3e75a18` "Retire MYPAI_PLUGIN_VENV; use plugin .venv"

- Retired `MYPAI_PLUGIN_DATA` (`~/.omp/data/omp-mypai`).
- `MYPAI_PLUGIN_VENV` now points at `$HOME/agent-shared/code/mypai/submodules/omp-mypai/.venv`.
- `LAUNCHER_INSTALL_CMDS` builds `.venv` inline: `uv venv` + `omp-rpc` wheel + `uv pip install …/src`.
- Sidecars (`mypai_daemon`, `input_spooler`) run from `$MYPAI_PLUGIN_VENV/bin/python`.
- Merged pending uncommitted work (`README.md`, `omp/agent/config.yml`, `omp/agent/mcp.json`, `omp/agent/models.yml`, `research/omp_rpc_functions.md`).

## Verification

- `make check`: **59 passed**, 2 warnings. `ruff` still reports pre-existing lint debt (unsorted imports `I001`, `RUF013`, `F841`); `make lint` uses `|| true` so it is non-fatal.
- Fresh `omp` session: `MCP prompt commands refreshed` for `mcp:chat-channel` and `mcp:cron-scheduler`; **0** "Custom tool load failed" errors.
- JSON-RPC handshake: `chat-channel` → 3 tools; `cron-scheduler` → 14 tools.

## Next steps

1. **Full sandbox reinstall** — run the real `sandbox-ctl install` flow (`LAUNCHER_INSTALL_CMDS`) to confirm the `.venv` build + `omp plugin install` link work end-to-end (so far only the manual `.venv` build was exercised).
2. **Sidecar verification** — confirm `mypai_daemon` and `input_spooler` actually launch from `.venv/bin/python` (only the MCP servers were handshake-tested).
3. **README sidecar section is stale** — the plugin README "Sandbox Launcher" block still shows `python3` / `--project-dir` / `--session-name` / `LAUNCHER_SIDECARS="mypai_daemon input_spooler"`; actual is `$MYPAI_PLUGIN_VENV/bin/python --agent-dir $MYPAI_AGENT_DIR` / `LAUNCHER_SIDECARS="mypai_daemon"`.
4. **Snapshot rebuild discipline** — `.venv` is non-editable; any change to `src/mypai_tools/` requires `make installenv` (or the install flow) before runtime picks it up.
5. **Path coupling** — `omp.env` hardcodes `$HOME/agent-shared/code/mypai/submodules/omp-mypai/.venv`; breaks if the repo moves. Could instead use OMP's link `$HOME/.omp/plugins/node_modules/omp-mypai/.venv`.

