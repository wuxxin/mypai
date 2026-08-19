---
description: Forward a question, strategic decision, or user confirmation request to the central mypai-main.
---

Escalate the following strategic question or user confirmation request to `mypai-main`: "$*"

Execute in Python:
```python
from mypai_runtime import amux

amux.send_message(
    target_worker="mypai-main",
    body="STRATEGIC_ESCALATION: $*"
)
```
Inform the user that the request has been routed to the primary MyPAI main brain.
