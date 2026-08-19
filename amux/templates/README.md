# amux Templates

Templates are reusable session starters — a combination of a `CLAUDE.md` (rules + context for Claude) and a directory scaffold (folders to create in the working directory).

When you create a new session in the amux dashboard, you can pick a template from the accordion list. amux will:
1. Create the subdirectories defined in `template.json`
2. Write `CLAUDE.md` into the working directory (if one doesn't exist yet)
3. Send the `initial_prompt` to Claude after the session starts

## Built-in Templates

| Template | Use Case |
|----------|----------|
| 💻 Software Project | Coding, feature work, bug fixing in a codebase |
| 💪 Fitness & Health Tracker | Workout logs, nutrition tracking, progress over time |
| 🔬 Research & Analysis | Deep research, market analysis, due diligence |
| 🏠 Personal / Life Admin | Home projects, real estate, planning, life admin |
| ✍️ Content & Marketing | Blog posts, video scripts, social copy, GTM |

## Adding a Template

1. Create a new folder under `templates/` with a short slug (e.g. `my-template`)
2. Add `template.json` with the required fields (see below)
3. Add `CLAUDE.md` with instructions for Claude
4. Submit a PR

### `template.json` Schema

```json
{
  "id": "my-template",           // must match the folder name
  "label": "Human Label",        // shown in the UI
  "icon": "🎯",                   // emoji shown in the accordion
  "description": "...",          // 1–2 sentences shown when expanded
  "tags": ["tag1", "tag2"],      // for filtering (future)
  "dirs": ["src", "docs"],       // subdirs to create in the working directory
  "initial_prompt": "..."        // optional: sent to Claude after session starts
}
```

### `CLAUDE.md` Guidelines

- Use `[placeholder]` for things the user needs to fill in
- Include a file structure diagram so Claude knows where things live
- Define explicit logging/tracking rules if the template involves ongoing data
- Add a "Working Rules" or "When I say X, do Y" section for Claude's behavior
- Keep it skimmable — Claude reads this at session start every time

## Philosophy

A template is a **use case**, not just a file structure. The goal is that someone can pick a template, fill in the `[placeholders]` in `CLAUDE.md`, and have a productive session with Claude immediately — no setup friction.
