// Poker evaluation (design §4): the best hand in 1–5 cards, which cards score, and its base STR.
import type { Card, HandKind } from './api';

export const HAND_BASE: Record<HandKind, number> = {
  high: 10, pair: 40, twopair: 80, trips: 100, straight: 130, flush: 140, fullhouse: 180, quads: 250, straightflush: 400,
};
export const HAND_NAME: Record<HandKind, string> = {
  high: 'HIGH CARD', pair: 'PAIR', twopair: 'TWO PAIR', trips: 'THREE OF A KIND', straight: 'STRAIGHT', flush: 'FLUSH',
  fullhouse: 'FULL HOUSE', quads: 'FOUR OF A KIND', straightflush: 'STRAIGHT FLUSH',
};
export const cardValue = (c: Card): number => (c.rank === 14 ? 11 : Math.min(c.rank, 10));

function isStraight(cards: Card[]): boolean {
  if (cards.length !== 5) return false;
  const r = [...new Set(cards.map((c) => c.rank))].sort((a, b) => a - b);
  if (r.length !== 5) return false;
  if (r[4] - r[0] === 4) return true;
  return r.join() === '2,3,4,5,14';
}

/** The hand 1–5 cards make, and the ids of the cards that score. */
export function evaluate(cards: Card[]): { kind: HandKind; scoring: Card[] } {
  if (!cards.length) return { kind: 'high', scoring: [] };
  const flush = cards.length === 5 && cards.every((c) => c.suit === cards[0].suit);
  const straight = isStraight(cards);
  if (flush && straight) return { kind: 'straightflush', scoring: cards };
  const groups = new Map<number, Card[]>();
  for (const c of cards) groups.set(c.rank, [...(groups.get(c.rank) ?? []), c]);
  const sets = [...groups.values()].sort((a, b) => b.length - a.length || b[0].rank - a[0].rank);
  if (sets[0].length === 4) return { kind: 'quads', scoring: sets[0] };
  if (sets[0].length === 3 && sets[1]?.length === 2) return { kind: 'fullhouse', scoring: [...sets[0], ...sets[1]] };
  if (flush) return { kind: 'flush', scoring: cards };
  if (straight) return { kind: 'straight', scoring: cards };
  if (sets[0].length === 3) return { kind: 'trips', scoring: sets[0] };
  if (sets[0].length === 2 && sets[1]?.length === 2) return { kind: 'twopair', scoring: [...sets[0], ...sets[1]] };
  if (sets[0].length === 2) return { kind: 'pair', scoring: sets[0] };
  const high = [...cards].sort((a, b) => b.rank - a.rank)[0];
  return { kind: 'high', scoring: [high] };
}
