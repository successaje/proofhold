# Demo video

`demo-video/proofhold-demo.mp4` is 1:49 at 1080p and 60 frames a second, narrated, with no captions. It is made by `scripts/demo/` in three steps, because one server runs one PayPal mode.

## How it is made

- **Capture** (`capture.mjs`): frames come straight from the browser's screencast, about 60 a second, each with its timestamp. That is far sharper than Playwright's own video. The app is drawn a quarter larger so its text reads at 1080p. A pointer is drawn in the page and moved along eased, slightly curved paths; typing has an uneven rhythm.
- **Choreography** (`record.mjs`): the real UI is driven clip by clip. Anything between clips, such as a page load or the wait for the model, is not filmed. The delivery uses three logo files drawn by `fixtures.mjs` at 1600×1200 and 300 dpi, so the validators measure real files and the examiner judges something real.
- **Narration** (`tts.mjs`, `narration.json`): one request per scene to Gemini's text-to-speech, cached by text. It is free on the free tier, which allows three requests a minute and a small number a day, so the script spaces requests out and stops if a scene cannot be generated instead of mixing in another voice.
- **Edit** (`build.mjs`): each scene is stretched or squeezed by up to about fifteen percent so it lasts as long as its narration, instead of freezing on a frame. Push-ins recorded as focus marks are applied with an eased zoom. Every clip crossfades into the next. The opening and closing cards (`cards.mjs`) are pages too, so the mark draws itself.

## Running it

Stop any dev server first; the recording uses a production build so pages load at once.

```bash
npx next build

# 1. The main take: simulated PayPal, the real model.
PAYPAL_MODE=simulated PROOFHOLD_DATA_DIR=.data/video DEMO_SILENCE_MINUTES=10 \
  npx next start --hostname 127.0.0.1 --port 3200 &
PROOFHOLD_DATA_DIR=.data/video npm run demo:video -- flow

# 2. The sandbox clips: a proofhold that already ran against the PayPal sandbox.
#    Stop the server above, then start one with the sandbox settings in .env.local.
npx next start --hostname 127.0.0.1 --port 3200 &
npm run demo:video -- sandbox <workspaceId> <proofholdId>

# 3. The film.
npm run demo:video -- build
rm -rf .next   # before going back to `npm run local`
```

## Scenes

| Scene   | On screen                                                                                                 | Narration                                                                                              |
| ------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| open    | The mark draws; the landing's hero arrives; the product frame                                             | Freelancers get paid late; buyers get burned. Proofhold ties a PayPal payment to a definition of done. |
| story   | The landing's four moments, the seal changing with each                                                   | The money is held by PayPal, never by Proofhold, and moves only when the agreed proof arrives.         |
| compose | The brief is typed; the model compiles it; the test                                                       | The seller writes the brief. Gemini compiles it into an acceptance test.                               |
| buyer   | The link is created; the buyer's page, the hash; approval; the simulated PayPal page; the seal held       | The buyer approves an authorization, not a payment. The hash is written into the PayPal order.         |
| deliver | Three logo files uploaded; the checks; the examiner's verdict with its reasons                            | Validators measure the files. The examiner judges what a machine cannot, and may abstain.              |
| release | The buyer confirms; the seal is stamped                                                                   | The buyer confirms, or the window closes. PayPal captures.                                             |
| ledger  | The ledger and its inspector; an objection in review; a dispute with evidence filed                       | Every hold in one ledger. Objections go to review; disputes go to PayPal with evidence filed.          |
| sandbox | The take's hold card, marked simulated; then a proofhold from the PayPal sandbox, its ids and its capture | This take used the simulator. The same flow has run against the PayPal sandbox.                        |
| close   | The mark, the repository                                                                                  | Open source, and honest about what is real.                                                            |

## Rules

No captions and no third-party music. The main take says on screen and in the narration that PayPal is simulated, and the film ends on the record of a run against the real PayPal sandbox. The model in the take is real: the compiled test and the examiner's verdict are whatever Gemini returned in that recording, so a retake can read differently. A full take on the sandbox needs someone to sign in to PayPal's sandbox checkout as the sandbox buyer during the recording.
