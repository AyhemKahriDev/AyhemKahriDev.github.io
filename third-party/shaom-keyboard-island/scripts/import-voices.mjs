import { readFile, copyFile, mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const source = process.argv[2];
if (!source) {
  console.error(
    "Usage: node scripts/import-voices.mjs /path/to/authorized-mp3-directory",
  );
  process.exit(1);
}
const transcript = JSON.parse(
  await readFile(path.join(root, "docs/voices/transcripts.json"), "utf8"),
);
const dir = path.resolve(source),
  destination = path.join(root, "public/voices");
// Validate the entire pack before replacing any file. No network calls or TTS services.
for (const [id] of Object.entries(transcript)) {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw Error("Invalid clip ID");
  const info = await stat(path.join(dir, id + ".mp3"));
  if (!info.isFile() || info.size < 128)
    throw Error(`Missing or empty audio: ${id}`);
}
await mkdir(destination, { recursive: true });
for (const [id, clip] of Object.entries(transcript)) {
  await copyFile(
    path.join(dir, id + ".mp3"),
    path.join(destination, id + ".mp3"),
  );
  clip.url = "voices/" + id + ".mp3";
}
await writeFile(
  path.join(root, "public/voice-clips.js"),
  "'use strict';\nconst VOICE_CLIPS=" +
    JSON.stringify(transcript, null, 2) +
    ";\n",
);
console.log(
  `Imported ${Object.keys(transcript).length} clips. Enable voice in the parent settings. Imported MP3s remain git-ignored; verify redistribution rights before sharing them.`,
);
