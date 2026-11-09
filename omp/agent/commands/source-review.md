---
description: Perform a multi-perspective code review with the @reviewer specialist.
---

Spawn `@reviewer` to audit recent changes against the target branch or uncommitted diff: "$*"

Audit requirements:
1. Categorize all findings using P0 (Critical) to P3 (Nit) severity levels.
2. Check cross-boundary event/message dispatch consistency.
3. Validate error handling, typing, and test coverage.
