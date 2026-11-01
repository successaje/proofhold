/**
 * Measure page loads and the API calls behind the core journey against a
 * running server (APP_URL, default http://127.0.0.1:3200). Prints medians
 * over N runs. Run it against `npm run local` for a development figure or
 * against `npm run build && npm start` for a production one; the output says
 * which it got from the server's response headers.
 *
 *   npx tsx scripts/measure.ts
 */
import { chromium } from "@playwright/test";

const base = process.env.APP_URL ?? "http://127.0.0.1:3200";
const runs = Number(process.env.RUNS ?? 5);

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

async function timed(fn: () => Promise<void>) {
  const t = performance.now();
  await fn();
  return performance.now() - t;
}

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

const head = await fetch(base + "/api/health");
const mode = head.headers.get("x-powered-by") ?? "";
console.log(`server ${base} · health ${head.status} · ${mode || "mode unknown"}`);

async function load(path: string) {
  const ttfb: number[] = [];
  const dcl: number[] = [];
  const lcp: number[] = [];
  const bytes: number[] = [];
  for (let i = 0; i < runs; i++) {
    let transferred = 0;
    const onResponse = async (r: import("@playwright/test").Response) => {
      const len = Number(r.headers()["content-length"] ?? 0);
      transferred += len;
    };
    page.on("response", onResponse);
    await page.goto(base + path, { waitUntil: "load" });
    const m = await page.evaluate(
      () =>
        new Promise<{ ttfb: number; dcl: number; lcp: number }>((resolve) => {
          const nav = performance.getEntriesByType(
            "navigation",
          )[0] as PerformanceNavigationTiming;
          let lcp = 0;
          const po = new PerformanceObserver((list) => {
            for (const e of list.getEntries()) lcp = e.startTime;
          });
          po.observe({ type: "largest-contentful-paint", buffered: true });
          setTimeout(() => {
            po.disconnect();
            resolve({
              ttfb: nav.responseStart - nav.requestStart,
              dcl: nav.domContentLoadedEventEnd - nav.startTime,
              lcp,
            });
          }, 600);
        }),
    );
    page.off("response", onResponse);
    ttfb.push(m.ttfb);
    dcl.push(m.dcl);
    lcp.push(m.lcp);
    bytes.push(transferred);
  }
  console.log(
    `${path.padEnd(14)} ttfb ${median(ttfb).toFixed(0).padStart(5)} ms · dcl ${median(dcl).toFixed(0).padStart(5)} ms · lcp ${median(lcp).toFixed(0).padStart(5)} ms · ~${(median(bytes) / 1024).toFixed(0)} KB declared`,
  );
}

// Public pages.
await load("/");
await load("/app/start");

// A workspace, then the seller pages and the API calls behind composing.
await page.goto(base + "/app/start");
await page.getByLabel("Your name").fill("Measure Bot");
await page.getByLabel("PayPal email").fill("measure@example.com");
await page.getByRole("button", { name: "Continue" }).click();
await page.waitForURL(/\/app\/new/);
await load("/app");
await load("/app/new");

const compile: number[] = [];
const create: number[] = [];
let lastId = "";
for (let i = 0; i < runs; i++) {
  compile.push(
    await timed(async () => {
      const r = await page.request.post(base + "/api/compile", {
        data: {
          brief: "Three logo concepts, PNG at 300 dpi plus SVG, due Friday.",
          kind: "service",
          amountCents: 42000,
          currency: "USD",
          deadline: null,
        },
      });
      if (!r.ok()) throw new Error(`compile ${r.status()}`);
    }),
  );
  create.push(
    await timed(async () => {
      const c = await page.request.post(base + "/api/compile", {
        data: {
          brief: "Three logo concepts, PNG at 300 dpi plus SVG, due Friday.",
          kind: "service",
          amountCents: 42000,
          currency: "USD",
          deadline: null,
        },
      });
      const { test } = await c.json();
      const r = await page.request.post(base + "/api/proofholds", {
        data: {
          title: "Measure",
          kind: "service",
          brief: "Three logo concepts, PNG at 300 dpi plus SVG, due Friday.",
          amountCents: 42000,
          currency: "USD",
          buyerEmail: null,
          test,
        },
      });
      if (!r.ok()) throw new Error(`create ${r.status()}`);
      lastId = (await r.json()).proofhold.id;
    }),
  );
}
console.log(
  `POST /api/compile   median ${median(compile).toFixed(0)} ms (starter test; AI off)`,
);
console.log(
  `POST /api/proofholds median ${median(create).toFixed(0)} ms (incl. compile)`,
);
await load(`/app/h/${lastId}`);
await browser.close();
