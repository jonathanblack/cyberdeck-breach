// Blackjack arithmetic and the Runner's play (design §2, §4): hand totals, Hi-Lo counting, basic strategy.
import type { Card } from './api';

export const cardValue = (c: Card): number => (c.rank === 1 ? 1 : Math.min(c.rank, 10));

/** Best total, whether an ace is counted as 11, and bust/natural flags. */
export function total(cards: Card[]): { total: number; soft: boolean; bust: boolean; natural: boolean } {
  let sum = 0, aces = 0;
  for (const c of cards) { sum += cardValue(c); if (c.rank === 1) aces++; }
  const soft = aces > 0 && sum + 10 <= 21;
  const t = soft ? sum + 10 : sum;
  return { total: t, soft, bust: t > 21, natural: cards.length === 2 && t === 21 };
}

/** Hi-Lo: 2–6 = +1, 7–9 = 0, 10–A = −1. */
export const hiLo = (c: Card): number => { const v = cardValue(c); return v >= 2 && v <= 6 ? 1 : v === 1 || v === 10 ? -1 : 0; };

export type Play = 'hit' | 'stand' | 'double';

/** Basic strategy, dealer stands on 17, no splits. `up` is the dealer's face-up card. */
export function basicStrategy(cards: Card[], up: Card, canDouble: boolean): Play {
  const { total: t, soft } = total(cards);
  const d = up.rank === 1 ? 11 : cardValue(up);
  const dbl = (p: boolean): Play => (p && canDouble ? 'double' : 'hit');
  if (soft) {
    if (t >= 19) return 'stand';
    if (t === 18) { if (d >= 3 && d <= 6) return canDouble ? 'double' : 'stand'; return d <= 8 ? 'stand' : 'hit'; }
    if (t === 17) return dbl(d >= 3 && d <= 6);
    if (t >= 15) return dbl(d >= 4 && d <= 6);
    return dbl(d >= 5 && d <= 6);
  }
  if (t >= 17) return 'stand';
  if (t >= 13) return d <= 6 ? 'stand' : 'hit';
  if (t === 12) return d >= 4 && d <= 6 ? 'stand' : 'hit';
  if (t === 11) return dbl(true);
  if (t === 10) return dbl(d <= 9);
  if (t === 9) return dbl(d >= 3 && d <= 6);
  return 'hit';
}
