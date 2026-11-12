/**
 * The opening and closing cards: the mark draws itself, the name rises, a
 * line follows. They are pages, captured like everything else, so they move.
 */
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,500,60&family=Inter:wght@400;500&family=JetBrains+Mono:wght@500&display=swap');`;

const base = (
  inner,
  extraCss = "",
) => `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100vw;height:100vh;overflow:hidden;background:#f6f4ef;color:#17150f;font-family:Inter,system-ui,sans-serif}
body::before{content:"";position:absolute;inset:0;background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 47px,rgba(23,21,15,.045) 47px,rgba(23,21,15,.045) 48px);-webkit-mask-image:radial-gradient(ellipse at center,rgba(0,0,0,.9),transparent 75%);mask-image:radial-gradient(ellipse at center,rgba(0,0,0,.9),transparent 75%)}
.stage{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px}
.row{display:flex;align-items:center;gap:30px}
.mark{width:132px;height:132px;color:#0d5c4e}
.mark path{fill:none;stroke:currentColor;stroke-width:6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1}
.name{font-family:Fraunces,Georgia,serif;font-weight:500;font-size:150px;letter-spacing:-4px;line-height:1;font-variation-settings:"SOFT" 60;opacity:0;transform:translateY(26px)}
.line{font-family:Fraunces,Georgia,serif;font-size:50px;line-height:1.2;color:#4b4740;max-width:1280px;text-align:center;opacity:0;transform:translateY(18px)}
.line em{font-style:normal;color:#0d5c4e}
.mono{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:26px;letter-spacing:.16em;text-transform:uppercase;color:#6b665e;opacity:0;transform:translateY(12px)}
.url{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:34px;color:#0d5c4e;opacity:0;transform:translateY(12px)}
.go .ring{animation:draw 900ms cubic-bezier(.65,0,.35,1) 120ms forwards}
.go .tick{animation:draw 520ms cubic-bezier(.2,.8,.2,1) 860ms forwards}
.go .name{animation:rise 700ms cubic-bezier(.2,.8,.2,1) 420ms forwards}
.go .line{animation:rise 700ms cubic-bezier(.2,.8,.2,1) 1150ms forwards}
.go .mono{animation:rise 600ms cubic-bezier(.2,.8,.2,1) 1700ms forwards}
.go .url{animation:rise 600ms cubic-bezier(.2,.8,.2,1) 1500ms forwards}
@keyframes draw{to{stroke-dashoffset:0}}
@keyframes rise{to{opacity:1;transform:none}}
${extraCss}
</style></head><body><div class="stage">${inner}</div></body></html>`;

const MARK = `<svg class="mark" viewBox="0 0 64 64"><path class="ring" pathLength="1" d="M52.8 20A24 24 0 1 1 44 11.2"/><path class="tick" pathLength="1" d="M21 33l8 8 26-28"/></svg>`;

export const introCard = base(
  `<div class="row">${MARK}<div class="name">Proofhold</div></div>
   <div class="line">A PayPal payment that is held until the <em>agreed proof</em> arrives.</div>
   <div class="mono">PayPal AI Hackathon</div>`,
);

export const outroCard = base(
  `<div class="row">${MARK}<div class="name">Proofhold</div></div>
   <div class="line">Open source. Honest about what is <em>real</em>.</div>
   <div class="url">github.com/successaje/proofhold</div>
   <div class="mono">MIT licence</div>`,
  `.go .mono{animation-delay:1900ms}`,
);

/** Show a card and start its animation once its fonts are in. */
export async function showCard(page, html) {
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
}
export const playCard = (page) => page.evaluate(() => document.body.classList.add("go"));
