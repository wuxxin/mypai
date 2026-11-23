#!/usr/bin/env bun
/**
 * lifeos-workflows-tick.ts — Pulse-hosted clock bridge for LifeOS native WORKFLOWS.
 *
 * Bridges LifeOS WORKFLOWS onto Linux hosts where systemd --user is unavailable inside
 * the omp sandbox and all periodic work runs under the single supervised Pulse service
 * (omp.service). Never calls systemctl or launchctl.
 *
 * Usage:
 *   Add ONE 1-minute job to USER/CONFIG/PULSE.user.toml:
 *     [[job]]
 *     name = "workflows-clock"
 *     schedule = "* * * * *"
 *     command = "lifeos-workflows-tick"
 *
 * Behavior:
 *   1. If $LIFEOS_DIR/WORKFLOWS/clock/tick.ts exists (upstream tick entrypoint), delegates to it.
 *   2. Otherwise scans $LIFEOS_CONFIG_DIR/USER/WORKFLOWS and $LIFEOS_DIR/WORKFLOWS/definitions
 *      for enabled workflow definitions (*.json, *.yaml, *.yml) carrying a 5-field cron `schedule`
 *      and executes due ones via $LIFEOS_DIR/WORKFLOWS/engine (if present) or the definition's
 *      explicit `command`.
 *   3. Persists last-run minute stamps in $LIFEOS_CONFIG_DIR/USER/MEMORY/STATE/workflows-clock.json
 *      so a workflow never fires twice in the same minute.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { basename, dirname, extname, join } from "path";

export interface WorkflowDef {
  id: string;
  schedule: string;
  enabled: boolean;
  command?: string;
  file: string;
}

export interface ClockState {
  lastRunMinute: Record<string, string>;
}

/** Match a single 5-field cron token (e.g. "*", "*\/5", "1,15", "1-5", "0-30/10"). */
export function matchCronField(expr: string, value: number): boolean {
  for (const part of expr.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [rangePart, stepPart] = trimmed.split("/");
    const step = stepPart ? Number.parseInt(stepPart, 10) : 1;
    if (!Number.isInteger(step) || step <= 0) continue;

    if (rangePart === "*") {
      if (value % step === 0) return true;
      continue;
    }
    const [startStr, endStr] = rangePart.split("-");
    const start = Number.parseInt(startStr, 10);
    const end = endStr !== undefined ? Number.parseInt(endStr, 10) : start;
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
    if (value >= start && value <= end && (value - start) % step === 0) return true;
  }
  return false;
}

/** Standard 5-field cron match: minute hour day-of-month month day-of-week (0=Sun..6=Sat). */
export function cronMatches(schedule: string, now: Date): boolean {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const [min, hour, dom, mon, dow] = fields;
  return (
    matchCronField(min, now.getMinutes()) &&
    matchCronField(hour, now.getHours()) &&
    matchCronField(dom, now.getDate()) &&
    matchCronField(mon, now.getMonth() + 1) &&
    (matchCronField(dow, now.getDay()) || (now.getDay() === 0 && matchCronField(dow, 7)))
  );
}

export function minuteKey(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function parseSimpleYamlOrJson(file: string): Record<string, unknown> | null {
  const raw = readFileSync(file, "utf8");
  const ext = extname(file).toLowerCase();
  if (ext === ".json") {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  }
  // Use Bun's built-in YAML parser when available; fall back to flat key: value extraction.
  const bunAny = Bun as unknown as { YAML?: { parse(s: string): unknown } };
  if (bunAny.YAML && typeof bunAny.YAML.parse === "function") {
    const parsed = bunAny.YAML.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  }
  const out: Record<string, unknown> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.+?)\s*$/);
    if (!m) continue;
    const val = m[2].replace(/^['"]|['"]$/g, "");
    out[m[1]] = val === "true" ? true : val === "false" ? false : val;
  }
  return out;
}

export function discoverWorkflows(dirs: string[]): WorkflowDef[] {
  const byId = new Map<string, WorkflowDef>();
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const ext = extname(entry.name).toLowerCase();
      if (ext !== ".json" && ext !== ".yaml" && ext !== ".yml") continue;
      const file = join(dir, entry.name);
      try {
        const doc = parseSimpleYamlOrJson(file);
        if (!doc) continue;
        const schedule = typeof doc.schedule === "string"
          ? doc.schedule
          : typeof doc.cron === "string"
            ? doc.cron
            : "";
        if (!schedule) continue;
        const id = typeof doc.id === "string" && doc.id.trim()
          ? doc.id.trim()
          : typeof doc.name === "string" && doc.name.trim()
            ? doc.name.trim()
            : basename(entry.name, ext);
        const enabled = doc.enabled !== false && doc.disabled !== true;
        const command = typeof doc.command === "string" ? doc.command : undefined;
        byId.set(id, { id, schedule, enabled, command, file });
      } catch {
        // Malformed definition never blocks other workflows.
      }
    }
  }
  return [...byId.values()];
}

export function loadState(stateFile: string): ClockState {
  try {
    if (!existsSync(stateFile)) return { lastRunMinute: {} };
    const parsed = JSON.parse(readFileSync(stateFile, "utf8")) as Partial<ClockState>;
    return { lastRunMinute: parsed.lastRunMinute && typeof parsed.lastRunMinute === "object" ? parsed.lastRunMinute : {} };
  } catch {
    return { lastRunMinute: {} };
  }
}

export function saveState(stateFile: string, state: ClockState): void {
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n", "utf8");
}

async function runWorkflow(wf: WorkflowDef, lifeosDir: string, dryRun: boolean): Promise<{ ok: boolean; exit: number; runner: string }> {
  const engineCli = join(lifeosDir, "WORKFLOWS", "cli.ts");
  const cmd = wf.command
    ? ["bash", "-c", wf.command]
    : existsSync(engineCli)
      ? ["bun", engineCli, "run", wf.id]
      : null;

  if (!cmd) return { ok: false, exit: 127, runner: "none" };
  if (dryRun) return { ok: true, exit: 0, runner: cmd.join(" ") };

  const proc = Bun.spawn(cmd, {
    env: { ...process.env, LIFEOS_WORKFLOW_ID: wf.id, LIFEOS_WORKFLOW_CLOCK: "pulse" },
    stdout: "inherit",
    stderr: "inherit",
  });
  const exit = await proc.exited;
  return { ok: exit === 0, exit, runner: cmd[0] };
}

async function main(): Promise<void> {
  const home = homedir();
  const lifeosDir = process.env.LIFEOS_DIR || join(home, ".claude", "LIFEOS");
  const configDir = process.env.LIFEOS_CONFIG_DIR || join(home, "agent-private", "lifeos");
  const dryRun = process.argv.includes("--dry-run");

  // Delegate to upstream tick entrypoint if LifeOS adds one natively.
  const upstreamTick = join(lifeosDir, "WORKFLOWS", "clock", "tick.ts");
  if (existsSync(upstreamTick) && !dryRun) {
    const proc = Bun.spawn(["bun", upstreamTick, ...process.argv.slice(2)], {
      env: { ...process.env, LIFEOS_WORKFLOW_CLOCK: "pulse" },
      stdout: "inherit",
      stderr: "inherit",
    });
    process.exit(await proc.exited);
  }

  const now = new Date();
  const mk = minuteKey(now);
  const stateFile = join(configDir, "USER", "MEMORY", "STATE", "workflows-clock.json");
  const state = loadState(stateFile);

  // System definitions first, user definitions override by id.
  const defs = discoverWorkflows([
    join(lifeosDir, "WORKFLOWS", "definitions"),
    join(configDir, "USER", "WORKFLOWS"),
  ]);

  let ran = 0;
  let failed = 0;
  for (const wf of defs) {
    if (!wf.enabled) continue;
    if (!cronMatches(wf.schedule, now)) continue;
    if (state.lastRunMinute[wf.id] === mk) continue;

    state.lastRunMinute[wf.id] = mk;
    if (!dryRun) saveState(stateFile, state);
    const res = await runWorkflow(wf, lifeosDir, dryRun);
    ran += 1;
    if (!res.ok) failed += 1;
    console.log(JSON.stringify({ event: "workflow_tick", id: wf.id, minute: mk, ok: res.ok, exit: res.exit, dryRun }));
  }

  if (ran === 0 && process.argv.includes("--verbose")) {
    console.log(JSON.stringify({ event: "workflow_tick_idle", minute: mk, discovered: defs.length }));
  }
  if (failed > 0) process.exit(1);
}

if (import.meta.main) {
  await main();
}
