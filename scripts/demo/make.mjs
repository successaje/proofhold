/**
 * The whole demo video in one command, against a running `npm run local`:
 * seed → record → narration → overlays → build. Output under demo-video/.
 *
 *   npm run demo:video
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const OUT = path.resolve("demo-video");
const WORK = path.join(OUT, "work");
fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(WORK, { recursive: true });
const base = process.env.APP_URL ?? "http://127.0.0.1:3200";
const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });

const seedFile = path.join(WORK, "seed.json");
run("npx", ["tsx", "scripts/demo/seed-json.ts", seedFile]);
const seed = JSON.parse(fs.readFileSync(seedFile, "utf8"));
run("npx", [
  "tsx",
  "scripts/demo/record.mjs",
  path.join(WORK, "rec"),
  base,
  seed.cookie,
  seedFile,
]);
run("node", ["scripts/demo/tts.mjs", path.join(WORK, "tts")]);
run("npx", ["tsx", "scripts/demo/overlays.mjs", path.join(WORK, "overlays")]);
run("node", [
  "scripts/demo/build.mjs",
  path.join(WORK, "rec"),
  path.join(WORK, "tts"),
  path.join(WORK, "overlays"),
  path.join(OUT, "proofhold-demo.mp4"),
]);
