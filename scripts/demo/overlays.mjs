/**
 * Caption and title cards as transparent PNGs (ffmpeg here has no drawtext),
 * rendered with the product's own type and colours.
 *   node scripts/demo/overlays.mjs <outDir>
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [, , OUT] = process.argv;
const here = path.dirname(fileURLToPath(import.meta.url));
const scenes = JSON.parse(fs.readFileSync(path.join(here, "narration.json"), "utf8"));
fs.mkdirSync(OUT, { recursive: true });
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1920px;height:1080px;background:transparent;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#17150f}
.caption{position:absolute;left:50%;transform:translateX(-50%);bottom:56px;max-width:1480px;background:rgba(23,21,15,.92);color:#f6f4ef;font-size:34px;line-height:1.3;padding:14px 28px;border-radius:12px;text-align:center}
.chip{position:absolute;left:40px;bottom:150px;background:#0d5c4e;color:#fff;font-family:"JetBrains Mono",monospace;font-size:22px;letter-spacing:.08em;text-transform:uppercase;padding:9px 18px;border-radius:999px}
.full{position:absolute;inset:0;background:#f6f4ef;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px}
.mark{width:96px;height:96px}
.logo{font-family:Fraunces,Georgia,serif;font-size:96px;font-weight:500;letter-spacing:-2px;color:#17150f}
.tag{font-family:Fraunces,Georgia,serif;font-size:44px;color:#4b4740;max-width:1200px;text-align:center;line-height:1.2}
.url{font-family:"JetBrains Mono",monospace;font-size:30px;color:#0d5c4e;margin-top:14px}
.fine{position:absolute;bottom:60px;font-size:22px;color:#6b665e}
`;
const MARK = `<svg class="mark" viewBox="0 0 64 64"><path d="M52.8 20A24 24 0 1 1 44 11.2" fill="none" stroke="#0d5c4e" stroke-width="6" stroke-linecap="round"/><path d="M21 33l8 8 26-28" fill="none" stroke="#0d5c4e" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const items = [];
for (const sc of scenes) {
  items.push({ id: `chip_${sc.id}`, html: `<div class="chip">${esc(sc.title)}</div>` });
  sc.chunks.forEach((c, i) =>
    items.push({
      id: `cap_${sc.id}_${i}`,
      html: `<div class="caption">${esc(c.cap)}</div>`,
    }),
  );
}
items.push({
  id: "title",
  html: `<div class="full">${MARK}<div class="logo">Proofhold</div><div class="tag">A PayPal payment that is held until the agreed proof arrives.</div><div class="fine">PayPal AI Hackathon · recorded against the simulated PayPal client</div></div>`,
});
items.push({
  id: "outro",
  html: `<div class="full">${MARK}<div class="logo">Proofhold</div><div class="tag">Open source, MIT. What is real, simulated and unproven is on every page.</div><div class="url">github.com/successaje/proofhold</div></div>`,
});
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
for (const it of items) {
  await page.setContent(
    `<!doctype html><html><head><style>${CSS}</style></head><body>${it.html}</body></html>`,
    { waitUntil: "networkidle" },
  );
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${it.id}.png`), omitBackground: true });
}
await browser.close();
console.log("overlays", items.length);
