// Headless balance report: how often the house holds, dealing straight and with the bot's cheats, per passive pair. `npm run sim -- 2000`.
import { playBreach } from '../src/engine/bot';
import { PASSIVES, RULES } from '../src/engine/content';
import { Game } from '../src/engine/game';

const n = Number(process.argv[2] ?? 2000);
const pairs: string[][] = [];
for (let i = 0; i < PASSIVES.length; i++) for (let j = i + 1; j < PASSIVES.length; j++) pairs.push([PASSIVES[i].id, PASSIVES[j].id]);

console.log(`${n} breaches each · bankroll ${RULES.bankroll} · target ${RULES.target} · ${RULES.hands} hands\n`);
console.log('passives                  straight  cheating  avg hands  charges used (R S H V)');
for (const pair of pairs) {
  const row = [false, true].map((cheat) => {
    let held = 0, hands = 0; const used = [0, 0, 0, 0];
    for (let seed = 1; seed <= n; seed++) {
      const g = new Game(seed);
      playBreach(g, pair, cheat);
      if (g.winner === 'house') held++;
      hands += g.hand;
      ['reshuffle', 'second', 'swap', 'void'].forEach((k, i) => { used[i] += [2, 3, 1, 1][i] - g.charges[k]; });
    }
    return { held: (100 * held) / n, hands: hands / n, used: used.map((u) => (u / n).toFixed(1)).join(' ') };
  });
  const name = pair.map((p) => PASSIVES.find((x) => x.id === p)!.name).join(' + ');
  console.log(`${name.padEnd(26)}${row[0].held.toFixed(1).padStart(7)}%  ${row[1].held.toFixed(1).padStart(7)}%  ${row[1].hands.toFixed(1).padStart(9)}  ${row[1].used}`);
}
