# Proofhold design

How the product looks, why, and which patterns it borrows. Companion to [product.md](product.md) (what it is) and [brand.md](brand.md) (the kit).

## Research: patterns worth borrowing

Looked at on 2026-10-28, in the built-in browser, at phone width. Principles only; no branding or composition is copied.

| Product                                                 | Pattern that helps our users                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Linear](https://linear.app)                            | The hero is the product itself: a real issue with a real activity feed, not a screenshot. Density and a monospace meta line make state legible. We do the same: the landing hero is a real proofhold rendered by the real components, and the audit chain is first-class on every detail page. |
| [Mercury](https://mercury.com)                          | Calm typography, few colours, and the honest regulatory line sits in the hero rather than the footer. Our "simulated / sandbox / unproven" statements sit at the point of decision, not only in the README.                                                                                    |
| [Stripe Checkout](https://stripe.com/payments/checkout) | The checkout page pattern: a fixed summary of what you are paying for, one unmistakable action, trust copy under the button. The buyer page is built as that: the test is the summary, approval is the one action.                                                                             |
| [Escrow.com](https://www.escrow.com)                    | Category reference. The five-step "agree, pay, deliver, approve, release" rail is the right mental model, and the "I'm selling X for $800" instant-start form is good onboarding. The dated generic-blue look is what we avoid.                                                                |
| [Dropbox Sign](https://sign.dropbox.com)                | The signing ceremony: recipients review and sign without an account; the signed state is visible on the document. Our buyer needs no account, and the sheet shows who agreed and when, with the hash.                                                                                          |

## Three directions

**A. The notarised ledger.** Warm paper, black ink, a ruled margin, a circular seal. Fraunces for display at large optical sizes, Inter for UI, JetBrains Mono for every identifier. Colour is reserved for verdicts and the brand teal. Signature detail: the Seal, a stamp whose ring is segmented per line of the test and whose face is stamped CAPTURED or RETURNED when the money moves. Fits freelancers, makers and private sellers: it reads like an agreement, not a dashboard.

**B. The instrument panel.** Dark, dense, precise. Cool neutrals, signal colours only, monospace-led, a persistent state rail like a flight-strip. Signature detail: a live lifecycle rail with the scheduler's next action. Strong for developers and operators; too cold for a buyer who is being asked to approve $420 for a stranger's logo work.

**C. The receipt tape.** High-contrast, thermal-receipt typography, perforated edges, the test "prints" line by line. Signature detail: the printing animation. Charming and memorable, but it makes a four-figure contract feel like a lunch receipt, and the novelty wears thin on the fifth visit.

**Decision: A, with B's rail.** The ledger direction fits both audiences and the product's claim (a legible contract bound to a hold). The lifecycle rail from B is kept because it answers "where are we?" on every page. C's printing animation is dropped; its energy goes into the stamp instead.

## The identity in the product

- **The Seal** (`src/components/proofhold/seal.tsx`). A circular stamp. The ring is divided into one arc per line of the acceptance test; each arc takes the verdict's colour as checks come in. The face shows the amount and who holds it ("HELD BY PAYPAL"). When money moves the face is stamped: CAPTURED (full), PART CAPTURED, RETURNED, DISPUTED, or REFUNDED. It is the hold card on the seller and buyer pages, the hero on the landing, the row marker on the list, and the social preview.
- **The Sheet** (`TestView`). The acceptance test rendered as a ruled page: a numbered margin, the line text, the check in monospace, the verdict stamp. The foot of the sheet carries the agreement: who agreed and when on each side, and the hash that was written into the PayPal order.
- **The Rail** (`src/components/proofhold/rail.tsx`). Proposed, Held, Checking, Buyer window, then Released or Returned. The current step is filled. Shown under the title on detail and buyer pages, and used on the landing to explain the mechanism with the same words the app uses.
- **Wordmark and mark.** "Proofhold" in Fraunces. The mark is a ring with a tick whose tail leaves the ring: a hold, and the release that ends it.

### Motion

Three durations (120, 180, 280 ms), one ease-out. The stamp lands with a short scale-down and settle; ring arcs draw in when a verdict arrives; status dots pulse only while something is genuinely in progress. Under `prefers-reduced-motion`, every transition collapses to an instant change and nothing pulses.

### Voice

Plain and declarative. Name PayPal when PayPal is doing something. Say what is simulated where it matters. Figures, not words, for money and time. No exclamation marks, no "seamless", no promises about the future.

## Feature inventory

The demonstrable build. Each row names the screen, the backend operation, the data it touches, and the executable check that proves it. Status is in [acceptance-matrix.md](acceptance-matrix.md).

| Capability                                  | Screen                          | Backend                                                                 | Data                                         | Test                                       |
| ------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------ |
| Start a workspace                           | `/app/start`                    | `POST /api/workspace`                                                   | `workspaces`, signed cookie                  | Playwright `startWorkspace`                |
| Compose a proofhold from a brief            | `/app/new`                      | `POST /api/compile`, `POST /api/proofholds`, `POST …/propose`           | `proofholds` (test, hash)                    | Flows A–D `composeAndSend`                 |
| Start from the landing with kind and amount | `/` → `/app/new?kind&amount`    | none (query prefill)                                                    | none                                         | Flow A prelude                             |
| Reuse a past test                           | `/app/h/[id]` → `/app/new?from` | server read of the source proofhold                                     | none                                         | Flow A tail                                |
| Buyer reads and approves with PayPal        | `/p/[token]`                    | `POST /api/p/[token]/approve`, `/api/paypal/return`                     | PayPal order + authorization, audit          | `approveAsBuyer`                           |
| Deliver files or tracking, run checks       | `/app/h/[id]`                   | `POST …/evidence`, `…/tracking`, `…/submit` (validators, examiner)      | `evidence`, `checks`, `decisions`            | Flows A–C                                  |
| Buyer confirms or objects                   | `/p/[token]`                    | `POST /api/p/[token]/confirm` / `object`                                | `messages`, `decisions`, PayPal capture/void | Flows A–C                                  |
| Silence release                             | scheduler                       | `POST /api/internal/tick`                                               | `decisions`                                  | `tests/unit/lifecycle.test.ts`             |
| Partial offer, accept or decline            | both                            | `…/offer`, `/api/p/[token]/offer/accept                                 | decline`                                     | `decisions`, PayPal partial capture + void | Flow C |
| Dispute after capture, file evidence        | both                            | `/api/p/[token]/dispute/open`, `…/dispute/file`, `…/dispute/adjudicate` | PayPal dispute, audit                        | Flow D                                     |
| Outcome ledger and time to release          | `/app`                          | read                                                                    | `proofholds`                                 | Flow A tail                                |
| Record export                               | both                            | `GET …/bundle`                                                          | audit chain, checks, evidence hashes         | unit `store`, manual                       |
| Sign out                                    | `/app/settings`                 | `DELETE /api/workspace`                                                 | cookie                                       | manual                                     |

**Non-goals for this build:** template marketplace, reputation, human verifier network, Payouts or multiparty, live PayPal, native apps, accounts with passwords, email delivery.
