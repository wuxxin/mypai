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

### Phase 2: Isolate & Trace to Source
1. **Never fix just where the error manifests (symptom patching).** Trace backward through the call chain until you find the original trigger.
2. Use DAP (Debug Adapter Protocol), live process debugging, or structured debug logging (`console.error` / stderr) to trace variable states along the call stack.
3. Narrow down the failure to the exact function, line number, or state transition boundary where invalid data originated.

### Phase 3: Hypothesize
1. Formulate a single, falsifiable hypothesis explaining the defect mechanism.
2. Validate the hypothesis by inspecting code logic, preconditions, and invariant violations.

### Phase 4: Fix, Verify, Defend & Retain
1. **Fix at the Source:** Apply the minimal targeted fix addressing the root cause.
2. **Defense-in-Depth:** Add input assertions and type validation at intermediate layer boundaries so the invalid state is impossible.
3. **Condition-Based Waiting:** When testing asynchronous systems, never use arbitrary `sleep` timeouts; poll or await explicit state predicates.
4. **Verify & Regress Check:** Verify that the reproduction test passes cleanly, and run the entire project test suite (`make all`).
5. **Retain in Hindsight:** Distill the defect pattern into Hindsight memory (`tool.retain()`) so the anti-criteria prevents recurrence.

