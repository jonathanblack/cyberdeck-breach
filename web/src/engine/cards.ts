// Cards shared by both slices (design §1).
import type { Rng } from './rng';

export type Suit = 's' | 'h' | 'd' | 'c';
export const SUITS: Suit[] = ['s', 'h', 'd', 'c'];
/** 1 = ace (low) .. 13 = king. Rummy runs may also use the ace above the king. */
export interface Card { id: number; rank: number; suit: Suit }
/** An operation card in a deck or hand (rummy keeps them in R&D). */
export interface OpCard { id: number; op: string }

export const isRed = (s: Suit): boolean => s === 'h' || s === 'd';
export const rankName = (r: number): string => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' } as Record<number, string>)[r] ?? String(r);
export const SUIT_NAME: Record<Suit, string> = { s: 'SPADES', h: 'HEARTS', d: 'DIAMONDS', c: 'CLUBS' };
export const cardName = (c: Card): string => `${rankName(c.rank)} OF ${SUIT_NAME[c.suit]}`;
/** Design §1: 2–10 face value, J Q K 10, A 11. */
export const cardPoints = (c: Card): number => (c.rank === 1 ? 11 : Math.min(c.rank, 10));

export function standardDeck(rng: Rng, firstId = 1): Card[] {
  const deck: Card[] = [];
  let id = firstId;
  for (const suit of SUITS) for (let rank = 1; rank <= 13; rank++) deck.push({ id: id++, rank, suit });
  return rng.shuffle(deck);
}
