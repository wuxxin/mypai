# Oh My Pi (omp) Release Changes: v17.0.0 to v17.2.9

## Overview
This document summarizes key architectural updates, features, and fixes in **Oh My Pi (omp)** from release `v17.0.0` (2026-07-15) through `v17.2.9` (2026-08-05).

---

## 🧠 1. Hindsight Changes (Memory System)

* **Configurable Request Deadlines & Timeouts** ([v17.0.8](https://github.com/can1357/oh-my-pi/releases/tag/v17.0.8)): Added `hindsight.requestTimeoutMs`, `reflectTimeoutMs`, `recallTimeoutMs`, and `retainTimeoutMs` settings (along with `HINDSIGHT_*_TIMEOUT_MS` environment variables). Longer deadlines fixed 30s timeouts aborting long-running `reflect` operations.
* **TUI Integration** ([v17.0.9](https://github.com/can1357/oh-my-pi/releases/tag/v17.0.9)): Exposed the Hindsight API Token setting directly in the TUI Memory tab for configuring authenticated servers without manual file edits.
* **Incremental Transcript Retention Caching** ([v17.1.0](https://github.com/can1357/oh-my-pi/releases/tag/v17.1.0)): Optimized performance by incrementally caching full-session retention transcripts.
* **Single Recall Injection Path** ([v17.2.9](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.9)): Fixed an issue where `autoRecall` failed to reach the model when `agent_start` consumed `hasRecalledForFirstTurn` first via an unawaited prompt rebuild. All recall injections are now routed through `beforeAgentStartPrompt`.
* **Corrective `memory://` Error Handling** ([v17.2.9](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.9)): When `memory.backend=hindsight` is active, attempting to `read memory://<id>` now returns an informative error pointing the agent directly to `recall`/`reflect` tools.

---

## 🌐 2. Browser Tool & Automation

* **Browser Relay Extension & Relay Mode** ([v17.2.5](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.5)): Introduced **`@oh-my-pi/browser-relay`**, a Chrome Manifest V3 extension. Allows `omp` to attach to and drive existing browser tabs via `chrome.debugger`, complete with automatic daemon startup and "omp" tab grouping.
* **CDP Automation Target (`browser.cdpUrl`)** ([v17.2.0](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.0)): Added a `browser.cdpUrl` setting to target pre-existing CDP endpoints without passing parameters on every call.
* **Process-Shared Chromium Daemon** ([v17.2.3](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.3)): Prevented headless browser launch storms by multiplexing session tabs onto a single project-shared Chromium owned by the daemon broker (Chromium process automatically terminates when the last `omp` client exits).
* **Selector & Ref Improvements** ([v17.0.5](https://github.com/can1357/oh-my-pi/releases/tag/v17.0.5), [v17.0.6](https://github.com/can1357/oh-my-pi/releases/tag/v17.0.6)): Browser action selectors (`tab.click`, `tab.select`, `tab.uploadFile`, `tab.drag`, `tab.screenshot`) now support bare snapshot refs (`tab.click("e501")` or `@e501`).
* **Attached Browser Focus Protection** ([v17.2.2](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.2)): Stopped automation from stealing focus in attached browsers or opening unnecessary tabs during screenshots.
* **Ungoogled Chromium & Custom Executable Overrides** ([v17.2.9](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.9)): Added auto-detection of Ungoogled Chromium on Linux and fixed `PUPPETEER_EXECUTABLE_PATH` override resolution.

---

## ⚡ 3. Background Control & Task Management

* **Unified `hub` Tool** ([v17.0.0](https://github.com/can1357/oh-my-pi/releases/tag/v17.0.0)): Consolidated the legacy `irc`, `job`, and `launch` tools into a single unified `hub` tool for agent peer messaging, background job control, and supervised long-running daemons.
* **Owner-Routed Async Job Delivery** ([v17.1.0](https://github.com/can1357/oh-my-pi/releases/tag/v17.1.0)): Async bash and subagent task outputs are now injected directly into the owning subagent or parent session, rather than polluting the top-level session context.
* **Auto-Background on Steer** ([v17.1.0](https://github.com/can1357/oh-my-pi/releases/tag/v17.1.0), [v17.1.1](https://github.com/can1357/oh-my-pi/releases/tag/v17.1.1)): Incoming user prompts or peer messages cooperatively signal (`steeringSignal`) long-running tools (like bash) to auto-background or complete early rather than hard-aborting them.
* **Git Worktree Isolation (`git.detachGitDir`)** ([v17.0.6](https://github.com/can1357/oh-my-pi/releases/tag/v17.0.6)): Isolated `task` subagent worktrees now detach `.git` into a standalone repository with frozen HEAD/refs/index. Subagents can perform git checkouts or commits without mutating the host working copy or leaking branches.
* **In-Place Context Reset (`/reset`)** ([v17.2.6](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.6)): Added `/reset` slash command to reset conversation context in place, cancelling active async jobs while preserving session ID, title, model, and transcript on disk.
* **Daemon Management Enhancements** ([v17.1.2](https://github.com/can1357/oh-my-pi/releases/tag/v17.1.2), [v17.1.8](https://github.com/can1357/oh-my-pi/releases/tag/v17.1.8)): `hub` `ps`/`list` prioritizes active daemons first and caps exited process history at 10. Fixed daemon restart loops during log/list checks.

---

## 🐧 4. Linux Related (Desktop, Sandbox, System & Wayland/X11)

* **Native Pure-Rust Computer Use Backend** ([v17.1.1](https://github.com/can1357/oh-my-pi/releases/tag/v17.1.1), [v17.2.5](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.5)): Bundled a pure-Rust Linux X11 backend (`x11rb` capture over display socket, XTest input with keysym mapping) that links no GUI system libraries. Updated in v17.2.5 to provide unified desktop backends for macOS, Win32, X11, and Wayland (supporting capture-free window discovery and AT-SPI accessibility trees).
* **Wayland & Image Paste** ([v17.2.1](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.1), [v17.2.5](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.5)): Added fast-fail diagnostic reporting for rootless XWayland screen capture limitations; added native Wayland image clipboard paste support.
* **Official Linux Musl Binaries** ([v17.0.8](https://github.com/can1357/oh-my-pi/releases/tag/v17.0.8), [v17.2.7](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.7)): Added official `omp-linux-musl-x64` and `omp-linux-musl-arm64` release builds for Alpine Linux and musl distributions. `install.sh` smoke-tests musl binaries before declaring installation success.
* **Kernel Process Naming (`prctl`)** ([v17.1.8](https://github.com/can1357/oh-my-pi/releases/tag/v17.1.8)): Uses Linux `prctl` via `bun:ffi` so `omp` displays as `omp` rather than `bun` in `ps`, `top`, and process managers.
* **Strict XDG Base Directory Compliance** ([v17.2.4](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.4)): Ephemeral files (`secret-placeholder.key`, daemon sockets, provider in-flight data) now map cleanly to `$XDG_STATE_HOME/omp/`, while marketplace registries resolve under `$XDG_DATA_HOME/omp/`.
* **Abstract Unix Socket Lock Bindings** ([v17.2.6](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.6)): Non-blocking process-owned `FileLock` bindings using abstract Unix sockets on Linux.
* **Hermetic Bazel Builds for Native Addons** ([v17.1.6](https://github.com/can1357/oh-my-pi/releases/tag/v17.1.6)): Switched native C/Rust addon builds to Bazel with hermetic Zig CC toolchains (`linux-gnu`/`musl`), reducing native rebuild times to seconds.

---

## 🤝 5. Agent2Agent (Subagents, Hub & Inter-Agent Coordination)

* **Subagent Prewalk** ([v17.0.0](https://github.com/can1357/oh-my-pi/releases/tag/v17.0.0)): Introduced a `prewalk` frontmatter field and `/agents` dashboard toggle (`task.agentPrewalk`) to arm subagents with initial planning/investigation turns.
* **Park & Dispose Synchronization** ([v17.0.6](https://github.com/can1357/oh-my-pi/releases/tag/v17.0.6)): Synchronized `park` operations with `ensureLive` and IRC delivery so subagents mid-disposal cannot receive phantom messages.
* **Subagent Tool Grants** ([v17.2.0](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.0)): Subagents can now be granted opt-in access to `checkpoint`, `rewind`, `learn`, and `manage_skill` tools when explicitly specified in their frontmatter `tools:` array.
* **Lazy Launch & Session Forking** ([v17.2.2](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.2)): Deferred subagent launch setup (model-registry refresh and session file opening off critical path); subagent `reset: true` now forks the shared kernel from the parent session.
* **Peer Interrupt Safety** ([v17.2.6](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.6)): Fixed peer-IRC interrupts (subagent messages) to keep non-interruptible tools queued in the same batch alive rather than skipping them.
* **Agent Hub Performance** ([v17.2.9](https://github.com/can1357/oh-my-pi/releases/tag/v17.2.9)): Bounded roster rendering in the Agent Hub UI to the visible viewport ($O(\text{viewport})$ instead of $O(N)$), eliminating UI lags on large subagent rosters.
