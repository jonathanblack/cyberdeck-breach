// Headless sanity report for both slices: greedy players, round 1. `npm run sim -- 300`.
import type { Card, Suit } from '../src/engine/cards';
import { RUN_AFTER, Rummy, isOp, meldOf } from '../src/engine/rummy';
import { Solitaire } from '../src/engine/solitaire';

const N = Number(process.argv[2] ?? 300);
const S: Suit[] = ['s', 'h', 'd', 'c'];
const pct = (a: number) => `${((100 * a) / N).toFixed(0)}%`;
const report = (name: string, scores: number[], target: number) => {
  scores.sort((a, b) => a - b);
  console.log(`${name.padEnd(10)} target ${String(target).padStart(3)} · median ${scores[N >> 1]} · p25 ${scores[N >> 2]} · p90 ${scores[Math.floor(N * 0.9)]} · passes ${pct(scores.filter((x) => x >= target).length)}`);
};

// SOLITAIRE: vault first, otherwise a server with cards, TRACE at breach 3.
const sol: number[] = [];
for (let seed = 1; seed <= N; seed++) {
  const s = new Solitaire(seed); s.placeIce(0); s.begin();
  for (let i = 0; i < 800 && s.phase !== 'over' && s.phase !== 'shop'; i++) {
    if (s.phase === 'turn') {
      let moved = true;
      while (moved) { moved = false; s.servers.forEach((sv, j) => { const t = sv.cards[sv.cards.length - 1]; const v = t && S.find((x) => s.fitsVault(t, x)); if (v && !sv.dark) { s.move({ server: j }, { vault: v }); moved = true; } }); }
      if (s.opsLeft.includes('trace') && s.breach >= 3) { s.playOp('trace'); continue; }
      s.recover();
    } else if (s.phase === 'place') {
      const order = s.row.map((c, k) => ({ c, k })).sort((a, b) => (S.some((x) => s.fitsVault(b.c, x)) ? 1 : 0) - (S.some((x) => s.fitsVault(a.c, x)) ? 1 : 0));
      const pick = order.find(({ c }) => s.canPlaceAny(c));
      if (!pick) { s.noneFits(); continue; }
      const v = S.find((x) => s.fitsVault(pick.c, x));
      if (v) { s.move({ row: pick.k }, { vault: v }); continue; }
      const j = s.servers.findIndex((sv, jj) => sv.cards.length && s.fitsServer(pick.c, jj));
      s.move({ row: pick.k }, { server: j >= 0 ? j : s.servers.findIndex((_, jj) => s.fitsServer(pick.c, jj)) });
    }
  }
  sol.push(s.score());
}
report('SOLITAIRE', sol, new Solitaire(1).target);

// RUMMY: lay the biggest meld, extend, ice the Runner's target, cash big or threatened melds.
function findMeld(hand: Card[]): Card[] | null {
  let best: Card[] | null = null;
  const by = new Map<number, Card[]>(); for (const c of hand) by.set(c.rank, [...(by.get(c.rank) ?? []), c]);
  for (const g of by.values()) if (g.length >= 3 && (!best || g.length > best.length)) best = g;
  for (const su of S) {
    const cs = hand.filter((c) => c.suit === su).sort((a, b) => a.rank - b.rank);
    for (let i = 0; i < cs.length; i++) for (let j = cs.length; j >= i + 3; j--) { const sub = cs.slice(i, j); if (meldOf(sub) && (!best || sub.length > best.length)) best = sub; }
  }
  return best;
}
const rum: number[] = [];
for (let seed = 1; seed <= N; seed++) {
  const g = new Rummy(seed);
  const cardsOf = () => g.hq.filter((x): x is Card => !isOp(x));
  for (let guard = 0; guard < 100 && g.roundIdx === 0 && g.phase !== 'over'; guard++) {
    if (g.phase === 'draw') { g.drawRD(); continue; }
    for (const o of g.hq.filter(isOp)) if (o.op !== 'shortmeld') g.playOp(o.id);
    let m, tries = 0; while (tries++ < 6 && g.servers.length < 4 && (m = findMeld(cardsOf()))) { if (g.lay(m.map((c) => c.id))) break; }
    for (const sv of [...g.servers]) for (const c of cardsOf()) g.extend(sv.id, c.id);
    const runSoon = RUN_AFTER.includes(g.turn);
    const t = g.runnerTarget();
    if (runSoon && t && !t.ice && g.credits >= 2 && g.value(t).total > 40) g.installIce(t.id);
    for (const sv of [...g.servers]) if (sv.cards.length >= 5 || g.turn >= g.turns || (runSoon && sv === g.runnerTarget() && !sv.ice) || g.score + g.value(sv).total >= g.round.target) g.cash(sv.id);
    const cards = cardsOf();
    if (!cards.length) break;
    const keep = (c: Card) => cards.filter((x) => x.rank === c.rank).length >= 2 || cards.some((x) => x.suit === c.suit && Math.abs(x.rank - c.rank) <= 2 && x !== c);
    g.discard([...cards].sort((a, b) => Number(keep(a)) - Number(keep(b)) || b.rank - a.rank)[0].id);
  }
  rum.push(g.score);
}
report('RUMMY', rum, new Rummy(1).round.target);
