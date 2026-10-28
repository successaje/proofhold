import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptanceTestSchema,
  canonicalJson,
  hashTest,
  parseTest,
  type AcceptanceTest,
} from "../../src/lib/domain/test";
import {
  assertTransition,
  canTransition,
  InvalidTransition,
  isHoldActive,
  isTerminal,
  statuses,
} from "../../src/lib/domain/proofhold";
import {
  entryHash,
  GENESIS,
  verifyChain,
  type AuditEntry,
} from "../../src/lib/audit/chain";

export const sampleTest: AcceptanceTest = {
  version: 1,
  summary: "Three logo concepts for a coastal café",
  predicates: [
    {
      id: "p1",
      text: "Three logo concepts delivered as PNG or SVG",
      evidence: "file",
      must_pass: true,
      check: { kind: "count", min: 3, mime: ["image/png", "image/svg+xml"] },
    },
    {
      id: "p2",
      text: "PNG files are at least 1000px wide",
      evidence: "file",
      must_pass: true,
      check: { kind: "dimensions", min_width: 1000 },
    },
    {
      id: "p3",
      text: "Concepts reflect the brief: coastal, minimal, two colours",
      evidence: "judgement",
      must_pass: true,
      check: {
        kind: "judgement",
        criteria:
          "Each concept is minimal, uses at most two colours and evokes the coast.",
      },
    },
  ],
  rules: {
    silence_window_hours: 72,
    partial_release: [{ when_passed: ["p1", "p2"], fraction: 0.5 }],
  },
  unclear: ["Whether source files are included"],
};

test("canonical JSON sorts keys recursively", () => {
  assert.equal(
    canonicalJson({ b: 1, a: { d: 2, c: [{ z: 1, y: 2 }] } }),
    '{"a":{"c":[{"y":2,"z":1}],"d":2},"b":1}',
  );
});

test("hash is stable across key order and whitespace", () => {
  const reordered = JSON.parse(
    JSON.stringify({
      unclear: sampleTest.unclear,
      rules: sampleTest.rules,
      predicates: sampleTest.predicates,
      summary: sampleTest.summary,
      version: 1,
    }),
  );
  assert.equal(hashTest(parseTest(reordered)), hashTest(sampleTest));
  assert.match(hashTest(sampleTest), /^[0-9a-f]{64}$/);
});

test("a changed predicate changes the hash", () => {
  const changed = structuredClone(sampleTest);
  changed.predicates[0]!.text += "!";
  assert.notEqual(hashTest(changed), hashTest(sampleTest));
});

test("schema rejects mismatched evidence and check kinds", () => {
  const bad = structuredClone(sampleTest) as unknown as {
    predicates: { evidence: string }[];
  };
  bad.predicates[0]!.evidence = "tracking";
  const result = acceptanceTestSchema.safeParse(bad);
  assert.equal(result.success, false);
});

test("schema rejects duplicate ids and dangling partial-release references", () => {
  const dup = structuredClone(sampleTest);
  dup.predicates[1]!.id = "p1";
  assert.equal(acceptanceTestSchema.safeParse(dup).success, false);
  const dangling = structuredClone(sampleTest);
  dangling.rules.partial_release = [{ when_passed: ["p9"], fraction: 0.5 }];
  assert.equal(acceptanceTestSchema.safeParse(dangling).success, false);
});

test("state machine allows the happy path and blocks regressions", () => {
  assertTransition("draft", "proposed");
  assertTransition("proposed", "held");
  assertTransition("held", "checking");
  assertTransition("checking", "awaiting_buyer");
  assertTransition("awaiting_buyer", "released");
  assert.equal(canTransition("released", "held"), false);
  assert.throws(() => assertTransition("released", "voided"), InvalidTransition);
  assert.equal(canTransition("voided", "disputed"), true);
});

test("every status is either terminal or has a way forward", () => {
  for (const s of statuses) {
    if (isTerminal(s)) assert.equal(isHoldActive(s), false);
  }
  assert.equal(isHoldActive("awaiting_buyer"), true);
  assert.equal(isHoldActive("proposed"), false);
});

test("audit chain verifies and detects tampering", () => {
  const entries: AuditEntry[] = [];
  let prev = GENESIS;
  for (let i = 1; i <= 3; i++) {
    const base = {
      proofholdId: "ph_x",
      seq: i,
      type: "status",
      data: { to: `s${i}` },
      prevHash: prev,
      createdAt: "2026-10-28T00:00:00.000Z",
    };
    const hash = entryHash(base);
    entries.push({ id: `au_${i}`, ...base, hash });
    prev = hash;
  }
  assert.equal(verifyChain(entries), -1);
  entries[1]!.data = { to: "tampered" };
  assert.equal(verifyChain(entries), 1);
});
