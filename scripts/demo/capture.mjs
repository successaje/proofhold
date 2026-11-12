/**
 * Capture for the demo video: frames straight from the browser's screencast
 * (about 60 a second, far sharper than Playwright's own video), written as
 * clips with their timestamps, plus a drawn cursor and eased, human-paced
 * input. build.mjs turns the clips into the film.
 */
import fs from "node:fs";
import path from "node:path";

/** A pointer drawn in the page, because a headless browser shows none. */
export const cursorScript = `(() => {
  if (window.__cursorInstalled) return; window.__cursorInstalled = true;
  const c = document.createElement('div'); c.id = '__cursor';
  Object.assign(c.style, { position: 'fixed', left: '0px', top: '0px', width: '30px', height: '30px', pointerEvents: 'none', zIndex: '2147483647', display: 'none', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.28))', willChange: 'transform' });
  c.innerHTML = '<svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg"><path d="M4 2.5 L4 24 L9.8 18.9 L13.6 27.3 L17.4 25.6 L13.8 17.4 L21.4 17.4 Z" fill="#17150f" stroke="#ffffff" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  const add = () => { (document.body || document.documentElement).appendChild(c); };
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
  const place = (x, y) => { c.style.display = 'block'; c.style.transform = 'translate(' + (x - 3) + 'px,' + (y - 2) + 'px)'; };
  try { const p = JSON.parse(sessionStorage.getItem('__cursor') || 'null'); if (p) place(p.x, p.y); } catch (e) {}
  window.addEventListener('mousemove', (e) => { place(e.clientX, e.clientY); try { sessionStorage.setItem('__cursor', JSON.stringify({ x: e.clientX, y: e.clientY })); } catch (e2) {} }, true);
  window.addEventListener('mousedown', (e) => {
    const r = document.createElement('div');
    Object.assign(r.style, { position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px', width: '14px', height: '14px', marginLeft: '-7px', marginTop: '-7px', borderRadius: '50%', border: '2px solid #0d5c4e', background: 'rgba(13,92,78,0.22)', pointerEvents: 'none', zIndex: '2147483646', transition: 'transform 480ms cubic-bezier(.2,.8,.2,1), opacity 480ms ease-out', transform: 'scale(1)', opacity: '1' });
    (document.body || document.documentElement).appendChild(r);
    requestAnimationFrame(() => { r.style.transform = 'scale(4.2)'; r.style.opacity = '0'; });
    setTimeout(() => r.remove(), 560);
  }, true);
})();`;

const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

export async function createRecorder(ctx, page, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  const clips = [];
  let cur = null;
  let pointer = { x: 960, y: 620 };

  cdp.on("Page.screencastFrame", (f) => {
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    if (!cur) return;
    const file = path.join(cur.dir, `${String(cur.frames.length).padStart(6, "0")}.jpg`);
    cur.frames.push({ file, ts: f.metadata.timestamp });
    cur.writes.push(fs.promises.writeFile(file, Buffer.from(f.data, "base64")));
  });

  const sleep = (ms) => page.waitForTimeout(ms);

  /**
   * Start a clip. The screencast stalls for a second or two after it starts,
   * so it is warmed first: a two-pixel element repaints every frame until
   * frames flow, and only then does the clip begin. Everything on screen from
   * that moment until stop() is part of the film.
   */
  async function start(name, scene) {
    if (cur) throw new Error(`clip ${cur.name} is still open`);
    const dir = path.resolve(outDir, name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    await cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 96,
      everyNthFrame: 1,
    });
    await page.evaluate(() => {
      const p = document.createElement("div");
      p.id = "__warm";
      Object.assign(p.style, {
        position: "fixed",
        right: "0",
        bottom: "0",
        width: "2px",
        height: "2px",
        pointerEvents: "none",
        zIndex: "2147483645",
        background: "rgba(0,0,0,0.004)",
      });
      document.documentElement.appendChild(p);
      let on = true;
      const tick = () => {
        if (!document.getElementById("__warm")) return;
        on = !on;
        p.style.background = on ? "rgba(0,0,0,0.004)" : "rgba(0,0,0,0.008)";
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await sleep(2600);
    // Open the clip while the warm-up pixel is still repainting, so even a
    // perfectly still page gives the clip its first frame.
    cur = { name, scene, dir, frames: [], writes: [], wall0: Date.now(), focus: null };
    await sleep(70);
    await page.evaluate(() => document.getElementById("__warm")?.remove());
    await sleep(50);
  }

  async function stop() {
    if (!cur) return;
    await sleep(80);
    await cdp.send("Page.stopScreencast");
    const c = cur;
    cur = null;
    await Promise.all(c.writes);
    const wall = (Date.now() - c.wall0) / 1000;
    const t0 = c.frames[0]?.ts ?? 0;
    const frames = c.frames.map((f) => ({ file: f.file, t: f.ts - t0 }));
    const last = frames.at(-1)?.t ?? 0;
    clips.push({
      name: c.name,
      scene: c.scene,
      duration: Math.max(wall, last + 1 / 30),
      frames,
      focus: c.focus,
    });
    console.log(`  clip ${c.name}: ${frames.length} frames, ${wall.toFixed(1)}s`);
  }

  /** One clip around a block of action. */
  async function clip(name, scene, fn) {
    await start(name, scene);
    try {
      await fn();
    } finally {
      await stop();
    }
  }

  const now = () => (cur ? (Date.now() - cur.wall0) / 1000 : 0);

  /** Push the camera in on an element, in the edit. One push per clip. */
  async function focus(locator, zoom = 1.14) {
    if (!cur) return;
    const b = await locator.boundingBox();
    if (!b) return;
    cur.focus = {
      cx: b.x + b.width / 2,
      cy: b.y + b.height / 2,
      zoom,
      tIn: now(),
      tOut: null,
    };
  }
  function unfocus() {
    if (cur?.focus && cur.focus.tOut === null) cur.focus.tOut = now();
  }

  /** Move the pointer along an eased, slightly curved path. */
  async function moveTo(x, y, ms) {
    const from = { ...pointer };
    const dist = Math.hypot(x - from.x, y - from.y);
    const dur = ms ?? Math.min(1100, Math.max(360, dist * 0.9));
    const steps = Math.max(12, Math.round(dur / 9));
    // A shallow arc, perpendicular to the path.
    const bend = Math.min(60, dist * 0.08);
    const nx = dist ? -(y - from.y) / dist : 0;
    const ny = dist ? (x - from.x) / dist : 0;
    const t0 = Date.now();
    for (let i = 1; i <= steps; i++) {
      const u = ease(i / steps);
      const arc = Math.sin(Math.PI * u) * bend;
      await page.mouse.move(
        from.x + (x - from.x) * u + nx * arc,
        from.y + (y - from.y) * u + ny * arc,
      );
      const due = t0 + (dur * i) / steps;
      const wait = due - Date.now();
      if (wait > 1) await sleep(wait);
    }
    pointer = { x, y };
  }

  async function centerOf(locator) {
    const b = await locator.boundingBox();
    if (!b) throw new Error("element has no box");
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }

  async function hover(locator, ms) {
    const p = await centerOf(locator);
    await moveTo(p.x, p.y, ms);
  }

  async function click(locator, { settle = 260, after = 0 } = {}) {
    await hover(locator);
    await sleep(settle);
    await page.mouse.down();
    await sleep(70);
    await page.mouse.up();
    if (after) await sleep(after);
  }

  /** Type like a person: an uneven rhythm, a breath at punctuation. */
  async function type(locator, text, { cps = 38 } = {}) {
    await click(locator, { settle: 180 });
    const base = 1000 / cps;
    for (const ch of text) {
      await page.keyboard.type(ch);
      const jitter = base * (0.55 + Math.random() * 0.9);
      await sleep(/[.,;:]/.test(ch) ? jitter + 110 : jitter);
    }
  }

  /** Scroll so an element sits at a place in the viewport, over a chosen time. */
  async function glideTo(locator, { block = "center", ms = 1200, offset = 0 } = {}) {
    await locator.evaluate(
      (el, { block, ms, offset }) =>
        new Promise((resolve) => {
          const r = el.getBoundingClientRect();
          const vh = window.innerHeight;
          const target =
            window.scrollY +
            (block === "start" ? r.top - 96 : r.top + r.height / 2 - vh / 2) +
            offset;
          const max = document.documentElement.scrollHeight - vh;
          const to = Math.max(0, Math.min(max, target));
          const from = window.scrollY;
          const root = document.documentElement;
          const prev = root.style.scrollBehavior;
          root.style.scrollBehavior = "auto";
          const t0 = performance.now();
          const e = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
          const step = (t) => {
            const u = Math.min(1, (t - t0) / ms);
            window.scrollTo(0, from + (to - from) * e(u));
            if (u < 1) requestAnimationFrame(step);
            else {
              root.style.scrollBehavior = prev;
              resolve();
            }
          };
          requestAnimationFrame(step);
        }),
      { block, ms, offset },
    );
  }

  /** Scroll by a distance, slowly: the page drifts while the narration talks. */
  async function drift(dy, ms) {
    await page.evaluate(
      ({ dy, ms }) =>
        new Promise((resolve) => {
          const from = window.scrollY;
          const root = document.documentElement;
          const prev = root.style.scrollBehavior;
          root.style.scrollBehavior = "auto";
          const t0 = performance.now();
          const e = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
          const step = (t) => {
            const u = Math.min(1, (t - t0) / ms);
            window.scrollTo(0, from + dy * e(u));
            if (u < 1) requestAnimationFrame(step);
            else {
              root.style.scrollBehavior = prev;
              resolve();
            }
          };
          requestAnimationFrame(step);
        }),
      { dy, ms },
    );
  }

  function save(extra = {}) {
    fs.writeFileSync(
      path.join(outDir, "clips.json"),
      JSON.stringify({ ...extra, clips }, null, 2),
    );
  }

  return {
    clip,
    start,
    stop,
    focus,
    unfocus,
    moveTo,
    hover,
    click,
    type,
    glideTo,
    drift,
    sleep,
    save,
    clips,
    setPointer: (p) => (pointer = p),
  };
}
