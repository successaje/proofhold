/**
 * Narration, one file per scene, from Gemini's text-to-speech (free on the
 * free tier, a few cents otherwise). Each scene is cached by its text, so a
 * re-run spends nothing, and the free tier's three requests a minute are
 * respected. One voice for the whole film: if a scene cannot be generated
 * the run stops instead of mixing in another engine. Every scene is trimmed,
 * resampled to 48 kHz and levelled to the same loudness.
 *
 *   node scripts/demo/tts.mjs <outDir> [voice]
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
const [, , OUT, VOICE = "Iapetus"] = process.argv;
const here = path.dirname(fileURLToPath(import.meta.url));
const scenes = JSON.parse(fs.readFileSync(path.join(here, "narration.json"), "utf8"));
const CACHE = path.resolve("demo-video/tts-cache");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });
const MODEL = process.env.DEMO_TTS_MODEL ?? "gemini-3.8-flash-lite-tts";
const STYLE =
  "A calm, clear, confident product walkthrough. Warm and unhurried, with natural pauses. Not a sales voice.";
const key = process.env.GEMINI_API_KEY?.trim();

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

async function gemini(text) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": key,
          "Content-Type": "application/json",
          "Api-Revision": "2026-05-20",
        },
        body: JSON.stringify({
          model: MODEL,
          input: [
            {
              type: "user_input",
              content: [
                {
                  type: "text",
                  text,
                  annotations: [{ type: "speech_metadata", style: STYLE }],
                },
              ],
            },
          ],
          response_format: { type: "audio" },
          generation_config: { speech_config: [{ voice: VOICE }] },
          store: false,
        }),
        signal: AbortSignal.timeout(120_000),
      },
    ).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
    if (res.ok) {
      const body = await res.json();
      const audio = (body.steps ?? [])
        .filter((s) => s.type === "model_output")
        .flatMap((s) => s.content ?? [])
        .filter((c) => c.type === "audio")
        .pop();
      if (audio?.data) return Buffer.from(audio.data, "base64");
    }
    const detail = res.ok
      ? "no audio in the reply"
      : `${res.status} ${(await res.text()).slice(0, 160)}`;
    console.warn(`  tts attempt ${attempt + 1} failed: ${detail}`);
    if (/per day/.test(detail)) return null;
    await new Promise((r) => setTimeout(r, 24_000));
  }
  return null;
}

let total = 0;
let words = 0;
let engine = key ? `gemini ${MODEL} · ${VOICE}` : "macOS say · Samantha";
let lastCall = 0;
for (const sc of scenes) {
  const text = sc.text;
  const id = crypto
    .createHash("sha256")
    .update(`${MODEL}|${VOICE}|${STYLE}|${text}`)
    .digest("hex")
    .slice(0, 16);
  const raw = path.join(CACHE, `${sc.id}-${id}.wav`);
  if (!fs.existsSync(raw)) {
    if (!key)
      throw new Error(
        "GEMINI_API_KEY is not set; pass --say to use the macOS voice for every scene.",
      );
    // The free tier allows three requests a minute: space them out.
    const wait = lastCall + 22_000 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const audio = await gemini(text);
    lastCall = Date.now();
    // One voice for the whole film: never mix engines scene by scene.
    if (!audio)
      throw new Error(
        `No audio for scene ${sc.id}. Re-run later (cached scenes are kept) or set DEMO_TTS_MODEL.`,
      );
    fs.writeFileSync(raw, audio);
  }
  const out = path.join(OUT, `${sc.id}.wav`);
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    raw,
    "-af",
    "silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.10,areverse,loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=0.02",
    "-ar",
    "48000",
    "-ac",
    "1",
    out,
  ]);
  sc.file = out;
  sc.dur = dur(out);
  total += sc.dur;
  words += text.split(/\s+/).length;
  console.log(sc.id, sc.dur.toFixed(1), "s");
}
console.log(
  `${engine}: ${words} words, ${total.toFixed(1)}s of speech, ${(words / (total / 60)).toFixed(0)} wpm`,
);
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(scenes, null, 2));
