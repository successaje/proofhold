// Shared helpers for the demo recording: a visible cursor, timing marks, smooth moves.
export const cursorScript = `(() => {
  if (window.__cursorInstalled) return; window.__cursorInstalled = true;
  const c = document.createElement('div'); c.id = '__cursor';
  Object.assign(c.style, { position: 'fixed', left: '0px', top: '0px', width: '26px', height: '26px', pointerEvents: 'none', zIndex: '2147483647', display: 'none' });
  c.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><path d="M3 2 L3 21 L8.2 16.4 L11.6 24 L15 22.5 L11.8 15 L18.5 15 Z" fill="#17150f" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const add = () => { (document.body || document.documentElement).appendChild(c); };
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
  window.addEventListener('mousemove', (e) => { c.style.display = 'block'; c.style.left = (e.clientX - 1) + 'px'; c.style.top = (e.clientY - 1) + 'px'; }, true);
  window.addEventListener('mousedown', (e) => {
    const r = document.createElement('div');
    Object.assign(r.style, { position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px', width: '12px', height: '12px', marginLeft: '-6px', marginTop: '-6px', borderRadius: '50%', border: '2px solid #0d5c4e', background: 'rgba(13,92,78,0.25)', pointerEvents: 'none', zIndex: '2147483646', transition: 'transform 420ms ease-out, opacity 420ms ease-out', transform: 'scale(1)', opacity: '1' });
    (document.body || document.documentElement).appendChild(r);
    requestAnimationFrame(() => { r.style.transform = 'scale(4)'; r.style.opacity = '0'; });
    setTimeout(() => r.remove(), 500);
  }, true);
})();`;

export function makeHelpers(page, state) {
  const mark = (n, extra = {}) => {
    const t = Date.now() - state.t0;
    state.marks.push({ n, t, ...extra });
    console.log(`[${(t / 1000).toFixed(2)}] ${n}`);
    return t;
  };
  const sleep = (ms) => page.waitForTimeout(ms);
  const center = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    if (!b) throw new Error("no box");
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const moveTo = async (loc, steps = 28) => {
    const p = await center(loc);
    await page.mouse.move(p.x, p.y, { steps });
    return p;
  };
  const clickOn = async (loc, { settle = 350, steps = 28 } = {}) => {
    await moveTo(loc, steps);
    await sleep(settle);
    await page.mouse.down();
    await sleep(90);
    await page.mouse.up();
  };
  const smoothScrollTo = async (loc, block = "center") => {
    await loc.evaluate(
      (el, block) => el.scrollIntoView({ behavior: "smooth", block }),
      block,
    );
    await sleep(900);
  };
  const typeInto = async (loc, text, delay = 24) => {
    await clickOn(loc);
    await page.keyboard.type(text, { delay });
  };
  return { mark, sleep, moveTo, clickOn, smoothScrollTo, typeInto };
}
