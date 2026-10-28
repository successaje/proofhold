# Proofhold

**A PayPal payment that is held until the agreed proof arrives.**

A seller pastes a brief. Proofhold compiles it into an acceptance test: a short list of checks a machine can verify, plus the few judgement calls a human would make. The buyer approves a PayPal authorization against that exact test; its hash is written into the PayPal order. The seller delivers through Proofhold. Deterministic validators decide what they can, an AI examiner judges only what a machine cannot measure and is allowed to abstain, and a decision engine, not the model, captures, partially captures, voids, or hands PayPal the evidence bundle in a dispute. PayPal holds the money the whole time. Proofhold never does.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/). MIT licensed.

- Product model: [docs/product.md](docs/product.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- Build log: [docs/build-log.md](docs/build-log.md)

## The problem

Freelancers and private sellers get paid late or not at all; buyers paying strangers get scammed. The tools in between are invoices (which enforce nothing), escrow services (which take custody and a fee), and marketplaces (which take a cut and decide by policy). None of them bind the payment to a definition of "done" that both sides agreed to and a machine can check.

## What Proofhold does

| Step | What happens | PayPal object |
|---|---|---|
| Compose | Brief → acceptance test (Claude, structured output) → seller edits | — |
| Approve | Buyer reads the same test and approves with PayPal | Order with `intent: AUTHORIZE`, `custom_id` = test hash → authorization |
| Deliver | Files and tracking are checked: counts, types, dimensions, dpi, deadlines, sizes, carrier formats | — |
| Judge | The examiner scores judgement lines with a confidence and reasons, or abstains | — |
| Decide | Pure function over the test, the checks, the buyer's response and the clock | capture (full or partial), void, reauthorize once after the honor period |
| Dispute | After capture, PayPal decides; Proofhold files the evidence bundle | Disputes v1 `provide-evidence`; sandbox `create`, `require-evidence`, `adjudicate` |

Three kinds of check, and the UI says which is which:

- **Checked automatically.** Read from file headers and formats. No model.
- **Examiner.** Only for lines a machine cannot measure. Returns pass, fail or abstain with a confidence and reasons that cite the files. Below the threshold (default 0.8) it does not release.
- **Buyer.** Can confirm at any time, object within the window, or accept a partial offer. The buyer's word outranks the examiner on their own money.

## What is real, simulated and unproven

- **Real (PayPal sandbox):** order creation, buyer approval, authorization, reauthorization, full and partial capture, void, refund, order tracking, webhook signature verification, dispute evidence filing, and the sandbox-only dispute create and adjudicate calls. All in [`src/lib/paypal/rest.ts`](src/lib/paypal/rest.ts).
- **Simulated:** when `PAYPAL_MODE=simulated` (the default without credentials) an in-process simulator with the same interface and state rules stands in, and the UI badges it on every page. The sandbox dispute adjudication is a sandbox-only endpoint, labelled as such in the product. Buyer windows can be shortened for demos with `DEMO_SILENCE_MINUTES`.
- **Unproven:** whether PayPal policy permits a third party to run conditional release at scale in production, and how accurate the examiner is on real deliverables beyond the shipped evaluation set. Identity is a signed cookie per browser; production would add a real sign-in.

## Run it locally

Requires Node 24.

```bash
npm ci
npm run local
```

Open http://127.0.0.1:3200/app. Without any keys the app runs with simulated PayPal and the examiner off: briefs get a starter test and judgement lines fall to the buyer. To use the real integrations, copy `.env.example` to `.env.local` and set:

| Variable | Purpose |
|---|---|
| `PAYPAL_MODE=sandbox`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | A REST app on a sandbox Business account. Buyers approve with a sandbox Personal account. |
| `PAYPAL_WEBHOOK_ID` | Optional. Register with `npx tsx scripts/register-webhook.ts https://your-host` on a public URL. Polling keeps holds in step without it. |
| `ANTHROPIC_API_KEY` | Turns on the compiler and the examiner. `ANTHROPIC_MODEL` defaults to `claude-opus-5-5`. |
| `DEMO_SILENCE_MINUTES` | Shortens buyer windows for demos. |

Useful scripts:

```bash
npm run seed                          # a workspace with three demo proofholds, prints the cookie and links
npx tsx scripts/paypal-smoke.ts       # prove the sandbox: authorize → partial capture → void
npm run eval                          # examiner over the labelled cases (needs ANTHROPIC_API_KEY)
```

## Testing

```bash
npm test             # unit: schema and hashing, state machine, validators, decision engine, simulator, full lifecycle
npm run test:browser # Playwright flows A (service), B (goods), C (objection → offer → void) against a local app
npm run typecheck && npm run lint
```

The browser flows are the demo: run them with `PLAYWRIGHT_VIDEO=1` to record.

## Examiner evaluation

`eval/cases.ts` holds 30 labelled cases across copy, data, code and image deliverables, including cases where the only honest answer is to abstain. `npm run eval` prints agreement, pass/fail/abstain counts and, the number that matters, false releases (label fail or abstain, examiner pass above the threshold). Results are written to `eval/results.json` and pasted here as they come out.

_Not yet run against a model in this repository; the numbers will be added when an API key is available._

## Deploy

[`render.yaml`](render.yaml) describes a Render web service (Node runtime, inline scheduler) with a free Postgres database. Set `PAYPAL_*` and `ANTHROPIC_API_KEY` in the dashboard, then register the webhook against the public URL. Any Node host works: `npm run build && npm start` with `PROOFHOLD_STORE=postgres` and `DATABASE_URL`.

## Repository

```
src/app/            routes: / (landing), /app/* (seller), /p/[token] (buyer), /sim/paypal (simulator), /api/*
src/components/     ui (design system), shell, proofhold (test view, delivery, hold card, history), landing
src/lib/domain/     acceptance test schema and hashing; proofhold state machine
src/lib/compiler/   brief → test (Claude) and starter templates
src/lib/validators/ image header parsing and deterministic checks
src/lib/examiner/   judgement prompt with abstention
src/lib/decision/   the decision engine (pure)
src/lib/proofholds/ lifecycle services: compose, approval, evidence, release, buyer, disputes, reconcile, bundle
src/lib/paypal/     REST client (sandbox) and simulator behind one interface
src/lib/scheduler/  tick: examine, close windows, reauthorize, expire, reconcile
src/lib/store/      SQLite/Postgres adapters, migrations, repositories
src/lib/audit/      hash chain
scripts/            local start, seed, sandbox smoke test, webhook registration, eval
eval/               labelled examiner cases
tests/unit          node:test suites
tests/browser       Playwright flows
docs/               product model, architecture, build log
```

## License

MIT. See [LICENSE](LICENSE).
