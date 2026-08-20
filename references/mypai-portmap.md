# MyPAI & Agents-Shared Central Port Map (`references/mypai-portmap.md`)

This document defines the canonical port allocations across the **MyPAI** and **agents-shared** distributed ecosystem.

All services use unprivileged non-ephemeral ports in the **`20000`–`29000`** range to eliminate ephemeral port collisions while running without root privileges.

---

## 1. Complete Port Map

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

## 2. Tiered Architecture & Rationale

1. **Linux Ephemeral Port Safety ($< 32768$):**
   - By default on Linux, `/proc/sys/net/ipv4/ip_local_port_range` allocates outbound dynamic sockets between `32768` and `60999`.
   - By shifting all local services into the `20000`–`29000` window, daemons avoid ephemeral port collisions on daemon boot/restart.

2. **Logical Symmetrical Sub-Ranges:**
   - **`200xx` / `21080`**: Hardware inference backends & unified router
   - **`2088x`**: Signal communication endpoints
   - **`2808x`**: Agent of Empires execution host & Web PWA
   - **`2882x`**: amux-server state plane & Kanban bus
   - **`2888x`**: Hindsight cognitive vector memory bank
   - **`9810`**: cc-connect chat bridge

---

## 3. Standard Environment Exports

```bash
# Cognitive Plane & Kanban (amux)
export AMUX_RS_PORT="28824"
export AMUX_PORT="28824"
export AMUX_URL="https://localhost:28824"
export AMUX_API_URL="https://localhost:28824/api"

# Execution Cockpit & ACP Host (aoe)
export AOE_PORT="28080"
export AOE_URL="http://localhost:28080"
export AOE_API_URL="http://localhost:28080/api"

# Memory Bank (Hindsight)
export HINDSIGHT_API_URL="http://localhost:28888"
export HINDSIGHT_API_WORKER_HTTP_PORT="28889"

# Chat Ingress (cc-connect)
export CC_CONNECT_PORT="9810"
export CC_CONNECT_URL="http://localhost:9810"

# Local Inference Router
export LOCAL_ROUTER_URL="http://localhost:21080/v1"
```
