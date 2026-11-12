/**
 * Images for the Devpost gallery, at Devpost's 3:2 shape (1500×1000, drawn at
 * double density), plus the pieces the thumbnail and the phone composite are
 * made from. Two parts, because one server runs one PayPal mode:
 *
 *   node scripts/devpost-assets.mjs demo    <appUrl> <seedJson> <flowWorkspaceId> <flowProofholdId>
 *   node scripts/devpost-assets.mjs sandbox <appUrl> <workspaceId> <proofholdId>
 *   node scripts/devpost-assets.mjs compose
 *
 * Output: docs/devpost/.
 */
import { chromium } from "@playwright/test";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
const [, , PART, BASE, A, B, C] = process.argv;
const OUT = path.resolve("docs/devpost");
const PARTS = path.join(OUT, "parts");
fs.mkdirSync(PARTS, { recursive: true });
const cookieFor = (ws) =>
  `${ws}.${crypto.createHmac("sha256", process.env.APP_SECRET).update(ws).digest("base64url")}`;

const browser = await chromium.launch();
async function context({ width = 1500, height = 1000, dark = false, cookie } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: dark ? "dark" : "light",
    reducedMotion: "reduce",
  });
  if (cookie)
    await ctx.addCookies([
      { name: "ph_workspace", value: cookie, domain: new URL(BASE).hostname, path: "/" },
    ]);
  return ctx;
}
const shot = async (page, name, opts = {}) => {
  // The dev server keeps a connection open, so do not wait long for idle.
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({
    path: path.join(OUT, `${name}.jpg`),
    type: "jpeg",
    quality: 92,
    ...opts,
  });
  console.log("  ", name);
};
const centre = (loc, offset = 0) =>
  loc.evaluate((el, offset) => {
    const r = el.getBoundingClientRect();
    window.scrollTo({
      top: window.scrollY + r.top + r.height / 2 - innerHeight / 2 + offset,
      behavior: "instant",
    });
  }, offset);
const toTop = (loc, gap = 90) =>
  loc.evaluate((el, gap) => {
    const r = el.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + r.top - gap, behavior: "instant" });
  }, gap);

if (PART === "demo") {
  const seed = JSON.parse(fs.readFileSync(A, "utf8"));
  const by = (state) => seed.rows.find((r) => r.state === state);

  // --- the landing, light and dark ---
  let ctx = await context();
  let page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "load" });
  await shot(page, "01-landing");
  await centre(page.locator("#how > div > ol > li").nth(3));
  await page.waitForTimeout(900);
  await shot(page, "02-story");
  await ctx.close();

  ctx = await context({ dark: true });
  page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "load" });
  await shot(page, "10-landing-dark");
  await ctx.close();

  // --- the seller's side: compose, verdicts, the stamped seal, the ledger ---
  ctx = await context({ cookie: cookieFor(B) });
  page = await ctx.newPage();
  await page.goto(BASE + "/app/new", { waitUntil: "load" });
  await page.locator("#title").fill("Logo concepts for Driftwood Café");
  await page
    .locator("#brief")
    .fill(
      "Three logo concepts for Driftwood, a small coastal café. Minimal, two colours at most, with the name Driftwood in each. PNG, at least 1200 px wide, 300 dpi. Due Friday 20 November.",
    );
  await page.locator("#amount").fill("420");
  await page.getByRole("button", { name: /Compile the test/ }).click();
  const heading = page.getByRole("heading", { name: "The acceptance test" });
  await heading.waitFor({ timeout: 120_000 });
  await page.waitForTimeout(900);
  await toTop(page.locator("#brief"), 250);
  await shot(page, "03-compose");

  await page.goto(`${BASE}/app/h/${C}`, { waitUntil: "load" });
  await shot(page, "06-released");
  const judged = page.getByText("examiner judgement").first();
  await centre(judged, 60);
  await shot(page, "05-verdicts");
  await ctx.close();

  ctx = await context({ cookie: seed.cookie });
  page = await ctx.newPage();
  await page.goto(`${BASE}/app?peek=${by("awaiting_buyer").id}`, { waitUntil: "load" });
  await shot(page, "07-ledger");
  await page.goto(`${BASE}/app/h/${by("disputed").id}`, { waitUntil: "load" });
  await toTop(page.getByRole("heading", { name: "PayPal dispute" }), 330);
  await shot(page, "08-dispute");
  await ctx.close();

  // --- the buyer's side ---
  ctx = await context();
  page = await ctx.newPage();
  await page.goto(`${BASE}/p/${by("proposed").token}`, { waitUntil: "load" });
  await shot(page, "04-buyer-approve");
  await ctx.close();

  // --- phones, for the composite ---
  for (const [name, url, cookie] of [
    ["phone-landing", "/", null],
    ["phone-buyer", `/p/${by("awaiting_buyer").token}`, null],
    ["phone-ledger", "/app", seed.cookie],
  ]) {
    ctx = await context({ width: 390, height: 844, cookie: cookie ?? undefined });
    page = await ctx.newPage();
    await page.goto(BASE + url, { waitUntil: "load" });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(PARTS, `${name}.png`) });
    await ctx.close();
  }
} else if (PART === "sandbox") {
  const ctx = await context({ cookie: cookieFor(A) });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app/h/${B}`, { waitUntil: "load" });
  await shot(page, "09-paypal-sandbox");
  await ctx.close();
} else if (PART === "compose") {
  const data = (f) =>
    `data:image/png;base64,${fs.readFileSync(path.join(PARTS, f)).toString("base64")}`;
  const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,500,60&family=Inter:wght@400;500&family=JetBrains+Mono:wght@500;700&display=swap');`;
  const PAPER = `html,body{margin:0;width:1500px;height:1000px;overflow:hidden;background:#f6f4ef;color:#17150f;font-family:Inter,system-ui,sans-serif}
body::before{content:"";position:absolute;inset:0;background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 47px,rgba(23,21,15,.05) 47px,rgba(23,21,15,.05) 48px)}`;
  const MARK = `<svg viewBox="0 0 64 64" width="92" height="92"><path d="M52.8 20A24 24 0 1 1 44 11.2" fill="none" stroke="#0d5c4e" stroke-width="6" stroke-linecap="round"/><path d="M21 33l8 8 26-28" fill="none" stroke="#0d5c4e" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  // The seal, drawn as a vector so it is sharp at any size: four passed arcs,
  // the holder around the ring, the amount, and the stamp.
  const arcs = [0, 1, 2, 3]
    .map((i) => {
      const a = (d) => [
        100 + 84 * Math.cos((d * Math.PI) / 180),
        100 + 84 * Math.sin((d * Math.PI) / 180),
      ];
      const [x1, y1] = a(-90 + i * 90 + 5);
      const [x2, y2] = a(-90 + (i + 1) * 90 - 5);
      return `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)}A84 84 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}" fill="none" stroke="#1d6f47" stroke-width="10" stroke-linecap="round"/>`;
    })
    .join("");
  const SEAL = `<svg viewBox="0 0 200 200" width="440" height="440">
<circle cx="100" cy="100" r="94" fill="none" stroke="#e1ddd4" stroke-width="1"/>${arcs}
<defs><path id="ring" d="M100 100m-62 0a62 62 0 1 1 124 0a62 62 0 1 1-124 0"/></defs>
<text font-family="'JetBrains Mono',monospace" font-size="8.5" letter-spacing="2.2" fill="#6b665e"><textPath href="#ring">CAPTURED BY PAYPAL · CAPTURED BY PAYPAL · </textPath></text>
<text x="100" y="80" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-size="9" letter-spacing="2" fill="#6b665e">USD</text>
<text x="100" y="108" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-size="30" font-weight="500" letter-spacing="-0.6" fill="#17150f">$420.00</text>
<rect x="56" y="120" width="88" height="24" rx="3" fill="#ffffff" fill-opacity=".9" stroke="#0d5c4e" stroke-width="3"/>
<text x="100" y="137" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-size="13" font-weight="700" letter-spacing="2" fill="#0d5c4e">CAPTURED</text></svg>`;
  const ctx = await browser.newContext({
    viewport: { width: 1500, height: 1000 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // The thumbnail: the name, the claim, and the seal that says it happened.
  await page.setContent(
    `<!doctype html><html><head><style>${FONTS}${PAPER}
.wrap{position:absolute;inset:0;display:grid;grid-template-columns:1.25fr 1fr;align-items:center;padding:0 110px;gap:40px}
.brand{display:flex;align-items:center;gap:22px}
.name{font-family:Fraunces,Georgia,serif;font-weight:500;font-size:112px;letter-spacing:-3px;line-height:1;font-variation-settings:"SOFT" 60}
h1{margin:44px 0 0;font-family:Fraunces,Georgia,serif;font-weight:500;font-size:66px;line-height:1.06;letter-spacing:-1.6px;font-variation-settings:"SOFT" 60}
h1 em{font-style:normal;color:#0d5c4e}
.mono{margin-top:40px;font-family:"JetBrains Mono",monospace;font-size:22px;letter-spacing:.16em;text-transform:uppercase;color:#6b665e}
.seal{justify-self:center;width:470px;height:470px;border-radius:50%;background:#fff;box-shadow:0 30px 80px -30px rgba(23,21,15,.35),0 2px 6px rgba(23,21,15,.08);display:grid;place-items:center}

</style></head><body><div class="wrap"><div><div class="brand">${MARK}<div class="name">Proofhold</div></div>
<h1>A PayPal payment held until the <em>agreed proof</em> arrives.</h1><div class="mono">PayPal AI Hackathon</div></div>
<div class="seal">${SEAL}</div></div></body></html>`,
    { waitUntil: "load" },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(OUT, "thumbnail.jpg"),
    type: "jpeg",
    quality: 93,
  });
  console.log("   thumbnail");

  // Three phones side by side.
  await page.setContent(
    `<!doctype html><html><head><style>${FONTS}${PAPER}
.row{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:70px}
.phone{width:372px;height:806px;border-radius:44px;background:#17150f;padding:11px;box-shadow:0 40px 90px -40px rgba(23,21,15,.5)}
.phone img{width:100%;height:100%;border-radius:34px;display:block;object-fit:cover;object-position:top}
</style></head><body><div class="row">${[
      "phone-landing.png",
      "phone-buyer.png",
      "phone-ledger.png",
    ]
      .map((f) => `<div class="phone"><img src="${data(f)}"></div>`)
      .join("")}</div></body></html>`,
    { waitUntil: "load" },
  );
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(OUT, "11-phones.jpg"),
    type: "jpeg",
    quality: 92,
  });
  console.log("   11-phones");
  await ctx.close();
} else {
  console.error("usage: devpost-assets.mjs <demo|sandbox|compose> …");
  process.exitCode = 1;
}
await browser.close();
