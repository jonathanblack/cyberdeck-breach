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
    const shot = (n: string) => page.screenshot({ path: `screenshots/${name}-${n}.png`, fullPage: true });
    await page.goto(`http://localhost:${PORT}/?seed=7`);
    await page.waitForTimeout(300);
    await shot('01-start');
    // stack HQ through the engine: an agenda and a pair, so the whole loop is reachable
    await page.evaluate(() => {
      const g = (window as any).__breach;
      g.hq = [{ kind: 'agenda', id: 901, def: 'lobby' }, { kind: 'poker', id: 902, rank: 9, suit: 's' }, { kind: 'poker', id: 903, rank: 9, suit: 'h' }, { kind: 'poker', id: 904, rank: 4, suit: 's' }, { kind: 'poker', id: 905, rank: 4, suit: 'd' }, ...g.hq.slice(0, 1)];
      g.credits = 9;
      (window as any).__render();
    });
    await page.click('[data-hand="901"]');
    await shot('02-selected');
    await page.click('[data-server="new"]');
    await page.click('[data-hand="902"]'); await page.click('[data-server="r1"]');
    await page.click('[data-hand="904"]'); await page.click('[data-server="r1"]');
    await page.click('[data-ice="rampart"]');
    await shot('03-ice-selected');
    await page.click('[data-server="r1"]');
    await shot('04-built');
    await page.click('[data-act="end"]');
    await page.waitForTimeout(900);
    await shot('05-runner');
    await page.waitForTimeout(3500);
    await shot('06-after');
    // make the pairs and score
    await page.evaluate(() => { const g = (window as any).__breach; const r = g.remote('r1'); if (!r.agenda) r.agenda = { kind: 'agenda', id: 901, def: 'lobby' }; r.cards = [{ kind: 'poker', id: 911, rank: 9, suit: 's' }, { kind: 'poker', id: 912, rank: 9, suit: 'h' }, { kind: 'poker', id: 913, rank: 4, suit: 'd' }, { kind: 'poker', id: 914, rank: 4, suit: 'c' }]; (window as any).__render(); });
    await shot('07-scorable');
    await page.click('[data-score="r1"]');
    await page.click('[data-rules]');
    await shot('08-scored-rules');
    await page.evaluate(() => { const g = (window as any).__breach; g.phase = 'over'; g.winner = 'corp'; g.why = '7 AGENDA POINTS SCORED'; (window as any).__render(); });
    await shot('09-over');
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('playtest ok: screenshots/');
