import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { cronMatches, discoverWorkflows, minuteKey } from "../../../../bin/lifeos-workflows-tick.ts";

describe("lifeos-workflows-tick", () => {
  test("cronMatches evaluates standard 5-field expressions", () => {
    const dt = new Date(2026, 10, 23, 3, 15); // Mon 2026-11-23 03:15
    expect(cronMatches("15 3 * * *", dt)).toBe(true);
    expect(cronMatches("*/5 * * * *", dt)).toBe(true);
    expect(cronMatches("*/7 * * * *", dt)).toBe(false);
    expect(cronMatches("15 3 * * 1-5", dt)).toBe(true);
    expect(cronMatches("15 3 * * 0", dt)).toBe(false);
    expect(minuteKey(dt)).toBe("2026-11-23T03:15");
  });

  test("discoverWorkflows loads JSON/YAML and lets user dir override system dir by id", () => {
    const sysDir = mkdtempSync(join(tmpdir(), "wf-sys-"));
    const usrDir = mkdtempSync(join(tmpdir(), "wf-usr-"));
    writeFileSync(join(sysDir, "vigil.json"), JSON.stringify({ id: "vigil-tick", schedule: "*/5 * * * *", enabled: true }));
    writeFileSync(join(usrDir, "vigil.yaml"), "id: vigil-tick\nschedule: '*/10 * * * *'\nenabled: true\ncommand: echo hi\n");
    writeFileSync(join(usrDir, "disabled.json"), JSON.stringify({ id: "off-job", schedule: "* * * * *", enabled: false }));

    const defs = discoverWorkflows([sysDir, usrDir]);
    const byId = new Map(defs.map((d) => [d.id, d]));
    expect(byId.get("vigil-tick")?.schedule).toBe("*/10 * * * *");
    expect(byId.get("vigil-tick")?.command).toBe("echo hi");
    expect(byId.get("off-job")?.enabled).toBe(false);
  });
});
