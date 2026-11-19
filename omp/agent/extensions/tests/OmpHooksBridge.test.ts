// Behavior tests for the LifeOS hooks bridge. bun test omp/agent/extensions/tests/OmpHooksBridge.test.ts
// Lives in a `tests/` subdirectory, not beside the extension: omp's discovery globs `*.{ts,js}` at the top
// level of every extensions dir (discovery/helpers.ts), so a suite there is imported as an extension and
// dies on `Cannot use afterEach() outside of the test runner`. Subdirs load only via index.ts/package.json.
// The module reads its environment at import (OMP_BRIDGE_SETTINGS, LIFEOS_CONFIG_ROOT, OMP_BRIDGE_LOG),
// so each scenario writes a fixture settings.json + hook commands into a fresh tmpdir and imports the
// extension with a cache-busting query to get an isolated instance. Hook fixtures are shell one-liners:
// `cat >> events.jsonl` records the payload the bridge sent; echo of a JSON line exercises the output parser.

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const EXT = new URL("../OmpHooksBridge.ts", import.meta.url).pathname;

type Handler = (event: unknown, ctx?: unknown) => Promise<unknown> | unknown;

type MockRenderer = (message: unknown, options: { expanded: boolean }, theme: unknown) => { render(width: number): string[] } | undefined;
interface MockCommand { description?: string; handler: (args: string, ctx: unknown) => Promise<void> }

interface MockPi {
  on(event: string, handler: Handler): void;
  sendMessage(message: unknown): void;
  sent: Record<string, unknown>[];
  handlers: Map<string, Handler[]>;
  renderers: Map<string, MockRenderer>;
  commands: Map<string, MockCommand>;
}

function makePi(): MockPi {
  const handlers = new Map<string, Handler[]>();
  const sent: Record<string, unknown>[] = [];
  const renderers = new Map<string, MockRenderer>();
  const commands = new Map<string, MockCommand>();
  return {
    handlers,
    sent,
    renderers,
    commands,
    on(event, handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    sendMessage(message) {
      sent.push(message as Record<string, unknown>);
    },
    registerMessageRenderer(type: string, renderer: MockRenderer) {
      renderers.set(type, renderer);
    },
    registerCommand(name: string, opts: MockCommand) {
      commands.set(name, opts);
    },
  };
}

async function fire(pi: MockPi, event: string, payload: unknown, ctx?: unknown): Promise<unknown> {
  let out: unknown;
  for (const h of pi.handlers.get(event) ?? []) {
    const r = await h(payload, ctx);
    if (r !== undefined) out = r;
  }
  return out;
}

let instance = 0;
const envKeys = ["OMP_BRIDGE_SETTINGS", "LIFEOS_CONFIG_ROOT", "OMP_BRIDGE_LOG", "OMP_SESSION_ID", "OMP_VOICE", "OMP_BRIDGE_STDERR", "OMP_BRIDGE_STATS"];

interface Scenario {
  dir: string;
  logPath: string;
  eventsPath: string;
  load(): Promise<(pi: MockPi) => void>;
  logs(): Record<string, unknown>[];
  events(): Record<string, unknown>[];
}

function scenarioIn(dir: string, settings?: unknown): Scenario {
  const settingsPath = join(dir, "settings.json");
  const logPath = join(dir, "log.jsonl");
  const eventsPath = join(dir, "events.jsonl");
  writeFileSync(settingsPath, JSON.stringify(settings ?? {}));
  return {
    dir,
    logPath,
    eventsPath,
    async load() {
      for (const k of envKeys) delete process.env[k];
      process.env.OMP_BRIDGE_SETTINGS = settingsPath;
      process.env.LIFEOS_CONFIG_ROOT = dir;
      process.env.OMP_BRIDGE_LOG = logPath;
      process.env.OMP_SESSION_ID = "test-session";
      process.env.OMP_VOICE = "0";
      const mod = await import(`${EXT}?instance=${++instance}`);
      return mod.default as (pi: MockPi) => void;
    },
    logs() {
      if (!existsSync(logPath)) return [];
      return readFileSync(logPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    },
    events() {
      if (!existsSync(eventsPath)) return [];
      return readFileSync(eventsPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    },
  };
}

function scenario(settings?: unknown): Scenario {
  return scenarioIn(mkdtempSync(join(tmpdir(), "bridge-test-")), settings);
}

// The Claude Code hook stdout contract: one JSON line with a hookSpecificOutput block.
const echo = (o: Record<string, unknown>) => `echo '${JSON.stringify({ hookSpecificOutput: o })}'`;

// Builds a scenario whose hooks record the payload they receive by appending it to events.jsonl;
// the builder gets that record command so fixtures can compose it with stdout emission.
function fixture(build: (recCmd: string) => Record<string, unknown[]>): Scenario {
  const dir = mkdtempSync(join(tmpdir(), "bridge-test-"));
  return scenarioIn(dir, { hooks: build(`{ cat; echo; } >> ${join(dir, "events.jsonl")}`) });
}

async function bootAndLoad(s: Scenario): Promise<MockPi> {
  const pi = makePi();
  // Dynamic import is the test seam: the extension reads its environment at module top level,
  // and a static import would give one shared instance for all scenarios. The cache-busting
  // query yields an isolated registry/log/pendingContext per test. Static import cannot work.
  await (await s.load())(pi);
  return pi;
}

afterEach(() => {
  for (const k of envKeys) delete process.env[k];
});

describe("registry and init", () => {
  test("bridge_init reports the pinned settings file and hook count; empty matchers normalize to match-all", async () => {
    const s = fixture((ev) => ({ UserPromptSubmit: [{ matcher: "", hooks: [{ type: "command", command: ev }] }] }));
    const pi = await bootAndLoad(s);
    const init = s.logs().find((l) => l.event === "bridge_init");
    expect(init).toBeTruthy();
    expect(init!.settings).toBe(join(s.dir, "settings.json"));
    expect(init!.hooks).toBe(1);
    expect(pi.handlers.has("message_start")).toBe(true);
    // v8 layout: matcher "" must dispatch (the pre-normalization bug silently dropped these).
    await fire(pi, "message_start", { message: { role: "user", content: [{ type: "text", text: "empty-matcher probe" }] } });
    expect(s.events().length).toBe(1);
  });

  test("disabled sentinel registers nothing", async () => {
    const s = scenario("unused");
    for (const k of envKeys) delete process.env[k];
    process.env.OMP_BRIDGE_SETTINGS = "none";
    process.env.OMP_BRIDGE_LOG = s.logPath;
    const mod = await import(`${EXT}?instance=${++instance}`);
    const pi = makePi();
    mod.default(pi);
    expect(pi.handlers.size).toBe(0);
    expect(s.logs().some((l) => l.event === "bridge_disabled")).toBe(true);
  });
});

describe("dispatch semantics", () => {
  test("hooks for one event run concurrently: span is max, not sum (regression: serial loops)", async () => {
    const s = fixture(() => ({ UserPromptSubmit: [{ matcher: "", hooks: [{ type: "command", command: "sleep 0.5" }, { type: "command", command: "sleep 0.5" }] }] }));
    const pi = await bootAndLoad(s);
    const t0 = Date.now();
    await fire(pi, "message_start", { message: { role: "user", content: [{ type: "text", text: "parallel probe" }] } });
    const span = Date.now() - t0;
    const hookLogs = s.logs().filter((l) => l.cc === "UserPromptSubmit");
    expect(hookLogs.length).toBe(2);
    expect(hookLogs.every((l) => l.ok === true)).toBe(true);
    // Serial dispatch is >= 1000ms by construction; allow generous scheduling slack.
    expect(span).toBeLessThan(900);
  });

  test("per-hook timeout from settings.json is honored (seconds), not the 30s fallback", async () => {
    const s = fixture(() => ({ UserPromptSubmit: [{ matcher: "", hooks: [{ type: "command", command: "sleep 3", timeout: 1 }] }] }));
    const pi = await bootAndLoad(s);
    const t0 = Date.now();
    await fire(pi, "message_start", { message: { role: "user", content: [{ type: "text", text: "timeout probe" }] } });
    const hookLog = s.logs().find((l) => l.cc === "UserPromptSubmit");
    expect(hookLog!.ok).toBe(false);
    expect(hookLog!.err).toBe("timeout");
    expect(Number(hookLog!.ms)).toBeGreaterThanOrEqual(700);
    expect(Date.now() - t0).toBeLessThan(2500);
  });

  test("UserPromptSubmit dedups identical re-emissions; new text dispatches", async () => {
    const s = fixture((ev) => ({ UserPromptSubmit: [{ matcher: "", hooks: [{ type: "command", command: ev }] }] }));
    const pi = await bootAndLoad(s);
    const msg = (t: string) => ({ message: { role: "user", content: [{ type: "text", text: t }] } });
    await fire(pi, "message_start", msg("same prompt"));
    await fire(pi, "message_start", msg("same prompt")); // omp re-emits per turn of a tool loop
    expect(s.events().length).toBe(1);
    await fire(pi, "message_start", msg("a genuinely new submission"));
    expect(s.events().length).toBe(2);
  });

  test("session_clear resets the dedup guard: identical text post-clear dispatches again", async () => {
    const s = fixture((ev) => ({ UserPromptSubmit: [{ matcher: "", hooks: [{ type: "command", command: ev }] }] }));
    const pi = await bootAndLoad(s);
    const msg = (t: string) => ({ message: { role: "user", content: [{ type: "text", text: t }] } });
    await fire(pi, "message_start", msg("restart probe"));
    expect(s.events().length).toBe(1);
    expect(pi.handlers.has("session_clear")).toBe(true); // v18.20.2 event
    await fire(pi, "session_clear", { type: "session_clear" });
    await fire(pi, "message_start", msg("restart probe"));
    expect(s.events().length).toBe(2);
  });

  test("Fix A: approval dispatches PermissionRequest only; no Notification double-stamp", async () => {
    const s = fixture((ev) => ({
      PermissionRequest: [{ matcher: "", hooks: [{ type: "command", command: ev }] }],
      Notification: [{ matcher: "", hooks: [{ type: "command", command: ev }] }],
    }));
    const pi = await bootAndLoad(s);
    await fire(pi, "tool_approval_requested", { toolName: "bash", toolCallId: "tc-1", reason: "approve rm?" });
    const evs = s.events();
    expect(evs.length).toBe(1); // #15107 native blocked-reporting makes the text announcement redundant
    const perm = evs[0];
    expect(perm.hook_event_name).toBe("PermissionRequest");
    expect(perm.tool_name).toBe("Bash"); // TOOL_UP mapping reaches the hook payload
    expect(perm.tool_use_id).toBe("tc-1");
  });
});

describe("PreToolUse decisions", () => {
  test("deny wins over ask; the confirm dialog is not opened", async () => {
    const s = fixture((ev) => ({ PreToolUse: [{ matcher: "Bash|Write", hooks: [
      { type: "command", command: echo({ permissionDecision: "ask", permissionDecisionReason: "approve?" }) },
      { type: "command", command: `${echo({ permissionDecision: "deny", permissionDecisionReason: "hard rule" })} && ${ev}`, timeout: 5 },
    ] }] }));
    const pi = await bootAndLoad(s);
    let confirmCalls = 0;
    const ctx = { ui: { confirm: async () => { confirmCalls++; return true; } } };
    const res = await fire(pi, "tool_call", { toolName: "bash", input: { command: "ls" }, toolCallId: "t1" }, ctx);
    expect(res).toEqual({ block: true, reason: "hard rule" });
    expect(confirmCalls).toBe(0);
  });

  test("ask with UI confirm: allow proceeds, deny blocks", async () => {
    const s = fixture(() => ({ PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: echo({ permissionDecision: "ask", permissionDecisionReason: "approve?" }) }] }] }));
    const pi = await bootAndLoad(s);
    let allowed = true;
    const calls: string[] = [];
    const ctx = { ui: { confirm: async (title: string, message: string) => { calls.push(`${title}|${message}`); return allowed; } } };
    const ev = { toolName: "read", input: {}, toolCallId: "t2" };
    expect(await fire(pi, "tool_call", ev, ctx)).toBeUndefined();
    expect(calls).toEqual(["LifeOS hook|approve?"]);
    allowed = false;
    expect(await fire(pi, "tool_call", { ...ev, toolCallId: "t3" }, ctx)).toEqual({ block: true, reason: "approve?" }); // user denial carries the hook's reason forward
  });

  test("headless ask falls closed to deny (Claude Code behavior)", async () => {
    const s = fixture(() => ({ PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: echo({ permissionDecision: "ask", permissionDecisionReason: "needs approval" }) }] }] }));
    const pi = await bootAndLoad(s);
    const res = await fire(pi, "tool_call", { toolName: "bash", input: {}, toolCallId: "t4" }, {});
    expect(res).toEqual({ block: true, reason: "needs approval" });
  });

  test("matcher alternation filters by mapped Claude name; non-matching tools dispatch nothing", async () => {
    const s = fixture((ev) => ({ PreToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: ev }] }] }));
    const pi = await bootAndLoad(s);
    await fire(pi, "tool_call", { toolName: "bash", input: {}, toolCallId: "t5" }, {}); // → Bash: no match
    expect(s.events().length).toBe(0);
    await fire(pi, "tool_call", { toolName: "write", input: {}, toolCallId: "t6" }, {}); // → Write: match
    expect(s.events().length).toBe(1);
  });
});

describe("context injection and failure synthesis", () => {
  test("additionalContext is injected once as a system message, then the queue drains", async () => {
    const s = fixture(() => ({ UserPromptSubmit: [{ matcher: "", hooks: [{ type: "command", command: echo({ additionalContext: "ctx-A" }) }] }] }));
    const pi = await bootAndLoad(s);
    await fire(pi, "message_start", { message: { role: "user", content: [{ type: "text", text: "inject probe" }] } });
    const res = (await fire(pi, "context", { messages: [{ role: "user", content: "hi" }] })) as { messages: Record<string, unknown>[] };
    expect(res.messages.length).toBe(2);
    const sys = res.messages[1];
    expect(sys.role).toBe("system");
    expect((sys.content as Record<string, unknown>[])[0].text).toBe("ctx-A");
    expect(await fire(pi, "context", { messages: [] })).toBeUndefined(); // drained exactly once
  });

  test("a failing Stop hook synthesizes a StopFailure dispatch carrying cause and exit code", async () => {
    const s = fixture((ev) => ({
      Stop: [{ matcher: "", hooks: [{ type: "command", command: "exit 2" }] }],
      StopFailure: [{ matcher: "", hooks: [{ type: "command", command: ev }] }],
    }));
    const pi = await bootAndLoad(s);
    await fire(pi, "turn_end", { message: { role: "assistant", content: [] } }, {});
    const evs = s.events();
    expect(evs.length).toBe(1);
    expect(String(evs[0].error)).toContain("exit 2");
    expect(s.logs().some((l) => l.cc === "StopFailure" && l.cause)).toBe(true);
  });

  test("clean Stop emits no StopFailure", async () => {
    const s = fixture((ev) => ({
      Stop: [{ matcher: "", hooks: [{ type: "command", command: "true" }] }],
      StopFailure: [{ matcher: "", hooks: [{ type: "command", command: ev }] }],
    }));
    const pi = await bootAndLoad(s);
    await fire(pi, "turn_end", { message: { role: "assistant", content: [] } }, {});
    expect(s.events().length).toBe(0);
  });
});

describe("session stats rows (pi.sendMessage + excludeFromContext)", () => {
  test("registry-load row carries customType, display, and the excludeFromContext flag", async () => {
    const s = scenario(); // empty registry: rows must not depend on any hook being present
    const pi = await bootAndLoad(s);
    await fire(pi, "session_start", {});
    expect(pi.sent.length).toBe(1);
    const row = pi.sent[0];
    expect(row.customType).toBe("lifeos-bridge-stats");
    expect(row.display).toBe(true);
    // The payload flag is the contract: honored by runtimes with #19550 (rows never enter model
    // context), ignored by older ones. Asserting it here pins what OUR side sends.
    expect(row.excludeFromContext).toBe(true);
    expect(String(row.content)).toContain("registry loaded");
  });

  test("turn row counts tools and hook blocks; flags stay set", async () => {
    const s = fixture(() => ({ PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: echo({ permissionDecision: "deny" }) }] }] }));
    const pi = await bootAndLoad(s);
    expect(await fire(pi, "tool_call", { toolName: "bash", input: {}, toolCallId: "t9" }, {})).toMatchObject({ block: true });
    await fire(pi, "turn_end", { message: { role: "assistant", content: [{ type: "text", text: "done" }] } }, {});
    const row = pi.sent[pi.sent.length - 1];
    expect(row.customType).toBe("lifeos-bridge-stats");
    expect(row.excludeFromContext).toBe(true);
    expect(String(row.content)).toContain("tools=1 blocked=1");
    // OMP_VOICE=0 (scenario default): the voice column stays "-", no Pulse fetch.
    expect((row.details as Record<string, unknown>).voice).toBe("-");
  });

  test("renderer hides rows by default; /bridge-stats toggles drawing", async () => {
    const s = scenario();
    const pi = await bootAndLoad(s);
    const renderer = pi.renderers.get("lifeos-bridge-stats");
    const cmd = pi.commands.get("bridge-stats");
    expect(renderer).toBeDefined();
    expect(cmd).toBeDefined();
    let notified = "";
    const ctx = { ui: { notify: (m: string) => { notified = m; } } };
    // Default hidden: a zero-line component draws nothing.
    expect(renderer!({ content: "lifeos-bridge · turn 1" }, { expanded: false }, {})!.render(80)).toEqual([]);
    await cmd!.handler("on", ctx);
    expect(notified).toContain("shown");
    const comp = renderer!({ content: "lifeos-bridge · turn 1 · tools=2 blocked=0 ctx=+5c voice=-" }, { expanded: false }, {})!;
    expect(comp.render(80)).toHaveLength(1);
    expect(comp.render(80)[0]).toContain("turn 1");
    expect(comp.render(10)[0].length).toBeLessThanOrEqual(10); // truncates to width
    await cmd!.handler("off", ctx);
    expect(notified).toContain("hidden");
    expect(renderer!({ content: "x" }, { expanded: false }, {})!.render(80)).toEqual([]);
  });

  test("OMP_BRIDGE_STATS=1 starts shown; non-object messages render empty, never throw", async () => {
    const s = scenario("stats-on");
    for (const k of envKeys) delete process.env[k];
    process.env.OMP_BRIDGE_SETTINGS = join(s.dir, "settings.json");
    process.env.LIFEOS_CONFIG_ROOT = s.dir;
    process.env.OMP_BRIDGE_LOG = s.logPath;
    process.env.OMP_VOICE = "0";
    process.env.OMP_BRIDGE_STATS = "1";
    const mod = await import(`${EXT}?instance=${++instance}`);
    const pi = makePi();
    mod.default(pi);
    const renderer = pi.renderers.get("lifeos-bridge-stats")!;
    expect(renderer({ content: "shown from env" }, { expanded: false }, {})!.render(80)[0]).toContain("shown from env");
    expect(renderer(undefined, { expanded: false }, {})!.render(80)).toEqual([""]);
  });
});

describe("transcript mirror (exported pure function)", () => {
  test("branch entries map to Claude transcript lines with tool_result linkage and is_error", async () => {
    const mod = await import(`${EXT}?instance=${++instance}`) as unknown as { branchToTranscriptLines(b: unknown[], cwd: string): string[] };
    const lines = mod.branchToTranscriptLines(
      [
        { type: "message", timestamp: "2026-11-16T00:00:00.000Z", message: { role: "user", content: [{ type: "text", text: "hello" }] } },
        { type: "message", timestamp: "2026-11-16T00:00:01.000Z", message: { role: "assistant", content: [{ type: "toolCall", id: "tu-1", name: "bash", arguments: { command: "ls" } }] } },
        { type: "message", timestamp: "2026-11-16T00:00:02.000Z", message: { role: "toolResult", toolCallId: "tu-1", isError: true, content: [{ type: "text", text: "boom" }] } },
      ],
      "/cwd",
    );
    expect(lines.length).toBe(3);
    const parsed = lines.map((l) => JSON.parse(l));
    const toolUse = parsed.find((p) => p.message?.content?.[0]?.type === "tool_use");
    expect(toolUse.message.content[0]).toEqual({ type: "tool_use", id: "tu-1", name: "Bash", input: { command: "ls" } }); // TOOL_UP reaches the mirror
    const toolResult = parsed.find((p) => p.message?.content?.[0]?.type === "tool_result");
    expect(toolResult.type).toBe("user"); // Claude pairs results onto user entries by tool_use_id
    expect(toolResult.message.content[0].tool_use_id).toBe("tu-1");
    expect(toolResult.message.content[0].is_error).toBe(true);
  });
});
