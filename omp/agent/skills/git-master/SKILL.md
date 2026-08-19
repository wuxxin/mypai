---
name: git-master
description: Safe git repository workflows, worktree isolation, uncommitted state protection, and atomic semantic commits.
---

# Git Master Skill (`git-master`)

Use this skill to manage git operations safely, create isolated task worktrees, and author atomic conventional commits.

---

## Operating Invariants

1. **Protect Uncommitted Work:**
   - Never run destructive commands like `git reset --hard` or `git clean -fd` on untracked/uncommitted changes without explicit user approval.
2. **Worktree Isolation:**
   - For parallel tasks or speculative refactoring, create an isolated worktree under `~/.omp/wt/<branch-name>`.
3. **Atomic Semantic Commits:**
   - Commit logically coherent units of work.
   - Use conventional commit messages: `feat(scope): ...`, `fix(scope): ...`, `refactor(scope): ...`, `test(scope): ...`, `docs(scope): ...`.
   - Provide a bulleted summary of specific changes in the commit body.
