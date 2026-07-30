// REPL driver for Loopkeep's Expo web build.
// Run with the Metro/web dev server already listening on :8081 (see SKILL.md).
// Designed for agents: wrap in tmux, send-keys commands, capture-pane output.
import { chromium } from 'playwright-core';
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';

const URL = process.env.LOOPKEEP_URL || 'http://localhost:8081';
const SHOT_DIR = process.env.SCREENSHOT_DIR || '/tmp/loopkeep-shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

let browser = null;
let page = null;
let consoleErrors = [];

const COMMANDS = {
  async launch() {
    if (page) return console.log('already launched');
    // Playwright's own Chromium download times out in this environment
    // (network restriction to cdn.playwright.dev) — use the system
    // Google Chrome install instead via the "chrome" channel.
    browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30_000 });
    console.log('launched:', URL);
  },

  async ss(name) {
    if (!page) return console.log('ERROR: launch first');
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png');
    await page.screenshot({ path: f });
    console.log('screenshot:', f);
  },

  async click(sel) {
    if (!page) return console.log('ERROR: launch first');
    try { await page.click(sel, { timeout: 10_000 }); console.log('click', sel, '→ OK'); }
    catch (e) { console.log('click', sel, '→ ERROR:', e.message); }
  },

  async 'click-text'(text) {
    if (!page) return console.log('ERROR: launch first');
    try { await page.getByText(text).first().click({ timeout: 10_000 }); console.log('click-text', JSON.stringify(text), '→ OK'); }
    catch (e) { console.log('click-text', JSON.stringify(text), '→ ERROR:', e.message); }
  },

  async type(text) { if (page) await page.keyboard.type(text, { delay: 30 }); },
  async press(key) { if (page) await page.keyboard.press(key); },

  async wait(sel) {
    if (!page) return console.log('ERROR: launch first');
    try { await page.waitForSelector(sel, { timeout: 10_000 }); console.log('found:', sel); }
    catch { console.log('TIMEOUT:', sel); }
  },

  async 'wait-text'(text) {
    if (!page) return console.log('ERROR: launch first');
    try { await page.getByText(text).first().waitFor({ timeout: 10_000 }); console.log('found text:', text); }
    catch { console.log('TIMEOUT:', text); }
  },

  async eval(expr) {
    if (!page) return console.log('ERROR: launch first');
    try { console.log(JSON.stringify(await page.evaluate(expr))); }
    catch (e) { console.log('ERROR:', e.message); }
  },

  async text(sel) {
    if (!page) return console.log('ERROR: launch first');
    console.log(await page.evaluate(
      (s) => (s ? document.querySelector(s) : document.body)?.innerText ?? '(null)',
      sel || null));
  },

  console() {
    console.log('--- CONSOLE ERRORS ---');
    console.log(consoleErrors.length ? consoleErrors.join('\n') : '(none)');
  },

  async quit() { if (browser) await browser.close().catch(() => {}); browser = null; page = null; },
  help() { console.log('commands:', Object.keys(COMMANDS).join(', ')); },
};

const stdin = fs.createReadStream(null, { fd: fs.openSync('/dev/stdin', 'r') });
const rl = readline.createInterface({ input: stdin, output: process.stdout, prompt: 'driver> ' });

// Commands can arrive faster than they resolve (piped heredoc, tmux
// send-keys in quick succession) — chain them so each one finishes
// before the next starts, instead of racing on shared `page`/`browser`.
// With piped input, stdin hits EOF (and readline fires 'close') as soon
// as all lines are read, well before the chain below has processed
// them — guard prompt() so that doesn't throw ERR_USE_AFTER_CLOSE.
let closed = false;
const prompt = () => { if (!closed) rl.prompt(); };

let chain = Promise.resolve();
rl.on('line', (line) => {
  chain = chain.then(async () => {
    const [cmd, ...rest] = line.trim().split(/\s+/);
    if (!cmd) return prompt();
    const fn = COMMANDS[cmd];
    if (!fn) { console.log('unknown:', cmd, '— try: help'); return prompt(); }
    try { await fn(rest.join(' ')); } catch (e) { console.log('ERROR:', e.message); }
    if (cmd === 'quit') { process.exit(0); }
    prompt();
  });
});
rl.on('close', async () => {
  closed = true;
  await chain;
  if (browser) { await COMMANDS.quit(); process.exit(0); }
});

console.log('loopkeep driver — "help" for commands, "launch" to start');
rl.prompt();
