---
name: LifeOS
metadata:
  short-description: "Installs, onboards, updates, diagnoses, and uninstalls LifeOS, and reports bugs or features to the project, across supported harnesses."
version: 1.6.13
evals:
  deterministic:
    - command: "bun skills/LifeOS/Tools/PulseHealth.ts audit"
      falsifier: "the command exits nonzero when a Pulse check that ran fails (schema tool, provenance of the USER template copies, or the service's /healthz); a check that cannot run prints NOT RUN instead of passing"
description: Install and onboard a user into LifeOS — the Life Operating System (current state → ideal state via TELOS + the Algorithm). The agentic installer detects your OS + harness, wires hooks with permission, scaffolds your USER tree, pulls in sources you provide, and runs the TELOS / current→ideal interview that seeds your Pulse dashboard. USE WHEN install LifeOS, set up LifeOS, lifeos setup, lifeos-setup, lifeos interview, onboard me, run the interview, integrate LifeOS into my harness, update LifeOS, uninstall LifeOS, first-time setup, lifeos doctor, check my install, what capabilities are broken, pulse setup, set up pulse, install pulse, audit pulse setup, is Pulse healthy, report a LifeOS bug, file an issue upstream, report this to the project, contribute this fix, open a PR to LifeOS, suggest a feature, ask the LifeOS project. NOT FOR building or cutting a LifeOS release (private release tooling), editing TELOS after onboarding (use Telos / Interview), or LifeOS system maintenance (use the private maintenance skill).
argument-hint: "[setup|interview|doctor|update|uninstall|report]"
---

# LifeOS

> **This is the INSTALLED copy of the LifeOS skill, not the distribution root.**
> Its `install/` directory holds only bootstrap files. To update, follow `Intents/Update.md`: it first runs
> `bash <configRoot>/skills/LifeOS/install/install.sh` to fetch the full release skill. Only then run
> the payload tools — OverlaySystem, InstallHooks, and ScaffoldUser — which need that full payload.
> Run every tool by its full path: `bun <configRoot>/skills/LifeOS/Tools/<Tool>.ts`.


The install and onboarding surface for **LifeOS**, the Life Operating System. One command takes a stranger on any harness from nothing to a working, personalized install whose Pulse dashboard already shows their current state vs ideal state, without making them adopt a whole new harness.

## Ideal State

- A stranger on any supported OS and harness ends with a working, personalized install: Core placed after one consent, every enhancement they did not decline, identity placeholders gone, the `lifeos` launch command wired, and Pulse showing their own current and ideal state.
- Every change to the user's machine was shown before it happened and is reversible: settings and shell rc are backed up first, updates and uninstalls move or back up instead of deleting, and nothing the user authored is overwritten.
- Setup completes and its hooks and integration are in place before the Interview writes anything.
- Nothing changes without an explicit yes, during the install and afterwards, unless the user turned on the opt-in `automode` component (`Intents/Setup.md` step 7), which ships off and needs a clear yes.
- Every "installed", "updated" or "removed" claim rests on the evidence the intent names, and a capability the user declined is reported as declined, never as broken.
- Feedback sent upstream is redacted, reproducible and posted only on the user's own yes.

## Intent Routing

| Intent | Trigger | File |
|--------|---------|------|
| **Setup** | `setup`, `/LifeOS setup`, "install LifeOS", "integrate into my harness" | `Intents/Setup.md` |
| **Interview** | `interview`, "onboard me", "run the interview", TELOS capture | `Intents/Interview.md` |
| **Doctor** | `doctor`, "check my install", "what's broken", "what capabilities are live" | run `bun <configRoot>/LIFEOS/TOOLS/Doctor.ts` (`Intents/Setup.md` step 9.6) |
| **Pulse** | "set up pulse", "pulse setup", "audit pulse setup", "is Pulse healthy" | `Intents/Setup.md` step 8.6: `bun Tools/PulseHealth.ts audit` reports Pulse health read-only |
| **Update** | `update`, "update LifeOS", after a version bump | `Intents/Update.md` |
| **Uninstall** | `uninstall`, "remove LifeOS" | `Intents/Uninstall.md` |
| **Report** | `report`, "report this bug", "file an issue", "contribute this fix", "open a PR", "suggest this to the project", "ask the LifeOS project" | `Intents/Report.md` |

| File | Read when |
|------|-----------|
| `INSTALL.md` | the AI-native install document (served at `ourlifeos.ai/install`; host is `install_host` in `<configRoot>/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/LifeOS/Config.md`): capability gate, prerequisites, release fetch, `DetectEnv`, harness integration, the support table and the install rules; everything after the fetch is `Intents/Setup.md` |
| `Workflows/Update.md` | an install from before 2026-10-08 whose Update step re-reads this path: a signpost that sends the agent to `Intents/Update.md` |
| `GETTING-STARTED.md` | after the install: the optional external tools (codex, Interceptor, cf, Fish Audio, gh, and smaller ones), what each powers and how to prove it is live |
| `References/HermesSidecar.md` | the user said yes to the Hermes sidecar offer in Setup step 9.5: the pinned install, its own device-code login, the evidence-based guard check and the two disclosures to make |
| `install/` | the whole-system payload (skills, hooks, system prompt, Algorithm, docs, runtime tools, placed during setup with permission) and the bootstrap `install/install.sh` (served as `ourlifeos.ai/install.sh`); data the install Tools read and place, never edited by hand. The `LifeOS/` directory is the entire distribution: no release-root `install.sh`, no `.claude/` clone |

`doctor` is the one tool-backed route: `Doctor.ts` prints each capability's state and the fix for anything broken. Relay it and honor `decline` (Setup step 9.6).

## Data & Config

`<configRoot>` is the harness config dir `DetectEnv` reports (on Claude Code, `$CLAUDE_CONFIG_DIR` when set, else `~/.claude`). The user tree is reached at `<configRoot>/LIFEOS/USER` once `LinkUser` has linked it in.

- `USER/CONFIG/LIFEOS_CONFIG.toml` holds the DA name and voice and the `[principal]` identity. Interview writes it; Update reads it to re-render identity placeholders.
- `USER/PRINCIPAL/PRINCIPAL_IDENTITY.md` (prose only; names and voice live in `LIFEOS_CONFIG.toml`) and `USER/TELOS/TELOS.md` are written by Interview; `SeedPulse` derives `LIFEOS_STATE.json` and `PRINCIPAL_TELOS.md` from them.
- `USER/CUSTOMIZATIONS/SKILLS/LifeOS/Config.md` holds `install_host`, the host that serves `INSTALL.md` and `install/install.sh` (written as `ourlifeos.ai` in this skill), and `spinner_verbs_file`, the optional `spinnerVerbs.json` beside it that the `spinnerverbs` component deploys in place of the shipped list, and `pulse_templates_dir`, the USER template tree `Tools/ScaffoldUser.ts` copies from and `Tools/PulseHealth.ts audit` compares `USER/` against (default `<configRoot>/skills/LifeOS/install/USER`; an explicit `--skill-root` wins for ScaffoldUser). Every key, the file shape and a proof run: [`Setup.md`](Setup.md).
- `<configRoot>/LIFEOS/MEMORY/STATE/reports/current/` holds the Report intent's in-progress report; `Report.ts reset` clears it.

## Gotchas

- **The frontmatter `version:` is the COMPONENT line, not the release.** Claude Code ignores it; the maintainer-side `BumpSkillVersions` (not shipped) maintains it at the source repo. The DISTRIBUTION version, what a user means by "LifeOS 7.x", is the GitHub release tag + `LIFEOS_RELEASES/<version>/` + the `install.sh` fetch. Never read the component line as the release number.
- **Config root keeps its canonical name.** The user tree lives under the config dir and is linked into the harness tree; "LifeOS" is the brand, the resolved config path does not rename (renaming it breaks the identity `@`-imports).
- **Dev-tree refusal checks one marker.** The install tools refuse to run inside the LifeOS source repo. `detectDevTree` (`Tools/InstallEngine.ts`) checks one thing: whether the maintainer-side release skill directory exists under the config root. It does not look at git remotes, so a source checkout without that private skill is not detected. `--allow-dev` overrides the refusal on the tools that accept it (`InstallSettings.ts`, `ActivateImports.ts` and others). Never mutate the author's live system.
- **Config is `.toml`, never `.yaml`.** `LifeosConfig.ts` reads TOML; the legacy `.yaml` template was retired 2026-06-19.
- **Every install tool is a dry run without `--apply`** (InstallAll: `--yes`). Between 2026-07-08 and 2026-07-31 the documented update path omitted it, and users saw success-shaped output while nothing changed.

## Examples

- "install LifeOS" → Setup, then Interview: Core and every enhancement not declined are in place with permission at each step, hooks fire, and the user rolls straight into onboarding.
- "run the lifeos interview" → Interview: TELOS and current/ideal state captured, the user's sources merged in, Pulse showing real rings.
- "lifeos doctor" → `Doctor.ts`: the capability table, with the fix command offered for anything broken.
- "audit pulse setup" → `PulseHealth.ts audit`: one status block with real counts for the schema tool, provenance of the USER template copies, missing templates and `/healthz`, NOT RUN shown as such.
- "update LifeOS" → Update: the install is on the latest release with the user's data untouched, or reported already current.
- "report this bug to LifeOS" → Report: a redacted five-field issue the user has read, posted only on their yes. "contribute this fix" adds a green run and a PR on top; "suggest this to the project" files a discussion instead.
