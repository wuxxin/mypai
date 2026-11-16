// Compare live LifeOS install (~/.claude) against stock release tarball; classify MOD/MISSING/ADD.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const STOCK = "/tmp/lifeos-stock/danielmiessler-LifeOS-fb9aef4/LifeOS";
const LIVE = process.env.HOME + "/.claude"; // symlink -> ~/.omp
const SKILLROOT = join(LIVE, "skills", "LifeOS");

// [stockDir, liveDir, labelPrefix] — label is the path relative to ~/.claude (the shadow layout)
const PAIRS: Array<[string, string, string]> = [
  [join(STOCK, "install/LIFEOS"), join(LIVE, "LIFEOS"), "LIFEOS"],
  [join(STOCK, "install/hooks"), join(LIVE, "hooks"), "hooks"],
  [join(STOCK, "install/skills"), join(LIVE, "skills"), "skills"],
];

const SKIP_DIRS: Record<string, true> = { node_modules: true, ".git": true, ".bin": true };

function walk(root: string, rel = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
    if (e.name in SKIP_DIRS || e.name.endsWith(".db-shm") || e.name.endsWith(".db-wal")) continue;
    const r = rel ? join(rel, e.name) : e.name;
    if (e.isDirectory()) out.push(...walk(root, r));
    else if (e.isFile()) out.push(r);
  }
  return out;
}

function sha(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

type Row = { label: string; status: "MOD" | "MISSING" | "ADD"; bytes?: number };
const rows: Row[] = [];

for (const [stockDir, liveDir, prefix] of PAIRS) {
  const stockFiles = existsSync(stockDir) ? walk(stockDir) : [];
  for (const f of stockFiles) {
    const sPath = join(stockDir, f);
    const lPath = join(liveDir, f);
    const label = `${prefix}/${f}`;
    if (!existsSync(lPath)) { rows.push({ label, status: "MISSING" }); continue; }
    if (sha(sPath) !== sha(lPath)) rows.push({ label, status: "MOD", bytes: statSync(lPath).size });
  }
  // additions on the live side
  const liveFiles = existsSync(liveDir) ? walk(liveDir) : [];
  for (const f of liveFiles) {
    if (!existsSync(join(stockDir, f))) rows.push({ label: `${prefix}/${f}`, status: "ADD", bytes: statSync(join(liveDir, f)).size });
  }
}

// LifeOS skill tree: stock LifeOS/** -> ~/.claude/skills/LifeOS/** (same relative layout)
{
  const stockFiles = walk(STOCK);
  for (const f of stockFiles) {
    if (f.startsWith("install/") && false) continue;
    const sPath = join(STOCK, f), lPath = join(SKILLROOT, f);
    const label = `skills/LifeOS/${f}`;
    if (!existsSync(lPath)) rows.push({ label, status: "MISSING" });
    else if (sha(sPath) !== sha(lPath)) rows.push({ label, status: "MOD", bytes: statSync(lPath).size });
  }
  for (const f of walk(SKILLROOT)) {
    if (!existsSync(join(STOCK, f))) rows.push({ label: `skills/LifeOS/${f}`, status: "ADD", bytes: statSync(join(SKILLROOT, f)).size });
  }
}

// single-file pairs
const FILES: Array<[string, string, string]> = [
  [join(STOCK, "install/settings.system.json"), join(LIVE, "settings.system.json"), "settings.system.json"],
  [join(STOCK, "install/CLAUDE.template.md"), join(LIVE, "CLAUDE.md"), "CLAUDE.md (rendered from CLAUDE.template.md)"],
  [join(STOCK, "install/package.json"), join(LIVE, "package.json"), "package.json"],
];
for (const [s, l, label] of FILES) {
  if (!existsSync(l)) rows.push({ label, status: "MISSING" });
  else if (sha(s) !== sha(l)) rows.push({ label, status: "MOD", bytes: statSync(l).size });
}

const by = (st: string) => rows.filter((r) => r.status === st);
console.log(`MOD=${by("MOD").length} MISSING=${by("MISSING").length} ADD=${by("ADD").length}`);
for (const st of ["MOD", "MISSING", "ADD"] as const) {
  console.log(`\n===== ${st} (${by(st).length}) =====`);
  for (const r of by(st)) console.log(`${r.label}${r.bytes ? ` [${r.bytes}B]` : ""}`);
}
await Bun.write("/tmp/lifeos-diff-report.json", JSON.stringify(rows, null, 1));
