import { test, before } from "node:test";
import assert from "node:assert/strict";
import { resetConfig } from "../../src/lib/config";
import { openDatabase, type Sql } from "../../src/lib/store/sql";
import {
  createWorkspace,
  deleteWorkspaceData,
  exportWorkspace,
  getWorkspace,
  listAudit,
  listProofholds,
} from "../../src/lib/store/repos";
import { createDraft, propose } from "../../src/lib/proofholds/compose";
import { sampleTest } from "./domain.test";

let sql: Sql;
before(async () => {
  resetConfig();
  sql = await openDatabase({ sqlitePath: ":memory:" });
});

test("export carries everything and deletion removes it, leaving other workspaces alone", async () => {
  const a = await createWorkspace(sql, { name: "Ada", email: "ada@example.com" });
  const b = await createWorkspace(sql, { name: "Bob", email: "bob@example.com" });
  const draft = await createDraft(sql, a.id, {
    title: "Logo set",
    kind: "service",
    brief: "Three concepts.",
    amountCents: 42000,
    currency: "USD",
    buyerEmail: null,
    test: sampleTest,
  });
  await propose(sql, draft);
  const other = await createDraft(sql, b.id, {
    title: "Bob's job",
    kind: "service",
    brief: "Something.",
    amountCents: 1000,
    currency: "USD",
    buyerEmail: null,
    test: sampleTest,
  });

  const exported = await exportWorkspace(sql, a.id);
  assert.equal(exported?.workspace.name, "Ada");
  assert.equal(exported?.proofholds.length, 1);
  assert.ok(exported!.proofholds[0]!.audit.length >= 2);
  assert.ok(!("bytes" in exported!.proofholds[0]!.evidence));

  const removed = await deleteWorkspaceData(sql, a.id);
  assert.equal(removed.proofholds, 1);
  assert.equal(await getWorkspace(sql, a.id), undefined);
  assert.deepEqual(await listAudit(sql, draft.id), []);
  assert.equal((await listProofholds(sql, b.id)).length, 1);
  assert.equal((await listProofholds(sql, b.id))[0]!.id, other.id);
});
