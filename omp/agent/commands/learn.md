---
description: Distill session insights, decisions, and patterns into Hindsight memory.
---

Extract and persist key facts, project conventions, and decisions from the current session into the active Hindsight memory bank:

```python
# Use in-process OMP loopback tool on session default bank
tool.retain(items=[{"content": "...", "context": "..."}])
```
Report the retained facts concisely upon completion.

