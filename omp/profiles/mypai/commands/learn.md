---
description: Distill key turn learnings, facts, and architectural decisions into Hindsight memory.
---

Please extract and persist the core facts, user preferences, and architectural decisions from the recent turns into the active Hindsight memory bank.

Execute via in-kernel Python:
```python
from mypai_eval_runtime import hindsight

# Extract and retain learnings
# hindsight.retain(items=[{"content": "...", "context": "..."}], bank_id="mypai")
```
Report the retained insights concisely upon completion.
