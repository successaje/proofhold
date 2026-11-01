# Comparison with the products people use today

Looked at on 2026-11-01 as products, not as marketing: how they notify, what record they leave, how they handle the failure path, and what they do about security and operations. The gap list at the end is the work order for the production pass.

| Product                                                                                                                   | What it does well for this job                                                                                                                                         | What Proofhold does differently                                                                                                                                                         | Gap Proofhold had before this pass                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [Stripe Invoicing](https://stripe.com/invoicing)                                                                          | The invoice is an email first: amount, due date, memo, one button, a downloadable PDF. Hosted invoice page with a numbered record. Reminders. Receipts after payment.  | The document is an acceptance test, not a line-item invoice; the money is reserved before delivery rather than requested after.                                                         | No email at all; no printable record; no receipt after capture; no reminders; no numbered reference a person can quote. |
| [PayPal Invoicing](https://www.paypal.com/us/business/accept-payments/invoice)                                            | Send by link, email, SMS or QR; track sent, opened, paid; templates; automatic reminders; the buyer needs no account.                                                  | Same reach (one link, no buyer account), but the payment is an authorization held against a test, so "paid" is replaced by "held, checked, released".                                   | No "opened" signal; no reminders; no templates beyond reuse.                                                            |
| [Upwork fixed-price protection](https://support.upwork.com/hc/en-us/articles/211062568-How-Upwork-protects-your-payments) | Funds deposited before work; work submitted for approval; **automatic release 14 days after submission if the client does nothing**; disputes handled by the platform. | The same silence rule with the window written into the test, and deterministic checks plus an examiner instead of a platform reading emails. PayPal, not the platform, holds the money. | Nothing structural; Upwork's record is richer (messages, revisions) and it emails every state change.                   |
| [Bonsai](https://www.hellobonsai.com/invoicing)                                                                           | Branded invoices, reminders, "seen" receipts, multi-currency, client records, CSV and accounting sync.                                                                 | Brand is the seller's name and the hash-chained record rather than a logo and colour picker.                                                                                            | No CSV export; no search or filter on the ledger; no workspace data export or deletion.                                 |
| [Escrow.com](https://www.escrow.com) (from the design pass)                                                               | Named five-step process; both parties see the same status; a human support process when it goes wrong.                                                                 | The five-step rail on every page; the failure path is partial release, void, or a PayPal dispute with the evidence bundle already filed.                                                | Terms and privacy pages; a help surface for the buyer's "what happens if…" questions.                                   |

## What "production grade" means here, and what was missing

Grouped by the sections of the brief. Each item names the PR that closes it.

**Protect users and their data** (PR A)

- Security headers: Content-Security-Policy, HSTS (on HTTPS), X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-Frame-Options.
- Cross-site request forgery: every mutating API route checks that `Origin` or `Sec-Fetch-Site` matches the app URL; the session cookie is `SameSite=Lax`, `HttpOnly`, `Secure` on HTTPS.
- Rate limits on the public surfaces: workspace creation, buyer-token actions, file uploads, PayPal return handlers.
- Request-body size limits on JSON routes.
- Structured, redacted request logs with a request id; the id is shown on the error page so a report can be matched to a log line.
- A health endpoint that checks the database, reports the PayPal and examiner modes, and the scheduler's last tick.
- Terms and privacy pages that say what is collected, kept and deleted, without compliance claims.
- Backup and restore scripts for SQLite and Postgres, with a verified restore path; a reset script that refuses to touch a Postgres database without an explicit flag.
- A web app manifest and theme colour.

**Make every interaction intentional** (PR B, PR C, PR D)

- Email at every state change, through a provider adapter with a simulated outbox the seller can read in Settings when no provider is configured.
- Reminders: to the buyer before a window closes, to the seller before a hold expires.
- A printable record of the agreement and the decision (print stylesheet and a record page), and a receipt page after capture.
- Ledger search, status filter, sort and CSV export; workspace data export and deletion.
- A simulated examiner, labelled as such on every page it touches, so the judgement path runs end to end without an API key.
- Motion with a job: ring arcs draw in as verdicts arrive, the current rail step breathes only while something runs, rows lift on hover, the stamp lands once.
- Buyer page: a short "what happens if…" list, the seller's standing (since when, how many released), and a plain fee line.
- Skip link, focus moved to the page title after client navigation, metadata on every page.

**Measure before making performance claims** (PR D)

- Numbers from a production build, not only the development server.

## Non-goals, still

Accounts with passwords, a marketplace, reputation, multiparty payouts, live PayPal, native apps, SMS.
