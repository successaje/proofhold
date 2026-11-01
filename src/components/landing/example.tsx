import { TestView } from "@/components/proofhold/test-view";
import { Seal } from "@/components/proofhold/seal";
import { StatusPill } from "@/components/ui/status";
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

const hash = "1dd2ee35615fa7ed9c0b4e2a7f3d8c61b2a9e0f4c3d5a6b7c8d9e0f1a2b3c4d5";

export function LandingExample() {
  return (
    <figure className={styles.frame} aria-label="Example proofhold, after delivery">
      <div className={styles.frameHead}>
        <div>
          <span className={styles.frameTitle}>Logo concepts for Driftwood Café</span>
          <span className={styles.frameSub}>
            <StatusPill tone="held">Buyer window</StatusPill> Example · what both sides
            see after delivery
          </span>
        </div>
      </div>
      <div className={styles.frameBody}>
        <TestView
          test={test}
          checks={checks}
          status="awaiting_buyer"
          hash={hash}
          agreement={{
            seller: { name: "Ada Mensah", at: "2026-11-02T09:12:00.000Z" },
            buyer: { name: "Bea Okafor", at: "2026-11-02T14:40:00.000Z" },
          }}
        />
      </div>
      <div className={styles.sealSlot}>
        <Seal
          id="landing-seal"
          amount="$420.00"
          currency="USD"
          segments={["pass", "pass", "pass", "pass"]}
          size={150}
        />
      </div>
      <figcaption className={styles.frameFoot}>
        Releases in 72 h unless the buyer objects · authorization 3C679366HH908993F
      </figcaption>
    </figure>
  );
}
