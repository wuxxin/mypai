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
│                           Unified Service Port Map                                          │
├─────────┬───────────────────────────────┬────────────┬──────────────────────────────────────┤
│ Port    │ Service / Process             │ Status     │ Role & Protocol Description          │
├─────────┼───────────────────────────────┼────────────┼──────────────────────────────────────┤
│         │ ─── LifeOS & Observability ───│            │                                      │
│ 31337   │ Pulse Dashboard (bun)         │ Active     │ LifeOS dashboard, hooks & metrics    │
│         │                               │            │                                      │
│         │ ─── Local Inference (20xxx) ──│            │                                      │
│ 20080   │ local-chat                    │ Active     │ llama-server (Chat & Vision GGUF)    │
│ 20082   │ local-embedding               │ Active     │ llama-server (Qwen3-Embedding-0.6B)  │
│ 20086   │ local-rerank                  │ Active     │ llama-server / TEI (Reranker 0.6B)   │
│ 20090   │ local-speech-to-text          │ Active     │ whisper-server (large-v3-turbo)      │
│ 20095   │ local-text-to-speech          │ Active     │ qwen3-tts-server (voice synthesis)   │
│ 20100   │ local-image                   │ Active     │ sd-server (Stable Diffusion)         │
│ 21080   │ local-router                  │ Active     │ Unified OpenAI-compatible Gateway    │
│         │                               │            │                                      │
│         │ ─── Memory & Cognitive Plane ─│            │                                      │
│ 28888   │ Hindsight                     │ Active     │ Persistent Vector Memory & Models    │
│ 28889   │ Hindsight Worker              │ Active     │ Background worker control plane      │
│         │                               │            │                                      │
│         │ ─── Storage & Sync ───────────│            │                                      │
│ 8384    │ Syncthing Web UI              │ Active     │ Local file synchronization UI        │
│ 22000   │ Syncthing Sync Protocol       │ Active     │ Peer-to-peer sync data transfer      │
│         │                               │            │                                      │
│         │ ─── Gen-2 Transitional (Ret) ─│            │                                      │
│ 28080   │ aoe serve (Release mode)      │ Retired    │ Agent of Empires Web PWA & ACP REST  │
│ 28081   │ aoe serve (Dev mode)          │ Retired    │ Agent of Empires Debug namespace     │
│ 28824   │ amux-server                   │ Retired    │ HTTPS REST API & Kanban Board        │
│ 28823   │ amux-server (Redirect)        │ Retired    │ Plain-HTTP to HTTPS redirect port    │
│ 9810    │ cc-connect                    │ Retired    │ Multi-channel chat bridge            │
│ 20887   │ signal-cli (TCP RPC)          │ Retired    │ Low-level JSON-RPC TCP endpoint      │
│ 20888   │ signal-cli (HTTP RPC)         │ Retired    │ Low-level JSON-RPC HTTP endpoint     │
│ 20889   │ signal-cli REST Wrapper       │ Retired    │ HTTP REST API wrapper for Signal     │
└─────────┴───────────────────────────────┴────────────┴──────────────────────────────────────┘
```

---

## Active Environment Exports

```bash
# LifeOS Configuration
export LIFEOS_DIR="$HOME/.claude/LIFEOS"
export OMP_VOICE=0

# Memory Bank (Hindsight)
export HINDSIGHT_API_URL="http://localhost:28888"

# Local Inference (local-router.py)
export OPENAI_BASE_URL="http://localhost:21080/v1"
export LLAMA_CPP_BASE_URL="http://localhost:21080/v1"

# oh-my-pi Python VENV
export OMP_PYTHON_VENV="$HOME/.omp/python-env"
```
