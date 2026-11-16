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
│         │ ─── LifeOS & Observability    │            │                                      │
│ 31337   │ Pulse Dashboard (bun)         │ Active     │ LifeOS dashboard, hooks & metrics    │
│         │                               │            │                                      │
│         │ ─── Local Inference (20xxx)   │            │                                      │
│ 20080   │ local-chat                    │ Active     │ llama-server (Chat & Vision GGUF)    │
│ 20082   │ local-embedding               │ Active     │ llama-server (Qwen3-Embedding-0.6B)  │
│ 20086   │ local-rerank                  │ Active     │ llama-server / TEI (Reranker 0.6B)   │
│ 20090   │ local-speech-to-text          │ Active     │ whisper-server (large-v3-turbo)      │
│ 20095   │ local-text-to-speech          │ Active     │ kokoro-onnx (default); qwen3 switch  │
│ 20100   │ local-image                   │ Active     │ sd-server (Stable Diffusion)         │
│ 21080   │ local-router                  │ Active     │ Unified OpenAI-compatible Gateway    │
│         │                               │            │                                      │
│         │ ─── Memory & Cognitive Plane  │            │                                      │
│ 28888   │ Hindsight                     │ Inactive   │ Persistent Vector Memory & Models    │
│ 28889   │ Hindsight Worker              │ Inactive   │ Background worker control plane      │
│         │                               │            │                                      │
│         │ ─── Storage & Sync            │            │                                      │
│ 8384    │ Syncthing Web UI              │ Active     │ Local file synchronization UI        │
│ 22000   │ Syncthing Sync Protocol       │ Active     │ Peer-to-peer sync data transfer      │
│         │                               │            │                                      │
│         │ ─── Chat
│ 20887   │ signal-cli (TCP RPC)          │ Active     │ Low-level JSON-RPC TCP endpoint      │
│ 20888   │ signal-cli (HTTP RPC)         │ Active     │ Low-level JSON-RPC HTTP endpoint     │
│ 20889   │ signal-cli REST Wrapper       │ Active     │ HTTP REST API wrapper for Signal     │
│         │                               │            │                                      │
│         │ ─── Gen-2 Transitional (Ret) ─│            │                                      │
│ 28080   │ aoe serve (Release mode)      │ Retired    │ Agent of Empires Web PWA & ACP REST  │
│ 28081   │ aoe serve (Dev mode)          │ Retired    │ Agent of Empires Debug namespace     │
│ 28824   │ amux-server                   │ Retired    │ HTTPS REST API & Kanban Board        │
│ 28823   │ amux-server (Redirect)        │ Retired    │ Plain-HTTP to HTTPS redirect port    │
│ 9810    │ cc-connect                    │ Retired    │ Multi-channel chat bridge            │
└─────────┴───────────────────────────────┴────────────┴──────────────────────────────────────┘
```

## TTS engines behind the router (:21080 → :20095)

- Default engine since 2026-11-16: **kokoro-onnx** FastAPI on `:20095` (unit `local-text-to-speech.service`, agents-shared `scripts/local-text-to-speech.sh`); voices en-US `af_heart`, de-DE `df_victoria`.
- `qwen3-tts` stays switchable via the `TTS_ENGINE` env var in that script. The router's `/v1/audio/speech` answers any model string and proxies to whichever engine is current — the engine is invisible above the router; omp's role string only names a provider alias.
- Consumer chain: omp role `speech:` → :21080 → :20095. Host-side prose: `lifeos-host-linux.md` § Voice.


