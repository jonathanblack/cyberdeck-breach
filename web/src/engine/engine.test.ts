import { describe, expect, it } from 'vitest';
import type { Card, Suit } from './cards';
import { Rummy, isOp, meldOf } from './rummy';
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
  it('builds down a server in alternating colours and up a vault from the ace', () => {
    const g = new Solitaire(1);
    g.begin();
    expect(g.fitsServer(c(9), 0)).toBe(true);
    g.servers[0].cards = [c(9)];
    expect(g.fitsServer(c(8, 'h'), 0)).toBe(true);
    expect(g.fitsServer(c(8, 'c'), 0)).toBe(false);
    expect(g.fitsVault(c(1, 'h'), 'h')).toBe(true);
    expect(g.fitsVault(c(2, 'h'), 'h')).toBe(false);
  });
  it('recover must place one; the rest go under the deck', () => {
    const g = new Solitaire(1);
    g.begin();
    g.deck = [c(1, 'h'), c(10), c(4, 'd'), c(6, 'c'), ...g.deck];
    g.recover();
    expect(g.phase).toBe('place');
    expect(g.move({ row: 0 }, { vault: 'h' })).toBeNull();
    expect(g.vaults.h.length).toBe(1);
    expect(g.row.length).toBe(0);
    expect(g.phase).toBe('turn');
  });
  it('the breach takes servers at 2, 4, 6, 8; BARRIER saves one; CODE GATE skips', () => {
    const g = new Solitaire(1);
    g.placeIce(0);
    g.begin();
    g.servers[1].ice = 'codegate';
    g.servers[0].cards = [c(9)]; g.servers[1].cards = [c(8)]; g.servers[2].cards = [c(7)];
    (g as unknown as { spread: (n: number) => void }).spread(2);
    expect(g.servers[0].dark).toBe(false);
    (g as unknown as { spread: (n: number) => void }).spread(2);
    expect(g.servers[0].dark).toBe(true);
    (g as unknown as { spread: (n: number) => void }).spread(2);
    expect(g.servers[1].dark).toBe(false);
    expect(g.servers[2].dark).toBe(true);
  });
  it('random play always ends both slices', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = new Solitaire(seed); s.begin();
      for (let i = 0; i < 400 && s.phase !== 'over' && s.phase !== 'shop'; i++) {
        if (s.phase === 'turn') s.recover();
        else if (s.phase === 'place') {
          const k = s.row.findIndex((x) => s.canPlaceAny(x));
          if (k < 0) { s.noneFits(); continue; }
          const card = s.row[k];
          const v = (['s', 'h', 'd', 'c'] as Suit[]).find((x) => s.fitsVault(card, x));
          if (v) s.move({ row: k }, { vault: v }); else s.move({ row: k }, { server: s.servers.findIndex((_, j) => s.fitsServer(card, j)) });
        }
      }
      expect(['over', 'shop']).toContain(s.phase);
      const r = new Rummy(seed);
      for (let i = 0; i < 200 && r.phase !== 'over' && r.phase !== 'shop'; i++) {
        if (r.phase === 'draw') r.drawRD();
        else { const card = r.hq.find((x) => !isOp(x)); if (card) r.discard(card.id); else break; }
      }
      expect(['over', 'shop']).toContain(r.phase);
    }
  });
});
