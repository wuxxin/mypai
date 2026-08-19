---
name: test-driven-development
description: Red-Green-Refactor test cycle for robust feature implementation and regression protection.
---

# Test-Driven Development Skill (`test-driven-development`)

Use this skill when implementing new business logic, API endpoints, or core libraries.

---

## Red-Green-Refactor Cycle

1. **Red (Write Failing Test):**
   - **Name the Break:** State what production defect or missing capability makes this test fail.
   - **Independent Expectations:** Use hand-derived literals and fixtures. Never write mirror assertions where the test helpers compute expected values using the same logic as production code.
   - **No Change Detectors:** Test observable behavior and contract boundaries, not internal constants or private implementation details.
   - Run the test suite and confirm the test fails for the expected reason.

2. **Green (Minimal Implementation):**
   - Write the simplest code necessary to make the test pass.
   - Mock at the right level: mock only slow/external boundaries (`httpx.MockTransport`), never mock internal component logic.
   - Run the test suite and confirm it turns green.

3. **Refactor (Clean & Optimize):**
   - Refactor for readability, type safety (`mypy --strict`), and performance.
   - **The Mutation Check:** Mentally mutate production code (e.g. wrong branch, missing validation, wrong constant) and ensure at least one test fails.
   - Run the full test suite (`make all`) to guarantee zero regressions.

