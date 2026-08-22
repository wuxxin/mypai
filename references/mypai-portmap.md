# MyPAI & Agents-Shared Central Port Map (`references/mypai-portmap.md`)

This document defines the canonical port allocations across the **MyPAI** and **agents-shared** distributed ecosystem.

All services use unprivileged non-ephemeral ports in the **`20000`–`29000`** range to eliminate ephemeral port collisions while running without root privileges.

**Linux Ephemeral Port Safety ($< 32768$):**
- By default on Linux, `/proc/sys/net/ipv4/ip_local_port_range` allocates outbound dynamic sockets between `32768` and `60999`.
- By shifting all local services into the `20000`–`29000` window, daemons avoid ephemeral port collisions on daemon boot/restart.

---

## Complete Port Map

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                           Unified 2xxxx Service Port Map                                    │
├─────────┬───────────────────────────────┬───────────────────────────────────────────────────┤
│ Port    │ Service / Process             │ Role & Protocol Description                       │
├─────────┼───────────────────────────────┼───────────────────────────────────────────────────┤
│         │ ─── Local Inference (20xxx) ──│                                                   │
│ 20080   │ local-chat                    │ llama-server (Chat & Vision GGUF)                 │
│ 20082   │ local-embedding               │ llama-server (Qwen3-Embedding-0.6B)               │
│ 20086   │ local-rerank                  │ llama-server / TEI (Qwen3-Reranker-0.6B)          │
│ 20090   │ local-speech-to-text          │ whisper-server (large-v3-turbo)                   │
│ 20095   │ local-text-to-speech          │ qwen3-tts-server (voice synthesis)                │
│ 20100   │ local-image                   │ sd-server (Stable Diffusion image gen)            │
│ 21080   │ local-router                  │ Unified OpenAI-compatible API Gateway & Token Log │
│         │                               │                                                   │
│         │ ─── Ingress & Messaging ──────│                                                   │
│ 20887   │ signal-cli (TCP RPC)          │ Low-level JSON-RPC TCP endpoint                   │
│ 20888   │ signal-cli (HTTP RPC)         │ Low-level JSON-RPC HTTP endpoint                  │
│ 20889   │ signal-cli REST Wrapper       │ HTTP REST API wrapper for Signal                  │
│ 9810    │ cc-connect                    │ Multi-channel chat bridge (Signal/Telegram/Matrix)│
│         │                               │                                                   │
│         │ ─── Memory & Cognitive Plane ─│                                                   │
│ 28888   │ Hindsight                     │ Persistent Vector Memory & Mental Models API      │
│ 28889   │ Hindsight Worker              │ Background worker control plane & metrics         │
│ 28824   │ amux-server                   │ HTTPS REST API, Kanban Board & Cron Scheduler     │
│ 28823   │ amux-server (Redirect)        │ Plain-HTTP to HTTPS redirect port                 │
│         │                               │                                                   │
│         │ ─── Execution & Cockpit ──────│                                                   │
│ 28080   │ aoe serve (Release mode)      │ Agent of Empires Web PWA & ACP REST API           │
│ 28081   │ aoe serve (Dev mode)          │ Agent of Empires Debug namespace port             │
│         │                               │                                                   │
│         │ ─── Storage & Sync ───────────│                                                   │
│ 8384    │ Syncthing Web UI              │ Local file synchronization dashboard              │
│ 22000   │ Syncthing Sync Protocol       │ Peer-to-peer sync data transfer                   │
└─────────┴───────────────────────────────┴───────────────────────────────────────────────────┘
```

---

## Standard Environment Exports

```bash
# Cognitive Plane & Kanban (amux)
export AMUX_API_URL

# Memory Bank (Hindsight)
export HINDSIGHT_API_URL

# Execution Cockpit & ACP Host (aoe)
export AOE_DAEMON_URL
export AOE_DAEMON_TOKEN

# Local Inference (local-router.py)
export OPENAI_BASE_URL
export LLAMA_CPP_BASE_URL

# oh-my-pi Python VENV
export OMP_PYTHON_VENV

# mypai work dirs
export MYPAI_MAIN_DIR
export MYPAI_CHANNEL_DIR
export MYPAI_CRON_DIR

```
