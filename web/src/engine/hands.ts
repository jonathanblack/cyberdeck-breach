// Poker evaluation (design §4): does a set of up to 5 cards contain a hand, and how close is it.
import type { HandKind, PokerCard } from './api';

const rankCounts = (cards: PokerCard[]): number[] => {
  const m = new Map<number, number>();
  for (const c of cards) m.set(c.rank, (m.get(c.rank) ?? 0) + 1);
  return [...m.values()].sort((a, b) => b - a);
};
const suitMax = (cards: PokerCard[]): number => {
  const m = new Map<string, number>();
  for (const c of cards) m.set(c.suit, (m.get(c.suit) ?? 0) + 1);
  return Math.max(0, ...m.values());
};
/** The most distinct ranks inside any 5-rank window (ace counts high and low). */
const straightBest = (cards: PokerCard[]): number => {
  const ranks = new Set(cards.map((c) => c.rank));
  if (ranks.has(14)) ranks.add(1);
  let best = 0;
  for (let lo = 1; lo <= 10; lo++) {
    let n = 0;
    for (let r = lo; r < lo + 5; r++) if (ranks.has(r)) n++;
    best = Math.max(best, n);
  }
  return best;
};
const straightFlushBest = (cards: PokerCard[]): number => {
  let best = 0;
  for (const s of ['s', 'h', 'd', 'c']) best = Math.max(best, straightBest(cards.filter((c) => c.suit === s)));
  return best;
};

/** How many cards of the hand are in place, and how many it needs. */
export function progress(kind: HandKind, cards: PokerCard[]): { have: number; need: number } {
  const rc = rankCounts(cards);
  const a = rc[0] ?? 0, b = rc[1] ?? 0;
  switch (kind) {
    case 'pair': return { have: Math.min(a, 2), need: 2 };
    case 'twopair': return { have: Math.min(a, 2) + Math.min(b, 2), need: 4 };
    case 'trips': return { have: Math.min(a, 3), need: 3 };
    case 'quads': return { have: Math.min(a, 4), need: 4 };
    case 'fullhouse': return { have: Math.min(a, 3) + Math.min(b, 2), need: 5 };
    case 'flush': return { have: Math.min(suitMax(cards), 5), need: 5 };
    case 'straight': return { have: straightBest(cards), need: 5 };
    case 'straightflush': return { have: straightFlushBest(cards), need: 5 };
  }
}

export function made(kind: HandKind, cards: PokerCard[]): boolean {
  const p = progress(kind, cards);
  return p.have >= p.need;
}
