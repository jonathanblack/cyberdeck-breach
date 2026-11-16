import { describe, expect, it } from 'vitest';
import type { Card, Suit } from './api';
import { playRun } from './bot';
import { Game } from './game';
import { evaluate } from './poker';

let id = 9000;
const c = (rank: number, suit: Suit = 's'): Card => ({ id: id++, rank, suit });

describe('poker', () => {
  it('finds hands and the cards that score', () => {
    expect(evaluate([c(5), c(5, 'h'), c(9)]).kind).toBe('pair');
    expect(evaluate([c(5), c(5, 'h'), c(9)]).scoring.length).toBe(2);
    expect(evaluate([c(5), c(5, 'h'), c(9), c(9, 'd')]).kind).toBe('twopair');
    expect(evaluate([c(5), c(5, 'h'), c(5, 'd'), c(9), c(9, 'h')]).kind).toBe('fullhouse');
    expect(evaluate([c(2), c(5), c(9), c(11), c(13)]).kind).toBe('flush');
    expect(evaluate([c(14), c(2, 'h'), c(3), c(4), c(5, 'd')]).kind).toBe('straight');
    expect(evaluate([c(10), c(11), c(12), c(13), c(14)]).kind).toBe('straightflush');
    expect(evaluate([c(3), c(9, 'h')])).toMatchObject({ kind: 'high' });
  });
});

/** A fresh game with this hand. */
function withHand(cards: Card[]): Game {
  const g = new Game(1);
  g.hand = cards;
  return g;
}
const uidOf = (g: Game, iceId: string) => g.owned.find((o) => o.id === iceId)!.uid;

describe('round', () => {
  it('RAMPART: a flush of spades gets +30 per spade', () => {
    const hand = [c(2), c(5), c(9), c(11), c(13), c(3, 'h'), c(4, 'h'), c(6, 'h')];
    const g = withHand(hand);
    const p = g.preview(hand.slice(0, 5).map((x) => x.id), uidOf(g, 'rampart'));
    expect(typeof p).toBe('object');
    // flush 140 + cards 2+5+9+10+10 = 176, + 5 spades x 30 = 326
    expect((p as { str: number }).str).toBe(326);
  });
  it('CIPHER doubles a pair; WATCHDOG feeds the others', () => {
    const hand = [c(13), c(13, 'h'), c(2, 'd'), c(3, 'd'), c(4, 'c'), c(6, 'c'), c(7, 'c'), c(8, 'c')];
    const g = withHand(hand);
    expect(g.play([hand[0].id, hand[1].id], uidOf(g, 'cipher'))).toBeNull();
    expect(g.str.get(uidOf(g, 'cipher'))).toBe((40 + 20) * 2);
    expect(g.play([hand[2].id, hand[3].id], uidOf(g, 'watchdog'))).toBeNull();
    expect(g.str.get(uidOf(g, 'rampart'))).toBe(20);
    expect(g.hands).toBe(2);
    expect(g.hand.length).toBe(8);
  });
  it('the breach is absorbed outermost first; SPARK halves the outermost; order decides it', () => {
    const g = new Game(1);
    const [r, ci, w] = ['rampart', 'cipher', 'watchdog'].map((k) => uidOf(g, k));
    g.str.set(r, 440); g.str.set(ci, 170); g.str.set(w, 120);
    g.breachBase = 650;
    expect(g.computeBreach([r, ci, w]).held).toBe(false);
    expect(g.computeBreach([w, ci, r]).held).toBe(true);
    expect(g.computeBreach([w, ci, r]).through).toBe(0);
  });
  it('holding scores the agenda; the Boardroom pays out and sells ICE', () => {
    const g = new Game(1);
    for (const o of g.owned) g.str.set(o.uid, 1000);
    expect(g.breachNow()).toBeNull();
    expect(g.breach!.held).toBe(true);
    expect(g.corpPoints).toBe(1);
    const before = g.credits;
    g.next();
    expect(g.phase).toBe('board');
    expect(g.credits).toBe(before + 4 + 4 + 3);
    expect(g.offers.length).toBe(3);
    const offer = g.offers.find((o) => g.view().offers.find((x) => x.id === o)!.cost <= g.credits)!;
    expect(g.buy(offer)).toBeNull();
    expect(g.owned.length).toBe(4);
    expect(g.order.length).toBe(3);
    expect(g.nextRound()).toBeNull();
    expect(g.round).toBe(2);
  });
  it('is deterministic and a run always ends', () => {
    const run = (seed: number) => { const g = new Game(seed); playRun(g); return g; };
    expect(JSON.stringify(run(4).view())).toBe(JSON.stringify(run(4).view()));
    for (let s = 1; s <= 20; s++) expect(run(s).phase).toBe('over');
  });
});
