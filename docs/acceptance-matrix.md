# Acceptance matrix

One row per core flow and meaningful state. **Mode** says what stood behind the result: `local` (Proofhold's own logic and database), `simulated` (the in-process PayPal simulator applying PayPal's state rules), `sandbox` (verified against api-m.sandbox.paypal.com) or `live`. Results are from 2026-10-28 on macOS, Node 24, Chromium via Playwright, against `npm run local` (development server, SQLite, `PAYPAL_MODE=simulated`, no `ANTHROPIC_API_KEY`).

Status values: **passed**, **failed**, **blocked** (needs something we do not have), **not run**.

## Journeys

| #   | Flow and state                                   | User action                                                      | Expected                                                                                                          | Mode      | Result  | Evidence                                                                       |
| --- | ------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------- | ------- | ------------------------------------------------------------------------------ |
| 1   | Landing → start form                             | Pick "a service", amount 420, "Write the brief"                  | `/app/new?kind=service&amount=420`; composer pre-filled                                                           | local     | passed  | checked in browser at 375 and 1280 px; nothing created until the brief is sent |
| 2   | Start a workspace                                | Name + PayPal email, Continue                                    | Signed cookie set; redirect to `/app/new`                                                                         | local     | passed  | `tests/browser/helpers.ts` `startWorkspace`, all flows                         |
| 3   | Compose, compile, send                           | Use an example → Draft a starter test → Create and get the link  | Proofhold `proposed`, buyer link shown, hash computed                                                             | local     | passed  | Flows A–D `composeAndSend`                                                     |
| 4   | Buyer approves                                   | Name, email, "Approve $420.00 with PayPal", Authorize            | Order with `custom_id` = test hash, authorization, status `held`, "Approved." on return                           | simulated | passed  | Flows A–D `approveAsBuyer`; sandbox path `blocked` (no credentials)            |
| 5   | Deliver files, submit, checks                    | Upload 3 PNG, Submit for checks                                  | Validators pass; judgement line routed to buyer (examiner off); status `awaiting_buyer`, window shown             | local     | passed  | Flow A                                                                         |
| 6   | Buyer confirms                                   | Confirm and release → Release now                                | PayPal capture (full), status `released`, capture id in history, seal stamped CAPTURED                            | simulated | passed  | Flow A; seal checked in browser                                                |
| 7   | Goods with tracking                              | Record UPS number, submit; buyer confirms receipt                | Format check passes; capture; tracker attached after capture                                                      | simulated | passed  | Flow B                                                                         |
| 8   | Thin delivery blocked, objection, offer declined | Upload 1 small PNG; buyer objects; seller offers; buyer declines | Blocked verdict; `in_review`; offer recorded; void; status `voided`, seal RETURNED; next-step notes on both sides | simulated | passed  | Flow C                                                                         |
| 9   | Dispute after capture                            | Buyer opens dispute; seller files evidence; adjudicate seller    | Dispute id; evidence bundle filed; resolved for seller; status back to `released`                                 | simulated | passed  | Flow D                                                                         |
| 10  | Silence release                                  | Window elapses without buyer action                              | Scheduler captures; audit entry                                                                                   | local     | passed  | `tests/unit/lifecycle.test.ts`                                                 |
| 11  | Reauthorize once, expire                         | Time passes past honor period / past day 29                      | One reauthorization; expiry recorded; status `expired`                                                            | simulated | passed  | `tests/unit/lifecycle.test.ts`, `paypal-simulated.test.ts`                     |
| 12  | List shows outcomes and hold timing              | Open `/app` after approval and after release                     | "hold valid N d" on held rows; "Released $420.00 · N min from submission"; median in header                       | local     | passed  | Flow A                                                                         |
| 13  | Reuse a past test                                | "Start another from this test"                                   | Composer pre-filled with brief, amount and test; source named                                                     | local     | passed  | Flow A                                                                         |
| 14  | Record export                                    | "Evidence bundle" / "Download the full record"                   | JSON with test, hash, checks, evidence hashes, audit chain                                                        | local     | passed  | `tests/unit/store.test.ts`; manual download in browser                         |
| 15  | Sign out                                         | Settings → Sign out                                              | Cookie cleared; `/app/start`                                                                                      | local     | passed  | manual in browser                                                              |
| 16  | Not found                                        | Open a bad URL or a cut buyer link                               | Named 404 with recovery copy                                                                                      | local     | passed  | axe scan visits `/does-not-exist`                                              |
| 17  | Real PayPal sandbox smoke                        | `npx tsx scripts/paypal-smoke.ts`                                | Order → authorize → capture → void → dispute → adjudicate against the sandbox                                     | sandbox   | blocked | needs `PAYPAL_CLIENT_ID`/`SECRET`                                              |
| 18  | Examiner on real deliverables                    | `npm run eval`                                                   | Accuracy and abstention rate on 30 labelled cases                                                                 | live AI   | blocked | needs `ANTHROPIC_API_KEY`                                                      |
| 19  | Webhook signature verification                   | PayPal sends a signed event                                      | Verified, deduplicated, reconciled                                                                                | sandbox   | blocked | needs a public URL and `PAYPAL_WEBHOOK_ID`                                     |

## Interface checks

| Check                                | Result | Evidence                                                                                                                               |
| ------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Axe, WCAG 2.x A/AA, 11 routes, light | passed | `npm run test:a11y`: no violations after fixing `--muted` (4.4:1 → 5.2:1) and `--held` (4.0:1 → 4.7:1)                                 |
| Axe, same routes, dark               | passed | `npm run test:a11y`: no violations after adding `role="status"` to loading regions and lifting `--fail`                                |
| No horizontal overflow at 375 px     | passed | `document.documentElement.scrollWidth === 375` on `/`, `/app`, `/app/new`, `/app/h/[id]`, `/p/[token]` after containing the hash strip |
| Phone, tablet, desktop screenshots   | passed | 375 / 768 / 1280 px in both schemes, see the critique notes in `docs/build-log.md`                                                     |
| Keyboard: focus visible, Enter/Space | passed | `:focus-visible` ring on every control; segmented controls are `role="radio"` buttons                                                  |
| Reduced motion                       | passed | global `prefers-reduced-motion` rule collapses every animation; seal stamp and pulses included                                         |
| Hydration and console errors         | passed | none on `/`, `/app`, `/app/h/[id]`, `/p/[token]` after moving the rail out of a `<p>`                                                  |

## Measurements

`npm run measure` against the development server (not a production build; Turbopack dev adds overhead), medians of 5, Chromium headless, same machine:

| Page / call            | TTFB   | DOMContentLoaded | LCP    |
| ---------------------- | ------ | ---------------- | ------ |
| `/`                    | 74 ms  | 96 ms            | 132 ms |
| `/app/start`           | 88 ms  | 112 ms           | 120 ms |
| `/app`                 | 71 ms  | 88 ms            | 104 ms |
| `/app/new`             | 72 ms  | 97 ms            | 412 ms |
| `/app/h/[id]`          | 230 ms | 257 ms           | 444 ms |
| `POST /api/compile`    | 8 ms   |                  |        |
| `POST /api/proofholds` | 17 ms  |                  |        |

The detail page is the slowest: five queries plus the audit chain. Fine at this scale; pagination of the audit list is the first optimisation if a proofhold accumulates hundreds of entries. Numbers from a production build and a remote database are not yet measured.

## Known gaps

- Everything PayPal is simulated on this machine; rows 17 and 19 turn green only with sandbox credentials and a public URL.
- The examiner's accuracy is unmeasured (row 18).
- Screen-reader announcements were checked by markup (roles, names, live regions), not with a screen reader.
