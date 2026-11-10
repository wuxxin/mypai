/**
 * lifeos-hooks-bridge.ts — runs LifeOS Claude-Code hooks inside omp (Oh My Pi).
 *
 * omp does not execute the merged hook registry in <configRoot>/settings.json
 * (Claude Code contract: JSON on stdin, JSON on stdout). This extension shims
 * that contract onto the omp event bus:
 *
 *   omp event              → Claude Code event
 *   ---------------------    -------------------
 *   session_start          → SessionStart
 *   message_start (user)   → UserPromptSubmit  (turn_start carries no payload, so the real
 *                                              prompt is read from the user message)
 *   tool_call              → PreToolUse         (permissionDecision → block/allow)
 *   tool_result            → PostToolUse        (isError → PostToolUseFailure)
 *   turn_end               → Stop
 *   session_shutdown       → SessionEnd
 *   tool_approval_requested→ PermissionRequest  + Notification (notification_type
 *                                              "permission_prompt" — Claude Code fires both for
 *                                              one approval prompt; TabState stamps ⏳ and
 *                                              BlockerText keys on that type)
 *   (synthesized)          → StopFailure        (emitted when a mapped Stop hook exits non-zero;
 *                                              omp has no such event, and the v8 registry's
 *                                              consumers — EventLogger, TabState ❌ stamp — want
 *                                              exactly this signal)
 *   —                      ✗ ConfigChange      (no source: the extension event union in
 *                                              agent/src/extensibility/extensions/types.ts has no
 *                                              settings-change event; `mode_changed` is a harness
 *                                              mode switch, not a config edit. Left unmapped.)
 *
 * Hook output contract:
 *   { "hookSpecificOutput": { "permissionDecision": "allow|deny|ask",
 *                             "permissionDecisionReason": "...",
 *                             "shouldBlockFurtherMessages": bool,
 *                             "additionalContext": "..." } }
 *   - deny  → tool call blocked (fail-closed in headless for "ask")
 *   - additionalContext → queued and injected as a system message before the
 *     next LLM call via the `context` event (replaces Claude Code's implicit
 *     injection). This is what carries memory/rule deltas to the model.
 *
 * Config:
 *   - LIFEOS_CONFIG_ROOT is the harness settings root holding the merged hook
 *     registry (default ~/.claude). v8 merges its slim registry into
 *     <configRoot>/settings.json, so that is where this bridge reads it.
 *   - LIFEOS_DIR is the payload dir (~/.claude/LIFEOS) — used as a legacy
 *     settings location and never as the config root. The `lifeos` alias exports
 *     it, which is why reading settings.json next to it silently found nothing.
 *   - OMP_BRIDGE_SETTINGS pins the registry file explicitly.
 *   - Audit log: silent by default — in the interactive TUI stderr lines pollute
 *     the terminal (2026-11-09). Opt in per surface: OMP_BRIDGE_STDERR=1 writes
 *     every line to stderr prefixed with `lifeos-bridge` for the sandbox-ctl
 *     sidecar's journal (`journalctl --user -u omp.service | grep lifeos-bridge`);
 *     OMP_BRIDGE_LOG=<path> appends JSON lines to a file for probes and tailing.
 *     stdout is never touched (in `omp -p` print mode it carries the model's answer).
 *
 * Every invocation is logged to the audit log. Hook failures are logged and
 * never crash the session. Per-hook timeout 30s.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

const HOME = homedir();
// The payload dir (LIFEOS/) and the harness settings root are two different places.
// v8 installs its registry into <configRoot>/settings.json; LIFEOS_DIR is exported by
// the `lifeos` alias as the payload path, so it must never be treated as the config root.
const PAYLOAD_DIR = process.env.LIFEOS_DIR ?? join(HOME, ".claude", "LIFEOS");
const CONFIG_ROOT = process.env.LIFEOS_CONFIG_ROOT ?? join(HOME, ".claude");
// Resolution order: explicit pin → v8 layout (configRoot/settings.json) → pre-v8 layout.
const SETTINGS_CANDIDATES = [
  process.env.OMP_BRIDGE_SETTINGS,
  join(CONFIG_ROOT, "settings.json"),
  join(PAYLOAD_DIR, "settings.json"),
].filter((p): p is string => typeof p === "string" && p.length > 0);
// Audit log: off by default (interactive TUIs must stay clean). OMP_BRIDGE_STDERR=1
// enables the stderr sink for journal capture under the sidecar unit; OMP_BRIDGE_LOG
// adds a file sink. stdout is left alone — in `omp -p` print mode it carries the answer.
const LOG_PREFIX = "lifeos-bridge";
const LOG_STDERR = process.env.OMP_BRIDGE_STDERR === "1";
const LOG_PATH = process.env.OMP_BRIDGE_LOG;
const PULSE_NOTIFY = "http://127.0.0.1:31337/notify";
const VOICE_ID = process.env.OMP_VOICE_ID ?? "fTtv3eikoepIosk8dTZ5";
const HOOK_TIMEOUT_MS = 30_000;
// Claude Code gives every run a session id, and LifeOS hooks key their state files on it
// (STATE/isa-nudge/<id>.json, memory-inject/<id>.queue.json …). The shim exports
// OMP_SESSION_ID per child so headless runs are attributable; an interactive omp session
// has none and keeps the historical "omp" key. Hardcoded "unknown" put every run's writes
// in one shared file, where parallel sessions overwrote each other. (2026-11-10)
const SESSION_ID = process.env.OMP_SESSION_ID || "omp";

interface HookReg {
  event: string;
  matcher: string;
  command: string;
}

interface HookResult {
  ok: boolean;
  out: string;
  err: string;
  ms: number;
  /** The hook process's exit code, null on timeout. Claude Code reads non-zero as failure —
   *  `ok` used to be "not a timeout", so every failing hook logged success (2026-11-11). */
  exit: number | null;
}

interface HookOutput {
  decision?: string;
  reason?: string;
  context?: string;
  block?: boolean;
}

/** omp tool name → Claude Code tool name (known map; unknown pass through). */
const TOOL_UP: Record<string, string> = {
  bash: "Bash", read: "Read", write: "Write", edit: "Edit", glob: "Glob",
  grep: "Grep", task: "Task", todo: "Todo", ask: "AskUserQuestion",
  web_search: "WebSearch", hub: "Hub", eval: "Eval", lsp: "Lsp",
  debug: "Debug", browser: "Browser", inspect_image: "InspectImage",
};

function log(line: Record<string, unknown>): void {
  const json = JSON.stringify({ ts: new Date().toISOString(), ...line });
  if (LOG_STDERR) {
    try {
      process.stderr.write(`${LOG_PREFIX} ${json}\n`);
    } catch { /* never crash on logging */ }
  }
  if (LOG_PATH) {
    try {
      appendFileSync(LOG_PATH, json + "\n");
    } catch { /* never crash on logging */ }
  }
}

function expand(s: string): string {
  return s.replaceAll("$HOME", HOME).replaceAll("${HOME}", HOME);
}

/** Claude Code matcher: `*` wildcard + `|` alternation (e.g. "Bash|Write|Edit|MultiEdit", "mcp__.*"). */
function matcherToRegex(matcher: string): RegExp {
  if (!matcher || matcher === "*") return /^.*$/;
  const parts = matcher.split("|").map((p) => p.trim()).filter(Boolean);
  const body = parts
    .map((p) => p.split("*").map((seg) => seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*"))
    .join("|");
  return new RegExp(`^(?:${body})$`);
}

function hookName(command: string): string {
  return command.split("/").pop() ?? command;
}

/** Load the hook registry from the first settings file that carries a `hooks` map. */
let registrySource = "";
function parseRegistry(raw: unknown): HookReg[] {
  if (!raw || typeof raw !== "object" || !("hooks" in raw)) return [];
  const hooksMap = raw.hooks;
  if (!hooksMap || typeof hooksMap !== "object") return [];
  const out: HookReg[] = [];
  for (const [ev, entries] of Object.entries(hooksMap)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      // v8 writes `"matcher": ""` for non-tool events; Claude Code treats an empty
      // matcher as match-all. Normalize it to "*" so forEvent() sees these registrations
      // (empty matcher silently dropped every SessionStart/UserPromptSubmit/Stop hook).
      const rawMatcher = "matcher" in entry && typeof entry.matcher === "string" ? entry.matcher.trim() : "";
      const matcher = rawMatcher === "" ? "*" : rawMatcher;
      if (!("hooks" in entry) || !Array.isArray(entry.hooks)) continue;
      for (const hk of entry.hooks) {
        if (!hk || typeof hk !== "object") continue;
        // v8 also registers `type: "http"` guards (Pulse /hooks/skill-guard, /hooks/agent-guard);
        // omp has no native http hook transport, so command hooks are all this bridge can run.
        if (!("type" in hk) || hk.type !== "command") continue;
        if (!("command" in hk) || typeof hk.command !== "string" || !hk.command) continue;
        out.push({ event: ev, matcher, command: expand(hk.command) });
      }
    }
  }
  return out;
}

function loadRegistry(): HookReg[] {
  for (const path of SETTINGS_CANDIDATES) {
    try {
      if (!existsSync(path)) continue;
      const regs = parseRegistry(JSON.parse(readFileSync(path, "utf8")));
      if (regs.length > 0) {
        registrySource = path;
        return regs;
      }
    } catch (e) {
      log({ err: "registry_load_failed", detail: String(e), path });
    }
  }
  log({ err: "registry_not_found", candidates: SETTINGS_CANDIDATES });
  return [];
}

const registry: HookReg[] = loadRegistry();

/** Run one hook: `sh -c <command>` with the CC JSON payload on stdin. */
async function runHook(reg: HookReg, payload: Record<string, unknown>): Promise<HookResult> {
  const t0 = Date.now();
  try {
    const proc = Bun.spawn(["sh", "-c", reg.command], {
      cwd: CONFIG_ROOT,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
    const outP = new Response(proc.stdout).text();
    const errP = new Response(proc.stderr).text();
    const exited = await Promise.race([proc.exited, Bun.sleep(HOOK_TIMEOUT_MS).then(() => "timeout" as const)]);
    if (exited === "timeout") proc.kill();
    const [out, err] = await Promise.all([outP, errP]);
    // Claude Code's contract: a non-zero exit is a failed hook (exit 2 blocks). `ok` reported
    // success for any process that exited at all, so a stop hook crashing on a missing file
    // logged ok:true and StopFailure never fired. (2026-11-11)
    const code = typeof exited === "number" ? exited : null;
    return {
      ok: code === 0,
      out,
      err: code === null ? "timeout" : code !== 0 && !err.trim() ? `exit ${code}` : err.slice(0, 300),
      ms: Date.now() - t0,
      exit: code,
    };
  } catch (e) {
    return { ok: false, out: "", err: String(e).slice(0, 300), ms: Date.now() - t0, exit: null };
  }
}

/** Parse CC hook stdout → { permissionDecision, reason, additionalContext, block }. */
function parseOutput(raw: string): HookOutput {
  for (const line of raw.split("\n").reverse()) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try {
      const parsed: unknown = JSON.parse(t);
      if (!parsed || typeof parsed !== "object") continue;
      const maybe = "hookSpecificOutput" in parsed ? parsed.hookSpecificOutput : parsed;
      if (!maybe || typeof maybe !== "object") continue;
      const out = maybe as Record<string, unknown>;
      const context = "additionalContext" in out && typeof out.additionalContext === "string" ? out.additionalContext : undefined;
      return {
        decision: "permissionDecision" in out && typeof out.permissionDecision === "string" ? out.permissionDecision : undefined,
        reason: "permissionDecisionReason" in out && typeof out.permissionDecisionReason === "string" ? out.permissionDecisionReason : undefined,
        context,
        block: "shouldBlockFurtherMessages" in out && out.shouldBlockFurtherMessages === true,
      };
    } catch { /* keep scanning */ }
  }
  return {};
}

interface ToolCallInfo {
  name: string;
  input: unknown;
  toolCallId: string;
}

function readToolCall(v: unknown): ToolCallInfo | null {
  if (!v || typeof v !== "object") return null;
  const name = "toolName" in v ? v.toolName : undefined;
  if (typeof name !== "string") return null;
  return {
    name,
    input: "input" in v ? v.input : undefined,
    toolCallId: "toolCallId" in v && typeof v.toolCallId === "string" ? v.toolCallId : "",
  };
}

interface ToolResultInfo {
  name: string;
  input: unknown;
  toolCallId: string;
  isError: boolean;
  content: string;
}

function readToolResult(v: unknown): ToolResultInfo | null {
  if (!v || typeof v !== "object") return null;
  const name = "tool_name" in v && typeof v.tool_name === "string"
    ? v.tool_name
    : "toolName" in v && typeof v.toolName === "string" ? v.toolName : "";
  const isErr = "isError" in v ? v.isError === true : false;
  const contentRaw = "content" in v ? v.content : undefined;
  let contentText: string;
  if (Array.isArray(contentRaw)) {
    contentText = contentRaw
      .map((c: unknown) => {
        if (c && typeof c === "object" && "text" in c && typeof c.text === "string") return c.text;
        return JSON.stringify(c);
      })
      .join("\n");
  } else if (typeof contentRaw === "string") {
    contentText = contentRaw;
  } else {
    contentText = JSON.stringify(contentRaw ?? "");
  }
  return {
    name,
    input: "input" in v ? v.input : undefined,
    toolCallId: "toolCallId" in v && typeof v.toolCallId === "string" ? v.toolCallId : "",
    isError: isErr,
    content: contentText,
  };
}

interface CtxWithUI {
  ui?: { confirm?: (title: string, message: string) => Promise<boolean> };
}

function readCtxUI(v: unknown): CtxWithUI | null {
  return v && typeof v === "object" ? (v as CtxWithUI) : null;
}

// ── transcript mirror ───────────────────────────────────────────────────────
/**
 * Claude Code hands every hook a `transcript_path` — the session's JSONL in CC format.
 * omp has no such file, and its own session JSONL is a different entry model (toolCall
 * blocks inside assistant messages; toolResult entries as siblings). The Stop gates
 * (StopGates → IsaDeployMarkerGate, ISAFoldGate, DeployRegistrationGate) judge deploy
 * and edit evidence from that transcript: with an empty path every one of them fails
 * open, and Vigil fills with "failed open" events.
 *
 * This converts the live branch (`ctx.sessionManager.getBranch()`) into CC-format JSONL
 * under tmpdir and hands its path to Stop/SessionEnd dispatches. The mapping follows
 * the reader contract in hooks/lib (ISAFoldGate.transcriptToolCalls): toolCall →
 * tool_use block on an assistant line; toolResult → user line with a tool_result
 * block; entry-level ISO timestamps (`entryMs` parses `e.timestamp`).
 *
 * Best-effort: returns "" on any failure and the dispatch proceeds as before.
 */
interface BridgeSessionManager {
  getSessionId?: () => string;
  getBranch?: () => unknown[];
}

export function branchToTranscriptLines(branch: unknown[], cwd: string): string[] {
  const lines: string[] = [];
  for (const raw of branch) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, any>;
    if (e.type !== "message" || !e.message || typeof e.message !== "object") continue;
    const role = e.message.role;
    // The entry carries the ISO timestamp the readers parse; fall back to the message's ms.
    const ts = typeof e.timestamp === "string" ? e.timestamp
      : typeof e.message.timestamp === "number" ? new Date(e.message.timestamp).toISOString() : null;
    if (role === "assistant" && Array.isArray(e.message.content)) {
      // toolCall is a content-block type: rename to CC's tool_use, keep id/arguments, and
      // map the tool name through TOOL_UP — the gate readers match on Claude tool names.
      const content = e.message.content.map((b: Record<string, any>) =>
        b && b.type === "toolCall"
          ? { type: "tool_use", id: b.id, name: TOOL_UP[b.name] ?? b.name, input: b.arguments && typeof b.arguments === "object" ? b.arguments : {} }
          : b);
      lines.push(JSON.stringify({ type: "assistant", timestamp: ts, cwd, message: { role: "assistant", content } }));
    } else if (role === "user") {
      const content = e.message.content;
      if (typeof content !== "string" && !Array.isArray(content)) continue;
      lines.push(JSON.stringify({ type: "user", timestamp: ts, cwd, message: { role: "user", content } }));
    } else if (role === "toolResult") {
      // Claude carries results on user entries; the reader pairs them by tool_use_id.
      const id = typeof e.message.toolCallId === "string" ? e.message.toolCallId : "";
      if (!id) continue;
      const content = Array.isArray(e.message.content) ? e.message.content
        : typeof e.message.content === "string" ? e.message.content : [];
      lines.push(JSON.stringify({
        type: "user", timestamp: ts, cwd,
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content, is_error: e.message.isError === true }] },
      }));
    }
    // developer / bashExecution / compaction / custom entries have no CC transcript
    // counterpart the readers consume; they are skipped.
  }
  return lines;
}

function transcriptMirror(ctx: unknown): string {
  try {
    const sm = (ctx as { sessionManager?: BridgeSessionManager } | null | undefined)?.sessionManager;
    if (!sm || typeof sm.getBranch !== "function") return "";
    const lines = branchToTranscriptLines(sm.getBranch(), process.cwd());
    const dir = join(tmpdir(), "lifeos-bridge-transcripts");
    mkdirSync(dir, { recursive: true });
    const sid = typeof sm.getSessionId === "function" ? String(sm.getSessionId() || "") : "";
    const path = join(dir, `${(sid || "session").replace(/[^A-Za-z0-9._-]/g, "_")}.jsonl`);
    writeFileSync(path, lines.length ? lines.join("\n") + "\n" : "");
    return path;
  } catch {
    return "";
  }
}

function forEvent(event: string): HookReg[] {
  // "*" and ".*" are both match-all; an empty matcher is normalized to "*" at parse time.
  return registry.filter((r) => r.event === event && (r.matcher === "*" || r.matcher === ".*"));
}

function forTool(event: string, ccName: string): HookReg[] {
  return registry.filter((r) => r.event === event && matcherToRegex(r.matcher).test(ccName));
}

function toolCcName(name: string): string {
  return TOOL_UP[name] ?? name;
}

let pendingContext: string[] = [];

// Last dispatched UserPromptSubmit text, so omp's per-turn re-emission of the same user
// message fires Claude Code's contract once per submission, not once per model call.
let lastUserPrompt = "";

/** omp-native voice line: the VoiceCompletion hook needs a Claude transcript,
 *  which omp doesn't have — extract the 🗣️ closer from the message that just
 *  completed the turn instead. */
function extractVoiceLine(text: string): string | null {
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    // Accept both `🗣️ <ZEN>:` and `🗣️ ZEN:` — the constitution template's
    // `<DA>` is a placeholder, and TranscriptParser.extractVoiceCompletion
    // accepts both. Angle-bracket-only matching silently dropped every closer
    // written without brackets, so sessions spoke nothing. (2026-08-22)
    const m = lines[i].match(/^🗣️\s*(?:<[^>]{1,32}>|[^:\n]{1,32})\s*:\s*(.+)$/);
    if (m) return m[1].trim();
  }
  return null;
}

/** Extracts plain text from any AgentMessage content shape (string, or blocks with .text).
 *  Role-agnostic: the assistant voice line and a submitted user prompt read the same way. */
function messageText(msg: unknown): string {
  if (!msg || typeof msg !== "object") return "";
  if (!("content" in msg)) return "";
  const content = msg.content;
  if (Array.isArray(content)) {
    return content
      .filter((c: unknown): c is { text?: string } => !!c && typeof c === "object" && "text" in c)
      .map((c) => c.text ?? "")
      .join("\n");
  }
  return typeof content === "string" ? content : "";
}

export default function lifeosBridge(pi: ExtensionAPI): void {
  log({ event: "bridge_init", hooks: registry.length, settings: registrySource || null, configRoot: CONFIG_ROOT });

  pi.on("session_start", async () => {
    log({ event: "session_start" });
    for (const reg of forEvent("SessionStart")) {
      const res = await runHook(reg, {
        session_id: SESSION_ID,
        source: "startup",
        cwd: process.cwd(),
        hook_event_name: "SessionStart",
      });
      const parsed = parseOutput(res.out);
      if (parsed.context) pendingContext.push(parsed.context);
      log({ hook: hookName(reg.command), cc: "SessionStart", ok: res.ok, ms: res.ms, err: res.err || null, context: !!parsed.context });
    }
  });

  // turn_start carries no payload (agent/src/types.ts declares `{ type: "turn_start" }`), so
  // the prompt text is not available there — it was a placeholder for two months and every
  // UserPromptSubmit consumer judged a constant. The user message that follows carries the
  // real text, so dispatch on message_start(role=user): one Claude-shaped submission per
  // submitted prompt, assistant/toolResult messages ignored. (2026-11-10)
  pi.on("turn_start", async () => {
    log({ event: "turn_start" });
  });

  pi.on("message_start", async (event: unknown) => {
    const msg = (event && typeof event === "object" ? (event as Record<string, unknown>).message : null) as Record<string, unknown> | undefined;
    if (!msg || msg.role !== "user") return;
    const prompt = messageText(msg);
    // omp re-emits the pending user messages on every turn of a tool loop, so an
    // unguarded handler fires once per model call (measured: 16 dispatches for one
    // 53-char prompt, which starved PromptProcessing into its 30s timeout). Claude Code
    // fires UserPromptSubmit once per submitted prompt, so repeats of the same text are
    // skipped; a genuinely new submission always differs. (2026-11-10)
    if (!prompt || prompt === lastUserPrompt) return;
    lastUserPrompt = prompt;
    log({ event: "user_message", chars: prompt.length });
    for (const reg of forEvent("UserPromptSubmit")) {
      const res = await runHook(reg, {
        prompt,
        session_id: SESSION_ID,
        cwd: process.cwd(),
        hook_event_name: "UserPromptSubmit",
      });
      const parsed = parseOutput(res.out);
      if (parsed.context) pendingContext.push(parsed.context);
      log({ hook: hookName(reg.command), cc: "UserPromptSubmit", ok: res.ok, ms: res.ms, err: res.err || null, context: !!parsed.context });
    }
  });

  pi.on("tool_call", async (event: unknown, ctx: unknown) => {
    const info = readToolCall(event);
    if (!info) return;
    log({ event: "tool_call", tool: info.name });
    const ccName = toolCcName(info.name);
    for (const reg of forTool("PreToolUse", ccName)) {
      const res = await runHook(reg, {
        tool_name: ccName,
        tool_input: info.input ?? {},
        session_id: SESSION_ID,
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "PreToolUse",
        permission_mode: "default",
        source: "omp",
        tool_use_id: info.toolCallId,
      });
      const parsed = parseOutput(res.out);
      if (parsed.context) pendingContext.push(parsed.context);
      log({ hook: hookName(reg.command), cc: "PreToolUse", tool: info.name, ok: res.ok, ms: res.ms, err: res.err || null, decision: parsed.decision || null, context: !!parsed.context });
      if (parsed.decision === "deny") {
        return { block: true, reason: parsed.reason || `blocked by LifeOS hook ${hookName(reg.command)}` };
      }
      if (parsed.decision === "ask") {
        const ui = readCtxUI(ctx);
        if (ui?.ui?.confirm) {
          const allow = await ui.ui.confirm("LifeOS hook", parsed.reason ?? "allow this tool call?");
          if (!allow) return { block: true, reason: parsed.reason ?? "denied by user" };
        } else {
          // Claude Code headless behavior: ask → deny (fail closed)
          log({ hook: hookName(reg.command), cc: "PreToolUse", tool: info.name, note: "ask→deny (headless)" });
          return { block: true, reason: parsed.reason ?? "ask denied (headless)" };
        }
      }
    }
  });

  pi.on("tool_result", async (event: unknown) => {
    const info = readToolResult(event);
    if (!info) return;
    const ccEvent = info.isError ? "PostToolUseFailure" : "PostToolUse";
    log({ event: "tool_result", tool: info.name, isError: info.isError });
    for (const reg of forTool(ccEvent, toolCcName(info.name))) {
      const res = await runHook(reg, info.isError
        ? {
            tool_name: toolCcName(info.name),
            tool_input: info.input ?? {},
            tool_response_error: info.content,
            session_id: SESSION_ID,
            cwd: process.cwd(),
            hook_event_name: "PostToolUseFailure",
            tool_use_id: info.toolCallId,
          }
        : {
            tool_name: toolCcName(info.name),
            tool_input: info.input ?? {},
            tool_response: info.content,
            tool_response_error: null,
            session_id: SESSION_ID,
            cwd: process.cwd(),
            hook_event_name: "PostToolUse",
            permission_mode: "default",
            source: "omp",
            tool_use_id: info.toolCallId,
          });
      const parsed = parseOutput(res.out);
      if (parsed.context) pendingContext.push(parsed.context);
      log({ hook: hookName(reg.command), cc: ccEvent, tool: info.name, ok: res.ok, ms: res.ms, err: res.err || null, context: !!parsed.context });
    }
  });

  pi.on("turn_end", async (event: { message?: unknown }, ctx: unknown) => {
    log({ event: "turn_end" });
    const mirror = transcriptMirror(ctx);
    for (const reg of forEvent("Stop")) {
      const res = await runHook(reg, {
        stop_hook_active: true,
        transcript_path: mirror,
        cwd: process.cwd(),
        hook_event_name: "Stop",
        session_id: SESSION_ID,
      });
      const parsed = parseOutput(res.out);
      if (parsed.context) pendingContext.push(parsed.context);
      log({ hook: hookName(reg.command), cc: "Stop", ok: res.ok, ms: res.ms, err: res.err || null, context: !!parsed.context });
      // Claude Code's StopFailure = a stop hook failed. omp emits no such event, so synthesize it
      // from the failure this bridge observed; the v8 consumers (EventLogger, TabState's ❌ stamp)
      // read `error` as a string and `session_id`. Guarded on res.ok so a clean Stop never fires.
      if (!res.ok) {
        for (const failReg of forEvent("StopFailure")) {
          const fres = await runHook(failReg, {
            session_id: SESSION_ID,
            cwd: process.cwd(),
            hook_event_name: "StopFailure",
            error: `${hookName(reg.command)} (exit ${res.exit ?? "?"}): ${res.err.trim().split("\n")[0] || "no stderr"}`,
          });
          log({ hook: hookName(failReg.command), cc: "StopFailure", ok: fres.ok, ms: fres.ms, err: fres.err || null, cause: hookName(reg.command) });
        }
      }
    }
    // omp-native voice: VoiceCompletion.hook.ts needs a Claude transcript omp
    // doesn't have. Speak the turn's OWN final message — the old path read the
    // newest session log globally, so with parallel sessions it picked the
    // wrong session's line (or none) and voice silently died. (2026-08-22)
    if (process.env.OMP_VOICE === "0") return;
    const line = extractVoiceLine(messageText(event?.message));
    if (!line) return;
    const t0 = Date.now();
    try {
      const res = await fetch(PULSE_NOTIFY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: line, voice_id: VOICE_ID }),
        signal: AbortSignal.timeout(10_000),
      });
      log({ voice: res.ok ? "sent" : "failed", status: res.status, ms: Date.now() - t0, line: line.slice(0, 40) });
    } catch (e) {
      log({ voice: "failed", err: String(e).slice(0, 120) });
    }
  });

  pi.on("session_shutdown", async (_event: unknown, ctx: unknown) => {
    log({ event: "session_shutdown" });
    const mirror = transcriptMirror(ctx);
    for (const reg of forEvent("SessionEnd")) {
      const res = await runHook(reg, {
        session_id: SESSION_ID,
        transcript_path: mirror,
        cwd: process.cwd(),
        hook_event_name: "SessionEnd",
      });
      const parsed = parseOutput(res.out);
      if (parsed.context) pendingContext.push(parsed.context);
      log({ hook: hookName(reg.command), cc: "SessionEnd", ok: res.ok, ms: res.ms, err: res.err || null, context: !!parsed.context });
    }
  });

  // One omp approval prompt is two Claude Code events: PermissionRequest (TabState stamps the tab
  // ⏳ / "APPROVE: <tool>") and Notification with notification_type "permission_prompt" — which is
  // the only shape BlockerText accepts as a blocker. tool_input has no equivalent in
  // ToolApprovalRequestedEvent, so TabState's permissionDetail() falls back to the tool name; that
  // is its documented behavior for an unknown input, not a degraded stamp. (2026-11-11)
  pi.on("tool_approval_requested", async (event: unknown) => {
    const e = event as Record<string, unknown> | undefined;
    const toolName = typeof e?.toolName === "string" ? toolCcName(e.toolName) : "tool";
    log({ event: "tool_approval_requested", tool: toolName });
    for (const reg of forEvent("PermissionRequest")) {
      const res = await runHook(reg, {
        session_id: SESSION_ID,
        cwd: process.cwd(),
        hook_event_name: "PermissionRequest",
        tool_name: toolName,
        tool_input: {},
        tool_use_id: typeof e?.toolCallId === "string" ? e.toolCallId : undefined,
      });
      log({ hook: hookName(reg.command), cc: "PermissionRequest", tool: toolName, ok: res.ok, ms: res.ms, err: res.err || null });
    }
    const message = typeof e?.reason === "string" && e.reason.trim() ? e.reason.trim() : `Approve ${toolName}?`;
    for (const reg of forEvent("Notification")) {
      const res = await runHook(reg, {
        session_id: SESSION_ID,
        cwd: process.cwd(),
        hook_event_name: "Notification",
        notification_type: "permission_prompt",
        message,
      });
      log({ hook: hookName(reg.command), cc: "Notification", type: "permission_prompt", ok: res.ok, ms: res.ms, err: res.err || null });
    }
  });

  // Inject queued additionalContext (delta blocks, rules) as a system message
  // before the next LLM call — replaces Claude Code's implicit injection.
  pi.on("context", async (event: unknown) => {
    if (pendingContext.length === 0) return;
    const text = pendingContext.join("\n");
    pendingContext = [];
    log({ event: "context_inject", chars: text.length });
    const messages = event && typeof event === "object" && "messages" in event && Array.isArray(event.messages)
      ? [...event.messages]
      : [];
    messages.push({ role: "system", content: [{ type: "text", text }] });
    return { messages };
  });
}
