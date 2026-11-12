import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Github } from "lucide-react";
import { Brand, Mark } from "@/components/shell/brand";
import type { CSSProperties } from "react";
import { Rotator } from "@/components/landing/rotator";
import { Story } from "@/components/landing/story";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { ProductFrame } from "@/components/landing/frame";
import { Reveal } from "@/components/landing/reveal";
import { SectionIndex } from "@/components/landing/section-index";
import { StartHere } from "@/components/landing/start-here";
import { sample, sampleHash, sampleTest } from "@/components/landing/sample";
import { systemInfo } from "@/lib/view";
import { Rail } from "@/components/proofhold/rail";
import { TestView } from "@/components/proofhold/test-view";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "Proofhold · A PayPal payment that is held until the agreed proof arrives",
  description:
    "Paste a brief. Proofhold compiles it into an acceptance test both sides approve. PayPal holds the money; it moves only when the evidence passes.",
};

const REPO = "https://github.com/successaje/proofhold";

const index = [
  { id: "brief", label: "Brief" },
  { id: "hold", label: "Hold" },
  { id: "checks", label: "Checks" },
  { id: "release", label: "Release" },
  { id: "wrong", label: "When it goes wrong" },
  { id: "real", label: "What is real" },
  { id: "compare", label: "Compare" },
];

const states = [
  {
    status: "proposed" as const,
    title: "Sent",
    body: "You paste the brief. Proofhold compiles it into a test and you send one link.",
  },
  {
    status: "held" as const,
    title: "Held",
    body: "The buyer reads the same test and approves a PayPal authorization for the amount.",
  },
  {
    status: "checking" as const,
    title: "Checking",
    body: "You deliver here. The checks run line by line and show their reasons.",
  },
  {
    status: "awaiting_buyer" as const,
    title: "Buyer window",
    body: "The buyer can confirm, object with a reason, or let the window pass.",
  },
  {
    status: "released" as const,
    title: "Released, or returned",
    body: "PayPal captures, captures part, or releases the hold. Every step is recorded.",
  },
];

function Triad({
  items,
}: {
  items: { title: string; body: string; href?: string; pill?: string }[];
}) {
  return (
    <ul className={styles.triad}>
      {items.map((it, i) => (
        <Reveal key={it.title} delay={i * 60} as="li" className={styles.triadItem}>
          {it.pill ? <span className={styles.pill}>{it.pill}</span> : null}
          <h3>{it.title}</h3>
          <p>{it.body}</p>
          {it.href ? (
            <a className={styles.arrow} href={it.href}>
              See it in the app <ArrowUpRight aria-hidden="true" />
            </a>
          ) : null}
        </Reveal>
      ))}
    </ul>
  );
}

// Rendered per request: the example's dates are relative to now, and the
// modes line reports what this deployment is connected to. Prerendered at
// build time, both would be frozen.
export const dynamic = "force-dynamic";

/** "on (Gemini)", "simulated" or "off", for the footer's modes line. */
function examinerLabel(system: ReturnType<typeof systemInfo>): string {
  if (system.examinerMode !== "model") return system.examinerMode;
  return system.aiProvider === "gemini" ? "on (Gemini)" : "on (Claude)";
}

export default function Landing() {
  const system = systemInfo();
  const { view: example, checks } = sample();
  const simulated = system.paypalMode !== "sandbox";
  return (
    <div className={styles.page}>
      <a href="#main" className="skipLink">
        Skip to content
      </a>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <Brand />
          <nav className={styles.navLinks} aria-label="Site">
            <a href="#how">How it works</a>
            <a href="#real">What is real</a>
            <a href="#compare">Compare</a>
            <a href={REPO} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
          <div className={styles.navActions}>
            <ThemeToggle />
            <Button href="/app" size="sm" variant="secondary">
              Open the app
            </Button>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        {/* ---------- hero: the claim, the start form, then the product itself ---------- */}
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.rise} style={{ "--d": 0 } as CSSProperties}>
              <Rotator
                lead="For"
                words={[
                  "freelancers",
                  "makers",
                  "private sellers",
                  "the buyers who pay them",
                ]}
              />
            </div>
            <h1 className={styles.h1} style={{ "--d": 1 } as CSSProperties}>
              Write what “done” means.{" "}
              <em>PayPal holds the money until the proof arrives.</em>
            </h1>
            <p className={styles.lead} style={{ "--d": 2 } as CSSProperties}>
              Proofhold turns a brief into an acceptance test both sides approve. The
              buyer authorizes a PayPal hold against exactly that test. Deliver, the
              checks run, and the money releases. Nobody holds it except PayPal.
            </p>
            <div className={styles.rise} style={{ "--d": 3 } as CSSProperties}>
              <StartHere />
            </div>
            <p className={styles.fine} style={{ "--d": 4 } as CSSProperties}>
              Nothing is created until you write the brief. Open source, MIT.{" "}
              {simulated
                ? "This deployment runs without PayPal credentials, so PayPal is simulated and every page says so."
                : "This deployment runs against the PayPal sandbox."}
            </p>
          </div>
        </section>
        <section className={styles.band} aria-label="The product">
          <div className={styles.bandInner} style={{ "--d": 5 } as CSSProperties}>
            <ProductFrame system={system} />
          </div>
        </section>

        {/* ---------- the whole thing, as one job in four moments ---------- */}
        <section id="how" className={styles.how} aria-labelledby="how-title">
          <Reveal>
            <header className={styles.howHead}>
              <span className={styles.no}>How it works</span>
              <h2 className={styles.h2} id="how-title">
                One agreement, <em>four moments.</em>
              </h2>
              <p className={styles.blockLead}>
                Follow one job from brief to payout. The seal is the same one both people
                see on their own pages, and it only changes when something real happens.
              </p>
            </header>
          </Reveal>
          <Story hash={sampleHash} />
        </section>

        <div className={styles.columns}>
          <SectionIndex items={index} />
          <div className={styles.flow}>
            {/* ---------- 1 brief ---------- */}
            <section id="brief" className={styles.block}>
              <Reveal>
                <header className={styles.blockHead}>
                  <span className={styles.no}>01 · Brief</span>
                  <h2 className={styles.h2}>
                    Paste a brief. <em>Get a test you can both sign.</em>
                  </h2>
                  <p className={styles.blockLead}>
                    The compiler reads the brief and writes down what “done” means: how
                    many files, what size, by when, a tracking number, and the few
                    judgement calls a human would make. It says what is unclear instead of
                    guessing.
                  </p>
                </header>
              </Reveal>
              <Reveal>
                <div className={`${styles.plate} ${styles.platePaper}`}>
                  <div className={styles.compile}>
                    <div className={styles.briefIn}>
                      <span className={styles.plateLabel}>The brief, as pasted</span>
                      <p>{example.brief}</p>
                    </div>
                    <ArrowRight className={styles.compileArrow} aria-hidden="true" />
                    <div className={styles.briefOut}>
                      <span className={styles.plateLabel}>The test it compiles to</span>
                      <TestView
                        test={sampleTest}
                        checks={[]}
                        status="draft"
                        showChecks={false}
                      />
                    </div>
                  </div>
                </div>
              </Reveal>
              <Triad
                items={[
                  {
                    pill: "Measured",
                    title: "Counts, sizes, deadlines",
                    body: "Three files, 300 dpi, 1000 px wide, by Friday, a carrier tracking number. Read from the bytes, no model involved.",
                  },
                  {
                    pill: "Judged",
                    title: "The lines a machine cannot measure",
                    body: "“Minimal, two colours, reads as coastal.” Kept separate, labelled, and judged with reasons that cite the files.",
                  },
                  {
                    pill: "Unclear",
                    title: "What it would not guess",
                    body: "Ambiguities become questions above the test, so the two of you settle them before any money is held.",
                  },
                ]}
              />
            </section>

            {/* ---------- 2 hold ---------- */}
            <section id="hold" className={`${styles.block} ${styles.blockBrand}`}>
              <Reveal>
                <header className={styles.blockHead}>
                  <span className={styles.no}>02 · Hold</span>
                  <h2 className={styles.h2}>
                    The buyer approves a hold, <em>not a payment.</em>
                  </h2>
                  <p className={styles.blockLead}>
                    Approval creates a PayPal authorization for the amount. The test's
                    hash is written into the PayPal order, so the contract travels with
                    the payment object PayPal stores. Proofhold never holds the money.
                  </p>
                </header>
              </Reveal>
              <Reveal>
                <div className={`${styles.plate} ${styles.plateDark}`}>
                  <div className={styles.order}>
                    <span className={styles.orderTitle}>
                      What PayPal stores for the order · example
                    </span>
                    <dl className={styles.orderRows}>
                      {(
                        [
                          ["intent", "AUTHORIZE", "a hold, not a payment"],
                          ["amount", "420.00 USD", "reserved in the buyer's account"],
                          [
                            "custom_id",
                            `${sampleHash.slice(0, 24)}…`,
                            "the acceptance test's hash",
                          ],
                          ["authorization", "CREATED", "valid 29 days, guaranteed for 3"],
                          ["capture", "none yet", "only by a recorded decision"],
                        ] as const
                      ).map(([k, v, note], i) => (
                        <Reveal key={k} delay={i * 70} className={styles.orderRow}>
                          <dt>{k}</dt>
                          <dd>
                            <span className={styles.orderValue}>{v}</span>
                            <span className={styles.orderNote}>{note}</span>
                          </dd>
                        </Reveal>
                      ))}
                    </dl>
                  </div>
                </div>
              </Reveal>
              <Triad
                items={[
                  {
                    pill: "Orders v2",
                    title: "Intent AUTHORIZE",
                    body: "The order is created with the acceptance-test hash in custom_id. The buyer approves it in PayPal, not on our page.",
                  },
                  {
                    pill: "Payments v2",
                    title: "Capture, part-capture, void",
                    body: "Funds are guaranteed for three days; Proofhold reauthorizes once after the honor period, then captures or voids what is left.",
                  },
                  {
                    pill: "Tracking",
                    title: "Seller protection kept",
                    body: "For goods, the carrier number is attached to the captured order so the buyer sees it in PayPal and you keep protection.",
                  },
                ]}
              />
            </section>

            {/* ---------- 3 checks ---------- */}
            <section id="checks" className={styles.block}>
              <Reveal>
                <header className={styles.blockHead}>
                  <span className={styles.no}>03 · Checks</span>
                  <h2 className={styles.h2}>
                    Every line says <em>who decided it, and why.</em>
                  </h2>
                  <p className={styles.blockLead}>
                    Deterministic checks decide what they can from the bytes. An examiner
                    judges only what a machine cannot measure, shows its reasons, and may
                    abstain. An abstention never releases money.
                  </p>
                </header>
              </Reveal>
              <Reveal>
                <div className={`${styles.plate} ${styles.platePaper}`}>
                  <TestView
                    test={example.test}
                    checks={checks}
                    status="awaiting_buyer"
                    hash={example.testHash}
                  />
                </div>
              </Reveal>
              <Triad
                items={[
                  {
                    pill: "Automatic",
                    title: "From the bytes",
                    body: "Counts, file types, pixel dimensions, dpi, deadlines, sizes, tracking-number formats. No appeal needed, because there is nothing to argue with.",
                  },
                  {
                    pill: "Examiner",
                    title: "Verdict, confidence, reasons",
                    body: "Below the threshold, or unsure, it abstains and says so. Without credentials it runs as a labelled stand-in that only observes.",
                  },
                  {
                    pill: "Buyer",
                    title: "Outranks the examiner",
                    body: "The buyer can confirm at any time, object within the window with a reason, or accept a partial offer. It is their money.",
                  },
                ]}
              />
            </section>

            {/* ---------- 4 release ---------- */}
            <section id="release" className={`${styles.block} ${styles.blockTint}`}>
              <Reveal>
                <header className={styles.blockHead}>
                  <span className={styles.no}>04 · Release</span>
                  <h2 className={styles.h2}>
                    Pass, and PayPal captures. <em>Part pass, part release.</em>
                  </h2>
                  <p className={styles.blockLead}>
                    The buyer sees every verdict with its reasons and has a window to
                    object. Silence past the agreed window counts as acceptance. Every
                    state change is appended to a hash chain you can download.
                  </p>
                </header>
              </Reveal>
              <Reveal>
                <div className={`${styles.plate} ${styles.plateSurface}`}>
                  <ol className={styles.states}>
                    {states.map((s, i) => (
                      <li key={s.status} className={styles.state}>
                        <span className={styles.stateNo}>0{i + 1}</span>
                        <div className={styles.stateRail}>
                          <Rail status={s.status} variant="dots" still />
                        </div>
                        <h3>{s.title}</h3>
                        <p>{s.body}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </Reveal>
              <Triad
                items={[
                  {
                    pill: "Released",
                    title: "Every must-pass line passed",
                    body: "The full amount is captured and the seal is stamped. The record carries the PayPal capture id and the test's hash.",
                  },
                  {
                    pill: "Part released",
                    title: "The agreed share, no more",
                    body: "The test can say what a partial delivery is worth. That fraction is captured; the rest returns to the buyer.",
                  },
                  {
                    pill: "Returned",
                    title: "The hold is released",
                    body: "A decline or an expired window voids the authorization. Nothing was charged, and the record says so.",
                  },
                ]}
              />
            </section>

            {/* ---------- 5 when it goes wrong ---------- */}
            <section id="wrong" className={styles.block}>
              <Reveal>
                <header className={styles.blockHead}>
                  <span className={styles.no}>05 · When it goes wrong</span>
                  <h2 className={styles.h2}>
                    Objections go to review.{" "}
                    <em>Disputes go to PayPal with the file already made.</em>
                  </h2>
                  <p className={styles.blockLead}>
                    An objection reopens the line with the buyer's reason attached. You
                    can withdraw and resubmit, offer a partial release, or let the buyer
                    decline. After capture, PayPal decides, and Proofhold files the
                    evidence bundle.
                  </p>
                </header>
              </Reveal>
              <Reveal>
                <div className={`${styles.plate} ${styles.platePaper}`}>
                  <ol className={styles.review} aria-label="An objection, step by step">
                    <li>
                      <span className={styles.reviewWho}>Buyer · Bea Okafor</span>
                      <p className={styles.reviewMsg}>
                        “Concept C uses three colours, not two. A and B are fine.”
                      </p>
                      <span className={styles.reviewMeta}>
                        Objected inside the window · line 04 reopened · the clock stopped
                      </span>
                    </li>
                    <li>
                      <span className={styles.reviewWho}>Seller · Ada Mensah</span>
                      <p className={styles.reviewMsg}>
                        Offer: release 60% ($252.00) for A and B now; C is withdrawn.
                      </p>
                      <span className={styles.reviewMeta}>
                        Offer sent · the buyer can accept, or decline and the hold returns
                      </span>
                    </li>
                    <li>
                      <span className={styles.reviewWho}>PayPal</span>
                      <p className={styles.reviewMsg}>
                        Partial capture $252.00 · the remaining $168.00 released back to
                        the buyer.
                      </p>
                      <span className={styles.reviewMeta}>
                        Stamped PART CAPTURED · capture id on the record · hash chain
                        appended
                      </span>
                    </li>
                  </ol>
                </div>
              </Reveal>
              <Triad
                items={[
                  {
                    pill: "Objection",
                    title: "Review, with the reason attached",
                    body: "The buyer writes why. You see it beside the line, resubmit, or make an offer. The clock stops while you talk.",
                  },
                  {
                    pill: "Dispute",
                    title: "Evidence filed through Disputes v1",
                    body: "After a capture, the test, the checks, the files' hashes and the agreement go to PayPal as one bundle. Nothing to assemble under stress.",
                  },
                  {
                    pill: "Record",
                    title: "A printable record of every step",
                    body: "Who agreed, when, what passed, what moved and the PayPal ids. Hash-chained, exportable, and the same for both sides.",
                  },
                ]}
              />
            </section>

            {/* ---------- 6 what is real ---------- */}
            <section id="real" className={`${styles.block} ${styles.blockSurface}`}>
              <Reveal>
                <header className={styles.blockHead}>
                  <span className={styles.no}>06 · What is real</span>
                  <h2 className={styles.h2}>
                    Real, simulated, unproven. <em>Said on every page, not only here.</em>
                  </h2>
                </header>
              </Reveal>
              <Triad
                items={[
                  {
                    pill: "Real, in the sandbox",
                    title: "The PayPal surface",
                    body: "Order creation with intent AUTHORIZE, approval, authorization, reauthorization, capture, partial capture, void, tracking after capture, verified webhooks, dispute evidence filing, and sandbox dispute creation and adjudication.",
                  },
                  {
                    pill: "Simulated",
                    title: "Where credentials are missing",
                    body: "The shortened buyer window in demos; PayPal's dispute decision; the whole PayPal surface, the examiner and mail when the app runs without credentials. Each page then says so in its header.",
                  },
                  {
                    pill: "Unproven",
                    title: "What we do not yet know",
                    body: "Whether PayPal policy permits third-party conditional release at scale in production, and how accurate the examiner is on real-world deliverables beyond the shipped evaluation set.",
                  },
                ]}
              />
            </section>

            {/* ---------- 7 compare ---------- */}
            <section id="compare" className={styles.block}>
              <Reveal>
                <header className={styles.blockHead}>
                  <span className={styles.no}>07 · Compare</span>
                  <h2 className={styles.h2}>
                    Not an invoice, <em>not an escrow service, not a marketplace.</em>
                  </h2>
                  <p className={styles.blockLead}>
                    Invoices ask for money. Escrow takes custody of it. Proofhold does
                    neither: it binds a payment PayPal already holds to a test both sides
                    agreed to.
                  </p>
                </header>
              </Reveal>
              <Reveal>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">
                          <span className="sr-only">Question</span>
                        </th>
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
                        <td data-label="Invoice">Nobody; you wait</td>
                        <td data-label="Escrow service">The escrow company</td>
                        <td data-label="Marketplace">The platform</td>
                        <td className={styles.tableUs} data-label="Proofhold">
                          PayPal, as an authorization in the buyer's account
                        </td>
                      </tr>
                      <tr>
                        <th scope="row">What releases it</th>
                        <td data-label="Invoice">The buyer's goodwill</td>
                        <td data-label="Escrow service">
                          A support agent reading emails
                        </td>
                        <td data-label="Marketplace">Platform policy</td>
                        <td className={styles.tableUs} data-label="Proofhold">
                          A test both sides approved, checked line by line
                        </td>
                      </tr>
                      <tr>
                        <th scope="row">What it costs</th>
                        <td data-label="Invoice">Late payments</td>
                        <td data-label="Escrow service">A fee on every job</td>
                        <td data-label="Marketplace">A cut of every job</td>
                        <td className={styles.tableUs} data-label="Proofhold">
                          Standard PayPal fees on capture; nothing on voids
                        </td>
                      </tr>
                      <tr>
                        <th scope="row">When it goes wrong</th>
                        <td data-label="Invoice">Chasing</td>
                        <td data-label="Escrow service">Their process</td>
                        <td data-label="Marketplace">Their process</td>
                        <td className={styles.tableUs} data-label="Proofhold">
                          Partial release, void, or a PayPal dispute with the evidence
                          bundle already filed
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Reveal>
            </section>
          </div>
        </div>

        <section className={styles.cta}>
          <Reveal>
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
          </Reveal>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Brand />
            <p>
              A PayPal payment that is held until the agreed proof arrives. Write what
              “done” means; the buyer approves a hold against exactly that; deliver, and
              the checks decide.
            </p>
            <p className={styles.footerModes}>
              This deployment · {simulated ? "Simulated PayPal" : "PayPal sandbox"} ·
              Examiner {examinerLabel(system)} · Mail {system.mailMode}
            </p>
          </div>
          <nav className={styles.footerCol} aria-label="Product">
            <span className={styles.footerColTitle}>Product</span>
            <a href="#how">How it works</a>
            <a href="#release">Release and return</a>
            <a href="#real">What is real</a>
            <a href="#compare">Compare</a>
            <Link href="/app">Open the app</Link>
          </nav>
          <nav className={styles.footerCol} aria-label="Repository">
            <span className={styles.footerColTitle}>Repository</span>
            <a href={REPO}>Source on GitHub</a>
            <a href={`${REPO}#readme`}>README</a>
            <a href={`${REPO}/blob/main/docs/integration-checklist.md`}>
              Integration checklist
            </a>
            <a href={`${REPO}/blob/main/docs/acceptance-matrix.md`}>Acceptance matrix</a>
            <a href={`${REPO}/blob/main/docs/design.md`}>Design notes</a>
          </nav>
          <nav className={styles.footerCol} aria-label="Legal">
            <span className={styles.footerColTitle}>Legal</span>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <a href={`${REPO}/blob/main/LICENSE`}>MIT licence</a>
          </nav>
        </div>
        <div className={styles.footerBottom}>
          <p>
            Built for the{" "}
            <a href="https://paypalaihackathon.devpost.com/">PayPal AI Hackathon</a>,
            2026. What is real, simulated and unproven is stated in the app and the
            README.
          </p>
        </div>
      </footer>
    </div>
  );
}
