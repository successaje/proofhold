import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Github } from "lucide-react";
import { Brand, Mark } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { LandingExample } from "@/components/landing/example";
import { StartHere } from "@/components/landing/start-here";
import { Rail } from "@/components/proofhold/rail";
import { Seal } from "@/components/proofhold/seal";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "Proofhold · A PayPal payment that is held until the agreed proof arrives",
  description:
    "Paste a brief. Proofhold compiles it into an acceptance test both sides approve. PayPal holds the money; it moves only when the evidence passes.",
};

const REPO = "https://github.com/successaje/proofhold";

const states = [
  {
    status: "proposed" as const,
    title: "Proposed",
    body: "You paste the brief. Proofhold compiles it into a test: how many files, what size, by when, a tracking number, and the few judgement calls a human would make. You send one link.",
  },
  {
    status: "held" as const,
    title: "Held",
    body: "The buyer reads the same test and approves a PayPal authorization for the amount. The test's hash is written into the PayPal order. PayPal reserves the money; Proofhold never touches it.",
  },
  {
    status: "checking" as const,
    title: "Checking",
    body: "You deliver here. Deterministic checks decide what they can from the bytes. An examiner judges only what a machine cannot measure, shows its reasons, and may abstain.",
  },
  {
    status: "awaiting_buyer" as const,
    title: "Buyer window",
    body: "The buyer sees every verdict with its reasons. They can confirm, object with a reason, or do nothing. Silence past the agreed window counts as acceptance.",
  },
  {
    status: "released" as const,
    title: "Released, or returned",
    body: "Pass, and PayPal captures. A partial pass releases the agreed share and returns the rest. An objection goes to review; a decline returns the hold. Every step is hash-chained.",
  },
];

export default function Landing() {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <Brand />
          <nav className={styles.navLinks} aria-label="Site">
            <a href="#how">How it works</a>
            <a href="#different">Why not escrow</a>
            <a href="#paypal">Built on PayPal</a>
            <a href="#honest">What is real</a>
          </nav>
          <Button href="/app" size="sm" variant="secondary">
            Open the app
          </Button>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>For freelancers, makers and private sellers</p>
          <h1 className={styles.h1}>
            A PayPal payment that is held until the agreed proof arrives.
          </h1>
          <p className={styles.lead}>
            Write what “done” means. Your buyer approves a PayPal hold against exactly
            that. Deliver, the checks run, and the money releases. Nobody holds the money
            except PayPal.
          </p>
          <StartHere />
          <p className={styles.fine}>
            Nothing is created until you write the brief. Open source, MIT. Runs against
            the PayPal sandbox today.
          </p>
        </div>
        <div className={styles.heroExample}>
          <LandingExample />
        </div>
      </section>

      <section id="how" className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>Five states. The same five words in the app.</h2>
          <p className={styles.sectionLead}>
            Invoices ask for money. Escrow takes custody of it. Proofhold does neither: it
            binds a payment PayPal already holds to a test both sides agreed to.
          </p>
        </div>
        <ol className={styles.states}>
          {states.map((s, i) => (
            <li key={s.status} className={styles.state}>
              <div className={styles.stateRail}>
                <Rail status={s.status} variant="dots" />
              </div>
              <h3>
                <span className={styles.stateNo}>{i + 1}</span>
                {s.title}
              </h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.sectionAlt}>
        <div className={styles.seals}>
          <div className={styles.sealsCopy}>
            <h2 className={styles.h2}>The seal tells you where the money is.</h2>
            <p className={styles.sectionLead}>
              One arc per line of the test. Arcs turn green, red or amber as the checks
              come in. When money moves, the seal is stamped, and that stamp is backed by
              a PayPal capture id you can look up.
            </p>
          </div>
          <ul className={styles.sealRow} aria-label="Seal states">
            <li>
              <Seal
                id="s-held"
                amount="$310.00"
                currency="USD"
                segments={["pending", "pending", "pending"]}
                size={132}
              />
              <span>Held, nothing checked yet</span>
            </li>
            <li>
              <Seal
                id="s-blocked"
                amount="$310.00"
                currency="USD"
                segments={["pass", "fail", "abstain"]}
                size={132}
              />
              <span>One line failed, one abstained: blocked</span>
            </li>
            <li>
              <Seal
                id="s-captured"
                amount="$310.00"
                currency="USD"
                segments={["pass", "pass", "pass"]}
                stamp="captured"
                size={132}
              />
              <span>Every line passed: captured</span>
            </li>
            <li>
              <Seal
                id="s-returned"
                amount="$310.00"
                currency="USD"
                segments={["pass", "fail", "pass"]}
                stamp="returned"
                size={132}
              />
              <span>Buyer declined the offer: returned</span>
            </li>
          </ul>
        </div>
      </section>

      <section id="different" className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>
            Why not an invoice, an escrow service, or a marketplace?
          </h2>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col"></th>
                <th scope="col">Invoice</th>
                <th scope="col">Escrow service</th>
                <th scope="col">Marketplace</th>
                <th scope="col" className={styles.tableUs}>
                  Proofhold
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Who holds the money</th>
                <td>Nobody; you wait</td>
                <td>The escrow company</td>
                <td>The platform</td>
                <td className={styles.tableUs}>
                  PayPal, as an authorization in the buyer's account
                </td>
              </tr>
              <tr>
                <th scope="row">What releases it</th>
                <td>The buyer's goodwill</td>
                <td>A support agent reading emails</td>
                <td>Platform policy</td>
                <td className={styles.tableUs}>
                  A test both sides approved, checked line by line
                </td>
              </tr>
              <tr>
                <th scope="row">What it costs</th>
                <td>Late payments</td>
                <td>A fee on every job</td>
                <td>A cut of every job</td>
                <td className={styles.tableUs}>
                  Standard PayPal fees on capture; nothing on voids
                </td>
              </tr>
              <tr>
                <th scope="row">When it goes wrong</th>
                <td>Chasing</td>
                <td>Their process</td>
                <td>Their process</td>
                <td className={styles.tableUs}>
                  Partial release, void, or a PayPal dispute with the evidence bundle
                  already filed
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.sectionAlt}>
        <div className={styles.split}>
          <div>
            <h2 className={styles.h2}>Honest about the machine</h2>
            <p className={styles.sectionLead}>
              Three kinds of check, and each line says which it is.
            </p>
          </div>
          <dl className={styles.defs}>
            <div>
              <dt>Checked automatically</dt>
              <dd>
                Counts, file types, pixel dimensions, dpi, deadlines, sizes,
                tracking-number formats. Read from the bytes, no model involved, no appeal
                needed.
              </dd>
            </div>
            <div>
              <dt>Examiner</dt>
              <dd>
                Only for lines a machine cannot measure: “the concepts feel coastal and
                minimal”. Returns a verdict, a confidence and reasons that cite the files.
                Below the threshold, or unsure, it abstains, and an abstention never
                releases money.
              </dd>
            </div>
            <div>
              <dt>Buyer</dt>
              <dd>
                Can confirm at any time, object within the window, or accept a partial
                offer. A buyer's word outranks the examiner on their own money.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="paypal" className={styles.section}>
        <div className={styles.split}>
          <div>
            <h2 className={styles.h2}>Built on PayPal, not next to it</h2>
            <p className={styles.sectionLead}>
              The authorization hold is the whole product. Everything else is what we do
              with it.
            </p>
          </div>
          <dl className={styles.defs}>
            <div>
              <dt>Orders v2 with intent AUTHORIZE</dt>
              <dd>
                Creates the hold. The acceptance-test hash goes into the order's
                custom_id, so the contract travels with the payment object PayPal stores.
              </dd>
            </div>
            <div>
              <dt>Payments v2 authorizations</dt>
              <dd>
                Capture in full or in part, reauthorize once after the three-day honor
                period, void what is left. Status is reconciled by polling; webhooks
                accelerate it.
              </dd>
            </div>
            <div>
              <dt>Order tracking</dt>
              <dd>
                For goods, the carrier tracking number is attached to the captured order
                so the buyer sees it in PayPal and the seller keeps seller protection.
              </dd>
            </div>
            <div>
              <dt>Disputes v1</dt>
              <dd>
                After capture, PayPal decides. Proofhold files the evidence bundle through
                provide-evidence. In the sandbox, create and adjudicate show the full
                loop.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="honest" className={styles.sectionAlt}>
        <div className={styles.split}>
          <div>
            <h2 className={styles.h2}>What is real, simulated and unproven</h2>
            <p className={styles.sectionLead}>
              The app says this on screen, on every page, not only here.
            </p>
          </div>
          <dl className={styles.defs}>
            <div>
              <dt>Real, in the PayPal sandbox</dt>
              <dd>
                Order creation with intent AUTHORIZE, buyer approval, authorization,
                reauthorization, capture, partial capture, void, order tracking after
                capture, verified webhooks, dispute evidence filing, and the sandbox-only
                dispute creation and adjudication.
              </dd>
            </div>
            <div>
              <dt>Simulated</dt>
              <dd>
                The shortened buyer window in demos; PayPal's dispute decision; and the
                whole PayPal surface when the app runs without sandbox credentials, which
                every page then says in its header.
              </dd>
            </div>
            <div>
              <dt>Unproven</dt>
              <dd>
                Whether PayPal policy permits third-party conditional release at scale in
                production, and how accurate the examiner is on real-world deliverables
                beyond the shipped evaluation set.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className={styles.cta}>
        <Mark size={40} className={styles.ctaMark} />
        <h2 className={styles.h2}>Send one link instead of an invoice.</h2>
        <div className={styles.ctas}>
          <Button href="/app" size="lg" icon={<ArrowRight />}>
            Create a proofhold
          </Button>
          <Button
            href={REPO}
            target="_blank"
            rel="noreferrer"
            size="lg"
            variant="secondary"
            icon={<Github />}
          >
            Read the code
          </Button>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <Brand />
          <p>
            Built for the{" "}
            <a href="https://paypalaihackathon.devpost.com/">PayPal AI Hackathon</a>. MIT
            licensed. Runs against the PayPal sandbox; what is real, simulated and
            unproven is stated in the app and the README.
          </p>
          <nav aria-label="Footer">
            <Link href="/app">App</Link>
            <a href={REPO}>GitHub</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
