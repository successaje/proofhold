# Demo script (under three minutes)

Record with `PLAYWRIGHT_VIDEO=1 npm run test:browser` for the driven runs, or by hand against `npm run local` with `DEMO_SILENCE_MINUTES=1`.

| Time | On screen | Say |
|---|---|---|
| 0:00–0:20 | Landing hero | Freelancers get paid late; buyers paying strangers get scammed. Invoices enforce nothing, escrow takes custody and a fee. Proofhold binds a payment PayPal already holds to a test both sides agreed to. |
| 0:20–0:45 | Composer: paste brief, Compile, edit one line, Create | The brief becomes an acceptance test: counts, sizes, deadlines, and a judgement line. The seller edits; the buyer approves the final text. |
| 0:45–1:10 | Buyer page → PayPal approval → back with "Held" | The buyer approves an authorization, not a payment. The test's hash is in the PayPal order. PayPal holds the money; Proofhold cannot touch it. |
| 1:10–1:40 | Seller uploads three PNGs, submits; checks turn green; examiner verdict with reasons; buyer window | Validators measure the files. The examiner judges only what a machine cannot, with its confidence shown, and it may abstain. |
| 1:40–2:00 | Buyer confirms → "Released", capture id | PayPal captured. The history is hash-chained; the bundle downloads as JSON. |
| 2:00–2:35 | Flow C: thin delivery → blocked → objection → offer → decline → voided | A failing line blocks release. Objection goes to review; the seller offers a partial release; the buyer declines; PayPal voids and the money never left the buyer. |
| 2:35–2:50 | Released proofhold → open sandbox dispute → file evidence → adjudicate | After capture, PayPal decides. Proofhold files the evidence bundle through the Disputes API. Adjudication here is the sandbox-only endpoint, and the screen says so. |
| 2:50–3:00 | Settings page badges; README | What is real, simulated and unproven is on screen and in the README. Repo link. |

Rules: no third-party music, no trademarks beyond PayPal's own sandbox UI, state which steps are sandbox-only.
