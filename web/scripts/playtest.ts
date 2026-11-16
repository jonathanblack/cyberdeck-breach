// Drives the real build in headless Chromium and writes screenshots to screenshots/. Run after `npm run build`.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 4319;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
mkdirSync('screenshots', { recursive: true });
const local = existsSync('/opt/pw-browsers') ? readdirSync('/opt/pw-browsers').find((d) => /^chromium-\d+$/.test(d)) : undefined;
let browser;
try { browser = await chromium.launch(); }
catch { browser = await chromium.launch({ executablePath: [`/opt/pw-browsers/${local}/chrome-linux64/chrome`, `/opt/pw-browsers/${local}/chrome-linux/chrome`].find((p) => existsSync(p)) }); }
const errors: string[] = [];
try {
  for (const [name, vp, touch] of [['portrait', { width: 390, height: 844 }, true], ['landscape', { width: 844, height: 390 }, true], ['desktop', { width: 1280, height: 860 }, false]] as const) {
    const page = await browser.newPage({ viewport: vp, hasTouch: touch, isMobile: touch });
    page.setDefaultTimeout(5000);
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const shot = async (n: string) => { await page.waitForTimeout(300); await page.screenshot({ path: `screenshots/${name}-${n}.png`, fullPage: true }); };
    await page.goto(`http://localhost:${PORT}/`);
    await shot('00-start');
    // ---- RUMMY ----
    await page.goto(`http://localhost:${PORT}/?mode=rummy&seed=7`);
    await shot('r1-draw');
    await page.click('[data-act="draw"]');
    // stack a meld into HQ through the engine, so the loop is reachable on any seed
    await page.evaluate(() => { const g = (window as any).__breach; g.hq.push({ id: 801, rank: 5, suit: 's' }, { id: 802, rank: 6, suit: 's' }, { id: 803, rank: 7, suit: 's' }, { id: 804, rank: 8, suit: 's' }); (window as any).__render(); });
    for (const id of [801, 802, 803]) await page.click(`[data-pick="${id}"]`);
    await shot('r2-picked');
    await page.click('[data-act="lay"]');
    await page.click('[data-pick="804"]');
    await page.click('.srv[data-server]');
    await shot('r3-server');
    await page.evaluate(() => { const g = (window as any).__breach; g.score = 999; g.endRound(true); (window as any).__render(); });
    await shot('r4-shop');
    // ---- SOLITAIRE ----
    await page.goto(`http://localhost:${PORT}/?mode=solitaire&seed=7`);
    await shot('s1-setup');
    await page.click('[data-col="1"]');
    await page.click('[data-act="begin"]');
    await page.evaluate(() => { const g = (window as any).__breach; g.servers[0].cards = [{ id: 701, rank: 9, suit: 's' }, { id: 702, rank: 8, suit: 'h' }, { id: 703, rank: 7, suit: 'c' }]; g.vaults.h = [{ id: 704, rank: 1, suit: 'h' }]; g.breach = 3; g.servers[0].dark = false; (window as any).__render(); });
    await shot('s2-turn');
    await page.click('[data-act="recover"]');
    await page.click('[data-row="0"]');
    await shot('s3-place');
    await page.evaluate(() => { const g = (window as any).__breach; g.vaults = { s: Array(5).fill(0).map((_, i) => ({ id: 900 + i, rank: i + 1, suit: 's' })), h: Array(5).fill(0).map((_, i) => ({ id: 910 + i, rank: i + 1, suit: 'h' })), d: [], c: [] }; g.endRound(); (window as any).__render(); });
    await shot('s4-shop');
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('playtest ok: screenshots/');
