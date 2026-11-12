/**
 * The demo film, in three steps, because one server runs one PayPal mode:
 *
 *   npm run demo:video -- flow
 *       Against a server on simulated PayPal with a model key. Seeds a
 *       workspace, narrates, and records the main take.
 *
 *   npm run demo:video -- sandbox <workspaceId> <proofholdId>
 *       Against a server in sandbox mode. Records the two clips of a
 *       proofhold that already ran against the PayPal sandbox.
 *
 *   npm run demo:video -- build
 *       Cuts everything into demo-video/proofhold-demo.mp4.
 *
 * docs/demo-script.md has the server commands for each step.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const OUT = path.resolve("demo-video");
const WORK = path.join(OUT, "work");
fs.mkdirSync(WORK, { recursive: true });
const base = process.env.APP_URL ?? "http://127.0.0.1:3200";
const [, , step, ...rest] = process.argv;
const run = (cmd, args, env = {}) =>
  execFileSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } });

if (step === "flow") {
  const seedFile = path.join(WORK, "seed.json");
  // The seed writes straight to the database the simulated server uses.
  run("npx", ["tsx", "scripts/demo/seed-json.ts", seedFile], {
    PAYPAL_MODE: "simulated",
    EXAMINER_MODE: "simulated",
    GEMINI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
  });
  run("node", ["scripts/demo/tts.mjs", path.join(WORK, "tts")]);
  run("node", [
    "scripts/demo/record.mjs",
    "flow",
    path.join(WORK, "flow"),
    base,
    seedFile,
  ]);
} else if (step === "sandbox") {
  if (rest.length < 2)
    throw new Error("usage: demo:video -- sandbox <workspaceId> <proofholdId>");
  run("node", [
    "scripts/demo/record.mjs",
    "sandbox",
    path.join(WORK, "sandbox"),
    base,
    ...rest,
  ]);
} else if (step === "build") {
  const dirs = ["flow", "badge", "sandbox"]
    .map((d) => path.join(WORK, d))
    .filter((d) => fs.existsSync(path.join(d, "clips.json")));
  run("node", [
    "scripts/demo/build.mjs",
    path.join(WORK, "tts"),
    path.join(OUT, "proofhold-demo.mp4"),
    ...dirs,
  ]);
} else {
  console.error(
    "usage: npm run demo:video -- <flow | sandbox <workspaceId> <proofholdId> | build>",
  );
  process.exit(1);
}
