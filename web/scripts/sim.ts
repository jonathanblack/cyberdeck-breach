// Headless sanity report: a greedy bot plays whole runs. Where runs end, and the win rate. `npm run sim -- 200`.
import { playRun } from '../src/engine/bot';
import { Game } from '../src/engine/game';

const n = Number(process.argv[2] ?? 200);
let wins = 0;
const endedAt = new Map<string, number>();
for (let seed = 1; seed <= n; seed++) {
  const g = new Game(seed);
  playRun(g);
  if (g.won) wins++;
  else { const k = `ANTE ${g.ante} ROUND ${g.roundInAnte}`; endedAt.set(k, (endedAt.get(k) ?? 0) + 1); }
}
console.log(`${n} runs · the greedy bot wins ${((100 * wins) / n).toFixed(1)}%\n`);
console.log('runs lost at:');
for (const [k, v] of [...endedAt].sort()) console.log(`  ${k.padEnd(18)} ${v}`);
