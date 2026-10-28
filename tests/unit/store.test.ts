import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../../src/lib/store/sql";
import {
  addEvidence,
  appendAudit,
  createProofhold,
  createWorkspace,
  getEvidenceBytes,
  getProofhold,
  getProofholdByToken,
  listAudit,
  listChecks,
  listProofholds,
  recordCheck,
  recordDecision,
  recordPayPalEvent,
  updateProofhold,
} from "../../src/lib/store/repos";
import { hashTest } from "../../src/lib/domain/test";
import { verifyChain } from "../../src/lib/audit/chain";
import { sampleTest } from "./domain.test";

test("store round-trips a proofhold through its lifecycle", async () => {
  const sql = await openDatabase({ sqlitePath: ":memory:" });
  const ws = await createWorkspace(sql, { name: "Ada", email: "ada@example.com" });
  const ph = await createProofhold(sql, {
    workspaceId: ws.id,
    title: "Logo set",
    kind: "service",
    brief: "Three logo concepts",
    amountCents: 42000,
    currency: "USD",
    test: sampleTest,
    testHash: hashTest(sampleTest),
  });
  assert.equal(ph.status, "draft");
  assert.equal((await getProofholdByToken(sql, ph.buyerToken))?.id, ph.id);
  assert.equal((await listProofholds(sql, ws.id)).length, 1);

  const updated = await updateProofhold(sql, ph.id, {
    status: "held",
    paypalOrderId: "ORDER1",
    paypalAuthorizationId: "AUTH1",
  });
  assert.equal(updated.status, "held");
  assert.equal(updated.paypalAuthorizationId, "AUTH1");
  assert.notEqual(updated.updatedAt, undefined);

  const bytes = new TextEncoder().encode("hello");
  const ev = await addEvidence(sql, {
    proofholdId: ph.id,
    kind: "file",
    name: "a.txt",
    mime: "text/plain",
    bytes,
    sha256: "abc",
    metadata: { width: 10 },
  });
  assert.equal(ev.size, 5);
  const stored = await getEvidenceBytes(sql, ev.id);
  assert.equal(new TextDecoder().decode(stored!.bytes!), "hello");

  await recordCheck(sql, {
    proofholdId: ph.id,
    predicateId: "p1",
    round: 1,
    source: "validator",
    verdict: "pass",
    confidence: null,
    reasons: ["3 files"],
    detail: {},
  });
  assert.equal((await listChecks(sql, ph.id, 1)).length, 1);

  const decision = await recordDecision(sql, {
    proofholdId: ph.id,
    outcome: "capture",
    amountCents: 42000,
    actor: "system",
    rationale: { all: "passed" },
    paypalCaptureId: "CAP1",
    paypalDisputeId: null,
  });
  assert.equal(decision.outcome, "capture");

  await appendAudit(sql, ph.id, "created", { amount: 42000 });
  await appendAudit(sql, ph.id, "status", { from: "draft", to: "held" });
  const chain = await listAudit(sql, ph.id);
  assert.equal(chain.length, 2);
  assert.equal(verifyChain(chain), -1);

  assert.equal(
    await recordPayPalEvent(sql, {
      eventId: "WH-1",
      eventType: "PAYMENT.AUTHORIZATION.CREATED",
      resourceType: "authorization",
      resourceId: "AUTH1",
      payload: {},
      verified: true,
    }),
    true,
  );
  assert.equal(
    await recordPayPalEvent(sql, {
      eventId: "WH-1",
      eventType: "PAYMENT.AUTHORIZATION.CREATED",
      resourceType: "authorization",
      resourceId: "AUTH1",
      payload: {},
      verified: true,
    }),
    false,
  );

  assert.equal(await getProofhold(sql, "nope"), undefined);
  await sql.close();
});
