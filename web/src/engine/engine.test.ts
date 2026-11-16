import { describe, expect, it } from 'vitest';
import type { Card, Scored, Suit } from './api';
import { playRun } from './bot';
import { Game } from './game';
import { evaluate } from './poker';

let id = 9000;
const c = (rank: number, suit: Suit = 's'): Card => ({ id: id++, rank, suit });

describe('poker', () => {
  it('finds hands and the cards that score', () => {
    expect(evaluate([c(5), c(5, 'h'), c(9)])).toMatchObject({ kind: 'pair' });
    expect(evaluate([c(5), c(5, 'h'), c(9)]).scoring.length).toBe(2);
    expect(evaluate([c(5), c(5, 'h'), c(5, 'd'), c(9), c(9, 'h')]).kind).toBe('fullhouse');
    expect(evaluate([c(14), c(2, 'h'), c(3), c(4), c(5, 'd')]).kind).toBe('straight');
    expect(evaluate([c(10), c(11), c(12), c(13), c(14)]).kind).toBe('straightflush');
  });
});

function withHand(cards: Card[], ice: string[] = []): Game {
  const g = new Game(1);
  g.hand = cards;
  g.ice = ice.map((iceId, i) => ({ uid: 100 + i, id: iceId, counter: 0 }));
  return g;
}
const score = (g: Game, cards: Card[]) => g.scoreHand(cards.map((x) => x.id)) as Scored;

describe('scoring', () => {
  it('a pair of kings with no ICE: (10 + 10 + 10) x 2', () => {
    const k = [c(13), c(13, 'h')];
    expect(score(withHand(k), k).total).toBe(60);
  });
  it('ICE applies left to right: +mult before xmult beats xmult before +mult', () => {
    const k = [c(13), c(13, 'h')];
    expect(score(withHand(k, ['cipher', 'blackice']), k).total).toBe(30 * 30);
    expect(score(withHand(k, ['blackice', 'cipher']), k).total).toBe(30 * 14);
  });
  it('per-card triggers and MIRROR', () => {
    const hand = [c(2), c(5), c(9), c(11), c(13)];
    const s = score(withHand(hand, ['rampart']), hand);
    expect(s.kind).toBe('flush');
    expect(s.mult).toBe(4 + 5 * 3);
    const m = score(withHand(hand, ['mirror']), hand);
    expect(m.chips).toBe(35 + 2 + 5 + 9 + 10 + 10 + 2);
  });
  it('a played hand scores, wins the round, cashes out to the shop', () => {
    const g = new Game(1);
    g.target = 1;
    const ids = [g.hand[0].id];
    expect(g.play(ids)).toBeNull();
    expect(g.phase).toBe('cashout');
    g.collect();
    expect(g.phase).toBe('shop');
    expect(g.offers.length).toBe(3);
    g.credits = 50;
    expect(g.buy(0)).toBeNull();
    expect(g.ice.length).toBe(1);
    g.nextRound();
    expect(g.roundInAnte).toBe(2);
  });
  it('running out of hands below the target ends the run', () => {
    const g = new Game(1);
    g.target = 1e9;
    for (let i = 0; i < 4; i++) g.play([g.hand[0].id]);
    expect(g.phase).toBe('over');
    expect(g.won).toBe(false);
  });
  it('is deterministic and a run always ends', () => {
    const run = (seed: number) => { const g = new Game(seed); playRun(g); return g; };
    expect(JSON.stringify(run(4).view())).toBe(JSON.stringify(run(4).view()));
    for (let s = 1; s <= 15; s++) expect(run(s).phase).toBe('over');
  });
});
