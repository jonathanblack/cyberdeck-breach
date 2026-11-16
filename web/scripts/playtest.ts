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
    await page.evaluate(() => { const g = (window as any).__breach; g.ice = [{ uid: 901, id: 'cipher', counter: 0 }, { uid: 902, id: 'rampart', counter: 0 }, { uid: 903, id: 'hydra', counter: 2 }]; (window as any).__render(); });
    await shot('01-round');
    const ids: number[] = await page.evaluate(() => {
      const g = (window as any).__breach;
      const byRank = new Map<number, number[]>();
      for (const c of g.hand) byRank.set(c.rank, [...(byRank.get(c.rank) ?? []), c.id]);
      const pair = [...byRank.values()].find((v) => v.length >= 2);
      return pair ? pair.slice(0, 2) : g.hand.slice(0, 2).map((c: any) => c.id);
    });
    for (const id of ids) await page.click(`[data-card="${id}"]`);
    await page.click('[data-ice="902"]');
    await shot('02-selected');
    await page.click('[data-act="play"]');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `screenshots/${name}-03-scoring.png`, fullPage: true });
    await page.waitForTimeout(3500);
    await shot('04-after');
    await page.evaluate(() => { const g = (window as any).__breach; g.target = 1; g.play([g.hand[0].id]); (window as any).__render(); });
    await page.waitForTimeout(3000);
    await shot('05-cashout');
    await page.click('[data-act="collect"]');
    await page.click('[data-act="levels"]');
    await shot('06-shop');
    await page.evaluate(() => { const g = (window as any).__breach; g.phase = 'over'; g.won = false; (window as any).__render(); });
    await shot('07-over');
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('playtest ok: screenshots/');
