// Run with the explicitly isolated tests/helpers/chatBrowserFixture.js API.
// Use PAYMI_BROWSER_ORIGIN for a Metro development server. Requires Chromium and playwright-core.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
const { chromium } = await import(process.env.PAYMI_PLAYWRIGHT_MODULE || 'playwright-core');
const root = path.resolve(process.env.PAYMI_BROWSER_WEB || '/tmp/paymi-chat-browser-web');
const output = path.resolve(process.env.PAYMI_BROWSER_EVIDENCE || '/tmp/paymi-chat-browser-evidence');
await fs.mkdir(output, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const base = path.resolve(root, `.${pathname}`);
    if (base !== root && !base.startsWith(root + path.sep)) { res.writeHead(404); res.end(); return; }
    let file;
    for (const candidate of [base, `${base}.html`, path.join(base, 'index.html'), path.join(root, 'index.html')]) {
      if ((await fs.stat(candidate).catch(() => null))?.isFile()) { file = candidate; break; }
    }
    const type = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf' }[path.extname(file)] || 'application/octet-stream';
    res.setHeader('content-type', type); res.end(await fs.readFile(file));
  } catch { res.writeHead(500); res.end(); }
});
if (!process.env.PAYMI_BROWSER_ORIGIN) await new Promise(resolve => server.listen(3108, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath: process.env.PAYMI_CHROMIUM || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['camera'] });
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['camera'] });
const pages = [await desktop.newPage(), await mobile.newPage()];
const errors = []; for (const page of pages) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /cannot contain|cannot be a descendant|hydration/i.test(message.text())) errors.push(message.text()); });
}
const [owner, employee] = pages;
const site = process.env.PAYMI_BROWSER_ORIGIN || 'http://127.0.0.1:3108';
const run = Date.now().toString(36);
const personal = `Browser live personal message ${run}`;
const reply = `Reply from mobile employee ${run}`;
const recovered = `Recovered after network loss ${run}`;
for (const context of [desktop, mobile]) await context.route('**/*', route => {
  const host = new URL(route.request().url()).hostname;
  return ['127.0.0.1', 'localhost'].includes(host) ? route.continue() : route.abort();
});
const login = async (page, email) => {
  await page.goto(`${site}/login`);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('Your password').fill('Passw0rd!');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL(url => !url.pathname.includes('login'), { timeout: 30000 });
  await page.goto(`${site}/chat`);
  await page.getByRole('button', { name: 'New Chat', exact: true }).waitFor();
};
try {
  await Promise.all([login(owner, 'alpha-owner@shop.test'), login(employee, 'riley@browser.test')]);
  console.log('Signed in owner and employee');
  for (const page of pages) {
    for (const tab of ['All Chats', 'Team Chat', 'Direct', 'Unread']) await page.getByRole('tab', { name: tab, exact: true }).waitFor();
    await page.getByRole('button', { name: /^Global Chat/ }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'chat feed must fit viewport');
  }
  await employee.screenshot({ path: path.join(output, 'mobile-chat-feed.png') });
  await owner.getByRole('button', { name: /^Global Chat/ }).click();
  await owner.getByRole('button', { name: 'Actions for Riley Employee', exact: true }).click();
  await owner.getByText('Message personally', { exact: true }).click();
  await owner.getByRole('textbox', { name: 'Message', exact: true }).waitFor();
  const directUrl = owner.url(); assert.match(directUrl, /\/chat\/[^/?]+/);
  await owner.getByRole('textbox', { name: 'Message', exact: true }).fill(personal);
  await owner.getByRole('button', { name: 'Send message', exact: true }).click();
  await employee.getByRole('button', { name: /^Alpha Owner/ }).waitFor();
  await employee.getByRole('tab', { name: 'Unread', exact: true }).click();
  await employee.getByRole('button', { name: /^Alpha Owner/ }).click();
  await employee.getByText(personal, { exact: true }).filter({ visible: true }).waitFor();
  await owner.getByRole('button', { name: `Alpha Owner: ${personal}`, exact: true }).getByLabel('Read', { exact: true }).waitFor();
  console.log('Global to DM, unread inbox and read receipt passed');
  await employee.getByRole('textbox', { name: 'Message', exact: true }).fill(reply);
  await employee.getByRole('button', { name: 'Send message', exact: true }).click();
  await owner.getByText(reply, { exact: true }).filter({ visible: true }).waitFor();
  await owner.screenshot({ path: path.join(output, 'desktop-direct-thread.png') });
  await employee.getByRole('button', { name: 'Search messages', exact: true }).click();
  await employee.getByRole('textbox', { name: 'Search this conversation', exact: true }).fill('live personal');
  await employee.getByText(personal, { exact: true }).filter({ visible: true }).waitFor();
  await employee.getByRole('button', { name: 'Close message search', exact: true }).click();
  console.log('Bidirectional live messages and search passed');
  await employee.getByRole('textbox', { name: 'Message', exact: true }).fill('draft survives camera');
  await employee.getByRole('button', { name: 'Open chat camera', exact: true }).click();
  const close = employee.getByRole('button', { name: 'Close camera', exact: true }); await close.waitFor();
  await close.click({ trial: true }); // Wait for the modal's entrance animation to settle.
  const box = await close.boundingBox(); assert.ok(box && box.y >= 0 && box.y < 100 && box.y + box.height < 844);
  await employee.screenshot({ path: path.join(output, 'mobile-camera.png') });
  await close.click();
  console.log('Camera opened and closed');
  assert.equal(await employee.getByRole('textbox', { name: 'Message', exact: true }).inputValue(), 'draft survives camera');
  await employee.getByRole('textbox', { name: 'Message', exact: true }).fill('');
  await employee.getByRole('button', { name: 'Open chat camera', exact: true }).click();
  await employee.getByRole('button', { name: 'Take photo', exact: true }).click();
  await employee.getByText('Preview photo', { exact: true }).waitFor();
  const photoResponse = employee.waitForResponse(response => response.url().endsWith('/api/chat/message')
    && response.request().method() === 'POST' && response.request().postDataJSON()?.messageType === 'IMAGE');
  await employee.getByRole('button', { name: 'Send photo', exact: true }).click();
  const photoMessage = await photoResponse;
  assert.equal(photoMessage.status(), 201);
  const photoName = (await photoMessage.json()).message.attachmentName;
  await employee.getByRole('button', { name: 'Close camera', exact: true }).waitFor({ state: 'hidden' });
  await owner.waitForFunction(name => {
    const bubble = [...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === `Riley Employee: ${name}`);
    return (bubble?.querySelector('img')?.naturalWidth || 0) > 0;
  }, photoName);
  console.log('Camera capture, preview, upload and live photo delivery passed');
  await mobile.setOffline(true);
  await employee.getByText('You’re offline. Messages will sync when you reconnect.', { exact: true }).waitFor();
  await owner.getByRole('textbox', { name: 'Message', exact: true }).fill(recovered);
  await owner.getByRole('button', { name: 'Send message', exact: true }).click();
  await mobile.setOffline(false);
  await employee.getByText(recovered, { exact: true }).filter({ visible: true }).waitFor({ timeout: 35000 });
  await employee.screenshot({ path: path.join(output, 'mobile-direct-thread.png') });
  console.log('Offline recovery passed');
  await owner.getByRole('button', { name: 'Back to conversations', exact: true }).click();
  // A personal chat opened from Global Chat returns to that conversation first.
  if (!await owner.getByRole('button', { name: 'New Chat', exact: true }).isVisible()) {
    await owner.getByRole('button', { name: 'Back to conversations', exact: true }).click();
  }
  await owner.getByRole('button', { name: 'New Chat', exact: true }).click();
  await owner.getByRole('textbox', { name: 'Search shop users', exact: true }).fill('Riley');
  await owner.getByRole('button', { name: 'Message Riley Employee', exact: true }).click();
  await owner.getByRole('textbox', { name: 'Message', exact: true }).waitFor();
  assert.equal(new URL(owner.url()).pathname, new URL(directUrl).pathname, 'New Chat must reuse personal room from Global Chat');
  await owner.getByText(reply, { exact: true }).filter({ visible: true }).waitFor();
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, viewports: [1440, 390], roles: ['retail owner', 'retail employee'], checks: ['four chat sections', 'global-to-personal navigation', 'unopened inbox unread', 'live bidirectional messages', 'read receipts', 'message search', 'camera X within viewport', 'camera draft preservation', 'camera capture preview upload delivery', 'network reconnect', 'New Chat room reuse'], browserErrors: errors }, null, 2));
  console.log('Browser chat end-to-end checks passed');
} catch (error) {
  for (const [index, page] of pages.entries()) {
    await page.screenshot({ path: path.join(output, `failure-${index}.png`) }).catch(() => {});
    await fs.writeFile(path.join(output, `failure-${index}.txt`), await page.locator('body').innerText().catch(() => 'unavailable'));
  }
  console.error(error, { browserErrors: errors }); process.exitCode = 1;
} finally { await browser.close(); if (server.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } }
