import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  copyFile,
  writeFile,
  readFile,
  rm,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
test("voice importer rejects an incomplete pack before writing and accepts all IDs", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "keyboard-island-voices-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of ["scripts", "docs/voices", "public", "pack"])
    await mkdir(path.join(root, dir), { recursive: true });
  await copyFile(
    new URL("../scripts/import-voices.mjs", import.meta.url),
    path.join(root, "scripts/import-voices.mjs"),
  );
  await copyFile(
    new URL("../docs/voices/transcripts.json", import.meta.url),
    path.join(root, "docs/voices/transcripts.json"),
  );
  const command = path.join(root, "scripts/import-voices.mjs"),
    pack = path.join(root, "pack");
  assert.throws(() =>
    execFileSync(process.execPath, [command, pack], { stdio: "pipe" }),
  );
  await assert.rejects(access(path.join(root, "public/voice-clips.js")));
  const transcript = JSON.parse(
    await readFile(path.join(root, "docs/voices/transcripts.json"), "utf8"),
  );
  for (const id of Object.keys(transcript))
    await writeFile(path.join(pack, id + ".mp3"), Buffer.alloc(128));
  execFileSync(process.execPath, [command, pack], { stdio: "pipe" });
  const c = vm.createContext({});
  vm.runInContext(
    (await readFile(path.join(root, "public/voice-clips.js"), "utf8")) +
      ";globalThis.clips=VOICE_CLIPS",
    c,
  );
  assert.equal(Object.keys(c.clips).length, 147);
  assert.equal(c.clips["key-F"].url, "voices/key-F.mp3");
});
