// Headless balance report: the heuristic Corp bot (engine/bot.ts) against the Runner bot. `npm run sim -- 500`.
import { corpTurn } from '../src/engine/bot';
import { AGENDA_BY_ID } from '../src/engine/content';
import { Game } from '../src/engine/game';

const n = Number(process.argv[2] ?? 500);
let corp = 0, runner = 0, deckOut = 0, turns = 0, corpPts = 0, runnerPts = 0;
const toScore = new Map<string, number[]>();
const runs = new Map<string, Record<string, number>>();
const scoredCount = new Map<string, number>(), stolenCount = new Map<string, number>();

for (let seed = 1; seed <= n; seed++) {
  const g = new Game(seed);
  for (let i = 0; i < 200 && g.phase !== 'over'; i++) corpTurn(g);
  if (g.winner === 'corp') corp++; else if (g.why.includes('R&D')) deckOut++; else runner++;
  turns += g.turn; corpPts += g.corpPoints; runnerPts += g.runnerPoints;
  for (const s of g.scoreLog) toScore.set(s.def, [...(toScore.get(s.def) ?? []), s.turns]);
  for (const r of g.runLog) {
    const key = r.server === 'hq' || r.server === 'rd' ? r.server.toUpperCase() : 'REMOTE';
    const m = runs.get(key) ?? {}; m[r.result] = (m[r.result] ?? 0) + 1; runs.set(key, m);
  }
  for (const d of g.scored) scoredCount.set(d, (scoredCount.get(d) ?? 0) + 1);
  for (const d of g.stolen) stolenCount.set(d, (stolenCount.get(d) ?? 0) + 1);
}

const pct = (x: number, of = n) => `${((100 * x) / of).toFixed(1)}%`;
console.log(`${n} games`);
console.log(`Corp wins ${pct(corp)} · Runner steals 7 ${pct(runner)} · R&D empty ${pct(deckOut)} · avg ${(turns / n).toFixed(1)} turns`);
console.log(`avg points: Corp ${(corpPts / n).toFixed(2)} · Runner ${(runnerPts / n).toFixed(2)}\n`);
console.log('agenda              scored  stolen  turns installed to scored (avg / max)');
for (const [id, def] of Object.entries(AGENDA_BY_ID)) {
  const t = toScore.get(id) ?? [];
  const avg = t.length ? (t.reduce((a, b) => a + b, 0) / t.length).toFixed(1) : '-';
  console.log(`${def.name.padEnd(20)}${String(scoredCount.get(id) ?? 0).padStart(6)}  ${String(stolenCount.get(id) ?? 0).padStart(6)}  ${avg} / ${t.length ? Math.max(...t) : '-'}`);
}
console.log('\nruns       total  stopped  stole  trashed  nothing');
for (const [k, m] of runs) {
  const total = Object.values(m).reduce((a, b) => a + b, 0);
  console.log(`${k.padEnd(10)}${String(total).padStart(6)}  ${pct(m.stopped ?? 0, total).padStart(7)}  ${pct(m.stole ?? 0, total).padStart(5)}  ${pct(m.trashed ?? 0, total).padStart(7)}  ${pct(m.empty ?? 0, total).padStart(7)}`);
}
