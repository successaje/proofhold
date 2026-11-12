import { test, before } from "node:test";
import assert from "node:assert/strict";
import { resetConfig } from "../../src/lib/config";
import { openDatabase, type Sql } from "../../src/lib/store/sql";
import { createWorkspace, listAudit, listChecks } from "../../src/lib/store/repos";
import { SimulatedPayPalClient } from "../../src/lib/paypal/simulated";
import { createDraft, propose } from "../../src/lib/proofholds/compose";
import { startApproval, completeApproval } from "../../src/lib/proofholds/approval";
import { addFile, runExaminer, submit } from "../../src/lib/proofholds/evidence";
import { sampleTest } from "./domain.test";
import { makePng } from "./validators.test";

let sql: Sql;

before(async () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  process.env.PAYPAL_MODE = "simulated";
  process.env.EXAMINER_MODE = "simulated";
  resetConfig();
  sql = await openDatabase({ sqlitePath: ":memory:" });
  const sim = new SimulatedPayPalClient(sql, "http://127.0.0.1:3200");
  const mod = await import("../../src/lib/paypal/index");
  (mod as unknown as { __set: (c: unknown) => void }).__set?.(sim);
  const ws = await createWorkspace(sql, { name: "Ada", email: "ada@example.com" });
  let ph = await createDraft(sql, ws.id, {
    title: "Logo set",
    kind: "service",
    brief: "Three logo concepts for a coastal café. Minimal, two colours.",
    amountCents: 42000,
    currency: "USD",
    test: sampleTest,
  });
  ph = await propose(sql, ph);
  const { orderId } = await startApproval(sql, ph, {
    name: "Bea",
    email: "bea@example.com",
  });
  await sim.simulateApproval(orderId, { email: "bea@example.com", name: "Bea Buyer" });
  ph = await completeApproval(sql, orderId);
  for (const name of ["a.png", "b.png", "c.png"])
    await addFile(sql, ph, { name, bytes: makePng(1200, 800, 300) });
  (globalThis as { __ph?: unknown }).__ph = ph;
});

test("a delivery examined by the request and the scheduler at once is examined once", async () => {
  const held = (globalThis as { __ph?: Parameters<typeof submit>[1] }).__ph!;
  const { proofhold, needsExaminer } = await submit(sql, held, "Three concepts.");
  assert.equal(needsExaminer, true);
  assert.equal(proofhold.status, "checking");

  // The route's after() and a scheduler pass, both holding the same snapshot.
  const [a, b] = await Promise.all([
    runExaminer(sql, proofhold),
    runExaminer(sql, proofhold),
  ]);
  assert.equal(a.status, "awaiting_buyer");
  assert.equal(b.id, a.id);

  const judged = sampleTest.predicates.filter((p) => p.check.kind === "judgement");
  const verdicts = (await listChecks(sql, proofhold.id, 1)).filter(
    (c) => c.source === "examiner",
  );
  assert.equal(verdicts.length, judged.length, "one verdict per judgement line, not two");
  const examined = (await listAudit(sql, proofhold.id)).filter(
    (e) => e.type === "examined",
  );
  assert.equal(examined.length, 1, "one examination in the history");

  // A later pass finds the verdicts and does nothing more.
  await runExaminer(sql, a);
  assert.equal(
    (await listChecks(sql, proofhold.id, 1)).filter((c) => c.source === "examiner")
      .length,
    judged.length,
  );
});
