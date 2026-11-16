// The SOLITAIRE slice (design §3): save data into vaults while the breach spreads and servers go dark (after SOS Titanic).
import type { Card, Suit } from './cards';
import { SUITS, isRed, rankName, standardDeck } from './cards';
import { Rng } from './rng';

export type Result = string | null;
export type IceKind = 'barrier' | 'codegate' | 'sentry';
export const ICE_INFO: Record<IceKind, { name: string; text: string }> = {
  barrier: { name: 'BARRIER', text: 'When its server would go dark, the ICE breaks and the server survives.' },
  codegate: { name: 'CODE GATE', text: 'When its server would go dark, the breach skips to the next server.' },
  sentry: { name: 'SENTRY', text: 'When its server goes dark, the breach falls back 1.' },
};
export const S_OPS: Record<string, { name: string; text: string }> = {
  trace: { name: 'TRACE', text: 'The breach falls back 1.' },
  deepsearch: { name: 'DEEP SEARCH', text: 'Take any card from the deck into the recovery row and place it.' },
  fasttrack: { name: 'FAST TRACK', text: 'RECOVER reveals 7 this turn.' },
};
export interface SOffer { id: string; name: string; text: string; cost: number; kind: 'exec' | 'ice' | 'op' }
export const S_SHOP: SOffer[] = [
  { id: 'coldstorage', name: 'COLD STORAGE', text: 'A vault takes the next rank in any suit.', cost: 8, kind: 'exec' },
  { id: 'widenet', name: 'WIDE NET', text: 'RECOVER reveals 5.', cost: 5, kind: 'exec' },
  { id: 'redundancy', name: 'REDUNDANCY', text: 'The first server to go dark each round survives.', cost: 5, kind: 'exec' },
  { id: 'slowburn', name: 'SLOW BURN', text: 'The breach spreads on its own every 6th turn.', cost: 5, kind: 'exec' },
  { id: 'barrier', name: 'BARRIER', text: ICE_INFO.barrier.text, cost: 3, kind: 'ice' },
  { id: 'codegate', name: 'CODE GATE', text: ICE_INFO.codegate.text, cost: 4, kind: 'ice' },
  { id: 'sentry', name: 'SENTRY', text: ICE_INFO.sentry.text, cost: 4, kind: 'ice' },
  { id: 'trace', name: 'TRACE', text: 'A second TRACE.', cost: 4, kind: 'op' },
];
export const S_TARGETS = [8, 14];
export const BREACH_MAX = 8;
export const DARK_AT = [2, 4, 6, 8];
const SERVERS = 4;

export interface SServer { cards: Card[]; dark: boolean; ice: IceKind | null }
/** setup: place ICE · turn: free moves, then an action · place: a recovered card must be placed · shop · over. */
export type SPhase = 'setup' | 'turn' | 'place' | 'shop' | 'over';
/** Where a selected card is: the recovery row, or the top of a server. */
export type From = { row: number } | { server: number };
export type To = { vault: Suit } | { server: number };

export class Solitaire {
  readonly seed: number;
  private rng: Rng;
  phase: SPhase = 'setup';
  roundIdx = 0;
  won: boolean | null = null;
  credits = 0;
  execs = new Set<string>();
  iceOwned: IceKind[] = ['barrier'];
  opsOwned: string[] = ['trace', 'deepsearch', 'fasttrack'];
  // ---- the round ----
  deck: Card[] = [];
  servers: SServer[] = [];
  vaults: Record<Suit, Card[]> = { s: [], h: [], d: [], c: [] };
  row: Card[] = [];
  breach = 0;
  turn = 1;
  opsLeft: string[] = [];
  fastNext = false;
  redundancyUsed = false;
  /** ICE not yet placed this round (setup). */
  unplaced: IceKind[] = [];
  log: string[] = [];
  offers: SOffer[] = [];

  constructor(seed: number) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.startRound();
  }

  get target() { return S_TARGETS[this.roundIdx]; }
  score(): number { return SUITS.reduce((a, s) => a + this.vaults[s].length, 0); }
  private say(s: string) { this.log.push(s); }
  creepEvery(): number { return this.execs.has('slowburn') ? 6 : 4; }
  revealCount(): number { return this.fastNext ? 7 : this.execs.has('widenet') ? 5 : 4; }
  /** The next server to go dark (left to right), ignoring CODE GATE skips. */
  nextToFall(): number { return this.servers.findIndex((s) => !s.dark); }

  // ---- placement rules ----

  fitsServer(c: Card, i: number): boolean {
    const s = this.servers[i];
    if (!s || s.dark) return false;
    const top = s.cards[s.cards.length - 1];
    if (!top) return true;
    if (c.rank !== top.rank - 1) return false;
    return isRed(c.suit) !== isRed(top.suit);
  }
  /** Which vault a card can go to, if any. */
  fitsVault(c: Card, suit: Suit): boolean {
    const v = this.vaults[suit];
    const next = v.length + 1;
    if (c.rank !== next) return false;
    return this.execs.has('coldstorage') ? true : c.suit === suit;
  }
  private fits(c: Card, to: To): boolean { return 'vault' in to ? this.fitsVault(c, to.vault) : this.fitsServer(c, to.server); }
  canPlaceAny(c: Card): boolean { return SUITS.some((s) => this.fitsVault(c, s)) || this.servers.some((_, i) => this.fitsServer(c, i)); }

  private cardAt(from: From): Card | undefined {
    if ('row' in from) return this.row[from.row];
    const s = this.servers[from.server];
    return s && !s.dark ? s.cards[s.cards.length - 1] : undefined;
  }

  // ---- setup ----

  placeIce(server: number): Result {
    if (this.phase !== 'setup') return 'ONLY BEFORE THE ROUND';
    const k = this.unplaced[0];
    if (!k) return 'NO ICE LEFT TO PLACE';
    if (!this.servers[server]) return 'NO SUCH SERVER';
    if (this.servers[server].ice) return 'ONE ICE PER SERVER';
    this.servers[server].ice = k;
    this.unplaced.shift();
    return null;
  }
  begin(): Result {
    if (this.phase !== 'setup') return 'NOT NOW';
    this.unplaced = [];
    this.phase = 'turn';
    return null;
  }

  // ---- the turn ----

  /** Free move (turn phase): a server's top card to a vault or server. In the place phase: a recovered card to its spot. */
  move(from: From, to: To): Result {
    if (this.phase !== 'turn' && this.phase !== 'place') return 'NOT NOW';
    if (this.phase === 'turn' && 'row' in from) return 'RECOVER FIRST';
    const c = this.cardAt(from);
    if (!c) return 'NOTHING THERE';
    if ('server' in to && 'server' in from && to.server === from.server) return 'SAME SERVER';
    if (!this.fits(c, to)) return `THE ${rankName(c.rank)} DOES NOT FIT THERE`;
    if ('row' in from) this.row.splice(from.row, 1); else this.servers[from.server].cards.pop();
    if ('vault' in to) this.vaults[to.vault].push(c); else this.servers[to.server].cards.push(c);
    if ('row' in from) this.finishPlacing();
    return null;
  }

  recover(): Result {
    if (this.phase !== 'turn') return 'NOT NOW';
    const n = this.revealCount();
    this.fastNext = false;
    this.row = this.deck.splice(0, n);
    if (!this.row.length) { this.endRound(); return null; }
    this.phase = 'place';
    return null;
  }

  /** Place phase: nothing fits; the breach spreads. */
  noneFits(): Result {
    if (this.phase !== 'place') return 'NOT NOW';
    if (this.searching) return 'PICK A CARD FROM THE DECK';
    if (this.row.some((c) => this.canPlaceAny(c))) return 'ONE OF THEM FITS';
    this.say('NOTHING FITS: THE BREACH SPREADS.');
    this.deck.push(...this.row);
    this.row = [];
    this.spread(1);
    this.endTurn();
    return null;
  }

  private finishPlacing(): void {
    this.deck.push(...this.row);
    this.row = [];
    this.endTurn();
  }

  playOp(op: string): Result {
    if (this.phase !== 'turn') return 'NOT NOW';
    const i = this.opsLeft.indexOf(op);
    if (i < 0) return 'NOT IN HAND';
    this.opsLeft.splice(i, 1);
    this.say(`${S_OPS[op].name}: ${S_OPS[op].text}`);
    if (op === 'trace') { this.breach = Math.max(0, this.breach - 1); this.endTurn(); return null; }
    if (op === 'fasttrack') { this.fastNext = true; return this.recover(); }
    if (op === 'deepsearch') { this.phase = 'place'; this.row = []; this.searching = true; return null; }
    return null;
  }

  /** DEEP SEARCH: pull a chosen card from the deck into the recovery row. */
  searching = false;
  search(cardId: number): Result {
    if (!this.searching) return 'NOT SEARCHING';
    const i = this.deck.findIndex((c) => c.id === cardId);
    if (i < 0) return 'NOT IN THE DECK';
    this.row = this.deck.splice(i, 1);
    this.searching = false;
    return null;
  }

  lockDown(): Result {
    if (this.phase !== 'turn') return 'NOT NOW';
    this.say('LOCK DOWN.');
    this.endRound();
    return null;
  }

  private endTurn(): void {
    if (this.phase === 'over' || this.phase === 'shop') return;
    if (this.turn % this.creepEvery() === 0) { this.say('THE BREACH CREEPS.'); this.spread(1); }
    if (this.breach >= BREACH_MAX || this.servers.every((s) => s.dark)) return this.endRound();
    this.turn++;
    this.phase = 'turn';
  }

  /** The breach advances; at each DARK_AT level the next server falls (ICE may intervene). */
  private spread(n: number): void {
    for (let k = 0; k < n; k++) {
      this.breach++;
      if (DARK_AT.includes(this.breach)) this.fall();
    }
  }

  private fall(): void {
    let i = this.nextToFall();
    while (i >= 0 && i < this.servers.length) {
      const s = this.servers[i];
      if (s.ice === 'codegate') { s.ice = null; this.say(`CODE GATE ON SERVER ${i + 1}: THE BREACH SKIPS IT.`); i = this.servers.findIndex((x, j) => j > i && !x.dark); continue; }
      if (s.ice === 'barrier') { s.ice = null; this.say(`BARRIER ON SERVER ${i + 1} BREAKS. THE SERVER HOLDS.`); return; }
      if (this.execs.has('redundancy') && !this.redundancyUsed) { this.redundancyUsed = true; this.say(`REDUNDANCY: SERVER ${i + 1} HOLDS.`); return; }
      const lost = s.cards.length;
      s.dark = true; s.cards = [];
      this.say(`SERVER ${i + 1} GOES DARK. ${lost} CARD${lost === 1 ? '' : 'S'} LOST.`);
      if (s.ice === 'sentry') { s.ice = null; this.breach = Math.max(0, this.breach - 1); this.say('SENTRY TRACES: THE BREACH FALLS BACK 1.'); }
      return;
    }
  }

  private endRound(): void {
    const sc = this.score();
    const ok = sc >= this.target;
    this.say(`${ok ? 'SAVED' : 'LOST'}: ${sc} OF ${this.target} CARDS IN THE VAULTS.`);
    if (!ok || this.roundIdx === S_TARGETS.length - 1) { this.phase = 'over'; this.won = ok; return; }
    this.credits += 6 + (sc - this.target);
    this.offers = this.rng.pick(S_SHOP.filter((o) => o.kind !== 'exec' || !this.execs.has(o.id)), 3);
    this.phase = 'shop';
  }

  buy(id: string): Result {
    if (this.phase !== 'shop') return 'ONLY IN THE SHOP';
    const o = this.offers.find((x) => x.id === id);
    if (!o) return 'NOT ON OFFER';
    if (this.credits < o.cost) return `NEEDS ${o.cost}`;
    this.credits -= o.cost;
    if (o.kind === 'exec') this.execs.add(o.id);
    if (o.kind === 'ice') this.iceOwned.push(o.id as IceKind);
    if (o.kind === 'op') this.opsOwned.push(o.id);
    this.offers = this.offers.filter((x) => x !== o);
    return null;
  }

  nextRound(): Result {
    if (this.phase !== 'shop') return 'ONLY IN THE SHOP';
    this.roundIdx++;
    this.startRound();
    return null;
  }

  private startRound(): void {
    this.deck = standardDeck(this.rng);
    this.servers = Array.from({ length: SERVERS }, () => ({ cards: [], dark: false, ice: null }));
    this.vaults = { s: [], h: [], d: [], c: [] };
    this.row = [];
    this.breach = 0;
    this.turn = 1;
    this.opsLeft = [...this.opsOwned];
    this.fastNext = false;
    this.redundancyUsed = false;
    this.searching = false;
    this.unplaced = [...this.iceOwned];
    this.log = [`ROUND ${this.roundIdx + 1}: SAVE ${this.target} CARDS INTO THE VAULTS BEFORE THE BREACH TAKES EVERY SERVER.`];
    this.phase = 'setup';
  }
}

export interface SolView {
  seed: number; phase: SPhase; won: boolean | null; round: number; rounds: number; target: number; score: number;
  credits: number; breach: number; breachMax: number; darkAt: number[]; turn: number; creepEvery: number; nextCreep: number;
  nextToFall: number; servers: SServer[]; vaults: Record<Suit, Card[]>; row: Card[]; deckCount: number;
  searching: boolean; deck: Card[]; opsLeft: string[]; unplaced: IceKind[]; execs: { id: string; name: string; text: string }[];
  offers: SOffer[]; log: string[]; revealCount: number;
}

export function solView(g: Solitaire): SolView {
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  const every = g.creepEvery();
  return {
    seed: g.seed, phase: g.phase, won: g.won, round: g.roundIdx + 1, rounds: S_TARGETS.length, target: g.target, score: g.score(),
    credits: g.credits, breach: g.breach, breachMax: BREACH_MAX, darkAt: DARK_AT, turn: g.turn, creepEvery: every, nextCreep: Math.ceil(g.turn / every) * every,
    nextToFall: g.nextToFall(), servers: clone(g.servers), vaults: clone(g.vaults), row: clone(g.row), deckCount: g.deck.length,
    searching: g.searching, deck: g.searching ? clone([...g.deck].sort((a, b) => a.suit.localeCompare(b.suit) || a.rank - b.rank)) : [],
    opsLeft: [...g.opsLeft], unplaced: [...g.unplaced], execs: S_SHOP.filter((o) => g.execs.has(o.id)).map((o) => ({ id: o.id, name: o.name, text: o.text })),
    offers: clone(g.offers), log: [...g.log], revealCount: g.revealCount(),
  };
}
