# Hindsight Memory Bank Configuration Reference (`hindsight-memorybank.md`)

This document is the exhaustive parameter reference for Hindsight memory bank configuration files (`.yaml` / `.json`), covering every configurable field recognized by the Hindsight REST API and engine.

---

## 1. Document Structure Overview

A memory bank definition file contains three primary sections:
1. `version`: Manifest schema version (currently `'1'`).
2. `bank`: Core behavioral configurations, missions, dispositions, and retrieval settings.
3. `mental_models`: Persisted, auto-synthesized topical summaries injected into prompts.
4. `directives`: (Optional) Hard behavioral instructions enforced during reflection.

```yaml
version: '1'
bank:
  # Dispositions, missions, retention, observations, reflect, recall
mental_models:
  # List of mental model definitions
directives:
  # List of hard directive rules
```

---

## 2. Bank Configuration Parameters (`bank:`)

### A. Dispositions (LLM Persona & Extraction Bias)

| Parameter | Type | Default | Allowed Values | Description |
| :--- | :--- | :--- | :--- | :--- |
| `disposition_skepticism` | integer | `3` | `1` to `5` | Controls skepticism during fact extraction. Higher values aggressively filter unverified claims and fleeting thoughts. |
| `disposition_literalism` | integer | `3` | `1` to `5` | Controls literal fidelity during extraction. Higher values preserve verbatim phrasing and exact technical values rather than paraphrasing. |
| `disposition_empathy` | integer | `4` | `1` to `5` | Controls empathy weight for extracting emotional context, personal motivations, and subjective user intent. |

---

### B. Retain & Fact Extraction Settings

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `retain_extraction_mode` | enum | `"concise"` | Extraction strategy: `"concise"` (selective, high-signal facts), `"verbose"` (dense facts with emotional/contextual nuances), `"custom"` (uses `retain_custom_instructions`), `"verbatim"` (preserves raw chunk as fact text), or `"chunks"` (raw text chunking only). |
| `retain_chunk_size` | integer | `3000` | Target character length per chunk for fact extraction. |
| `retain_chunk_batch_size` | integer | `100` | Maximum number of chunks processed per streaming extraction batch. |
| `retain_structured_chunk_size` | integer | `3000` | Maximum character length to keep a single JSONL line or conversation turn unbroken before splitting. |
| `retain_mission` | text | *See Fallbacks* | Custom system prompt guiding the LLM on what information to extract during `/retain` passes. Injected into any extraction mode. |
| `retain_custom_instructions` | text | *See Fallbacks* | Detailed extraction guidelines used only when `retain_extraction_mode: custom`. |
| `retain_default_strategy` | string | `null` | Name of the default retain strategy to use if none specified in request. |
| `retain_strategies` | map | `{}` | Named dictionary of retain strategy overrides (e.g. specialized extraction rules per document type). |
| `store_document_text` | boolean | `true` | When `true`, persists original document and turn text in the database alongside extracted facts. |

---

### C. Entities & Vocabulary Controls

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `entity_labels` | map | `{}` | Controlled vocabulary schema mapping entity categories and allowed label types. |
| `entities_allow_free_form` | boolean | `true` | When `true`, allows the LLM to extract entity types not explicitly listed in `entity_labels`. |
| `memory_defense` | map | `{"enabled": false}` | Security and guardrail policy against prompt injection and adversarial memory contamination. |

---

### D. Observations & Background Consolidation

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enable_observations` | boolean | `true` | Enables temporal observation tracking and synthesis over time. |
| `enable_auto_consolidation` | boolean | `true` | Automatically triggers background memory consolidation after a retain pass. |
| `observations_mission` | text | *See Fallbacks* | Declarative mission prompt defining what trends, habits, and recurring patterns the consolidator should track. |
| `consolidation_max_memories_per_round` | integer | `20` | Maximum unconsolidated memories processed in a single consolidation round (prevents worker slot starvation). |
| `consolidation_llm_batch_size` | integer | `1` | Number of facts presented per consolidation LLM call. |
| `consolidation_llm_parallelism` | integer | `4` | Maximum number of independent tag groups consolidated concurrently. |
| `consolidation_source_facts_max_tokens` | integer | `4096` | Total token budget for source facts pulled into a consolidation pass (`-1` = unlimited). |
| `consolidation_source_facts_max_tokens_per_observation`| integer | `256` | Token budget of source facts per observation in consolidation prompts (`-1` = unlimited). |
| `max_observations_per_scope` | integer | `-1` | Cap on the number of active observations per tag scope (`-1` = unlimited). |
| `observation_scope_limits` | list | `[]` | List of rule objects `{"scope": [globs], "limit": int}` overriding capacity per scope pattern. |

---

### E. Reflection Settings (`/reflect`)

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `reflect_mission` | text | *See Fallbacks* | System prompt and role definition used by the agent during reflection queries (`/reflect`). |
| `reflect_source_facts_max_tokens` | integer | `-1` | Token budget for raw source facts included during reflection search (`-1` = disabled/unlimited). |

---

### F. Recall & Retrieval Settings (`/recall`)

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enable_temporal_retrieval` | boolean | `true` | Enables time-based retrieval scoring and recency decay. |
| `enable_graph_retrieval` | boolean | `true` | Enables entity link expansion across related memory graph nodes. |
| `enable_reranking` | boolean | `true` | Enables cross-encoder / remote reranking of hybrid vector + BM25 candidates. |
| `recall_include_chunks` | boolean | `false` | When `true`, returns raw source text chunks alongside extracted facts during recall. |
| `recall_max_tokens` | integer | `1536` | Server-side token budget limit for vector recall passes. |
| `recall_chunks_max_tokens` | integer | `500` | Server-side token budget limit for raw chunk retrieval. |
| `recall_budget_function` | enum | `"fixed"` | Thinking budget calculation function: `"fixed"` (uses explicit values) or `"adaptive"` (scales with max tokens). |
| `recall_budget_fixed_low` | integer | `100` | Thinking budget tokens when recall budget is `"low"`. |
| `recall_budget_fixed_mid` | integer | `300` | Thinking budget tokens when recall budget is `"mid"`. |
| `recall_budget_fixed_high` | integer | `1000` | Thinking budget tokens when recall budget is `"high"`. |
| `recall_budget_adaptive_low` | float | `0.025` | Adaptive token fraction when budget is `"low"`. |
| `recall_budget_adaptive_mid` | float | `0.075` | Adaptive token fraction when budget is `"mid"`. |
| `recall_budget_adaptive_high` | float | `0.25` | Adaptive token fraction when budget is `"high"`. |
| `recall_budget_min` | integer | `20` | Minimum token clamp for adaptive recall budget. |
| `recall_budget_max` | integer | `2000` | Maximum token clamp for adaptive recall budget. |

---

### G. Audit & Integration Access Controls

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `audit_log_enabled` | boolean | `false` | Enables durable audit logging of bank queries and mutations. |
| `mcp_enabled_tools` | list | `null` | Allowlist of enabled MCP tool names (`null` enables all 24 built-in tools). |
| `llm_gemini_safety_settings` | list | `[]` | Custom Google Gemini / Vertex AI content filtering safety thresholds. |

---

## 3. In-Engine Fallback Missions (When Fields are Unset / Null)

When a bank file omits or sets mission prompts to `null`, Hindsight automatically applies these in-engine defaults:

```yaml
bank:
  retain_mission: >-
    Extract SIGNIFICANT facts from text. Be SELECTIVE - only extract facts worth remembering long-term.

  observations_mission: >-
    Track anything notable in the new facts — names, numbers, dates, places, events, decisions, claims, relationships, and recurring patterns.

  reflect_mission: >-
    You are a reflection agent that answers questions by reasoning over retrieved memories.
```

---

## 4. Mental Models Schema (`mental_models:`)

Mental models are continuously maintained, structured summaries synthesized by Hindsight and injected directly into the agent's prompt context.

| Field Name | Type | Allowed Values / Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | *(Required)* | Unique lowercase identifier (e.g. `user-preferences`, `project-conventions`). |
| `name` | `string` | *(Required)* | Human-readable title for the mental model section. |
| `source_query` | `string` | *(Required)* | The semantic question/query executed against vector memory to synthesize the model. |
| `max_tokens` | `integer` | `1024` (typical) | Token budget bounding the synthesized mental model response block. |
| `scopes` | `list` | `["global"]` or `["per-project-tagged"]` | **Scoping rule**. Controls in which OMP context this model is loaded. **Avoid listing multiple scopes on a single model to prevent duplicate prompt injection.** |
| `projectTagged` | `boolean` | `false` (global) / `true` (project) | When `true`, tags the mental model query with the active project tag (`project:<cwd>`). When `false`, queries untagged global memories. |
| `tags` | `list` | `[]` | Explicit tag filters applied during synthesis. Uses strict intersection matching (`all_strict`). |
| `trigger.mode` | `enum` | `"delta"` or `"full"` | `"delta"` (incremental patch update using structured diffs) or `"full"` (complete re-synthesis). |
| `trigger.refresh_after_consolidation` | `boolean` | `true` | Automatically triggers a re-synthesis pass when background consolidation finishes. |
| `trigger.cron` | `string` | `null` | Optional cron schedule for periodic re-synthesis (e.g. `"0 0 * * *"`). |
| `trigger.exclude_mental_models` | `boolean` | `false` | When `true`, excludes existing mental model blocks when generating this model's synthesis. |

---

## 5. Directives Schema (`directives:`)

Directives are hard rules that are injected with top-level priority into `/reflect` and mental model synthesis prompts.

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | Directive title (e.g. `"No Unverified Claims"`). |
| `content` | `string` | Exact rule description (e.g. `"Never assume file paths exist without checking."`). |
| `priority` | `integer` | Priority weighting (higher integers take precedence). |
| `tags` | `list` | Optional tag scoping for the directive. |
