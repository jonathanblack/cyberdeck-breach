// Poker evaluation and hand values (design §4).
import type { Card, HandKind } from './api';

export const HAND_ORDER: HandKind[] = ['high', 'pair', 'twopair', 'trips', 'straight', 'flush', 'fullhouse', 'quads', 'straightflush'];
export const HAND_NAME: Record<HandKind, string> = {
  high: 'HIGH CARD', pair: 'PAIR', twopair: 'TWO PAIR', trips: 'THREE OF A KIND', straight: 'STRAIGHT', flush: 'FLUSH',
  fullhouse: 'FULL HOUSE', quads: 'FOUR OF A KIND', straightflush: 'STRAIGHT FLUSH',
};
/** Base chips, base mult, and what each level adds. */
export const HAND_VALUE: Record<HandKind, { chips: number; mult: number; lc: number; lm: number }> = {
  high: { chips: 5, mult: 1, lc: 10, lm: 1 },
  pair: { chips: 10, mult: 2, lc: 15, lm: 1 },
  twopair: { chips: 20, mult: 2, lc: 20, lm: 1 },
  trips: { chips: 30, mult: 3, lc: 20, lm: 2 },
  straight: { chips: 30, mult: 4, lc: 30, lm: 3 },
  flush: { chips: 35, mult: 4, lc: 15, lm: 2 },
  fullhouse: { chips: 40, mult: 4, lc: 25, lm: 2 },
  quads: { chips: 60, mult: 7, lc: 30, lm: 3 },
  straightflush: { chips: 100, mult: 8, lc: 40, lm: 4 },
};
/** Which hands each hand contains (for "if the hand contains a pair"). */
export const CONTAINS: Record<HandKind, HandKind[]> = {
  high: ['high'], pair: ['pair'], twopair: ['twopair', 'pair'], trips: ['trips', 'pair'], straight: ['straight'], flush: ['flush'],
  fullhouse: ['fullhouse', 'trips', 'twopair', 'pair'], quads: ['quads', 'trips', 'pair'], straightflush: ['straightflush', 'straight', 'flush'],
};

export const cardChips = (c: Card): number => (c.rank === 14 ? 11 : Math.min(c.rank, 10));

function isStraight(cards: Card[]): boolean {
  if (cards.length !== 5) return false;
  const r = [...new Set(cards.map((c) => c.rank))].sort((a, b) => a - b);
  if (r.length !== 5) return false;
  return r[4] - r[0] === 4 || r.join() === '2,3,4,5,14';
}

/** The hand 1–5 cards make, and the cards that score (in play order). */
export function evaluate(cards: Card[]): { kind: HandKind; scoring: Card[] } {
  if (!cards.length) return { kind: 'high', scoring: [] };
  const flush = cards.length === 5 && cards.every((c) => c.suit === cards[0].suit);
  const straight = isStraight(cards);
  const keep = (ids: Set<number>) => cards.filter((c) => ids.has(c.id));
  if (flush && straight) return { kind: 'straightflush', scoring: cards };
  const groups = new Map<number, Card[]>();
  for (const c of cards) groups.set(c.rank, [...(groups.get(c.rank) ?? []), c]);
  const sets = [...groups.values()].sort((a, b) => b.length - a.length || b[0].rank - a[0].rank);
  const ids = (...gs: Card[][]) => new Set(gs.flat().map((c) => c.id));
  if (sets[0].length === 4) return { kind: 'quads', scoring: keep(ids(sets[0])) };
  if (sets[0].length === 3 && sets[1]?.length === 2) return { kind: 'fullhouse', scoring: cards };
  if (flush) return { kind: 'flush', scoring: cards };
  if (straight) return { kind: 'straight', scoring: cards };
  if (sets[0].length === 3) return { kind: 'trips', scoring: keep(ids(sets[0])) };
  if (sets[0].length === 2 && sets[1]?.length === 2) return { kind: 'twopair', scoring: keep(ids(sets[0], sets[1])) };
  if (sets[0].length === 2) return { kind: 'pair', scoring: keep(ids(sets[0])) };
  const high = [...cards].sort((a, b) => b.rank - a.rank)[0];
  return { kind: 'high', scoring: [high] };
}
