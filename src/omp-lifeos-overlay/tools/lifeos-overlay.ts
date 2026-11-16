// Build the shadow overlay: copy MOD files (live side) into mypai/src/omp-lifeos-overlay,
// classify rendered-personalization vs real local edits, scan for privacy-sensitive strings.
import { readFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const STOCK_ROOT = "/tmp/lifeos-stock/danielmiessler-LifeOS-fb9aef4/LifeOS";
const LIVE = process.env.HOME + "/.claude";
const OUT = process.env.HOME + "/agent-shared/code/mypai/src/omp-lifeos-overlay";
type Row = { label: string; status: string; bytes?: number };
const rows: Row[] = JSON.parse(readFileSync("/tmp/lifeos-diff-report.json", "utf8"));

// stock path for a live-side label
function stockPath(label: string): string | null {
  if (label.startsWith("LIFEOS/")) return join(STOCK_ROOT, "install/LIFEOS", label.slice(7));
  if (label.startsWith("hooks/")) return join(STOCK_ROOT, "install/hooks", label.slice(6));
  if (label.startsWith("skills/") && !label.startsWith("skills/LifeOS/")) return join(STOCK_ROOT, "install/skills", label.slice(7));
  if (label.startsWith("skills/LifeOS/")) return join(STOCK_ROOT, label.slice(13)); // stock LifeOS/** lives at tarball root
  if (label === "settings.system.json") return join(STOCK_ROOT, "install/settings.system.json");
  if (label.startsWith("CLAUDE.md")) return join(STOCK_ROOT, "install/CLAUDE.template.md");
  return null; // ADD rows have no stock twin
}

const PLACEHOLDER = /\{{1,2}[A-Z0-9_]+(?:\.[A-Z0-9_]+)*\}{1,2}/g; // {{PRINCIPAL_NAME}} and {DA_IDENTITY.NAME} shapes
function isRenderedOnly(stockTxt: string, liveTxt: string): boolean {
  const parts = stockTxt.split(PLACEHOLDER).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`));
  if (parts.length < 2) return false; // no placeholders -> not rendered-class
  return new RegExp("^" + parts.join("[\\s\\S]*?") + "$").test(liveTxt);
}

const mod = rows.filter((r) => r.status === "MOD");
const addAllowlist = ["LIFEOS/TOOLS/OmpHooksBridge.ts", "LIFEOS/DOCUMENTATION/OmpHooksBridge.md"];
const classes: Record<string, string[]> = { rendered: [], edit: [], added: [] };

for (const r of [...mod.map((m) => ({ ...m, kind: "mod" })), ...rows.filter((r) => addAllowlist.includes(r.label)).map((m) => ({ ...m, kind: "add" }))]) {
  const livePath = join(LIVE, r.label.replace(" (rendered from CLAUDE.template.md)", ""));
  if (!existsSync(livePath)) { console.log("skip missing", r.label); continue; }
  mkdirSync(join(OUT, dirname(r.label)), { recursive: true });
  copyFileSync(livePath, join(OUT, r.label));
  if (r.kind === "add") { classes.added.push(r.label); continue; }
  const sp = stockPath(r.label)!;
  const cls = isRenderedOnly(readFileSync(sp, "utf8"), readFileSync(livePath, "utf8")) ? "rendered" : "edit";
  classes[cls].push(r.label);
}

// privacy scan over the copied tree (mypai is public-pushable)
function walkAll(root: string, rel = ""): string[] {
  return existsSync(root) ? readdirSync(join(root, rel), { withFileTypes: true }).flatMap((e) => {
    const r = rel ? join(rel, e.name) : e.name;
    return e.isDirectory() ? walkAll(root, r) : [r];
  }) : [];
}
const privacy: Record<string, string[]> = {};
for (const f of walkAll(OUT)) {
  if (!/\.(md|ts|js|json|css|sh|yaml)$/.test(f)) continue;
  const t = readFileSync(join(OUT, f), "utf8");
  for (const [pat, tag] of [[/Felix/g, "name:Felix"], [/wuxxin/g, "user:wuxxin"], [/\/home\/wuxxin/g, "path:/home/wuxxin"], [/\bsk-[A-Za-z0-9]{16,}/g, "secret:sk-"], [/glm-[A-Za-z0-9]{8,}/g, "model-id"]] as const) {
    if (pat.test(t)) (privacy[tag] ??= []).push(f);
  }
}

console.log(`copied=${mod.length + classes.added.length} rendered=${classes.rendered.length} edit=${classes.edit.length} added=${classes.added.length}`);
console.log(JSON.stringify({ classes, privacy }, null, 1));
await Bun.write("/tmp/lifeos-classes.json", JSON.stringify({ classes, privacy }));
