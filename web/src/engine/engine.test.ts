import { describe, expect, it } from 'vitest';
import type { PokerCard, Suit } from './api';
import { corpTurn } from './bot';
import { Game } from './game';
import { made, progress } from './hands';

let id = 1000;
const c = (rank: number, suit: Suit = 's'): PokerCard => ({ kind: 'poker', id: id++, rank, suit });

describe('hands', () => {
  it('reads pairs, two pair, trips, full house', () => {
    expect(made('pair', [c(5), c(5, 'h')])).toBe(true);
    expect(made('pair', [c(5), c(6)])).toBe(false);
    expect(made('twopair', [c(5), c(5, 'h'), c(9), c(9, 'd')])).toBe(true);
    expect(made('trips', [c(5), c(5, 'h'), c(5, 'd')])).toBe(true);
    expect(made('pair', [c(5), c(5, 'h'), c(5, 'd')])).toBe(true);
    expect(made('fullhouse', [c(5), c(5, 'h'), c(5, 'd'), c(9), c(9, 'h')])).toBe(true);
    expect(made('twopair', [c(5), c(5, 'h'), c(5, 'd'), c(9), c(9, 'h')])).toBe(true);
    expect(made('fullhouse', [c(5), c(5, 'h'), c(5, 'd'), c(5, 'c'), c(9)])).toBe(false);
  });
  it('reads straights, ace high and low, and flushes', () => {
    expect(made('straight', [c(10), c(11, 'h'), c(12), c(13), c(14, 'd')])).toBe(true);
    expect(made('straight', [c(14), c(2, 'h'), c(3), c(4), c(5, 'd')])).toBe(true);
    expect(made('straight', [c(12), c(13, 'h'), c(14), c(2), c(3, 'd')])).toBe(false);
    expect(made('flush', [c(2), c(5), c(9), c(11), c(13)])).toBe(true);
    expect(progress('flush', [c(2), c(5, 'h'), c(9)]).have).toBe(2);
    expect(progress('straight', [c(6), c(8), c(9, 'h')]).have).toBe(3);
  });
});

describe('game', () => {
  it('starts with 6 cards in HQ, 4 clicks, 5 credits', () => {
    const g = new Game(1);
    expect(g.hq.length).toBe(6);
    expect(g.clicks).toBe(4);
    expect(g.credits).toBe(5);
    expect(g.rd.length).toBe(60 - 6);
  });
  it('is deterministic from the seed', () => {
    const play = (seed: number) => { const g = new Game(seed); for (let i = 0; i < 40 && g.phase !== 'over'; i++) corpTurn(g); return JSON.stringify(g.view()); };
    expect(play(42)).toBe(play(42));
  });
  it('installs into a new remote, then scores a made pair', () => {
    const g = new Game(3);
    g.hq = [{ kind: 'agenda', id: 1, def: 'curfew' }, c(7), c(7, 'd')];
    expect(g.install(1, 'new')).toBeNull();
    expect(g.install(g.hq[0].id, 'r1')).toBeNull();
    expect(g.scorable('r1')).toBe(false);
    expect(g.install(g.hq[0].id, 'r1')).toBeNull();
    expect(g.scorable('r1')).toBe(true);
    expect(g.clicks).toBe(1);
    expect(g.score('r1')).toBeNull();
    expect(g.corpPoints).toBe(1);
    expect(g.credits).toBe(6); // one diamond
    expect(g.remote('r1').cards.length).toBe(0);
  });
  it('ICE gains STR from its suit in its remote, and charges per ICE already there', () => {
    const g = new Game(4);
    g.hq = [c(3, 's'), c(4, 's')];
    g.install(g.hq[0].id, 'new'); g.install(g.hq[0].id, 'r1');
    g.clicks = 3; g.credits = 10;
    expect(g.installIce('rampart', 'r1')).toBeNull();
    expect(g.iceStr(g.ice.r1[0], 'r1').str).toBe(4);
    expect(g.iceCost('rampart', 'r1')).toBe(3);
  });
  it('a game always ends', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const g = new Game(seed);
      for (let i = 0; i < 200 && g.phase !== 'over'; i++) corpTurn(g);
      expect(g.phase).toBe('over');
    }
  });
});
