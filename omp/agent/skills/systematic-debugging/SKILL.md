---
name: systematic-debugging
description: 4-phase evidence-based debugging procedure (Reproduce -> Isolate -> Hypothesize -> Fix & Verify) to eliminate guesswork.
---

# Systematic Debugging Skill (`systematic-debugging`)

Use this skill whenever investigating test failures, bug reports, performance bottlenecks, or unexpected runtime exceptions.

---

## 4-Phase Debugging Workflow

### Phase 1: Reproduce
1. **Never guess or make speculative code edits.**
2. Write a minimal reproduction script or unit test that reliably triggers the failure.
3. Run the reproduction test and confirm the failure mode matches the reported defect.

### Phase 2: Isolate
1. Use DAP (Debug Adapter Protocol), live process debugging, or structured debug logging to trace variable states along the call stack.
2. Narrow down the failure to the exact function, line number, or state transition boundary.

### Phase 3: Hypothesize
1. Formulate a single, falsifiable hypothesis explaining the defect mechanism.
2. Validate the hypothesis by inspecting code logic, preconditions, and invariant violations.

### Phase 4: Fix, Verify & Retain
1. Apply the minimal targeted fix addressing the root cause.
2. Verify that the reproduction test passes cleanly.
3. Run the entire project test suite to guard against regressions.
4. Distill the defect pattern into Hindsight memory (`tool.retain()`) so the anti-criteria prevents recurrence.
