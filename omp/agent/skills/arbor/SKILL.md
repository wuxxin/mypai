---
name: arbor
description: Graph-native code intelligence, dependency graph traversal, AST comprehension, and fast hypothesis verification via arbor mcp. Use when analyzing deep codebase dependencies, evaluating structural refactoring hypotheses, tracing cross-module callers, or indexing AST relationships.
---

# Arbor Agent Skill

Provides deterministic code-graph intelligence and hypothesis verification paired with the `arbor mcp` tools (`mcp__arbor__*`).

## When to Trigger

Use Arbor tools when:
- Tracing complex dependency call-graphs across modules before refactoring
- Evaluating AST structural changes and hypothesis validation
- Analyzing broad codebase architecture using graph relationships rather than simple text RAG
- Generating targeted dependency hypotheses for bug fixes or optimizations

## Workflow & Guidelines

1. **Graph Exploration**: Use Arbor graph tools to identify incoming/outgoing dependencies for target symbols.
2. **Hypothesis Formulating**: State the architectural or algorithmic hypothesis before making edits.
3. **Targeted Verification**: Run hypothesis checks on isolated code blocks or worktrees before committing changes.
4. **Scope Control**: Prefer lightweight graph checks (`Option A2`) over full multi-worktree runs to conserve token budget (~700 - 900 tokens).
