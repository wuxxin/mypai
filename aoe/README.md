# AoE Configuration (`aoe/`)

Configuration templates and settings for **Agent of Empires (`aoe`)** operating as the primary ACP execution cockpit and process supervisor for MyPAI.

## Directory Structure

- `config.toml` — Base AoE daemon configuration (port `28080`, `omp` default ACP agent, worktree management).

## Installation & Deployment

During environment installation via `omp.env` (`LAUNCHER_INSTALL_CMDS`), this directory is copied to `$HOME/.agent-of-empires/`:

```bash
mkdir -p "$HOME/.agent-of-empires"
cp -rf aoe/. "$HOME/.agent-of-empires/"
```
