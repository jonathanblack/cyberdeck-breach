import { describe, expect, it } from 'vitest';
import type { Card, Suit } from './cards';
import { Rummy, isOp, meldError, meldOf } from './rummy';
import { Solitaire } from './solitaire';

let id = 9000;
const c = (rank: number, suit: Suit = 's'): Card => ({ id: id++, rank, suit });

describe('rummy', () => {
  it('reads sets and runs, ace high or low', () => {
    expect(meldOf([c(7), c(7, 'h'), c(7, 'd')])?.kind).toBe('set');
    expect(meldOf([c(5), c(7), c(6)])?.kind).toBe('run');
    expect(meldOf([c(12), c(13), c(1)])?.kind).toBe('run');
    expect(meldOf([c(1), c(2), c(3)])?.kind).toBe('run');
    expect(meldOf([c(13), c(1), c(2)])).toBeNull();
    expect(meldOf([c(5), c(6, 'h'), c(7)])).toBeNull();
    expect(meldError([c(5), c(6, 'h'), c(7)])).toBe('A RUN MUST BE ALL ONE SUIT');
    expect(meldError([c(5), c(7), c(8)])).toBe('A RUN MUST BE IN SEQUENCE WITH NO GAPS');
  });
  it('lay, extend, cash: points x (cards - 2)', () => {
    const g = new Rummy(1);
    const run = [c(5), c(6), c(7), c(8)];
    g.hq = [...run, c(13, 'h')];
    g.drawRD();
    expect(g.lay(run.slice(0, 3).map((x) => x.id))).toBeNull();
    expect(g.extend(g.servers[0].id, run[3].id)).toBeNull();
    expect(g.value(g.servers[0])).toMatchObject({ points: 26, mult: 2, total: 52 });
    expect(g.cash(g.servers[0].id)).toBeNull();
    expect(g.score).toBe(52);
  });
  it('the Runner steals from the biggest server unless ICE holds; a short meld breaks', () => {
    const g = new Rummy(2);
    const set = [c(9), c(9, 'h'), c(9, 'd')];
    g.hq = [...set, c(2, 'c'), c(3, 'c')];
    g.turn = 2; g.phase = 'main';
    g.lay(set.map((x) => x.id));
    g.discard(g.hq.find((x) => !isOp(x))!.id);
    expect(g.servers.length).toBe(0);
    expect(g.archives.length).toBe(3);
  });
  it('ICE with enough STR stops the run', () => {
    const g = new Rummy(3);
    const set = [c(9), c(9, 'h'), c(9, 'd')];
    g.hq = [...set, c(2, 'c')];
    g.turn = 2; g.phase = 'main'; g.credits = 5;
    g.lay(set.map((x) => x.id));
    g.installIce(g.servers[0].id);
    g.discard(g.hq[0].id);
    expect(g.servers[0].cards.length).toBe(3);
  });
});

describe('solitaire', () => {
  const fresh = () => {
    const g = new Solitaire(1);
    g.lines = Array.from({ length: 6 }, () => ({ down: [], up: [], flooded: false, floodedComps: 0 }));
    g.deck = []; g.discards = [];
    return g;
  };
  it('series move onto the same colour one higher; empty lines take kings; vaults open with aces', () => {
    const g = fresh();
    g.lines[0].up = [c(9, 'h'), c(8, 'd')];
    g.lines[1].up = [c(10, 'd')];
    expect(g.move(0, 0, { line: 1 })).toBeNull();
    expect(g.lines[1].up.map((x) => x.rank)).toEqual([10, 9, 8]);
    g.lines[2].up = [c(7, 's')];
    expect(g.move(2, 0, { line: 1 })).toBe('CLASSES NEVER MIX: SAME COLOUR ONLY');
    g.lines[3].up = [c(12, 's')];
    expect(g.move(3, 0, { line: 4 })).toBe('AN EMPTY LINE TAKES ONLY A KING');
    g.lines[3].up = [c(1, 's')];
    expect(g.move(3, 0, { vault: 0 })).toBeNull();
    g.lines[3].up = [c(2, 'c')];
    expect(g.move(3, 0, { vault: 0 })).toBeNull();
    expect(g.vaults[0].length).toBe(2);
  });
  it('a move that empties the face-up cards turns the next one up', () => {
    const g = fresh();
    g.lines[0].down = [c(4, 'c')]; g.lines[0].up = [c(1, 'h')];
    g.move(0, 0, { vault: 0 });
    expect(g.lines[0].up[0].rank).toBe(4);
    expect(g.lines[0].down.length).toBe(0);
  });
  it('recover: place exactly one fitting card; nothing fits: discard, breach, compensation', () => {
    const g = fresh();
    g.deck = [c(1, 'h'), c(6, 'c'), c(9, 'd')];
    g.recover(3);
    expect(g.phase).toBe('place');
    expect(g.place(0, { vault: 0 })).toBeNull();
    expect(g.discards.length).toBe(2);
    g.deck = [c(5, 'c')];
    g.lines[0].up = [c(9, 'h')];
    const ops = g.hand.length;
    g.recover(1);
    expect(g.breach).toBe(1);
    expect(g.hand.length).toBe(ops + 1);
  });
  it('a flooded server scrambles its cards into the next one', () => {
    const g = fresh();
    g.lines[0].up = [c(9, 'h')]; g.lines[0].down = [c(3, 'c')];
    g.lines[1].up = [c(5, 's')];
    g.deck = [c(2, 'c')]; g.lines[2].up = [c(9, 'd')];
    g.recover(1);
    expect(g.lines[0].flooded).toBe(true);
    expect(g.lines[1].down.length + g.lines[1].up.length).toBe(3);
  });
  it('random play always ends', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = new Solitaire(seed);
      for (let i = 0; i < 2000 && s.phase !== 'over'; i++) {
        if (s.phase === 'turn') s.recover(2);
        else if (s.phase === 'place') {
          const k = s.pending.findIndex((x) => s.canGoAnywhere(x));
          const card = s.pending[k];
          const v = s.vaults.findIndex((_, j) => s.fitsVault(card, j));
          s.place(k, v >= 0 ? { vault: v } : { line: s.lines.findIndex((_, j) => s.fitsLine(card, j)) });
        }
      }
      expect(s.phase).toBe('over');
      const r = new Rummy(seed);
      for (let i = 0; i < 200 && r.phase !== 'over' && r.phase !== 'shop'; i++) {
        if (r.phase === 'draw') r.drawRD();
        else { const card = r.hq.find((x) => !isOp(x)); if (card) r.discard(card.id); else break; }
      }
      expect(['over', 'shop']).toContain(r.phase);
    }
  });
});
