import { test } from "node:test";
import assert from "node:assert/strict";
import { decide } from "../../src/lib/decision/decide";
import type { CheckResult } from "../../src/lib/domain/proofhold";
import { sampleTest } from "./domain.test";

function check(
  partial: Partial<CheckResult> & Pick<CheckResult, "predicateId" | "verdict" | "source">,
): CheckResult {
  return {
    id: `ck_${Math.random()}`,
    proofholdId: "ph_x",
    round: 1,
    confidence: null,
    reasons: [],
    detail: {},
    createdAt: "2026-11-03T10:00:00.000Z",
    ...partial,
  };
}

const base = {
  test: sampleTest,
  confidenceThreshold: 0.8,
  buyerResponse: null,
  silenceWindowEnded: false,
} as const;

test("all must-pass lines passing waits, then releases on silence", () => {
  const checks = [
    check({ predicateId: "p1", verdict: "pass", source: "validator" }),
    check({ predicateId: "p2", verdict: "pass", source: "validator" }),
    check({ predicateId: "p3", verdict: "pass", source: "examiner", confidence: 0.92 }),
  ];
  const waiting = decide({ ...base, checks });
  assert.equal(waiting.outcome.kind, "wait");
  assert.equal(
    waiting.outcome.kind === "wait" && waiting.outcome.releasesOnSilence,
    true,
  );
  const released = decide({ ...base, checks, silenceWindowEnded: true });
  assert.equal(released.outcome.kind, "release");
});

test("examiner abstention or low confidence blocks release even after silence", () => {
  const checks = [
    check({ predicateId: "p1", verdict: "pass", source: "validator" }),
    check({ predicateId: "p2", verdict: "pass", source: "validator" }),
    check({ predicateId: "p3", verdict: "pass", source: "examiner", confidence: 0.55 }),
  ];
  // p1 and p2 passed, so the partial-release rule (50%) applies instead of a block.
  const d = decide({ ...base, checks, silenceWindowEnded: true });
  assert.equal(d.outcome.kind, "release_partial");
  assert.equal(d.outcome.kind === "release_partial" && d.outcome.fraction, 0.5);

  const noRule = { ...sampleTest, rules: { ...sampleTest.rules, partial_release: [] } };
  const blocked = decide({ ...base, test: noRule, checks, silenceWindowEnded: true });
  assert.equal(blocked.outcome.kind, "blocked");
  assert.match(
    blocked.outcome.kind === "blocked" ? blocked.outcome.reason : "",
    /not confident enough/,
  );
  assert.equal(
    blocked.standings.find((s) => s.predicateId === "p3")?.belowThreshold,
    true,
  );
});

test("buyer confirmation releases and objection routes to review regardless of checks", () => {
  const checks = [check({ predicateId: "p1", verdict: "fail", source: "validator" })];
  assert.equal(
    decide({ ...base, checks, buyerResponse: "confirmed" }).outcome.kind,
    "release",
  );
  assert.equal(
    decide({ ...base, checks, buyerResponse: "objected" }).outcome.kind,
    "review",
  );
});

test("a failed must-pass line without a matching partial rule blocks", () => {
  const checks = [
    check({ predicateId: "p1", verdict: "fail", source: "validator" }),
    check({ predicateId: "p2", verdict: "pass", source: "validator" }),
    check({ predicateId: "p3", verdict: "pass", source: "examiner", confidence: 0.95 }),
  ];
  const d = decide({ ...base, checks, silenceWindowEnded: true });
  assert.equal(d.outcome.kind, "blocked");
  assert.deepEqual(d.outcome.kind === "blocked" ? d.outcome.blocking : [], ["p1"]);
});

test("buyer checks outrank the examiner on the same predicate", () => {
  const checks = [
    check({ predicateId: "p1", verdict: "pass", source: "validator" }),
    check({ predicateId: "p2", verdict: "pass", source: "validator" }),
    check({ predicateId: "p3", verdict: "abstain", source: "examiner", confidence: 0.3 }),
    check({ predicateId: "p3", verdict: "pass", source: "buyer" }),
  ];
  assert.equal(decide({ ...base, checks }).outcome.kind, "wait");
});

test("pending checks wait without releasing on silence", () => {
  const checks = [check({ predicateId: "p1", verdict: "pass", source: "validator" })];
  const d = decide({ ...base, checks, silenceWindowEnded: true });
  assert.equal(d.outcome.kind, "wait");
  assert.equal(d.outcome.kind === "wait" && d.outcome.releasesOnSilence, false);
});
