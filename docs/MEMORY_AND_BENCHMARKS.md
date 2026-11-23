# Memory Plane (Mnemopi & Retired Hindsight) & Model Speed Benchmarks

---

## 1. Active Long-Term Memory: Mnemopi

Primary long-term memory is `omp`'s built-in **Mnemopi** store (`memory.backend: mnemopi` in [`omp/agent/config.yml`](../omp/agent/config.yml)):
- **Scoping:** `per-project-tagged` (project-local writes + global recall visibility).
- **Automatic hooks:** `autoRetain: false`, `autoRecall: false` (normal turns stay free of automatic memory traffic; invoke `recall`, `retain`, `reflect`, or `/learn` explicitly).
- **Graph & linking:** `polyphonicRecall: true`, `proactiveLinking: true`.
- **Embeddings:** Local `qwen3-embedding` via `http://127.0.0.1:21080/v1` (no local ONNX daemon spawned), with `embeddingQueryPrefix` configured for Qwen3-Embedding's asymmetric instruct format.
- **Extraction/consolidation LLM:** `llmMode: smol` (uses configured `smol` role).

---

## 2. Retired Fallback: Hindsight (`:28888`, `bin/membank-ctl`)

> **Status (since 2026-11-17): Retired fallback.** The Hindsight service (`:28888`, worker `:28889`) is kept provisioned and inactive in case Mnemopi needs a fallback.

If re-enabled (`memory.backend: hindsight`), manage memory banks and mental models declaratively from `omp/agent/memorybanks/` using [`bin/membank-ctl`](../bin/membank-ctl):
```bash
# Idempotently sync bank configs and mental models
./bin/membank-ctl update http://localhost:28888 ./omp/agent/memorybanks --yes

# Sync and prune obsolete server-side mental models
./bin/membank-ctl update http://localhost:28888 ./omp/agent/memorybanks --yes --prune

# Export live bank state to YAML
./bin/membank-ctl export http://localhost:28888 oh-my-pi --yaml --out oh-my-pi.yaml
```
*(In `omp 19.1.1+`, Hindsight `/tan` forks retain only turns added by the fork, not the inherited parent transcript.)*

---

## 3. Observed Model Speed Benchmarks (`omp bench`)

Command: `omp bench "<provider>/<model>" --profile mix --par=1`

| Model | Date / Surface | TTFT (p50) | Throughput (`tok/s`) | Decode (`tok/s`) | Prefill (`tok/s`) | Notes |
| :--- | :--- | ---: | ---: | ---: | ---: | :--- |
| `llama.cpp/qwen3.8-flash-next` | 2026-11-15 (Local Strata ROCm/HIP) | 947 ms | 68.3 | 75.0 | 1,938 | Primary local chat/tools model |
| `llama.cpp/qwen3` | Local | 224 ms | 90.2 | 102.0 | 2,577 | Fast local MoE |
| `google-antigravity/gemini-3.8-flash` | Cloud (Nov 2026) | 1.6–2.6 s | 73.6–126.4 | 151.5 | 4,288 | Default cloud orchestrator/task role |
| `google-antigravity/tab_flash_lite_preview` | Cloud | 355 ms | 274.7 | — | — | Ultra-fast flash-lite |
| `deepseek/deepseek-v4-flash` | Cloud | 913 ms | 97.6 | — | — | Fast review/aux |
| `deepseek/deepseek-v4-pro` | Cloud | 911 ms | 45.6 | — | — | `review` role |
| `google-antigravity/claude-opus-4-6` | Cloud | 2.4 s | 37.0 | — | — | `slow` / `debugger` / `security-reviewer` |
