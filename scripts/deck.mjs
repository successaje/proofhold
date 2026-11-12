/**
 * The pitch deck, as a PDF in the product's own type and colours.
 *   node scripts/deck.mjs        → docs/devpost/proofhold-deck.pdf
 * Every claim on a slide is one the repository can back; see docs/submission.md.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const DIR = path.resolve("docs/devpost");
// Embedded, so the PDF never depends on where the page was opened from.
const img = (f) =>
  `data:image/jpeg;base64,${fs.readFileSync(path.join(DIR, f)).toString("base64")}`;
const MARK = (s = 56) =>
  `<svg viewBox="0 0 64 64" width="${s}" height="${s}"><path d="M52.8 20A24 24 0 1 1 44 11.2" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M21 33l8 8 26-28" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const slides = [
  // 1 — title
  `<section class="title">
     <div class="brand"><span class="mk">${MARK(120)}</span><span class="name">Proofhold</span></div>
     <h1>A PayPal payment held until the <em>agreed proof</em> arrives.</h1>
     <p class="mono">PayPal AI Hackathon · proofhold.onrender.com</p>
   </section>`,
  // 2 — problem
  `<section>
     <span class="no">01 · The problem</span>
     <h2>Paying a stranger for work is <em>an act of faith.</em></h2>
     <p class="lead">Freelancers get paid late or not at all. Buyers who pay up front get burned. The tools in between do not settle it.</p>
     <div class="cards three">
       <div class="card"><span class="pill">Invoice</span><h3>Enforces nothing</h3><p>It asks for money after the work. If the buyer goes quiet, the seller has a PDF.</p></div>
       <div class="card"><span class="pill">Escrow</span><h3>Takes custody and a fee</h3><p>A third party holds the money and decides by its own policy when to let go.</p></div>
       <div class="card"><span class="pill">Marketplace</span><h3>Takes a cut and the relationship</h3><p>Protection comes bundled with a platform both sides have to move onto.</p></div>
     </div>
   </section>`,
  // 3 — insight
  `<section class="brandbg">
     <span class="no">02 · The insight</span>
     <h2>PayPal can already hold money <em>without anyone taking custody.</em></h2>
     <p class="lead">An authorization reserves the amount in the buyer's own account for up to 29 days. Nothing has been paid, and only a capture moves it.</p>
     <div class="big">Proofhold binds that hold to a definition of “done” that both sides signed.</div>
   </section>`,
  // 4 — how it works
  `<section class="split">
     <div>
       <span class="no">03 · How it works</span>
       <h2>One agreement, <em>four moments.</em></h2>
       <ol class="steps">
         <li><div><b>Agreed.</b> The seller writes a brief. AI compiles it into an acceptance test both sides read.</div></li>
         <li><div><b>Payment authorized.</b> The buyer approves a PayPal hold. The test's hash is written into the order.</div></li>
         <li><div><b>Work delivered.</b> Validators measure the files. An examiner judges only what a machine cannot.</div></li>
         <li><div><b>Reviewed and paid.</b> The buyer confirms, or the window closes. PayPal captures.</div></li>
       </ol>
     </div>
     <figure><img src="${img("02-story.jpg")}"></figure>
   </section>`,
  // 5 — compile
  `<section class="split">
     <div>
       <span class="no">04 · AI, part one</span>
       <h2>A brief becomes <em>a test you can both sign.</em></h2>
       <p class="lead">Gemini reads plain words and writes down what “done” means: how many files, what size, by when, and the few judgement calls a human would make.</p>
       <p class="lead">It lists what the brief left unclear instead of guessing, and the seller can edit every line.</p>
     </div>
     <figure><img src="${img("03-compose.jpg")}"></figure>
   </section>`,
  // 6 — verdicts
  `<section class="split">
     <div>
       <span class="no">05 · AI, part two</span>
       <h2>Every line says <em>who decided it, and why.</em></h2>
       <p class="lead">Checks a machine can make are made from the bytes. The examiner judges the rest, gives reasons that cite the files, and may abstain.</p>
       <div class="rule"><b>The model never moves money.</b> A decision engine does, and an abstention never releases a hold. The buyer's word outranks the model.</div>
     </div>
     <figure><img src="${img("05-verdicts.jpg")}"></figure>
   </section>`,
  // 7 — PayPal
  `<section class="split">
     <div>
       <span class="no">06 · PayPal, at the centre</span>
       <h2>Run against the <em>PayPal sandbox.</em></h2>
       <ul class="facts">
         <li><span>Orders v2</span><div>intent AUTHORIZE, with the test's hash as <code>custom_id</code></div></li>
         <li><span>Payments v2</span><div>capture, partial capture, void, reauthorize, refund</div></li>
         <li><span>Disputes</span><div>the evidence bundle filed for the seller</div></li>
         <li><span>Tracking</span><div>carrier number attached to the captured order</div></li>
         <li><span>Webhooks</span><div>verified, with reconciliation as the fallback</div></li>
       </ul>
       <p class="ids">order 7Y274434ME492621K · authorization 29L574290X763064E · capture 2BJ05546414363341</p>
     </div>
     <figure><img src="${img("09-paypal-sandbox.jpg")}"></figure>
   </section>`,
  // 8 — product
  `<section class="split">
     <div>
       <span class="no">07 · A complete product</span>
       <h2>Built for the people <em>on both sides.</em></h2>
       <ul class="ticks">
         <li>A ledger of every hold, with search, export and an inspector</li>
         <li>A buyer page that shows the delivery and the checks before the decision</li>
         <li>Objection, partial release, and return of the hold</li>
         <li>A printable record and a hash-chained history for both parties</li>
         <li>Light and dark themes, phone layouts, an accessibility scan in CI</li>
       </ul>
     </div>
     <figure><img src="${img("07-ledger.jpg")}"></figure>
   </section>`,
  // 9 — honesty
  `<section>
     <span class="no">08 · What is real</span>
     <h2>Honest about <em>what has been proven.</em></h2>
     <div class="cards three">
       <div class="card"><span class="pill ok">Verified</span><h3>Run for real</h3><p>PayPal sandbox: order, approval, authorization, full capture, partial capture, void. Gemini compiling briefs and judging uploads. Postgres on the hosted demo.</p></div>
       <div class="card"><span class="pill ok">Tested</span><h3>155 unit tests, 4 journeys</h3><p>Browser journeys for release, goods, objection and dispute, and an accessibility scan on eleven routes in both themes, all in CI.</p></div>
       <div class="card"><span class="pill warn">Not yet</span><h3>Said plainly</h3><p>Reauthorize, refund, tracking and disputes run only on the simulator. The examiner's accuracy is unmeasured. Payouts go to one PayPal business account.</p></div>
     </div>
   </section>`,
  // 10 — phones
  `<section class="split">
     <div>
       <span class="no">09 · Design</span>
       <h2>The test is a document. <em>The hold is a seal on it.</em></h2>
       <p class="lead">One ring arc per line of the test, coloured by its verdict, stamped when money moves. The same seal appears on the seller's page, the buyer's page and the receipt.</p>
     </div>
     <figure><img src="${img("11-phones.jpg")}"></figure>
   </section>`,
  // 11 — close
  `<section class="title">
     <div class="brand"><span class="mk">${MARK(120)}</span><span class="name">Proofhold</span></div>
     <h1>Write what “done” means. <em>PayPal holds the money until the proof arrives.</em></h1>
     <div class="links">
       <div><span>Live demo</span>proofhold.onrender.com</div>
       <div><span>Code, MIT</span>github.com/successaje/proofhold</div>
       <div><span>Video</span>youtu.be/z0C_gWOIWqU</div>
     </div>
   </section>`,
];

const css = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,500,60&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
@page{size:1920px 1080px;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#f6f4ef;color:#17150f;font-family:Inter,system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
section{position:relative;width:1920px;height:1080px;padding:104px 120px;overflow:hidden;page-break-after:always;display:flex;flex-direction:column;justify-content:center;gap:34px;background:#f6f4ef}
section::after{content:attr(data-n);position:absolute;right:120px;bottom:56px;font-family:"JetBrains Mono",monospace;font-size:20px;color:#6b665e;letter-spacing:.1em}
section::before{content:"Proofhold";position:absolute;left:120px;bottom:56px;font-family:Fraunces,serif;font-size:24px;color:#6b665e}
.no{font-family:"JetBrains Mono",monospace;font-size:22px;letter-spacing:.16em;text-transform:uppercase;color:#0d5c4e}
h1,h2,h3{font-family:Fraunces,Georgia,serif;font-weight:500;font-variation-settings:"SOFT" 60}
h1{font-size:92px;line-height:1.04;letter-spacing:-2.4px;max-width:1500px}
h2{font-size:76px;line-height:1.05;letter-spacing:-2px;max-width:1500px}
h1 em,h2 em{font-style:normal;color:#0d5c4e}
h3{font-size:34px;letter-spacing:-.4px;line-height:1.15}
.lead{font-size:32px;line-height:1.45;color:#4b4740;max-width:1320px}
.mono{font-family:"JetBrains Mono",monospace;font-size:24px;letter-spacing:.14em;text-transform:uppercase;color:#6b665e}
.title{gap:44px;background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 53px,rgba(23,21,15,.045) 53px,rgba(23,21,15,.045) 54px)}
.title::before{content:""}
.brand{display:flex;align-items:center;gap:26px}.mk{color:#0d5c4e;display:flex}.name{font-family:Fraunces,serif;font-weight:500;font-size:124px;letter-spacing:-3.4px;line-height:1}
.cards{display:grid;gap:28px;margin-top:10px}.three{grid-template-columns:repeat(3,1fr)}
.card{background:#fff;border:1px solid #e1ddd4;border-radius:18px;padding:36px;display:flex;flex-direction:column;gap:16px;box-shadow:0 6px 24px rgba(23,21,15,.06)}
.card p{font-size:25px;line-height:1.45;color:#4b4740}
.pill{align-self:flex-start;font-family:"JetBrains Mono",monospace;font-size:18px;letter-spacing:.12em;text-transform:uppercase;padding:6px 14px;border-radius:999px;background:#efece5;color:#4b4740}
.pill.ok{background:#dcefe3;color:#1d6f47}.pill.warn{background:#f6ebd3;color:#8b6010}
.brandbg{background:#0d5c4e;color:#fff}.brandbg .no{color:rgba(255,255,255,.8)}.brandbg h2{color:rgba(255,255,255,.8)}.brandbg h2 em{color:#fff}.brandbg .lead{color:rgba(255,255,255,.86)}
.brandbg::before,.brandbg::after{color:rgba(255,255,255,.7)}
.big{margin-top:14px;padding:38px 44px;border-radius:18px;background:rgba(0,0,0,.22);font-family:Fraunces,serif;font-size:46px;line-height:1.2;letter-spacing:-.8px;max-width:1500px}
.split{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:72px;align-items:center}
.split>div{display:flex;flex-direction:column;gap:30px}.split h2{font-size:62px;letter-spacing:-1.6px}.split .lead{font-size:28px}
figure{border-radius:18px;overflow:hidden;border:1px solid #cbc5ba;box-shadow:0 30px 70px -30px rgba(23,21,15,.4);background:#fff}figure img{display:block;width:100%}
.steps{list-style:none;display:grid;gap:18px;counter-reset:s;font-size:26px;line-height:1.4;color:#4b4740}
.steps li{display:grid;grid-template-columns:52px 1fr;gap:6px;counter-increment:s}.steps li::before{content:"0" counter(s);font-family:"JetBrains Mono",monospace;font-size:20px;color:#0d5c4e;padding-top:6px}
.steps b,.ticks b{color:#17150f}
.rule{padding:24px 28px;border-left:5px solid #0d5c4e;background:#dcefe9;border-radius:0 14px 14px 0;font-size:26px;line-height:1.4;color:#17150f}
.facts{list-style:none;display:grid;font-size:24px;line-height:1.35;color:#4b4740}.facts li{display:grid;grid-template-columns:190px 1fr;gap:16px;padding:14px 0;border-top:1px solid #e1ddd4}
.facts span{font-family:"JetBrains Mono",monospace;font-size:19px;letter-spacing:.08em;text-transform:uppercase;color:#0d5c4e;padding-top:4px}
code{font-family:"JetBrains Mono",monospace;font-size:.88em;background:#efece5;padding:2px 8px;border-radius:6px}
.ids{font-family:"JetBrains Mono",monospace;font-size:17px;color:#6b665e;line-height:1.6}
.ticks{list-style:none;display:grid;gap:16px;font-size:27px;line-height:1.4;color:#4b4740}.ticks li{padding-left:44px;position:relative}
.ticks li::before{content:"";position:absolute;left:4px;top:9px;width:22px;height:12px;border-left:4px solid #0d5c4e;border-bottom:4px solid #0d5c4e;transform:rotate(-45deg)}
.links{display:grid;grid-template-columns:repeat(3,auto);justify-content:start;gap:64px;margin-top:10px;font-family:"JetBrains Mono",monospace;font-size:28px;color:#0d5c4e}
.links span{display:block;font-size:18px;letter-spacing:.14em;text-transform:uppercase;color:#6b665e;margin-bottom:10px}
`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${slides
  .map((s, i) =>
    s.replace(
      "<section",
      `<section data-n="${String(i + 1).padStart(2, "0")} / ${slides.length}"`,
    ),
  )
  .join("")}</body></html>`;
const file = path.join(DIR, "deck.html");
fs.writeFileSync(file, html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`file://${file}`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);
await page.pdf({
  path: path.join(DIR, "proofhold-deck.pdf"),
  width: "1920px",
  height: "1080px",
  printBackground: true,
});
if (process.argv[2] === "--preview") {
  for (const n of process.argv.slice(3)) {
    await page
      .locator("section")
      .nth(Number(n) - 1)
      .screenshot({
        path: path.join(process.argv.at(-1).includes("/") ? "" : DIR, `deck-${n}.png`),
      });
  }
}
await browser.close();
fs.rmSync(file);
console.log(`${slides.length} slides → docs/devpost/proofhold-deck.pdf`);
