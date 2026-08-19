---
description: Distill session insights, decisions, and patterns into Hindsight memory.
---

Extract and persist key facts, project conventions, and decisions from the current session into the active Hindsight memory bank:

```python
from mypai_eval_runtime import hindsight

# Persist learnings
# hindsight.retain(items=[{"content": "...", "context": "..."}], bank_id="oh-my-pi")
```
Report the retained facts concisely upon completion.
