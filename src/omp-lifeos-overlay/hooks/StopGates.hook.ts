#!/usr/bin/env bun
/**
 * @version 1.3.2
 * StopGates.hook.ts — the ONE Stop-event gate hook.
 *
 * Consolidation (2026-07-11, hooks BLE pass): merges the three per-turn gate
 * spawns into one process, reading stdin ONCE. Each gate file remains the
 * owner of its logic (and stays runnable standalone via its own shim); this
 * hook imports their exported run() and evaluates in the old registration
 * order:
 *
 *   0. FormatGate.run()
 *   1. ISAFoldGate.run()
 *   2. ISAGate.run()
 *   3. DeployRegistrationGate.run()
 *   4. IsaDeployMarkerGate.run()
 *
 * Retired for this host (2026-11-12, principal's call): IsaCodeSyncGate and
 * VerificationGate. On the omp harness OmpHooksBridge discards a Stop hook's
 * `decision:"block"` verdict — there is no stop-block mechanism to act on it —
 * so both ran every turn, decided correctly, and their decision landed nowhere
 * (only latency was real). Their logic files stay untouched and runnable
 * standalone; restore by re-adding the entries under a harness that honors
 * Stop blocks. The functional replacement path is omp's advisor subsystem
 * (`reviewMode: agent-end` + WATCHDOG roster), which CAN wake the agent after
 * a final answer. See AGENTS.md § guard audit.
 *
 * Decision semantics: the FIRST gate returning a `decision:"block"` wins and
 * is emitted; later gates are still evaluated for their telemetry EXCEPT after
 * a block (matching the old behavior closely enough — two simultaneous blocks
 * were never actionable, the harness takes one recovery turn anyway).
 * `{continue:true}` returns (stop_hook_active recovery) are emitted once.
 *
 * Failure mode (1.3.0, ISA 20261015-security-p1-batch1 C8): every Stop gate is an
 * ADVISE gate. Each gate, the private-gate registry load, the unreadable-input path
 * (hook-io gateInputFailureDecision) and the dispatcher itself run under
 * runGate("advise"): a failure lets the turn end, records one Vigil `hook-error`
 * event naming the gate, and prints one stderr line.
 * One gate's crash never silences the others, and the hook always exits 0. A gate
 * module that fails at static import is outside this wrapper: the process exits
 * non-zero and the harness shows that hook error itself.
 */

import { readHookInputResult, gateInputFailureDecision, type HookInput } from "./lib/hook-io";
import { runGate, type GateDeps } from "./lib/gate-run";
import { run as formatGate } from "./FormatGate.hook";
import { run as isaFoldGate } from "./ISAFoldGate.hook";
import { run as isaStructureGate } from "./ISAGate.hook";
import { run as deployRegistrationGate } from "./DeployRegistrationGate.hook";
import { run as isaDeployMarkerGate } from "./IsaDeployMarkerGate.hook";
import { existsSync } from "fs";
import { join } from "path";
import { recordGateRun } from "../LIFEOS/TOOLS/GateReach";

export type GateResult = { name: string; decision?: string; reason?: string; message?: string };
export type GateFn = (input: HookInput, results: readonly GateResult[]) => Promise<object | null>;
/** gate-run's emitter and logger, plus the gate-reach recorder; tests stub all three. */
export type StopGateDeps = GateDeps & { record?: (gate: string, meta: { result: string }) => void };

// OutputFormatGate (mode-banner telemetry) removed 2026-07-11; FormatGate is
// its unified-format successor WITH TEETH (2026-07-11): deterministic
// structural checks on the one LifeOS format — 🗣️ closer last,
// 🧠 line when a delta arrived, ≤2 prose em-dashes. Voice/vocabulary drift
// stays DriftReminder's job; this gate is structure only. First in order so a
// format fix is the recovery turn's single clear instruction.
// ORDER (2026-08-17, Max second-look): VerificationGate FIRST. FormatGate now
// blocks on drift streaks, and a format-block manufactures a recovery turn on
// which VerificationGate self-exempts (stop_hook_active) — evidence gaps must
// outrank cosmetics, so the evidence gate gets first claim on the block slot.
const GATES: Array<[string, GateFn]> = [
  // IsaCodeSyncGate + VerificationGate retired for this host 2026-11-12 (see header):
  // their decision:"block" verdicts are discarded by OmpHooksBridge on omp. The ORDER
  // comment above predates the retirement; FormatGate now holds the block slot.
  ["FormatGate", formatGate],
  // ISAFoldGate (2026-07-29, D-50 enforcement): prod mutated this turn + active run +
  // ISA untouched + reply silent on ISA state → block. Phrase-independent — the gap
  ["ISAFoldGate", isaFoldGate],
  // ISAGate (2026-07-24, granularity/testability upgrade F3): blocks a close
  // (phase: complete written this turn) on un-gameable STRUCTURAL violations —
  // non-M/N progress, fog-at-complete, missing anchors_to. Scoped to ISAs
  // touched this turn (legacy files never retroactively gated). Complements
  // This has a different, structural tooth.
  ["ISAGate", isaStructureGate],
  // DeployRegistrationGate (OPERATIONAL_PREFERENCES § Bunker registration): a custom-domain
  // wrangler/cf deploy this session must be registered in PROJECTS.md + the Workflows fleet
  // curated inventory before the turn ends. A workers.dev-only deploy also needs Bunker
  // adoption, or a reasoned exemption (2026-10-06). Fires once per host per session.
  ["DeployRegistrationGate", deployRegistrationGate],
  // IsaDeployMarkerGate (2026-08-17): an ISA's `Latest deploy:` pointer must match
  // the session's last deploy — closes the "edited early, deployed after" staleness
  ["IsaDeployMarkerGate", isaDeployMarkerGate],
  // ArtQualityGate retired 2026-10-16 by principal decision.
];

// Optional private gate registry — present only on the principal's private
// install, release-zoned out of the public payload (see hooks/lib/private-gates.ts).
// The existsSync guard skips it cleanly wherever the file is absent, so the public
// build carries no reference to the private-only gates it registers. A registry that
// exists but fails to load is an advise failure: the Stop hook still runs the public
// gates, and a Vigil hook-error event records that the private ones did not run.
const PRIVATE_GATES_PATH = join(import.meta.dir, "lib", "private-gates.ts");
if (existsSync(PRIVATE_GATES_PATH)) {
  const loaded = await runGate("advise", "StopGates:private-gates", async () => {
    const mod = await import(PRIVATE_GATES_PATH);
    if (!Array.isArray(mod.PRIVATE_GATES)) throw new Error("private-gates.ts exports no PRIVATE_GATES list");
    return mod.PRIVATE_GATES as Array<[string, GateFn]>;
  });
  if (loaded.status === "ok") GATES.push(...loaded.value);
}

/**
 * Gates that advise and never refuse a stop (2026-10-15 native-unblock ISC-12): ISA and deploy bookkeeping is shown
 * to the principal as a note, so a turn never waits on a document pointer. Their checks still run and log as before.
 */
export const ADVISORY_GATES = new Set(["ISAFoldGate", "ISAGate", "DeployRegistrationGate", "IsaDeployMarkerGate"]);

export async function runGates(input: HookInput, gates: Array<[string, GateFn]> = GATES, deps: StopGateDeps = {}): Promise<object | null> {
  const record = deps.record ?? recordGateRun;
  record("hook:StopGates.hook", { result: "executed" });
  const results: GateResult[] = [];
  for (const [name, gate] of gates) {
    record(`hook:${name}.hook`, { result: "executed" });
    // Advise: a gate that throws contributes no decision, and runGate records one Vigil hook-error for it.
    const run = await runGate("advise", name, () => gate(input, results), deps);
    if (run.status === "ok" && run.value) results.push({ name, ...run.value });
  }

  // Separate blocks, deferred statuses and notes. An advisory gate's block and any gate's systemMessage are notes.
  const blocks = results.filter((r) => r.decision === "block" && !ADVISORY_GATES.has(r.name));
  const deferred = results.filter((r) => r.decision === "deferred");
  const notes = results.flatMap((r) => {
    const sm = (r as { systemMessage?: unknown }).systemMessage;
    if (typeof sm === "string" && sm.trim()) return [sm.trim()];
    if (r.decision === "block" && ADVISORY_GATES.has(r.name)) return [`[${r.name}, advisory] ${r.reason || r.message || "flagged"}`];
    return [];
  });

  // Emit combined block if any gate blocked
  if (blocks.length > 0) {
    const reasons = blocks.map((b) => b.reason || b.message || `[${b.name}] unspecified`).join("\n\n");
    const gateNames = blocks.map((b) => b.name).join(", ");
    return {
        decision: "block",
        reason: `The turn tried to end, but ${gateNames} still hold obligations that were not met. Resolve each item below, then restate the outcome before stopping.\n\n${reasons}`,
      };
  } else if (deferred.length > 0) {
    // No blocks but some deferred: show the note to the principal and let the turn end. The harness accepts only
    // decision approve|block on a Stop hook; a "deferred" decision fails its schema and prints a hook error every turn
    // (2026-10-16), so the note travels as systemMessage, which displays without blocking or continuing the turn.
    const deferredGates = deferred.map((d) => d.name).join(", ");
    const messages = deferred.map((d) => d.message || `[${d.name}] deferred`).join("\n\n");
    return { systemMessage: [`Gates exhausted retries: ${deferredGates}\n\n${messages}`, ...notes].join("\n\n") };
  }
  return notes.length ? { systemMessage: notes.join("\n\n") } : null;
}

if (import.meta.main) {
  // The dispatcher is an advise gate too: anything residual ends the turn and records one Vigil hook-error.
  const run = await runGate("advise", "StopGates", async () => {
    // A malformed or unreadable payload is reported and recorded, never silently passed.
    const read = await readHookInputResult();
    if (!read.ok) return gateInputFailureDecision(read, "StopGates");
    return runGates(read.input);
  });
  if (run.status === "ok" && run.value) console.log(JSON.stringify(run.value));
  process.exit(0);
}
