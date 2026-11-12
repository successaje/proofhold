/**
 * The demo's choreography. Drives the real UI and captures it clip by clip;
 * anything between clips (page loads, waiting on the model) is not filmed.
 * Two sessions, because one dev server runs one PayPal mode:
 *
 *   node scripts/demo/record.mjs flow    <outDir> <appUrl> <seedJson> <ttsIndex>
 *   node scripts/demo/record.mjs badge   <outDir> <appUrl> <workspaceId> <proofholdId>
 *   node scripts/demo/record.mjs sandbox <outDir> <appUrl> <workspaceId> <proofholdId>
 *
 * "flow" runs against the simulated PayPal client with the real model.
 * "sandbox" films a proofhold that already ran against the PayPal sandbox.
 */
import { chromium } from "@playwright/test";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRecorder, cursorScript } from "./capture.mjs";
import { introCard, outroCard, playCard, showCard } from "./cards.mjs";
import { makeFixtures } from "./fixtures.mjs";

const [, , SESSION, OUT, BASE, ARG1, ARG2] = process.argv;
if (!SESSION || !OUT || !BASE) {
  console.error("usage: record.mjs <flow|sandbox> <outDir> <appUrl> …");
  process.exit(1);
}
if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
const host = new URL(BASE).hostname;
const ZOOM = 1.25;
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  colorScheme: "light",
});
// The app is drawn a quarter larger so its text reads at 1080p. Layout zoom,
// not a transform: text stays sharp and the pointer still lines up.
// A constructed stylesheet rather than a style attribute, because React
// clears attributes it did not set on <html> when a page transitions.
await ctx.addInitScript(
  `if (location.protocol.startsWith("http")) { const s = new CSSStyleSheet(); s.replaceSync("html{zoom:${ZOOM}}"); document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]; }`,
);
await ctx.addInitScript(cursorScript);
const page = await ctx.newPage();
const rec = await createRecorder(ctx, page, OUT);
const { sleep } = rec;
const go = async (url) => {
  await page.goto(url.startsWith("http") ? url : BASE + url, {
    waitUntil: "networkidle",
  });
  await sleep(250);
};
const top = () => page.evaluate(() => window.scrollTo(0, 0));
const seal = () => page.locator('svg[viewBox="0 0 200 200"]').first();
/** Replay the seal's own draw and stamp, so the camera sees them land. */
const replaySeal = () =>
  page.evaluate(() => {
    for (const el of document.querySelectorAll('svg[viewBox="0 0 200 200"] *')) {
      if (getComputedStyle(el).animationName === "none") continue;
      el.style.animation = "none";
      void el.getBoundingClientRect();
      el.style.animation = "";
    }
  });

if (SESSION === "flow") {
  const seed = JSON.parse(fs.readFileSync(ARG1, "utf8"));
  const by = (state) => seed.rows.find((r) => r.state === state);
  const fixtures = await makeFixtures(path.join(OUT, "fixtures"));

  // ---------- open: the card, then the landing ----------
  await page.goto("about:blank");
  await showCard(page, introCard);
  await rec.clip("intro", "open", async () => {
    await playCard(page);
    await sleep(3900);
  });

  await go("/");
  await rec.setPointer({ x: 1500, y: 880 });
  await page.mouse.move(1500, 880);
  await rec.clip("hero", "open", async () => {
    // Replay the hero's own entrance now that the camera is rolling.
    await page.evaluate(() => {
      for (const el of document.querySelectorAll(
        '[class*="heroInner"] > *, [class*="bandInner"]',
      )) {
        el.style.animation = "none";
        void el.getBoundingClientRect();
        el.style.animation = "";
      }
    });
    await sleep(2300);
    await rec.hover(page.getByRole("button", { name: /Write the brief/ }), 900);
    await sleep(900);
    await rec.glideTo(page.locator("figure[aria-label]"), { block: "center", ms: 2200 });
    await sleep(1700);
  });

  // ---------- story: one job in four moments ----------
  const steps = page.locator("#how > div > ol > li");
  await steps
    .nth(0)
    .evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await sleep(700);
  await rec.clip("story", "story", async () => {
    await sleep(1300);
    for (const i of [1, 2, 3]) {
      await rec.glideTo(steps.nth(i), { block: "center", ms: 1150 });
      await sleep(i === 3 ? 1900 : 1150);
    }
  });

  // ---------- compose: the brief becomes a test ----------
  await page.request.post(BASE + "/api/workspace", {
    data: { name: "Ada Mensah", email: "ada@studio.example.com" },
    headers: { Origin: new URL(BASE).origin },
  });
  await go("/app/new");
  await rec.clip("brief", "compose", async () => {
    await sleep(500);
    await rec.type(page.locator("#title"), "Logo concepts for Driftwood Café", {
      cps: 48,
    });
    await rec.type(
      page.locator("#brief"),
      "Three logo concepts for Driftwood, a small coastal café. Minimal, two colours at most, with the name Driftwood in each. PNG, at least 1200 px wide, 300 dpi. Due Friday 20 November.",
      { cps: 120 },
    );
    await rec.type(page.locator("#amount"), "420", { cps: 14 });
    await rec.click(page.getByRole("button", { name: /Compile the test/ }), {
      settle: 300,
    });
    await sleep(1500);
  });
  const testHeading = page.getByRole("heading", { name: "The acceptance test" });
  await testHeading.waitFor({ timeout: 120_000 });
  await sleep(900);
  await testHeading.evaluate((el) => {
    const r = el.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + r.top - 110, behavior: "instant" });
  });
  await sleep(500);
  await rec.clip("test", "compose", async () => {
    await sleep(900);
    await rec.drift(560, 4300);
    await sleep(500);
  });

  // ---------- buyer: one link, the same test, a hold ----------
  const create = page.getByRole("button", { name: "Create and get the buyer link" });
  await rec.clip("send", "buyer", async () => {
    await rec.glideTo(create, { block: "center", ms: 1200 });
    await rec.click(create, { settle: 280 });
    await page.waitForURL(/\/app\/h\/ph_/);
    await page.getByRole("link", { name: "Open buyer page" }).waitFor();
    await sleep(1900);
  });
  const id = page.url().match(/\/app\/h\/(ph_[a-z0-9]+)/)[1];
  const buyerUrl = await page
    .getByRole("link", { name: "Open buyer page" })
    .getAttribute("href");

  await go(buyerUrl);
  const hashRow = page.getByText(/written into the PayPal order/).first();
  const approve = page.getByRole("button", { name: /Approve .* with PayPal/ });
  await rec.clip("buyer_read", "buyer", async () => {
    await sleep(900);
    await rec.glideTo(hashRow, { block: "center", ms: 2000 });
    await sleep(250);
    await rec.focus(hashRow, 1.14);
    await sleep(1800);
    rec.unfocus();
    await sleep(850);
    await rec.glideTo(approve, { block: "center", ms: 1300 });
    await rec.type(page.getByLabel("Your name"), "Bea Okafor", { cps: 26 });
    await rec.type(page.getByLabel("Email on the record"), "bea@personal.example.com", {
      cps: 44,
    });
    await rec.click(approve, { settle: 320 });
    await sleep(450);
  });
  await page.waitForURL(/\/sim\/paypal\/checkout/, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await sleep(300);
  await rec.clip("paypal", "buyer", async () => {
    await sleep(1100);
    await rec.click(page.getByRole("button", { name: /^Authorize/ }), { settle: 380 });
    await sleep(350);
  });
  await page.waitForURL(/\/p\/.*approved=1/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  await sleep(400);
  await rec.clip("approved", "buyer", async () => {
    await sleep(1100);
    await rec.glideTo(seal(), { block: "center", ms: 1500 });
    await replaySeal();
    await rec.focus(seal(), 1.18);
    await sleep(2600);
  });

  // ---------- deliver: files, validators, the examiner ----------
  await go(`/app/h/${id}`);
  const input = page.locator('input[type="file"]');
  await input.waitFor({ state: "attached" });
  await page.waitForFunction(
    () => !document.querySelector('input[type="file"]')?.disabled,
  );
  await rec.clip("upload", "deliver", async () => {
    await sleep(700);
    await rec.glideTo(page.getByText("Drop files here"), { block: "center", ms: 1100 });
    await rec.hover(page.getByText("Drop files here"), 600);
    await sleep(250);
    await input.setInputFiles(fixtures);
    await page.getByRole("link", { name: path.basename(fixtures[2]) }).waitFor();
    await sleep(1200);
    const note = page.getByPlaceholder(/Anything the buyer should know/);
    await rec.glideTo(note, { block: "center", ms: 800 });
    await rec.type(note, "Three concepts attached. The first is my favourite.", {
      cps: 60,
    });
    await rec.click(page.getByRole("button", { name: "Submit for checks" }), {
      settle: 300,
    });
    await sleep(1900);
  });
  // Wait for the examiner, off camera.
  for (let i = 0; i < 90; i++) {
    const res = await page.request.get(`${BASE}/api/proofholds/${id}`);
    const body = await res.json();
    if (body.proofhold?.status === "awaiting_buyer") {
      console.log(
        "  verdicts:",
        body.checks.map((c) => `${c.predicateId}:${c.source}:${c.verdict}`).join(" "),
      );
      break;
    }
    await sleep(2000);
  }
  await go(`/app/h/${id}`);
  await top();
  const judged = page.getByText("examiner judgement").first();
  await rec.clip("verdicts", "deliver", async () => {
    await sleep(700);
    await rec.glideTo(page.getByRole("heading", { name: "Acceptance test" }), {
      block: "start",
      ms: 1400,
    });
    await sleep(1500);
    await rec.glideTo(judged, { block: "center", ms: 2200, offset: 40 });
    await sleep(300);
    await rec.focus(judged.locator("xpath=ancestor::li[1]"), 1.12);
    await sleep(4200);
  });

  // ---------- release: the buyer confirms, the seal is stamped ----------
  await go(buyerUrl);
  await rec.clip("decide", "release", async () => {
    await sleep(600);
    await rec.glideTo(page.locator("#decide"), { block: "start", ms: 1500 });
    await rec.click(page.getByRole("button", { name: "Confirm and release" }), {
      settle: 320,
    });
    await page.getByRole("button", { name: "Release now" }).waitFor();
    await sleep(650);
    await rec.click(page.getByRole("button", { name: "Release now" }), { settle: 280 });
    await page
      .getByText("Released", { exact: true })
      .first()
      .waitFor({ timeout: 60_000 });
    await sleep(700);
  });
  await page.waitForLoadState("networkidle");
  await seal().evaluate((el) =>
    el.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  await sleep(500);
  await rec.clip("stamped", "release", async () => {
    await replaySeal();
    await rec.focus(seal(), 1.2);
    await sleep(3200);
  });

  // ---------- sandbox, first half: say what this take was ----------
  await go(`/app/h/${id}`);
  await top();
  await rec.clip("sim_badge", "sandbox", async () => {
    await sleep(700);
    await rec.focus(
      page.getByText("PayPal hold").first().locator("xpath=ancestor::section[1]"),
      1.18,
    );
    await sleep(3600);
  });

  // ---------- ledger: every hold, and what happens when it goes wrong ----------
  await ctx.addCookies([
    { name: "ph_workspace", value: seed.cookie, domain: host, path: "/" },
  ]);
  await go("/app");
  await rec.clip("ledger", "ledger", async () => {
    await sleep(1200);
    await rec.click(page.getByRole("link", { name: /^Inspect / }).nth(1), {
      settle: 350,
    });
    await sleep(2400);
  });
  await go(`/app/h/${by("in_review").id}`);
  await rec.clip("review", "ledger", async () => {
    await sleep(500);
    await rec.glideTo(page.getByRole("heading", { name: "Review" }), {
      block: "center",
      ms: 1400,
    });
    await sleep(1500);
  });
  await go(`/app/h/${by("disputed").id}`);
  await rec.clip("dispute", "ledger", async () => {
    await sleep(500);
    await rec.glideTo(page.getByRole("heading", { name: "PayPal dispute" }), {
      block: "center",
      ms: 1400,
    });
    await sleep(1900);
  });

  // ---------- close ----------
  await page.goto("about:blank");
  await showCard(page, outroCard);
  await rec.clip("outro", "close", async () => {
    await playCard(page);
    await sleep(5600);
  });
} else if (SESSION === "badge") {
  // A retake of one clip on its own: the hold card of a released proofhold.
  const [workspaceId, proofholdId] = [ARG1, ARG2];
  const sig = crypto
    .createHmac("sha256", process.env.APP_SECRET)
    .update(workspaceId)
    .digest("base64url");
  await ctx.addCookies([
    { name: "ph_workspace", value: `${workspaceId}.${sig}`, domain: host, path: "/" },
  ]);
  await go(`/app/h/${proofholdId}`);
  await rec.setPointer({ x: 1200, y: 760 });
  await page.mouse.move(1200, 760);
  await rec.clip("sim_badge", "sandbox", async () => {
    await sleep(700);
    // The hold card carries the mode on its own badge: "Simulated PayPal" here,
    // "PayPal sandbox" in the clips that follow.
    await rec.focus(
      page.getByText("PayPal hold").first().locator("xpath=ancestor::section[1]"),
      1.18,
    );
    await sleep(3600);
  });
} else if (SESSION === "sandbox") {
  const [workspaceId, proofholdId] = [ARG1, ARG2];
  const sig = crypto
    .createHmac("sha256", process.env.APP_SECRET)
    .update(workspaceId)
    .digest("base64url");
  await ctx.addCookies([
    { name: "ph_workspace", value: `${workspaceId}.${sig}`, domain: host, path: "/" },
  ]);
  await go(`/app/h/${proofholdId}`);
  await rec.setPointer({ x: 1300, y: 900 });
  await page.mouse.move(1300, 900);
  await rec.clip("sandbox_hold", "sandbox", async () => {
    await sleep(900);
    await rec.focus(
      page.getByText("PayPal hold").first().locator("xpath=ancestor::section[1]"),
      1.18,
    );
    await sleep(3900);
  });
  const captured = page.getByText(/PayPal captured \$420\.00/).last();
  await captured.evaluate((el) =>
    el.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  await sleep(500);
  await rec.clip("sandbox_history", "sandbox", async () => {
    await sleep(500);
    await rec.focus(captured.locator("xpath=ancestor::li[1]"), 1.2);
    await sleep(3600);
  });
} else {
  throw new Error(`unknown session ${SESSION}`);
}

rec.save({ session: SESSION, zoom: ZOOM });
await ctx.close();
await browser.close();
console.log(`recorded ${rec.clips.length} clips for ${SESSION}`);
