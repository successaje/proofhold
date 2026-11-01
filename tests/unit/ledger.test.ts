import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterLedger,
  ledgerCsv,
  parseLedgerQuery,
  bucketOf,
} from "../../src/lib/domain/ledger";
import type { Proofhold } from "../../src/lib/domain/proofhold";
import { sampleTest } from "./domain.test";

function ph(over: Partial<Proofhold>): Proofhold {
  return {
    id: "ph_a",
    workspaceId: "ws",
    buyerToken: "t",
    title: "Logo set",
    kind: "service",
    brief: "Three concepts",
    amountCents: 42000,
    currency: "USD",
    buyerEmail: "bea@example.com",
    buyerName: "Bea",
    status: "held",
    test: sampleTest,
    testHash: "h",
    sellerAgreedAt: null,
    buyerAgreedAt: null,
    paypalOrderId: "ORD1",
    paypalAuthorizationId: null,
    authorizationExpiresAt: null,
    honorPeriodEndsAt: null,
    silenceWindowEndsAt: null,
    evidenceSubmittedAt: null,
    decidedAt: null,
    offerCents: null,
    offerNote: null,
    reauthorizedAt: null,
    buyerResponse: null,
    buyerRespondedAt: null,
    decision: null,
    paypalDisputeId: null,
    paypalTrackerId: null,
    lastReconciledAt: null,
    payerEmail: null,
    releasedCents: 0,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    ...over,
  };
}

const items = [
  ph({
    id: "ph_a",
    title: "Logo set",
    status: "held",
    amountCents: 42000,
    updatedAt: "2026-11-01T12:00:00Z",
  }),
  ph({
    id: "ph_b",
    title: "iPhone 13",
    kind: "goods",
    status: "released",
    releasedCents: 31000,
    amountCents: 31000,
    buyerName: "Cal",
    evidenceSubmittedAt: "2026-11-01T10:00:00Z",
    decidedAt: "2026-11-01T10:30:00Z",
    updatedAt: "2026-11-01T11:00:00Z",
  }),
  ph({
    id: "ph_c",
    title: 'Deck, "final"',
    status: "awaiting_buyer",
    amountCents: 90000,
    updatedAt: "2026-11-01T13:00:00Z",
  }),
];

test("buckets follow the status", () => {
  assert.equal(bucketOf("held"), "active");
  assert.equal(bucketOf("awaiting_buyer"), "attention");
  assert.equal(bucketOf("voided"), "closed");
});

test("the query parser ignores junk and caps the search", () => {
  assert.deepEqual(parseLedgerQuery({ q: "  bea ", bucket: "nope", sort: "amount" }), {
    q: "bea",
    bucket: "all",
    sort: "amount",
  });
  assert.equal(parseLedgerQuery({ q: "x".repeat(500) }).q!.length, 120);
});

test("search covers title, buyer, id and PayPal references; buckets and sorts apply", () => {
  assert.deepEqual(
    filterLedger(items, { q: "cal" }).map((p) => p.id),
    ["ph_b"],
  );
  assert.deepEqual(
    filterLedger(items, { q: "ORD1" }).map((p) => p.id),
    ["ph_c", "ph_a", "ph_b"],
  );
  assert.deepEqual(
    filterLedger(items, { bucket: "attention" }).map((p) => p.id),
    ["ph_c"],
  );
  assert.deepEqual(
    filterLedger(items, { sort: "amount" }).map((p) => p.id),
    ["ph_c", "ph_a", "ph_b"],
  );
  assert.deepEqual(
    filterLedger(items, { sort: "title" }).map((p) => p.title),
    ['Deck, "final"', "iPhone 13", "Logo set"],
  );
});

test("the CSV escapes quotes and commas and carries the outcome", () => {
  const csv = ledgerCsv(filterLedger(items, { sort: "title" }));
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 4);
  assert.match(lines[0]!, /^id,title,kind,status,amount,released,returned/);
  assert.ok(
    lines[1]!.startsWith(
      'ph_c,"Deck, ""final""",service,awaiting_buyer,900.00,0.00,,USD',
    ),
  );
  assert.match(
    lines[2]!,
    /ph_b,iPhone 13,goods,released,310\.00,310\.00,0\.00,USD,Cal,.*,30,Released \$310\.00 · 30 min from submission/,
  );
});
