/**
 * Cuts the recording into scenes by its marks, lays narration and captions
 * over each, and renders the final MP4 and SRT.
 *   node scripts/demo/build.mjs <recDir> <ttsDir> <ovDir> <out.mp4>
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// Absolute paths throughout: ffmpeg resolves concat lists relative to the list file.
const [REC, TTS, OV, OUTFILE] = process.argv.slice(2).map((a) => path.resolve(a));
const W = path.join(path.dirname(OUTFILE), "work");
fs.mkdirSync(W, { recursive: true });
const ff = (args) =>
  execFileSync("ffmpeg", ["-v", "error", "-y", ...args], {
    stdio: ["ignore", "inherit", "inherit"],
  });
const probe = (f) =>
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
const rec = JSON.parse(fs.readFileSync(path.join(REC, "marks.json"), "utf8"));
const VIDEO = path.join(REC, rec.video);
const M = Object.fromEntries(rec.marks.map((m) => [m.n, m.t / 1000]));
const m = (n, d = 0) => {
  if (!(n in M)) throw new Error(`missing mark ${n}`);
  return M[n] + d;
};
const tts = JSON.parse(fs.readFileSync(path.join(TTS, "index.json"), "utf8"));
const scene = (id) => tts.find((s) => s.id === id);
const ENC = [
  "-c:v",
  "libx264",
  "-preset",
  "medium",
  "-crf",
  "18",
  "-pix_fmt",
  "yuv420p",
  "-r",
  "30",
];

// Each scene: video range(s) from the recording; narration is laid from 0.4 s; the scene
// lasts max(video, narration + 0.6 s), holding the last frame when the words run longer.
const scenes = [
  {
    id: "s1",
    clips: [[m("landing", 0.2), m("landing_example", 2.3)]],
    chip: false,
    still: "title",
    stillDur: 3.2,
  },
  {
    id: "s2",
    clips: [
      [m("compose", 0), m("test_shown", 3.1)],
      [m("test_shown", 3.1), m("created", 1.6)],
    ],
  },
  { id: "s3", clips: [[m("buyer_sheet", 0), m("approved", 2.0)]] },
  { id: "s4", clips: [[m("seller_held", 0), m("verdicts", 0)]] },
  { id: "s5", clips: [[m("buyer_decide", 0), m("seal_captured", 0)]] },
  { id: "s6", clips: [[m("ledger", 0), m("record", 3.3)]] },
  { id: "s7", clips: [[m("settings", 0), m("end", 0)]], outro: "outro", outroDur: 4.0 },
];

const parts = [];
const srt = [];
let clock = 0;
let n = 1;
for (const sc of scenes) {
  const nar = scene(sc.id);
  // 1. the raw cut, concatenated
  const cuts = sc.clips.map(([a, b], i) => {
    const f = path.join(W, `${sc.id}_cut${i}.mp4`);
    ff(["-ss", String(a), "-to", String(b), "-i", VIDEO, "-an", ...ENC, f]);
    return f;
  });
  const list = path.join(W, `${sc.id}_list.txt`);
  fs.writeFileSync(list, cuts.map((f) => `file '${f}'`).join("\n"));
  const joined = path.join(W, `${sc.id}_joined.mp4`);
  ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);
  let vdur = probe(joined);
  // 2. narration track for the scene: 0.4 s lead, chunks separated by 0.25 s, 0.6 s tail
  const narStart = sc.still ? sc.stillDur + 0.2 : 0.4;
  let t = narStart;
  const timeline = [];
  for (const c of nar.chunks) {
    timeline.push({ file: c.file, at: t, dur: c.dur, cap: c.cap });
    t += c.dur + 0.25;
  }
  const audioEnd = t + 0.35;
  const stillDur = sc.still ? sc.stillDur : 0;
  const outroDur = sc.outro ? sc.outroDur : 0;
  const total = Math.max(vdur + stillDur + outroDur, audioEnd + outroDur);
  const holdNeeded = total - (vdur + stillDur + outroDur);
  // 3. video: optional title still, the cut (held at its last frame if needed), optional outro
  const segs = [];
  if (sc.still) {
    const f = path.join(W, `${sc.id}_still.mp4`);
    ff([
      "-loop",
      "1",
      "-t",
      String(stillDur),
      "-i",
      path.join(OV, `${sc.still}.png`),
      ...ENC,
      f,
    ]);
    segs.push(f);
  }
  if (holdNeeded > 0.05) {
    const held = path.join(W, `${sc.id}_held.mp4`);
    ff([
      "-i",
      joined,
      "-vf",
      `tpad=stop_mode=clone:stop_duration=${holdNeeded.toFixed(3)}`,
      ...ENC,
      held,
    ]);
    segs.push(held);
  } else segs.push(joined);
  if (sc.outro) {
    const f = path.join(W, `${sc.id}_outro.mp4`);
    ff([
      "-loop",
      "1",
      "-t",
      String(outroDur),
      "-i",
      path.join(OV, `${sc.outro}.png`),
      ...ENC,
      f,
    ]);
    segs.push(f);
  }
  const list2 = path.join(W, `${sc.id}_list2.txt`);
  fs.writeFileSync(list2, segs.map((f) => `file '${f}'`).join("\n"));
  const base = path.join(W, `${sc.id}_base.mp4`);
  ff(["-f", "concat", "-safe", "0", "-i", list2, "-c", "copy", base]);
  const baseDur = probe(base);
  // 4. overlays: chip for the scene over the product footage, a caption per chunk
  const inputs = ["-i", base];
  const filters = [];
  let last = "[0:v]";
  let idx = 1;
  const videoFrom = stillDur;
  const videoTo = baseDur - outroDur;
  if (sc.chip !== false) {
    inputs.push("-i", path.join(OV, `chip_${sc.id}.png`));
    filters.push(
      `${last}[${idx}:v]overlay=0:0:enable='between(t,${videoFrom.toFixed(2)},${videoTo.toFixed(2)})'[v${idx}]`,
    );
    last = `[v${idx}]`;
    idx++;
  }
  timeline.forEach((c, i) => {
    inputs.push("-i", path.join(OV, `cap_${sc.id}_${i}.png`));
    const end = Math.min(c.at + c.dur + 0.35, baseDur - 0.05);
    filters.push(
      `${last}[${idx}:v]overlay=0:0:enable='between(t,${c.at.toFixed(2)},${end.toFixed(2)})'[v${idx}]`,
    );
    last = `[v${idx}]`;
    idx++;
    srt.push({ n: n++, from: clock + c.at, to: clock + end, text: c.cap });
  });
  // 5. audio: silence bed with chunks placed at their times
  const aInputs = [];
  const aFilters = [];
  timeline.forEach((c, i) => {
    aInputs.push("-i", c.file);
    aFilters.push(
      `[${idx + i}:a]adelay=${Math.round(c.at * 1000)}|${Math.round(c.at * 1000)}[a${i}]`,
    );
  });
  const mix = timeline.map((_, i) => `[a${i}]`).join("");
  aFilters.push(
    `${mix}amix=inputs=${timeline.length}:normalize=0,apad=whole_dur=${baseDur.toFixed(3)}[aout]`,
  );
  const out = path.join(W, `${sc.id}.mp4`);
  ff([
    ...inputs,
    ...aInputs,
    "-filter_complex",
    [...filters, ...aFilters].join(";"),
    "-map",
    last,
    "-map",
    "[aout]",
    "-t",
    String(baseDur),
    ...ENC,
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    out,
  ]);
  parts.push(out);
  clock += baseDur;
  console.log(
    sc.id,
    "video",
    vdur.toFixed(1),
    "s · narration",
    (audioEnd - narStart).toFixed(1),
    "s · scene",
    baseDur.toFixed(1),
    "s",
  );
}
const listAll = path.join(W, "all.txt");
fs.writeFileSync(listAll, parts.map((f) => `file '${f}'`).join("\n"));
ff([
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  listAll,
  "-c",
  "copy",
  "-movflags",
  "+faststart",
  OUTFILE,
]);
const ts = (s) => {
  const h = Math.floor(s / 3600),
    mm = Math.floor((s % 3600) / 60),
    ss = Math.floor(s % 60),
    ms = Math.round((s - Math.floor(s)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
};
fs.writeFileSync(
  OUTFILE.replace(/\.mp4$/, ".srt"),
  srt.map((c) => `${c.n}\n${ts(c.from)} --> ${ts(c.to)}\n${c.text}\n`).join("\n"),
);
console.log("total", probe(OUTFILE).toFixed(1), "s →", OUTFILE);
