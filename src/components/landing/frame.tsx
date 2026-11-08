import { TestView } from "@/components/proofhold/test-view";
import { HoldCard } from "@/components/proofhold/hold-card";
import { Rail } from "@/components/proofhold/rail";
import { StatusPill } from "@/components/ui/status";
import type { SystemInfo } from "@/lib/view";
import { sample } from "./sample";
import styles from "./frame.module.css";

/**
 * The product as the hero: the proofhold detail page, rendered with the real
 * components and the worked example, inside a window frame. Labelled as an
 * example on the frame itself.
 */
export function ProductFrame({ system }: { system: SystemInfo }) {
  const { view: v, checks } = sample();
  return (
    <figure className={styles.frame} aria-label="Example proofhold, after delivery">
      <div className={styles.window}>
        <div className={styles.chrome}>
          <span className={styles.dots} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className={styles.url}>/app/h/ph_example</span>
          <span className={styles.exampleTag}>Example</span>
        </div>
        <div className={styles.head}>
          <div className={styles.headText}>
            <span className={styles.title}>{v.title}</span>
            <span className={styles.sub}>
              <StatusPill tone="held">{v.statusLabel}</StatusPill>
              <span>
                {v.amount} · {v.buyerName}
              </span>
            </span>
          </div>
          <div className={styles.rail}>
            <Rail status={v.status} compact />
          </div>
        </div>
        <div className={styles.body}>
          <div className={styles.sheet}>
            <TestView
              test={v.test}
              checks={checks}
              status={v.status}
              hash={v.testHash}
              agreement={{
                seller: { name: "Ada Mensah", at: v.sellerAgreedAt },
                buyer: { name: v.buyerName, at: v.buyerAgreedAt },
              }}
            />
          </div>
          <div className={styles.hold}>
            <HoldCard
              ph={v}
              checks={checks}
              system={{ ...system, demoSilenceMinutes: null }}
              audience="seller"
            />
          </div>
        </div>
      </div>
      <figcaption className={styles.caption}>
        The seller's page for a worked example, an hour after delivery. Cropped; the app
        shows the whole page, the evidence and the history beneath.
      </figcaption>
    </figure>
  );
}
