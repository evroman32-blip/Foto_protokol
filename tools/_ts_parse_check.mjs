import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(path.join(process.cwd(), "package.json"));
const ts = require("typescript");

const roots = ["apps/web", "packages/ui"];
const exts = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (exts.has(path.extname(ent.name))) out.push(p);
  }
  return out;
}

function scriptKind(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".ts")) return ts.ScriptKind.TS;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

const files = roots.flatMap((r) => walk(r));
let errors = 0;

for (const file of files) {
  const code = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, scriptKind(file));
  const diags = sf.parseDiagnostics ?? [];
  if (diags.length) {
    errors += 1;
    for (const d of diags) {
      const { line, character } = sf.getLineAndCharacterOfPosition(d.start ?? 0);
      const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      console.log("FILE", file);
      console.log("MSG", msg);
      console.log("LOC", `${line + 1}:${character + 1}`);
      const lines = code.split(/\r?\n/);
      const ln = line + 1;
      for (let i = Math.max(1, ln - 3); i <= Math.min(lines.length, ln + 3); i++) {
        console.log(`${String(i).padStart(4)}| ${lines[i - 1]}`);
      }
      console.log("---");
    }
  }
}

console.log("checked", files.length, "errors", errors);

// Also try Next's bundled babel parser for the exact message
let parse;
try {
  parse = require("./node_modules/next/dist/compiled/babel/parser.js").parse;
} catch {
  try {
    parse = require("next/dist/compiled/babel/parser").parse;
  } catch (e) {
    console.log("babel bundled parser unavailable:", e.message);
    parse = null;
  }
}

if (parse) {
  let berr = 0;
  for (const file of files) {
    const code = fs.readFileSync(file, "utf8");
    const plugins = ["typescript"];
    if (file.endsWith("x")) plugins.push("jsx");
    try {
      parse(code, { sourceType: "module", plugins, errorRecovery: false });
    } catch (err) {
      berr += 1;
      console.log("BABEL_FILE", file);
      console.log("BABEL_MSG", err.message);
      if (err.loc) console.log("BABEL_LOC", `${err.loc.line}:${err.loc.column}`);
      const lines = code.split(/\r?\n/);
      const ln = err.loc?.line ?? 1;
      for (let i = Math.max(1, ln - 3); i <= Math.min(lines.length, ln + 3); i++) {
        console.log(`${String(i).padStart(4)}| ${lines[i - 1]}`);
      }
      console.log("---");
    }
  }
  console.log("babel checked", files.length, "errors", berr);
}
