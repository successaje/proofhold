/**
 * The worked example the landing renders with the real components. Nothing
 * here is live; every frame says "example".
 */
import type { AcceptanceTest } from "@/lib/domain/test";
import type { CheckResult } from "@/lib/domain/proofhold";
import type { ProofholdView, SystemInfo } from "@/lib/view";

const HOUR = 3_600_000;
const DEADLINE = "2026-11-13T23:59:59.000Z";

export const sampleTest: AcceptanceTest = {
  version: 1,
  summary: "Three logo concepts for a coastal café, minimal, two colours",
  predicates: [
    {
      id: "p1",
      text: "Three concepts delivered as PNG or SVG",
      evidence: "file",
      must_pass: true,
      check: { kind: "count", min: 3, mime: ["image/png", "image/svg+xml"] },
    },
    {
      id: "p2",
      text: "PNG files are at least 1000px wide and 300 dpi",
      evidence: "file",
      must_pass: true,
      check: { kind: "dpi", min: 300 },
    },
    {
      id: "p3",
      text: "Delivered by Friday",
      evidence: "file",
      must_pass: true,
      check: { kind: "deadline", before: DEADLINE },
    },
    {
      id: "p4",
      text: "Concepts are minimal, two colours, and read as coastal",
      evidence: "judgement",
      must_pass: true,
      check: {
        kind: "judgement",
        criteria:
          "Each concept uses at most two colours, avoids ornament and evokes the coast.",
      },
    },
  ],
  rules: {
    silence_window_hours: 72,
    partial_release: [{ when_passed: ["p1", "p2", "p3"], fraction: 0.6 }],
  },
  unclear: [
    "Which three of the five directions discussed are in scope?",
    "Is the favicon size test 16 px or 32 px?",
  ],
};

const check = (
  id: string,
  predicateId: string,
  source: CheckResult["source"],
  verdict: CheckResult["verdict"],
  reasons: string[],
  at: string,
  confidence: number | null = null,
): CheckResult => ({
  id,
  proofholdId: "ph_example",
  predicateId,
  round: 1,
  source,
  verdict,
  confidence,
  reasons,
  detail: {},
  createdAt: at,
});

export const sampleHash =
  "1dd2ee35615fa7ed9c0b4e2a7f3d8c61b2a9e0f4c3d5a6b7c8d9e0f1a2b3c4d5";

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * The example at a moment relative to now: agreed three days ago, held two
 * days ago, delivered an hour ago, the buyer window open for another 71 hours.
 * Derived from `now` so the hero never shows a window that has already passed.
 */
export function sample(now = Date.now()): {
  test: AcceptanceTest;
  checks: CheckResult[];
  view: ProofholdView;
} {
  const delivered = now - HOUR;
  const approved = now - 2 * 24 * HOUR;
  const at = iso(delivered);
  const test: AcceptanceTest = {
    ...sampleTest,
    predicates: sampleTest.predicates.map((pr) =>
      pr.check.kind === "deadline"
        ? { ...pr, check: { ...pr.check, before: iso(now + 24 * HOUR) } }
        : pr,
    ),
  };
  const checks: CheckResult[] = [
    check("c1", "p1", "validator", "pass", ["3 matching files"], at),
    check(
      "c2",
      "p2",
      "validator",
      "pass",
      [
        "driftwood-a.png: 1600×1200px, 300 dpi",
        "driftwood-b.png: 1600×1200px, 300 dpi",
        "driftwood-c.svg: vector, scales to any size",
      ],
      at,
    ),
    check(
      "c3",
      "p3",
      "validator",
      "pass",
      ["Submitted an hour ago, a day before the deadline"],
      at,
    ),
    check(
      "c4",
      "p4",
      "examiner",
      "pass",
      [
        "All three concepts use two flat colours with no gradients or ornament",
        "A and B use wave and driftwood motifs; C is a tide-line monogram",
      ],
      at,
      0.91,
    ),
  ];
  const view: ProofholdView = {
    id: "ph_example",
    title: "Logo concepts for Driftwood Café",
    kind: "service",
    brief:
      "Three logo concepts for a small coastal café called Driftwood. Minimal, two colours at most, must work at favicon size. Deliver as PNG at 300 dpi plus SVG. Due by Friday.",
    amountCents: 42000,
    currency: "USD",
    amount: "$420.00",
    status: "awaiting_buyer",
    statusLabel: "Buyer window",
    statusTone: "held",
    statusSummary: "Checks are done. The buyer can confirm or object.",
    test,
    testHash: sampleHash,
    buyerEmail: "bea@personal.example.com",
    buyerName: "Bea Okafor",
    payerEmail: "bea@personal.example.com",
    sellerAgreedAt: iso(now - 3 * 24 * HOUR),
    buyerAgreedAt: iso(approved),
    paypalOrderId: "5O190127TN364715T",
    paypalAuthorizationId: "3C679366HH908993F",
    authorizationExpiresAt: iso(approved + 29 * 24 * HOUR),
    honorPeriodEndsAt: iso(approved + 3 * 24 * HOUR),
    silenceWindowEndsAt: iso(delivered + 72 * HOUR),
    evidenceSubmittedAt: at,
    decidedAt: null,
    offerCents: null,
    offerNote: null,
    buyerResponse: null,
    decision: {
      outcome: {
        kind: "wait",
        reason: "Every must-pass check passed. The buyer has 72 hours to object.",
        releasesOnSilence: true,
      },
    },
    paypalDisputeId: null,
    releasedCents: 0,
    reauthorizedAt: null,
    createdAt: iso(now - 3 * 24 * HOUR),
    updatedAt: at,
  };
  return { test, checks, view };
}
