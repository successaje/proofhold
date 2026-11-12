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

- Next.js 16 and TypeScript; one app for the seller workspace, the buyer page and the API. SQLite locally, Postgres hosted. 155 unit tests, four Playwright journeys, an axe accessibility scan over eleven routes in both colour schemes, all in CI.
- PayPal Orders v2 (`intent: AUTHORIZE`), Payments v2 (capture, partial capture, reauthorize once after the honor period, void, refund), order tracking attached after capture, webhooks with signature verification plus reconciliation polling, and Disputes v1 (`provide-evidence`, and the sandbox-only `create`, `require-evidence` and `adjudicate`). A simulated PayPal client sits behind the same interface with the same state rules, so the app runs without credentials and says so on every page.
- One structured-output interface with two providers behind it, Claude through the Anthropic SDK or Gemini through the Interactions API, for two prompts: the compiler (brief → test) and the examiner (evidence → verdict with abstention). Evidence is passed as data, never as instructions. Without a key, a starter test is read from the brief's plain facts, and a labelled simulated examiner observes and abstains so the judgement path can be seen without ever releasing money.
- Production layer: security headers, same-origin checks on every mutation, rate limits, structured redacted logs with request ids, a health check, terms and privacy pages, backup and restore scripts, a mail adapter (Resend, or a simulated outbox), and a printable record.
- Run for real: the PayPal sandbox authorized, captured, part-captured and voided through Proofhold, and Gemini compiled a brief and judged real uploads. Ids and screenshots are in the repository.
- Four review passes and a production-build recording found and fixed more than sixty defects, each listed with evidence in `docs/acceptance-matrix.md`.

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
- Video: https://youtu.be/z0C_gWOIWqU (1:49, 1080p60, narrated, no captions; how it is made is in `docs/demo-script.md`)
- Judge sandbox credentials: _add a sandbox Personal account email and password in the Devpost private notes_
- Testing: open the hosted demo, name a workspace, use the example brief, and approve with the sandbox buyer in the private notes. The free host sleeps when idle, so the first load can take about a minute.

## AI tools and how they are used

- **Google Gemini** (Interactions API, structured output) runs inside the product in two places. The compiler turns a plain-language brief into an acceptance test: checks a machine can measure, the few judgement lines it cannot, and questions about anything the brief left unclear. The examiner looks at the delivered files and judges only those judgement lines, with a confidence and reasons that cite the files, and it may abstain. A decision engine, not the model, moves money, and an abstention never releases it.
- **Anthropic Claude** is supported behind the same interface as an alternative provider.
- **Gemini text-to-speech** narrates the demo video.
- **Claude Code** was used as a coding assistant throughout the build.

## Gallery (docs/devpost, 3:2)

Upload in this order. `thumbnail.jpg` is the project thumbnail.

1. `01-landing.jpg` — the landing: the claim, the start form, and the product itself.
2. `02-story.jpg` — "How it works" as one job in four moments, with the seal that both sides see.
3. `03-compose.jpg` — the brief, and the acceptance test Gemini compiled from it.
4. `04-buyer-approve.jpg` — what the buyer agrees to before approving a PayPal hold.
5. `05-verdicts.jpg` — every line says who decided it and why: validators, then the examiner's reasons.
6. `06-released.jpg` — the seal stamped CAPTURED beside the PayPal ids.
7. `07-ledger.jpg` — every hold in one ledger, with the inspector open.
8. `08-dispute.jpg` — after capture, a PayPal dispute with the evidence bundle filed.
9. `09-paypal-sandbox.jpg` — a run against the real PayPal sandbox: order, authorization and capture ids.
10. `10-landing-dark.jpg` — the dark theme.
11. `11-phones.jpg` — the landing, the buyer's page and the ledger on a phone.

## What is real, simulated and unproven

Copy the section from the README verbatim at submission time. As of 2026-11-11: order, approval, authorization and full capture have run against the PayPal sandbox through the app, with Gemini compiling the brief and judging the uploads (`docs/screens/sandbox-*.png`), and partial capture and void have run through the smoke script; the other PayPal calls (reauthorize, refund, tracking, disputes) are real in the client and exercised only against the simulator; the demo video's main take runs on the PayPal simulator with the real Gemini model, says so, and ends on the record of the sandbox run; mail is simulated into the outbox until a Resend key is set; whether PayPal policy permits third-party conditional release at scale in production is unproven.
