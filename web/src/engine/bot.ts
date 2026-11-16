// A greedy player for the sim: plays the best-scoring hand, digs with discards when the best hand is weak, buys ICE it can afford.
import type { Card } from './api';
import type { Game } from './game';

function subsets(hand: Card[]): Card[][] {
  const out: Card[][] = [];
  for (let mask = 1; mask < 1 << hand.length; mask++) {
    const pick: Card[] = [];
    for (let i = 0; i < hand.length; i++) if (mask & (1 << i)) pick.push(hand[i]);
    if (pick.length <= 5) out.push(pick);
  }
  return out;
}

export function bestHand(g: Game): { ids: number[]; total: number; kind: string } | null {
  let best: { ids: number[]; total: number; kind: string } | null = null;
  for (const cards of subsets(g.hand)) {
    const s = g.scoreHand(cards.map((c) => c.id));
    if (typeof s === 'string') continue;
    if (!best || s.total > best.total) best = { ids: s.played, total: s.total, kind: s.kind };
  }
  return best;
}

function playRound(g: Game): void {
  for (let guard = 0; guard < 40 && g.phase === 'round'; guard++) {
    const b = bestHand(g)!;
    const need = g.target - g.score;
    const weak = b.total * g.hands < need && (b.kind === 'high' || b.kind === 'pair');
    if (weak && g.discards > 0) {
      const keep = new Set(b.ids);
      const toss = g.hand.filter((c) => !keep.has(c.id)).sort((x, y) => x.rank - y.rank).slice(0, 5).map((c) => c.id);
      if (toss.length) { g.discard(toss); continue; }
    }
    g.play(b.ids);
  }
}

export function playRun(g: Game): void {
  for (let guard = 0; guard < 200 && g.phase !== 'over'; guard++) {
    if (g.phase === 'round') playRound(g);
    else if (g.phase === 'cashout') g.collect();
    else if (g.phase === 'shop') {
      for (let i = 0; i < 4; i++) {
        const v = g.view();
        const idx = v.offers.findIndex((o) => o.cost <= g.credits && (o.kind === 'protocol' || v.ice.length < v.slots));
        if (idx < 0) break;
        g.buy(idx);
      }
      g.nextRound();
    }
  }
}
