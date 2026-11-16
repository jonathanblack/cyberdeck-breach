// Headless balance report: a greedy Corp bot plays whole runs. Hold rate and margin per round, run win rate. `npm run sim -- 300`.
import { playRun } from '../src/engine/bot';
import { roundSpec } from '../src/engine/content';
import { Game } from '../src/engine/game';

const n = Number(process.argv[2] ?? 300);
let corp = 0, rounds = 0;
const perRound = new Map<number, { held: number; total: number; str: number }>();
for (let seed = 1; seed <= n; seed++) {
  const g = new Game(seed);
  // record each breach as it happens
  const orig = g.next.bind(g);
  g.next = () => {
    const b = g.breach!;
    const r = perRound.get(g.round) ?? { held: 0, total: 0, str: 0 };
    r.total++; if (b.held) r.held++;
    r.str += b.steps.reduce((s, x) => s + Math.max(0, x.str), 0);
    perRound.set(g.round, r);
    return orig();
  };
  playRun(g);
  if (g.winner === 'corp') corp++;
  rounds += g.round;
}
console.log(`${n} runs · Corp wins ${((100 * corp) / n).toFixed(1)}% · avg ${(rounds / n).toFixed(1)} rounds\n`);
console.log('round  breach  reached  held   avg total ICE STR');
for (const [k, r] of [...perRound].sort((a, b) => a[0] - b[0])) {
  console.log(`${String(k).padStart(5)}  ${String(roundSpec(k).breach).padStart(6)}  ${String(r.total).padStart(7)}  ${((100 * r.held) / r.total).toFixed(0).padStart(3)}%  ${Math.round(r.str / r.total).toString().padStart(8)}`);
}
