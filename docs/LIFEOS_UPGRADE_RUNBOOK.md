# LifeOS Distribution Upgrade Runbook

Repeatable procedure for upgrading the **LifeOS payload** (`~/.claude/LIFEOS`) on this Linux `omp` host (proven on v7.40.4 → v8.761.0). For `omp` harness upgrades, see [`submodules/aur-packages/oh-my-pi-git/README.md`](../submodules/aur-packages/oh-my-pi-git/README.md) and [`LIFEOS_OMP_ARCHITECTURE.md`](LIFEOS_OMP_ARCHITECTURE.md).

---

## 1. Version Semantics (Never Conflate)

- **Distribution version:** GitHub release tag / `~/.claude/LIFEOS/VERSION`.
- **Algorithm doc line:** `LIFEOS/ALGORITHM/LATEST`.
- **Skill frontmatter `version:`:** Individual component version.

---

## 2. Step-by-Step Upgrade Procedure

1. **Backup FIRST (must dereference symlink):**
   ```bash
   mkdir -p "$HOME/lifeos-update/backup"
   tar -hzcf "$HOME/lifeos-update/backup/claude-$(date +%F-%H%M).tar.gz" -C "$HOME" .claude
   ```
   > **Critical:** `~/.claude` is a symlink to `~/.omp`; omitting `-h` archives a 127-byte symlink. Exit code 1 on live sockets/volatile daemon files is benign.

2. **Fetch & stage the release tarball:**
   `gh` CLI may be unauthenticated; use the GitHub tarball API directly:
   ```bash
   curl -L "https://api.github.com/repos/danielmiessler/LifeOS/tarball/v<VER>" -o "/tmp/lifeos-v<VER>.tar.gz"
   ```

3. **Bootstrap (from staged release dir):**
   ```bash
   LIFEOS_NO_LAUNCH=1 LIFEOS_SKIP_ALIAS=1 bash install/install.sh
   ```
   *(Backs up the prior skill to `.lifeos-skill-backups/`.)*

4. **Apply additive overlay:**
   ```bash
   bun Tools/InstallAll.ts --yes --json --config-root ~/.claude \
     --decline-services com.lifeos.pulse,com.lifeos.pulse-menubar
   ```
   - Backs diffs to `.lifeos-overlay-backups/<ts>/` and moves retirements to `.retired-<ts>/`.
   - Rewrites `settings.system.json`; personal `{ "__merge": "append", "values": [...] }` entries in `USER/CONFIG/settings.user.json` survive on top. Never place a plain `.hooks` array in any user layer.

5. **Restore the data-home contract immediately:**
   ```bash
   bun ~/.claude/LIFEOS/TOOLS/LinkUser.ts --config-dir "$HOME/agent-private/lifeos" --apply
   bun ~/.claude/LIFEOS/TOOLS/ScaffoldUser.ts --config-dir "$HOME/agent-private/lifeos"
   bun ~/.claude/LIFEOS/TOOLS/Migrate.ts --config-dir "$HOME/agent-private/lifeos"
   ```
   *(Without `--config-dir` / `LIFEOS_CONFIG_DIR`, these default to `~/.config/LIFEOS`.)*

6. **Re-apply `mypai` profile & shared `node_modules`:**
   From the `mypai` repo root:
   ```bash
   ./submodules/agents-shared/scripts/sandbox-ctl install omp --new-config-from .
   ```
   *(Deploys `omp/agent/*`, `bin/*`, and runs `cd "$HOME/.claude" && bun install`.)*

7. **Diff local overlay against the new release tarball:**
   Regenerate `src/omp-lifeos-overlay/` + `MANIFEST.md` using `src/omp-lifeos-overlay/tools/lifeos-diff.ts` and `lifeos-overlay.ts`, and re-apply any host-owned patches (e.g. `BlockerText` v1.1.0, `StopGates` v1.3.2, `VoiceServer/voice.ts`, `LIFEOS_BRIDGE=1` in `AgentJob`/`HarvestExecutor`/`MemoryReviewer`, `SessionTree` v2.1.0).

8. **Verify end-to-end:**
   - `bun ~/.claude/LIFEOS/TOOLS/Doctor.ts` (confirm `DetectEnv` reports `claude-code / detected` through `~/.claude → ~/.omp`).
   - `curl -sf http://localhost:31337/healthz` (Pulse healthy).
   - `make bridge-test && make bridge-smoke` (never rely on a direct stdin smoke alone — always verify `bridge_init` with non-zero hook count and real dispatches in `OMP_BRIDGE_LOG`).

---

## 3. Stock Invariants to Preserve

- Setup before Interview; additive overlay only (`existsSync` guards); backup before hook install.
- Keep canonical config filenames (renaming breaks `@`-imports in `CLAUDE.md`; `ActivateImports` re-enables them).
- `.toml` config for Pulse/LifeOS, never `.yaml`; Pulse on `localhost:31337`.
- Migration ledger lives at `USER/CONFIG/migrations.json`.
