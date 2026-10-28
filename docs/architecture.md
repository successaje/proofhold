# Architecture

One Next.js application serves the marketing site, the seller workspace, the buyer pages and the API. A scheduler runs inside the same process. Storage is SQLite locally and Postgres when hosted. There is nothing else to run.

```
┌──────────────────────────────────────────────────────────────┐
│  Next.js (App Router)                                        │
│                                                              │
│  /            marketing                                      │
│  /app/*       seller workspace (cookie session)              │
│  /p/[token]   buyer pages (capability URL)                   │
│  /api/*       route handlers (JSON) + PayPal webhook + return│
│                                                              │
│  src/lib                                                     │
│   ├─ domain/     types, state machine, decision engine       │
│   ├─ compiler/   brief → acceptance test (Claude, zod)       │
│   ├─ validators/ deterministic checks (files, dates, track)  │
│   ├─ examiner/   judgement checks (Claude, abstain)          │
│   ├─ paypal/     REST client + simulated client (same iface) │
│   ├─ scheduler/  reauthorize, silence windows, reconcile     │
│   ├─ store/      sql adapters (sqlite | postgres), repos     │
│   ├─ audit/      hash chain                                  │
│   └─ session/    workspace cookie, buyer tokens              │
└──────────────────────────────────────────────────────────────┘
```

## Request paths

- **Pages** are server components that read from the store and render. Interactive pieces (compose form, upload, approve button, timers) are client components fed by props.
- **Mutations** go through route handlers under `/api` so the same endpoints serve the UI, the Playwright tests and the seed scripts. Server actions are used only for trivial forms.
- **PayPal → Proofhold**: `/api/paypal/webhook` verifies the signature, stores the raw event, then feeds it to the state machine. `/api/paypal/return` receives the buyer after approval and performs the authorization call.
- **Scheduler**: `instrumentation.ts` starts a loop when `PROOFHOLD_SCHEDULER=inline` (the default). Each tick reauthorizes holds inside their window, closes silence windows, reconciles PayPal state for active holds, and runs pending examiner jobs. `/api/internal/tick` runs the same tick for external cron.

## Trust boundaries

- Money moves only in `src/lib/domain/decision.ts`. The examiner and compiler return data; they cannot call PayPal.
- Evidence text and seller text are wrapped as data in prompts. The acceptance test cannot be modified after both parties agree; its hash lives in the PayPal order's `custom_id`.
- Buyer pages are reachable by token. Seller pages require the workspace cookie and ownership of the proofhold.
- Webhook events are verified against PayPal before being trusted, and reconciliation polling never depends on them.

## PayPal client

`src/lib/paypal/client.ts` defines the interface. Two implementations:

- `rest.ts` talks to `https://api-m.sandbox.paypal.com` with client-credentials tokens cached in memory and refreshed on 401, `PayPal-Request-Id` on every create or capture, and typed responses validated with zod.
- `simulated.ts` implements the same interface in process with the real state rules (honor period, expiry, partial capture limits) so the app works without credentials. It is selected only by `PAYPAL_MODE=simulated` and the UI badges it everywhere.

## Storage

`src/lib/store/sql.ts` exposes `run`, `get`, `all` over either `node:sqlite` or `pg`, with `?` placeholders rewritten for Postgres. Migrations are plain SQL files applied at startup in order and recorded in a `migrations` table. Repositories in `src/lib/store/*.ts` are the only modules that write SQL.

Evidence bytes are stored in the database (capped per file) so hosted deployments with ephemeral disks keep their evidence.

## Configuration

All configuration is read once in `src/lib/config.ts` from environment variables and validated. Missing optional capabilities (no Anthropic key, no PayPal credentials, no mail provider) degrade to named states that the UI explains rather than crashing.

## Testing

- `npm test`: node:test suites for the state machine, decision engine, validators, prompt schemas, hash chain and the simulated PayPal client.
- `npm run test:browser`: Playwright flows A (service), B (goods), C (failure and dispute) against a running app. These runs are also the demo recording.
- `npm run eval`: the examiner over the labelled evaluation set; prints per-category pass, fail, abstain and false-release counts.
