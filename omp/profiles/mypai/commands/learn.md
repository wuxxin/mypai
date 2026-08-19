---
description: Distill key turn learnings, facts, and architectural decisions into Hindsight memory.
---

Please extract and persist the core facts, user preferences, and architectural decisions from the recent turns into the active Hindsight memory bank.

Execute via in-kernel Python:
```python
# Use in-process OMP loopback tool on session default bank (mypai)
tool.retain(items=[{"content": "...", "context": "..."}])
```
Report the retained insights concisely upon completion.

