/**
 * Seed a workspace with demo proofholds in known states so a recording or a
 * judge's first visit starts from something real.
 *
 *   npm run seed                 # prints the workspace cookie value and URLs
 *
 * Works in simulated mode without any credentials. In sandbox mode, the holds
 * are left at "proposed" because only a real buyer can approve them.
 */
import { existsSync } from "node:fs";
import { createHmac } from "node:crypto";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const { config } = await import("../src/lib/config");
const { db, closeDb } = await import("../src/lib/store/sql");
const { createWorkspace } = await import("../src/lib/store/repos");
const { createDraft, propose } = await import("../src/lib/proofholds/compose");
const { starterTest } = await import("../src/lib/compiler/starters");
const { startApproval, completeApproval } =
  await import("../src/lib/proofholds/approval");
const { paypal } = await import("../src/lib/paypal");

const sql = await db();
const c = config();
const ws = await createWorkspace(sql, {
  name: "Ada Mensah",
  email: "seller-sandbox@example.com",
});

const jobs = [
  {
    title: "Logo concepts for Driftwood Café",
    kind: "service" as const,
    brief:
      "Three logo concepts for a small coastal café called Driftwood. Minimal, two colours at most, must work at favicon size. Deliver as PNG at 300 dpi plus SVG. Due by Friday.",
    amountCents: 42000,
    approve: true,
  },
  {
    title: "iPhone 13, 128 GB, blue",
    kind: "goods" as const,
    brief:
      "Used iPhone 13, 128 GB, blue, battery health 88%, no cracks, factory reset, original box. Ships tracked within two days of approval.",
    amountCents: 31000,
    approve: true,
  },
  {
    title: "Landing page copy, five sections",
    kind: "service" as const,
    brief:
      "Headline, subhead and five sections of copy for a landscaping company's new site, delivered as a Markdown file. British English. Due in one week.",
    amountCents: 18000,
    approve: false,
  },
];

const urls: string[] = [];
for (const job of jobs) {
  const test = starterTest({
    brief: job.brief,
    kind: job.kind,
    amountCents: job.amountCents,
    currency: "USD",
  });
  let ph = await createDraft(sql, ws.id, { ...job, currency: "USD", test });
  ph = await propose(sql, ph);
  if (job.approve && c.paypal.mode === "simulated") {
    const pp = await paypal();
    const { orderId } = await startApproval(sql, ph, {
      name: "Bea Okafor",
      email: "bea@personal.example.com",
    });
    await pp.simulateApproval!(orderId, {
      email: "bea@personal.example.com",
      name: "Bea Okafor",
    });
    ph = await completeApproval(sql, orderId);
  }
  urls.push(
    `${ph.status.padEnd(9)} ${c.APP_URL}/app/h/${ph.id}   buyer: ${c.APP_URL}/p/${ph.buyerToken}`,
  );
}

const sig = createHmac("sha256", c.APP_SECRET).update(ws.id).digest("base64url");
console.log(`Seeded workspace ${ws.id} (${c.paypal.mode} PayPal).`);
console.log(
  `Cookie to use this workspace in a browser or curl:\n  ph_workspace=${ws.id}.${sig}\n`,
);
for (const u of urls) console.log(u);
await closeDb();
