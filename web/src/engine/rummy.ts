// The RUMMY slice (design §2): melds on the table are servers; a Runner raids the most valuable one on a clock.
import type { Card, OpCard } from './cards';
import { cardPoints, rankName, standardDeck } from './cards';
import { Rng } from './rng';

export type Result = string | null;
export type HandItem = Card | OpCard;
export const isOp = (x: HandItem): x is OpCard => 'op' in x;

export const R_OPS: Record<string, { name: string; text: string }> = {
  fasttrack: { name: 'FAST TRACK', text: 'Draw 2.' },
  takeover: { name: 'HOSTILE TAKEOVER', text: 'Take the top 3 cards of Archives.' },
  shortmeld: { name: 'SHORT MELD', text: 'The next meld you lay may be 2 cards.' },
  overtime: { name: 'OVERTIME', text: '+2 turns this round.' },
};
export interface ROffer { id: string; name: string; text: string; cost: number; kind: 'asset' | 'upgrade' | 'op' }
export const R_SHOP: ROffer[] = [
  { id: 'foundry', name: 'SPADE FOUNDRY', text: 'Spade runs score x2.', cost: 6, kind: 'asset' },
  { id: 'quorum', name: 'QUORUM', text: 'Sets of 4 score x2.', cost: 6, kind: 'asset' },
  { id: 'archivist', name: 'ARCHIVIST', text: 'Taking from Archives also draws 1 from R&D.', cost: 5, kind: 'asset' },
  { id: 'diamonddesk', name: 'DIAMOND DESK', text: 'Cashing pays +2 more per diamond.', cost: 5, kind: 'asset' },
  { id: 'longgame', name: 'LONG GAME', text: 'Melds of 6+ cards score x3.', cost: 7, kind: 'asset' },
  { id: 'runproto', name: 'RUN PROTOCOL', text: 'Runs +1 mult.', cost: 4, kind: 'upgrade' },
  { id: 'setproto', name: 'SET PROTOCOL', text: 'Sets +1 mult.', cost: 4, kind: 'upgrade' },
  { id: 'icegrade', name: 'ICE GRADE', text: 'All ICE +1 STR.', cost: 4, kind: 'upgrade' },
  { id: 'overtime', name: 'OVERTIME', text: 'A second OVERTIME in R&D.', cost: 3, kind: 'op' },
];
export const R_ROUNDS = [
  { agenda: 'PROJECT ATLAS', target: 100, turns: 10, runner: 'NOMAD', str: 2 },
  { agenda: 'ORBITAL DENIAL', target: 200, turns: 10, runner: 'SPARK', str: 3 },
];
export const RUN_AFTER = [2, 4, 6, 8, 10, 12];
/** Tunables (design §2). */
export const R_RULES = { startHand: 10, draw: 2 };
const MAX_SERVERS = 4;
const ICE_COST = 2;

export interface Server { id: number; cards: Card[]; kind: 'set' | 'run'; ice: boolean }
export type RPhase = 'draw' | 'main' | 'shop' | 'over';

/** A meld's kind if these cards form one (min cards 3, or 2 with SHORT MELD). Runs return their cards in rank order. */
export function meldOf(cards: Card[], min = 3): { kind: 'set' | 'run'; cards: Card[] } | null {
  if (cards.length < min) return null;
  if (cards.every((c) => c.rank === cards[0].rank)) return { kind: 'set', cards: [...cards] };
  if (!cards.every((c) => c.suit === cards[0].suit)) return null;
  const tryRun = (high: boolean) => {
    const v = (c: Card) => (high && c.rank === 1 ? 14 : c.rank);
    const sorted = [...cards].sort((a, b) => v(a) - v(b));
    for (let i = 1; i < sorted.length; i++) if (v(sorted[i]) !== v(sorted[i - 1]) + 1) return null;
    return sorted;
  };
  const run = tryRun(false) ?? tryRun(true);
  return run ? { kind: 'run', cards: run } : null;
}

/** Why these cards are not a meld, in words a player can act on. */
export function meldError(cards: Card[], min = 3): string {
  if (cards.length < min) return `A MELD NEEDS ${min} OR MORE CARDS`;
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b);
  const sequence = ranks.every((r, i) => i === 0 || r === ranks[i - 1] + 1);
  if (sequence && !cards.every((c) => c.suit === cards[0].suit)) return 'A RUN MUST BE ALL ONE SUIT';
  if (cards.every((c) => c.suit === cards[0].suit)) return 'A RUN MUST BE IN SEQUENCE WITH NO GAPS';
  return 'A SET IS ONE RANK; A RUN IS ONE SUIT IN SEQUENCE';
}

export class Rummy {
  readonly seed: number;
  private rng: Rng;
  private nextId = 1000;
  phase: RPhase = 'draw';
  roundIdx = 0;
  won: boolean | null = null;
  credits = 4;
  owned = new Set<string>();
  runLevel = 0;
  setLevel = 0;
  iceStr = 2;
  extraOps: string[] = [];
  // ---- the round ----
  rd: HandItem[] = [];
  hq: HandItem[] = [];
  archives: Card[] = [];
  servers: Server[] = [];
  turn = 1;
  turns = 8;
  score = 0;
  shortMeld = false;
  log: string[] = [];
  offers: ROffer[] = [];

  constructor(seed: number) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.startRound();
  }

  get round() { return R_ROUNDS[this.roundIdx]; }
  private say(s: string) { this.log.push(s); }
  nextRunTurn(): number | null { return RUN_AFTER.find((t) => t >= this.turn && t <= this.turns) ?? null; }

  /** Card points x mult for a server, with levels and Assets. */
  value(s: Server): { points: number; mult: number; total: number; notes: string[] } {
    const points = s.cards.reduce((a, c) => a + cardPoints(c), 0);
    let mult = Math.max(1, s.cards.length - 2) + (s.kind === 'run' ? this.runLevel : this.setLevel);
    const notes: string[] = [];
    let x = 1;
    if (this.owned.has('foundry') && s.kind === 'run' && s.cards[0].suit === 's') { x *= 2; notes.push('FOUNDRY x2'); }
    if (this.owned.has('quorum') && s.kind === 'set' && s.cards.length >= 4) { x *= 2; notes.push('QUORUM x2'); }
    if (this.owned.has('longgame') && s.cards.length >= 6) { x *= 3; notes.push('LONG GAME x3'); }
    mult *= x;
    return { points, mult, total: points * mult, notes };
  }

  /** Which server is the Runner going for: the highest value. */
  runnerTarget(): Server | null {
    return [...this.servers].sort((a, b) => this.value(b).total - this.value(a).total)[0] ?? null;
  }

  // ---- commands ----

  drawRD(): Result {
    if (this.phase !== 'draw') return 'ALREADY DREW';
    if (!this.rd.length) return 'R&D IS EMPTY';
    for (let i = 0; i < R_RULES.draw && this.rd.length; i++) this.hq.push(this.rd.shift()!);
    this.phase = 'main';
    return null;
  }

  takeArchives(): Result {
    if (this.phase !== 'draw') return 'ALREADY DREW';
    if (!this.archives.length) return 'ARCHIVES IS EMPTY';
    this.hq.push(this.archives.pop()!);
    if (this.owned.has('archivist') && this.rd.length) this.hq.push(this.rd.shift()!);
    this.phase = 'main';
    return null;
  }

  lay(ids: number[]): Result {
    if (this.phase !== 'main') return this.phase === 'draw' ? 'DRAW FIRST' : 'NOT NOW';
    if (this.servers.length >= MAX_SERVERS) return 'ALL 4 SERVERS IN USE: CASH ONE';
    const cards = ids.map((id) => this.hq.find((c) => c.id === id)).filter((c): c is Card => !!c && !isOp(c));
    if (cards.length !== ids.length) return 'PICK CARDS FROM HQ';
    const m = meldOf(cards, this.shortMeld ? 2 : 3);
    if (!m) return meldError(cards, this.shortMeld ? 2 : 3);
    this.shortMeld = false;
    this.hq = this.hq.filter((c) => !ids.includes(c.id));
    this.servers.push({ id: this.nextId++, cards: m.cards, kind: m.kind, ice: false });
    return null;
  }

  /** Add one card from HQ to a server, if it still makes the same kind of meld. */
  extend(serverId: number, cardId: number): Result {
    if (this.phase !== 'main') return this.phase === 'draw' ? 'DRAW FIRST' : 'NOT NOW';
    const s = this.servers.find((x) => x.id === serverId);
    const c = this.hq.find((x) => x.id === cardId);
    if (!s || !c || isOp(c)) return 'PICK A CARD AND A SERVER';
    const m = meldOf([...s.cards, c], 2);
    if (!m || m.kind !== s.kind) return `${rankName(c.rank)} DOES NOT FIT`;
    s.cards = m.cards;
    this.hq = this.hq.filter((x) => x !== c);
    return null;
  }

  cash(serverId: number): Result {
    if (this.phase !== 'main') return this.phase === 'draw' ? 'DRAW FIRST' : 'NOT NOW';
    const s = this.servers.find((x) => x.id === serverId);
    if (!s) return 'NO SUCH SERVER';
    if (s.cards.length < 3) return 'A MELD NEEDS 3 CARDS TO CASH';
    const v = this.value(s);
    this.score += v.total;
    const diamonds = s.cards.filter((c) => c.suit === 'd').length;
    this.credits += diamonds * (this.owned.has('diamonddesk') ? 3 : 1);
    this.say(`CASHED ${s.kind === 'run' ? 'A RUN' : 'A SET'} OF ${s.cards.length}: ${v.points} x ${v.mult} = ${v.total}`);
    this.servers = this.servers.filter((x) => x !== s);
    return null;
  }

  installIce(serverId: number): Result {
    if (this.phase !== 'main') return this.phase === 'draw' ? 'DRAW FIRST' : 'NOT NOW';
    const s = this.servers.find((x) => x.id === serverId);
    if (!s) return 'NO SUCH SERVER';
    if (s.ice) return 'ALREADY ICED';
    if (this.credits < ICE_COST) return `ICE COSTS ${ICE_COST}`;
    this.credits -= ICE_COST;
    s.ice = true;
    return null;
  }

  playOp(id: number): Result {
    if (this.phase !== 'main') return this.phase === 'draw' ? 'DRAW FIRST' : 'NOT NOW';
    const o = this.hq.find((x) => x.id === id);
    if (!o || !isOp(o)) return 'NOT AN OPERATION';
    this.hq = this.hq.filter((x) => x !== o);
    switch (o.op) {
      case 'fasttrack': for (let i = 0; i < 2 && this.rd.length; i++) this.hq.push(this.rd.shift()!); break;
      case 'takeover': for (let i = 0; i < 3 && this.archives.length; i++) this.hq.push(this.archives.pop()!); break;
      case 'shortmeld': this.shortMeld = true; break;
      case 'overtime': this.turns += 2; break;
    }
    this.say(`${R_OPS[o.op].name}: ${R_OPS[o.op].text}`);
    return null;
  }

  /** Discard a card to Archives: the turn ends, the Runner may run, the round may end. */
  discard(id: number): Result {
    if (this.phase !== 'main') return this.phase === 'draw' ? 'DRAW FIRST' : 'NOT NOW';
    const c = this.hq.find((x) => x.id === id);
    if (!c || isOp(c)) return 'DISCARD A PLAYING CARD';
    this.hq = this.hq.filter((x) => x !== c);
    this.archives.push(c);
    this.endTurn();
    return null;
  }

  private endTurn(): void {
    if (RUN_AFTER.includes(this.turn)) this.run();
    if (this.score >= this.round.target) return this.endRound(true);
    if (this.turn >= this.turns) return this.endRound(false);
    this.turn++;
    this.credits++;
    this.phase = 'draw';
  }

  private run(): void {
    const s = this.runnerTarget();
    const r = this.round;
    if (!s) { this.say(`${r.runner} RUNS: NOTHING ON THE TABLE.`); return; }
    if (s.ice && this.iceStr >= r.str) { this.say(`${r.runner} RUNS AT A ${s.kind.toUpperCase()}: ICE STR ${this.iceStr} HOLDS.`); return; }
    const top = [...s.cards].sort((a, b) => cardPoints(b) - cardPoints(a))[0];
    s.cards = s.cards.filter((c) => c !== top);
    let msg = `${r.runner} RUNS AT A ${s.kind.toUpperCase()}${s.ice ? ` (ICE STR ${this.iceStr} TOO WEAK)` : ''}: STEALS THE ${rankName(top.rank)}.`;
    if (s.cards.length < 3 || !meldOf(s.cards, 2)) {
      this.archives.push(...s.cards);
      this.servers = this.servers.filter((x) => x !== s);
      msg += ' THE MELD BREAKS.';
    }
    this.say(msg);
  }

  private endRound(won: boolean): void {
    if (!won) { this.phase = 'over'; this.won = false; this.say(`${this.round.agenda} FAILS: ${this.score} OF ${this.round.target}.`); return; }
    this.say(`${this.round.agenda} SCORED: ${this.score} OF ${this.round.target}.`);
    if (this.roundIdx === R_ROUNDS.length - 1) { this.phase = 'over'; this.won = true; return; }
    this.credits += 4 + Math.floor((this.score - this.round.target) / 20);
    this.offers = this.rng.pick(R_SHOP.filter((o) => o.kind !== 'asset' || !this.owned.has(o.id)), 3);
    this.phase = 'shop';
  }

  buy(id: string): Result {
    if (this.phase !== 'shop') return 'ONLY IN THE SHOP';
    const o = this.offers.find((x) => x.id === id);
    if (!o) return 'NOT ON OFFER';
    if (this.credits < o.cost) return `NEEDS ${o.cost}`;
    this.credits -= o.cost;
    if (o.kind === 'asset') this.owned.add(o.id);
    if (o.id === 'runproto') this.runLevel++;
    if (o.id === 'setproto') this.setLevel++;
    if (o.id === 'icegrade') this.iceStr++;
    if (o.id === 'overtime') this.extraOps.push('overtime');
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
    const ops: OpCard[] = ['fasttrack', 'takeover', 'shortmeld', 'overtime', ...this.extraOps].map((op) => ({ id: this.nextId++, op }));
    this.rd = this.rng.shuffle([...standardDeck(this.rng), ...ops] as HandItem[]);
    this.hq = this.rd.splice(0, R_RULES.startHand);
    this.archives = [];
    this.servers = [];
    this.turn = 1;
    this.turns = this.round.turns;
    this.score = 0;
    this.shortMeld = false;
    this.log = [`${this.round.agenda}: SCORE ${this.round.target} IN ${this.turns} TURNS. ${this.round.runner} (STR ${this.round.str}) RUNS AFTER TURNS ${RUN_AFTER.filter((t) => t <= this.turns).join(', ')}.`];
    this.phase = 'draw';
  }
}

export interface RummyView {
  seed: number; phase: RPhase; won: boolean | null; round: number; rounds: number;
  agenda: string; target: number; score: number; turn: number; turns: number; credits: number;
  runner: string; runnerStr: number; nextRun: number | null; targetServer: number | null; iceStr: number;
  hq: HandItem[]; rdCount: number; archivesTop: Card | null; archivesCount: number;
  servers: (Server & { value: { points: number; mult: number; total: number; notes: string[] } })[];
  shortMeld: boolean; owned: { id: string; name: string; text: string }[]; runLevel: number; setLevel: number;
  offers: ROffer[]; log: string[];
}

export function rummyView(g: Rummy): RummyView {
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  return {
    seed: g.seed, phase: g.phase, won: g.won, round: g.roundIdx + 1, rounds: R_ROUNDS.length,
    agenda: g.round.agenda, target: g.round.target, score: g.score, turn: g.turn, turns: g.turns, credits: g.credits,
    runner: g.round.runner, runnerStr: g.round.str, nextRun: g.nextRunTurn(), targetServer: g.runnerTarget()?.id ?? null, iceStr: g.iceStr,
    hq: clone(g.hq), rdCount: g.rd.length, archivesTop: g.archives.length ? clone(g.archives[g.archives.length - 1]) : null, archivesCount: g.archives.length,
    servers: g.servers.map((s) => ({ ...clone(s), value: g.value(s) })),
    shortMeld: g.shortMeld, owned: R_SHOP.filter((o) => g.owned.has(o.id)).map((o) => ({ id: o.id, name: o.name, text: o.text })),
    runLevel: g.runLevel, setLevel: g.setLevel, offers: clone(g.offers), log: [...g.log],
  };
}
