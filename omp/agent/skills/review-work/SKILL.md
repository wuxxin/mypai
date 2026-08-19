---
name: review-work
description: Structured multi-perspective code review protocol with P0-P3 severity grading and cross-boundary audit.
---

# Review Work Skill (`review-work`)

Use this skill when auditing uncommitted diffs, evaluating pull requests, or verifying patch sets prior to merging.

---

## Review Protocol

1. **Extract Diff:** Inspect changes using `git diff HEAD` or `git diff main...HEAD`.
2. **Multi-Perspective Audit:**
   - **Correctness:** Does the code satisfy requirements under all edge cases?
   - **Safety & Security:** Are inputs validated? Are secrets protected? Are race conditions prevented?
   - **Cross-Boundary Dispatch:** If events, models, or endpoints were added, do consumers and producers stay in sync?
   - **Test Coverage:** Are unit/integration tests included for new logic?
3. **Structured Finding Output:**
   Group all findings by severity:
   - **P0 (Critical / Blocker):** Crashes, data loss, security vulnerabilities.
   - **P1 (High):** Broken business logic, unhandled API error paths.
   - **P2 (Medium):** Missing test coverage, minor performance issues.
   - **P3 (Low):** Style nits, naming clarity.
