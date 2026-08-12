---
name: openadapt
description: Headless browser rendering, DOM state inspection, visual web element verification, and web interaction automation via openadapt[browser] mcp. Use when testing local web applications, inspecting dynamic JS-rendered documentation, verifying UI layouts, or extracting web DOM states.
---

# OpenAdapt Browser Skill

Provides headless browser inspection and web automation paired with `openadapt[browser]` MCP tools (`mcp__openadapt__*`).

## Overview & Scope

Focuses on headless browser automation, DOM inspection, web workflow recording/replay, and web element grounding for AI coding agents.

## When to Trigger

Use OpenAdapt tools when:
- **Headless Web Inspection**: Rendering dynamic, JavaScript-heavy web documentation or UI pages.
- **Web App State Verification**: Verifying web application state during local development dev server runs (`npm run dev`).
- **DOM State Extraction**: Extracting accessibility tree / DOM elements for frontend component design (`designer` role).
- **Web Workflow Automation**: Automating form submissions or multi-step web interaction flows.

## Guidelines & Primitives

1. **Headless Execution**: Use headless Playwright/Chromium mode (`openadapt[browser]`, ~800 - 1,100 tokens) for fast DOM extraction and low latency.
2. **DOM & State Inspection**: Query element selectors, text contents, and visual layouts without spawning a heavy GUI window.
3. **UI Verification**: Validate web frontend layout changes against expected DOM structure after updating components.
