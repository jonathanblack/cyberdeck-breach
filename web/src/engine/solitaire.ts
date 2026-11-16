// The SOLITAIRE round (design §3): SOS Titanic's rules on a standard deck. Colour is class; save cards into vaults while the breach floods your servers.
import type { Card } from './cards';
import { isRed, rankName, standardDeck } from './cards';
import { Rng } from './rng';

export type Result = string | null;
export const LINES = 6;
export const DEALT = [4, 6, 8, 10, 0, 0];
export const COMPARTMENTS = [1, 2, 2, 2, 2, 3];
export const BREACH_MAX = COMPARTMENTS.reduce((a, b) => a + b, 0);
export const VAULTS = 4;
export const MAX_DRAW = 3;

export const OPS: Record<string, { name: string; text: string; copies: number }> = {
  lookahead: { name: 'LOOKAHEAD', text: 'Look at the top 5 of the deck; send any of them to the bottom.', copies: 2 },
  defrag: { name: 'DEFRAG', text: 'Shuffle the deck and the discards together. No breach.', copies: 1 },
  plana: { name: 'PLAN A', text: 'Take any operation from the pile.', copies: 1 },
  planb: { name: 'PLAN B', text: 'Take any used operation.', copies: 1 },
  pull: { name: 'PULL', text: 'Search the deck for a card that fits and place it. None: the breach advances.', copies: 3 },
  restore: { name: 'RESTORE', text: 'Search the discards for a card that fits and place it. None: the breach advances.', copies: 3 },
  reindex: { name: 'REINDEX', text: 'Choose a line, pick any of its cards as its face-up front; the rest go face down.', copies: 2 },
  rebalance: { name: 'REBALANCE', text: 'Choose two lines; shuffle their cards and deal them back in equal shares.', copies: 2 },
  purge: { name: 'PURGE', text: 'Discard all face-up cards of one line; the next one turns up.', copies: 2 },
};

export interface Line { down: Card[]; up: Card[]; flooded: boolean; floodedComps: number }
/**
 * turn: move cards freely, then RECOVER or play an operation · place: drawn or searched cards wait; place one ·
 * look: LOOKAHEAD's top 5 · pickop: PLAN A / PLAN B · pickline: an operation wants a line · pickcard: REINDEX's card · over.
 */
export type Phase = 'turn' | 'place' | 'look' | 'pickop' | 'pickline' | 'pickcard' | 'over';
export type To = { line: number } | { vault: number };

export class Solitaire {
  readonly seed: number;
  private rng: Rng;
  phase: Phase = 'turn';
  lines: Line[] = [];
  vaults: Card[][] = [];
  deck: Card[] = [];
  discards: Card[] = [];
  breach = 0;
  turn = 1;
  hand: string[] = [];
  opPile: string[] = [];
  opUsed: string[] = [];
  /** Cards waiting to be placed (RECOVER, PULL, RESTORE), and where they came from. */
  pending: Card[] = [];
  pendingFrom: 'draw' | 'deck' | 'discards' | null = null;
  /** The operation that is asking for a pick, and the lines picked so far. */
  asking: string | null = null;
  picked: number[] = [];
  log: string[] = [];

  constructor(seed: number) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.deck = standardDeck(this.rng);
    this.lines = DEALT.map((n) => {
      const cards = this.deck.splice(0, n);
      return { down: cards.slice(0, -1), up: cards.slice(-1), flooded: false, floodedComps: 0 };
    });
    this.vaults = Array.from({ length: VAULTS }, () => []);
    for (const [op, d] of Object.entries(OPS)) for (let i = 0; i < d.copies; i++) this.opPile.push(op);
    this.rng.shuffle(this.opPile);
    this.hand = this.opPile.splice(0, 2);
    this.say('THE BREACH HAS STARTED. SAVE WHAT YOU CAN INTO THE VAULTS BEFORE THE LAST SERVER FLOODS.');
  }

  // ---- queries ----

  private say(s: string) { this.log.push(s); }
  front(i: number): Card | undefined { const l = this.lines[i]; return l.up[l.up.length - 1]; }
  isEmpty(i: number): boolean { const l = this.lines[i]; return !l.flooded && !l.down.length && !l.up.length; }
  score(): number { return this.vaults.reduce((a, v) => a + (v.length ? v[v.length - 1].rank : 0), 0) + (BREACH_MAX - this.breach); }
  saved(): number { return this.vaults.reduce((a, v) => a + v.length, 0); }
  /** The server the next breach step floods. */
  nextFlood(): number { return this.lines.findIndex((l) => !l.flooded); }

  /** Can a series topped by this card go onto that line? */
  fitsLine(top: Card, i: number): boolean {
    const l = this.lines[i];
    if (!l || l.flooded) return false;
    if (this.isEmpty(i)) return top.rank === 13;
    const f = this.front(i);
    return !!f && isRed(f.suit) === isRed(top.suit) && f.rank === top.rank + 1;
  }
  fitsVault(c: Card, v: number): boolean {
    const vault = this.vaults[v];
    if (!vault) return false;
    if (!vault.length) return c.rank === 1;
    const t = vault[vault.length - 1];
    return isRed(t.suit) === isRed(c.suit) && c.rank === t.rank + 1;
  }
  canGoAnywhere(c: Card): boolean {
    return this.lines.some((_, i) => this.fitsLine(c, i)) || this.vaults.some((_, v) => this.fitsVault(c, v));
  }
  /** A line's face-up cards from index k on, if they form a series (exact descending order, one colour). */
  series(i: number, k: number): Card[] | null {
    const s = this.lines[i]?.up.slice(k);
    if (!s || !s.length) return null;
    for (let j = 1; j < s.length; j++) if (s[j].rank !== s[j - 1].rank - 1 || isRed(s[j].suit) !== isRed(s[0].suit)) return null;
    return s;
  }

  // ---- moving (free) ----

  /** Move the series starting at face-up index k of line `from` onto a line, or its single front card into a vault. */
  move(from: number, k: number, to: To): Result {
    if (this.phase !== 'turn' && this.phase !== 'place') return 'NOT NOW';
    const l = this.lines[from];
    if (!l || l.flooded) return 'NO SUCH LINE';
    const s = this.series(from, k);
    if (!s) return 'ONLY A SERIES IN EXACT ORDER CAN MOVE';
    if ('vault' in to) {
      if (s.length !== 1) return 'INTO A VAULT ONE CARD AT A TIME: MOVE THE FRONT CARD';
      if (!this.fitsVault(s[0], to.vault)) return this.vaultWhy(s[0], to.vault);
      this.vaults[to.vault].push(l.up.pop()!);
    } else {
      if (to.line === from) return 'SAME LINE';
      if (!this.fitsLine(s[0], to.line)) return this.lineWhy(s[0], to.line);
      l.up.splice(k);
      this.lines[to.line].up.push(...s);
    }
    this.flip(from);
    this.checkEnd();
    return null;
  }

  private flip(i: number): void {
    const l = this.lines[i];
    if (!l.up.length && l.down.length) l.up.push(l.down.pop()!);
  }
  private lineWhy(c: Card, i: number): string {
    if (this.lines[i].flooded) return 'THAT SERVER HAS FLOODED';
    if (this.isEmpty(i)) return 'AN EMPTY LINE TAKES ONLY A KING';
    const f = this.front(i)!;
    if (isRed(f.suit) !== isRed(c.suit)) return 'CLASSES NEVER MIX: SAME COLOUR ONLY';
    return `NEEDS A ${rankName(f.rank - 1)} THERE`;
  }
  private vaultWhy(c: Card, v: number): string {
    const vault = this.vaults[v];
    if (!vault.length) return 'AN EMPTY VAULT OPENS WITH AN ACE';
    const t = vault[vault.length - 1];
    if (isRed(t.suit) !== isRed(c.suit)) return 'THAT VAULT IS THE OTHER COLOUR';
    return `THAT VAULT NEEDS A ${rankName(t.rank + 1)}`;
  }

  // ---- RECOVER ----

  recover(n: number): Result {
    if (this.phase !== 'turn') return 'NOT NOW';
    if (n < 1 || n > MAX_DRAW) return `DRAW 1 TO ${MAX_DRAW}`;
    const drawn: Card[] = [];
    while (drawn.length < n) {
      if (!this.deck.length) {
        if (!this.discards.length) break;
        this.deck = this.rng.shuffle(this.discards);
        this.discards = [];
        this.say('THE DECK RUNS OUT: THE DISCARDS ARE SHUFFLED IN.');
        if (this.step(false)) return null;
      }
      drawn.push(this.deck.shift()!);
    }
    if (!drawn.some((c) => this.canGoAnywhere(c))) {
      this.discards.push(...drawn);
      this.say(`RECOVERED ${drawn.length}: NOTHING FITS.`);
      this.step(true);
      this.endAction();
      return null;
    }
    this.pending = drawn;
    this.pendingFrom = 'draw';
    this.phase = 'place';
    return null;
  }

  /** Place phase: put pending card `i` on a line or into a vault. */
  place(i: number, to: To): Result {
    if (this.phase !== 'place') return 'NOTHING TO PLACE';
    const c = this.pending[i];
    if (!c) return 'NO SUCH CARD';
    if ('vault' in to) { if (!this.fitsVault(c, to.vault)) return this.vaultWhy(c, to.vault); this.vaults[to.vault].push(c); }
    else { if (!this.fitsLine(c, to.line)) return this.lineWhy(c, to.line); this.lines[to.line].up.push(c); }
    const rest = this.pending.filter((x) => x !== c);
    if (this.pendingFrom === 'draw') this.discards.push(...rest);
    else if (this.pendingFrom === 'deck') { this.deck = this.deck.filter((x) => x !== c); this.rng.shuffle(this.deck); }
    else if (this.pendingFrom === 'discards') this.discards = this.discards.filter((x) => x !== c);
    this.pending = []; this.pendingFrom = null;
    this.checkEnd();
    this.endAction();
    return null;
  }

  // ---- the breach ----

  /** Flood one compartment. Returns true if the round ended. */
  private step(compensate: boolean): boolean {
    if (this.phase === 'over') return true;
    this.breach++;
    const i = this.nextFlood();
    const l = this.lines[i];
    l.floodedComps++;
    this.say(`THE BREACH ADVANCES TO ${this.breach} OF ${BREACH_MAX}: S${i + 1} TAKES WATER.`);
    if (l.floodedComps >= COMPARTMENTS[i]) {
      l.flooded = true;
      const next = this.lines.findIndex((x, j) => j > i && !x.flooded);
      const cards = [...l.down, ...l.up];
      l.down = []; l.up = [];
      if (next >= 0 && cards.length) {
        const n = this.lines[next];
        const all = this.rng.shuffle([...cards, ...n.down, ...n.up]);
        n.up = [all.pop()!]; n.down = all;
        this.say(`S${i + 1} FLOODS. ITS ${cards.length} CARD${cards.length === 1 ? '' : 'S'} SCRAMBLE INTO S${next + 1}.`);
      } else this.say(`S${i + 1} FLOODS.`);
    }
    if (compensate && this.opPile.length) { const op = this.opPile.shift()!; this.hand.push(op); this.say(`COMPENSATION: ${OPS[op].name}.`); }
    if (this.breach >= BREACH_MAX) { this.over('THE LAST SERVER FLOODS.'); return true; }
    return false;
  }

  private checkEnd(): void {
    if (this.saved() === 52) this.over('EVERY CARD IS SAFE.');
  }
  private over(why: string): void { this.phase = 'over'; this.say(`${why} SCORE ${this.score()}.`); }
  private endAction(): void {
    if (this.phase === 'over') return;
    this.phase = 'turn';
    this.asking = null; this.picked = [];
    this.turn++;
  }

  // ---- operations ----

  playOp(op: string): Result {
    if (this.phase !== 'turn') return 'NOT NOW';
    const i = this.hand.indexOf(op);
    if (i < 0) return 'NOT IN HAND';
    this.hand.splice(i, 1);
    this.opUsed.push(op);
    this.say(`${OPS[op].name}.`);
    switch (op) {
      case 'defrag':
        this.deck = this.rng.shuffle([...this.deck, ...this.discards]); this.discards = [];
        this.endAction(); return null;
      case 'lookahead':
        if (!this.deck.length) { this.endAction(); return null; }
        this.asking = op; this.phase = 'look'; return null;
      case 'plana': case 'planb':
        if (!(op === 'plana' ? this.opPile : this.opUsed.filter((x, j) => j !== this.opUsed.length - 1)).length) { this.endAction(); return null; }
        this.asking = op; this.phase = 'pickop'; return null;
      case 'pull': case 'restore': {
        const src = op === 'pull' ? this.deck : this.discards;
        const fits = src.filter((c) => this.canGoAnywhere(c));
        if (!fits.length) { this.say('NOTHING THERE FITS.'); this.step(false); this.endAction(); return null; }
        this.pending = fits; this.pendingFrom = op === 'pull' ? 'deck' : 'discards'; this.phase = 'place';
        return null;
      }
      case 'reindex': case 'rebalance': case 'purge':
        this.asking = op; this.picked = []; this.phase = 'pickline'; return null;
    }
    return null;
  }

  /** LOOKAHEAD: send these of the top 5 to the bottom. */
  lookDone(toBottom: number[]): Result {
    if (this.phase !== 'look') return 'NOT NOW';
    const top = this.deck.slice(0, 5);
    const down = top.filter((c) => toBottom.includes(c.id));
    this.deck = [...top.filter((c) => !toBottom.includes(c.id)), ...this.deck.slice(5), ...down];
    this.endAction();
    return null;
  }

  /** PLAN A / PLAN B: take this operation. */
  pickOp(op: string): Result {
    if (this.phase !== 'pickop') return 'NOT NOW';
    const src = this.asking === 'plana' ? this.opPile : this.opUsed;
    const j = this.asking === 'planb' ? src.slice(0, -1).lastIndexOf(op) : src.indexOf(op);
    if (j < 0) return 'NOT THERE';
    src.splice(j, 1);
    this.hand.push(op);
    if (this.asking === 'plana') this.rng.shuffle(this.opPile);
    this.endAction();
    return null;
  }

  pickLine(i: number): Result {
    if (this.phase !== 'pickline') return 'NOT NOW';
    const l = this.lines[i];
    if (!l || l.flooded) return 'PICK A SERVER THAT HAS NOT FLOODED';
    if (this.asking === 'purge') {
      if (!l.up.length) return 'THAT LINE HAS NO FACE-UP CARDS';
      this.discards.push(...l.up.splice(0));
      this.flip(i);
      this.endAction();
      return null;
    }
    if (this.asking === 'reindex') {
      if (!l.up.length && !l.down.length) return 'THAT LINE IS EMPTY';
      this.picked = [i]; this.phase = 'pickcard';
      return null;
    }
    // rebalance: two lines
    if (this.picked.includes(i)) return 'PICK A DIFFERENT LINE';
    this.picked.push(i);
    if (this.picked.length < 2) return null;
    const [a, b] = this.picked.map((x) => this.lines[x]);
    const all = this.rng.shuffle([...a.down, ...a.up, ...b.down, ...b.up]);
    const half = Math.floor(all.length / 2);
    // any odd card goes to the line nearer the stern (the higher index)
    const [lo, hi] = this.picked[0] < this.picked[1] ? [a, b] : [b, a];
    const forLo = all.slice(0, half), forHi = all.slice(half);
    for (const [line, cards] of [[lo, forLo], [hi, forHi]] as [Line, Card[]][]) { line.up = cards.length ? [cards.pop()!] : []; line.down = cards; }
    this.endAction();
    return null;
  }

  /** REINDEX: this card becomes the line's face-up front; the rest go face down, shuffled. */
  pickCard(cardId: number): Result {
    if (this.phase !== 'pickcard') return 'NOT NOW';
    const l = this.lines[this.picked[0]];
    const all = [...l.down, ...l.up];
    const c = all.find((x) => x.id === cardId);
    if (!c) return 'NOT IN THAT LINE';
    l.down = this.rng.shuffle(all.filter((x) => x !== c));
    l.up = [c];
    this.endAction();
    return null;
  }
}

export interface SolView {
  seed: number; phase: Phase; turn: number; breach: number; breachMax: number; compartments: number[];
  nextFlood: number; score: number; saved: number;
  lines: { down: number; up: Card[]; flooded: boolean; floodedComps: number; compartments: number; empty: boolean }[];
  vaults: Card[][]; deckCount: number; discardCount: number; hand: string[];
  pending: Card[]; pendingFrom: string | null; asking: string | null; picked: number[];
  look: Card[]; pickOps: string[]; pickCards: Card[]; log: string[];
}

export function solView(g: Solitaire): SolView {
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  return {
    seed: g.seed, phase: g.phase, turn: g.turn, breach: g.breach, breachMax: BREACH_MAX, compartments: COMPARTMENTS,
    nextFlood: g.nextFlood(), score: g.score(), saved: g.saved(),
    lines: g.lines.map((l, i) => ({ down: l.down.length, up: clone(l.up), flooded: l.flooded, floodedComps: l.floodedComps, compartments: COMPARTMENTS[i], empty: g.isEmpty(i) })),
    vaults: clone(g.vaults), deckCount: g.deck.length, discardCount: g.discards.length, hand: [...g.hand],
    pending: clone(g.pending), pendingFrom: g.pendingFrom, asking: g.asking, picked: [...g.picked],
    look: g.phase === 'look' ? clone(g.deck.slice(0, 5)) : [],
    pickOps: g.phase === 'pickop' ? (g.asking === 'plana' ? [...new Set(g.opPile)] : [...new Set(g.opUsed.slice(0, -1))]) : [],
    pickCards: g.phase === 'pickcard' ? clone([...g.lines[g.picked[0]].down, ...g.lines[g.picked[0]].up].sort((a, b) => a.rank - b.rank)) : [],
    log: [...g.log],
  };
}
