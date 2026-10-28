# Devpost submission draft

Fill in the hosted URL and the YouTube link before submitting. Keep every claim consistent with the README's "real, simulated, unproven" section.

## Project name

Proofhold

## Tagline

A PayPal payment that is held until the agreed proof arrives.

## About the project

### Inspiration

Freelancers get paid late or not at all; buyers paying strangers get scammed. The tools in between do not help: invoices enforce nothing, escrow services take custody and a fee, marketplaces take a cut and decide by policy. We wanted a payment that is bound to a definition of "done" both sides agreed to, checked by a machine where a machine can check it, and held by PayPal rather than by us.

### What it does

A seller pastes a brief. Proofhold compiles it into an acceptance test: a short list of checks (file counts, types, dimensions, dpi, deadlines, carrier tracking formats) plus the few judgement calls a human would make. The buyer reads the same test and approves a PayPal authorization against it; the test's hash is written into the PayPal order as `custom_id`. The seller delivers through Proofhold. Deterministic validators decide what they can. An AI examiner judges only the lines a machine cannot measure, shows its confidence and reasons, and may abstain. A decision engine, not the model, then captures in full, captures the agreed partial share, voids, or, after capture, files the evidence bundle with PayPal's dispute process. Every state change is hash-chained; either party can download the record.

### How we built it

- Next.js 16 and TypeScript, one app for the seller workspace, the buyer page and the API; SQLite locally, Postgres hosted.
- PayPal Orders v2 (`intent: AUTHORIZE`), Payments v2 (capture, partial capture, reauthorize, void, refund), order tracking attached after capture, webhooks with signature verification plus reconciliation polling, and Disputes v1 (`provide-evidence`, and the sandbox-only `create`, `require-evidence` and `adjudicate`).
- Claude through the Anthropic SDK with structured outputs for two prompts: the compiler (brief → test) and the examiner (evidence → verdict with abstention). Evidence is passed as data, never as instructions.
- A simulated PayPal client behind the same interface, with PayPal's state rules (29-day authorization, 3-day honor period, one reauthorization, partial and final capture), so the app runs without credentials and the UI says so on every page.
- 61 unit tests and four Playwright flows that double as the demo recording.

### Challenges we ran into

- PayPal only accepts tracking against a capture, so delivery for goods is proven by the buyer's confirmation or silence and the tracker is attached once money moves.
- Reauthorization is allowed once from day four to day 29, not repeatedly as some docs suggest; the scheduler reauthorizes exactly once after the honor period.
- Disputes exist only for captured transactions, so the product splits cleanly: before capture Proofhold decides, after capture PayPal decides and Proofhold supplies the evidence.
- Sandbox webhooks can drop events, so polling is the primary path and webhooks only accelerate it.

### Accomplishments we are proud of

The decision engine is a pure function with tests for every path: release, partial release under an agreed rule, blocked by a failed or abstained line, review after objection. The examiner's abstention is a first-class outcome that never releases money. The buyer's word outranks the model on their own money.

### What we learned

Most of the product is in the authorization hold; the AI's job is to make the contract legible and to judge only what cannot be measured. Honesty about what is simulated reads better than a headline accuracy number.

### What's next

Login with PayPal for sellers, templates built from past tests, a verified-human fallback for abstentions, and a conversation with PayPal about running conditional release in production.

## Built with

Next.js, React, TypeScript, Node.js, SQLite, PostgreSQL, PayPal REST APIs (Orders v2, Payments v2, Order Tracking, Webhooks, Disputes v1), Anthropic Claude (structured outputs), Playwright, Render.

## Links

- Repository: https://github.com/successaje/proofhold (MIT)
- Hosted demo: _add Render URL_
- Video: _add YouTube URL (under 3 minutes)_
- Judge sandbox credentials: _add a sandbox Personal account email and password in the Devpost private notes_

## What is real, simulated and unproven

Copy the section from the README verbatim.
