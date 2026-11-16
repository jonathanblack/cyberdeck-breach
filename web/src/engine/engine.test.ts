import { describe, expect, it } from 'vitest';
import type { Card, Suit } from './api';
import { basicStrategy, hiLo, total } from './blackjack';
import { playBreach } from './bot';
import { Game } from './game';

let id = 5000;
const c = (rank: number, suit: Suit = 's'): Card => ({ id: id++, rank, suit });

describe('blackjack', () => {
  it('totals hands with soft aces', () => {
    expect(total([c(1), c(13)])).toMatchObject({ total: 21, soft: true, natural: true });
    expect(total([c(1), c(6), c(9)])).toMatchObject({ total: 16, soft: false });
    expect(total([c(1), c(1), c(9)])).toMatchObject({ total: 21, soft: true, natural: false });
    expect(total([c(10), c(9), c(5)]).bust).toBe(true);
  });
  it('counts Hi-Lo', () => {
    expect([2, 6, 7, 9, 10, 13, 1].map((r) => hiLo(c(r)))).toEqual([1, 1, 0, 0, -1, -1, -1]);
  });
  it('plays basic strategy', () => {
    expect(basicStrategy([c(10), c(6)], c(10), true)).toBe('hit');
    expect(basicStrategy([c(10), c(6)], c(5), true)).toBe('stand');
    expect(basicStrategy([c(6), c(5)], c(10), true)).toBe('double');
    expect(basicStrategy([c(6), c(5)], c(10), false)).toBe('hit');
    expect(basicStrategy([c(1), c(7)], c(9), true)).toBe('hit');
    expect(basicStrategy([c(10), c(2)], c(4), true)).toBe('stand');
  });
});

/** A game whose shoe starts with these cards, in order. */
function rigged(cards: Card[], passives = ['ties', 'evenmoney']): Game {
  const g = new Game(1);
  g.shoe = [...cards, ...g.shoe];
  g.choosePassives(passives);
  return g;
}

/** Play the current hand to its end, dealing straight. */
function finish(g: Game): void {
  for (let i = 0; i < 40 && g.phase !== 'settled' && g.phase !== 'over'; i++) {
    if (g.phase === 'hole') g.reveal(); else g.deal();
  }
}

describe('breach', () => {
  it('deals card by card, and the Runner stands on 20', () => {
    const g = rigged([c(10), c(9), c(10), c(8)]);
    expect(g.phase).toBe('bet');
    g.deal();
    for (let i = 0; i < 4; i++) g.deal();
    expect(g.phase).toBe('hole');
    g.reveal();
    expect(g.result).toEqual({ outcome: 'win', delta: 20 });
    expect(g.bankroll).toBe(120);
  });
  it('SECOND DEAL deals the card under the top one', () => {
    const g = rigged([c(10), c(5), c(9), c(10), c(8)]);
    g.deal();
    expect(g.deal(true)).toBeNull();
    expect(g.runnerCards[0].rank).toBe(5);
    expect(g.charges.second).toBe(2);
  });
  it('HOUSE TIES turns a push into a loss; VOID returns the bet', () => {
    const g = rigged([c(10), c(10), c(9), c(9)]);
    g.deal(); for (let i = 0; i < 4; i++) g.deal();
    g.reveal();
    expect(g.result).toEqual({ outcome: 'lose', delta: -20 });
    g.next();
    g.void();
    expect(g.result).toEqual({ outcome: 'void', delta: 0 });
  });
  it('HOLE SWAP trades the hole card for the top card', () => {
    const g = rigged([c(10), c(10), c(10), c(6), c(5)]);
    g.deal(); for (let i = 0; i < 4; i++) g.deal();
    expect(g.phase).toBe('hole');
    g.swap();
    expect(g.dealerCards[1].rank).toBe(5);
    expect(g.shoe[0].rank).toBe(6);
  });
  it('RESHUFFLE resets the count; COLD SHOE makes the next bet the minimum', () => {
    const g = rigged([c(2), c(3), c(4), c(5), c(10)], ['coldshoe', 'ties']);
    g.count = 12;
    expect(g.reshuffle()).toBeNull();
    expect(g.count).toBe(0);
    finish(g);
    g.count = 12;
    g.next();
    expect(g.bet).toBe(10);
  });
  it('is deterministic and always ends', () => {
    const run = (seed: number) => { const g = new Game(seed); playBreach(g, ['ties', 'stand16']); return g; };
    expect(JSON.stringify(run(9).view())).toBe(JSON.stringify(run(9).view()));
    for (let s = 1; s <= 50; s++) expect(run(s).phase).toBe('over');
  });
});
