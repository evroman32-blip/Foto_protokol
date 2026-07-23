import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(path.join(process.cwd(), "package.json"));
const { parse } = require("@babel/parser");

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

const files = roots.flatMap((r) => walk(r));
let errors = 0;

for (const file of files) {
  const code = fs.readFileSync(file, "utf8");
  const plugins = ["typescript"];
  if (file.endsWith("x")) plugins.push("jsx");
  try {
    parse(code, { sourceType: "module", plugins, errorRecovery: false });
  } catch (err) {
    errors += 1;
    console.log("FILE", file);
    console.log("MSG", err.message);
    if (err.loc) console.log("LOC", `${err.loc.line}:${err.loc.column}`);
    const lines = code.split(/\r?\n/);
    const ln = err.loc?.line ?? 1;
    for (let i = Math.max(1, ln - 3); i <= Math.min(lines.length, ln + 3); i++) {
      console.log(`${String(i).padStart(4)}| ${lines[i - 1]}`);
    }
    console.log("---");
  }
}

console.log("checked", files.length, "errors", errors);
