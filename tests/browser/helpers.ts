import { expect, type Page } from "@playwright/test";
import { deflateSync } from "node:zlib";

function crc(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
}

/** A real RGB PNG with a coloured disc, a declared dpi, and the given size. */
export function pngFixture(width: number, height: number, dpi: number, hue = 0): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const phys = Buffer.alloc(9);
  const ppm = Math.round(dpi / 0.0254);
  phys.writeUInt32BE(ppm, 0);
  phys.writeUInt32BE(ppm, 4);
  phys[8] = 1;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * (width * 3 + 1) + 1 + x * 3;
      const inside =
        (x - width / 2) ** 2 + (y - height / 2) ** 2 < (Math.min(width, height) / 3) ** 2;
      raw[i] = inside ? 13 : 246;
      raw[i + 1] = inside ? 92 : 244;
      raw[i + 2] = inside ? (78 + hue) % 255 : 239;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("pHYs", phys),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export async function startWorkspace(page: Page, name = "Ada Mensah") {
  await page.goto("/app/start");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("PayPal email").fill("seller-sandbox@example.com");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/app\/new/);
}

export async function composeAndSend(page: Page, kind: "service" | "goods") {
  await page.goto("/app/new");
  if (kind === "goods") await page.getByRole("radio", { name: "Physical goods" }).click();
  await page.getByRole("button", { name: "Use an example" }).click();
  await page
    .getByRole("button", { name: /Compile the test|Draft a starter test/ })
    .click();
  await expect(page.getByRole("heading", { name: "The acceptance test" })).toBeVisible();
  await page.getByRole("button", { name: "Create and get the buyer link" }).click();
  await expect(page).toHaveURL(/\/app\/h\/ph_/);
  const buyerUrl = await page
    .getByRole("link", { name: "Open buyer page" })
    .getAttribute("href");
  const id = page.url().match(/\/app\/h\/(ph_[a-z0-9]+)/)![1]!;
  return { id, buyerUrl: buyerUrl! };
}

/** Approve through PayPal. Simulated mode is driven fully; sandbox mode needs PAYPAL_BUYER_* credentials. */
export async function approveAsBuyer(buyer: Page, buyerUrl: string) {
  await buyer.goto(buyerUrl);
  await buyer.getByLabel("Your name").fill("Bea Okafor");
  await buyer
    .getByLabel("Email for updates")
    .fill(process.env.PAYPAL_BUYER_EMAIL ?? "bea@personal.example.com");
  await buyer.getByRole("button", { name: /Approve .* with PayPal/ }).click();
  await buyer.waitForURL(/\/sim\/paypal\/checkout|paypal\.com/, { timeout: 30_000 });
  if (buyer.url().includes("/sim/paypal/checkout")) {
    await buyer.getByRole("button", { name: /^Authorize/ }).click();
  } else {
    // Real sandbox checkout: log in with the sandbox buyer and approve.
    await buyer.getByPlaceholder(/email/i).fill(process.env.PAYPAL_BUYER_EMAIL!);
    await buyer.getByRole("button", { name: /next/i }).click();
    await buyer.getByPlaceholder(/password/i).fill(process.env.PAYPAL_BUYER_PASSWORD!);
    await buyer.getByRole("button", { name: /log in/i }).click();
    await buyer
      .getByRole("button", { name: /continue|pay now|agree/i })
      .first()
      .click();
  }
  await buyer.waitForURL(/\/p\/.*approved=1/, { timeout: 60_000 });
  await expect(buyer.getByText("Approved.")).toBeVisible();
}

export async function uploadFiles(page: Page, files: { name: string; buffer: Buffer }[]) {
  const input = page.locator('input[type="file"]');
  await input.setInputFiles(
    files.map((f) => ({ name: f.name, mimeType: "image/png", buffer: f.buffer })),
  );
  for (const f of files)
    await expect(page.getByRole("link", { name: f.name })).toBeVisible();
}
