/**
 * Three logo concepts for the demo's delivery, drawn in the browser and saved
 * as PNG at 1600×1200 with a 300 dpi pHYs chunk, so the validators measure
 * real files and the examiner has something real to judge.
 *
 *   node scripts/demo/fixtures.mjs <outDir>
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// One ink on white each, so "two colours at most" is true without argument.
const CONCEPTS = [
  {
    name: "driftwood-concept-a.png",
    bg: "#ffffff",
    ink: "#0d5c4e",
    svg: (ink) => `
      <g fill="none" stroke="${ink}" stroke-width="26" stroke-linecap="round">
        <path d="M560 440c60-70 120-70 180 0s120 70 180 0 120-70 180 0"/>
        <path d="M560 550c60-70 120-70 180 0s120 70 180 0 120-70 180 0"/>
      </g>
      <text x="800" y="800" text-anchor="middle" font-family="Georgia, 'Iowan Old Style', serif" font-size="150" letter-spacing="6" fill="${ink}">Driftwood</text>
      <text x="800" y="880" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="44" letter-spacing="22" fill="${ink}">COASTAL CAFÉ</text>`,
  },
  {
    name: "driftwood-concept-b.png",
    bg: "#ffffff",
    ink: "#1f3a5f",
    svg: (ink) => `
      <circle cx="800" cy="470" r="190" fill="none" stroke="${ink}" stroke-width="22"/>
      <path d="M660 500c50-56 90-56 140 0s90 56 140 0" fill="none" stroke="${ink}" stroke-width="22" stroke-linecap="round"/>
      <circle cx="870" cy="400" r="34" fill="${ink}"/>
      <text x="800" y="850" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="128" letter-spacing="18" fill="${ink}">DRIFTWOOD</text>`,
  },
  {
    name: "driftwood-concept-c.png",
    bg: "#ffffff",
    ink: "#7a3b1e",
    svg: (ink) => `
      <g fill="none" stroke="${ink}" stroke-width="24" stroke-linecap="round">
        <path d="M430 610h740"/>
        <path d="M520 610c30-120 110-200 280-200s250 80 280 200"/>
        <path d="M640 610c20-70 70-110 160-110s140 40 160 110"/>
      </g>
      <text x="800" y="820" text-anchor="middle" font-family="Georgia, 'Iowan Old Style', serif" font-style="italic" font-size="160" fill="${ink}">Driftwood</text>`,
  },
];

function crcChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

/** Insert a pHYs chunk (pixels per metre) right after IHDR. */
function withDpi(png, dpi) {
  const ppm = Math.round(dpi / 0.0254);
  const data = Buffer.alloc(9);
  data.writeUInt32BE(ppm, 0);
  data.writeUInt32BE(ppm, 4);
  data.writeUInt8(1, 8);
  const ihdrEnd = 8 + 4 + 4 + 13 + 4;
  return Buffer.concat([
    png.subarray(0, ihdrEnd),
    crcChunk("pHYs", data),
    png.subarray(ihdrEnd),
  ]);
}

export async function makeFixtures(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 1,
  });
  const files = [];
  for (const c of CONCEPTS) {
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:${c.bg}"><svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">${c.svg(c.ink)}</svg></body></html>`,
    );
    const png = await page.screenshot({ type: "png" });
    const file = path.join(outDir, c.name);
    fs.writeFileSync(file, withDpi(png, 300));
    files.push(file);
  }
  await browser.close();
  return files;
}

if (process.argv[1] && process.argv[1].endsWith("fixtures.mjs")) {
  const files = await makeFixtures(process.argv[2] ?? "demo-video/work/fixtures");
  console.log(files.join("\n"));
}
