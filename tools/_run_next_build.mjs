import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const web = path.join(root, "apps", "web");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const node = process.execPath;

const child = spawn(node, [nextBin, "build"], {
  cwd: web,
  env: { ...process.env, NODE_OPTIONS: "--trace-uncaught" },
  stdio: ["ignore", "pipe", "pipe"],
});

function dump(buf, label) {
  const s = buf.toString("utf8");
  if (s.trim()) process.stdout.write(`[${label}] ${s}`);
}

child.stdout.on("data", (d) => dump(d, "out"));
child.stderr.on("data", (d) => dump(d, "err"));

// Also attach rejection logger in this process won't catch child.
// Patch by running next via --import preload if needed.

child.on("exit", (code) => {
  console.log("exit", code);
  process.exit(code ?? 1);
});
