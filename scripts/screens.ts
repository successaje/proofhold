/**
 * Screenshots for the submission gallery and the README, taken against a
 * running server from a freshly seeded workspace.
 *
 *   npm run screens              # writes docs/screens/*.png
 */
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const { seedWorkspace } = await import("./seed-lib");
const { closeDb } = await import("../src/lib/store/sql");

const s = await seedWorkspace();
await closeDb();
const base = process.env.APP_URL ?? s.appUrl;
const host = new URL(base).hostname;
const OUT = "docs/screens";
mkdirSync(OUT, { recursive: true });

const by = (state: string) => s.rows.find((r) => r.state === state)!;
const shots: {
  name: string;
  path: string;
  widths?: number[];
  dark?: boolean;
  fullPage?: boolean;
  buyer?: boolean;
}[] = [
  { name: "landing", path: "/", widths: [1280, 375] },
  { name: "ledger", path: "/app", widths: [1280, 375] },
  { name: "compose", path: "/app/new?kind=service&amount=420" },
  {
    name: "seller-window-open",
    path: `/app/h/${by("awaiting_buyer").id}`,
    widths: [1280],
  },
  { name: "seller-released", path: `/app/h/${by("released").id}`, widths: [1280, 375] },
  { name: "seller-in-review", path: `/app/h/${by("in_review").id}` },
  { name: "seller-disputed", path: `/app/h/${by("disputed").id}` },
  {
    name: "buyer-approve",
    path: `/p/${by("proposed").token}`,
    widths: [1280, 375],
    buyer: true,
  },
  {
    name: "buyer-decide",
    path: `/p/${s.rows.filter((r) => r.state === "awaiting_buyer")[1]!.token}`,
    widths: [1280, 375],
    buyer: true,
  },
  {
    name: "buyer-receipt",
    path: `/p/${by("released").token}/record`,
    fullPage: true,
    buyer: true,
  },
  { name: "settings-outbox", path: "/app/settings", fullPage: true },
  { name: "landing-dark", path: "/", dark: true },
  { name: "seller-released-dark", path: `/app/h/${by("released").id}`, dark: true },
];

const browser = await chromium.launch();
for (const shot of shots) {
  for (const width of shot.widths ?? [1280]) {
    const ctx = await browser.newContext({
      viewport: { width, height: width < 600 ? 812 : 800 },
      deviceScaleFactor: 1,
      colorScheme: shot.dark ? "dark" : "light",
    });
    if (!shot.buyer)
      await ctx.addCookies([
        { name: "ph_workspace", value: s.cookie, domain: host, path: "/" },
      ]);
    const page = await ctx.newPage();
    await page.goto(base + shot.path, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const file = `${OUT}/${shot.name}${width !== 1280 ? `-${width}` : ""}.png`;
    await page.screenshot({ path: file, fullPage: shot.fullPage ?? false });
    console.log(file);
    await ctx.close();
  }
}
await browser.close();
