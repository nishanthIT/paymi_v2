// Dev-only: drive headless Chromium over CDP (390 × 844 @2x). Captures the HTML each
// web print job hands to its iframe, so it can be printed to a real PDF. Deleted after use.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const steps = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const port = 9333;
const proc = spawn('chromium', ['--headless=new', '--no-sandbox', '--use-gl=disabled', '--disable-gpu', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/cdp-profile', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    if (targets.some((t) => t.type === 'page')) break;
  } catch {}
  await sleep(200);
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    id += 1;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: false });
await send('Page.enable');
// Record every srcdoc handed to an iframe (the web print route) without changing app code.
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `(() => {
    const d = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'srcdoc');
    Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', { configurable: true, get() { return d.get.call(this); }, set(v) { (window.__printHtml ||= []).push(v); d.set.call(this, v); } });
  })();`,
});

async function rectOf(text, nth = 0) {
  return evaluate(`(() => {
    const want = ${JSON.stringify(text)};
    const all = [...document.querySelectorAll('body *')].filter((el) => {
      const t = (el.innerText || '').trim();
      return (t === want || el.getAttribute('aria-label') === want || el.getAttribute('placeholder') === want) && el.getBoundingClientRect().width > 0;
    });
    const el = all[${nth}];
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
}
async function click(text, nth) {
  if (!(await rectOf(text, nth))) throw new Error(`not found: ${text}`);
  await sleep(250);
  const r = await rectOf(text, nth);
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
}
const enter = async () => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
};

for (const step of steps) {
  try {
    if (step.goto) await send('Page.navigate', { url: step.goto });
    if (step.click) await click(step.click, step.nth ?? 0);
    if (step.clickIf && (await rectOf(step.clickIf))) await click(step.clickIf);
    if (step.fill != null) {
      const ok = await evaluate(`(() => { const el = [...document.querySelectorAll('input,textarea')].find((e) => (e.getAttribute('aria-label') === ${JSON.stringify(step.input)} || e.placeholder === ${JSON.stringify(step.input)}) && e.getBoundingClientRect().width > 0); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.focus(); el.select(); return true; })()`);
      if (!ok) throw new Error(`input not found: ${step.input}`);
      await send('Input.insertText', { text: step.fill });
    }
    if (step.keys) {
      await send('Input.insertText', { text: step.keys });
      if (step.enter) await enter();
    }
    if (step.anchor) {
      const ok = await evaluate(`(() => {
        const want = ${JSON.stringify(step.anchor)};
        const el = [...document.querySelectorAll('body *')].find((e) => (e.innerText || '').trim() === want && e.getBoundingClientRect().width > 0);
        if (!el) return false;
        let s = el.parentElement;
        while (s && !(s.scrollHeight > s.clientHeight + 20 && getComputedStyle(s).overflowY !== 'visible')) s = s.parentElement;
        if (!s) return false;
        s.style.scrollBehavior = 'auto';
        s.scrollTop += el.getBoundingClientRect().top - s.getBoundingClientRect().top - ${step.offset ?? 0};
        s.dispatchEvent(new Event('scroll'));
        return true;
      })()`);
      if (!ok) throw new Error(`anchor not found: ${step.anchor}`);
    }
    if (step.scrollBy) await evaluate(`[...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 20 && getComputedStyle(e).overflowY !== 'visible').forEach(e => e.scrollBy(0, ${step.scrollBy}))`);
    if (step.scrollTop) await evaluate(`[...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 20 && getComputedStyle(e).overflowY !== 'visible').forEach(e => { e.style.scrollBehavior = 'auto'; e.scrollTop = ${step.scrollTop}; e.dispatchEvent(new Event('scroll')); })`);
    if (step.eval) console.log(step.label ?? 'eval', JSON.stringify(await evaluate(step.eval)));
    await sleep(step.wait ?? 900);
    if (step.capture) {
      const html = await evaluate('(window.__printHtml || []).at(-1) || null');
      if (!html) throw new Error('no print job captured');
      writeFileSync(step.capture, html);
      console.log('captured', step.capture, html.length);
    }
    if (step.shot) {
      const { result } = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(step.shot, Buffer.from(result.data, 'base64'));
      console.log('shot', step.shot);
    }
  } catch (e) {
    console.log('STEP FAILED', JSON.stringify(step), e.message);
    if (!step.optional) break;
  }
}
// Graceful close so Chromium flushes localStorage (a hard kill can drop recent writes).
await send('Browser.close');
await sleep(500);
ws.close();
proc.kill();
process.exit(0);
