// A run (design §2–§7): rounds of poker hands charging ICE, a breach each round, the Boardroom between. Pure, deterministic from the seed.
import type { BreachStep, Card, GameView, HandKind, IceView, Phase, Preview, Suit } from './api';
import { AGENDAS, ICE, ICE_BY_ID, RULES, RUNNERS, STARTING_ICE, roundSpec } from './content';
import type { RunnerDef } from './content';
import { HAND_BASE, HAND_NAME, cardValue, evaluate } from './poker';
import { Rng } from './rng';

/** Every command returns null on success or a short player-facing reason. */
export type Result = string | null;

export interface Owned { uid: number; id: string; level: number }

export class Game {
  readonly seed: number;
  private rng: Rng;
  private nextUid = 1;
  phase: Phase = 'round';
  round = 0;
  winner: 'corp' | 'runner' | null = null;
  corpPoints = 0;
  runnerPoints = 0;
  credits = 4;
  slots = RULES.startSlots;
  private slotBuys = 0;
  owned: Owned[] = [];
  /** Installed ICE uids, outermost first. */
  order: number[] = [];
  // ---- the round ----
  deck: Card[] = [];
  hand: Card[] = [];
  hands = 0;
  discards = 0;
  discardsUsed = 0;
  handsPlayed = 0;
  str = new Map<number, number>();
  agenda = { name: '', points: 0 };
  runner: RunnerDef = RUNNERS[0];
  breachBase = 0;
  breach: { steps: BreachStep[]; start: number; through: number; held: boolean } | null = null;
  // ---- the Boardroom ----
  offers: string[] = [];
  rerolls = 0;
  payout: string[] = [];
  log: string[] = [];

  constructor(seed: number) {
    this.seed = seed;
    this.rng = new Rng(seed);
    for (const id of STARTING_ICE) { const uid = this.nextUid++; this.owned.push({ uid, id, level: 0 }); this.order.push(uid); }
    this.startRound();
  }

  // ---- queries ----

  ice(uid: number): Owned | undefined { return this.owned.find((o) => o.uid === uid); }
  installed(): Owned[] { return this.order.map((u) => this.ice(u)!); }
  private say(s: string): void { this.log.push(s); }
  breachVisible(): boolean { return !(this.runner.id === 'veil' && this.handsPlayed < 2); }
  breachNumber(): number { return this.breachBase + (this.runner.id === 'wright' ? 50 * this.discardsUsed : 0); }

  /** What playing these cards on this ICE would do. */
  preview(cardIds: number[], uid: number): Preview | string {
    const cards = cardIds.map((id) => this.hand.find((c) => c.id === id)).filter((c): c is Card => !!c);
    if (!cards.length) return 'PICK 1 TO 5 CARDS';
    if (cards.length > RULES.maxPlay) return 'AT MOST 5 CARDS';
    const target = this.ice(uid);
    if (!target || !this.order.includes(uid)) return 'NOT INSTALLED';
    if (target.id === 'husk') return 'HUSK CANNOT BE PLAYED ON';
    const g = this.gain(cards, target);
    return { kind: g.kind, name: HAND_NAME[g.kind], scoring: g.scoring.map((c) => c.id), str: g.self, detail: g.detail };
  }

  /** The STR a hand gives the ICE it is played on, and to any others (WATCHDOG, CHORUS). */
  private gain(cards: Card[], target: Owned): { kind: HandKind; scoring: Card[]; self: number; others: Map<number, number>; detail: string } {
    const ev = evaluate(cards);
    let kind = ev.kind;
    const notes: string[] = [];
    if (target.id === 'static' && kind === 'high') { kind = 'twopair'; notes.push('STATIC: AS TWO PAIR'); }
    let self = HAND_BASE[kind] + ev.scoring.reduce((s, c) => s + cardValue(c), 0);
    const parts = [`${HAND_NAME[kind]} ${self}`];
    const x2 = (why: string) => { self *= 2; notes.push(why); };
    if (target.id === 'cipher' && (kind === 'pair' || kind === 'twopair')) x2('CIPHER x2');
    if (target.id === 'bulwark' && (kind === 'flush' || kind === 'straightflush')) x2('BULWARK x2');
    if (target.id === 'tripwire' && (kind === 'straight' || kind === 'straightflush')) x2('TRIPWIRE x2');
    if (target.id === 'rampart') { const n = cards.filter((c) => c.suit === 's').length; if (n) { self += 30 * n; notes.push(`RAMPART +${30 * n}`); } }
    if (target.level) { self = Math.round(self * (1 + RULES.upgradeStep * target.level)); notes.push(`LEVEL ${target.level} x${1 + RULES.upgradeStep * target.level}`); }
    const others = new Map<number, number>();
    const add = (uid: number, n: number) => others.set(uid, (others.get(uid) ?? 0) + n);
    if (target.id === 'watchdog') for (const o of this.installed()) if (o.uid !== target.uid) add(o.uid, 10 * cards.length);
    const faces = cards.filter((c) => c.rank >= 11 && c.rank <= 13).length;
    if (faces) for (const o of this.installed()) if (o.id === 'chorus') {
      if (o.uid === target.uid) { self += 15 * faces; notes.push(`CHORUS +${15 * faces}`); } else add(o.uid, 15 * faces);
    }
    return { kind, scoring: ev.scoring, self, others, detail: [...parts, ...notes].join(' · ') };
  }

  // ---- the round's commands ----

  play(cardIds: number[], uid: number): Result {
    if (this.phase !== 'round') return 'NOT IN A ROUND';
    if (this.hands < 1) return 'NO HANDS LEFT';
    const p = this.preview(cardIds, uid);
    if (typeof p === 'string') return p;
    const cards = cardIds.map((id) => this.hand.find((c) => c.id === id)!);
    const g = this.gain(cards, this.ice(uid)!);
    this.str.set(uid, (this.str.get(uid) ?? 0) + g.self);
    for (const [o, n] of g.others) this.str.set(o, (this.str.get(o) ?? 0) + n);
    this.say(`${g.detail} > ${ICE_BY_ID[this.ice(uid)!.id].name} +${g.self}`);
    this.hand = this.hand.filter((c) => !cardIds.includes(c.id));
    this.hands--;
    this.handsPlayed++;
    this.fill();
    return null;
  }

  discard(cardIds: number[]): Result {
    if (this.phase !== 'round') return 'NOT IN A ROUND';
    if (this.discards < 1) return 'NO DISCARDS LEFT';
    if (!cardIds.length || cardIds.length > RULES.maxPlay) return 'DISCARD 1 TO 5 CARDS';
    if (cardIds.some((id) => !this.hand.find((c) => c.id === id))) return 'NOT IN HAND';
    this.hand = this.hand.filter((c) => !cardIds.includes(c.id));
    this.discards--;
    this.discardsUsed++;
    this.fill();
    return null;
  }

  /** Move an installed ICE one place outward (-1) or inward (+1). */
  move(uid: number, dir: -1 | 1): Result {
    if (this.phase !== 'round') return 'ONLY BEFORE THE BREACH';
    const i = this.order.indexOf(uid), j = i + dir;
    if (i < 0 || j < 0 || j >= this.order.length) return 'CANNOT MOVE';
    [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
    return null;
  }

  /** Commit: the Runner breaches now. */
  breachNow(): Result {
    if (this.phase !== 'round') return 'NOT IN A ROUND';
    this.resolve();
    return null;
  }

  private fill(): void {
    while (this.hand.length < RULES.handSize && this.deck.length) this.hand.push(this.deck.shift()!);
    this.hand.sort((a, b) => a.rank - b.rank || a.suit.localeCompare(b.suit));
  }

  private startRound(): void {
    this.round++;
    const spec = roundSpec(this.round);
    this.runner = this.round === 1 ? RUNNERS[0] : RUNNERS[this.rng.int(RUNNERS.length)];
    this.agenda = { name: AGENDAS[this.rng.int(AGENDAS.length)], points: spec.points };
    this.breachBase = spec.breach;
    this.deck = [];
    let id = 1;
    for (const suit of ['s', 'h', 'd', 'c'] as Suit[]) for (let rank = 2; rank <= 14; rank++) this.deck.push({ id: id++, rank, suit });
    this.rng.shuffle(this.deck);
    this.hand = [];
    this.fill();
    this.hands = RULES.hands; this.discards = RULES.discards; this.discardsUsed = 0; this.handsPlayed = 0;
    this.str = new Map(this.installed().map((o) => [o.uid, ICE_BY_ID[o.id].base]));
    this.breach = null; this.log = []; this.payout = [];
    this.phase = 'round';
  }

  /** Design §6: breach-time powers, the Runner's twist, then each ICE absorbs in turn. Pure: `order` defaults to the current one. */
  computeBreach(order = this.order): { steps: BreachStep[]; start: number; through: number; held: boolean } {
    const final = order.map((u) => this.ice(u)!).map((o) => ({ o, str: this.str.get(o.uid) ?? 0, notes: [] as string[] }));
    for (const f of final) {
      if (f.o.id === 'sieve' && this.hands) { f.str += 60 * this.hands; f.notes.push(`SIEVE +${60 * this.hands}`); }
      if (f.o.id === 'leech' && this.discards) { f.str += 40 * this.discards; f.notes.push(`LEECH +${40 * this.discards}`); }
    }
    const last = final[final.length - 1];
    if (last && last.o.id === 'anchor') { last.str *= 2; last.notes.push('ANCHOR x2'); }
    for (let i = final.length - 1; i >= 0; i--) {
      const f = final[i];
      if (f.o.id === 'mirror' && final[i + 1]) { const n = Math.floor(final[i + 1].str / 2); f.str += n; f.notes.push(`MIRROR +${n}`); }
    }
    // the twist
    if (this.runner.id === 'spark' && final[0]) { final[0].str = Math.floor(final[0].str / 2); final[0].notes.push('BURNED: HALF'); }
    if (this.runner.id === 'halo') for (const f of final) if (ICE_BY_ID[f.o.id].type === 'CODE GATE') { f.str = Math.floor(f.str / 2); f.notes.push('HALO: HALF'); }
    if (this.runner.id === 'knot' && final.length) {
      const weakest = final.reduce((a, b) => (b.str < a.str ? b : a));
      weakest.str = 0; weakest.notes.push('IGNORED');
    }
    const start = this.breachNumber();
    let left = start;
    const steps: BreachStep[] = final.map((f) => {
      const absorbed = Math.min(left, Math.max(0, f.str));
      left -= absorbed;
      return { uid: f.o.uid, name: ICE_BY_ID[f.o.id].name, str: f.str, note: f.notes.join(' · '), absorbed, left };
    });
    return { steps, start, through: left, held: left === 0 };
  }

  private resolve(): void {
    this.breach = this.computeBreach();
    const { held, through } = this.breach;
    if (held) this.corpPoints += this.agenda.points; else this.runnerPoints += this.agenda.points;
    this.say(held ? `HELD. ${this.agenda.name} SCORES ${this.agenda.points}.` : `BREACHED. ${through} GOT THROUGH. ${this.runner.name} STEALS ${this.agenda.name}.`);
    if (this.corpPoints >= RULES.goal) this.winner = 'corp';
    else if (this.runnerPoints >= RULES.goal) this.winner = 'runner';
    this.phase = 'breach';
  }

  /** Breach: on to the Boardroom (or the end of the run). */
  next(): Result {
    if (this.phase !== 'breach') return 'NOT YET';
    if (this.winner) { this.phase = 'over'; return null; }
    const interest = Math.min(RULES.interestMax, Math.floor(this.credits / RULES.interestPer));
    const lines: [string, number][] = [['PAYOUT', RULES.payout], ['HANDS LEFT', this.hands], ['DISCARDS LEFT', this.discards], ['INTEREST', interest]];
    this.payout = lines.filter(([, n]) => n > 0).map(([k, n]) => `${k} +${n}¢`);
    this.credits += lines.reduce((s, [, n]) => s + n, 0);
    this.rerolls = 0;
    this.rollOffers();
    this.phase = 'board';
    return null;
  }

  // ---- the Boardroom's commands ----

  private rollOffers(): void {
    const pool = ICE.filter((i) => !this.owned.some((o) => o.id === i.id)).map((i) => i.id);
    this.offers = this.rng.pick(pool, RULES.offers);
  }
  rerollCost(): number { return RULES.reroll + this.rerolls; }
  slotCost(): number | null { return RULES.slotCosts[this.slotBuys] ?? null; }

  buy(id: string): Result {
    if (this.phase !== 'board') return 'ONLY IN THE BOARDROOM';
    if (!this.offers.includes(id)) return 'NOT ON OFFER';
    const cost = ICE_BY_ID[id].cost;
    if (this.credits < cost) return `NEEDS ${cost}¢`;
    this.credits -= cost;
    this.offers = this.offers.filter((o) => o !== id);
    const uid = this.nextUid++;
    this.owned.push({ uid, id, level: 0 });
    if (this.order.length < this.slots) this.order.push(uid);
    return null;
  }
  upgradeCost(uid: number): number { const o = this.ice(uid); return o ? RULES.upgradeBase + RULES.upgradeRise * o.level : 0; }
  upgrade(uid: number): Result {
    if (this.phase !== 'board') return 'ONLY IN THE BOARDROOM';
    const o = this.ice(uid);
    if (!o) return 'NOT OWNED';
    if (o.id === 'husk') return 'HUSK CANNOT BE UPGRADED';
    const cost = this.upgradeCost(uid);
    if (this.credits < cost) return `NEEDS ${cost}¢`;
    this.credits -= cost; o.level++;
    return null;
  }
  reroll(): Result {
    if (this.phase !== 'board') return 'ONLY IN THE BOARDROOM';
    const cost = this.rerollCost();
    if (this.credits < cost) return `NEEDS ${cost}¢`;
    this.credits -= cost; this.rerolls++;
    this.rollOffers();
    return null;
  }
  buySlot(): Result {
    if (this.phase !== 'board') return 'ONLY IN THE BOARDROOM';
    const cost = this.slotCost();
    if (cost === null) return 'NO MORE SLOTS';
    if (this.credits < cost) return `NEEDS ${cost}¢`;
    this.credits -= cost; this.slotBuys++; this.slots++;
    return null;
  }
  sell(uid: number): Result {
    if (this.phase !== 'board') return 'ONLY IN THE BOARDROOM';
    const o = this.ice(uid);
    if (!o) return 'NOT OWNED';
    if (this.owned.length <= 1) return 'KEEP AT LEAST ONE ICE';
    this.credits += Math.floor(ICE_BY_ID[o.id].cost / 2);
    this.owned = this.owned.filter((x) => x.uid !== uid);
    this.order = this.order.filter((x) => x !== uid);
    return null;
  }
  /** Install or uninstall an owned ICE (installed ICE goes innermost). */
  toggle(uid: number): Result {
    if (this.phase !== 'board') return 'ONLY IN THE BOARDROOM';
    if (!this.ice(uid)) return 'NOT OWNED';
    if (this.order.includes(uid)) { this.order = this.order.filter((x) => x !== uid); return null; }
    if (this.order.length >= this.slots) return 'ALL SLOTS FULL';
    this.order.push(uid);
    return null;
  }
  nextRound(): Result {
    if (this.phase !== 'board') return 'ONLY IN THE BOARDROOM';
    if (!this.order.length) return 'INSTALL AT LEAST ONE ICE';
    this.startRound();
    return null;
  }

  // ---- the view ----

  private iceView(o: Owned): IceView {
    const d = ICE_BY_ID[o.id];
    return { uid: o.uid, id: d.id, name: d.name, type: d.type, text: d.text, cost: d.cost, str: this.str.get(o.uid) ?? 0, installed: this.order.includes(o.uid), playable: d.id !== 'husk', level: o.level, upgradeCost: this.upgradeCost(o.uid) };
  }

  view(): GameView {
    return {
      seed: this.seed, phase: this.phase, round: this.round, winner: this.winner,
      corpPoints: this.corpPoints, runnerPoints: this.runnerPoints, goal: RULES.goal, credits: this.credits, slots: this.slots,
      agenda: { ...this.agenda },
      runner: { name: this.runner.name, faction: this.runner.faction, twist: this.runner.twist, breach: this.breachVisible() || this.phase !== 'round' ? this.breachNumber() : null },
      hand: this.hand.map((c) => ({ ...c })), deckLeft: this.deck.length, hands: this.hands, discards: this.discards,
      server: this.installed().map((o) => this.iceView(o)), owned: this.owned.map((o) => this.iceView(o)),
      projection: this.phase === 'round' && this.breachVisible() ? this.computeBreach() : null,
      breach: this.breach ? { ...this.breach, steps: this.breach.steps.map((s) => ({ ...s })) } : null,
      offers: this.offers.map((id) => { const d = ICE_BY_ID[id]; return { id, name: d.name, type: d.type, text: d.text, cost: d.cost }; }),
      slotCost: this.slotCost(), rerollCost: this.rerollCost(), payout: [...this.payout], log: [...this.log],
    };
  }
}
