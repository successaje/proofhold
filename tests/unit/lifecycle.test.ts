/**
 * End-to-end lifecycle against the simulated PayPal client and an in-memory
 * database, with the AI examiner unavailable (so judgement lines abstain and
 * the buyer decides). Exercises flows A (release), B (goods) and the
 * objection → offer → decline → void path, plus the scheduler.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { resetConfig } from "../../src/lib/config";
import { openDatabase, type Sql } from "../../src/lib/store/sql";
import {
  createWorkspace,
  listAudit,
  listChecks,
  listDecisions,
} from "../../src/lib/store/repos";
import { SimulatedPayPalClient } from "../../src/lib/paypal/simulated";
import { createDraft, propose } from "../../src/lib/proofholds/compose";
import { startApproval, completeApproval } from "../../src/lib/proofholds/approval";
import { addFile, addTracking, submit } from "../../src/lib/proofholds/evidence";
import {
  confirm,
  object,
  proposeOffer,
  declineOffer,
  acceptOffer,
} from "../../src/lib/proofholds/buyer";
import {
  openSandboxDispute,
  fileEvidence,
  adjudicate,
} from "../../src/lib/proofholds/disputes";
import { tick } from "../../src/lib/scheduler/tick";
import { verifyChain } from "../../src/lib/audit/chain";
import { sampleTest } from "./domain.test";
import { makePng } from "./validators.test";

let sql: Sql;
let sim: SimulatedPayPalClient;

before(async () => {
  delete process.env.ANTHROPIC_API_KEY;
  process.env.PAYPAL_MODE = "simulated";
  process.env.DEMO_SILENCE_MINUTES = "1";
  resetConfig();
  sql = await openDatabase({ sqlitePath: ":memory:" });
  sim = new SimulatedPayPalClient(sql, "http://127.0.0.1:3200");
  // Point the shared client at this test's database and simulator.
  const mod = await import("../../src/lib/paypal/index");
  (mod as unknown as { __set: (c: unknown) => void }).__set?.(sim);
});

async function heldProofhold(kind: "service" | "goods" = "service", test = sampleTest) {
  const ws = await createWorkspace(sql, { name: "Ada", email: "ada@example.com" });
  let ph = await createDraft(sql, ws.id, {
    title: "Logo set",
    kind,
    brief: "Three logo concepts for a coastal café. Minimal, two colours.",
    amountCents: 42000,
    currency: "USD",
    test,
  });
  ph = await propose(sql, ph);
  assert.equal(ph.status, "proposed");
  const { orderId } = await startApproval(sql, ph, {
    name: "Bea",
    email: "bea@example.com",
  });
  await sim.simulateApproval(orderId, { email: "bea@example.com", name: "Bea Buyer" });
  ph = await completeApproval(sql, orderId);
  assert.equal(ph.status, "held");
  assert.ok(ph.paypalAuthorizationId);
  return ph;
}

test("flow A: evidence passes validators, examiner unavailable → buyer confirms → full release", async () => {
  let ph = await heldProofhold();
  await addFile(sql, ph, { name: "a.png", bytes: makePng(1200, 800, 300) });
  await addFile(sql, ph, { name: "b.png", bytes: makePng(1200, 800, 300) });
  await addFile(sql, ph, { name: "c.png", bytes: makePng(1200, 800, 300) });
  const { proofhold, needsExaminer } = await submit(
    sql,
    ph,
    "Here are the three concepts.",
  );
  assert.equal(needsExaminer, false);
  ph = proofhold;
  assert.equal(ph.status, "awaiting_buyer");
  const checks = await listChecks(sql, ph.id, 1);
  assert.equal(checks.find((c) => c.predicateId === "p1")?.verdict, "pass");
  assert.equal(checks.find((c) => c.predicateId === "p3")?.verdict, "abstain");
  const decision = ph.decision as {
    outcome: { kind: string; releasesOnSilence?: boolean };
  };
  assert.equal(decision.outcome.kind, "wait");
  assert.equal(decision.outcome.releasesOnSilence, true);
  ph = await confirm(sql, ph, "Lovely, thanks.");
  assert.equal(ph.status, "released");
  assert.equal(ph.releasedCents, 42000);
  const decisions = await listDecisions(sql, ph.id);
  assert.equal(decisions[0]?.outcome, "capture");
  assert.ok(decisions[0]?.paypalCaptureId);
  assert.equal(
    (await sim.getAuthorization(ph.paypalAuthorizationId!)).status,
    "CAPTURED",
  );
  assert.equal(verifyChain(await listAudit(sql, ph.id)), -1);
});

test("flow A': silence releases the agreed partial fraction when only some lines pass", async () => {
  let ph = await heldProofhold();
  await addFile(sql, ph, { name: "a.png", bytes: makePng(1200, 800, 300) });
  await addFile(sql, ph, { name: "b.png", bytes: makePng(1200, 800, 300) });
  await addFile(sql, ph, { name: "c.png", bytes: makePng(1200, 800, 300) });
  ph = (await submit(sql, ph)).proofhold;
  assert.equal(ph.status, "awaiting_buyer");
  assert.ok(ph.silenceWindowEndsAt);
  // Nothing happens before the window ends.
  let report = await tick(sql, new Date());
  assert.deepEqual(report.windowsClosed, []);
  // After the window: p1+p2 passed, p3 abstained → 50% rule.
  report = await tick(sql, new Date(Date.parse(ph.silenceWindowEndsAt!) + 1000));
  assert.deepEqual(report.windowsClosed, [ph.id]);
  const after = (await import("../../src/lib/store/repos")).getProofhold;
  ph = (await after(sql, ph.id))!;
  assert.equal(ph.status, "partially_released");
  assert.equal(ph.releasedCents, 21000);
  assert.equal((await sim.getAuthorization(ph.paypalAuthorizationId!)).status, "VOIDED");
});

test("flow C: objection → offer → decline → void; and accept path", async () => {
  let ph = await heldProofhold();
  await addFile(sql, ph, { name: "a.png", bytes: makePng(300, 200) });
  ph = (await submit(sql, ph)).proofhold;
  assert.equal(ph.status, "awaiting_buyer");
  assert.equal((ph.decision as { outcome: { kind: string } }).outcome.kind, "blocked");
  ph = await object(sql, ph, "Only one concept, and it is tiny.");
  assert.equal(ph.status, "in_review");
  ph = await proposeOffer(sql, ph, {
    amountCents: 10000,
    note: "Take 100 for the one concept.",
  });
  assert.equal(ph.offerCents, 10000);
  ph = await declineOffer(sql, ph, "No thanks.");
  assert.equal(ph.status, "voided");
  assert.equal((await sim.getAuthorization(ph.paypalAuthorizationId!)).status, "VOIDED");

  let ph2 = await heldProofhold();
  await addFile(sql, ph2, { name: "a.png", bytes: makePng(300, 200) });
  ph2 = (await submit(sql, ph2)).proofhold;
  ph2 = await object(sql, ph2, "Not what we agreed.");
  ph2 = await proposeOffer(sql, ph2, { amountCents: 15000, note: "Half." });
  ph2 = await acceptOffer(sql, ph2);
  assert.equal(ph2.status, "partially_released");
  assert.equal(ph2.releasedCents, 15000);
});

test("flow B: goods with tracking, buyer confirms, tracker attached after capture", async () => {
  const goodsTest = {
    ...sampleTest,
    summary: "Used phone",
    predicates: [
      {
        id: "p1",
        text: "Shipped with tracking",
        evidence: "tracking" as const,
        must_pass: true,
        check: { kind: "tracking_shipped" as const },
      },
      {
        id: "p2",
        text: "Buyer confirms receipt",
        evidence: "buyer_confirmation" as const,
        must_pass: true,
        check: { kind: "buyer_confirms" as const, prompt: "Arrived?" },
      },
    ],
    rules: { silence_window_hours: 48, partial_release: [] },
  };
  let ph = await heldProofhold("goods", goodsTest);
  await addTracking(sql, ph, { carrier: "UPS", number: "1Z999AA10123456784" });
  ph = (await submit(sql, ph)).proofhold;
  assert.equal(ph.status, "awaiting_buyer");
  const checks = await listChecks(sql, ph.id, 1);
  assert.equal(checks.find((c) => c.predicateId === "p1")?.source, "tracking");
  ph = await confirm(sql, ph);
  assert.equal(ph.status, "released");
});

test("dispute after release: evidence filed, adjudicated for the seller", async () => {
  let ph = await heldProofhold();
  await addFile(sql, ph, { name: "a.png", bytes: makePng(1200, 800, 300) });
  ph = (await submit(sql, ph)).proofhold;
  ph = await confirm(sql, ph);
  assert.equal(ph.status, "released");
  ph = await openSandboxDispute(sql, ph, {
    reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
  });
  assert.equal(ph.status, "disputed");
  ph = await fileEvidence(sql, ph);
  ph = await adjudicate(sql, ph, "SELLER_FAVOR");
  assert.equal(ph.status, "released");
  const audit = await listAudit(sql, ph.id);
  assert.ok(audit.some((a) => a.type === "evidence_filed"));
  assert.equal(verifyChain(audit), -1);
});

test("scheduler reauthorizes once after the honor period and expires lapsed holds", async () => {
  const ph = await heldProofhold();
  const day4 = new Date(Date.parse(ph.honorPeriodEndsAt!) + 3_600_000);
  const simLater = new SimulatedPayPalClient(sql, "http://127.0.0.1:3200", () => day4);
  const mod = await import("../../src/lib/paypal/index");
  (mod as unknown as { __set: (c: unknown) => void }).__set(simLater);
  let report = await tick(sql, day4);
  assert.ok(report.reauthorized.includes(ph.id));
  const repos = await import("../../src/lib/store/repos");
  const after = (await repos.getProofhold(sql, ph.id))!;
  assert.notEqual(after.paypalAuthorizationId, ph.paypalAuthorizationId);
  assert.ok(after.reauthorizedAt);
  report = await tick(sql, day4);
  assert.ok(!report.reauthorized.includes(ph.id));
  const day30 = new Date(Date.parse(ph.authorizationExpiresAt!) + 1000);
  report = await tick(sql, day30);
  assert.ok(report.expired.includes(ph.id));
  (mod as unknown as { __set: (c: unknown) => void }).__set(sim);
});
