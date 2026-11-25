# TODO & Research Backlog

## Voice / Audio
- Use Parakeet with Phonon multilingual.

## Candidate Models & Chat Templates
- https://huggingface.co/froggeric/Qwen-Fixed-Chat-Templates
- https://huggingface.co/peculiar-ragdoll/Qwen-Sharp-Chat-Templates
- https://huggingface.co/zgcagi/ZGCM-1-7B
- https://huggingface.co/Edge0/Edge0-35B-A3B-preview (https://github.com/Edge0-AI/edge0#documentation)
- https://huggingface.co/ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF
- https://huggingface.co/TokenRhythm/NeoHorse-1-4B
- https://huggingface.co/google/timesfm-3.0-pytorch
- https://huggingface.co/agentionai/Signal-3.8-27B-GGUF
- https://huggingface.co/rumik-ai/rumik-oss-1
- https://huggingface.co/tencent/AuK-Flash
- https://huggingface.co/huawei-bayerlab/marigold-v2-0
- https://huggingface.co/DavidAU/Qwen3.8-27B-TWIN-TURBO-Fable-Cold-Fusion-709-L-Uncensored-NM-DAU-NEO-MTP-GGUF

## MCP Servers & Skills to Evaluate
- Replace `fig` with `figcraft` (AUR: `figcraft-git`, `figcraft-cli`, MCP)
- Replace NotebookLM audio podcasts: https://github.com/kesslerio/podcastfy-generator-skill / https://github.com/souzatharsis/podcastfy
- Slim deep-research replacement: https://github.com/kesslerio/academic-deep-research-skill
- Finance MCP: https://github.com/JerBouma/FinanceToolkit
- Tech news skill: https://github.com/kesslerio/technews-skill
- Clean-room design MCP: https://github.com/storytold/craft-anything
- https://github.com/thenameisdevair/timesfm3-mcp
- https://github.com/nihalxkumar/arch-mcp
- https://github.com/ourongxing/newsnow
- https://github.com/slettmayer/geosphere-mcp-server
- https://github.com/xberg-io/xberg
- https://github.com/lucasjinreal/Crane
- https://github.com/memvid/memvid

## Agent Frameworks & Tooling to Look Into
- https://github.com/RUC-NLPIR/DeepAgent
- https://github.com/google/mantis/
- https://github.com/simonucl/PolySkill
- https://github.com/itigges22/ATLAS
- https://github.com/router-for-me/CLIProxyAPI
- https://github.com/Arize-ai/phoenix
- https://github.com/davidwynter/HiVA
- https://github.com/garrytan/gbrain
- https://github.com/mvanhorn/last30days-skill
- `printing-press-library` skills: `amazon-orders`, `archive-is`, `booking-com`, `domain-goat`, `trendhunter`, `wikipedia`

## Documentation / MkDocs → Zensical Migration
- **Material for MkDocs EOL:** May 5, 2027. Maintained successor: **Zensical** (https://zensical.org/docs/compatibility/mkdocs/migration/).
- **Status (tested `zensical 0.1.3`):** Builds `mkdocs.yml` cleanly in strict mode (`0.21s`, 0 warnings); Mermaid, search, and `docs/stylesheets/extra.css` (hidden right TOC + `90rem` `.md-grid`) all work out of the box.
- **Why staying on MkDocs Material for now:** Zensical `0.1.3`'s built-in `include-markdown` adapter translates tags to `pymdownx.snippets` and ignores `rewrite-relative-urls`, leaving `docs/...` links inside `../README.md` (included by `docs/index.md`) as `href="docs/..."` (404 on the generated homepage). Revisit once Zensical supports relative URL rewriting or if `docs/index.md` is decoupled from `README.md`.

## Plugin Marketplace Notes
```text
/plugin marketplace add anthropics/claude-plugins-official
/plugin marketplace add cathrynlavery/diagram-design
/plugin install diagram-design@diagram-design
```
