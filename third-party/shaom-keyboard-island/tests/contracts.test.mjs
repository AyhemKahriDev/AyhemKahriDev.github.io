import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import vm from "node:vm";
const load = async (file, extra = {}) => {
  const c = vm.createContext(extra);
  vm.runInContext(
    await readFile(new URL("../public/" + file, import.meta.url), "utf8"),
    c,
  );
  return c;
};
test("stable curriculum IDs, input vocabulary, and original lesson compatibility", async () => {
  const c = await load("chapters.js");
  vm.runInContext("globalThis.catalog=CHAPTERS;globalThis.worlds=WORLDS", c);
  assert.equal(c.catalog.length, 96);
  assert.equal(c.worlds.length, 16);
  assert.equal(new Set(c.catalog.map((x) => x.title)).size, 96);
  let count = 0;
  for (const [id, ch] of c.catalog.entries()) {
    assert.equal(ch.id, id);
    assert.equal(ch.world, Math.floor(id / 6));
    assert.equal(ch.phases.length, 3);
    for (const ph of ch.phases) {
      assert(ph.keys.length > 0);
      for (const k of ph.keys) {
        assert(
          /^[A-Z0-9;,./]$/.test(k) ||
            /^SHIFT\+[A-Z]$/.test(k) ||
            ["SPACE", "BACKSPACE", "ENTER"].includes(k),
        );
        count++;
      }
    }
  }
  assert.equal(count, 1947);
  const expected = (
    await readFile(new URL("./legacy-chapters.sha256", import.meta.url), "utf8")
  ).trim();
  assert.equal(
    createHash("sha256")
      .update(JSON.stringify(c.catalog.slice(0, 36)))
      .digest("hex"),
    expected,
  );
});
test("all decoration IDs and original purchases remain valid", async () => {
  const c = await load("room.js");
  vm.runInContext("globalThis.items=ROOM_ITEMS", c);
  assert.equal(c.items.length, 36);
  assert.equal(new Set(c.items.map((x) => x.id)).size, 36);
  for (const id of ["plant", "rug", "lamp", "telescope", "cake", "piano"])
    assert(c.items.some((x) => x.id === id));
  for (const slot of ["plant", "floor", "light", "window", "table", "toy"])
    assert.equal(c.items.filter((x) => x.slot === slot).length, 6);
  assert(c.items.every((x) => Number.isInteger(x.cost) && x.cost > 0));
});
test("face crop enlarges a small box and keeps the crop inside the frame", async () => {
  const c = await load("face-camera.js");
  vm.runInContext("globalThis.crop=FaceCamera.frameCrop", c);
  for (const box of [
    { originX: 12, originY: 30, width: 25, height: 35 },
    { originX: 0, originY: 0, width: 90, height: 80 },
    { originX: 300, originY: 220, width: 30, height: 40 },
  ]) {
    const p = c.crop(box, 320, 240),
      side = p.size * 240;
    assert(p.size > 0 && p.size <= 1);
    assert(p.x * 320 - side / 2 >= -1e-8);
    assert(p.x * 320 + side / 2 <= 320 + 1e-8);
    assert(p.y * 240 - side / 2 >= -1e-8);
    assert(p.y * 240 + side / 2 <= 240 + 1e-8);
  }
  assert(
    c.crop({ originX: 90, originY: 60, width: 30, height: 35 }, 320, 240).size <
      0.3,
  );
});
test("missing optional recordings neither fetch nor queue speech", async () => {
  let requests = 0;
  const c = await load("voice-clips.js", {
    fetch: () => {
      requests++;
      throw Error("Must not fetch");
    },
    state: { sound: true, voice: true },
    document: { hidden: false },
  });
  vm.runInContext(
    (await readFile(new URL("../public/voice.js", import.meta.url), "utf8")) +
      ";globalThis.director=VoiceDirector;globalThis.clips=VOICE_CLIPS",
    c,
  );
  assert.equal(Object.keys(c.clips).length, 147);
  assert(Object.values(c.clips).every((x) => x.text && x.url === null));
  assert.equal(await c.director.buffer("intro-0"), null);
  c.director.request("intro-0");
  assert.equal(c.director.pending, null);
  assert.equal(requests, 0);
});
