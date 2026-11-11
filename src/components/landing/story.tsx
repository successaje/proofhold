"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Rail } from "@/components/proofhold/rail";
import { Seal, type Stamp, type Verdict } from "@/components/proofhold/seal";
import type { Status } from "@/lib/domain/proofhold";
import styles from "./story.module.css";

interface Moment {
  id: string;
  title: string;
  text: string;
  status: Status;
  seal: { segments: Verdict[]; pending?: boolean; stamp?: Stamp; holder: string };
  caption: string;
  facts: { k: string; v: string; mono?: boolean }[];
}

const PENDING: Verdict[] = ["pending", "pending", "pending", "pending"];
const PASSED: Verdict[] = ["pass", "pass", "pass", "pass"];

/**
 * One job, told in four moments. The hash and the PayPal ids are examples in
 * the shape the app really shows; the card is labelled as an example.
 */
function moments(hash: string): Moment[] {
  return [
    {
      id: "agreed",
      title: "Agreed",
      text: "The seller pastes the brief and gets a test: four lines that say what “done” means. The buyer reads the same lines on their own page. Nothing is held yet.",
      status: "proposed",
      seal: { segments: PENDING, pending: true, holder: "Not held yet" },
      caption: "Sent to the buyer. Nothing is held yet.",
      facts: [
        { k: "Test", v: "4 lines · 3 measured, 1 judged" },
        { k: "Test hash", v: `${hash.slice(0, 16)}…`, mono: true },
        { k: "Buyer", v: "Has the link, has not approved" },
      ],
    },
    {
      id: "authorized",
      title: "Payment authorized",
      text: "The buyer approves in PayPal. The amount is reserved in their account, not moved. The test’s hash is written into the PayPal order, so the agreement travels with the payment.",
      status: "held",
      seal: { segments: PENDING, holder: "Held by PayPal" },
      caption: "PayPal holds $420.00. Proofhold never does.",
      facts: [
        { k: "PayPal order", v: "intent AUTHORIZE", mono: true },
        { k: "custom_id", v: `${hash.slice(0, 16)}…`, mono: true },
        { k: "Hold valid", v: "29 days, guaranteed for 3" },
      ],
    },
    {
      id: "delivered",
      title: "Work delivered",
      text: "The seller uploads the files. A machine measures what it can from the bytes. An examiner judges only the line a machine cannot measure, gives its reasons, and may abstain.",
      status: "awaiting_buyer",
      seal: { segments: PASSED, holder: "Held by PayPal" },
      caption: "Four lines passed. The buyer’s window is open.",
      facts: [
        { k: "Measured", v: "3 files · PNG · 300 dpi · on time" },
        { k: "Judged", v: "Reads as coastal · 92% confident" },
        { k: "Buyer window", v: "72 hours to object" },
      ],
    },
    {
      id: "paid",
      title: "Reviewed and paid",
      text: "The buyer confirms, or the window closes with no objection. PayPal captures the hold. If a line had failed, nothing would move until the buyer decided.",
      status: "released",
      seal: { segments: PASSED, stamp: "captured", holder: "Captured by PayPal" },
      caption: "Captured. Both sides get the same record.",
      facts: [
        { k: "Decision", v: "Buyer confirmed the delivery" },
        { k: "PayPal capture", v: "2BJ05546414363341", mono: true },
        { k: "Record", v: "Receipt and hash-chained history" },
      ],
    },
  ];
}

function Stage({
  moment,
  index,
  total,
}: {
  moment: Moment;
  index: number;
  total: number;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <span>Logo concepts for Driftwood Café</span>
          <span className={styles.cardSub}>$420.00 · Bea Okafor</span>
        </div>
        <span className={styles.example}>Example</span>
      </div>
      <div className={styles.progress} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i <= index ? styles.on : undefined} />
        ))}
      </div>
      <div className={styles.rail}>
        <Rail status={moment.status} variant="dots" still />
      </div>
      {/* Remounting on each moment replays the seal's own draw and stamp. */}
      <div className={styles.sealWrap} key={moment.id}>
        <Seal
          id={`story-${moment.id}`}
          amount="$420.00"
          currency="USD"
          segments={moment.seal.segments}
          pending={moment.seal.pending}
          stamp={moment.seal.stamp ?? null}
          holder={moment.seal.holder}
          size={176}
        />
        <p className={styles.caption}>{moment.caption}</p>
      </div>
      <dl className={styles.facts} key={`${moment.id}-facts`}>
        {moment.facts.map((f, i) => (
          <div key={f.k} className={styles.fact} style={{ "--i": i } as CSSProperties}>
            <dt>{f.k}</dt>
            <dd className={f.mono ? styles.mono : undefined}>{f.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * "How it works" as a scroll story: the moments scroll past on the left
 * while one agreement card stays pinned on the right and changes with them.
 * On narrow screens each moment carries its own card. Without JavaScript,
 * or with reduced motion, every card is simply shown.
 */
export function Story({ hash }: { hash: string }) {
  const list = moments(hash);
  const [active, setActive] = useState(0);
  const items = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    // The moment crossing the middle of the viewport is the active one.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting)
            setActive(Number((e.target as HTMLElement).dataset.index));
      },
      { rootMargin: "-46% 0px -46% 0px" },
    );
    items.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className={styles.story}>
      <ol className={styles.list}>
        {list.map((m, i) => (
          <li
            key={m.id}
            ref={(el) => {
              items.current[i] = el;
            }}
            data-index={i}
            className={styles.step}
            data-active={i === active || undefined}
            data-done={i < active || undefined}
          >
            <span className={styles.stepNo}>
              <span className={styles.stepDot} aria-hidden="true">
                {i < active ? <Check /> : null}
              </span>
              0{i + 1}
            </span>
            <h3 className={styles.stepTitle}>{m.title}</h3>
            <p className={styles.stepText}>{m.text}</p>
            <div className={styles.inline}>
              <Stage moment={m} index={i} total={list.length} />
            </div>
          </li>
        ))}
      </ol>
      {/* The pinned card repeats what the list says, so it is hidden from assistive tech. */}
      <div className={styles.pin} aria-hidden="true">
        <Stage moment={list[active]!} index={active} total={list.length} />
      </div>
    </div>
  );
}
