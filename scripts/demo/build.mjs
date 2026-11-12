/**
 * The edit. Turns captured clips into the film:
 *   1. each clip's frames become 60 fps video at their real timings;
 *   2. each scene is stretched or squeezed a little so it lasts as long as
 *      its narration, instead of freezing on a frame;
 *   3. push-ins recorded as focus marks are applied with an eased zoom;
 *   4. every clip crossfades into the next;
 *   5. the narration is laid under its scene. No captions.
 *
 *   node scripts/demo/build.mjs <ttsDir> <out.mp4> <clipsDir> [<clipsDir>…]
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [TTS, OUTFILE, ...DIRS] = process.argv.slice(2).map((a) => path.resolve(a));
const W = path.join(path.dirname(OUTFILE), "work", "edit");
fs.rmSync(W, { recursive: true, force: true });
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

const FPS = 60;
const X = 0.45; // crossfade between clips, seconds
const LEAD = 0.45; // silence before a scene's narration
const TAIL = 0.5; // and after it
const ZOOM_T = 0.8; // how long a push-in or pull-out takes
const FIT = [0.86, 1.32]; // how far a scene may be squeezed or stretched

/**
 * Edit decisions: seconds to drop from the start and end of a clip, where the
 * take idles longer than the film needs. Only still moments are trimmed.
 */
const TRIM = {
  test: [0, 1.0],
  send: [0, 0.7],
  paypal: [0.4, 0],
  approved: [0, 0.6],
  upload: [0, 0.5],
};

const scenes = JSON.parse(fs.readFileSync(path.join(TTS, "index.json"), "utf8"));
const recorded = DIRS.flatMap(
  (d) => JSON.parse(fs.readFileSync(path.join(d, "clips.json"), "utf8")).clips,
);
// A clip recorded again in a later directory replaces the earlier take, in place.
const latest = new Map(recorded.map((c) => [c.name, c]));
const all = recorded
  .filter((c, i) => recorded.findIndex((x) => x.name === c.name) === i)
  .map((c) => latest.get(c.name))
  .map((c) => {
    const [head, tail] = TRIM[c.name] ?? [0, 0];
    if (c.focus && head > 0)
      throw new Error(`cannot trim the start of ${c.name}: it has a push-in`);
    return { ...c, head, full: c.duration, duration: c.duration - head - tail };
  });

// ---- 1. frames to video, at their real timings ----
function raw(clip) {
  const list = path.join(W, `${clip.name}.txt`);
  const lines = [];
  clip.frames.forEach((f, i) => {
    const next = clip.frames[i + 1]?.t ?? clip.full;
    lines.push(
      `file '${path.resolve(f.file)}'`,
      `duration ${Math.max(1 / 240, next - f.t).toFixed(5)}`,
    );
  });
  lines.push(`file '${path.resolve(clip.frames.at(-1).file)}'`);
  fs.writeFileSync(list, lines.join("\n"));
  const out = path.join(W, `${clip.name}.raw.mp4`);
  ff([
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    list,
    "-vf",
    `fps=${FPS},scale=1920:1080:flags=lanczos,format=yuv420p`,
    // The concat demuxer holds the final frame longer than asked: cut to length,
    // and apply the clip's trim.
    "-ss",
    clip.head.toFixed(3),
    "-t",
    clip.duration.toFixed(3),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "8",
    out,
  ]);
  return out;
}

// ---- 3. an eased push-in on a point, held, then eased out ----
function zoomFilter(focus, f, dur) {
  if (!focus) return null;
  const a = focus.tIn * f;
  const b = (focus.tOut ?? Infinity) * f;
  const Z = focus.zoom;
  const smooth = (u) => `(${u})*(${u})*(3-2*(${u}))`;
  const clamp = (e) => `clip(${e},0,1)`;
  const kin = smooth(clamp(`(t-${a.toFixed(3)})/${ZOOM_T}`));
  const kout = Number.isFinite(b) ? smooth(clamp(`(t-${b.toFixed(3)})/${ZOOM_T}`)) : "0";
  const k = `(${kin}-${kout})`;
  const z = `(1+${(Z - 1).toFixed(4)}*${k})`;
  // The point that stays under the camera: the focus, eased from the centre.
  const cx = `(960+(${focus.cx.toFixed(1)}-960)*${k})`;
  const cy = `(540+(${focus.cy.toFixed(1)}-540)*${k})`;
  const x = `clip(${cx}*${z}-960,0,1920*${z}-1920)`;
  const y = `clip(${cy}*${z}-540,0,1080*${z}-1080)`;
  // Supersample, then crop: sub-pixel steps instead of whole-pixel jitter.
  return `scale=w='2*trunc(1920*${z})':h='2*trunc(1080*${z})':eval=frame:flags=lanczos,crop=3840:2160:x='2*(${x})':y='2*(${y})',scale=1920:1080:flags=lanczos`;
}

// ---- 2. fit each scene to its narration ----
const order = [];
for (const sc of scenes) {
  const clips = all.filter((c) => c.scene === sc.id);
  if (clips.length === 0) throw new Error(`no clips for scene ${sc.id}`);
  const lead = sc.lead ?? LEAD;
  const need = lead + sc.dur + TAIL;
  const have = clips.reduce((a, c) => a + c.duration, 0) - X * clips.length;
  const f = Math.min(FIT[1], Math.max(FIT[0], need / have));
  const hold = Math.max(0, need - have * f);
  clips.forEach((c, i) =>
    order.push({
      clip: c,
      f,
      hold: i === clips.length - 1 ? hold : 0,
      scene: sc,
      first: i === 0,
      lead,
    }),
  );
  console.log(
    `${sc.id.padEnd(8)} footage ${have.toFixed(1)}s · narration ${need.toFixed(1)}s · speed ×${(1 / f).toFixed(2)}${hold > 0.05 ? ` · hold ${hold.toFixed(1)}s` : ""}`,
  );
}

const parts = order.map((o) => {
  const src = raw(o.clip);
  const filters = [`setpts=${o.f.toFixed(5)}*PTS`, `fps=${FPS}`];
  const z = zoomFilter(o.clip.focus, o.f, o.clip.duration * o.f);
  if (z) filters.push(z);
  if (o.hold > 0.02)
    filters.push(`tpad=stop_mode=clone:stop_duration=${o.hold.toFixed(3)}`);
  filters.push("format=yuv420p");
  const out = path.join(W, `${o.clip.name}.mp4`);
  ff([
    "-i",
    src,
    "-vf",
    filters.join(","),
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "10",
    "-r",
    String(FPS),
    out,
  ]);
  return { ...o, file: out, dur: probe(out) };
});

// ---- 4. crossfade every clip into the next; work out where each scene starts ----
let t = 0;
const starts = [];
const chain = [];
parts.forEach((p, i) => {
  starts.push(t);
  if (i > 0)
    chain.push(
      `[${i === 1 ? "0:v" : `v${i - 1}`}][${i}:v]xfade=transition=fade:duration=${X}:offset=${t.toFixed(3)}[v${i}]`,
    );
  t += p.dur - X;
});
const total = t + X;
const last = `v${parts.length - 1}`;
const silent = path.join(W, "picture.mp4");
ff([
  ...parts.flatMap((p) => ["-i", p.file]),
  "-filter_complex",
  `${chain.join(";")};[${last}]fade=t=in:st=0:d=0.5,fade=t=out:st=${(total - 0.7).toFixed(3)}:d=0.7,format=yuv420p[out]`,
  "-map",
  "[out]",
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-crf",
  "17",
  "-r",
  String(FPS),
  "-movflags",
  "+faststart",
  silent,
]);

// ---- 5. narration under each scene ----
const cues = parts
  .map((p, i) =>
    p.first ? { file: p.scene.file, at: starts[i] + p.lead, id: p.scene.id } : null,
  )
  .filter(Boolean);
const audio = path.join(W, "narration.wav");
ff([
  ...cues.flatMap((c) => ["-i", c.file]),
  "-filter_complex",
  cues.map((c, i) => `[${i}:a]adelay=${Math.round(c.at * 1000)}:all=1[a${i}]`).join(";") +
    `;${cues.map((_, i) => `[a${i}]`).join("")}amix=inputs=${cues.length}:normalize=0,apad=whole_dur=${total.toFixed(3)},afade=t=out:st=${(total - 0.6).toFixed(3)}:d=0.6[a]`,
  "-map",
  "[a]",
  "-t",
  total.toFixed(3),
  "-ar",
  "48000",
  "-ac",
  "2",
  audio,
]);
ff([
  "-i",
  silent,
  "-i",
  audio,
  "-c:v",
  "copy",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-shortest",
  "-movflags",
  "+faststart",
  OUTFILE,
]);
fs.writeFileSync(
  path.join(W, "timeline.json"),
  JSON.stringify(
    {
      total,
      cues,
      clips: parts.map((p, i) => ({
        name: p.clip.name,
        scene: p.scene.id,
        at: starts[i],
        dur: p.dur,
      })),
    },
    null,
    2,
  ),
);
console.log(
  `\n${probe(OUTFILE).toFixed(1)}s · ${(fs.statSync(OUTFILE).size / 1e6).toFixed(1)} MB → ${OUTFILE}`,
);
