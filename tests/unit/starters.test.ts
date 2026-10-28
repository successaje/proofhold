import { test } from "node:test";
import assert from "node:assert/strict";
import { briefFacts, starterTest } from "../../src/lib/compiler/starters";

test("plain facts are read from the brief", () => {
  const f = briefFacts(
    "Three logo concepts for a small coastal café. Deliver as PNG at 300 dpi plus SVG, at least 1000px wide. Due by Friday.",
  );
  assert.deepEqual(f.types.sort(), ["image/png", "image/svg+xml"]);
  assert.equal(f.count, 3);
  assert.equal(f.dpi, 300);
  assert.equal(f.minWidth, 1000);
});

test("a brief with no facts yields an honest open first line", () => {
  const f = briefFacts("Fix the thing we talked about.");
  assert.deepEqual(f, { types: [], count: null, dpi: null, minWidth: null });
  const t = starterTest({
    brief: "Fix the thing we talked about.",
    kind: "service",
    amountCents: 10000,
    currency: "USD",
    deadline: null,
  });
  assert.equal(t.predicates[0]!.check.kind, "count");
  assert.ok(t.unclear.some((u) => /does not say how many files/.test(u)));
});

test("the starter service test carries count, type, dpi, width, deadline and judgement", () => {
  const t = starterTest({
    brief:
      "Three logo concepts for Driftwood. Deliver as PNG at 300 dpi plus SVG, at least 1000px wide.",
    kind: "service",
    amountCents: 42000,
    currency: "USD",
    deadline: "2026-11-06",
  });
  assert.deepEqual(
    t.predicates.map((p) => p.check.kind),
    ["count", "dpi", "dimensions", "deadline", "judgement"],
  );
  const count = t.predicates[0]!.check;
  assert.equal(count.kind, "count");
  if (count.kind === "count") {
    assert.equal(count.min, 3);
    assert.deepEqual(count.mime?.sort(), ["image/png", "image/svg+xml"]);
  }
  assert.match(t.predicates[0]!.text, /3 deliverable files as PNG or SVG/);
  assert.equal(t.predicates.at(-1)!.evidence, "judgement");
  assert.equal(t.rules.silence_window_hours, 72);
});

test("the goods starter is unchanged in shape", () => {
  const t = starterTest({
    brief: "Used iPhone 13, ships tracked.",
    kind: "goods",
    amountCents: 31000,
    currency: "USD",
    deadline: null,
  });
  assert.deepEqual(
    t.predicates.map((p) => p.check.kind),
    ["tracking_shipped", "count", "buyer_confirms"],
  );
});
