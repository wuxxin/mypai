---
description: Forward a question, strategic decision, or user confirmation request to the central mypai-workspace.
---

Escalate the following strategic question or user confirmation request to `mypai-workspace`: "$*"

Execute in Python:
```python
from mypai_eval_runtime import amux

amux.send_message(
    target_worker="mypai-workspace",
    body="STRATEGIC_ESCALATION: $*"
)
```
Inform the user that the request has been routed to the primary MyPAI workspace brain.
