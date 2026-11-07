# Demo video

`npm run demo:video` produces `demo-video/proofhold-demo.mp4` and `.srt` against a running `npm run local`, in about four minutes: it seeds a workspace with every state (`scripts/seed-lib.ts`), records one continuous take at 1920×1080 with a visible cursor (`scripts/demo/record.mjs`), synthesises the narration with the macOS voice (`scripts/demo/tts.mjs`), renders captions and title cards in the product's own type (`scripts/demo/overlays.mjs`), and cuts the take into scenes by its timing marks, holding the last frame when the words run longer than the footage (`scripts/demo/build.mjs`). The narration lives in `scripts/demo/narration.json`; edit it and re-run `tts`, `overlays` and `build` without re-recording.

The recording states on its title card that it runs the simulated PayPal client. Re-record on the sandbox by setting `PAYPAL_MODE=sandbox` with credentials; the script's PayPal step then needs the sandbox buyer login, which `tests/browser/helpers.ts` shows how to drive.

| Scene | Time      | On screen                                                                                          | Narration (abridged)                                                                                                 |
| ----- | --------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1     | 0:00–0:14 | Title card, then the landing hero with the real sheet and seal                                     | Freelancers get paid late; buyers get scammed. Proofhold binds a payment PayPal already holds to a test.             |
| 2     | 0:14–0:35 | Start a workspace, paste the brief, draft the test, read it, create                                | The brief becomes an acceptance test: counts, formats, resolution, a deadline, one judgement line.                   |
| 3     | 0:35–1:00 | Buyer page: the sheet, both signatures, the hash; approve; simulated PayPal; back as Held          | The buyer approves an authorization, not a payment. PayPal holds the money; Proofhold never does.                    |
| 4     | 1:00–1:17 | Seller uploads three PNGs, submits; checks; verdicts with reasons                                  | Validators measure the files. The examiner judges only what a machine cannot, and may abstain.                       |
| 5     | 1:17–1:27 | Buyer confirms; Released; the seal stamped CAPTURED beside the capture id                          | The buyer confirms or stays silent; PayPal captures; the seal is stamped.                                            |
| 6     | 1:27–1:52 | The seeded ledger; an objection in review with an offer; a dispute with evidence filed; the record | Every hold in one ledger. Objections go to review; a declined offer returns the money. After capture PayPal decides. |
| 7     | 1:52–2:10 | Settings and the outbox; the landing's real/simulated/unproven section; outro card                 | What is real, simulated and unproven is on every page. Open source, MIT.                                             |

Rules: no third-party music, no trademarks beyond PayPal's own sandbox UI, the simulation is named on the title card and in the narration, and the `.srt` carries every caption.
