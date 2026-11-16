/**
 * blocker-text.ts — text the user when a session is held on a critical blocker while he is away (Vigil ISA F19).
 *
 * Why: a question in a terminal answer goes unseen while he is away, and the session looks finished. But about 40% of
 * final answers end on a ❓ OPEN item, nearly all "I'd say yes" confirmations, so only two things count as a blocker:
 * Claude Code's own `permission_prompt` notification (a gate actually holding a tool call), and an ❓ OPEN item I mark
 * with 🚨. Nothing here stops or changes a turn; it runs after the session has already stopped.
 *
 * Dry-run first (principal directive, 2026-10-26): until USER/CONFIG/blocker-text.json says `"mode": "live"`, a blocker is only
 * recorded as an info event and a log line, so the would-send count is seen before any text goes out.
 */
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { basename } from "node:path";
import { getDAName } from "./identity";
import { claudeDirFor } from "./paths";

export type Trigger = "permission" | "critical";
export type Blocker = { trigger: Trigger; text: string };
export type Mode = "dry-run" | "live";

/** Minutes without keyboard or mouse input on this Mac before the user counts as away from it (ISC-483). */
export const IDLE_AWAY_MINUTES = 10;
/** Relay's text shape: one to three sentences, under 400 characters (OPERATIONAL_PREFERENCES § Urgent notifications). */
export const TEXT_MAX_CHARS = 400;

/** The blocker in a Notification hook payload, or null. Only `permission_prompt` is one; `idle_prompt` never is (ISC-482). */
export function blockerFromNotification(input: { notification_type?: unknown; message?: unknown }): Blocker | null {
  if (input.notification_type !== "permission_prompt") return null;
  const text = typeof input.message === "string" && input.message.trim() ? input.message.trim() : "a tool call needs your approval";
  return { trigger: "permission", text };
}

/** The 🚨 items under a final answer's last ❓ OPEN field, marker and number stripped. Plain items are not blockers (ISC-482). */
export function criticalOpenItems(message: string): Blocker[] {
  const at = message.lastIndexOf("❓ OPEN");
  if (at < 0) return [];
  return message
    .slice(at)
    .split("\n")
    .slice(1)
    .map((l) => l.trim().replace(/^\d+\.\s+/, ""))
    .filter((l) => l.startsWith("🚨"))
    .map((l) => ({ trigger: "critical" as const, text: l.replace(/^🚨\s*/u, "").replace(/[*_`]/g, "").trim() }))
    .filter((b) => b.text.length > 0);
}

/** Away from this Mac: Location sees him on another device, or this Mac has been idle long enough (ISC-483). */
export function awayReason(o: { deviceKind?: string | null; idleMinutes: number | null }): string | null {
  if (o.deviceKind && o.deviceKind !== "this-mac" && o.deviceKind !== "unknown") return `on ${o.deviceKind}`;
  if (o.idleMinutes !== null && o.idleMinutes >= IDLE_AWAY_MINUTES) return `idle ${o.idleMinutes} min`;
  return null;
}

/** The project a session runs in, as the user would name it: LifeOS for the config root, else the directory's name. */
export function projectName(cwd: string | undefined, home = homedir(), root = claudeDirFor(process.env, home)): string {
  if (!cwd) return "a session";
  if (cwd === root || cwd.startsWith(`${root}/`)) return "LifeOS";
  return basename(cwd) || "a session";
}

/** One plain line for his phone: project and blocker, home paths shortened, under the Relay cap (ISC-485). */
export function composeText(b: Blocker, project: string, home = homedir(), da = getDAName()): string {
  const lead = b.trigger === "permission" ? `${da} is waiting on your approval in ${project}` : `${da} needs a decision in ${project}`;
  const body = b.text.split(home).join("~").replace(/\s+/g, " ").trim();
  const text = `${lead}: ${body}`;
  return text.length <= TEXT_MAX_CHARS ? text : `${text.slice(0, TEXT_MAX_CHARS - 1).trimEnd()}…`;
}

/** The dedupe key: one text per session per blocker (ISC-484). */
export function blockerKey(sessionId: string, b: Blocker): string {
  const h = createHash("sha256").update(`${sessionId}\n${b.trigger}\n${b.text}`).digest("hex").slice(0, 16);
  return `blocker:${h}`;
}

export type Deps = {
  sessionId: string;
  cwd?: string;
  mode: Mode;
  deviceKind: () => string | null;
  idleMinutes: () => number | null;
  seen: (key: string) => boolean;
  markSeen: (key: string, b: Blocker) => void;
  credentialRefusal: (text: string) => string | null;
  writeEvent: (event: Record<string, unknown>) => unknown;
  log: (row: Record<string, unknown>) => void;
  emitLive: (text: string, key: string) => void;
  now?: () => Date;
};

export type Outcome = { key: string; outcome: "dry-run" | "sent" | "duplicate" | "present" | "refused"; reason?: string };

/** Handle the blockers one hook call found. Never throws for an expected case; the caller still wraps it (ISC-487). */
export function handle(blockers: Blocker[], d: Deps): Outcome[] {
  if (blockers.length === 0) return [];
  const away = awayReason({ deviceKind: d.deviceKind(), idleMinutes: d.idleMinutes() });
  const project = projectName(d.cwd);
  const ts = (d.now ?? (() => new Date()))().toISOString();
  return blockers.map((b): Outcome => {
    const key = blockerKey(d.sessionId, b);
    if (d.seen(key)) return { key, outcome: "duplicate" };
    if (!away) return { key, outcome: "present" };
    const text = composeText(b, project);
    const refused = d.credentialRefusal(text);
    if (refused) {
      d.log({ ts, key, trigger: b.trigger, outcome: "refused", reason: refused });
      return { key, outcome: "refused", reason: refused };
    }
    if (d.mode === "live") {
      d.emitLive(text, key);
    } else {
      d.writeEvent({
        source: "blocker-text", ts, kind: "notification", severity: "info",
        title: `Would text: ${b.trigger === "permission" ? "approval held" : "critical decision"} in ${project}`.slice(0, 140),
        summary: text, privacy_class: "personal", dedup_key: key,
        meta: { dry_run: true, trigger: b.trigger, away },
      });
    }
    d.log({ ts, key, trigger: b.trigger, project, away, mode: d.mode, outcome: d.mode === "live" ? "sent" : "dry-run", text });
    d.markSeen(key, b);
    return { key, outcome: d.mode === "live" ? "sent" : "dry-run" };
  });
}

/** Counts for the dry-run report (ISC-488): would-send rows in the window, split by trigger. Pure. */
export function report(rows: Array<{ ts?: string; trigger?: string; outcome?: string }>, days: number, now = new Date()): { days: number; total: number; permission: number; critical: number; perDay: number } {
  const since = now.getTime() - days * 86_400_000;
  const hits = rows.filter((r) => (r.outcome === "dry-run" || r.outcome === "sent") && r.ts && Date.parse(r.ts) >= since);
  const permission = hits.filter((r) => r.trigger === "permission").length;
  return { days, total: hits.length, permission, critical: hits.length - permission, perDay: Math.round((hits.length / days) * 10) / 10 };
}
