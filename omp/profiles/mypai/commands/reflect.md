---
description: Query active Hindsight mental models for user preferences, worldview principles, and project context.
---

Query active mental models from Hindsight to ground the current discussion:

```python
# Use in-process OMP loopback tool on session default bank (mypai)
insights = tool.reflect(query="$*")
```
Summarize the reflected principles and context to guide our next actions.

