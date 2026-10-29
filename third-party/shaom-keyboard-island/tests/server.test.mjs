import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

test("static server confines paths and serves correct runtime MIME types", async (t) => {
  const child = spawn(
    process.execPath,
    ["scripts/serve.mjs", "--port", "4191"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  t.after(() => child.kill("SIGTERM"));
  await Promise.race([
    once(child.stdout, "data"),
    new Promise((_, reject) =>
      setTimeout(() => reject(Error("Server did not start")), 5000).unref(),
    ),
  ]);
  const base = "http://127.0.0.1:4191";
  const html = await fetch(base);
  assert.equal(html.status, 200);
  assert.match(await html.text(), /键盘小岛/);
  const head = await fetch(base, { method: "HEAD" });
  assert.equal(await head.text(), "");
  assert(Number(head.headers.get("content-length")) > 0);
  const wasm = await fetch(base + "/vendor/wasm/vision_wasm_internal.wasm", {
    method: "HEAD",
  });
  assert.equal(wasm.headers.get("content-type"), "application/wasm");
  for (const p of ["/package.json", "/.env", "/%2e%2e%2fpackage.json"]) {
    const res = await fetch(base + p);
    assert([403, 404].includes(res.status));
  }
  const post = await fetch(base, { method: "POST" });
  assert.equal(post.status, 405);
});
