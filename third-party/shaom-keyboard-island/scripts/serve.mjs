import http from "node:http";
import { readFile, stat, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../public", import.meta.url)));
const portFlag = process.argv.indexOf("--port");
const port = Number(
  portFlag < 0 ? process.env.PORT || 4173 : process.argv[portFlag + 1],
);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Choose a port from 1 to 65535.");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".tflite": "application/octet-stream",
  ".mp3": "audio/mpeg",
};
const server = http.createServer(async (req, res) => {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const file = path.resolve(
      root,
      "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname),
    );
    if (
      !file.startsWith(root + path.sep) ||
      pathname.split("/").some((s) => s.startsWith("."))
    ) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    const actual = await realpath(file);
    if (
      !actual.startsWith(root + path.sep) ||
      (await stat(actual)).isDirectory()
    ) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    const bytes = await readFile(actual);
    res.writeHead(200, {
      "Content-Type": mime[path.extname(actual)] || "application/octet-stream",
      "Content-Length": bytes.length,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : bytes);
  } catch (e) {
    res.writeHead(e instanceof URIError ? 400 : 404).end("Not found");
  }
});
server.on("error", (e) => {
  console.error(e.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Keyboard Island: http://127.0.0.1:${port}/`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
