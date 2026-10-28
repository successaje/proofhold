import { test } from "node:test";
import assert from "node:assert/strict";
import { toAcceptanceTest, type CompilerOutput } from "../../src/lib/compiler/schema";
import { starterTest } from "../../src/lib/compiler/starters";
import { hashTest } from "../../src/lib/domain/test";

test("compiler output maps to a valid test, dropping lines whose check does not fit", () => {
  const out: CompilerOutput = {
    summary: "Three logo concepts",
    predicates: [
      {
        text: "Three concepts as PNG",
        evidence: "file",
        must_pass: true,
        check: { kind: "count", min: 3, max: null, mime: ["image/png"] },
      },
      {
        text: "Looks coastal",
        evidence: "judgement",
        must_pass: true,
        check: { kind: "judgement", criteria: "coastal" },
      },
      {
        text: "Broken line",
        evidence: "tracking",
        must_pass: true,
        check: { kind: "dpi", min: 300 },
      },
      {
        text: "By Nov 5",
        evidence: "file",
        must_pass: true,
        check: { kind: "deadline", before: "2026-11-05T23:59:59Z" },
      },
    ],
    silence_window_hours: 72,
    partial_release: [{ when_passed_indexes: [0, 3], fraction: 0.6 }],
    unclear: ["Source files?"],
  };
  const { test: t, dropped } = toAcceptanceTest(out);
  assert.deepEqual(dropped, ["Broken line"]);
  assert.deepEqual(
    t.predicates.map((p) => p.id),
    ["p1", "p2", "p3"],
  );
  assert.deepEqual(t.rules.partial_release, [
    { when_passed: ["p1", "p3"], fraction: 0.6 },
  ]);
  assert.equal(t.predicates[0]!.check.kind, "count");
  assert.equal("max" in t.predicates[0]!.check, false);
  assert.match(hashTest(t), /^[0-9a-f]{64}$/);
});

test("starter tests are valid for both kinds and carry a deadline when given", () => {
  const service = starterTest({
    brief: "Design a logo. Minimal.",
    kind: "service",
    amountCents: 1000,
    currency: "USD",
    deadline: "2026-11-05",
  });
  assert.equal(
    service.predicates.some((p) => p.check.kind === "deadline"),
    true,
  );
  assert.equal(
    service.predicates.some((p) => p.check.kind === "tracking_shipped"),
    false,
  );
  const goods = starterTest({
    brief: "Used iPhone 13, 128GB.",
    kind: "goods",
    amountCents: 30000,
    currency: "USD",
  });
  assert.equal(
    goods.predicates.some((p) => p.check.kind === "tracking_shipped"),
    true,
  );
  assert.equal(
    goods.predicates.some((p) => p.check.kind === "buyer_confirms"),
    true,
  );
  assert.equal(goods.rules.silence_window_hours, 48);
});
