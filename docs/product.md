# Proofhold product model

This document is the north star for everything in the repository. Screens, routes, data and prompts are derived from it, not the other way round.

## Thesis

A PayPal payment that is held until the agreed proof arrives.

A seller writes down, in plain words, what "done" means. Proofhold compiles that into an acceptance test: a short list of checks, each with the kind of evidence that satisfies it. The buyer approves a PayPal authorization against that exact test. PayPal holds the money; Proofhold never does. When evidence arrives, deterministic validators run first, an AI examiner judges only what cannot be checked mechanically and may abstain, and a decision engine, not the model, captures, partially captures, voids, or escalates into a PayPal dispute with the evidence bundle attached.

Invoices ask for money. Escrow services take custody of it. Proofhold does neither: it binds a payment PayPal already holds to a test both sides agreed to.

## Core user

**Primary: the seller.** A freelancer, maker or private seller delivering one-off work or goods to someone they do not fully trust: a logo set, a landing page, a used phone, a repaired instrument. They create the proofhold, send the link, deliver, and get paid without chasing.

**Secondary: the buyer.** Someone paying a stranger who wants the comfort of "I only pay if I get what we agreed" without a lawyer, an escrow fee or a marketplace cut. They approve, receive, and confirm or object.

Both sides are consumers of the same object. Neither needs to install anything. Only the seller needs an account.

## Core action

Create a proofhold and get paid when proof arrives.

Everything else in the product exists to make that one action trustworthy: the compiled test makes the terms legible, the PayPal hold makes the buyer's commitment real, the checks make the release explainable, and the dispute path makes failure survivable.

## Product loop

1. A new job arrives. The seller opens Proofhold instead of writing an invoice.
2. They paste the brief. The test comes back in seconds. They adjust a line or two.
3. The buyer approves with PayPal. Both sides now have a shared, hashed definition of done.
4. The seller delivers through Proofhold. Checks turn green, the hold is captured, the seller sees the PayPal capture id.
5. The history page shows every job, what was released, why, and how long it took. Past tests become the starting point for the next one.

What brings the seller back is the shortest route from "we agreed" to "I was paid", with a record they can point to when something goes wrong.

## The magical interaction

The seller pastes three sentences of a brief and watches it turn into a checklist a machine can verify, with a note on what the brief left unclear. Then, later, they drop files on the page and see each line verified with a reason, followed by "Released by PayPal" and a capture id. That is the moment: the contract wrote itself, and the money moved because the work matched it.

## Why PayPal

PayPal's authorization hold is the enabling primitive. An `AUTHORIZE` order keeps funds reserved for up to 29 days with a 3-day honor period and unlimited reauthorizations inside that window, which gives Proofhold a custody-free escrow. Payments v2 supports full and partial capture and void. Shipment Tracking gives a carrier-independent delivery signal for goods. The Disputes API provides a real fallback arbiter when the parties disagree, and the sandbox-only adjudicate endpoint lets the whole failure path run end to end in a demo. No other consumer payments platform exposes all four to a third-party app in a free sandbox.

## What is real, simulated and unproven

The product says this on screen, not just in the README.

- **Real (sandbox):** order creation with intent AUTHORIZE, buyer approval, authorization, reauthorization, capture, partial capture, void, order tracking attached after capture, webhooks with signature verification, dispute evidence filing, and the sandbox-only dispute creation and adjudication.
- **Simulated:** the shortened buyer window during demos, PayPal's dispute decision (sandbox `adjudicate`), and the whole PayPal surface when the app runs without sandbox credentials (`PAYPAL_MODE=simulated`, clearly badged). Carrier delivery is not queried: the tracking number's format is checked on submission, and receipt is the buyer's confirmation or silence.
- **Unproven:** whether PayPal policy permits a third party to run conditional release at scale in production, and how accurate the examiner is on real-world deliverables beyond the shipped evaluation set.

## Essential flows

| Flow           | What happens                                                                                                                                                                                                                                                    | Screen        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| First visit    | Landing explains the mechanism with a live example of a compiled test. Primary action: "Create a proofhold".                                                                                                                                                    | `/`           |
| Onboarding     | A workspace is created with a name and payout email. No password; a signed cookie identifies the browser, with a recovery link by email when mail is configured.                                                                                                | `/app/start`  |
| Primary action | Compose: brief, amount, kind of job, deadline. Compile. Edit the test. Create.                                                                                                                                                                                  | `/app/new`    |
| Confirmation   | The proofhold page shows the test, its hash, and the buyer link to share.                                                                                                                                                                                       | `/app/h/[id]` |
| Buyer approval | Buyer reads the same test, approves with PayPal, returns. Authorization id shown with "held by PayPal, not by Proofhold".                                                                                                                                       | `/p/[token]`  |
| Delivery       | Seller uploads files or records a carrier tracking number. Validators run immediately. Examiner runs on judgement lines. Staged progress is shown. After capture, the tracker is attached to the PayPal order (PayPal only accepts tracking against a capture). | `/app/h/[id]` |
| Buyer window   | Buyer sees the evidence and verdicts, confirms, or objects with a reason. Silence releases after the agreed window.                                                                                                                                             | `/p/[token]`  |
| Result         | Capture (full or partial), void, or dispute. PayPal ids visible. Audit chain exportable.                                                                                                                                                                        | both          |
| History        | All proofholds with status, amount, outcome, and time to release.                                                                                                                                                                                               | `/app`        |
| Error recovery | Expired hold, declined capture, webhook silence, examiner unavailable, PayPal unreachable: each has a named state, an explanation, and a next step.                                                                                                             | everywhere    |
| Returning user | The workspace cookie brings the seller back to their list. Active holds show time remaining.                                                                                                                                                                    | `/app`        |

## Decision policy (the part the model never owns)

- Validators decide `pass` or `fail` on their own for file, deadline, tracking and buyer-confirmation checks.
- The examiner may return `pass`, `fail` or `abstain` with a confidence. Any `abstain`, or `pass` with confidence under the threshold, on a must-pass line blocks release and routes to the buyer.
- Release happens when every must-pass line passes and either the buyer confirms or the silence window ends without objection.
- Partial release follows the rules in the test, never a model's suggestion.
- Objection within the window moves the proofhold to review; the seller may propose a partial release; the buyer accepts or declines; a decline voids the hold and the money never left the buyer.
- Before capture, Proofhold decides. After capture, PayPal decides: a dispute is opened against the capture and Proofhold files the evidence bundle through the Disputes API.
- Every state transition is appended to a hash chain so either party can export what happened.

## Non-goals for this release

Template marketplace, reputation, human verifier network, connectors beyond file upload and PayPal tracking, Payouts and multiparty, live (non-sandbox) PayPal, native apps.
