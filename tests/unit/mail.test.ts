import { test, before } from "node:test";
import assert from "node:assert/strict";
import { resetConfig } from "../../src/lib/config";
import { openDatabase, type Sql } from "../../src/lib/store/sql";
import { createWorkspace, listMail } from "../../src/lib/store/repos";
import { createDraft, propose } from "../../src/lib/proofholds/compose";
import { notify, reminderDue } from "../../src/lib/mail/notify";
import { template } from "../../src/lib/mail/templates";
import { ResendMailer } from "../../src/lib/mail/resend";
import { __setMailer } from "../../src/lib/mail";
import { sampleTest } from "./domain.test";

let sql: Sql;

before(async () => {
  delete process.env.RESEND_API_KEY;
  process.env.MAIL_PROVIDER = "simulated";
  process.env.APP_URL = "http://127.0.0.1:3200";
  resetConfig();
  __setMailer(undefined);
  sql = await openDatabase({ sqlitePath: ":memory:" });
});

test("sending a proofhold writes the buyer's invitation to the outbox", async () => {
  const ws = await createWorkspace(sql, { name: "Ada", email: "ada@example.com" });
  const draft = await createDraft(sql, ws.id, {
    title: "Logo set",
    kind: "service",
    brief: "Three logo concepts.",
    amountCents: 42000,
    currency: "USD",
    buyerEmail: "bea@example.com",
    test: sampleTest,
  });
  const sent = await propose(sql, draft);
  const mail = await listMail(sql, { proofholdId: sent.id });
  assert.equal(mail.length, 1);
  assert.equal(mail[0]!.to, "bea@example.com");
  assert.equal(mail[0]!.toRole, "buyer");
  assert.equal(mail[0]!.status, "simulated");
  assert.match(mail[0]!.subject, /Ada sent you a payment hold to approve/);
  assert.match(mail[0]!.text, new RegExp(`/p/${sent.buyerToken}`));
  assert.ok(mail[0]!.html.includes("Read the test and approve"));
});

test("a release writes a receipt to the buyer and a notice to the seller", async () => {
  const ws = await createWorkspace(sql, { name: "Ada", email: "ada@example.com" });
  const draft = await createDraft(sql, ws.id, {
    title: "Logo set",
    kind: "service",
    brief: "Three logo concepts.",
    amountCents: 42000,
    currency: "USD",
    buyerEmail: "bea@example.com",
    test: sampleTest,
  });
  const out = await notify(
    sql,
    { ...draft, releasedCents: 42000, status: "released" },
    "released",
  );
  assert.deepEqual(out.map((m) => m.toRole).sort(), ["buyer", "seller"]);
  const buyer = out.find((m) => m.toRole === "buyer")!;
  assert.match(buyer.subject, /^Receipt: \$420\.00 paid to Ada/);
  assert.match(buyer.text, /\/p\/.*\/record/);
});

test("no address, no mail; unknown audiences render nothing", async () => {
  const ws = await createWorkspace(sql, { name: "Ada", email: "ada@example.com" });
  const draft = await createDraft(sql, ws.id, {
    title: "No buyer yet",
    kind: "service",
    brief: "Something.",
    amountCents: 10000,
    currency: "USD",
    buyerEmail: null,
    test: sampleTest,
  });
  const out = await notify(sql, draft, "proposed");
  assert.equal(out.length, 0);
  assert.equal(
    template("approved", "buyer", {
      ph: draft,
      sellerName: "Ada",
      buyerUrl: "u",
      sellerUrl: "s",
      recordUrl: "r",
    }),
    null,
  );
});

test("reminders are due once inside the lead time", () => {
  const base = {
    status: "awaiting_buyer" as const,
    evidenceSubmittedAt: "2026-11-01T00:00:00.000Z",
    silenceWindowEndsAt: "2026-11-04T00:00:00.000Z",
    authorizationExpiresAt: "2026-11-28T00:00:00.000Z",
  } as Parameters<typeof reminderDue>[0];
  assert.equal(reminderDue(base, new Date("2026-11-01T12:00:00Z")), null, "too early");
  assert.equal(
    reminderDue(base, new Date("2026-11-03T06:00:00Z"))?.event,
    "reminder_window",
    "inside the last 24 h",
  );
  assert.equal(
    reminderDue(base, new Date("2026-11-05T00:00:00Z")),
    null,
    "already closed",
  );
  const held = { ...base, status: "held" as const };
  assert.equal(reminderDue(held, new Date("2026-11-20T00:00:00Z")), null);
  assert.equal(
    reminderDue(held, new Date("2026-11-26T00:00:00Z"))?.event,
    "reminder_expiry",
  );
  const short = { ...base, silenceWindowEndsAt: "2026-11-01T00:02:00.000Z" };
  assert.equal(
    reminderDue(short, new Date("2026-11-01T00:00:30Z")),
    null,
    "first half of a 2-minute window",
  );
  assert.equal(
    reminderDue(short, new Date("2026-11-01T00:01:10Z"))?.event,
    "reminder_window",
  );
});

test("the Resend adapter maps success and failure without throwing", async () => {
  const ok = new ResendMailer(
    "key",
    "Proofhold <p@example.com>",
    (async () =>
      new Response(JSON.stringify({ id: "em_1" }), { status: 200 })) as typeof fetch,
  );
  assert.deepEqual(
    await ok.send({ to: "b@example.com", subject: "s", text: "t", html: "h" }),
    {
      status: "sent",
      providerId: "em_1",
      error: null,
    },
  );
  const bad = new ResendMailer(
    "key",
    "Proofhold <p@example.com>",
    (async () =>
      new Response(JSON.stringify({ message: "invalid from" }), {
        status: 422,
      })) as typeof fetch,
  );
  assert.equal(
    (await bad.send({ to: "b@example.com", subject: "s", text: "t", html: "h" })).status,
    "failed",
  );
  const down = new ResendMailer("key", "Proofhold <p@example.com>", (async () => {
    throw new Error("network down");
  }) as typeof fetch);
  const r = await down.send({ to: "b@example.com", subject: "s", text: "t", html: "h" });
  assert.equal(r.status, "failed");
  assert.match(r.error ?? "", /network down/);
});
