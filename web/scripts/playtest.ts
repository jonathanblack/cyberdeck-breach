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
    await page.goto(`http://localhost:${PORT}/?seed=7`);
    await page.waitForTimeout(300);
    await page.click('[data-pick="ties"]');
    await page.click('[data-pick="coldshoe"]');
    await shot('01-loadout');
    await page.click('[data-act="start"]');
    await shot('02-bet');
    await page.click('[data-act="deal"]');
    await page.click('[data-act="deal"]');
    await shot('03-dealing');
    await page.click('[data-act="second"]');
    // deal straight until the Runner is done or the hand ends
    for (let i = 0; i < 12; i++) {
      const phase = await page.evaluate(() => (window as any).__breach.phase);
      if (phase !== 'deal') break;
      await page.click('[data-act="deal"]');
    }
    await shot('04-hole-or-settled');
    for (let i = 0; i < 12; i++) {
      const phase = await page.evaluate(() => (window as any).__breach.phase);
      if (phase === 'settled' || phase === 'over') break;
      await page.click(phase === 'hole' ? '[data-act="reveal"]' : '[data-act="deal"]');
    }
    await shot('05-settled');
    await page.evaluate(() => { const g = (window as any).__breach; g.phase = 'over'; g.winner = 'house'; g.why = 'THE TABLE HELD FOR 12 HANDS'; (window as any).__render(); });
    await shot('06-over');
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('playtest ok: screenshots/');
