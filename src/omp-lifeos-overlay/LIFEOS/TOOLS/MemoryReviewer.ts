#!/usr/bin/env bun
/**
 * @version 1.4.9
 * MemoryReviewer — single-pass autonomic reviewer for the typed-item memory system.
 *
 * LifeOS autonomic memory subsystem, F5.
 *
 * Reads the most recent harness session transcript, extracts the last N
 * user/assistant exchanges, calls Inference.ts (Sonnet, env-scrubbed,
 * subscription-billed) with a single reviewer prompt, parses the JSON output
 * as a flat list of typed items, and routes each item through
 * MemorySystem.add(). The MutationTier classifier inside add() enforces the
 * four-tier mutation boundary at write time.
 *
 * Invoked from hooks/MemoryReviewFire.hook.ts at Stop, when the trigger hook
 * has set pending_review=true (turn count ≥ 8 AND idle ≥ 2 min AND minutes
 * since last review ≥ 30).
 *
 * Single-pass design (revision 2): instead of separate deductive/inductive
 * phases, the model emits a flat list of typed items. The `type` field on each
 * item carries the structural distinction the old two-phase split previously
 * enforced. The reviewer prompt instructs the model to assign types correctly;
 * MemorySystem.add validates types against the registry; MutationTier ensures
 * the write lands at the right tier.
 *
 * CLI:
 *   bun MemoryReviewer.ts review --turns N           (default invocation)
 *   bun MemoryReviewer.ts review --input <path>      (review a specific transcript)
 *   bun MemoryReviewer.ts review --thread <dir>      (review the principal text thread since its last review)
 *   bun MemoryReviewer.ts review --dry-run           (extract + prompt, no inference)
 *   bun MemoryReviewer.ts test                       (synthetic smoke test)
 *   bun MemoryReviewer.ts test --live                (real inference smoke — costs subscription)
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { getClaudeDir } from "./Paths"; // public issue #1665 @rogdex24, #1584 @ramazanpolat — aliased resolve sites missed by the 09-03 sweep
import { basename as pathBasename, dirname, join as pathJoin, resolve as pathResolve } from "node:path";

import { add as memoryAdd, sanitizeTypedItemForPersistence, type AddResult } from "./MemorySystem";
import { read as memoryWriterRead, CONSOLIDATE_THRESHOLD, CONSOLIDATION_FLOOR, MEMORY_CAP } from "./MemoryWriter";
import { isKnownType, inferProposalKind, pinProposalTargetFile, type TypedItem } from "./MemoryTypes";
import { inference } from "./Inference";
import { invariant } from "./Invariant";
import { readTextTurn } from "./DeliveredContext";
import { getPrincipalName, getDAName } from "../../hooks/lib/identity";
import { ingestCaptureEnvelope, stripPrivateContent, type CaptureEnvelope } from "./CaptureEnvelope";
import { annotate as annotateEntries } from "./MemoryEntryMeta";
import { replayParked } from "./ParkedReplay";
import {
  applyProposalEdit,
  markProposal,
  logProposalEvent,
} from "../PULSE/lib/memory-proposals";

// ── Constants ──

// A memory review proposes durable changes to the principal's memory, so its run belongs in
// the record: set the shim's per-run bridge gate (claude-shim.md § Hook Bridge Opt-In). The
// shim strips it from grandchildren; the nested inference this tool does stays isolated.
process.env.LIFEOS_BRIDGE = "1";

const CLAUDE_ROOT = getClaudeDir();
const HARNESS_PROJECTS_DIR = pathResolve(getClaudeDir(), "projects");
const RUNS_LOG_PATH = pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/OBSERVABILITY/reviewer-runs.jsonl");
const RUNS_DEBUG_DIR = pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/OBSERVABILITY/reviewer-runs");
const REVIEW_STATE_PATH = pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/OBSERVABILITY/review-state.json");
/** Per principal thread, the last thread message a review consumed (Tex ISA F19, ISC-246). */
const THREAD_CURSOR_PATH = pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/OBSERVABILITY/reviewer-thread-cursor.json");
/** Same per-message cap the transcript path applies, so one long text cannot crowd out the window. */
const MAX_THREAD_MSG_CHARS = 2000;
/** Payloads of items whose MemorySystem.add failed — replayable (public issue #1904, @hjbrandt). */
const FAILED_ITEMS_PATH = pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/OBSERVABILITY/reviewer-failed-items.jsonl");
const REVIEW_CONFIG_PATH = pathResolve(CLAUDE_ROOT, "LIFEOS/USER/CONFIG/memory-review.json");

const DEFAULT_TURNS = 20;
// Curation is heavier than the old additive capture — the reviewer now reads
// the full current memory state plus recent conversation and returns a
// consolidated desired set. Give it a consolidation-tier time budget (120s)
// rather than the old capture-tier 60s. This is the two-tier latency split
// (Honcho: "waking capture" is cheap, "dreaming consolidation" is slow) made
// concrete without a second subprocess.
// 300s (public issue #1907, @xmasyx; confirmed @jacobo-ortiz). History: 120s timed
// out repeatedly on heavy sessions (2026-08-03); 240s held while successes measured
// 50–115s, but by 2026-09 successful runs sit at p90 ~211s / max 234s against that
// wall. This number drifts with cap pressure on the inference carrier, so it is not
// the safety mechanism: the single timeout retry in inferWithTimeoutRetry is what
// bounds the failure rate. Raise it when the successful tail approaches it again.
const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.70;

/**
 * Policy used when memory-review.json exists but cannot be read as a JSON object:
 * nothing auto-applies (every confidence is below Infinity) and every proposal
 * waits in the queue for review. Fails closed.
 */
const FAIL_CLOSED_CONFIG: Record<string, unknown> = {
  confidence_threshold: Number.POSITIVE_INFINITY,
  confidence_threshold_by_kind: {},
};

/**
 * USER/CONFIG/memory-review.json as an object. An absent file reads as {} (the
 * defaults apply). A file that exists but is unreadable, malformed or not an
 * object disables auto-apply instead of restoring the default threshold.
 */
function readReviewConfig(): Record<string, unknown> {
  try {
    if (!existsSync(REVIEW_CONFIG_PATH)) return {};
    const raw: unknown = JSON.parse(readFileSync(REVIEW_CONFIG_PATH, "utf8"));
    if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  } catch { /* fall through to fail-closed */ }
  console.error(`MemoryReviewer: ${REVIEW_CONFIG_PATH} is unreadable or malformed; auto-apply disabled, proposals will queue for review`);
  return FAIL_CLOSED_CONFIG;
}

/**
 * The single auto-apply threshold. ISC-68 / ISC-157: high-confidence proposals auto-apply alongside
 * enqueue; the threshold lives in USER/CONFIG/memory-review.json. Only an ABSENT key falls back to the
 * 0.70 default. A supplied value that is not a non-negative number (a string, NaN, a negative that would
 * auto-apply everything) disables auto-apply instead of restoring the permissive default
 *. +Infinity is the explicit "never" and stays valid.
 */
export function loadConfidenceThreshold(config: Record<string, unknown> = readReviewConfig()): number {
  if (!Object.prototype.hasOwnProperty.call(config, "confidence_threshold")) return DEFAULT_CONFIDENCE_THRESHOLD;
  const v = config.confidence_threshold;
  if (typeof v === "number" && !Number.isNaN(v) && v >= 0) return v;
  console.error(`MemoryReviewer: confidence_threshold ${JSON.stringify(v)} is invalid; auto-apply disabled, proposals will queue for review`);
  return Number.POSITIVE_INFINITY;
}

/** Key a malformed `confidence_threshold_by_kind` maps to null, so no kind auto-applies. */
const EVERY_KIND = "*";

/**
 * Optional per-kind auto-apply thresholds, `confidence_threshold_by_kind` in
 * memory-review.json: proposal kind → number, or null to never auto-apply that kind
 * and queue it for review instead (GHSA-xjxj-cqpp-gf82, @mj-deving; discussion
 * #2229, @Steffen025). A missing map or kind keeps the single threshold. Any value
 * other than a finite non-negative number reads as null, so a malformed entry can only
 * queue more; a supplied map of the wrong shape disables auto-apply for every kind.
 */
export function loadThresholdByKind(config: Record<string, unknown> = readReviewConfig()): ReadonlyMap<string, number | null> {
  const out = new Map<string, number | null>();
  if (!Object.prototype.hasOwnProperty.call(config, "confidence_threshold_by_kind")) return out;
  const map = config.confidence_threshold_by_kind;
  if (map === null || typeof map !== "object" || Array.isArray(map)) {
    console.error("MemoryReviewer: confidence_threshold_by_kind is not an object; auto-apply disabled for every kind");
    out.set(EVERY_KIND, null);
    return out;
  }
  for (const [kind, value] of Object.entries(map)) {
    out.set(kind, typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null);
  }
  return out;
}

/** The confidence a proposal of this kind must reach to auto-apply; null means never. */
export function thresholdForKind(kind: string, fallback: number, byKind: ReadonlyMap<string, number | null>): number | null {
  if (byKind.has(kind)) return byKind.get(kind) ?? null;
  if (byKind.has(EVERY_KIND)) return byKind.get(EVERY_KIND) ?? null;
  return fallback;
}

// ── Conversation extraction ──

interface Exchange {
  user: string;
  assistant: string;
  ts: string;
}

/**
 * Find the most recently-modified .jsonl in any harness project subdir.
 * Returns null if no transcripts exist.
 */
function findMostRecentTranscript(): string | null {
  if (!existsSync(HARNESS_PROJECTS_DIR)) return null;

  let newest: { path: string; mtime: number } | null = null;
  try {
    const projects = readdirSync(HARNESS_PROJECTS_DIR);
    for (const project of projects) {
      const projectDir = pathJoin(HARNESS_PROJECTS_DIR, project);
      let stat: ReturnType<typeof statSync> | null = null;
      try { stat = statSync(projectDir); } catch { continue; }
      if (!stat) continue;
      if (!stat.isDirectory()) continue;

      const files = readdirSync(projectDir);
      for (const file of files) {
        if (!file.endsWith(".jsonl")) continue;
        const full = pathJoin(projectDir, file);
        try {
          const s = statSync(full);
          if (!newest || s.mtimeMs > newest.mtime) {
            newest = { path: full, mtime: s.mtimeMs };
          }
        } catch { /* skip */ }
      }
    }
  } catch { return null; }

  return newest?.path ?? null;
}

/**
 * The Cortex-controlled transcript ingestion boundary: every transcript-derived
 * capture crosses the source-neutral envelope, which strips private spans and
 * binds provenance (source, channel, session, captured_at) to the content.
 */
export function transcriptCaptureEnvelope(transcriptPath: string, ts: string, content: string): CaptureEnvelope {
  return ingestCaptureEnvelope(
    {
      source: "claude",
      channel: "transcript",
      timestamps: { captured_at: ts },
      session_id: pathBasename(transcriptPath, ".jsonl"),
      content,
    },
    (envelope) => envelope,
  );
}

/**
 * Parse a harness session JSONL and return the last N user/assistant exchanges.
 * Each line in the transcript is one event; we collapse to user→assistant pairs.
 * Tool-use blocks and system messages are filtered out — the reviewer only
 * needs the conversational surface.
 */
export function extractRecentExchanges(transcriptPath: string, maxExchanges: number): Exchange[] {
  if (!existsSync(transcriptPath)) return [];

  const lines = readFileSync(transcriptPath, "utf8").split("\n").filter((l) => l.trim().length > 0);
  const events: Array<{ ts: string; role: string; text: string }> = [];

  for (const line of lines) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }

    const role = event?.message?.role ?? event?.role ?? null;
    if (role !== "user" && role !== "assistant") continue;

    const ts = event?.timestamp ?? event?.message?.created_at ?? new Date().toISOString();
    const content = event?.message?.content;
    let text = "";

    if (typeof content === "string") {
      text = content;
    } else if (Array.isArray(content)) {
      // Extract only text blocks; skip tool_use, tool_result, image, etc.
      text = content
        .filter((b: any) => b?.type === "text" && typeof b.text === "string")
        .map((b: any) => b.text)
        .join("\n")
        .trim();
    }

    if (role === "user") text = stripDeliveredContext(text);

    // The transcript is harness-owned and remains byte-untouched. Only the
    // Cortex-controlled copy crosses the privacy boundary — via the capture
    // envelope, so sanitization and provenance are structural, not a bare call.
    text = transcriptCaptureEnvelope(transcriptPath, ts, text).content;
    if (text.trim().length > 0) {
      events.push({ ts, role, text });
    }
  }

  // Walk forward, pair user→assistant. Cap each message so a single giant turn
  // (huge tool dumps, pasted reports) can't blow the inference budget — the
  // reviewer only needs the gist to extract durable facts, not full transcripts.
  // Keeps the curation pass bounded regardless of how large any one turn was.
  const MAX_MSG_CHARS = 2000;
  const cap = (s: string): string =>
    s.length > MAX_MSG_CHARS ? s.slice(0, MAX_MSG_CHARS) + " …[truncated]" : s;
  const exchanges: Exchange[] = [];
  // Every user event since the last reply belongs to this exchange: typed words
  // followed by a pasted-image line or a skill body used to lose the typed words.
  // Consecutive assistant events after a reply are dropped, as before; a trailing
  // user message with no reply yet is not an exchange.
  // public issue #2238, @IvanLeontev-stack
  let pending: string[] = [];
  let pendingTs = "";
  for (const ev of events) {
    if (ev.role === "user") {
      if (pending.length === 0) pendingTs = ev.ts;
      pending.push(ev.text);
    } else if (pending.length > 0) {
      exchanges.push({ user: cap(pending.join("\n")), assistant: cap(ev.text), ts: pendingTs });
      pending = [];
    }
  }

  // Return last N
  return exchanges.slice(-maxExchanges);
}

/** A Tex turn opens with the thread view or the delivered history, and the per-message cap would keep only
 *  that. Keep what the principal texted this turn, plus the message an explicit reply points at so a bare "yes"
 *  keeps its antecedent. The one shared reader decides where the request starts (Tex ISA F17, F19 ISC-233). */
export function stripDeliveredContext(text: string): string {
  const turn = readTextTurn(text);
  return turn.replyTarget ? `(replying to: ${turn.replyTarget})\n${turn.request}` : turn.request;
}

// ── Principal thread log (Tex ISA F19, ISC-246) ──
//
// On the principal's text line every text starts a fresh session, so one session transcript holds one text. The
// thread log (LIFEOS/RELAY/bridge/thread.ts, main/YYYY-MM-DD.jsonl) holds them all, so the reviewer reads every
// principal text since its last run from there. The read takes no lock: the log is append-only and its writer
// fsyncs whole lines, so a torn final line is the only partial state and it is skipped, never truncated.

interface ThreadLine { i: number; kind: string; text: string; date: string; ref?: number; replyTid?: string; tid?: string }

function isThreadLine(value: unknown): value is ThreadLine {
  const v = value as Partial<ThreadLine> | null;
  return !!v && Number.isSafeInteger(v.i) && (v.i as number) >= 0 && typeof v.kind === "string" && typeof v.text === "string" && typeof v.date === "string";
}

/** Every line in the thread log, by id; a torn final line is skipped, never truncated. */
function readThreadLines(dir: string): Map<number, ThreadLine> {
  const main = pathJoin(dir, "main");
  const byId = new Map<number, ThreadLine>();
  if (!existsSync(main)) return byId;
  for (const name of readdirSync(main).filter((f) => f.endsWith(".jsonl")).sort()) {
    const raw = readFileSync(pathJoin(main, name), "utf8");
    const whole = raw.endsWith("\n") ? raw : raw.slice(0, raw.lastIndexOf("\n") + 1);
    for (const line of whole.split("\n")) {
      if (!line) continue;
      let row: unknown;
      try { row = JSON.parse(line); } catch { continue; /* a corrupt line is the bridge's to repair; skip it here */ }
      if (isThreadLine(row)) byId.set(row.i, row);
    }
  }
  return byId;
}

/** Every user and reply line, oldest first; retraction markers are bridge bookkeeping, not words. */
function conversationLines(byId: Map<number, ThreadLine>): ThreadLine[] {
  return [...byId.values()]
    .filter((row) => (row.kind === "user" || row.kind === "reply") && !row.tid?.endsWith("#retracted"))
    .sort((x, y) => x.i - y.i);
}

/** `text` cut into pieces of at most `max` characters, so nothing past a cap is dropped. */
function pieces(text: string, max: number): string[] {
  const out: string[] = [];
  for (let k = 0; k < text.length; k += max) out.push(text.slice(k, k + max));
  return out.length > 0 ? out : [text];
}

/**
 * The thread's exchanges after message `afterId` (null: never reviewed), and the last message id they consume.
 *
 * Nothing the principal texted is skipped (ISC-246): a user text longer than the per-message cap is reviewed whole, as
 * several exchanges, and an exchange (a run of texts and the replies to them) is taken whole or not at all, so the
 * cursor only ever passes text that was reviewed. One exchange larger than `max` on its own is still taken whole when it
 * is first, so the cursor can pass it. A text that replies to a message carries that message's text, resolved by its
 * logged ref or, lazily, by its transport reference (thread.ts replyTid), so a bare "yes" keeps its antecedent.
 *
 * A run with a cursor takes the oldest exchanges up to `max` and the rest waits for the next run. A first run (no cursor)
 * takes a bounded recent window instead, and `skippedThrough` names the last message before it: the caller records
 * that once as the cursor's init, so older history is skipped on purpose and on the record, never silently. Principal
 * texts with no reply yet are left for the next run, so lastId stops before them.
 */
export function threadExchanges(dir: string, afterId: number | null, max: number): { exchanges: Exchange[]; lastId: number | null; skippedThrough: number | null } {
  invariant(Number.isSafeInteger(max) && max > 0, `thread review cap must be a positive integer, got ${max}`);
  const cap = (s: string): string => (s.length > MAX_THREAD_MSG_CHARS ? s.slice(0, MAX_THREAD_MSG_CHARS) + " …[truncated]" : s);
  const sanitize = (line: ThreadLine): string => threadCaptureEnvelope(dir, line).content;
  const byId = readThreadLines(dir);
  const byTid = new Map<string, number>();
  for (const row of byId.values()) if (row.tid !== undefined) byTid.set(row.tid, row.i);
  /** A user text with its reply target's text in front, the way stripDeliveredContext keeps it on the transcript path. */
  const withTarget = (line: ThreadLine): string => {
    const text = sanitize(line);
    const ref = line.ref ?? (line.replyTid === undefined ? undefined : byTid.get(line.replyTid));
    const target = ref === undefined || ref === line.i ? undefined : byId.get(ref);
    return target === undefined ? text : `(replying to: ${cap(sanitize(target))})\n${text}`;
  };
  // One group per exchange; every piece of it is reviewed together.
  const groups: Array<{ exchanges: Exchange[]; start: number; end: number }> = [];
  let users: ThreadLine[] = [];
  let replies: ThreadLine[] = [];
  const flush = (): void => {
    if (users.length > 0 && replies.length > 0) {
      const user = users.map(withTarget).filter((t) => t.trim()).join("\n");
      const assistant = replies.map(sanitize).filter((t) => t.trim()).join("\n");
      if (user) {
        const parts = pieces(user, MAX_THREAD_MSG_CHARS);
        // The reply goes with the last piece: earlier pieces carry the principal's words alone.
        const exchanges = parts.map((part, k) => ({ user: part, assistant: k === parts.length - 1 ? cap(assistant) : "", ts: users[0]!.date }));
        groups.push({ exchanges, start: users[0]!.i, end: replies.at(-1)!.i });
      }
    }
    users = [];
    replies = [];
  };
  for (const line of conversationLines(byId)) {
    if (afterId !== null && line.i <= afterId) continue;
    if (line.kind === "user") {
      if (replies.length > 0) flush();
      users.push(line);
    } else if (users.length > 0) {
      replies.push(line);
    }
  }
  flush();
  const picked: typeof groups = [];
  let size = 0;
  if (afterId === null) {
    for (let k = groups.length - 1; k >= 0; k--) {
      const g = groups[k]!;
      if (picked.length > 0 && size + g.exchanges.length > max) break;
      picked.unshift(g);
      size += g.exchanges.length;
    }
  } else {
    for (const g of groups) {
      if (picked.length > 0 && size + g.exchanges.length > max) break;
      picked.push(g);
      size += g.exchanges.length;
    }
  }
  const skipped = afterId === null && picked.length > 0 && picked[0]!.start > 0 ? picked[0]!.start - 1 : null;
  return { exchanges: picked.flatMap((g) => g.exchanges), lastId: picked.at(-1)?.end ?? null, skippedThrough: skipped };
}

function threadCaptureEnvelope(dir: string, line: ThreadLine): CaptureEnvelope {
  return ingestCaptureEnvelope(
    { source: "textus", channel: "thread", timestamps: { captured_at: line.date }, session_id: pathBasename(dir), content: line.text },
    (envelope) => envelope,
  );
}

/** `init` is written once, by a first run with no cursor: the history before its window was skipped on purpose. */
type ThreadCursors = Record<string, { last_id: number; at: string; init?: { skipped_through: number; at: string; reason: string } }>;

function readThreadCursors(path: string): ThreadCursors {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as ThreadCursors) : {};
  } catch {
    return {}; // an unreadable cursor reviews the newest window again, never the whole thread
  }
}

/** The last thread message id a review consumed, or null when this thread was never reviewed. */
export function readThreadCursor(dir: string, path: string = THREAD_CURSOR_PATH): number | null {
  const id = readThreadCursors(path)[pathBasename(dir)]?.last_id;
  return Number.isSafeInteger(id) && (id as number) >= 0 ? (id as number) : null;
}

/**
 * Record that a review consumed the thread through `lastId`. The cursor only moves forward. `init` is the one-time
 * record a first run writes when it starts at a recent window: the messages through `skippedThrough` were never
 * reviewed, on purpose. It is refused once a cursor exists and kept on every later write.
 */
export function writeThreadCursor(dir: string, lastId: number, path: string = THREAD_CURSOR_PATH, init?: { skippedThrough: number }): void {
  const key = pathBasename(dir);
  invariant(key.length > 0, "thread cursor needs a thread directory");
  invariant(Number.isSafeInteger(lastId) && lastId >= 0, `thread cursor must be a message id, got ${lastId}`);
  const previous = readThreadCursor(dir, path);
  invariant(previous === null || lastId >= previous, `thread cursor would move backwards (${previous} -> ${lastId})`);
  invariant(init === undefined || previous === null, "a thread cursor's init record is written once, by the first run");
  invariant(init === undefined || (Number.isSafeInteger(init.skippedThrough) && init.skippedThrough >= 0 && init.skippedThrough < lastId), "a cursor init must skip only messages before the reviewed window");
  const cursors = readThreadCursors(path);
  const now = new Date().toISOString();
  const kept = cursors[key]?.init;
  cursors[key] = {
    last_id: lastId, at: now,
    ...(init !== undefined
      ? { init: { skipped_through: init.skippedThrough, at: now, reason: "first review started at a bounded recent window; older history was not reviewed" } }
      : kept !== undefined ? { init: kept } : {}),
  };
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(cursors, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  renameSync(tmp, path);
}

// ── Reviewer prompt ──

// Identity resolves at runtime (synchronous + cached in hooks/lib/identity), with
// the same conservative fallbacks renderNames() uses so an un-interviewed install
// never emits a placeholder or an empty name into the prompt.
function safeName(fn: () => string, fallback: string): string {
  try {
    const n = (fn() || "").trim();
    return n.length > 0 && !n.includes("{{") && !n.includes("}}") ? n : fallback;
  } catch {
    return fallback;
  }
}
const PRINCIPAL_NAME = safeName(getPrincipalName, "the principal");
const DA_NAME = safeName(getDAName, "the assistant");

const REVIEWER_SYSTEM_PROMPT = `You are ${DA_NAME}'s Memory Reviewer — a background process that reads recent conversation between ${PRINCIPAL_NAME} and ${DA_NAME}, and extracts durable signal as a flat list of typed items.

Your job is NOT to summarize the conversation. It is to extract items the system should remember going forward.

There are four item types. Output EXACTLY this JSON shape:

{
  "items": [
    {"type": "memory", "actor": "principal" | "assistant", "op": "set", "entries": ["PREFIX: durable fact ~provenance", "..."], "consolidate": true},
    {"type": "idea", "title": "short title", "content": "the idea body", "confidence": 0.0-1.0, "related": [{"slug": "...", "type": "..."}]},
    {"type": "knowledge", "entity_type": "person" | "company" | "research", "name": "...", "content": "...", "confidence": 0.0-1.0, "related": [{"slug": "...", "type": "..."}]},
    {"type": "proposal", "target_kind": "identity" | "style" | "definition" | "canonical-content" | "resume" | "operational-rule" | "projects" | "contacts", "target_file": "absolute path", "edit": "the proposed addition", "confidence": 0.0-1.0, "rationale": "why this"}
  ]
}

TYPE GUIDANCE:

- memory — durable facts about ${PRINCIPAL_NAME} ("principal") or about ${DA_NAME} ("assistant"), stored in a small hot-layer file loaded into EVERY turn. This is CURATION, not appending. You are handed the file's CURRENT entries (see the user message). You return, via op:"set", the FULL desired list for that file — the next state you want. The system REPLACES the file with your list. Whatever you omit is forgotten. This is how memory stays alive: you add, you merge, you supersede, you drop.

  MEMORY CURATION RULES:
  - Emit ONE memory item per actor you want to change, with op:"set" and the complete entries array. Don't emit an item for an actor whose file needs no change.
  - Each entry keeps a prefix: NAME: / ROLE: / RELATION: / PREFERENCE: / RULE: — followed by the fact, then a provenance tag: ~explicit (${PRINCIPAL_NAME} stated it), ~deduced (logical inference from what they stated), or ~inferred (a pattern you noticed). Untagged is read as ~explicit. Example: "PREFERENCE: prefers terse direct responses ~explicit".
  - DECLARATIVE FACTS, NOT DIRECTIVES. Write "PREFERENCE: prefers terse responses ~explicit", NOT "RULE: Always be terse" — a directive gets re-read later as a command. State what is true, not what to do (RULE: is for genuine standing rules ${PRINCIPAL_NAME} set, phrased as facts about their rules).
  - SUPERSEDE, don't stack — but only on evidence. If the principal stated the new fact in this conversation ("works at A" → they say "works at B"), DROP the old entry and write the new one. Never keep both.
  - NEVER RESOLVE A CONFLICT YOU CANNOT SOURCE. If two existing entries disagree and nothing in this conversation settles which is true, you may NOT pick a winner — picking is a guess, and a guess written as ~explicit is later read as "the principal said this". Instead: keep the most recent entry, tag it ~inferred, and say so in your rationale so it can be confirmed. A wrong value at high confidence is far more damaging than an open question. (ported from public PR #1832, @Chuckos)
  - MERGE duplicates. Three entries saying the same thing collapse to one.
  - CAP: ${MEMORY_CAP} entries × 256 chars per file. When the current list is ≥${CONSOLIDATE_THRESHOLD} entries (≥80% full), CONSOLIDATE FIRST — merge related entries and drop the least useful/most stale — BEFORE adding anything new, and set \"consolidate\": true on that item so the write is recognised as a deliberate merge rather than erosion. Set it ONLY then: on an ordinary add it is ignored, and a consolidation may never land below ${CONSOLIDATION_FLOOR} entries. Your returned list MUST be ≤${MEMORY_CAP} entries AND every single entry MUST be ≤256 characters INCLUDING its prefix and provenance tag, or the ENTIRE write is rejected. When merging entries, compress the wording — a merged entry that runs past 256 chars fails the whole run. Count carefully; when in doubt, shorten.
  - Keep the entries that still reduce future steering; drop the ones that have gone stale.
- idea — a captured insight or thought. Has a short title and body. Lives in the knowledge graph as an idea note.
- knowledge — an entity note about a person, company, or research artifact mentioned in the conversation. Carries an entity_type and name. SHOULD include at least one related: link if you can name another entity it relates to. The 8 valid related types are: supports, contradicts, extends, part-of, instance-of, caused-by, preceded-by, related.
- proposal — a proposed edit to a curated context file. ALWAYS specify both target_kind AND target_file. See PROPOSAL SUBTYPES below. Only emit when you've seen strong evidence (across multiple turns or cross-session) of a durable signal. Low confidence queues the proposal for principal review (surfaced via the Pulse dashboard and the inline 🧠 MEMORY line); high confidence (≥0.70) triggers direct silent application.

PROPOSAL SUBTYPES (target_kind → target_file → what to emit):

- identity → LIFEOS/USER/PRINCIPAL/PRINCIPAL_IDENTITY.md OR LIFEOS/USER/DIGITAL_ASSISTANT/DA_IDENTITY.md
  Emit when: ${PRINCIPAL_NAME} reveals a durable identity-level fact about themselves or about how they want ${DA_NAME} to operate.
  Example: {"type":"proposal","target_kind":"identity","target_file":"<absolute path to PRINCIPAL_IDENTITY.md>","edit":"RULE: Always confirm before deploying to production","confidence":0.85,"rationale":"observed across N turns; principal explicitly asked for confirmation gate"}.

- style → LIFEOS/USER/PRINCIPAL/WRITINGSTYLE.md
  Emit when: ${PRINCIPAL_NAME} corrects voice/tone/cadence/word choice in a way that generalizes beyond the moment. Banned vocabulary, preferred constructions, rhythmic preferences.
  Example: edit="BAN: 'underscores' — replace with 'shows' or 'proves'".

- definition → LIFEOS/USER/DEFINITIONS.md
  Emit when: ${PRINCIPAL_NAME} defines a term (their coined concept, a principle's exact meaning, an acronym they use) that future ${DA_NAME} will need to interpret correctly.
  Example: edit="**Deep Block** — a 90-minute notifications-off focus session, the principal's unit of planning".

- canonical-content → LIFEOS/USER/CANONICAL_CONTENT.md
  Emit when: ${PRINCIPAL_NAME} names a piece of content (post, talk, framework) as canonical / pillar / essential to their published body of work.
  Example: edit="- The Foundations essay (2024 blog post) — canonical reference for their core architecture pattern".

- resume → LIFEOS/USER/PRINCIPAL/RESUME.md
  Emit when: ${PRINCIPAL_NAME} mentions a career fact (new role, certification, achievement, year of service) that should land in the resume.
  Example: edit="- Speaking: 2026 industry-conference keynote on their flagship topic".

- operational-rule → LIFEOS/USER/CONFIG/OPERATIONAL_PREFERENCES.md
  Emit when: ${PRINCIPAL_NAME} states an operating directive about HOW ${DA_NAME}/LifeOS should handle a class of work — tooling preference, deployment ritual, repo convention, environment-specific behavior.
  Example: edit="**Ship-it directive** — when ${PRINCIPAL_NAME} says 'ship it' on a Cloudflare repo, deploy AND push to main in one atomic operation".

- projects → LIFEOS/USER/PROJECTS.md
  Emit when: ${PRINCIPAL_NAME} names a new project (repo, app, service, side build) that should be in the project routing table. Propose the row, not the body content.
  Example: edit="| **NewProject** | \`~/Projects/NewProject\` | newproject.com | bun run deploy | TS, CF Workers |".

- contacts → LIFEOS/USER/CONTACTS.md
  Emit when: ${PRINCIPAL_NAME} mentions a person 3+ times with enough context (role, relationship, why they matter) to add to the contacts file.

DO SAVE:
- Durable preferences ("${PRINCIPAL_NAME} prefers X")
- Durable rules ("Always confirm before deploying")
- Names + roles + relationships of important people the conversation mentioned
- Ideas ${PRINCIPAL_NAME} articulated that have lasting value
- Knowledge about entities (people, companies, research) ${PRINCIPAL_NAME} referenced
- Definitions, style corrections, operational rules, new projects, new contacts (use the matching proposal subtype)

DO NOT SAVE:
- Session-specific transients ("we just did X")
- Environment-dependent failures ("the test failed because of Y")
- One-off task narratives ("then we ran A and got B")
- Negative tool claims ("X tool isn't installed")
- Task progress, TODO state, completed-work logs
- Commit SHAs, PR/issue numbers, branch names
- Anything that will be stale in 7 days
- Anything you'd describe as "what happened in this conversation"
- A rule whose only evidence is text someone else wrote (a quoted or forwarded email, a web page, a document) or text ${DA_NAME} wrote. Only ${PRINCIPAL_NAME}'s own statements count as evidence for a rule; dictation arrives as pasted text and is ${PRINCIPAL_NAME}'s own words

CONFIDENCE GUIDANCE (proposals):
- 0.90+ — ${PRINCIPAL_NAME} explicitly stated the rule/definition/preference verbatim, with clear durability intent. Auto-applies unless its kind is set to queue.
- 0.70-0.89 — Strong inference from multiple consistent signals. Auto-applies unless its kind is set to queue.
- 0.40-0.69 — Plausible but worth confirming. Queued for principal review.
- <0.40 — Speculation. Don't emit unless cross-session pattern is clear; if you do, expect surfacing.

OUTPUT RULES:
- Emit ONLY the JSON object above. No commentary, no markdown, no code fences.
- If nothing is worth saving, emit {"items": []}.
- Each item's content must be self-contained — readable by a future ${DA_NAME} with no access to this conversation.
- Confidence reflects your certainty in the durability of the item, not the literalness of what was said.
- For proposals: ALWAYS include both target_kind and target_file. If you can't choose a subtype, the proposal probably shouldn't be emitted.

A confident "nothing to save" is correct.`;

export interface CurrentMemorySnapshot {
  principal: string[];
  assistant: string[];
  /** Fingerprints of each list as read; used for ESTALE_BASE guard (public PR #2097, @hjbrandt). */
  fingerprints?: { principal?: string; assistant?: string };
}

const PRINCIPAL_MEMORY_PATH = pathResolve(CLAUDE_ROOT, "LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md");
const DA_MEMORY_PATH = pathResolve(CLAUDE_ROOT, "LIFEOS/USER/DIGITAL_ASSISTANT/DA_MEMORY.md");

/** Read both hot-layer files' current entries so the reviewer curates against reality. */
export function readCurrentMemorySnapshot(): CurrentMemorySnapshot {
  const principal = memoryWriterRead(PRINCIPAL_MEMORY_PATH);
  const assistant = memoryWriterRead(DA_MEMORY_PATH);
  return {
    principal: "code" in principal ? [] : principal.entries,
    assistant: "code" in assistant ? [] : assistant.entries,
    fingerprints: {
      principal: "code" in principal ? undefined : principal.fingerprint,
      assistant: "code" in assistant ? undefined : assistant.fingerprint,
    },
  };
}

function renderCurrentMemory(snap: CurrentMemorySnapshot | undefined): string[] {
  if (!snap) return [];
  const fmt = (actor: string, rel: string, entries: string[]) => {
    const head = `CURRENT ${actor} MEMORY [${entries.length}/${MEMORY_CAP} entries${entries.length >= CONSOLIDATE_THRESHOLD ? " — ≥80% FULL, CONSOLIDATE BEFORE ADDING (set consolidate:true)" : ""}]:`;
    if (entries.length === 0) return [head, "(empty)", ""];
    // Age and durability come from MemoryEntryMeta, computed deterministically
    // by the writer — never authored here and never written to the file. An
    // entry with no metadata renders bare.
    const annotated = annotateEntries(rel, entries);
    return [head, ...annotated.map((e) => `  ${stripPrivateContent(e)}`).filter((e) => e.trim().length > 0), ""];
  };
  return [
    "── CURRENT MEMORY STATE (curate this — your op:\"set\" REPLACES it) ──",
    "",
    "Each entry may carry ⟨since DATE · survived N⟩ — the date it first entered memory and how many curation passes it has survived. That is READ-ONLY context for deciding what supersedes what and what to drop when consolidating. NEVER copy it into an entry you submit; entry text is the fact alone.",
    "",
    ...fmt("PRINCIPAL", "LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md", snap.principal),
    ...fmt("ASSISTANT", "LIFEOS/USER/DIGITAL_ASSISTANT/DA_MEMORY.md", snap.assistant),
  ];
}

export function buildReviewerUserPrompt(exchanges: Exchange[], currentMemory?: CurrentMemorySnapshot): string {
  const lines = [
    ...renderCurrentMemory(currentMemory),
    `Recent conversation between ${PRINCIPAL_NAME} and ${DA_NAME} (last ` + exchanges.length + " exchanges):",
    "",
  ];
  for (let i = 0; i < exchanges.length; i++) {
    const ex = exchanges[i];
    lines.push(`--- Exchange ${i + 1} (${ex.ts}) ---`);
    lines.push(`${PRINCIPAL_NAME}: ${stripPrivateContent(ex.user)}`);
    lines.push(``);
    lines.push(`${DA_NAME}: ${stripPrivateContent(ex.assistant)}`);
    lines.push(``);
  }
  lines.push("Curate memory (return the full desired list per file you change via op:\"set\") and extract any idea/knowledge/proposal items. Return JSON only.");
  return lines.join("\n");
}

/**
 * Resolve principal and DA identity markers to the installed identity.
 *
 * The release scrubber (ShadowRelease's identity map) rewrites the author's names
 * to these placeholders in every shipped file, so a fresh install's reviewer
 * prompts arrive full of literal `{{…}}` braces that nothing substituted — the
 * model was handed raw placeholders. Substitute them at prompt-build time from the
 * canonical loader (PRINCIPAL_IDENTITY.md core.name / settings.json daidentity.name),
 * guarding against empty or still-braced values with a neutral fallback so an
 * un-interviewed install never leaks a placeholder into the prompt. No-op in the
 * live tree, where the prompt carries real names and no placeholders.
 */
export function renderNames(text: string): string {
  const safe = (fn: () => string, fallback: string): string => {
    try {
      const n = (fn() || "").trim();
      return n.length > 0 && !n.includes("{{") && !n.includes("}}") ? n : fallback;
    } catch {
      return fallback;
    }
  };
  const principal = safe(getPrincipalName, "the principal");
  const assistant = safe(getDAName, "the assistant");
  return text
    .replace(/\{\{\s*PRINCIPAL_NAME\s*\}\}/g, principal)
    .replace(/\{\{\s*DA_NAME\s*\}\}/g, assistant);
}

// ── Output parsing ──

export interface ReviewerOutput {
  items: TypedItem[];
}

/**
 * Parse the inference output as a {items:[...]} JSON envelope. Tolerant of
 * leading/trailing whitespace and stray markdown code fences (some models
 * wrap JSON in ```json…``` despite explicit instructions). Returns parsed
 * items array; on unparseable input returns empty list (logged as malformed).
 */
export function parseReviewerOutput(text: string): { ok: true; output: ReviewerOutput } | { ok: false; error: string; raw: string } {
  const trimmed = text.trim();

  // Strip markdown code fence if present
  const fenced = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  const candidate = fenced ? fenced[1] : trimmed;

  let parsed: any;
  try {
    parsed = JSON.parse(candidate);
  } catch (e: any) {
    return {
      ok: false,
      error: stripPrivateContent(`JSON parse failed: ${e?.message}`),
      raw: stripPrivateContent(candidate).slice(0, 500),
    };
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.items)) {
    return {
      ok: false,
      error: `Expected {items:[...]}, got: ${typeof parsed}`,
      raw: stripPrivateContent(JSON.stringify(parsed)).slice(0, 500),
    };
  }

  const validItems: TypedItem[] = [];
  for (let i = 0; i < parsed.items.length; i++) {
    const item = parsed.items[i];
    if (!item || typeof item !== "object" || !isKnownType(item?.type)) {
      return { ok: false, error: `Reviewer item ${i} has an unknown or missing type`, raw: stripPrivateContent(candidate).slice(0, 500) };
    }
    // Deterministic length clamp for memory entries (2026-08-03): the model under
    // consolidation pressure repeatedly emits merged entries over the 256-char cap
    // even after a corrective retry, killing the whole curation run. Clamp at a
    // word boundary, preserving the trailing provenance tag; the entry gets
    // re-curated (and re-shortened properly) on the next cycle. Normalization
    // happens BEFORE the sanitizer — the sanitizer gate itself is unchanged.
    if ((item as any).type === "memory" && Array.isArray((item as any).entries)) {
      (item as any).entries = (item as any).entries.map((e: unknown) => {
        if (typeof e !== "string" || e.length <= 256) return e;
        const tagMatch = e.match(/\s*(~(?:explicit|deduced|inferred))\s*$/);
        const tag = tagMatch ? ` ${tagMatch[1]}` : "";
        const base = tagMatch ? e.slice(0, tagMatch.index) : e;
        const budget = 256 - tag.length - 1;
        let cut = base.slice(0, budget);
        const lastSpace = cut.lastIndexOf(" ");
        if (lastSpace > budget * 0.6) cut = cut.slice(0, lastSpace);
        return `${cut}…${tag}`;
      });
    }
    const sanitized = sanitizeTypedItemForPersistence(item as TypedItem);
    if (!sanitized.ok) {
      return { ok: false, error: `Reviewer item ${i} is invalid: ${sanitized.message}`, raw: stripPrivateContent(candidate).slice(0, 500) };
    }
    validItems.push(sanitized.item);
  }

  return { ok: true, output: { items: validItems } };
}

// ── Dispatch ──

export interface DispatchSummary {
  total: number;
  by_type: Record<string, number>;
  succeeded: number;
  failed: number;
  failures: Array<{ index: number; type: string; error: string }>;
  /** Deliberate safety-guard refusals (e.g. ESUSPECT_EROSION). Surfaced, NOT failures —
   *  a guard doing its job must not flip the run ok=false and trip memory-health CRITICAL. */
  skipped_guard: number;
  skips: Array<{ index: number; type: string; reason: string }>;
  /** ISC-68 / ISC-157: high-confidence proposals auto-applied alongside enqueue. */
  proposals_auto_applied: number;
  proposals_auto_apply_failed: number;
  /** Where the payloads of failed items were parked, when there were any (public issue #1904, @hjbrandt). */
  failed_items_path?: string;
}

/**
 * Park a failed item's payload so the extraction is recoverable (public issue
 * #1904, @hjbrandt). Before this, a failed MemorySystem.add left only an error
 * string in the summary and the item itself was gone — recovery meant
 * hand-replaying the run's response.parsed.json.
 *
 * Deliberately the smallest shape that satisfies that: one append-only JSONL
 * beside the existing reviewer logs, each line carrying the exact item plus its
 * error, so a later run or a human can replay it straight through
 * MemorySystem.add. No queue, no retry loop, no new lifecycle.
 *
 * Items reaching dispatch have already passed sanitizeTypedItemForPersistence
 * at parse time, and the file lives inside the private MEMORY tree next to
 * reviewer-runs.jsonl, so the payload carries no wider exposure than the run
 * debug records already do. Best-effort: parking must never break a review.
 */
function parkFailedItem(item: TypedItem, index: number, error: string): void {
  try {
    mkdirSync(dirname(FAILED_ITEMS_PATH), { recursive: true });
    appendFileSync(
      FAILED_ITEMS_PATH,
      JSON.stringify({ ts: new Date().toISOString(), index, type: item.type, error, item }) + "\n",
      "utf8",
    );
  } catch { /* best-effort */ }
}

/** A deliberate MemoryWriter safety refusal (net-drop erosion block or stale file), not a pipeline fault. */
function isGuardRefusal(result: AddResult): boolean {
  return !result.ok && /ESUSPECT_EROSION|ESTALE_BASE/.test((result as { message?: string }).message ?? "");
}

export function dispatchItems(
  items: TypedItem[],
  opts: {
    dryRun?: boolean;
    confidenceThreshold?: number;
    confidenceThresholdByKind?: ReadonlyMap<string, number | null>;
    baseFingerprints?: CurrentMemorySnapshot["fingerprints"];
  } = {},
): { summary: DispatchSummary; results: AddResult[] } {
  const summary: DispatchSummary = {
    total: items.length,
    by_type: {},
    succeeded: 0,
    failed: 0,
    failures: [],
    skipped_guard: 0,
    skips: [],
    proposals_auto_applied: 0,
    proposals_auto_apply_failed: 0,
  };
  const results: AddResult[] = [];
  const config = opts.confidenceThreshold === undefined || opts.confidenceThresholdByKind === undefined ? readReviewConfig() : {};
  const defaultThreshold = opts.confidenceThreshold ?? loadConfidenceThreshold(config);
  const thresholdByKind = opts.confidenceThresholdByKind ?? loadThresholdByKind(config);
  const bases: NonNullable<CurrentMemorySnapshot["fingerprints"]> = { ...opts.baseFingerprints };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    summary.by_type[item.type] = (summary.by_type[item.type] || 0) + 1;

    if (opts.dryRun) {
      results.push({ ok: true, type: item.type, path: "(dry-run)", detail: { dry: true } } as AddResult);
      summary.succeeded++;
      continue;
    }

    // Memory sets replace the whole file with a list computed from the snapshot
    // taken before inference; the fingerprint makes the write refuse if the file
    // changed in the meantime. It comes from our own read, never from the model.
    const result = memoryAdd(item, item.type === "memory" ? { expectedFingerprint: bases[item.actor] } : {});
    results.push(result);
    if (result.ok) {
      summary.succeeded++;
      // A second item for the same actor builds on this write's fingerprint, not the old snapshot
      // (public PR #2097, @hjbrandt).
      if (item.type === "memory" && typeof result.detail?.fingerprint === "string") {
        bases[item.actor] = result.detail.fingerprint;
      }

      // ISC-68 / ISC-157: direct-apply branch for high-confidence proposals.
      // The enqueue already landed via MemorySystem.add → pending-proposals.jsonl.
      // For proposals at or above the threshold, ALSO apply the edit to the
      // Tier C target file and transition status pending → auto-applied.
      // This is the orchestrator that was deferred from MemorySystem.add (which
      // is a pure TS module and cannot reach into Claude-side skills).
      // GHSA-hm8c-cj5x-pw2q, @elhoim: rerouted upgrades have no queue row to apply.
      // GHSA-xjxj-cqpp-gf82, @mj-deving: a kind mapped to null never auto-applies.
      const threshold = item.type === "proposal"
        ? thresholdForKind(item.target_kind ?? inferProposalKind(item.target_file), defaultThreshold, thresholdByKind)
        : null;
      if (item.type === "proposal" && result.detail?.status === "queued" && threshold !== null && typeof item.confidence === "number" && item.confidence >= threshold) {
        const proposalId = (result.detail?.id as string | undefined) ?? null;
        // Pin the APPLY target the same way the queue write already does
        // (public PR #1563, @anikinsasha). Without this, the queue row recorded
        // the canonical file while the edit landed on the reviewer's raw path —
        // divergence, not just a drop (public issue #1611, @xmasyx).
        const pinnedTarget = pinProposalTargetFile(
          item.target_kind ?? inferProposalKind(item.target_file),
          item.target_file,
        );
        const applied = pinnedTarget === null
          ? { ok: false as const, reason: `target_file '${item.target_file}' is not an allowed target for its kind` }
          : applyProposalEdit(pinnedTarget, item.edit, {
              ...(proposalId ? { proposalId } : {}),
              ...(item.confidence !== undefined ? { confidence: item.confidence } : {}),
              source: "MemoryReviewer.auto-apply",
            });
        if (applied.ok && proposalId) {
          markProposal(proposalId, {
            status: "auto-applied",
            resolved_at: new Date().toISOString(),
            applied_edit: item.edit,
          });
          logProposalEvent({
            id: proposalId,
            file: item.target_file,
            edit: item.edit,
            confidence: item.confidence,
            status: "auto-applied",
            threshold,
          });
          summary.proposals_auto_applied++;
        } else {
          logProposalEvent({
            id: proposalId,
            file: item.target_file,
            edit: item.edit,
            confidence: item.confidence,
            status: "auto-apply-failed",
            reason: applied.ok ? "missing-id" : applied.reason,
            threshold,
          });
          summary.proposals_auto_apply_failed++;
        }
      }
    } else if (isGuardRefusal(result)) {
      // A safety-guard refusal (ESUSPECT_EROSION — the MemoryWriter blocking a net-drop
      // consolidation) is the guard working, not a pipeline failure. Counting it as `failed`
      // flips the run ok=false and trips the memory-health CRITICAL alert on a correct refusal
      // (same class as the empty-transcript→skipped precedent). Surface it as a skip: the fuller
      // memory set the guard preserved is intact, and retrying with allowDrastic is a human call.
      summary.skipped_guard++;
      summary.skips.push({ index: i, type: item.type, reason: `${result.code}: ${result.message}` });
    } else {
      const error = `${result.code}: ${result.message}`;
      summary.failed++;
      summary.failures.push({ index: i, type: item.type, error });
      // public issue #1904, @hjbrandt — keep the payload, not just the error.
      parkFailedItem(item, i, error);
      summary.failed_items_path = FAILED_ITEMS_PATH;
    }
  }

  return { summary, results };
}

// ── Observability ──

function tsSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * Stamp `last_review_at` when a review actually completes (public PR #2032, @abseg).
 *
 * Only MemoryReviewFire.hook.ts wrote that field, and only at the moment it
 * decided to SPAWN. A review that ran by any other path (a manual run, a retry,
 * a recovery after the hook was suppressed) left the field frozen, so the health
 * check reported the loop stuck while reviewer-runs.jsonl held fresh successes,
 * and `min_minutes_between` (computed from this same field) never counted the
 * completed review, so the hook could spawn a duplicate. "A review finished" is
 * what the field means, so the reviewer is where it belongs. Skipped runs are not
 * reviews and do not stamp. Other keys in the file (the hook's mirror) survive.
 */
export function stampLastReviewAt(row: Record<string, unknown>, statePath: string = REVIEW_STATE_PATH): boolean {
  if (row.ok !== true || row.skipped === true) return false;
  const ts = typeof row.ts === "string" ? row.ts : new Date().toISOString();
  invariant(Number.isFinite(Date.parse(ts)), `last_review_at must be a parseable timestamp, got ${JSON.stringify(ts)}`);
  try {
    let state: Record<string, unknown> = {};
    if (existsSync(statePath)) {
      try { state = JSON.parse(readFileSync(statePath, "utf8")) as Record<string, unknown>; } catch { state = {}; }
    }
    state.last_review_at = ts;
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf8");
    return true;
  } catch { return false; /* best-effort: never fail a review over its own bookkeeping */ }
}

function logRunSummary(row: Record<string, unknown>): void {
  try {
    mkdirSync(dirname(RUNS_LOG_PATH), { recursive: true });
    appendFileSync(RUNS_LOG_PATH, JSON.stringify(row) + "\n", "utf8");
  } catch { /* best-effort */ }
  stampLastReviewAt(row);
}

function writeRunDebug(runId: string, files: Record<string, string>): void {
  try {
    const dir = pathJoin(RUNS_DEBUG_DIR, runId);
    mkdirSync(dir, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(pathJoin(dir, name), content, "utf8");
    }
  } catch { /* best-effort */ }
}

// ── Orchestrator ──

export interface ReviewOptions {
  turns?: number;
  input?: string;
  /** A principal thread directory: review every text since the last run from its log instead of a transcript (ISC-246). */
  thread?: string;
  /** For testing: where the thread cursor lives. */
  cursorPath?: string;
  dryRun?: boolean;
  /** For testing: bypass real inference, return this canned response */
  mockInferenceResponse?: string;
  /** Injectable inference boundary for callers that must verify zero egress. */
  inference?: typeof inference;
  timeoutMs?: number;
}

export interface ReviewResult {
  ok: boolean;
  runId: string;
  transcript: string | null;
  exchanges: number;
  inference_duration_ms: number;
  parse_ok: boolean;
  // A skip is a healthy no-op (nothing to curate — e.g. a just-/clear'ed
  // transcript), NOT a failure. Health checks must not count it as one.
  skipped?: boolean;
  /** Primary inference calls made: 0 on a skip, 1 normally, 2 after a timeout
   *  retry. The parse-correction re-prompt is a different retry and is not
   *  counted (public issue #1907, @xmasyx). */
  attempts: number;
  /** --dry-run: prompts were built and nothing else happened (no inference, no run dir, no ledger row) (public issue #2073, @jacobo-ortiz; PR #2109, @pai-scaffolde). */
  dry_run?: boolean;
  prompt_chars?: { system: number; user: number };
  dispatch_summary?: DispatchSummary;
  error?: string;
}

type InferenceResult = Awaited<ReturnType<typeof inference>>;

/**
 * Run the primary inference once, and once more only when the failure is a
 * timeout (public issue #1907, @xmasyx). A timeout under cap pressure is
 * transient; any other failure is not, so it returns on the first attempt.
 * `call` is injected so the retry is testable without a live carrier.
 */
export async function inferWithTimeoutRetry(call: () => Promise<InferenceResult>): Promise<{ result: InferenceResult; attempts: number }> {
  let result = await call();
  let attempts = 1;
  if (!result.success && /timeout/i.test(String(result.error ?? ""))) {
    result = await call();
    attempts = 2;
  }
  return { result, attempts };
}

export async function review(opts: ReviewOptions = {}): Promise<ReviewResult> {
  const runId = tsSlug();
  const turns = opts.turns ?? DEFAULT_TURNS;
  const inferenceCall = opts.inference ?? inference;

  // 1. Locate the source: the principal thread log when one is named (ISC-246), else a transcript.
  const cursorPath = opts.cursorPath ?? THREAD_CURSOR_PATH;
  const transcript = opts.thread ?? opts.input ?? findMostRecentTranscript();
  if (!transcript) {
    const result: ReviewResult = { ok: true, runId, transcript: null, exchanges: 0, inference_duration_ms: 0, parse_ok: true, skipped: true, attempts: 0, error: "skipped: no transcript available" };
    logRunSummary({ ts: new Date().toISOString(), ...result });
    return result;
  }

  // 2. Extract exchanges
  const threadCursor = opts.thread === undefined ? null : readThreadCursor(opts.thread, cursorPath);
  const fromThread = opts.thread === undefined ? null : threadExchanges(opts.thread, threadCursor, Number.isSafeInteger(turns) && turns > 0 ? turns : DEFAULT_TURNS);
  const exchanges = fromThread ? fromThread.exchanges : extractRecentExchanges(transcript, turns);
  if (exchanges.length === 0) {
    const result: ReviewResult = { ok: true, runId, transcript, exchanges: 0, inference_duration_ms: 0, parse_ok: true, skipped: true, attempts: 0, error: fromThread ? "skipped: no principal texts since the last review" : "skipped: no exchanges extracted (empty or just-cleared transcript)" };
    logRunSummary({ ts: new Date().toISOString(), ...result });
    return result;
  }

  // Writes refused while a memory file disagreed with the ledger come back
  // first, as additions only, so this run curates the state they belong in.
  if (!opts.dryRun) {
    try { replayParked({}); } catch { /* best-effort: a failed replay stays parked for the next run */ }
  }

  // 3. Build prompt — inject CURRENT memory state so the reviewer curates
  //    against reality (the op:"set" path REPLACES, so it must see what's there).
  const snapshot = readCurrentMemorySnapshot();
  // Resolve principal and DA identity markers (present in shipped
  // installs after the release scrubber) to the configured identity before the
  // prompts reach the model. No-op in the live tree.
  const systemPrompt = renderNames(REVIEWER_SYSTEM_PROMPT);
  const userPrompt = renderNames(buildReviewerUserPrompt(exchanges, snapshot));

  // --dry-run stops here: extract + prompt, no inference. It also writes no
  // run directory and no ledger row — CortexHealth reads both as evidence of
  // a real run (an orphaned run dir grades as "timed-out"), so a dry run must
  // leave nothing behind for it to misread (public issue #2073, @jacobo-ortiz; PR #2109, @pai-scaffolde).
  if (opts.dryRun) {
    return {
      ok: true, runId, transcript, exchanges: exchanges.length, inference_duration_ms: 0, parse_ok: true, attempts: 0,
      dry_run: true, prompt_chars: { system: systemPrompt.length, user: userPrompt.length },
    };
  }

  writeRunDebug(runId, {
    "prompt.system.md": systemPrompt,
    "prompt.user.md": userPrompt,
    "transcript.txt": `Source: ${transcript}\nExchanges: ${exchanges.length}\n`,
  });

  // 4. Call inference (or use mock)
  let inferenceOutput: string;
  let inferenceDuration: number;
  let attempts = 0;
  if (opts.mockInferenceResponse !== undefined) {
    inferenceOutput = opts.mockInferenceResponse;
    inferenceDuration = 0;
  } else {
    const startedAt = Date.now();
    // One retry on timeout only (public issue #1907, @xmasyx).
    const { result, attempts: made } = await inferWithTimeoutRetry(() => inferenceCall({
      systemPrompt,
      userPrompt,
      level: "medium",
      expectJson: false,         // we parse ourselves for tolerance
      timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    }));
    attempts = made;
    inferenceDuration = Date.now() - startedAt;
    if (!result.success) {
      const failed: ReviewResult = { ok: false, runId, transcript, exchanges: exchanges.length, inference_duration_ms: inferenceDuration, parse_ok: false, attempts, error: `inference failed: ${result.error}` };
      logRunSummary({ ts: new Date().toISOString(), ...failed });
      return failed;
    }
    inferenceOutput = result.output;
  }
  writeRunDebug(runId, { "response.raw.txt": stripPrivateContent(inferenceOutput) });

  // 5. Parse output — with ONE corrective retry on validation failure. The model
  //    under consolidation pressure repeatedly emits a merged entry over the
  //    256-char cap; a single re-prompt carrying the exact validator error fixes
  //    what prompt-side warnings alone demonstrably did not (2026-08-03 incident:
  //    three consecutive runs failed on entries[N] size).
  let parsed = parseReviewerOutput(inferenceOutput);
  if (!parsed.ok && opts.mockInferenceResponse === undefined) {
    writeRunDebug(runId, { "parse-error-attempt1.txt": stripPrivateContent(`${parsed.error}\n\nRaw:\n${parsed.raw}`) });
    const retryStarted = Date.now();
    const retry = await inferenceCall({
      systemPrompt,
      userPrompt: `${userPrompt}\n\n---\nYOUR PREVIOUS ATTEMPT WAS REJECTED by the validator with this exact error:\n\n  ${parsed.error}\n\nRe-emit the FULL corrected JSON envelope. Fix ONLY what the error names (e.g. shorten the offending entry below 256 characters including its prefix and provenance tag). Change nothing else.`,
      level: "medium",
      expectJson: false,
      timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
    inferenceDuration += Date.now() - retryStarted;
    if (retry.success) {
      inferenceOutput = retry.output;
      writeRunDebug(runId, { "response.raw.retry.txt": stripPrivateContent(inferenceOutput) });
      parsed = parseReviewerOutput(inferenceOutput);
    }
  }
  if (!parsed.ok) {
    writeRunDebug(runId, {
      "parse-error.txt": stripPrivateContent(`${parsed.error}\n\nRaw:\n${parsed.raw}`),
    });
    const failed: ReviewResult = { ok: false, runId, transcript, exchanges: exchanges.length, inference_duration_ms: inferenceDuration, parse_ok: false, attempts, error: `parse failed: ${parsed.error}` };
    logRunSummary({ ts: new Date().toISOString(), ...failed });
    return failed;
  }
  writeRunDebug(runId, { "response.parsed.json": JSON.stringify(parsed.output, null, 2) });

  // 6. Dispatch
  const { summary, results } = dispatchItems(parsed.output.items, { baseFingerprints: snapshot.fingerprints });
  writeRunDebug(runId, {
    "dispatch.log": [
      `Items: ${summary.total} (succeeded=${summary.succeeded} failed=${summary.failed} skipped_guard=${summary.skipped_guard})`,
      `By type: ${JSON.stringify(summary.by_type)}`,
      ...summary.failures.map((f) => `  FAIL [${f.index}] ${f.type}: ${f.error}`),
      ...(summary.failed_items_path ? [`Failed item payloads parked at: ${summary.failed_items_path.replace(CLAUDE_ROOT, "~/.claude")}`] : []),
      ...summary.skips.map((s) => `  SKIP(guard) [${s.index}] ${s.type}: ${s.reason}`),
      `Proposal auto-apply: succeeded=${summary.proposals_auto_applied} failed=${summary.proposals_auto_apply_failed}`,
      "",
      "Per-item results:",
      ...results.map((r, i) => `[${i}] ${r.ok ? "OK " + (r as any).type : "FAIL " + (r as any).code}: ${r.ok ? (r as any).path?.replace(CLAUDE_ROOT, "~/.claude") : (r as any).message}`),
    ].join("\n"),
  });

  // 6.5. Replay-eval recorder (Phase 2, 20260816-cortex-ledger-build): one
  // window = the reviewer's exact inputs (envelope-sanitized exchanges + prior
  // memory snapshot) and outputs (emitted items). A changed reviewer prompt
  // replays the corpus and diffs emissions SET-LEVEL (never byte-diff — the
  // writer is nondeterministic; grade with pass^k via the Assay skill).
  // Restricted data: lives under LIFEOS/USER (release-excluded), ring of 50,
  // and the serialized window passes stripPrivateContent as defense in depth
  // on top of the envelope's structural sanitization.
  try {
    const replayDir = pathResolve(CLAUDE_ROOT, "LIFEOS/USER/CACHE/cortex-replay");
    mkdirSync(replayDir, { recursive: true });
    const window = stripPrivateContent(JSON.stringify({
      ts: new Date().toISOString(),
      run_id: runId,
      transcript_source: transcript,
      exchanges,
      prior_snapshot: snapshot,
      emitted_items: parsed.output.items,
      dispatch_summary: summary,
    }, null, 2));
    writeFileSync(pathJoin(replayDir, `${runId}.json`), window, "utf8");
    const REPLAY_RING = 50;
    const windows = readdirSync(replayDir).filter((f) => f.endsWith(".json")).sort();
    for (const stale of windows.slice(0, Math.max(0, windows.length - REPLAY_RING))) {
      try { rmSync(pathJoin(replayDir, stale)); } catch { /* best-effort */ }
    }
  } catch { /* recorder is corpus-building, never blocks a live review */ }

  // The window is reviewed and dispatched: the thread cursor moves past it. A failed item write is parked for
  // replay (FAILED_ITEMS_PATH), so re-reading the window would only file its items twice.
  // A first run (no cursor) that started past older history records that once, so the skip is on the record (ISC-246).
  if (opts.thread !== undefined && fromThread?.lastId != null) {
    const init = threadCursor === null && fromThread.skippedThrough !== null ? { skippedThrough: fromThread.skippedThrough } : undefined;
    writeThreadCursor(opts.thread, fromThread.lastId, cursorPath, init);
  }

  const writeErrors: string[] = [];
  if (summary.failed > 0) {
    writeErrors.push(
      `dispatch failed for ${summary.failed} item(s)` +
        (summary.failed_items_path ? ` (payloads parked at ${summary.failed_items_path.replace(CLAUDE_ROOT, "~/.claude")})` : ""),
    );
  }
  if (summary.proposals_auto_apply_failed > 0) writeErrors.push(`auto-apply failed for ${summary.proposals_auto_apply_failed} proposal(s)`);
  const result: ReviewResult = {
    ok: writeErrors.length === 0,
    runId,
    transcript,
    exchanges: exchanges.length,
    inference_duration_ms: inferenceDuration,
    parse_ok: true,
    attempts,
    dispatch_summary: summary,
    ...(writeErrors.length === 0 ? {} : { error: writeErrors.join("; ") }),
  };
  logRunSummary({ ts: new Date().toISOString(), ...result });
  return result;
}

// ── CLI ──

function parseArg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0) return fallback;
  return process.argv[i + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function smokeTest(): Promise<number> {
  console.log("MemoryReviewer smoke test starting…");
  let pass = 0, fail = 0;
  const check = (name: string, ok: boolean, detail?: string) => {
    if (ok) { pass++; console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`); }
    else    { fail++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
  };

  // 1. Output parsing — clean JSON
  const p1 = parseReviewerOutput('{"items":[{"type":"memory","actor":"principal","content":"PREFERENCE: terse"}]}');
  check("parse: clean JSON envelope", p1.ok && p1.output.items.length === 1);

  // 2. Output parsing — markdown-fenced JSON
  const p2 = parseReviewerOutput('```json\n{"items":[]}\n```');
  check("parse: markdown-fenced JSON", p2.ok && p2.output.items.length === 0);

  // 3. Output parsing — empty items list
  const p3 = parseReviewerOutput('{"items":[]}');
  check("parse: nothing-to-save", p3.ok && p3.output.items.length === 0);

  // 4. Output parsing — unknown types fail the entire output
  const p4 = parseReviewerOutput('{"items":[{"type":"memory","actor":"principal","content":"X"},{"type":"nonsense","content":"Y"}]}');
  check("parse: unknown-type output rejected", !p4.ok);

  // 5. Output parsing — malformed JSON
  const p5 = parseReviewerOutput('not json at all');
  check("parse: malformed JSON rejected", !p5.ok);

  // 6. Dispatch — dry-run
  const dryItems: TypedItem[] = [
    { type: "memory", actor: "principal", content: "PREFERENCE: smoke dry-run" },
    { type: "idea", title: "Smoke Dry Idea", content: "..." },
  ];
  const { summary: drySum } = dispatchItems(dryItems, { dryRun: true });
  check("dispatch: dry-run skips real writes", drySum.succeeded === 2 && drySum.failed === 0);
  check("dispatch: by-type tally correct", drySum.by_type.memory === 1 && drySum.by_type.idea === 1);

  // 6b. Guard refusals (ESUSPECT_EROSION) classify as skips, never failures — a correct
  // safety refusal must not flip the run ok=false and trip memory-health CRITICAL.
  check("guard: erosion refusal is a skip, not a failure",
    isGuardRefusal({ ok: false, code: "EWRITE_FAILED", message: "MemoryWriter rejected: ESUSPECT_EROSION — op would net-drop 2 entries" } as AddResult) === true &&
    isGuardRefusal({ ok: false, code: "EWRITE_FAILED", message: "disk full" } as AddResult) === false);

  // 7. End-to-end with mocked inference — full pipeline
  const mockResponse = JSON.stringify({
    items: [
      { type: "memory", actor: "principal", content: "PREFERENCE: smoke E2E mock" },
      { type: "proposal", target_file: pathJoin(getClaudeDir(), "LIFEOS/USER/PRINCIPAL/PRINCIPAL_IDENTITY.md"), edit: "RULE: E2E mock", confidence: 0.5, rationale: "smoke" },
    ],
  });

  // Use a synthetic transcript so we don't depend on real harness state
  const synthDir = pathJoin(CLAUDE_ROOT, "LIFEOS/MEMORY/OBSERVABILITY/reviewer-test-synth");
  mkdirSync(synthDir, { recursive: true });
  const synthPath = pathJoin(synthDir, "synth.jsonl");
  writeFileSync(synthPath, [
    JSON.stringify({ timestamp: "2026-05-23T22:30:00Z", message: { role: "user", content: `Hey ${DA_NAME}` } }),
    JSON.stringify({ timestamp: "2026-05-23T22:30:05Z", message: { role: "assistant", content: [{ type: "text", text: `Hey ${PRINCIPAL_NAME}` }] } }),
  ].join("\n"), "utf8");

  const r = await review({
    input: synthPath,
    turns: 5,
    mockInferenceResponse: mockResponse,
  });
  check("E2E: review() returns ok", r.ok, `runId=${r.runId}, exchanges=${r.exchanges}`);
  check("E2E: dispatch ran", r.dispatch_summary !== undefined && r.dispatch_summary.total === 2);
  check("E2E: memory write succeeded", r.dispatch_summary?.by_type.memory === 1);
  check("E2E: proposal enqueue succeeded", r.dispatch_summary?.by_type.proposal === 1);
  check("E2E: zero dispatch failures", r.dispatch_summary?.failed === 0);

  // Cleanup synth transcript + reviewer-runs debug dir for this run
  try {
    const { rmSync } = await import("node:fs");
    rmSync(synthDir, { recursive: true, force: true });
    rmSync(pathJoin(RUNS_DEBUG_DIR, r.runId), { recursive: true, force: true });
  } catch { /* ignore */ }

  // Cleanup synthetic memory entry
  try {
    const { read: mwRead, setEntries: mwSet } = await import("./MemoryWriter");
    const PRINCIPAL_MEMORY_PATH = pathJoin(CLAUDE_ROOT, "LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md");
    const cur = mwRead(PRINCIPAL_MEMORY_PATH);
    if (!("code" in cur)) {
      const cleaned = cur.entries.filter((e) => !e.includes("smoke E2E mock"));
      mwSet(PRINCIPAL_MEMORY_PATH, cleaned, { updatedBy: "smoke-test-cleanup" });
    }
  } catch { /* ignore */ }

  // 8. Real harness transcript — extract some exchanges (read-only probe)
  const realTranscript = findMostRecentTranscript();
  if (realTranscript) {
    const real = extractRecentExchanges(realTranscript, 3);
    check("extract: real harness transcript yields exchanges", real.length > 0, `last 3 of ${realTranscript.split("/").pop()}: ${real.length} exchanges`);
  } else {
    check("extract: harness directory accessible", false, "no transcript found (test environment)");
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail === 0) {
    console.log("✓ MemoryReviewer smoke test PASSED");
    return 0;
  }
  console.error("✗ MemoryReviewer smoke test FAILED");
  return 1;
}

async function main() {
  const cmd = process.argv[2];

  if (cmd === "test") {
    process.exit(await smokeTest());
  }

  if (cmd === "review") {
    const turnsArg = parseArg("--turns");
    const turns = turnsArg ? parseInt(turnsArg, 10) : DEFAULT_TURNS;
    const input = parseArg("--input");
    const thread = parseArg("--thread");
    const dryRun = hasFlag("--dry-run");

    const result = await review({ turns, input, dryRun, ...(thread ? { thread } : {}) });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }

  console.error("Usage: bun MemoryReviewer.ts {test|review [--turns N] [--input <path> | --thread <dir>] [--dry-run]}");
  process.exit(2);
}

if (import.meta.main) {
  main();
}
