# Central VRAM Memory Map & Co-running Guide

This document aggregates detailed memory requirements and allocations for local AI models running on a dedicated GPU (AMD Radeon RX 7900 XTX **24,576 MiB** usable VRAM) a integrated GPU (AMD Radeon Graphics iGPU sharing System RAM) and inference using the CPU.

## Components

- Local LLM Service ([local-chat.sh](../../submodules/agents-shared/scripts/local-chat.sh) / `llama-server`)
Serves chat and vision.
  - **Model:** `Agents-A1-APEX-I-Compact` (Qwen3.6-35B-A3B finetune, LLM: ~17.0 GiB GGUF, mmproj: ~861 MiB)
- Local Embedding Service ([local-embedding.sh](../../submodules/agents-shared/scripts/local-embedding.sh) / `llama-server`)
Serves text embeddings.
  - **Model:** `Qwen3-Embedding-0.6B` (596M, Q8_0 GGUF from iyanello, causal decoder, last-token pooling, 32K ctx, 6×8K true parallel, Q8_0 KV cache [6 partitions × 8K])
- Local Rerank Service ([local-rerank.sh](../../submodules/agents-shared/scripts/local-rerank.sh) / `llama-server` or `text-embeddings-router`)
Serves document reranking.
  - **Model (active):** `Qwen3-Reranker-0.6B` (596M, Q4_K_M GGUF, Qwen3 decoder + binary classification head, 12K ctx, unified KV cache, 2×12K sequential slots, Cohere-compatible `/v1/rerank` scores)
  - **Model (alternative):** `ettin-reranker-400m-v1` (~0.8 GB Safetensors, served via TEI, 1×8K batch, ModernBERT backbone, native `/v1/rerank` scores)
- Local Speech-to-Text ([local-speech-to-text.sh](../../submodules/agents-shared/scripts/local-speech-to-text.sh) / `whisper-server`)
Serves audio transcription.
  - **Model:** `ggml-large-v3-turbo-q5_0.bin` (~573.45 MiB GGUF)
- Local Text-to-Speech ([local-text-to-speech.sh](../../submodules/agents-shared/scripts/local-text-to-speech.sh) / `kokoro-ctl.py`)
Serves voice synthesis.
  - **Engine (default):** `Kokoro-82M ONNX Runtime` (`kokoro-onnx`, ~330 MiB float32 ONNX model, **0 MiB VRAM**, **~350 MiB host RAM**, 4.6× real-time on CPU).
  - **Engine (alternative):** `Qwen3-TTS-12Hz-0.6B-CustomVoice-Q8_0.gguf` (~1,264 MiB GGUF) + Vocoder `Qwen3-TTS-Tokenizer-12Hz-F16.gguf` (~325 MiB GGUF).
- Local Image Service ([local-image.sh](../../submodules/agents-shared/scripts/local-image.sh) / `sd-server`)
Serves image generation using stable diffusion.
  - **Model:** `z_image_turbo-Q8_0.gguf` (~Diffusion) + `ae.safetensors` (~VAE) + `Qwen3-4B-Q4_K_M.gguf` (~Text Encoder LLM)

## Co-running Scenario

Here we map VRAM usage for running **Chat** (LLM + Vision), **Embedding**, **Reranking**, **Speech-to-Text**, **Text-to-Speech** and **Image** services concurrently on one system using the dgpu, the igpu and the cpu.

### Running local-inference Environment Config

```sh
# local-inference.env

# Configuration wrapper for local AI inference services.
#
# Toggle service activation (1=enabled, 0=disabled) and define overrides
# for individual service environment files.

LCHAT_ENABLED=1
LMBD_ENABLED=1
LRR_ENABLED=1
LSTT_ENABLED=1
LTTS_ENABLED=1
LIMG_ENABLED=1

# ROCm0 = dgpu
# Vulkan0 = igpu
# Vulkan1 = dgpu

# Overrides for specific services (applied on install/start/restart/edit), can be defined as Bash arrays. E.g.:
# run CHAT on vulkan/dgpu
LCHAT_OVERRIDE=(
    'LCHAT_DEVICE="vulkan1"'
    'GGML_VK_DISABLE_MMVQ=1'
)
# run EMBEDDING on vulkan/dgpu
LMBD_OVERRIDE=(
    'LMBD_DEVICE="vulkan1"'
)
# run RERANK on vulkan/dgpu (llama-server with Qwen3-Reranker, or LRR_TEI_DEVICE="Vulkan1" for TEI)
LRR_OVERRIDE=(
    'LRR_DEVICE="vulkan1"'
)
# run SPEECH-TO-TEXT on vulkan/igpu
LSTT_OVERRIDE=(
    'CUDA_VISIBLE_DEVICES=""'
    # "0" selects vulkan0, because we hide hip/rocm devices
    'LSTT_DEVICE="0"'
)
# run TEXT-TO-SPEECH on cpu
LTTS_OVERRIDE=(
    'CUDA_VISIBLE_DEVICES=""'
    'HIP_VISIBLE_DEVICES=""'
    'LTTS_MODE="cpu"'
    'LTTS_DEVICE="none"'
)
# run IMAGE on vulkan/igpu and te on cpu
LIMG_OVERRIDE=(
    'LIMG_BACKEND="vulkan0,te=cpu"'
)
```

### Resulting Memory Allocation Map

| Service / Component | Device/Backend | VRAM (dGPU Vulkan1) | VRAM (iGPU Vulkan0) | System RAM |
|---|---|---|---|---|
| **Chat** | vulkan1 (dGPU) | **19,142 MiB** | 0 MiB | ~851 MiB |
| **Embedding** | vulkan1 (dGPU) | **~2,940 MiB** | 0 MiB | ~400 MiB |
| **Rerank** | vulkan1 (dGPU) | **~1,308 MiB** | 0 MiB | ~200 MiB |
| **Speech-to-Text** | vulkan0 (iGPU) | 0 MiB | **809 MiB** | ~126 MiB |
| **Text-to-Speech** | CPU | 0 MiB | 0 MiB | **~350 MiB** (Kokoro) |
| **Image** | vulkan0 (iGPU) | 0 MiB | **6,368 MiB** | ~3,812 MiB |
| **Total** | - | **23,390 MiB** | **7,177 MiB** | **~8,324 MiB** |

**Status:**
- **dGPU (RX 7900 XTX):** **Safe**. Fits within 24,576 MiB usable VRAM. Remaining headroom: **~1,186 MiB** free VRAM.
- **iGPU (Radeon Graphics):** **Safe**. Fits within 16 GiB shared RAM. Remaining headroom: **9,207 MiB** free VRAM.
