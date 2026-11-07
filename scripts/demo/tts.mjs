/**
 * Narration with the macOS voice, one file per chunk, trimmed and resampled.
 *   node scripts/demo/tts.mjs <outDir> [voice] [rate]
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const [, , OUT, VOICE = "Samantha", RATE = "152"] = process.argv;
const here = path.dirname(fileURLToPath(import.meta.url));
const scenes = JSON.parse(fs.readFileSync(path.join(here, "narration.json"), "utf8"));
fs.mkdirSync(OUT, { recursive: true });
const dur = (f) =>
  parseFloat(
    execFileSync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      f,
    ]).toString(),
  );
let words = 0;
let total = 0;
for (const sc of scenes) {
  sc.chunks.forEach((c, i) => {
    const base = path.join(OUT, `${sc.id}_${i}`);
    execFileSync("say", ["-v", VOICE, "-r", RATE, "-o", base + ".aiff", c.say || c.cap]);
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-i",
      base + ".aiff",
      "-af",
      "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.12,areverse",
      "-ar",
      "48000",
      "-ac",
      "1",
      base + ".wav",
    ]);
    c.dur = dur(base + ".wav");
    c.file = base + ".wav";
    words += (c.say || c.cap).split(/\s+/).length;
    total += c.dur;
  });
  sc.dur = sc.chunks.reduce((a, c) => a + c.dur, 0) + 0.25 * (sc.chunks.length - 1);
  console.log(sc.id, sc.dur.toFixed(2) + "s");
}
console.log(
  "words",
  words,
  "speech",
  total.toFixed(1) + "s",
  "wpm",
  (words / (total / 60)).toFixed(0),
);
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(scenes, null, 2));
