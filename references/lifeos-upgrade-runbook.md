# LifeOS distribution upgrade runbook (this host)

The procedure that worked for v7.40.4 → **v8.761.0 "The One Loop"** on 2026-11-09, recorded so future updates repeat it verbatim. This is the **LifeOS payload** upgrade; the omp harness upgrade notes are `omp-lifeos-OmpHooksBridge-changelog.md`. Post-upge expectations for hooks/registry: difference doc § Hook registry.

## Version semantics (never conflate)

- Distribution version = GitHub release tag / `~/.claude/LIFEOS/VERSION`.
- Algorithm doc line = `LIFEOS/ALGORITHM/LATEST` (currently 8.45.0).
- Skill frontmatter `version:` = component line. None of the three reads as the others.

## Upgrade procedure

1. **Backup FIRST:** `tar -h ... -C ~ .claude` — **must dereference** (`~/.claude` is a symlink; plain tar produced a 127-byte archive). Exit 1 on sockets/volatile daemon files is benign. Keep in `$HOME/lifeos-update/backup/`.
2. **Bootstrap:** staged release dir, `LIFEOS_NO_LAUNCH=1 LIFEOS_SKIP_ALIAS=1 bash install/install.sh` (backs up the prior skill to `.lifeos-skill-backups/`).
3. **Overlay:** `bun Tools/InstallAll.ts --yes --json --config-root ~/.claude --decline-services com.lifeos.pulse,com.lifeos.pulse-menubar`. The overlay backs every diff to `.lifeos-overlay-backups/<ts>/` and moves retirements to `.retired-<ts>/` (the 2026-11-09 run: 78 top-level paths, 0 failures — the log's "266" figure was not reproducible on disk); it writes `VERSION` last. It also rewrites `settings.system.json` — personal user-layer `{ "__merge": "append" }` hook entries survive on top; verify the merged registry count afterwards (expected: v8's 62 + personal appends).
4. **Fix the data-home contract immediately after:** `LinkUser.ts --config-dir $HOME/agent-private/lifeos --apply`, then `ScaffoldUser.ts` **and** `Migrate.ts` with the same config-dir — the chain defaults to `~/.config/LIFEOS` otherwise (see host doc § Data home).
5. **Verify:** Doctor + Pulse `/healthz` + ISASync stdin smoke (`echo '{...PostToolUse, ISA path}' | bun hooks/ISASync.hook.ts`) — **and one end-to-end hook probe**: `OMP_BRIDGE_LOG=/tmp/b.log omp -p 'write a file with your write tool'`, then look for `bridge_init hooks:<nonzero>` and per-hook dispatch lines in that log. A direct stdin smoke proves the script, never the wiring: on 2026-11-09 it passed while zero hooks fired in real sessions (mypai `0c58129`).

## Fetch & tooling notes

- `gh` CLI here is unauthenticated → use plain GitHub API reads; tarball via `api.github.com/repos/danielmiessler/LifeOS/tarball/v<ver>`.
- Bridge log sinks: **silent by default** (the interactive TUI must stay clean); `OMP_BRIDGE_STDERR=1` re-enables stderr lines prefixed `lifeos-bridge` for journal capture (`journalctl --user | grep lifeos-bridge` — journal files are readable from inside the sandbox where the user bus is not); `OMP_BRIDGE_LOG=<path>` writes a file sink. A journald-native socket sink was tried and dropped: Bun's dgram has no AF_UNIX and journald's `/dev/log` refuses stream connects on this host (ECONNREFUSED, 2026-11-09 probe).

## Invariants carried over from stock (keep)

Setup before Interview; additive overlay only (`existsSync` guards, never clobber populated dirs); permission + backup before hook install; config keeps canonical name (renaming breaks identity `@`-imports — the enabled CLAUDE.md imports are personalization, ActivateImports re-enables them on template refresh); `.toml` config, never `.yaml`; Pulse at localhost:31337.

## Post-upgrade re-checks specific to this host

- DetectEnv must still report "claude-code / detected" through the `~/.claude → ~/.omp` shim (intended; keeps us on the CC registry path).
- The v8 hook registry lands in `settings.system.json`; a plain-array overlay under `.hooks` at any layer replaces sibling event arrays wholesale — never hand-write one (difference doc § Hook registry, incident 2026-11-16 12:36).
- Guard posture after v8 retired 19 CC-dependent hooks: difference doc § Guard enforcement.
- Migration ledger lives at `USER/CONFIG/migrations.json`; the 2026-11-09 run left it clean (`applied: []`, telos-consolidate not-needed — TELOS.md was already single-file).
