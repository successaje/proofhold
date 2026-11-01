import type { CheckResult, Status } from "@/lib/domain/proofhold";
import type { AcceptanceTest } from "@/lib/domain/test";
import { latestCheckFor } from "@/lib/decision/decide";
import styles from "./seal.module.css";

export type Verdict = "pass" | "fail" | "abstain" | "pending";
export type Stamp =
  | "captured"
  | "part captured"
  | "returned"
  | "expired"
  | "cancelled"
  | "disputed"
  | "refunded"
  | null;

/** The stamp a status earns on the face of the seal, if any. */
export function stampFor(status: Status): Stamp {
  switch (status) {
    case "released":
      return "captured";
    case "partially_released":
      return "part captured";
    case "voided":
      return "returned";
    case "expired":
      return "expired";
    case "cancelled":
      return "cancelled";
    case "disputed":
      return "disputed";
    case "refunded":
      return "refunded";
    default:
      return null;
  }
}

/** One ring segment per line of the test, coloured by its latest verdict. */
export function segmentsFor(test: AcceptanceTest, checks: CheckResult[]): Verdict[] {
  const latestRound = checks.reduce((m, c) => Math.max(m, c.round), 0);
  const current = checks.filter((c) => c.round === latestRound);
  return test.predicates.map((p) => latestCheckFor(current, p.id)?.verdict ?? "pending");
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arc(r: number, start: number, end: number): string {
  const [x1, y1] = polar(100, 100, r, start);
  const [x2, y2] = polar(100, 100, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

const stampTone: Record<NonNullable<Stamp>, "wax" | "fail" | "muted"> = {
  captured: "wax",
  "part captured": "wax",
  returned: "muted",
  expired: "muted",
  cancelled: "muted",
  disputed: "fail",
  refunded: "fail",
};

/**
 * The Seal. A circular stamp whose ring is divided into one arc per line of
 * the acceptance test. Arcs take the verdict colour as checks come in; the
 * face carries the amount and who holds it, and is stamped when money moves.
 */
export function Seal({
  amount,
  currency,
  segments,
  stamp = null,
  holder = "Held by PayPal",
  size = 184,
  pending = false,
  className,
  id = "seal",
}: {
  amount: string;
  currency?: string;
  segments: Verdict[];
  stamp?: Stamp;
  holder?: string;
  size?: number;
  /** Nothing is held yet: the ring is drawn faint. */
  pending?: boolean;
  className?: string;
  id?: string;
}) {
  const n = Math.max(segments.length, 1);
  const gap = n === 1 ? 10 : Math.min(8, 60 / n);
  const span = 360 / n;
  const passed = segments.filter((v) => v === "pass").length;
  const label = [
    `${amount}${currency ? ` ${currency}` : ""}`,
    stamp ? stamp : pending ? "not held yet" : holder.toLowerCase(),
    segments.length ? `${passed} of ${segments.length} lines passed` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const unit = `${holder.toUpperCase()} · `;
  // Fit whole repeats to the ring (r = 60, circumference ≈ 377) so the words never overlap.
  const repeats = Math.max(1, Math.floor(377 / (unit.length * 6.9)));
  const ringText = unit.repeat(repeats);
  const stampText = stamp ? stamp.toUpperCase() : null;
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={[styles.seal, pending && styles.pending, className]
        .filter(Boolean)
        .join(" ")}
    >
      <defs>
        <path id={`${id}-ring`} d={arc(60, -90, 269.99)} />
      </defs>
      <circle cx="100" cy="100" r="92" className={styles.face} />
      <circle cx="100" cy="100" r="92" className={styles.edge} />
      {segments.length === 0 ? (
        <path d={arc(78, -85, 265)} className={[styles.arc, styles.pending].join(" ")} />
      ) : (
        segments.map((v, i) => {
          const start = -90 + i * span + gap / 2;
          const end = start + span - gap;
          return (
            <path
              key={i}
              d={arc(78, start, end)}
              className={[styles.arc, styles[`arc-${v}`]].join(" ")}
              style={{ transitionDelay: `${i * 60}ms` }}
            />
          );
        })
      )}
      <text className={styles.ringText} dy="3" textLength="375" lengthAdjust="spacing">
        <textPath
          href={`#${id}-ring`}
          startOffset="0"
          textLength="375"
          lengthAdjust="spacing"
        >
          {ringText}
        </textPath>
      </text>
      {currency ? (
        <text x="100" y="82" textAnchor="middle" className={styles.currency}>
          {currency}
        </text>
      ) : null}
      <text x="100" y="110" textAnchor="middle" className={styles.amount}>
        {amount}
      </text>
      {stampText ? (
        <g
          className={[styles.stamp, styles[`stamp-${stampTone[stamp!]}`]].join(" ")}
          transform="rotate(-8 100 134)"
        >
          <rect
            x={stampText.length > 9 ? 24 : 38}
            y="120"
            width={stampText.length > 9 ? 152 : 124}
            height="30"
            rx="4"
          />
          <text
            x="100"
            y="140"
            textAnchor="middle"
            fontSize={stampText.length > 9 ? 12 : 14}
          >
            {stampText}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

/** Row-sized seal: ring only, no text. */
export function MiniSeal({
  segments,
  stamp = null,
  pending = false,
  size = 28,
  title,
}: {
  segments: Verdict[];
  stamp?: Stamp;
  pending?: boolean;
  size?: number;
  title: string;
}) {
  const n = Math.max(segments.length, 1);
  const gap = n === 1 ? 14 : Math.min(14, 90 / n);
  const span = 360 / n;
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={[styles.mini, pending && styles.pending].filter(Boolean).join(" ")}
    >
      {segments.length === 0 ? (
        <path d={arc(78, -85, 265)} className={[styles.arc, styles.pending].join(" ")} />
      ) : (
        segments.map((v, i) => {
          const start = -90 + i * span + gap / 2;
          return (
            <path
              key={i}
              d={arc(78, start, start + span - gap)}
              className={[styles.arc, styles[`arc-${v}`]].join(" ")}
            />
          );
        })
      )}
      {stamp === "captured" || stamp === "part captured" ? (
        <path
          d="M62 104l24 24 52-56"
          fill="none"
          stroke="var(--wax)"
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : stamp ? (
        <path
          d="M66 100h68"
          fill="none"
          stroke={
            stamp === "disputed" || stamp === "refunded" ? "var(--fail)" : "var(--muted)"
          }
          strokeWidth="22"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}
