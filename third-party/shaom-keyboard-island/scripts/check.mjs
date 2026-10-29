import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
for (const file of await readdir(path.join(root, "public")))
  if (file.endsWith(".js"))
    execFileSync(process.execPath, [
      "--check",
      path.join(root, "public", file),
    ]);
const context = vm.createContext({});
vm.runInContext(
  (await readFile(path.join(root, "public/chapters.js"), "utf8")) +
    ";globalThis.catalog=CHAPTERS;globalThis.worlds=WORLDS",
  context,
);
if (context.catalog.length !== 96 || context.worlds.length !== 16)
  throw Error("Unexpected curriculum size");
const allowed = (k) =>
  /^[A-Z0-9;,./]$/.test(k) ||
  /^SHIFT\+[A-Z]$/.test(k) ||
  ["SPACE", "ENTER", "BACKSPACE"].includes(k);
for (const [id, ch] of context.catalog.entries())
  if (
    ch.id !== id ||
    ch.phases.length !== 3 ||
    !ch.phases.every((p) => p.keys.length && p.keys.every(allowed))
  )
    throw Error(`Invalid chapter ${id}`);
const assets = JSON.parse(
  await readFile(path.join(root, "docs/third-party-assets.json"), "utf8"),
);
for (const asset of assets.files) {
  const b = await readFile(path.join(root, asset.path));
  if (createHash("sha256").update(b).digest("hex") !== asset.sha256)
    throw Error(`Third-party asset changed: ${asset.path}`);
}
const html = await readFile(path.join(root, "public/index.html"), "utf8");
for (const [, src] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (/^https?:/.test(src)) throw Error("Unexpected remote runtime dependency");
  await readFile(path.join(root, "public", src.split("?")[0]));
}
console.log(
  `Checked first-party JavaScript, ${context.catalog.length} chapters and ${assets.files.length} pinned third-party files.`,
);
