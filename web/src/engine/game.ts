// A run (design §2–§7): Balatro's scoring core under Netrunner names. Pure, deterministic from the seed.
import type { Card, GameView, HandKind, OfferView, Phase, ScoreStep, Scored, Suit } from './api';
import { ICE, ICE_BY_ID, NAMED, PROBES, REWARDS, RULES, TARGETS } from './content';
import type { RunnerDef } from './content';
import { CONTAINS, HAND_NAME, HAND_ORDER, HAND_VALUE, cardChips, evaluate } from './poker';
import { Rng } from './rng';

/** Every command returns null on success or a short player-facing reason. */
export type Result = string | null;

export interface Owned { uid: number; id: string; counter: number }
type Offer = { kind: 'ice' | 'protocol'; id: string };

export class Game {
  readonly seed: number;
  private rng: Rng;
  private nextUid = 1;
  phase: Phase = 'round';
  won: boolean | null = null;
  ante = 1;
  roundInAnte = 1;
  credits = RULES.startCredits;
  ice: Owned[] = [];
  levels: Record<HandKind, number> = Object.fromEntries(HAND_ORDER.map((k) => [k, 1])) as Record<HandKind, number>;
  handsPlayedRun = 0;
  private namedOrder: RunnerDef[];
  // ---- the round ----
  deck: Card[] = [];
  hand: Card[] = [];
  hands = 0;
  discards = 0;
  score = 0;
  target = 0;
  last: Scored | null = null;
  // ---- cashout and shop ----
  cashout: string[] = [];
  private pending = 0;
  offers: Offer[] = [];
  rerolls = 0;

  constructor(seed: number) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.namedOrder = this.rng.shuffle([...NAMED]);
    this.startRound();
  }

  // ---- queries ----

  runner(): { name: string; faction: string; def: RunnerDef | null } {
    if (this.roundInAnte < 3) return { name: PROBES[this.roundInAnte - 1], faction: 'RUNNER', def: null };
    const def = this.namedOrder[(this.ante - 1) % this.namedOrder.length];
    return { name: def.name, faction: def.faction, def };
  }
  private twist(): string | null { return this.runner().def?.id ?? null; }
  isFinalRound(): boolean { return this.ante === TARGETS.length && this.roundInAnte === 3; }

  private debuffed(c: Card): boolean {
    const t = this.twist();
    return (t === 'spark' && c.suit === 's') || (t === 'wright' && c.rank >= 11 && c.rank <= 13);
  }

  /** Score these cards as the next hand (HYDRA counts this hand's pair, as it grows before it scores). */
  scoreHand(cardIds: number[]): Scored | string {
    const cards = cardIds.map((id) => this.hand.find((c) => c.id === id)).filter((c): c is Card => !!c);
    if (!cards.length) return 'PICK 1 TO 5 CARDS';
    if (cards.length > RULES.maxPlay) return 'AT MOST 5 CARDS';
    const { kind, scoring } = evaluate(cards);
    const has = (k: HandKind) => CONTAINS[kind].includes(k);
    const lvl = this.levels[kind];
    const hv = HAND_VALUE[kind];
    let chips = hv.chips + hv.lc * (lvl - 1);
    let mult = hv.mult + hv.lm * (lvl - 1);
    const steps: ScoreStep[] = [{ label: `${HAND_NAME[kind]} LV ${lvl}`, chips, mult, totalChips: chips, totalMult: mult }];
    const push = (s: Omit<ScoreStep, 'totalChips' | 'totalMult'>) => {
      if (s.chips) chips += s.chips;
      if (s.mult) mult += s.mult;
      if (s.xmult) mult = Math.round(mult * s.xmult * 100) / 100;
      steps.push({ ...s, totalChips: chips, totalMult: mult });
    };
    const active = this.ice.filter((o, i) => !(this.twist() === 'halo' && i === 0));
    const hydra = (o: Owned) => o.counter + (has('pair') ? 1 : 0);
    // cards, left to right
    const scored = scoring.filter((c) => !this.debuffed(c));
    for (const c of scoring) if (this.debuffed(c)) steps.push({ card: c.id, label: 'DOES NOT SCORE', totalChips: chips, totalMult: mult });
    const triggers = (c: Card) => {
      push({ card: c.id, chips: cardChips(c), label: `+${cardChips(c)} CHIPS` });
      for (const o of active) {
        if (o.id === 'rampart' && c.suit === 's') push({ ice: o.uid, card: c.id, mult: 3, label: 'RAMPART +3 MULT' });
        if (o.id === 'chorus' && c.rank >= 11 && c.rank <= 13) push({ ice: o.uid, card: c.id, chips: 30, label: 'CHORUS +30 CHIPS' });
        if (o.id === 'static' && [14, 2, 3, 5, 8].includes(c.rank)) push({ ice: o.uid, card: c.id, mult: 8, label: 'STATIC +8 MULT' });
      }
    };
    scored.forEach((c, i) => {
      triggers(c);
      if (i === 0) for (const o of active) if (o.id === 'mirror') { steps.push({ ice: o.uid, card: c.id, label: 'MIRROR: AGAIN', totalChips: chips, totalMult: mult }); triggers(c); }
    });
    // ICE, left to right
    const lastHand = this.hands === 1;
    for (const o of active) {
      const n = ICE_BY_ID[o.id].name;
      switch (o.id) {
        case 'wall': push({ ice: o.uid, mult: 4, label: `${n} +4 MULT` }); break;
        case 'cipher': if (has('pair')) push({ ice: o.uid, mult: 8, label: `${n} +8 MULT` }); break;
        case 'watchdog': if (has('pair')) push({ ice: o.uid, chips: 50, label: `${n} +50 CHIPS` }); break;
        case 'tripwire': if (has('straight')) push({ ice: o.uid, mult: 12, label: `${n} +12 MULT` }); break;
        case 'bulwark': if (has('flush')) push({ ice: o.uid, mult: 10, label: `${n} +10 MULT` }); break;
        case 'sentinel': if (cards.length <= 3) push({ ice: o.uid, mult: 20, label: `${n} +20 MULT` }); break;
        case 'husk': if (this.discards) push({ ice: o.uid, chips: 30 * this.discards, label: `${n} +${30 * this.discards} CHIPS` }); break;
        case 'leech': if (o.counter) push({ ice: o.uid, mult: o.counter, label: `${n} +${o.counter} MULT` }); break;
        case 'hydra': { const x = 1 + 0.25 * hydra(o); if (x > 1) push({ ice: o.uid, xmult: x, label: `${n} x${x}` }); break; }
        case 'anchor': if (lastHand) push({ ice: o.uid, xmult: 3, label: `${n} x3` }); break;
        case 'blackice': push({ ice: o.uid, xmult: 3, label: `${n} x3` }); break;
      }
    }
    return {
      kind, name: HAND_NAME[kind], level: lvl, cards: cards.map((c) => ({ ...c })), played: cards.map((c) => c.id), scoring: scoring.map((c) => c.id),
      steps, chips, mult, total: Math.floor(chips * mult),
    };
  }

  // ---- the round ----

  play(cardIds: number[]): Result {
    if (this.phase !== 'round') return 'NOT IN A ROUND';
    if (this.hands < 1) return 'NO HANDS LEFT';
    const s = this.scoreHand(cardIds);
    if (typeof s === 'string') return s;
    // growth that happens as the hand is played
    if (CONTAINS[s.kind].includes('pair')) for (const o of this.ice) if (o.id === 'hydra') o.counter++;
    for (const o of this.ice) if (o.id === 'leech') o.counter++;
    this.handsPlayedRun++;
    this.last = s;
    this.score += s.total;
    this.hands--;
    this.hand = this.hand.filter((c) => !cardIds.includes(c.id));
    this.fill();
    if (this.score >= this.target) this.winRound();
    else if (this.hands === 0) { this.phase = 'over'; this.won = false; }
    return null;
  }

  discard(cardIds: number[]): Result {
    if (this.phase !== 'round') return 'NOT IN A ROUND';
    if (this.discards < 1) return 'NO DISCARDS LEFT';
    if (!cardIds.length || cardIds.length > RULES.maxPlay) return 'DISCARD 1 TO 5 CARDS';
    if (cardIds.some((id) => !this.hand.find((c) => c.id === id))) return 'NOT IN HAND';
    this.hand = this.hand.filter((c) => !cardIds.includes(c.id));
    this.discards--;
    this.fill();
    return null;
  }

  /** Move an ICE one place left (-1) or right (+1). */
  move(uid: number, dir: -1 | 1): Result {
    if (this.phase !== 'round' && this.phase !== 'shop') return 'NOT NOW';
    const i = this.ice.findIndex((o) => o.uid === uid), j = i + dir;
    if (i < 0 || j < 0 || j >= this.ice.length) return 'CANNOT MOVE';
    [this.ice[i], this.ice[j]] = [this.ice[j], this.ice[i]];
    return null;
  }

  private fill(): void {
    while (this.hand.length < RULES.handSize && this.deck.length) this.hand.push(this.deck.shift()!);
  }

  private startRound(): void {
    this.target = TARGETS[this.ante - 1][this.roundInAnte - 1];
    this.deck = [];
    let id = 1;
    for (const suit of ['s', 'h', 'd', 'c'] as Suit[]) for (let rank = 2; rank <= 14; rank++) this.deck.push({ id: id++, rank, suit });
    this.rng.shuffle(this.deck);
    this.hand = [];
    this.fill();
    const t = this.twist();
    this.hands = t === 'knot' ? 1 : RULES.hands;
    this.discards = t === 'veil' ? 0 : RULES.discards;
    this.score = 0;
    this.last = null;
    this.phase = 'round';
  }

  private winRound(): void {
    if (this.isFinalRound()) { this.phase = 'over'; this.won = true; return; }
    const interest = Math.min(RULES.interestMax, Math.floor(this.credits / RULES.interestPer));
    const siphons = this.ice.filter((o) => o.id === 'siphon').length * 4;
    const lines: [string, number][] = [['ROUND WON', REWARDS[this.roundInAnte - 1]], ['HANDS LEFT', this.hands], ['INTEREST', interest], ['SIPHON', siphons]];
    this.cashout = lines.filter(([, n]) => n > 0).map(([k, n]) => `${k} +${n}`);
    this.pending = lines.reduce((s, [, n]) => s + n, 0);
    this.phase = 'cashout';
  }

  /** Cashout: take the credits and go to the shop. */
  collect(): Result {
    if (this.phase !== 'cashout') return 'NOT NOW';
    this.credits += this.pending;
    this.pending = 0;
    this.rerolls = 0;
    this.rollOffers();
    this.phase = 'shop';
    return null;
  }

  // ---- the shop ----

  private rollOffers(): void {
    const pool = ICE.filter((i) => !this.ice.some((o) => o.id === i.id)).map((i) => i.id);
    const ices = this.rng.pick(pool, RULES.iceOffers).map((id) => ({ kind: 'ice' as const, id }));
    const proto = { kind: 'protocol' as const, id: HAND_ORDER[this.rng.int(HAND_ORDER.length)] };
    this.offers = [...ices, proto];
  }
  rerollCost(): number { return RULES.rerollBase + this.rerolls; }
  offerCost(o: Offer): number { return o.kind === 'ice' ? ICE_BY_ID[o.id].cost : RULES.protocolCost; }

  buy(index: number): Result {
    if (this.phase !== 'shop') return 'ONLY IN THE SHOP';
    const o = this.offers[index];
    if (!o) return 'NOT ON OFFER';
    const cost = this.offerCost(o);
    if (this.credits < cost) return `NEEDS ${cost} CREDITS`;
    if (o.kind === 'ice' && this.ice.length >= RULES.slots) return 'ALL 5 SLOTS FULL: SELL ONE';
    this.credits -= cost;
    if (o.kind === 'ice') this.ice.push({ uid: this.nextUid++, id: o.id, counter: 0 });
    else this.levels[o.id as HandKind]++;
    this.offers.splice(index, 1);
    return null;
  }
  reroll(): Result {
    if (this.phase !== 'shop') return 'ONLY IN THE SHOP';
    const cost = this.rerollCost();
    if (this.credits < cost) return `NEEDS ${cost} CREDITS`;
    this.credits -= cost; this.rerolls++;
    this.rollOffers();
    return null;
  }
  sell(uid: number): Result {
    if (this.phase !== 'shop') return 'ONLY IN THE SHOP';
    const o = this.ice.find((x) => x.uid === uid);
    if (!o) return 'NOT OWNED';
    this.credits += Math.floor(ICE_BY_ID[o.id].cost / 2);
    this.ice = this.ice.filter((x) => x !== o);
    return null;
  }
  nextRound(): Result {
    if (this.phase !== 'shop') return 'ONLY IN THE SHOP';
    if (this.roundInAnte === 3) { this.ante++; this.roundInAnte = 1; } else this.roundInAnte++;
    this.startRound();
    return null;
  }

  // ---- the view ----

  view(): GameView {
    const r = this.runner();
    const counter = (o: Owned): string | null => (o.id === 'leech' ? `+${o.counter}` : o.id === 'hydra' ? `x${1 + 0.25 * o.counter}` : null);
    const offerView = (o: Offer): OfferView => o.kind === 'ice'
      ? { kind: 'ice', id: o.id, name: ICE_BY_ID[o.id].name, text: ICE_BY_ID[o.id].text, cost: this.offerCost(o) }
      : { kind: 'protocol', id: o.id, name: `PROTOCOL: ${HAND_NAME[o.id as HandKind]}`, text: `+1 level to ${HAND_NAME[o.id as HandKind].toLowerCase()} (+${HAND_VALUE[o.id as HandKind].lc} chips, +${HAND_VALUE[o.id as HandKind].lm} mult).`, cost: this.offerCost(o) };
    return {
      seed: this.seed, phase: this.phase, won: this.won, ante: this.ante, antes: TARGETS.length, roundInAnte: this.roundInAnte,
      runner: { name: r.name, faction: r.faction, twist: r.def?.twist ?? null, target: this.target, reward: REWARDS[this.roundInAnte - 1] },
      score: this.score, hands: this.hands, discards: this.discards, credits: this.credits,
      hand: this.hand.map((c) => ({ ...c })), deckLeft: this.deck.length,
      ice: this.ice.map((o, i) => ({ uid: o.uid, id: o.id, name: ICE_BY_ID[o.id].name, text: ICE_BY_ID[o.id].text, cost: ICE_BY_ID[o.id].cost, sell: Math.floor(ICE_BY_ID[o.id].cost / 2), counter: counter(o), disabled: this.twist() === 'halo' && i === 0 && this.phase === 'round' })),
      slots: RULES.slots,
      levels: HAND_ORDER.map((k) => ({ kind: k, name: HAND_NAME[k], level: this.levels[k], chips: HAND_VALUE[k].chips + HAND_VALUE[k].lc * (this.levels[k] - 1), mult: HAND_VALUE[k].mult + HAND_VALUE[k].lm * (this.levels[k] - 1) })),
      last: this.last ? JSON.parse(JSON.stringify(this.last)) : null,
      cashout: [...this.cashout], offers: this.offers.map(offerView), rerollCost: this.rerollCost(),
    };
  }
}
