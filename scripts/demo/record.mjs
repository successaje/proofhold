/**
 * Records the demo in one continuous take at 1920×1080 against a running
 * server, driving the real UI: compose, approve, deliver, release, then the
 * seeded ledger and its failure paths. Writes the video and timing marks to
 * the output directory for build.mjs.
 *
 *   node scripts/demo/record.mjs <outDir> <appUrl> <seedCookie> <seedJson>
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cursorScript, makeHelpers } from "./common.mjs";

const [, , OUT, BASE, SEED_COOKIE, SEED_JSON] = process.argv;
if (!OUT || !BASE || !SEED_COOKIE || !SEED_JSON) {
  console.error("usage: record.mjs <outDir> <appUrl> <seedCookie> <seedJson>");
  process.exit(1);
}
const seed = JSON.parse(fs.readFileSync(SEED_JSON, "utf8"));
const by = (state) => seed.rows.find((r) => r.state === state);
const host = new URL(BASE).hostname;
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// Fixture PNGs for the upload (run through tsx so the TypeScript helper loads).
const here = path.dirname(fileURLToPath(import.meta.url));
const { pngFixture } = await import(path.join(here, "../png.ts"));
const fixtures = [
  ["driftwood-a.png", 0],
  ["driftwood-b.png", 60],
  ["driftwood-c.png", 120],
].map(([name, hue]) => {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, pngFixture(1600, 1200, 300, hue));
  return file;
});

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  colorScheme: "light",
  recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
});
await ctx.addInitScript(cursorScript);
const page = await ctx.newPage();
const state = { t0: Date.now(), marks: [] };
const h = makeHelpers(page, state);
const pause = (ms) => h.sleep(ms);

// Scene 1: landing.
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.mouse.move(960, 700);
h.mark("landing");
await pause(2500);
await h.smoothScrollTo(page.locator("figure[aria-label]"), "center");
h.mark("landing_example");
await pause(2500);

// Scene 2: a fresh seller, the brief, the test.
await page.goto(BASE + "/app/start", { waitUntil: "networkidle" });
await h.typeInto(page.getByLabel("Your name"), "Ada Mensah", 26);
await h.typeInto(page.getByLabel("Contact email"), "ada@studio.example.com", 14);
await h.clickOn(page.getByRole("button", { name: "Continue" }));
await page.waitForURL(/\/app\/new/);
await pause(400);
h.mark("compose");
await h.clickOn(page.getByRole("button", { name: "Use an example" }));
await pause(1200);
h.mark("brief_filled");
await h.clickOn(
  page.getByRole("button", { name: /Compile the test|Draft a starter test/ }),
);
await page.getByRole("heading", { name: "The acceptance test" }).waitFor();
await pause(500);
h.mark("test_shown");
await h.smoothScrollTo(
  page.getByRole("heading", { name: "The acceptance test" }),
  "start",
);
await pause(2600);
await h.smoothScrollTo(
  page.getByRole("button", { name: "Create and get the buyer link" }),
  "center",
);
await h.clickOn(page.getByRole("button", { name: "Create and get the buyer link" }));
await page.waitForURL(/\/app\/h\/ph_/);
await pause(800);
h.mark("created");
const id = page.url().match(/\/app\/h\/(ph_[a-z0-9]+)/)[1];
const buyerUrl = await page
  .getByRole("link", { name: "Open buyer page" })
  .getAttribute("href");
await pause(1800);

// Scene 3: the buyer approves.
await page.goto(buyerUrl, { waitUntil: "networkidle" });
await page.mouse.move(960, 500);
h.mark("buyer_sheet");
await pause(1800);
await h.smoothScrollTo(page.getByText("Buyer window:").first(), "center");
await pause(1600);
h.mark("buyer_signatures");
await h.smoothScrollTo(
  page.getByRole("button", { name: /Approve .* with PayPal/ }),
  "center",
);
await h.typeInto(page.getByLabel("Your name"), "Bea Okafor", 26);
await h.typeInto(page.getByLabel("Email on the record"), "bea@personal.example.com", 12);
await h.clickOn(page.getByRole("button", { name: /Approve .* with PayPal/ }));
await page.waitForURL(/\/sim\/paypal\/checkout/, { timeout: 30000 });
await pause(600);
h.mark("sim_paypal");
await pause(1400);
await h.clickOn(page.getByRole("button", { name: /^Authorize/ }));
await page.waitForURL(/\/p\/.*approved=1/, { timeout: 60000 });
await pause(600);
h.mark("approved");
await pause(2200);

// Scene 4: deliver and check.
await page.goto(BASE + `/app/h/${id}`, { waitUntil: "networkidle" });
await page.mouse.move(960, 600);
h.mark("seller_held");
await pause(1200);
const input = page.locator('input[type="file"]');
await input.waitFor({ state: "attached" });
await h.smoothScrollTo(page.getByText("Drop files here"), "center");
await input.setInputFiles(fixtures);
await page.getByRole("link", { name: "driftwood-c.png" }).waitFor();
await pause(900);
h.mark("files_added");
await h.typeInto(
  page.getByPlaceholder(/Anything the buyer should know/),
  "Three concepts attached. B is my favourite.",
  16,
);
await h.clickOn(page.getByRole("button", { name: "Submit for checks" }));
await page.getByText("Buyer window").first().waitFor({ timeout: 90000 });
await pause(500);
h.mark("checks_done");
await h.smoothScrollTo(page.getByRole("heading", { name: "Acceptance test" }), "start");
await pause(3200);
h.mark("verdicts");

// Scene 5: the buyer confirms, the seal is stamped.
await page.goto(buyerUrl, { waitUntil: "networkidle" });
await page.mouse.move(960, 500);
h.mark("buyer_decide");
await pause(1600);
await h.clickOn(page.getByRole("button", { name: "Confirm and release" }));
await page.getByRole("button", { name: "Release now" }).waitFor();
await pause(900);
await h.clickOn(page.getByRole("button", { name: "Release now" }));
await page.getByText("Released", { exact: true }).first().waitFor();
await pause(400);
h.mark("released");
await h.smoothScrollTo(page.getByText("PayPal hold").first(), "center");
await pause(3000);
h.mark("seal_captured");

// Scene 6: the seeded ledger and its failure paths.
await ctx.addCookies([
  { name: "ph_workspace", value: SEED_COOKIE, domain: host, path: "/" },
]);
await page.goto(BASE + "/app", { waitUntil: "networkidle" });
await page.mouse.move(960, 600);
h.mark("ledger");
await pause(2800);
await page.goto(BASE + `/app/h/${by("in_review").id}`, { waitUntil: "networkidle" });
h.mark("in_review");
await h.smoothScrollTo(page.getByRole("heading", { name: "Review" }), "center");
await pause(2600);
await page.goto(BASE + `/app/h/${by("disputed").id}`, { waitUntil: "networkidle" });
h.mark("disputed");
await h.smoothScrollTo(page.getByRole("heading", { name: "PayPal dispute" }), "center");
await pause(2600);
await page.goto(BASE + `/p/${by("released").token}/record`, { waitUntil: "networkidle" });
h.mark("record");
await pause(1200);
await page.mouse.wheel(0, 500);
await pause(2200);

// Scene 7: honesty, and the repo.
await page.goto(BASE + "/app/settings", { waitUntil: "networkidle" });
h.mark("settings");
await pause(2200);
await page.goto(BASE + "/#real", { waitUntil: "networkidle" });
await h.smoothScrollTo(page.locator("#real").getByRole("heading", { level: 2 }), "start");
h.mark("honest");
await pause(3000);
h.mark("end");
await pause(600);

await ctx.close();
await browser.close();
const video = fs.readdirSync(OUT).find((f) => f.endsWith(".webm"));
fs.writeFileSync(
  path.join(OUT, "marks.json"),
  JSON.stringify({ video, marks: state.marks }, null, 2),
);
console.log("recorded", video, state.marks.length, "marks");
