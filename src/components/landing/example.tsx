import { TestView } from "@/components/proofhold/test-view";
import { Badge, StatusPill } from "@/components/ui/status";
import type { AcceptanceTest } from "@/lib/domain/test";
import type { CheckResult } from "@/lib/domain/proofhold";
import styles from "./example.module.css";

/**
 * A worked example rendered with the real components, labelled as an example.
 * The verdicts are what the validators and examiner produce for a delivery
 * like this one; they are not live.
 */
const test: AcceptanceTest = {
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
      check: { kind: "deadline", before: "2026-11-06T23:59:59.000Z" },
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
  unclear: [],
};

const at = "2026-11-05T16:20:00.000Z";
const checks: CheckResult[] = [
  {
    id: "c1",
    proofholdId: "x",
    predicateId: "p1",
    round: 1,
    source: "validator",
    verdict: "pass",
    confidence: null,
    reasons: ["3 matching files"],
    detail: {},
    createdAt: at,
  },
  {
    id: "c2",
    proofholdId: "x",
    predicateId: "p2",
    round: 1,
    source: "validator",
    verdict: "pass",
    confidence: null,
    reasons: [
      "driftwood-a.png: 1600×1200px, 300 dpi",
      "driftwood-b.png: 1600×1200px, 300 dpi",
      "driftwood-c.svg: vector, scales to any size",
    ],
    detail: {},
    createdAt: at,
  },
  {
    id: "c3",
    proofholdId: "x",
    predicateId: "p3",
    round: 1,
    source: "validator",
    verdict: "pass",
    confidence: null,
    reasons: ["Submitted Nov 5, 16:20 UTC, before Nov 6, 23:59 UTC"],
    detail: {},
    createdAt: at,
  },
  {
    id: "c4",
    proofholdId: "x",
    predicateId: "p4",
    round: 1,
    source: "examiner",
    verdict: "pass",
    confidence: 0.91,
    reasons: [
      "All three concepts use two flat colours with no gradients or ornament",
      "A, B use wave and driftwood motifs; C is a tide-line monogram",
    ],
    detail: {},
    createdAt: at,
  },
];

export function LandingExample() {
  return (
    <div className={styles.frame} aria-label="Example proofhold">
      <div className={styles.frameHead}>
        <div>
          <span className={styles.frameTitle}>Logo concepts for Driftwood Café</span>
          <span className={styles.frameSub}>
            Example · what the buyer sees after delivery
          </span>
        </div>
        <StatusPill tone="held">Buyer window</StatusPill>
      </div>
      <div className={styles.frameBody}>
        <TestView test={test} checks={checks} status="awaiting_buyer" />
      </div>
      <div className={styles.frameFoot}>
        <div>
          <span className={styles.amount}>$420.00</span>
          <span className={styles.amountSub}>
            held by PayPal · authorization 3C679366HH908993F
          </span>
        </div>
        <Badge>releases in 72 h unless the buyer objects</Badge>
      </div>
    </div>
  );
}
