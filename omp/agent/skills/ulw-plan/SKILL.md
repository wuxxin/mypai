---
name: ulw-plan
description: High-rigor engineering planning methodology with testable Ideal State Criteria (ISC), gap analysis, and phased verification gates.
---

# Ultralight Planning Skill (`ulw-plan`)

Use this skill when preparing implementation plans for non-trivial coding tasks, refactors, or new features.

---

## Plan Structure & Methodology

Every plan generated using `ulw-plan` must follow this structure:

### 1. Goal Description & Background
- Concise explanation of the problem, architectural context, and expected user value.

### 2. Ideal State Criteria (ISC)
- **Concrete, testable assertions** that define when the task is complete.
- Every criterion must be verifiable by an automated command (e.g. `pytest tests/test_auth.py passes with 0 failures`, `ruff check passes`).

### 3. Gap Analysis & File Deltas
- Enumerate the delta between current repository state and the ISC:
  - `[NEW] path/to/file` — Rationale and responsibility.
  - `[MODIFY] path/to/file` — Specific lines, functions, or logic to change.
  - `[DELETE] path/to/file` — Deprecated code to remove.

### 4. Phased Implementation Gates
- Break down execution into atomic phases (Phase 1, Phase 2, ...).
- Each phase must conclude with an automated verification test before moving to the next.

### 5. Memory & Context Grounding Gate
- Ground the plan against conventions:
  - **Session Default Bank:** Use OMP loopback tools (`tool.reflect()`, `tool.recall()`) to query `project-conventions` and `project-decisions`.
  - **Cross-Bank / Non-Default Bank:** Use `mypai_runtime.hindsight` (`HindsightClient.reflect()`).

### 6. Review & Approval Gate
- Submit the plan for user approval before making file mutations.
- **OMP `xd://` Transport:**
  - Submit proposal: `write xd://propose` with plan slug and summary.
  - Review / apply diff previews: `write xd://resolve`.
  - Reject / discard staged edits: `write xd://reject`.

