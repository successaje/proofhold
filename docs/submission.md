# Devpost submission draft

Fill in the hosted URL, the YouTube link and the judge credentials before submitting. Every claim here must match the README's "real, simulated and unproven" section and `docs/integration-checklist.md`. Gallery images are in `docs/screens/`.

## Project name

Proofhold

## Tagline

A PayPal payment that is held until the agreed proof arrives.

## About the project

### Inspiration

Freelancers get paid late or not at all; buyers paying strangers get scammed. The tools in between do not help: invoices enforce nothing, escrow services take custody and a fee, marketplaces take a cut and decide by policy. We wanted a payment bound to a definition of "done" that both sides agreed to, checked by a machine where a machine can check it, and held by PayPal rather than by us.

### What it does

A seller writes the brief. Proofhold compiles it into an acceptance test: a short list of checks (file counts and formats, dimensions, dpi, deadlines, carrier tracking formats) plus the few judgement calls a human would make. The buyer reads the same test as a ruled sheet with both signatures and approves a PayPal authorization against it; the test's hash is written into the PayPal order as `custom_id`. The seller delivers through Proofhold. Deterministic validators decide what they can. An AI examiner judges only the lines a machine cannot measure, shows its reasons and confidence, and may abstain. A decision engine, not the model, captures in full, captures the agreed partial share, voids, or, after capture, files the evidence bundle with PayPal's dispute process.

Around that core: notifications and reminders to both sides at every state change, a printable record that doubles as the receipt, a ledger with search and CSV export, a hash-chained history either party can download, and a seal on every page that shows where the money is, one arc per line of the test, stamped when it moves.

### How we built it

- Next.js 16 and TypeScript; one app for the seller workspace, the buyer page and the API. SQLite locally, Postgres hosted. 128 unit tests, four Playwright journeys, an axe accessibility scan over eleven routes in both colour schemes, all in CI.
- PayPal Orders v2 (`intent: AUTHORIZE`), Payments v2 (capture, partial capture, reauthorize once after the honor period, void, refund), order tracking attached after capture, webhooks with signature verification plus reconciliation polling, and Disputes v1 (`provide-evidence`, and the sandbox-only `create`, `require-evidence` and `adjudicate`). A simulated PayPal client sits behind the same interface with the same state rules, so the app runs without credentials and says so on every page.
- One structured-output interface with two providers behind it, Claude through the Anthropic SDK or Gemini through the Interactions API, for two prompts: the compiler (brief → test) and the examiner (evidence → verdict with abstention). Evidence is passed as data, never as instructions. Without a key, a starter test is read from the brief's plain facts, and a labelled simulated examiner observes and abstains so the judgement path can be seen without ever releasing money.
- Production layer: security headers, same-origin checks on every mutation, rate limits, structured redacted logs with request ids, a health check, terms and privacy pages, backup and restore scripts, a mail adapter (Resend, or a simulated outbox), and a printable record.
- Two independent critique passes, thirty-six findings, all fixed and listed with evidence in `docs/acceptance-matrix.md`.

### Challenges we ran into

- PayPal only accepts tracking against a capture, so delivery for goods is proven by the buyer's confirmation or silence, and the tracker is attached once money moves.
- Reauthorization is allowed once from day four to day 29; the scheduler reauthorizes exactly once after the honor period.
- Disputes exist only for captured transactions, so the product splits cleanly: before capture Proofhold decides, after capture PayPal decides and Proofhold supplies the evidence.
- A reviewer found that evidence could be changed under a live verdict. Evidence is now frozen once submitted; changing it is a "withdraw and resubmit" that cancels the verdicts and tells the buyer.
- The first version of the simulated examiner passed lines with a confidence figure, which could have released money by silence in a demo. It now only observes and abstains.

### Accomplishments we are proud of

The decision engine is a pure function with tests for every path: release, partial release under an agreed rule, blocked by a failed or abstained line, review after objection. Abstention is a first-class outcome that never releases money. The buyer's word outranks the model on their own money. And the interface is its own: the Seal, the Sheet and the Rail read as one system in light and dark, and the printed record is a document a freelancer could attach to a dispute.

### What we learned

Most of the product is in the authorization hold; the AI's job is to make the contract legible and to judge only what cannot be measured. Honesty about what is simulated reads better than a headline accuracy number, and an adversarial review of your own build is worth more than another feature.

### What's next

Login with PayPal for sellers, templates from past tests, a verified-human fallback for abstentions, and a conversation with PayPal about running conditional release in production.

## Built with

Next.js, React, TypeScript, Node.js, SQLite, PostgreSQL, PayPal REST APIs (Orders v2, Payments v2, Order Tracking, Webhooks, Disputes v1), Anthropic Claude or Google Gemini (structured outputs), Resend, Playwright, axe, Render.

## Links

- Repository: https://github.com/successaje/proofhold (MIT)
- Hosted demo: _add Render URL_
- Video: _add YouTube URL_ (upload `demo-video/proofhold-demo.mp4`, 1:53, with `proofhold-demo.srt` as captions; regenerate with `npm run demo:video`)
- Judge sandbox credentials: _add a sandbox Personal account email and password in the Devpost private notes_
- Demo workspace: run `npm run seed` on the hosted instance and paste the printed cookie, or use the judge workspace link in the private notes

## Gallery (docs/screens)

1. `landing.png` — the hero: the two-tone headline, the start form, and the product itself on a teal band.
2. `ledger.png` — the seller's ledger with every state: sidebar with live counts, numbered rows, verdict rings, search, buckets, sort and CSV.
   2b. `ledger-inspector-1440.png` — the inspector open beside the list: seal, status, next step and the PayPal ids without leaving the page.
3. `buyer-approve.png` — what the buyer agrees to: the sheet, both signatures, the hash, and the questions.
4. `seller-window-open.png` — checks passed, the buyer window open, the seal half-lit.
5. `buyer-decide.png` — a blocked line routed to the buyer: no deadline, confirm or object.
6. `seller-released.png` — the seal stamped CAPTURED beside the PayPal capture id.
7. `buyer-receipt.png` — the printable record and receipt.
8. `seller-in-review.png`, `seller-disputed.png` — the failure paths: an objection with an offer, and a PayPal dispute with the evidence bundle filed.
9. `settings-outbox.png` — every notification, in the simulated outbox.
10. `landing-375.png`, `buyer-approve-375.png`, `buyer-decide-375.png`, `seller-released-375.png`, `ledger-375.png` — phone width.
11. `landing-dark.png`, `seller-released-dark.png` — dark scheme.

12. `sandbox-seller-held.png`, `sandbox-seller-blocked.png`, `sandbox-buyer-decide.png`, `sandbox-seller-released.png`, `sandbox-buyer-receipt.png` — the same journey against the real PayPal sandbox with the Gemini examiner: a $420.00 authorization, two judgement lines failed with reasons, the buyer's decision, and PayPal's capture id in the history.

## What is real, simulated and unproven

Copy the section from the README verbatim at submission time. As of 2026-11-11: order, approval, authorization and full capture have run against the PayPal sandbox through the app, with Gemini compiling the brief and judging the uploads (`docs/screens/sandbox-*.png`), and partial capture and void have run through the smoke script; the other PayPal calls (reauthorize, refund, tracking, disputes) are real in the client and exercised only against the simulator; the demo video was recorded in simulated mode and says so; mail is simulated into the outbox until a Resend key is set; whether PayPal policy permits third-party conditional release at scale in production is unproven.
