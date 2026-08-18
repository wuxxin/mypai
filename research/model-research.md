# Models Research

## unintegrated New Models

Image/video Gen:
  - interesting model: https://huggingface.co/Abiray/Minimax-H3-nvfp4-INT4-INT8-Convrot

Vision LLM:
  - interesting vision only model: https://huggingface.co/microsoft/Mage-VL

Unknown:
  - https://huggingface.co/Yiivgeny/parakeet-tdt-0.6b-v3-sherpa-onnx-fp16
  - https://huggingface.co/Supertone/supertonic
  - https://huggingface.co/csukuangfj/Inflect-Nano-v2-ONNX
  - https://huggingface.co/Audio8/Audio8-TTS-Preview-0.6b

## Chat / Vision LLM

### Main Model

#### Baseline llama-server model: Qwen3-6 35B A3B GGUF

- LLM: https://huggingface.co/mudler/Qwen3.6-35B-A3B-APEX-GGUF/resolve/main/Qwen3.6-35B-A3B-APEX-I-Compact.gguf
- Vision: https://huggingface.co/mudler/Qwen3.6-35B-A3B-APEX-GGUF/resolve/main/mmproj.gguf
- Chat Template: https://huggingface.co/froggeric/Qwen-Fixed-Chat-Templates/resolve/main/chat_template.jinja
- Draft MTP: https://huggingface.co/IHaveNoClueAndIMustPost/Qwen3.6-35A3B-MTP-TENSORS-ONLY/resolve/main/am17an-Qwen3.6-35BA3B-MTP-only.gguf

#### New Main Model: Qwen3.8-27B (Native Vision-Language & Hybrid Thinking)

- Base Model: https://huggingface.co/Qwen/Qwen3.8-27B
- Unsloth GGUF Repo: https://huggingface.co/unsloth/Qwen3.8-27B-GGUF
- Selected GGUF (`UD-Q4_K_XL` ~17.9 GB VRAM): https://huggingface.co/unsloth/Qwen3.8-27B-GGUF
- Documentation & Guide: https://unsloth.ai/docs/models/qwen3.8
- Key Features: Native vision-language (image/video understanding), 256K native context (extensible to 1M via YaRN), hybrid thinking control (`reasoning_effort`: xhigh/medium/low, `preserve_thinking`).

#### Alternatives

Current selected Default Model: **BigBang-v1**

##### 📊 Multi-Domain Benchmark Matrix (Qwen3.6-35B Baseline = 100%)

The benchmarks below combine local agentic/CLI evaluations (Terminal-Bench 2.1, SWE-bench Verified/Pro, Claw-Eval, NL2Repo) with the frontier scientific, search, reasoning, and AI engineering benchmark suite (BrowseComp, XBench, HLE, FS-R, MLE-Bench, PaperBench, SciCode-V, BioMysteryBench). All entries follow the standardized format: **raw_score (+-relative_change%)**.

###### 1. CLI & Agentic Repository Engineering
| Model / Fine-tune | Terminal-Bench 2.1 | SWE-bench Verified | SWE-Bench Pro | Claw-Eval | NL2Repo  | VRAM & Footprint | Primary Specialization |
|---|---:|---:|---:|---:|---:|---|---|
| **Qwen3.6-35B (Baseline)** | 49.2 (100%) | 73.4 (100%) | 43.6 (100%) | 68.7 (100%) | 29.4 (100%) | 18.5 GB (APEX) | Neutral standard base infrastructure |
| 🌟 **Qwen3.8-27B** | **73.0 (+48.4%)** | -- | **61.7 (+41.5%)** | 56.9 (-17.2%) | **42.3 (+43.9%)** | 17.9 GB (UD-Q4_K_XL) | SOTA 27B native vision-language & agentic thinking model |
| 💥 **BigBang-v1** | 58.3 (+18.5%) | 79.4 (+8.2%) | **54.2 (+24.3%)** | 77.5 (+12.8%) | 36.0 (+22.4%) | 17.95 GB (IQ4_XS) | SOTA 35B reasoning & self-evolving agent |
| 🛡️ **BTL-4** (Bad Theory Labs) | 60.5 (+23.0%) | **78.4 (+6.8%)** | 48.2 (+10.6%) | 72.8 (+6.0%) | 35.2 (+19.7%) | 17.9 GB (IQ4_XS) | Execution-gated agentic reasoning & AST tool calls (73.5% BFCL) |
| ⚔️ **Fable-Fusion-711** (DavidAU) | 59.3 (+20.5%) | 77.2 (+5.2%) | 53.5 (+22.7%) | 75.2 (+9.5%) | **36.2 (+23.1%)** | 16.5 GB (IQ4_XS) | 27B Heretic multi-stage merge (>700 ARC-C, MTP accel) |
| 🌺 **Ornith-1.0-35B** (Apodex) | **62.8 (+27.6%)** | 75.6 (+3.0%) | 38.7 (-11.2%) | 69.8 (+1.6%) | 34.6 (+17.7%) | 21.2 GB (Q4_K_M) | Massive gain in CLI & terminal interaction |
| 🛠️ **KAT-Coder-V2.5-Dev** | 59.1 (+20.1%) | 79.6 (+8.4%) | 45.96 (+5.4%) | 67.2 (-2.2%) | 32.2 (+9.5%) | 18.5 GB (APEX) | Best code injector for hashline/diff edits |
| 🦅 **XYZ-Aquila-mini** (Nex-N2) | 51.3 (+4.3%) | 70.1 (-4.5%) | 50.2 (+15.1%) | 69.0 (+0.4%) | 28.6 (-2.7%) | 15.8 GB (Q3_K_XL) | Web browsing, scraping & long-horizon search |
| ⚡ **Qwen3.6-Escha-W2** | 48.5 (-1.4%) | 72.6 (-1.1%) | 42.8 (-1.8%) | 67.9 (-1.2%) | 28.9 (-1.7%) | **9.8 GB (EschaMoE)** | Ultra-compact 2-bit MoE (~98% FP8 retention in 9.8GB) |
| 🧪 **fuse-1-Lite** (5.72B) | 38.2 (-22.4%) | 62.5 (-14.9%) | 34.1 (-21.8%) | 58.6 (-14.7%) | 21.4 (-27.2%) | **4.2 GB (bfloat16)** | Compact 5.7B SLM fusing LFM2.5 base with 960 Qwen3.6 experts |
| 🧩 **Agents-A1** (Qwen3.5 Base) | 38.9 (-20.9%) | 61.5 (-16.2%) | 42.3 (-3.0%) | 65.4 (-4.8%) | 20.5 (-30.3%) | 17.5 GB (APEX) | Logically falls behind 3.6 series |
| ❄️ **North-Mini-Code-1.0** | 53.5 (+8.7%) | 74.0 (+0.8%) | 47.5 (+8.9%) | 69.5 (+1.1%) | 32.4 (+10.2%) | 19.2 GB (UD-Q4) | Native CoT reasoning for subagents |
| 🍃 **Ternary-Bonsai-27B** | 43.7 (-11.2%) | 74.9 (+2.1%) | 39.2 (-10.1%) | 71.7 (+4.4%) | 25.2 (-14.3%) | 7.2 GB (Q2_0) | Extremely lean, but loses syntax depth |

###### 2. Frontier Research, Search & Scientific Reasoning Benchmarks
| Model / Fine-tune | BrowseComp (Search) | XBench | HLE (Reasoning) | FS-R (Sci-Research) | MLE-Bench (AI) | PaperBench (Dev) | SciCode-V (Main/Sub) | BioMystery (HS/HD) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **Qwen3.6-35B (Baseline)** | 67.9 (100%) | 32.6 (100%) | 36.2 (100%) | 11.9 (100%) | 31.8 (100%) | 30.7 (100%) | 26.6 / 56.5 (100%) | 44.8 / 2.0 (100%) |
| 🌟 **Qwen3.8-27B** | -- | -- | 30.8 (-14.9%) | -- | -- | -- | -- | -- |
| 💥 **BigBang-v1** | **76.5 (+12.7%)** | 58.4 (+79.1%) | **50.3 (+39.0%)** | **46.2 (+288.2%)** | **59.1 (+85.8%)** | **53.6 (+74.6%)** | **50.0 / 68.6 (+88.0% / +21.4%)** | **57.5 / 15.7 (+28.3% / +685%)** |
| 🛡️ **BTL-4** (Bad Theory Labs) | 74.2 (+9.3%) | 59.8 (+83.4%) | 46.8 (+29.3%) | 31.2 (+162.2%) | 35.4 (+11.3%) | 32.8 (+6.8%) | 39.2 / 60.1 (+47.4% / +6.4%) | 48.5 / 6.2 (+8.3% / +210%) |
| ⚔️ **Fable-Fusion-711** (DavidAU) | 74.8 (+10.2%) | 56.2 (+72.4%) | 47.1 (+30.1%) | 34.5 (+189.9%) | 42.6 (+34.0%) | 41.2 (+34.2%) | 42.5 / 62.8 (+59.8% / +11.2%) | 52.0 / 8.5 (+16.1% / +325%) |
| 🌺 **Ornith-1.0-35B** (Apodex) | 73.9 (+8.8%) | **61.8 (+89.6%)** | 45.3 (+25.1%) | 29.6 (+148.7%) | 27.3 (-14.2%) | 20.5 (-33.2%) | 35.0 / 42.0 (+31.6% / -25.7%) | 50.2 / 5.9 (+12.1% / +195%) |
| 🛠️ **KAT-Coder-V2.5-Dev** | 68.5 (+0.9%) | 48.2 (+47.9%) | 42.1 (+16.3%) | 28.4 (+138.7%) | 34.2 (+7.5%) | 31.5 (+2.6%) | 38.5 / 59.2 (+44.7% / +4.8%) | 46.5 / 4.0 (+3.8% / +100%) |
| 🦅 **XYZ-Aquila-mini** (Nex-N2) | 74.1 (+9.1%) | 57.2 (+75.5%) | 38.4 (+6.1%) | 36.8 (+209.2%) | 18.2 (-42.8%) | 14.8 (-51.8%) | 15.6 / 39.0 (-41.4% / -31.0%) | 42.9 / 5.9 (-4.2% / +195%) |
| ⚡ **Qwen3.6-Escha-W2** | 66.8 (-1.6%) | 32.1 (-1.5%) | 35.6 (-1.7%) | 11.6 (-2.5%) | 31.2 (-1.9%) | 30.2 (-1.6%) | 26.1 / 55.8 (-1.9% / -1.2%) | 44.1 / 1.9 (-1.6% / -5.0%) |
| 🧪 **fuse-1-Lite** (5.72B) | 51.2 (-24.6%) | 24.5 (-24.8%) | 22.4 (-38.1%) | 8.2 (-31.1%) | 18.5 (-41.8%) | 16.2 (-47.2%) | 19.4 / 41.2 (-27.1% / -27.1%) | 32.0 / 1.0 (-28.6% / -50.0%) |
| 🧩 **Agents-A1** (Qwen3.5 Base) | 48.5 (-28.6%) | 52.4 (+60.7%) | 46.3 (+27.9%) | 38.4 (+222.7%) | 27.3 (-14.2%) | 17.3 (-43.6%) | 50.0 / 64.1 (+88.0% / +13.5%) | 48.9 / 2.0 (+9.2% / 0.0%) |
| ❄️ **North-Mini-Code-1.0** | 71.2 (+4.9%) | 45.8 (+40.5%) | 43.0 (+18.8%) | 26.5 (+122.7%) | 32.5 (+2.2%) | 28.0 (-8.8%) | 34.0 / 58.0 (+27.8% / +2.7%) | 47.0 / 4.0 (+4.9% / +100%) |
| 🍃 **Ternary-Bonsai-27B** | 58.0 (-14.6%) | 36.5 (+12.0%) | 39.5 (+9.1%) | 18.2 (+52.9%) | 22.4 (-29.6%) | 19.0 (-38.1%) | 20.0 / 45.0 (-24.8% / -20.4%) | 40.0 / 2.0 (-10.7% / 0.0%) |

###### 3. Frontier Model Cross-Scale Comparison (35B Scale vs 100B+ / Closed Frontier)
| Model | Architecture / Scale | BrowseComp | SWE-Bench Pro | HLE | FS-R | MLE-Bench | PaperBench | BioMystery (HD) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| **Claude Opus 4.8** | Frontier Closed API | 84.3 | 69.2 | 57.9 | 45.2 | 63.6 | - | 42.4 |
| **GPT 5.5** | Frontier Closed API | 84.4 | 58.6 | 52.2 | 58.3 | 59.1 | 64.2 | 23.5 |
| **DeepSeek V4 Pro** | 1.6T MoE Open-Weights | 83.4 | 55.4 | 48.2 | 40.7 | 59.1 | 50.4 | 13.7 |
| **DeepSeek V4 Flash** | 284B MoE Open-Weights | 73.2 | 52.6 | 45.1 | 37.7 | 40.9 | 40.4 | 23.5 |
| 💥 **BigBang-v1** | **35B MoE (Fine-tune)** | **76.5** | **54.2** | **50.3** | **46.2** | **59.1** | **53.6** | **15.7** |
| ⚔️ **Fable-Fusion-711** | **27B Dense (Merge)** | **74.8** | **53.5** | **47.1** | **34.5** | **42.6** | **41.2** | **8.5** |
| 🌟 **Qwen3.8-27B** | **27B Dense Native VL (Base)** | -- | **61.7** | 30.8 | -- | -- | -- | -- |
| **Qwen3.6-35B** | 35B MoE (Baseline) | 67.9 | 43.6 | 36.2 | 11.9 | 31.8 | 30.7 | 2.0 |

###### 4. Cited Benchmark Repositories & Leaderboards Link List
| Benchmark | Official Homepage / Leaderboard | Code Repository / Dataset |
|---|---|---|
| **Terminal-Bench 2.1** | [tbench.ai Leaderboard](https://tbench.ai) | [harbor-framework/terminal-bench-2-1 (GitHub)](https://github.com/harbor-framework/terminal-bench-2-1) |
| **SWE-bench (Verified & Pro)** | [swebench.com Leaderboard](https://www.swebench.com/) | [princeton-nlp/SWE-bench (GitHub)](https://github.com/princeton-nlp/SWE-bench) |
| **Claw-Eval** | [claw-eval.github.io](https://claw-eval.github.io/) | [claw-eval/claw-eval (GitHub)](https://github.com/claw-eval/claw-eval) \| [claw-eval/Claw-Eval (HF)](https://huggingface.co/datasets/claw-eval/Claw-Eval) |
| **NL2Repo-Bench** | [AweAgent Meta-NL2Repo (HF)](https://huggingface.co/datasets/AweAI-Team/AweAgent-Meta-NL2Repo) | [Awesome-Long-Horizon-Agents (GitHub)](https://github.com/RUC-NLPIR/Awesome-Long-Horizon-Agents) |
| **BrowseComp** | [OpenAI BrowseComp Blog](https://openai.com/index/browsecomp/) | [openai/simple-evals (GitHub)](https://github.com/openai/simple-evals) |
| **XBench** | [xbench.org](https://xbench.org) | [xbench-ai/xbench-evals (GitHub)](https://github.com/xbench-ai/xbench-evals) \| [xbench (HF)](https://huggingface.co/xbench) |
| **Humanity's Last Exam (HLE)** | [lastexam.ai Leaderboard](https://lastexam.ai) | [centerforaisafety/hle (GitHub)](https://github.com/centerforaisafety/hle) \| [cais/hle (HF)](https://huggingface.co/datasets/cais/hle) |
| **FrontierScience Research (FS-R)** | [frontier-science/FS-R (HF)](https://huggingface.co/datasets/frontier-science/FS-R) | [frontier-science/FS-R (HF Dataset)](https://huggingface.co/datasets/frontier-science/FS-R) |
| **MLE-Bench** | [OpenAI MLE-Bench Announcement](https://openai.com/index/mle-bench/) | [openai/mle-bench (GitHub)](https://github.com/openai/mle-bench) |
| **PaperBench** | [PaperBench ICML 2024](https://icml.cc) | [EnvCommons/PaperBench (GitHub)](https://github.com/EnvCommons/PaperBench) \| [josancamon/paperbench (HF)](https://huggingface.co/datasets/josancamon/paperbench) |
| **SciCode / SciCode-V** | [scicode-bench.github.io](https://scicode-bench.github.io) | [scicode-bench/SciCode (GitHub)](https://github.com/scicode-bench/SciCode) |
| **BioMysteryBench** | [Anthropic BioMysteryBench (HF)](https://huggingface.co/datasets/Anthropic/BioMysteryBench-full) | [Anthropic/BioMysteryBench-full (HF)](https://huggingface.co/datasets/Anthropic/BioMysteryBench-full) |


##### Qwen3.8-27B (Qwen / Unsloth)

- Base Model Repo: https://huggingface.co/Qwen/Qwen3.8-27B
- GGUF Repo: https://huggingface.co/unsloth/Qwen3.8-27B-GGUF
- Unsloth Documentation: https://unsloth.ai/docs/models/qwen3.8
- Footprint: ~17.9 GB VRAM (`UD-Q4_K_XL`) / ~13.4 GB VRAM (`UD-Q3_K_XL`) / ~9.01 GB VRAM (`UD-IQ2_XXS`)
- **Key Benchmarks**: Terminal-Bench 2.1 **73.0%**, SWE-bench Pro **61.7%**, QwenSWEBench **79.0%**, NL2Repo **42.3%**, DeepSWE 1.1 **42.2%**, CoWorkBench **70.7%**, OSWorld-Verified **84.3%**, WebArena-Verified **64.8%**, AndroidWorld **81.9%**, IFBench **79.5%**, GPQA Diamond **89.2%**, LiveCodeBench v6 **90.3%**.
- **Summary & Relevance for omp**: Next-generation dense 27B native vision-language model with hybrid thinking control, developer role support for agentic tool calling (Codex/OpenCode/Claude Code), and 256K native context (extensible to 1M). Delivers massive gains across CLI interaction, repository engineering, and multimodal task completion.

##### BigBang-v1

- Base Model: https://huggingface.co/endless-frontier/BigBang-v1 (Qwen3.6-35B-A3B fine-tune via self-evolving synthetic data framework on ~10,000 frontier scientific & technical tasks)
- GGUF Repo: https://huggingface.co/bartowski/endless-frontier_BigBang-v1-GGUF
- Selected GGUF (IQ4_XS ~17.95 GB VRAM, closest footprint to APEX-I-Compact): https://huggingface.co/bartowski/endless-frontier_BigBang-v1-GGUF/resolve/main/endless-frontier_BigBang-v1-IQ4_XS.gguf
- Vision Projector: https://huggingface.co/bartowski/endless-frontier_BigBang-v1-GGUF/resolve/main/mmproj-endless-frontier_BigBang-v1-f16.gguf
- **Summary & Relevance for omp**: Outperforms DeepSeek V4 Flash (284B) and matches/exceeds DeepSeek V4 Pro (1.6T) on HLE, FS-R, PaperBench, and BioMysteryBench-HD. Outstanding choice for complex agentic workflows, long-horizon search, and technical tool execution.

##### BTL-4 (Bad Theory Labs)

- Base Model: https://huggingface.co/badtheorylabs/BTL-4 (35B MoE fine-tuned from `Ornith-1.0-35B` on an execution-gated reasoning corpus)
- GGUF Footprint: ~17.9 GB VRAM (`IQ4_XS`) / ~12.2 GB VRAM (`IQ2_XXS`)
- **Key Benchmarks**: SWE-bench Verified **78.4%** (SOTA for open 35B models), BFCL v4 AST **73.5%**, LiveCodeBench v6 **66.1%** (99.1% Easy / 86.7% Medium / 60.5% Hard).
- **Summary & Relevance for omp**: Execution-gated reasoning model where candidate solution trajectories were retained only if the output code actually compiled and passed test suites. High tool-calling fidelity (73.5% BFCL AST checker) makes it an excellent alternative for coding agent subservices.

##### Qwen3.6-35B-A3B-Escha-W2 (EschaLabs)

- Model Repo: https://huggingface.co/EschaLabs/Qwen3.6-35B-A3B-Escha-W2
- Runtime Engine: [EschaLabs/escha-runtime-qwen3moe](https://huggingface.co/EschaLabs/escha-runtime-qwen3moe) (SGLang & ZML backends)
- Footprint: **~9.8 GB VRAM** (2-bit `EschaMoE` weight quantization)
- **Key Benchmarks**: HumanEval+ **92.07%** pass@1, CRUXEval-O **61.75%**, LiveCodeBench v6 **62.64%**, MMLU-Pro **80.9%**, Math-500 **94.2%**.
- **Summary & Relevance for omp**: Ultra-compact 2-bit quantization of Qwen3.6-35B-A3B retaining ~98% of FP8 accuracy in a 9.8 GB VRAM budget. Enables serving full 35B MoE capabilities on 12GB–16GB consumer GPUs via SGLang or C++ ZML engines.

##### Qwen3.6-27B-Fable-Fusion-711 (DavidAU)

- Model Repo: https://huggingface.co/DavidAU/Qwen3.6-27B-Fable-Fusion-711-Uncensored-Heretic-NM-DAU-NEO-MAX-MTP-GGUF
- Footprint: ~16.5 GB VRAM (`IQ4_XS`) / ~28.5 GB VRAM (`Q8_0`)
- **Key Benchmarks**: ARC-Challenge **>700** (first 27B model to breach 700 ARC-C in both 4-bit and 8-bit), SWE-bench Verified **77.2%**, SWE-bench Pro **53.5%**, Terminal-Bench 2.0 **59.3%**, SkillsBench **48.2%**, NL2Repo **36.2%**.
- **Summary & Relevance for omp**: Multi-stage fine-tune & merge combining Fable, Polaris, and Claude Opus reasoning traces. Fully uncensored heretic flexibility with MTP (Multi-Token Prediction) GGUF acceleration for fast decode throughput.

##### fuse-1-Lite (Akahsizrr)

- Model Repo: https://huggingface.co/Akahsizrr/fuse-1-Lite
- Architecture: 5.72B MoE SLM fusing `LiquidAI/LFM2.5-2.6B` host (2.70B frozen params) with 960 coding experts (3.02B params) transplanted from `Qwen3.6-35B-A3B`.
- Footprint: **~4.2 GB VRAM**
- **Summary & Relevance for omp**: Novel SLM/MoE fusion architecture that transplants actual Qwen3.6-35B coding expert weights into a lightweight 2.7B base model with a learned router. Ideal for ultra-fast, low-memory on-device coding assistance and local subagent execution.


## embedding / reranking

### Top Multilingual (German/English) Production Recommendations for TEI

Based on Hindsight's retrieval requirements, the best model configurations satisfying specific multilingual benchmarks (MTEB-DE / BEIR), context lengths, and native serving support in Text Embeddings Inference (TEI) are compiled below:

#### Recommended Embedding Candidates
*Criteria: MTEB German Retrieval > 60, TEI Native or Python.*

*Note on VRAM: Because these models are served under TEI in single-forward-pass mode (no autoregressive generation), they do not allocate a KV cache. VRAM scales with model weights plus transient attention activations (quadratic in context length). See [Architecture & KV Cache reference](#embedding-model-architectures-attention-kv-cache--vram-scaling) for detailed scaling analysis.*

##### Gold Tier (Context Window > 8K tokens)
1. **[jina-embeddings-v5-text-small](https://huggingface.co/jinaai/jina-embeddings-v5-text-small)** (677M parameters)
   - **MTEB German Retrieval**: ~65.0
   - **Context Window**: 32,768 (32K) tokens
   - **TEI Native**: No (Python Qwen3 causal decoder backbone)
   - **License**: CC-BY-NC 4.0
   - **Expected GPU Mem (8 parallel)**: **~1.8 GB VRAM** (Weight baseline: ~1.35 GB; CUDA context and batch activations: ~400 MB).
   - **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): ~4.5ms | 8x8K batch (65K tkn): ~220ms.
   - *Best for*: Production setups needing long-context windows (32K) served natively.
2. **[gte-Qwen2-1.5B-instruct](https://huggingface.co/Alibaba-NLP/gte-Qwen2-1.5B-instruct)** (1.5B parameters)
   - **MTEB German Retrieval**: ~66.2
   - **Context Window**: 32,768 (32K) tokens
   - **TEI Native**: ? (Qwen2 causal decoder backbone)
   - **License**: Apache 2.0 (permissive/commercial-friendly)
   - **Expected GPU Mem (8 parallel)**: **~3.4 GB VRAM** (Weight baseline: ~3.0 GB; CUDA context and batch activations: ~400 MB).
   - **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): ~9.2ms | 8x8K batch (65K tkn): ~420ms.
   - *Best for*: Permissive-license 32K context deployments requiring SOTA multilingual performance.
3. **[pplx-embed-context-v1-0.6b](https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b)** (600M parameters)
   - **MTEB German Retrieval**: ~60.7 (MIRACL-DE)
   - **Context Window**: 32,768 (32K) tokens
   - **TEI Native**: ? (Bidirectional Qwen3-based encoder backbone)
   - **License**: Custom (Perplexity)
   - **Expected GPU Mem (8 parallel)**: **~1.95 GB VRAM** (Weight baseline: ~1.20 GB; CUDA context and batch activations: ~400 MB, activation memory: ~350 MB).
   - **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): ~3.2ms | 8x8K batch (65K tkn): ~210ms.
   - *Best for*: Long-context contextual RAG requiring late-chunking support.

##### Silver Tier (Context Window $\le$ 8K tokens)
1. **[jina-embeddings-v3](https://huggingface.co/jinaai/jina-embeddings-v3)** (685M parameters)
   - **MTEB German Retrieval**: ~71.8
   - **Context Window**: 8,192 (8K) tokens (via RoPE)
   - **TEI Native**: Yes (XLM-RoBERTa encoder backbone)
   - **License**: CC-BY-NC 4.0 (commercial options available)
   - **Expected GPU Mem (8 parallel)**: **~1.8 GB VRAM** (Weight baseline: ~1.37 GB; CUDA context and batch activations: ~400 MB).
   - **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): ~3.8ms | 8x8K batch (65K tkn): ~230ms.
   - *Best for*: Maximum accuracy and task-specific adapters.
2. **[bge-m3](https://huggingface.co/BAAI/bge-m3)** (567M parameters)
   - **MTEB German Retrieval**: ~70.9
   - **Context Window**: 8,192 (8K) tokens
   - **TEI Native**: Yes (XLM-RoBERTa encoder backbone)
   - **License**: MIT (permissive/commercial-friendly)
   - **Expected GPU Mem (8 parallel)**: **~1.6 GB VRAM** (Weight baseline: ~1.14 GB; CUDA context and batch activations: ~400 MB).
   - **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): ~3.0ms | 8x8K batch (65K tkn): ~200ms.
   - *Best for*: Risk-free enterprise hybrid retrieval (dense, sparse, multi-vector).
   - **Active Deployment**: Selected as production embedding model (replaces pplx-embed-context-v1-0.6b). Candle-native means no Python backend overhead, lower VRAM despite more params.
3. **[gte-multilingual-base](https://huggingface.co/Alibaba-NLP/gte-multilingual-base)** (306M parameters)
   - **MTEB German Retrieval**: ~69.2
   - **Context Window**: 8,192 (8K) tokens
   - **TEI Native**: Yes (XLM-RoBERTa encoder backbone)
   - **License**: Apache 2.0 (permissive/commercial-friendly)
   - **Expected GPU Mem (8 parallel)**: **~1.1 GB VRAM** (Weight baseline: ~612 MB; CUDA context and batch activations: ~400 MB).
   - **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): ~1.8ms | 8x8K batch (65K tkn): ~120ms.
   - *Best for*: High-throughput, resource-constrained deployments.
4. **[snowflake-arctic-embed-l-v2.0](https://huggingface.co/Snowflake/snowflake-arctic-embed-l-v2.0)** (568M parameters)
   - **MTEB German Retrieval**: ~66.5
   - **Context Window**: 8,192 (8K) tokens
   - **TEI Native**: Yes (XLM-RoBERTa encoder backbone)
   - **License**: Apache 2.0 (permissive/commercial-friendly)
   - **Expected GPU Mem (8 parallel)**: **~1.89 GB VRAM** (Weight baseline: ~1.14 GB; CUDA context and batch activations: ~400 MB, activation memory: ~350 MB).
   - **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): ~3.0ms | 8x8K batch (65K tkn): ~200ms.
   - *Best for*: Highly performant Apache 2.0 multilingual retrieval without compromised English quality.


#### Recommended Reranking Candidates
*Criteria: MTEB(eng, v2) Retrieval NDCG@10 rank-ordered, TEI Native or Python.*

1. **[gte-reranker-modernbert-base](https://huggingface.co/Alibaba-NLP/gte-reranker-modernbert-base)** (149M parameters)
   - **MTEB(eng, v2) Retrieval NDCG@10**: ~0.5843
   - **Context Window**: 8,192 (8K) tokens
   - **TEI Native**: Yes (ModernBERT cross-encoder via Candle)
   - **License**: Apache 2.0
   - **Expected GPU Mem (8 parallel)**: **~700 MB VRAM** (Weight baseline: ~300 MB; CUDA overhead: ~400 MB; activation memory: minimal under Flash Attention).
   - **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): ~4.0ms | 8x8K batch (65K tkn): ~250ms.
   - *Best for*: Highest NDCG@10 among all TEI-compatible models — matches 1.2B NVIDIA nemotron on Hit@1 at 1/8 the size.
2. **[ibm-granite/granite-embedding-reranker-english-r2](https://huggingface.co/ibm-granite/granite-embedding-reranker-english-r2)** (149M parameters)
   - **MTEB(eng, v2) Retrieval NDCG@10**: ~0.5656
   - **Context Window**: 8,192 (8K) tokens
   - **TEI Native**: Yes (ModernBERT cross-encoder via Candle)
   - **License**: Apache 2.0
   - **Expected GPU Mem (8 parallel)**: **~700 MB VRAM** (Weight baseline: ~300 MB; CUDA overhead: ~400 MB; activation memory: minimal under Flash Attention).
   - **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): ~4.0ms | 8x8K batch (65K tkn): ~250ms.
   - *Best for*: Compliance-sensitive deployments — trained exclusively on permissively-licensed data with full data provenance.
3. **[bge-reranker-v2-m3](https://huggingface.co/BAAI/bge-reranker-v2-m3)** (567M parameters)
   - **MTEB(eng, v2) Retrieval NDCG@10**: ~0.5526
   - **Context Window**: 8,192 (8K) tokens
   - **TEI Native**: Yes (XLM-RoBERTa cross-encoder via Candle)
   - **License**: MIT
   - **Expected GPU Mem (8 parallel)**: **~1.89 GB VRAM** (Weight baseline: ~1.14 GB; CUDA overhead: ~400 MB; activation memory: ~350 MB under Flash Attention).
   - **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): ~5.5ms | 8x8K batch (65K tkn): ~340ms.
   - *Best for*: Permissive-license production RAG pipelines with proven multilingual track record.
4. **[jina-reranker-v2-base-multilingual](https://huggingface.co/jinaai/jina-reranker-v2-base-multilingual)** (278M parameters)
   - **Context Window**: 1,024 (1K) tokens (uses sliding window chunking for longer documents)
   - **TEI Native**: Yes (XLM-RoBERTa cross-encoder backbone)
   - **License**: CC-BY-NC 4.0
   - **Expected GPU Mem (8 parallel)**: **~1.01 GB VRAM** (Weight baseline: ~560 MB; CUDA overhead: ~400 MB; activation memory: ~50 MB).
   - **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): ~2.8ms | 8x1K batch (8K tkn): ~80ms.
   - *Best for*: Low-latency, low-VRAM multilingual reranking where 1K context is sufficient.
5. **[jina-reranker-v3](https://huggingface.co/jinaai/jina-reranker-v3)** (600M parameters)
   - **MTEB(eng, v2) Retrieval NDCG@10**: ~0.5940
   - **Context Window**: 131,072 (131K) tokens
   - **TEI Native**: No (requires `JinaForRanking` detection patch + model loading fix in ClassificationModel; currently blocked on Python backend model loading)
   - **License**: CC-BY-NC 4.0
   - **Expected GPU Mem (8 parallel)**: **~2.05 GB VRAM** (Weight baseline: ~1.20 GB; CUDA overhead: ~400 MB; activation memory: ~450 MB under Flash Attention).
   - **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): ~4.8ms | 8x8K batch (65K tkn): ~290ms.
   - *Best for*: Highest raw NDCG@10 (0.5940) with multi-document listwise ranking and 131K context — but requires patching for TEI.

---


### current llama-server embedding model: Qwen3-Embedding 0.6B GGUF

- **URL**: https://huggingface.co/iyanello/Qwen3-Embedding-0.6B-GGUF/resolve/main/Qwen3-Embedding-0.6B-Q8_0.gguf (fixed EOS metadata; official Qwen GGUF lacks `add_eos_token`)
- **Architecture**: Causal Decoder-only (Qwen3ForCausalLM), 596M params, 28 layers, 16 attn heads, 8 KV heads (GQA 2:1), head_dim=64. Pooling: last-token.
- **Format & Size**: GGUF `Q8_0` format, ~600 MB disk size. (Standard base model is 1.2 GB in bf16/fp16 Safetensors).
- **Total GPU Usage**:
  - **Default Serving Setup** (non-unified KV, 6 parallel slots @ 8K context, Q8_0 KV cache, single `llama_decode(49152)`): **~3.0 GB VRAM** (600M weights + 1.34G KV [6 × 224 MB] + 400M runtime + ~600M activations).
  - **Sequential Config** (kv-unified, 6 parallel slots, single 8K-position shared pool): **~1.4 GB VRAM** (600M weights + 224M KV + 400M runtime + ~200M activations).
- **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): **~12.0ms** | 8x8K batch (65K tkn): **~650ms** (served via `llama-server` GGUF).
- **English & German Score**:
  - **MTEB English (Retrieval)**: ~64.3
  - **MTEB German Retrieval (nDCG@10)**: ~58.2
  - **MMTEB Average**: ~60.1
- **Agentic Use**: High-capacity semantic memory retrieval over large context windows.
- **Max CTX**: 32,768 (32K) tokens.
- **Output Types**: 1024-dimensional dense vectors.
- **Other features (not) available**: No bidirectional context during encoding (due to causal self-attention), which can sometimes affect representation quality compared to encoder-only architectures, but excels at long-context retrieval without chunk limits. When served via `llama-server`, requires a pre-allocated KV cache per slot (see [Architecture & KV Cache reference](#embedding-model-architectures-attention-kv-cache--vram-scaling)).
- **Fits expected hindsight usage of embedding**: Yes. Excellent context capacity (32K), GGUF format enables hybrid CPU/GPU offloading on resource-constrained setups.
- **TEI Support & Native**: **No** (Causal decoder backbone, requires GGUF in `llama-server` or Python wrappers as TEI's Candle Rust backend does not support causal embedding layer loading natively).
- **MTEB Leaderboard Multilingual**: Mean(task): ~60.1.

### current llama-server reranking model: Qwen3-Reranker 0.6B GGUF

- **URL**: https://huggingface.co/prithivMLmods/Qwen3-Reranker-0.6B-seq-cls-GGUF/resolve/main/Qwen3-Reranker-0.6B-seq-cls.Q4_K_M.gguf
- **Architecture**: Causal Decoder-only (based on Qwen3, with pooling rank). Generative ranking: scores relevance based on the next-token probability of `"yes"` and `"no"` at the end of the query-document sequence.
- **Format & Size**: GGUF `Q4_K_M` format, ~360 MB disk size. (Standard base model is 1.2 GB in fp16).
- **Total GPU Usage**:
  - **Default Serving Setup** (`LRR_PARALLEL=2` slots @ `LRR_N_CTX=16384` context, `q4_0` KV cache format): **~860 MB VRAM** (Weight baseline: ~360 MB, CUDA overhead: ~400 MB, KV Cache: ~252 MB [~112 MB per slot]).
  - **Standardized Load Comparison** (8 parallel requests @ 8K context, total tokens: 65,536):
    - **8-bit KV Cache**: **~1.65 GB VRAM** (Weight baseline: ~360 MB, CUDA overhead: ~400 MB, KV Cache: ~896 MB [112 MB per slot]).
    - **16-bit KV Cache**: **~2.55 GB VRAM** (Weight baseline: ~360 MB, CUDA overhead: ~400 MB, KV Cache: ~1.79 GB [224 MB per slot]).
- **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): **~15.0ms** | 8x8K batch (65K tkn): **~780ms** (served via `llama-server` GGUF).
- **English & German Score**:
  - **BEIR nDCG@10 (English)**: ~58.2
  - **MTEB German Retrieval (nDCG@10)**: ~58.5
- **Agentic Use**: High-precision semantic ranking of candidates fetched from parallel arms.
- **Max CTX**: 40,960 tokens (served at 16384).
- **Output Types**: Sequence classification score (relevance probability logits).
- **Other features (not) available**: Bypasses standard classifier heads (which would require loading missing parameters like `score.weight`); computes scores natively via text logits.
- **Fits expected hindsight usage of embedding**: Yes. 40K context window permits batch ranking of large chunk/observation lists in a single model call.
- **TEI Support & Native**: **No** (Causal decoder backbone, incompatible with TEI's sequence classification cross-encoder loading).
- **Retrieval Benchmarks / BEIR Score**: BEIR average of ~58.2 nDCG@10 (MTEB-R Retrieval subset reports ~65.80).

### Alternatives (for TEI engine)

#### Embedding: pplx-embed

- **URL**: https://huggingface.co/perplexity-ai/pplx-embed-context-v1-0.6b
- **PDF**: [2602.11151v2.pdf](2602.11151v2.pdf) (Source: Table 2, Page 6, "nDCG@10 on the MIRACLRetrievalHardNegatives task per language").
- **Architecture**: Bidirectional Encoder (built on a Qwen3 backbone modified via diffusion-based pretraining to operate bidirectionally).
- **Format & Size**: Float16/BFloat16 Safetensors, ~1.2 GB disk size.
- **Total GPU Usage**: Serviced under TEI with 8 parallel requests @ 8K context (total tokens: 65,536). No KV cache. Expected VRAM: **~1.95 GB VRAM** (Weight baseline: ~1.2 GB, CUDA overhead: ~400 MB, linear activation memory under Flash Attention: ~350 MB).
- **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): **~3.2ms** | 8x8K batch (65K tkn): **~210ms** (served via TEI).
- **English & German Score**:
  - **MTEB English (v2)**: ~70.2
  - **MTEB German Retrieval (nDCG@10)**: **~60.7** (verified German subset of the MIRACL task in the paper, outperforming `qwen3-embed-0.6B`'s score of 54.2).
  - **MTEB Multilingual v2 Average**: **65.41%** (INT8 default).
- **Agentic Use**: High-throughput web search and RAG tasks where document-level context is needed to disambiguate chunks.
- **Max CTX**: 32,768 (32K) tokens.
- **Output Types**: 1024-dimensional dense vectors. Supports Matryoshka Representation Learning (MRL) and binary quantization.
- **Other features**: Context-Awareness (embeds chunks by taking surrounding document context into account to avoid semantic ambiguity in RAG). No instruction prefixes required.
- **Fits expected hindsight usage of embedding**: Yes, excellent context length and low memory footprint under parallel execution, providing strong multilingual representation (60.7 German MIRACL score) for bilingual/multilingual workflows.
- **TEI Support & Native**: **Yes** (Bidirectional Qwen3-based encoder backbone, supported natively in TEI since v1.9.2).
- **MTEB Leaderboard Multilingual**: Mean(task): ~65.4.

#### Embedding: BAAI/bge-m3

- **URL**: https://huggingface.co/BAAI/bge-m3
- **PDF**: [2402.03216v5.pdf](2402.03216v5.pdf)
- **Architecture**: Bidirectional Encoder (Encoder-only, Bi-Encoder).
- **Format & Size**: Float16 Safetensors, ~1.14 GB disk size.
- **Total GPU Usage**: Serviced under TEI with 8 parallel requests @ 8K context (total tokens: 65,536). No KV cache. Expected VRAM: **~1.89 GB VRAM** (Weight baseline: ~1.14 GB, CUDA overhead: ~400 MB, linear activation memory under Flash Attention: ~350 MB).
- **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): **~3.0ms** | 8x8K batch (65K tkn): **~200ms** (served via TEI).
- **English & German Score**:
  - **MTEB English**: ~63.0
  - **MTEB German Retrieval (nDCG@10)**: ~70.9
  - **MMTEB Average**: ~63.2
- **Agentic Use**: Outstanding for multilingual memory retrieval systems.
- **Max CTX**: 8,192 tokens.
- **Output Types**: Dense vectors (1024 dims), sparse vectors (for lexical search), and multi-vector representations (late interaction). Supports Matryoshka dimension truncation (MRL).
- **Other features**: Multi-functionality (dense, sparse, multi-vector outputs generated in a single pass).
- **Fits expected hindsight usage of embedding**: Yes. Highly recommended for standard 8K context and strong multilingual requirements.
- **TEI Support & Native**: **Yes** (XLM-RoBERTa encoder backbone, supported natively in TEI).
- **MTEB Leaderboard Multilingual**: Mean(task): ~63.5.

#### Embedding: jinaai/jina-embeddings-v3

- **URL**: https://huggingface.co/jinaai/jina-embeddings-v3
- **Architecture**: XLM-RoBERTa encoder base (24 layers) with 5 task-specific LoRA adapters (`retrieval.query`, `retrieval.passage`, `separation`, `classification`, `text-matching`).
- **Format & Size**: Float16/BFloat16 Safetensors, ~1.15 GB disk size (scales to ~1.37 GB loaded).
- **Total GPU Usage**: Serviced under TEI with 8 parallel requests @ 8K context (total tokens: 65,536). No KV cache. Expected VRAM: **~2.17 GB VRAM** (Weight baseline: ~1.37 GB, CUDA overhead: ~400 MB, linear activation memory under Flash Attention: ~400 MB).
- **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): **~3.8ms** | 8x8K batch (65K tkn): **~230ms** (served via TEI).
- **English & German Score**:
  - **MTEB English**: ~65.5
  - **MTEB German Retrieval (nDCG@10)**: ~71.8
  - **MMTEB Average**: ~65.8
- **Agentic Use**: Task adapters allow tuning the embeddings dynamically for classification, clustering, or query-passage retrieval.
- **Max CTX**: 8,192 tokens (using RoPE for length extension).
- **Output Types**: Dense vectors (1024 dims, supports Matryoshka truncation down to 32).
- **Other features**: Task-specific LoRAs, RoPE positional encoding, Matryoshka Representation Learning.
- **Fits expected hindsight usage of embedding**: Excellent. The task adapters map cleanly to hindsight operations (e.g. `retrieval.query`/`retrieval.passage` for recall, and `separation` or `text-matching` for consolidation/deduplication).
- **TEI Support & Native**: **Yes** (XLM-RoBERTa encoder backbone, supported natively in TEI).
- **MTEB Leaderboard Multilingual**: Mean(task): ~65.5.

##### Embedding: jinaai/jina-embeddings-v5-text-small

- **URL**: https://huggingface.co/jinaai/jina-embeddings-v5-text-small
- **Architecture**: Causal Encoder (built on Qwen3-0.6B base backbone, last-token pooling, task-specific LoRA adapters).
- **Format & Size**: Float16/BFloat16 Safetensors, ~1.35 GB disk size (~677M parameters).
- **Total GPU Usage**: Serviced under TEI with 8 parallel requests @ 8K context (total tokens: 65,536). No KV cache. Expected VRAM: **~2.15 GB VRAM** (Weight baseline: ~1.35 GB, CUDA overhead: ~400 MB, linear activation memory under Flash Attention: ~400 MB).
- **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): **~4.5ms** | 8x8K batch (65K tkn): **~220ms** (served via TEI).
- **English & German Score**:
  - **MTEB English (v2)**: ~71.7
  - **MTEB German Retrieval (nDCG@10)**: ~65.0
  - **MMTEB Average**: ~67.7
- **Agentic Use**: Exceptional for long-context multilingual semantic search.
- **Max CTX**: 32,768 (32K) tokens.
- **Output Types**: Dense vectors (1024 dims, supports MRL down to 32).
- **Other features**: Task-specific LoRA adapters (retrieval, text-matching, clustering, classification), embedding distillation.
- **Fits expected hindsight usage of embedding**: Excellent fit. Outperforms older 0.6B models, matches the 32K context of Qwen3-Embedding, but runs under TEI and has task-specific adapters.
- **TEI Support & Native**: **Yes** (Qwen3 causal decoder backbone, supported in TEI via Python runner or vLLM adapter).
- **MTEB Leaderboard Multilingual / MMTEB**: Mean(task): 67.7.

#### Embedding: Alibaba-NLP/gte-multilingual-base

- **URL**: https://huggingface.co/Alibaba-NLP/gte-multilingual-base
- **Architecture**: XLM-RoBERTa encoder backbone.
- **Format & Size**: Float16/BFloat16 Safetensors, ~612 MB disk size (306M parameters).
- **Total GPU Usage**: Serviced under TEI with 8 parallel requests @ 8K context (total tokens: 65,536). No KV cache. Expected VRAM: **~1.21 GB VRAM** (Weight baseline: ~612 MB, CUDA overhead: ~400 MB, linear activation memory under Flash Attention: ~200 MB).
- **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): **~1.8ms** | 8x8K batch (65K tkn): **~120ms** (served via TEI).
- **English & German Score**:
  - **MTEB German Retrieval (nDCG@10)**: ~69.2
  - **MTEB English Retrieval**: ~64.8
  - **MMTEB Average**: ~63.0
- **Agentic Use**: Highly efficient RAG and classification queries where compute resources are constrained.
- **Max CTX**: 8,192 (8K) tokens.
- **Output Types**: 768-dimensional dense vectors.
- **Other features**: Bidirectional context representation, Apache 2.0 permissive license.
- **Fits expected hindsight usage of embedding**: Yes, excellent for 8K context and strong multilingual requirements under tight resource constraints.
- **TEI Support & Native**: **Yes** (XLM-RoBERTa encoder backbone, supported natively in TEI).
- **MTEB Leaderboard Multilingual**: Mean(task): ~63.0.

#### Embedding: Snowflake/snowflake-arctic-embed-l-v2.0

- **URL**: https://huggingface.co/Snowflake/snowflake-arctic-embed-l-v2.0
- **Architecture**: XLM-RoBERTa encoder backbone.
- **Format & Size**: Float16/BFloat16 Safetensors, ~1.14 GB disk size (568M parameters).
- **Total GPU Usage**: Serviced under TEI with 8 parallel requests @ 8K context (total tokens: 65,536). No KV cache. Expected VRAM: **~1.89 GB VRAM** (Weight baseline: ~1.14 GB, CUDA overhead: ~400 MB, linear activation memory under Flash Attention: ~350 MB).
- **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): **~3.0ms** | 8x8K batch (65K tkn): **~200ms** (served via TEI).
- **English & German Score**:
  - **MTEB German Retrieval (nDCG@10)**: ~66.5
  - **MTEB English Retrieval**: ~67.5
  - **MMTEB Average**: ~65.2
- **Agentic Use**: High-performance multilingual semantic retrieval with permissive licensing.
- **Max CTX**: 8,192 (8K) tokens.
- **Output Types**: 1024-dimensional dense vectors. Supports Matryoshka Representation Learning (MRL) truncation down to 256.
- **Other features**: Bidirectional context, Apache 2.0 permissive license.
- **Fits expected hindsight usage of embedding**: Yes, excellent choice for standard 8K context with strict permissive license requirements.
- **TEI Support & Native**: **Yes** (XLM-RoBERTa encoder backbone, supported natively in TEI).
- **MTEB Leaderboard Multilingual**: Mean(task): ~65.2.

#### Embedding: codefuse-ai/F2LLM-v2-0.6B

- **URL**: https://huggingface.co/codefuse-ai/F2LLM-v2-0.6B
- **Architecture**: Causal Decoder backbone (based on Qwen3).
- **Format & Size**: Float16/BFloat16 Safetensors, ~1.2 GB disk size (600M parameters).
- **Total GPU Usage**: Serviced under `llama-server` (requires KV cache) with 8 parallel requests @ 8K context (total tokens: 65,536):
  - **8-bit KV Cache**: **~2.5 GB VRAM** (Weight baseline: ~1.2 GB, CUDA overhead: ~400 MB, 8-bit KV Cache: ~896 MB [112 MB per slot]).
  - **16-bit KV Cache**: **~3.4 GB VRAM** (Weight baseline: ~1.2 GB, CUDA overhead: ~400 MB, 16-bit KV Cache: ~1.79 GB [224 MB per slot]).
- **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): **~9.5ms** | 8x8K batch (65K tkn): **~520ms** (served via `llama-server` / python wrapper).
- **English & German Score**:
  - **MTEB German Retrieval (nDCG@10)**: ~64.8
  - **MTEB English Retrieval**: ~68.2
- **Agentic Use**: Multilingual long-context retrieval where native TEI is not required, but permissive licensing is necessary.
- **Max CTX**: 32,768 (32K) tokens.
- **Output Types**: 1024-dimensional dense vectors (supports Matryoshka learning and knowledge distillation).
- **Other features**: Causal decoder representation, last-token pooling with L2 normalization, Apache 2.0 permissive license.
- **Fits expected hindsight usage of embedding**: Yes, viable as a long-context, permissively licensed alternative to Qwen3-Embedding served via `llama-server`.
- **TEI Support & Native**: **No** (Qwen3 causal decoder backbone, not compatible with TEI's native Candle sequence embedding loader).

#### Embedding: Alibaba-NLP/gte-Qwen2-1.5B-instruct

- **URL**: https://huggingface.co/Alibaba-NLP/gte-Qwen2-1.5B-instruct
- **Architecture**: Causal Decoder backbone (based on Qwen2).
- **Format & Size**: Float16/BFloat16 Safetensors, ~3.0 GB disk size (1.5B parameters).
- **Total GPU Usage**: Serviced under TEI with 8 parallel requests @ 8K context (total tokens: 65,536). No KV cache. Expected VRAM: **~3.4 GB VRAM** (Weight baseline: ~3.0 GB, CUDA overhead: ~400 MB, linear activation memory under Flash Attention: ~400 MB).
- **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): **~9.2ms** | 8x8K batch (65K tkn): **~420ms** (served via TEI).
- **English & German Score**:
  - **MTEB German Retrieval (nDCG@10)**: ~66.2
  - **MTEB English Retrieval**: ~70.8
- **Agentic Use**: High-performance, long-context multilingual retrieval where Apache 2.0 license is required.
- **Max CTX**: 32,768 (32K) tokens.
- **Output Types**: 1536-dimensional dense vectors (supports instruction prefixes for retrieval).
- **Other features**: Causal decoder representation, last-token pooling with bidirectional instruction context, Apache 2.0 permissive license.
- **Fits expected hindsight usage of embedding**: Yes, excellent for 32K context deployments with strong multilingual benchmarks and permissive license requirements.
- **TEI Support & Native**: **Yes** (Qwen2 causal decoder backbone, supported natively in TEI).
- **MTEB Leaderboard Multilingual**: Mean(task): ~68.0.


#### Reranking: BAAI/bge-reranker-v2-m3

- **URL**: https://huggingface.co/BAAI/bge-reranker-v2-m3
- **Architecture**: Cross-Encoder (Sequence Classification model based on XLM-RoBERTa).
- **Format & Size**: Float16 Safetensors, ~1.14 GB disk size (567M parameters).
- **Total GPU Usage**: Serviced under TEI with 8 parallel requests @ 8K context (total tokens: 65,536). No KV cache. Expected VRAM: **~1.89 GB VRAM** (Weight baseline: ~1.14 GB, CUDA overhead: ~400 MB, linear activation memory under Flash Attention: ~350 MB).
- **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): **~5.5ms** | 8x8K batch (65K tkn): **~340ms** (served via TEI).
- **English & German Score**:
  - **BEIR nDCG@10 (English)**: ~56.51
  - **MTEB German Retrieval (nDCG@10)**: ~57.2
- **Agentic Use**: Perfect for scoring candidates retrieved from multi-strategy arms.
- **Max CTX**: 8,192 tokens.
- **Output Types**: Relevance score logit.
- **Other features**: Bidirectional cross-attention.
- **Fits expected hindsight usage of embedding**: Yes, excellent for 8K context reranking.
- **TEI Support & Native**: **Yes** (XLM-RoBERTa cross-encoder backbone, supported natively in TEI).
- **Retrieval Benchmarks / BEIR Score**: BEIR average of ~55.8 nDCG@10.

#### Reranking: jinaai/jina-reranker-v2-base-multilingual

- **URL**: https://huggingface.co/jinaai/jina-reranker-v2-base-multilingual
- **Architecture**: Cross-Encoder (Sequence Classification model using XLM-RoBERTa base).
- **Format & Size**: Float16 Safetensors, ~560 MB disk size (278M parameters).
- **Total GPU Usage**: Serviced under TEI with 8 parallel requests @ 1K max context (truncates 8K inputs to its native limit of 1,024 tokens; total tokens: 8,192). No KV cache. Expected VRAM: **~1.01 GB VRAM** (Weight baseline: ~560 MB, CUDA overhead: ~400 MB, linear activation memory under Flash Attention: ~50 MB).
- **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): **~2.8ms** | 8x1K batch (8K tkn): **~80ms** (served via TEI; input truncated to 1K limit).
- **English & German Score**:
  - **BEIR nDCG@10 (English)**: ~57.06
  - **MTEB German Retrieval (nDCG@10)**: ~59.1
- **Agentic Use**: Best choice for low-latency, low-VRAM multilingual reranking.
- **Max CTX**: 1,024 tokens (uses sliding window chunking to process longer documents).
- **Output Types**: Relevance score logit.
- **Other features**: Native sequence classification classifier head.
- **Fits expected hindsight usage of embedding**: Yes, but the 1K context window can be restrictive for very long facts/chunks unless chunk size is capped.
- **TEI Support & Native**: **Yes** (XLM-RoBERTa cross-encoder backbone, supported under TEI).
- **Retrieval Benchmarks / BEIR Score**: BEIR average of ~54.5 nDCG@10.

#### Reranking: jinaai/jina-reranker-v3

- **URL**: https://huggingface.co/jinaai/jina-reranker-v3
- **PDF**: [2509.25085v4.pdf](2509.25085v4.pdf)
- **Architecture**: Causal Cross-Encoder (built on Qwen3-0.6B transformer backbone, uses "Last but Not Late" (LBNL) causal self-attention interaction over query and multiple documents, with a lightweight MLP projector head).
- **Format & Size**: Float16 Safetensors, ~1.2 GB disk size (600M parameters).
- **Total GPU Usage**: Serviced under TEI with 8 parallel requests @ 8K context (total tokens: 65,536). No KV cache. Expected VRAM: **~2.05 GB VRAM** (Weight baseline: ~1.2 GB, CUDA overhead: ~400 MB, linear activation memory under Flash Attention: ~450 MB).
- **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): **~4.8ms** | 8x8K batch (65K tkn): **~290ms** (served via TEI).
- **English & German Score**:
  - **BEIR nDCG@10 (English)**: ~61.94
  - **MTEB German Retrieval (nDCG@10)**: ~63.8
- **Agentic Use**: Advanced multi-hop retrieval and fact verification.
- **Max CTX**: 131,072 (131K) tokens. Can process up to 64 documents concurrently in a single context window.
- **Output Types**: Relevance scores for each document.
- **Other features**: LBNL interaction, multi-document batch ranking inside a single forward pass, MLP projector (1024 -> 512 -> 256).
- **Fits expected hindsight usage of embedding**: Outstanding. Its huge 131K context and ability to evaluate multiple documents concurrently make it an ideal fit for complex hindsight reflections.
- **TEI Support & Native**: **No** (requires patches — `JinaForRanking` is not detected by TEI's architecture classifier. The `tei-rocm/jina-reranker-v3.patch` adds `"Ranking"` suffix detection but the model's `ClassificationModel` uses `AutoModelForSequenceClassification` which cannot correctly load `JinaForRanking` due to missing `auto_map` entry. Candle `flash_qwen3.rs` explicitly bails on Qwen3 classifiers. Full Python backend support blocked on model loading refactor.)
- **Retrieval Benchmarks / BEIR Score**: BEIR average of 61.94 nDCG@10, HotpotQA 78.58, FEVER 94.01.

#### Reranking: ettin-reranker-400m-v1 (Active Production Model)

- **URL**: https://huggingface.co/cross-encoder/ettin-reranker-400m-v1
- **Architecture**: Cross-Encoder (ModernBertForSequenceClassification, ~401M parameters, 22-layer ModernBERT backbone)
- **Format & Size**: Float16 Safetensors, ~0.8 GB disk size
- **Total GPU Usage**: Serviced under TEI Candle backend with 1×8K context. No KV cache. Expected VRAM: **~1.6 GB VRAM**
- **English & German Score**:
  - **MTEB English Retrieval (nDCG@10)**: ~60.91
  - **German**: Transfer performance expected from ModernBERT multilingual training data
- **Agentic Use**: Production reranking for Hindsight recall pipeline
- **Max CTX**: 8,192 (8K) tokens
- **Output Types**: Relevance score logit via sequence classification head
- **Other features**: Apache 2.0 license, ModernBERT backbone with Flash Attention 2 support
- **TEI Support & Native**: **Yes** (ModernBertForSequenceClassification, requires tei-rocm >= pkgrel=6 with ModernBertModel detection patch)
- **Active Deployment**: Selected for production based on MTEB scores, Apache 2.0 license, and TEI Candle native support. Replaces Qwen3-Reranker-0.6B (llama-server GGUF) in the unified TEI setup.

#### Reranking: Alibaba-NLP/gte-reranker-modernbert-base

- **URL**: https://huggingface.co/Alibaba-NLP/gte-reranker-modernbert-base
- **Architecture**: Cross-Encoder (Sequence Classification model based on ModernBERT, with RoPE positional encodings, GeGLU activation, and classifier head).
- **Format & Size**: Float16/BFloat16 Safetensors, ~300 MB disk size (149M parameters).
- **Total GPU Usage**: Serviced under TEI with 8 parallel requests @ 8K context (total tokens: 65,536). No KV cache. Expected VRAM: **~700 MB VRAM** (Weight baseline: ~300 MB, CUDA overhead: ~400 MB, linear activation memory under Flash Attention: minimal due to ModernBERT flash_modernbert.rs native support).
- **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): **~4.0ms** | 8x8K batch (65K tkn): **~250ms** (served via TEI Candle).
- **English & German Score**:
  - **MTEB(eng, v2) Retrieval NDCG@10**: ~0.5843
  - **BEIR nDCG@10 (English)**: ~56.19 (top-20 reranked)
  - **MTEB German Retrieval (nDCG@10)**: ~56.0
- **Agentic Use**: Best TEI-compatible reranker under 1B params — matches 1.2B NVIDIA nemotron on Hit@1 (83.00%) in independent benchmarks. ModernBERT backbone with bidirectional cross-attention.
- **Max CTX**: 8,192 tokens.
- **Output Types**: Relevance score logit (single-class classifier head).
- **Other features**: Bidirectional cross-attention, RoPE positional encodings, Flash Attention 2.0 compatible, Apache 2.0 permissive license.
- **Fits expected hindsight usage of embedding**: Yes, best choice for 8K reranking with TEI — highest NDCG@10 among all TEI-compatible models, 1/4 the size of bge-reranker-v2-m3.
- **TEI Support & Native**: **Yes** (ModernBERT cross-encoder via Candle `flash_modernbert.rs` / `modernbert.rs`, detected via `ModernBertForSequenceClassification` architecture).
- **Retrieval Benchmarks / MTEB Score**: MTEB(eng, v2) Retrieval NDCG@10=0.5843, NanoBEIR=0.7017, BEIR(top-20)=56.19.

#### Reranking: ibm-granite/granite-embedding-reranker-english-r2

- **URL**: https://huggingface.co/ibm-granite/granite-embedding-reranker-english-r2
- **Architecture**: Cross-Encoder (Sequence Classification model based on ModernBERT, with PListMLE ranking loss training, trained exclusively on enterprise-friendly permissive data).
- **Format & Size**: Float16/BFloat16 Safetensors, ~300 MB disk size (149M parameters).
- **Total GPU Usage**: Serviced under TEI with 8 parallel requests @ 8K context (total tokens: 65,536). No KV cache. Expected VRAM: **~700 MB VRAM** (Weight baseline: ~300 MB, CUDA overhead: ~400 MB, linear activation memory under Flash Attention: minimal).
- **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): **~4.0ms** | 8x8K batch (65K tkn): **~250ms** (served via TEI Candle).
- **English & German Score**:
  - **MTEB(eng, v2) Retrieval NDCG@10**: ~0.5656
  - **BEIR Avg (with granite-embedding-english-r2 retriever)**: 55.8
  - **BEIR Avg (with granite-embedding-small-english-r2 retriever)**: 55.0
- **Agentic Use**: Enterprise-focused reranker trained exclusively on permissively-licensed data with transparent data provenance. Good for compliance-sensitive deployments.
- **Max CTX**: 8,192 tokens.
- **Output Types**: Relevance score logit (single-class classifier head).
- **Other features**: PListMLE position-aware ranking objective, model merging techniques, enterprise-governance data pipeline, Apache 2.0 permissive license.
- **Fits expected hindsight usage of embedding**: Yes, suitable for 8K reranking with strict licensing requirements and full data transparency.
- **TEI Support & Native**: **Yes** (ModernBERT cross-encoder via Candle `flash_modernbert.rs`, detected via `ModernBertForSequenceClassification` architecture).
- **Retrieval Benchmarks / MTEB Score**: MTEB(eng, v2) Retrieval NDCG@10=0.5656, BEIR=55.8, Miracl(en)=55.2.

#### Reranking: Ettin Reranker Family (cross-encoder/ettin-reranker-*-v1)

- **URL**: https://huggingface.co/collections/cross-encoder/ettin-rerankers (6 models: 17M, 32M, 68M, 150M, 400M, 1B parameters)
- **Architecture**: Cross-Encoder (Sentence Transformers CrossEncoder on Ettin ModernBERT encoders, with unpadded attention, RoPE, GeGLU, distilled from mxbai-rerank-large-v2 teacher).
- **Format & Size**: Float16/BFloat16 Safetensors, sizes range from ~35 MB (17M) to ~2 GB (1B).
- **Total GPU Usage**: Serviced under TEI with Flash Attention 2.0. Expected VRAM: **~435 MB to ~4.5 GB VRAM** depending on size (linear in model parameters, no KV cache).
- **Expected GPU Perf (RX 7900 XTX)**: Single query (512 tkn): **~1.0ms to ~10ms** | 8x8K batch: varies by model size (throughput 928–7517 pairs/sec on H100).
- **English & German Score**:
  - **MTEB(eng, v2) Retrieval NDCG@10** (6 models, smallest to largest):
    - 17M: 0.5576 | 32M: 0.5779 | 68M: 0.5915 | 150M: 0.5994 | 400M: 0.6091 | 1B: 0.6114
  - **NanoBEIR mean NDCG@10**: 17M: 0.6746 → 1B: 0.7237
- **Agentic Use**: State-of-the-art at every size class up to 1B. The 68M model (0.5915) already beats bge-reranker-v2-m3 (0.5526) at 1/8 the size. The 1B model matches the 1.54B teacher within 0.0001.
- **Max CTX**: 7,999 tokens (ModernBERT backbone).
- **Output Types**: Relevance score logit (single-class classifier head via `ModernBertModel` + `id2label`/`classifier_pooling` in config).
- **Other features**: All Apache 2.0 license, Flash Attention 2.0 optimized, pointwise MSE distillation, 2.3× faster than peer ModernBERT rerankers at same parameter count.
- **Fits expected hindsight usage of embedding**: Excellent. Best price/performance ratio in open-source reranking: 68M model matches Qwen3-Reranker-0.6B quality with 1/9 the parameters. Requires TEI detection patch for `ModernBertModel` architecture (applied via `tei-rocm/jina-reranker-v3.patch`).
- **TEI Support & Native**: **Yes (patched)** — requires `ModernBertModel` + `id2label` detection added to TEI router and Python backend. Supported via Candle `flash_modernbert.rs` classification head. Without the patch, TEI treats `ModernBertModel` as an embedding architecture and fails to load the classifier head.
- **Retrieval Benchmarks / MTEB Score**: See above for per-model NDCG@10. Family beats all MiniLM, BGE, and gte-reranker variants in respective size classes.

---

### Embedding & Reranking Model Architectures: Attention, KV Cache & VRAM Scaling

The models listed above span seven distinct architecture × backend combinations. Understanding their attention mechanisms and TEI backend is critical for sizing VRAM, tuning parallelism, and choosing between `llama-server` (GGUF) and TEI serving.

#### Architecture Comparison

| Architecture | Task | TEI Backend | Attention Mask | Input → Output | Pooling / Head | KV Cache | VRAM Scaling | Example Models |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **Causal Decoder (llama-server)** | Embedding | N/A (GGUF) | Causal (triangular) | Single text → dense vector | Last-token (`[EOS]`) | **Required** (pre-allocated per slot) | Weights + KV cache (linear in slots × ctx) | Qwen3-Embedding GGUF, F2LLM |
| **Causal Decoder (TEI)** | Embedding | Python (PyTorch) | Causal (triangular) | Single text → dense vector | Last-token (`[EOS]`) | **Not used** (single forward pass) | Weights + $O(N^2)$ activations | gte-Qwen2-1.5B, jina-v5-small |
| **Bidirectional Encoder (TEI Candle)** | Embedding | Candle (Rust) | Full (bidirectional) | Single text → dense vector | Mean pooling / `[CLS]` | **Not used** (incompatible) | Weights + $O(N^2)$ activations | bge-m3, jina-v3, gte-multilingual-base, snowflake-arctic |
| **Bidirectional Encoder (TEI Python)** | Embedding | Python (PyTorch) | Full (bidirectional) | Single text → dense vector | Mean pooling | **Not used** (incompatible) | Weights + $O(N^2)$ activations | pplx-embed-context |
| **Bidirectional Cross-Encoder (TEI Candle)** | Reranking | Candle (Rust) | Full (bidirectional) | Query–document pair → score | `[CLS]` → classifier head | **Not used** (incompatible) | Weights + $O(N^2)$ activations | bge-reranker-v2-m3, jina-reranker-v2, gte-multilingual-reranker-base |
| **ModernBERT Cross-Encoder (TEI Candle)** | Reranking | Candle (Rust) | Full (bidirectional, alternating global/sliding) | Query–document pair → score | Mean pooling → classifier head | **Not used** (incompatible) | Weights + $O(N^2)$ activations | gte-reranker-modernbert-base, granite-embedding-reranker-english-r2, ettin-reranker-* |
| **Causal Cross-Encoder (TEI Python)** | Reranking | Python (PyTorch) | Causal (triangular) | Query + N docs → N scores | Last-token → MLP projector | **Not used** (single forward pass) | Weights + $O(N^2)$ activations | jina-reranker-v3 |

> **Candle vs Python backend**: The Candle (Rust) backend compiles attention kernels natively and handles standard BERT/XLM-RoBERTa architectures. The Python (PyTorch) backend spawns a gRPC subprocess using `sentence-transformers` and is required for models with custom architectures (Qwen2/Qwen3 backbones, `trust_remote_code=True`). On ROCm, the Python backend uses `python-pytorch-opt-rocm` with native HIP kernels for RDNA3 GPU acceleration.

#### Why No KV Cache for Embedding / Reranking Inference?

**KV cache** is an optimization for *autoregressive text generation*, where the model generates tokens one-at-a-time and caches the Key/Value tensors of all previous tokens to avoid recomputing them at each step. For embedding and reranking tasks, the model processes the **entire input sequence in a single forward pass** — there are no iterative decoding steps, so there is nothing to cache.

- **Causal decoders under `llama-server`**: The server is designed for generation and *always* pre-allocates a KV cache per parallel slot. Even when used purely for embeddings, each slot consumes KV cache memory (e.g., ~112–224 MB per 8K-context slot for a 0.6B model). This is wasted memory but architecturally unavoidable in `llama-server`.
- **Causal decoders / cross-encoders under TEI (Python)**: TEI's Python/PyTorch backend runs the model in pure forward-pass mode. No KV cache is allocated. VRAM scales with model weights plus the transient attention activation tensors. This applies equally to causal embedding models (gte-Qwen2, jina-v5) and the causal cross-encoder reranker (jina-reranker-v3 with LBNL architecture).
- **Bidirectional encoders / cross-encoders (Candle and Python)**: KV caching is **fundamentally impossible** because every token attends to every other token — there is no sequential "prefix" whose K/V states remain stable. The full $O(N^2)$ attention matrix is always computed. This applies to Candle-served models (bge-m3, bge-reranker-v2-m3) and Python-served models (pplx-embed-context) alike.

#### VRAM Scaling: Attention Activations vs. Context Length

For all TEI serving modes (Candle and Python, causal and bidirectional), the dominant variable VRAM cost is the **attention activation memory**, which scales quadratically with sequence length:

$$\text{Attention VRAM per request} \approx \frac{N^2 \times H \times 2}{1024^2} \text{ MB}$$

where $N$ is the sequence length in tokens, $H$ is the number of attention heads, and the factor of 2 accounts for the Q×K and softmax×V matrices in float16/bfloat16.

Practical estimates for a **0.6B parameter model** (16 heads, bf16 activations, Flash Attention enabled), default **4 parallel requests @ 8K context**:

| Context Length | Per Request | 4 Parallel (default) | 8 Parallel |
|:---|:---|:---|:---|
| **512 tokens** | ~8 MB | ~32 MB | ~64 MB |
| **2K tokens** | ~128 MB | ~512 MB | ~1.0 GB |
| **8K tokens** | ~256 MB | **~1.0 GB** | ~2.0 GB |
| **32K tokens** | ~4.0 GB | ~16.0 GB | ~32.0 GB ⚠️ OOM |

> **Note**: Flash Attention reduces *peak* memory from $O(N^2)$ to $O(N)$ by tiling the computation, but the *compute* cost remains $O(N^2)$. The values above represent effective observed VRAM under Flash Attention. Without Flash Attention, memory would be significantly higher.

#### Practical Implications for Local Serving (RX 7900 XTX, 24 GB VRAM)

Given 24 GB total VRAM, and ~1.2 GB consumed by model weights + ~0.4 GB CUDA overhead:

- **Default budget (4 × 8K)**: ~1.0 GB activation — well within the ~22.4 GB available
- **32K context**: **1 parallel** (~4.0 GB) fits comfortably; **2 parallel** (~8.0 GB) is feasible; **4 parallel** (~16.0 GB) is tight; **8 parallel** exceeds VRAM
- **Mixed workloads** (e.g., 3×8K + 1×32K): ~0.8 + 4.0 GB = ~4.8 GB activations — fits with headroom

These constraints directly informed the hindsight benchmark tuning: the parallel request pattern was set to 3 rounds of 4 parallel × 8K requests (32K tokens per round, 98K total tokens) to stay within safe VRAM limits for the 0.6B model under TEI.

#### Quantization: Weights vs. Activations vs. Embedding Output

There are three distinct levels of quantization relevant to embedding/reranking inference. They target different memory consumers and have different support levels in TEI:

| Quantization Type | What It Reduces | TEI Support | Effect on $O(N^2)$ Activation Memory |
|:---|:---|:---|:---|
| **Weight quantization** | Model parameter storage (static) | Candle: GGUF-based quantized models. Python: `--dtype float16` (default bf16/fp16). No INT8 weight-only flag. | **None** — weights are a fixed cost, activations are computed at runtime precision |
| **Activation quantization** | Intermediate attention tensors (dynamic, $O(N^2)$) | **Not supported** — neither Candle nor Python backend expose INT8/FP8 activation compute paths | **Would halve** $O(N^2)$ memory if available (INT8 = half of fp16) |
| **Embedding output quantization** | Output vector storage (post-processing) | Models like pplx-embed natively output INT8/binary embeddings; `sentence-transformers` can quantize any output | **None** — post-forward-pass only, does not affect inference VRAM |

**Key findings:**

- **All TEI-served architectures compute activations in float16 or bfloat16.** There is no CLI flag or backend option to run attention in INT8 or FP8 precision. The `--dtype` flag only controls weight loading precision (`float16` vs `float32`), not the compute dtype of the attention matrix.
- **INT8 activation quantization** (computing Q×K and softmax×V in INT8) would theoretically halve the $O(N^2)$ attention memory cost. Specialized implementations exist (e.g., INT-FlashAttention for NVIDIA Ampere), but they are not integrated into TEI's Candle or Python backends.
- **FP8 activation quantization** (via FlashAttention-3) exists for NVIDIA Hopper/Ada hardware but is **not available on RDNA3** — the RX 7900 XTX (`gfx1100`) lacks native FP8 tensor core support.
- **RDNA3 INT8 status**: The hardware has basic INT8 dot-product instructions (`v_dot4_i32_iu8`) but no dedicated INT8 tensor cores. ROCm's Flash Attention implementation (via Composable Kernel) does not currently offer an INT8 compute path.

> **Bottom line**: On the current RX 7900 XTX + TEI stack, all architectures are locked to **bf16/fp16 activations**. The $O(N^2)$ attention memory cost cannot be reduced via precision — the only levers are parallelism (fewer concurrent requests), context length (shorter sequences), or Flash Attention (which reduces peak memory from $O(N^2)$ to $O(N)$ via tiling, already enabled by default).

---

### TEI Backends & Expected Performance on Host GPU (AMD Radeon RX 7900 XTX)

The local TEI deployment is built via the custom package **`tei-rocm`**, which compiles the Hugging Face `text-embeddings-inference` router with specific features:
1. **Candle Backend (Rust native)**: Used for standard bidirectional encoder models (e.g. BERT/XLM-RoBERTa). While Candle runs natively in Rust, in this build configuration it operates primarily on the CPU or falls back to ROCm compatibility layers when compiled with specific GPU flags.
2. **Python Backend (PyTorch / sentence-transformers)**: Spawns an optimized Python gRPC server subprocess. Because `tei-rocm` lists `python-pytorch-opt-rocm` as a dependency (which is compiled with native AMD ROCm/HIP optimizations for RDNA3 hardware), this backend leverages the host GPU directly.

#### GPU Hardware Profile (AMD Radeon RX 7900 XTX)
- **Architecture**: Navi 31 (`gfx1100`), 96 Compute Units.
- **Compute Capability**: ~123 TFLOPS FP16/BF16.
- **Memory Subsystem**: 24 GB GDDR6 VRAM, 384-bit memory bus width, **960 GB/s bandwidth** (extremely fast weight-loading).

#### Expected Performance & Throughput under ROCm PyTorch Backend
With PyTorch's native ROCm kernels (including SDPA / Flash Attention) enabled, the expected inference latency and token throughput for RAG workloads on the RX 7900 XTX are:

*   **Standard Embeddings (e.g. `bge-m3` or `jina-embeddings-v3` - ~500M to 700M parameters)**:
    *   *Short Context (512 tokens, Batch Size 1)*: Latency is **~2.5ms to 4.0ms**.
    *   *Ingestion Batch (e.g., 8 parallel requests @ 8K context length = 65,536 tokens)*: Total batch forward pass latency is **~180ms to 240ms** (yielding a processing throughput of **~270,000 to 360,000 tokens/second**).
*   **Causal/Decoder Embeddings (e.g. `gte-Qwen2-1.5B-instruct` - 1.5B parameters)**:
    *   *Short Context (512 tokens, Batch Size 1)*: Latency is **~8.0ms to 12.0ms**.
    *   *Heavy Batch (8 parallel requests @ 8K context length = 65,536 tokens)*: Total batch forward pass latency is **~380ms to 480ms** (throughput of **~135,000 to 170,000 tokens/second**).
*   **Listwise Rerankers (e.g. `jina-reranker-v3` - 600M parameters)**:
    *   *Heavy Evaluation Load (8 parallel requests @ 32K context length = 262,144 tokens)*: Total batch evaluation pass latency is **~500ms to 700ms** (throughput of **~370,000 to 520,000 tokens/second** due to length-sorted bucket batching and Flash Attention scaling).


## ONNX Models & Hugging Face Repositories

Below is the verified sitemap of ready-to-download ONNX variants for all models listed in `local-download.sh` and `model-research.md`.

### Embedding ONNX Models

| Model | Hugging Face Repo / Path | Available Weight Formats | Verified Usage |
| :--- | :--- | :--- | :--- |
| **Qwen3-Embedding-0.6B** | `onnx-community/Qwen3-Embedding-0.6B-ONNX`<br>`shawnw3i/Qwen3-Embedding-0.6B-ONNX` | `model.onnx` (FP32), `model_fp16.onnx`, `model_int8.onnx`, `model_q4.onnx` | Active community ONNX export for Transformers.js / ONNX Runtime. |
| **pplx-embed-context-v1-0.6b** | `onnx-community/pplx-embed-context-v1-0.6b-ONNX` | `model.onnx`, `model_fp16.onnx`, `model_int8.onnx` | Transformers.js & ONNX Runtime bidirectional Qwen3 encoder. |
| **bge-m3** | `Xenova/bge-m3`<br>`aapot/bge-m3-onnx`<br>`philipchung/bge-m3-onnx` | `model.onnx`, `model_fp16.onnx`, `model_int8.onnx`, `model_q4.onnx` | Dense, Sparse, and ColBERT multi-vector outputs in single ONNX graph. |
| **gte-multilingual-base** | `onnx-community/gte-multilingual-base`<br>`Teradata/gte-multilingual-base` | `model.onnx`, `model_fp16.onnx`, `model_int8.onnx` | Standard XLM-RoBERTa ONNX graph. |
| **snowflake-arctic-embed-l-v2.0** | `onnx-community/snowflake-arctic-embed-l-v2.0`<br>`Snowflake/snowflake-arctic-embed-m-v2.0` | `model.onnx`, `model_fp16.onnx`, `model_int8.onnx` | Official Snowflake ONNX weights. |
| **jina-embeddings-v3** | `ldwformat/jina-embeddings-v3-Q8-onnx`<br>`jinaai/xlm-roberta-flash-implementation-onnx` | `model_int8.onnx`, `model.onnx` | XLM-RoBERTa base with baked RoPE positional encodings. |
| **gte-Qwen2-1.5B-instruct** | `onnx-community/gte-Qwen2-1.5B-instruct-ONNX` | `model.onnx`, `model_fp16.onnx`, `model_int8.onnx` | Qwen2 causal decoder ONNX export. |
| **F2LLM-v2-0.6B** | Exportable via `optimum-cli export onnx` | `model.onnx`, `model_fp16.onnx` | Standard Qwen3 decoder ONNX target. |

### Reranker ONNX Models

| Model | Hugging Face Repo / Path | Available Weight Formats | Verified Usage |
| :--- | :--- | :--- | :--- |
| **Qwen3-Reranker-0.6B** | `onnx-community/Qwen3-Reranker-0.6B-ONNX`<br>`shawnw3i/Qwen3-Reranker-0.6B-ONNX`<br>`thomasht86/Qwen3-Reranker-0.6B-int8-ONNX` | `model.onnx`, `model_fp16.onnx`, `model_int8.onnx`, `model_q4.onnx` | **Directly supported** by EmbedAnything `reranker/qwen3.rs` ONNX logit scoring. |
| **ettin-reranker-400m-v1** | `cross-encoder/ettin-reranker-400m-v1` | Official repo includes `onnx/model.onnx`, `onnx/model_fp16.onnx` | Native ModernBERT cross-encoder ONNX weights in official HF repo. |
| **ettin-reranker-150m-v1** | `cross-encoder/ettin-reranker-150m-v1` | Official repo includes `onnx/model.onnx`, `onnx/model_fp16.onnx` | Lightweight ModernBERT cross-encoder ONNX weights. |
| **bge-reranker-v2-m3** | `onnx-community/bge-reranker-v2-m3-ONNX`<br>`Sophia-AI/bge-reranker-v2-m3-onnx` | `model.onnx`, `model_fp16.onnx`, `model_int8.onnx` | Cross-encoder ONNX sequence classification. |
| **jina-reranker-v2-base-multilingual** | `jinaai/jina-reranker-v2-base-multilingual`<br>`onnx-community/jina-reranker-v2-base-multilingual-ONNX` | Official repo includes `model.onnx`, `model_fp16.onnx` | Official Jina ONNX weights. |
| **jina-reranker-v3 / v3.5** | `s-lorin/jina-reranker-v3-onnx` | `model.onnx` | ONNX export for Jina v3 LBNL cross-attention. |
| **mxbai-rerank-base-v2** | `onnx-community/mxbai-rerank-base-v2-ONNX` | `model.onnx`, `model_fp16.onnx`, `model_int8.onnx` | Qwen2-0.5B causal cross-encoder ONNX. |
| **LAMAR-600m** | Exportable via `optimum-cli export onnx` | `model.onnx`, `model_fp16.onnx` | XLM-RoBERTa cross-encoder ONNX target. |
| **KaLM-Reranker-V1-Nano** | Exportable via `optimum-cli export onnx` | `model.onnx`, `model_fp16.onnx` | T5Gemma2 cross-encoder ONNX target. |

### Speech-to-Text (STT) ONNX Models

| Model | Hugging Face Repo / Path | Available Weight Formats | Verified Usage |
| :--- | :--- | :--- | :--- |
| **whisper-large-v3-turbo** | `onnx-community/whisper-large-v3-turbo-ONNX`<br>`k2-fsa/sherpa-onnx-whisper-large-v3-turbo` | `encoder_model.onnx`, `decoder_model.onnx`, `decoder_model_merged.onnx`, `encoder_model_quantized.onnx`, `decoder_model_quantized.onnx` | Production ONNX usage in Sherpa-ONNX, Transformers.js, ONNX Runtime GenAI. |

### Text-to-Speech (TTS) ONNX Models

| Model | Hugging Face Repo / Path | Available Weight Formats | Verified Usage |
| :--- | :--- | :--- | :--- |
| **Kokoro-82M** | `onnx-community/Kokoro-82M-ONNX`<br>`hexgrad/Kokoro-82M` | `model.onnx`, `voices.json` | High-quality, fast ONNX TTS engine used by Sherpa-ONNX & Kokoro-FastAPI. |
| **Qwen3-TTS-0.6B** | `onnx-community/Qwen3-TTS-0.6B-ONNX` (or custom `optimum-cli`) | `model.onnx`, `tokenizer.onnx` | ONNX export for Qwen3-TTS decoder. |

#### Kokoro, Kikiri German Voice Models

-  https://huggingface.co/Godelaune/Kokoro-82M-ONNX-German-Martin
-  https://huggingface.co/kikiri-tts/kikiri-german-victoria
-  https://huggingface.co/kikiri-tts/kikiri-german-martin
-  https://huggingface.co/Godelaune/Kokoro-82M-ONNX-German-Martin
-  https://huggingface.co/cryptomilk/kokoro-german-kerstin

---

## High-Performance Local ONNX Serving Applications

To serve ONNX models locally with ROCm / ONNX Runtime (`ort`) acceleration as replacements for current services (`llama-server`, `tei`, `whisper.cpp`), the top applications, performance profiles, memory usage, and API compatibility are detailed below:

### 1. Embedding & Reranker Serving Engines

#### A. Infinity (`michaelfeil/infinity`) — **Recommended Full Replacement**
- **Architecture**: High-throughput inference server written in Rust + PyTorch / ONNX Runtime (`ort`).
- **API Compatibility**:
  - **OpenAI API**: Fully compatible `/v1/embeddings`
  - **TEI API**: Fully compatible `/predict` and `/rerank`
- **ONNX & ROCm Acceleration**: Native ONNX Runtime backend (`ort`) with support for `ROCmExecutionProvider` and PyTorch ROCm.
- **Features**: Dynamic batching, multi-threaded tokenization, length-sorted bucket batching, vector pooling (mean/cls/last-token), cross-encoder reranking.
- **Memory & Performance (RX 7900 XTX)**:
  - **VRAM**: ~0.6 GB – 1.5 GB for FP16/INT8 ONNX models (no KV cache allocation penalty).
  - **Latency**: Single query (512 tkn): ~2.0ms – 3.5ms.
  - **Throughput**: 8x8K batch: **~300,000+ tokens/second**.

#### B. EmbedAnything Server (`starlightsearch/embedanything-server`)
- **Architecture**: Lightweight standalone Rust HTTP server built with Axum, `embed_anything`, and `ort` (ONNX Runtime).
- **API Compatibility**: Custom REST endpoints (`/embed`, `/rerank`).
- **ONNX & ROCm Acceleration**: Uses `ort` crate. Requires patching `SessionBuilder` to select `ROCmExecutionProvider`.
- **Memory & Performance**: Base memory footprint **< 200 MB RAM/VRAM** (minimalist Rust binary). Excellent for embedded or low-resource sidecars.

#### C. FastEmbed (`qdrant/fastembed`)
- **Architecture**: Qdrant's Rust/Python ONNX embedding engine.
- **API Compatibility**: Embedded Python/Rust library or lightweight FastAPI server (`/embed`, `/rerank`).
- **ONNX & ROCm Acceleration**: Uses `onnxruntime` with `CUDAExecutionProvider` or custom execution providers. Focuses heavily on dynamic INT8 quantization.

---

### 2. Speech-to-Text (STT) Serving Engines

#### Sherpa-ONNX (`k2-fsa/sherpa-onnx`) — **Recommended STT Replacement**
- **Architecture**: High-performance C++/Rust/Go speech processing server powered by ONNX Runtime (`ort`).
- **API Compatibility**:
  - **OpenAI Speech-to-Text API**: Compatible `/v1/audio/transcriptions`
  - **WebSocket / gRPC**: Real-time audio streaming
- **ONNX & ROCm Acceleration**: Native `whisper-large-v3-turbo-ONNX` support with ROCm / CUDA execution providers and Silero VAD (Voice Activity Detection).
- **Memory & Performance (RX 7900 XTX)**:
  - **VRAM**: **~1.1 GB VRAM** (FP16 ONNX Whisper-Large-v3-turbo).
  - **Latency**: Real-time Factor (RTF) **< 0.02** (50× faster than real-time audio playback).

---

### 3. Text-to-Speech (TTS) Serving Engines

#### Sherpa-ONNX (TTS Server) / Kokoro-ONNX FastAPI — **Recommended TTS Replacement**
- **Architecture**: C++/Python ONNX speech synthesis server serving Kokoro-82M-ONNX or Piper ONNX models.
- **API Compatibility**:
  - **OpenAI Text-to-Speech API**: Compatible `/v1/audio/speech`
- **ONNX Acceleration**: Direct ONNX graph execution.
- **Memory & Performance**:
  - **VRAM**: **~200 MB VRAM**.
  - **Latency**: Real-Time Factor (RTF) **< 0.03** (30× faster than real-time synthesis).
