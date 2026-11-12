/**
 * LoopGuard.ts — omp-native port of LifeOS LoopDetector (retired upstream 2026-10-25).
 *
 * Covers the two cases omp's own guards do NOT: a-b-a-b oscillation and failure
 * hammering (>=5 calls to one tool in the last 8, >=3 failed). Exact-repeat is
 * ported too — it catches the same call returning non-consecutively, which
 * `model.toolCallLoopGuard` (consecutive-identical only) misses. Detection
 * thresholds and messages match LoopDetector.hook.ts v1.0.3; the state file is
 * gone: this runs in-process for one session, so state lives in memory.
 *
 * Configuration: none by design — this is a standalone extension. Present and
 * armed (the default); remove or disable the extension to turn it off.
 *
 * Mechanism: watches tool_result (name+input paired from the preceding
 * tool_call, isError for failures), and injects the "[LOOP DETECTED] …" steer
 * as a system message before the next model call — the same channel omp's
 * native loop guard uses for its corrective. One alert per episode, COOLDOWN
 * between alerts, matching upstream. `wait` is exempt (blocking there is
 * intentional; mirrors toolCallLoopGuard.exemptTools).
 */

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { createHash } from "crypto";

interface WindowEntry { sig: string; tool: string; failed: boolean }
const WINDOW = 20;
const COOLDOWN = 4;
const EXEMPT: Record<string, true> = { wait: true }; // omp-native parity with model.toolCallLoopGuard.exemptTools

function signatureFor(tool: string, input: unknown): string {
  return `${tool}:${createHash("sha256").update(JSON.stringify(input ?? {})).digest("hex")}`;
}

function summarizeInput(input: unknown): string {
  const compact = JSON.stringify(input ?? {}).replace(/\s+/g, " ");
  return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
}

export interface Detection { episodeKey: string; message: string }

/** Pure detector core — exported for tests. */
export const detectors = {
  detectExactRepeat(window: WindowEntry[], sig: string): Detection | null {
    const matches = window.filter((e) => e.sig === sig);
    if (matches.length < 3) return null;
    const tool = matches[matches.length - 1]?.tool ?? "unknown";
    return { episodeKey: `exact:${sig}`, message: `[LOOP DETECTED] You've called ${tool} ${matches.length} times with the same input this session without progress. Last input: ${summarizeInput(undefined)}.` };
  },
  detectOscillation(window: WindowEntry[]): Detection | null {
    if (window.length < 4) return null;
    const last = window.slice(-4);
    const a = last[0].sig, b = last[1].sig;
    const alternating = a !== b && last.every((e, i) => e.sig === (i % 2 === 0 ? a : b));
    if (!alternating) return null;
    return { episodeKey: `osc:${a}|${b}`, message: `[LOOP DETECTED] You're flip-flopping between ${last[0].tool} and ${last[1].tool} (a-b-a-b) without progress.` };
  },
  detectHammering(window: WindowEntry[]): Detection | null {
    const byTool = new Map<string, WindowEntry[]>();
    for (const e of window.slice(-8)) byTool.set(e.tool, [...(byTool.get(e.tool) ?? []), e]);
    for (const [tool, entries] of byTool) {
      const failedCount = entries.filter((e) => e.failed).length;
      if (entries.length >= 5 && failedCount >= 3) {
        return { episodeKey: `hammer:${tool}`, message: `[LOOP DETECTED] You've hit ${tool} ${entries.length} times in quick succession and ${failedCount} failed.` };
      }
    }
    return null;
  },
};

export default function loopGuard(pi: ExtensionAPI): void {
  const window: WindowEntry[] = [];
  const alerted = new Set<string>();
  let seq = 0, lastAlert = 0;
  const pending = new Map<string, { name: string; input: unknown }>();
  const queued: string[] = [];

  pi.on("tool_call", async (event: unknown) => {
    const e = event as Record<string, unknown> | undefined;
    if (!e || typeof e.toolName !== "string") return;
    const id = typeof e.toolCallId === "string" ? e.toolCallId : "";
    if (id) pending.set(id, { name: e.toolName, input: e.input });
  });

  pi.on("tool_result", async (event: unknown) => {
    const e = event as Record<string, unknown> | undefined;
    if (!e) return;
    const id = typeof e.toolCallId === "string" ? e.toolCallId : "";
    const call = pending.get(id);
    if (id) pending.delete(id);
    const name = call?.name ?? (typeof e.tool_name === "string" ? e.tool_name : typeof e.toolName === "string" ? e.toolName : "");
    if (!name || name in EXEMPT) return;
    const input = call?.input;
    window.push({ sig: signatureFor(name, input), tool: name, failed: e.isError === true });
    if (window.length > WINDOW) window.splice(0, window.length - WINDOW);
    seq += 1;

    const sig = signatureFor(name, input);
    let detection: Detection | null = null;
    for (const d of [detectors.detectOscillation(window), detectors.detectExactRepeat(window, sig), detectors.detectHammering(window)]) {
      if (d && !alerted.has(d.episodeKey)) { detection = d; break; }
    }
    if (detection && lastAlert > 0 && seq - lastAlert < COOLDOWN) detection = null;
    if (detection) { alerted.add(detection.episodeKey); lastAlert = seq; queued.push(detection.message); }
  });

  pi.on("context", async (event: unknown) => {
    if (queued.length === 0) return;
    const text = queued.join("\n");
    queued.length = 0;
    let messages: unknown[] = [];
    if (event && typeof event === "object" && "messages" in event && Array.isArray(event.messages)) messages = [...event.messages];
    messages.push({ role: "system", content: [{ type: "text", text }] });
    return { messages };
  });
}
