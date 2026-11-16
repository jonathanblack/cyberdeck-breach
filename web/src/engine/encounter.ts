// THE ENCOUNTER (design §5): Balatro's scoring advances an agenda; before each of the first 3 hands PYROS announces an intent, and the hand you play also blocks it (fully, partly, or not at all).
import type { Suit } from './cards';
import type { HandKind, PCard } from './poker';
import { CONTAINS, HAND_NAME, HAND_VALUE, cardChips, evaluate } from './poker';
import { Rng } from './rng';

export type Result = string | null;

export const E_RULES = { target: 3500, hands: 4, discards: 3, handSize: 8, credits: 6, rezCost: 4, picks: 4, points: 2, intents: 4, hitsToSteal: 2 };

export interface EIceDef { id: string; name: string; text: string; kind: 'score' | 'defense' }
export const E_ICE: EIceDef[] = [
  { id: 'wall', name: 'ICE WALL', text: '+4 mult.', kind: 'score' },
  { id: 'cipher', name: 'CIPHER', text: '+8 mult if the hand contains a pair.', kind: 'score' },
  { id: 'rampart', name: 'RAMPART', text: 'Each scored spade: +3 mult.', kind: 'score' },
  { id: 'firewall', name: 'NEURAL FIREWALL', text: 'A hand that blocks the attack: +80 chips.', kind: 'defense' },
  { id: 'scrambler', name: 'TRACE SCRAMBLER', text: 'A hand that blocks the attack: +3 credits.', kind: 'defense' },
  { id: 'adaptive', name: 'ADAPTIVE ICE', text: 'A hand that blocks the attack: x2 mult.', kind: 'defense' },
];
export const E_ICE_BY_ID = Object.fromEntries(E_ICE.map((i) => [i.id, i])) as Record<string, EIceDef>;

export interface IntentDef { id: string; name: string; lands: string; block: string }
export const INTENTS: IntentDef[] = [
  { id: 'burn', name: 'BURN THE EVIDENCE', lands: 'Burns your 3 highest cards in hand; they are not replaced until after your next hand.', block: 'Play no face cards and no aces.' },
  { id: 'meltdown', name: 'MELTDOWN', lands: 'Your leftmost ICE goes offline for the rest of the encounter.', block: 'Play 3 or fewer cards.' },
  { id: 'scorched', name: 'SCORCHED EARTH', lands: 'Your next hand advances nothing.', block: 'Play a hand with no pair in it.' },
  { id: 'siphon', name: 'SIPHON', lands: 'Steals 40% of your advancement so far.', block: 'Play 2 or more cards ranked 2 to 6.' },
  { id: 'overheat', name: 'OVERHEAT', lands: 'You lose a hand.', block: 'Play cards of at least 3 different suits.' },
];
export const INTENT_BY_ID = Object.fromEntries(INTENTS.map((i) => [i.id, i])) as Record<string, IntentDef>;

export interface Owned { uid: number; id: string; offline: boolean }
export interface Step { card?: number; ice?: number; chips?: number; mult?: number; xmult?: number; label: string; totalChips: number; totalMult: number }
export interface Block { intent: string; outcome: 'blocked' | 'partial' | 'lands' | 'rezzed'; text: string }
export interface Scored { kind: HandKind; name: string; level: number; cards: PCard[]; scoring: number[]; steps: Step[]; chips: number; mult: number; total: number; advancement: number; block: Block | null }
export type EPhase = 'pick' | 'play' | 'over';

export class Encounter {
  readonly seed: number;
  private rng: Rng;
  phase: EPhase = 'pick';
  won: boolean | null = null;
  ice: Owned[] = [];
  deck: PCard[] = [];
  hand: PCard[] = [];
  hands = E_RULES.hands;
  discards = E_RULES.discards;
  credits = E_RULES.credits;
  advancement = 0;
  corpPoints = 0;
  runnerPoints = 0;
  /** The intents PYROS will announce, in order, and how many hands have been played. */
  intents: string[];
  played = 0;
  rezzed = false;
  scorched = false;
  overheat = false;
  /** BURN: cards not replaced until after the next hand. */
  burnHold = 0;
  /** Attacks that landed in full. At hitsToSteal, PYROS takes the agenda. */
  hits = 0;
  last: Scored | null = null;
  log: string[] = [];

  constructor(seed: number) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.intents = this.rng.pick(INTENTS.map((i) => i.id), E_RULES.intents);
    let id = 1;
    for (const suit of ['s', 'h', 'd', 'c'] as Suit[]) for (let rank = 2; rank <= 14; rank++) this.deck.push({ id: id++, rank, suit });
    this.rng.shuffle(this.deck);
  }

  // ---- queries ----

  intent(): IntentDef | null { const id = this.intents[this.played]; return id && this.phase === 'play' ? INTENT_BY_ID[id] : null; }
  private say(s: string) { this.log.push(s); }

  /** How the current intent would resolve against these cards. */
  blockFor(cards: PCard[]): Block | null {
    const it = this.intent();
    if (!it) return null;
    if (this.rezzed) return { intent: it.id, outcome: 'rezzed', text: 'REZZED ICE BLOCKS IT.' };
    const kind = evaluate(cards).kind;
    const high = cards.filter((c) => c.rank >= 11).length;
    const low = cards.filter((c) => c.rank <= 6).length;
    const suits = new Set(cards.map((c) => c.suit)).size;
    const ok = (yes: boolean, lands: string): Block => (yes ? { intent: it.id, outcome: 'blocked', text: 'BLOCKED.' } : { intent: it.id, outcome: 'lands', text: lands });
    switch (it.id) {
      case 'burn': return ok(high === 0, 'BURNS YOUR 3 HIGHEST CARDS IN HAND.');
      case 'meltdown': return ok(cards.length <= 3, 'YOUR LEFTMOST ICE GOES OFFLINE.');
      case 'scorched': return ok(!CONTAINS[kind].includes('pair'), 'YOUR NEXT HAND ADVANCES NOTHING.');
      case 'siphon': return ok(low >= 2, 'STEALS 40% OF YOUR ADVANCEMENT.');
      case 'overheat': return ok(suits >= 3, 'YOU LOSE A HAND.');
    }
    return null;
  }

  /** Score these cards as the next hand, with the intent's block. */
  score(cardIds: number[]): Scored | string {
    const cards = cardIds.map((id) => this.hand.find((c) => c.id === id)).filter((c): c is PCard => !!c);
    if (!cards.length) return 'PICK 1 TO 5 CARDS';
    if (cards.length > 5) return 'AT MOST 5 CARDS';
    const { kind, scoring } = evaluate(cards);
    const has = (k: HandKind) => CONTAINS[kind].includes(k);
    const block = this.blockFor(cards);
    const full = block?.outcome === 'blocked';
    const hv = HAND_VALUE[kind];
    let chips = hv.chips, mult = hv.mult;
    const steps: Step[] = [{ label: `${HAND_NAME[kind]}`, chips, mult, totalChips: chips, totalMult: mult }];
    const push = (s: Omit<Step, 'totalChips' | 'totalMult'>) => {
      if (s.chips) chips += s.chips;
      if (s.mult) mult += s.mult;
      if (s.xmult) mult = Math.round(mult * s.xmult * 100) / 100;
      steps.push({ ...s, totalChips: chips, totalMult: mult });
    };
    const online = this.ice.filter((o) => !o.offline);
    for (const c of scoring) {
      push({ card: c.id, chips: cardChips(c), label: `+${cardChips(c)} CHIPS` });
      for (const o of online) if (o.id === 'rampart' && c.suit === 's') push({ ice: o.uid, card: c.id, mult: 3, label: 'RAMPART +3 MULT' });
    }
    for (const o of online) {
      const n = E_ICE_BY_ID[o.id].name;
      if (o.id === 'wall') push({ ice: o.uid, mult: 4, label: `${n} +4 MULT` });
      if (o.id === 'cipher' && has('pair')) push({ ice: o.uid, mult: 8, label: `${n} +8 MULT` });
      if (o.id === 'firewall' && full) push({ ice: o.uid, chips: 80, label: `${n} +80 CHIPS` });
      if (o.id === 'adaptive' && full) push({ ice: o.uid, xmult: 2, label: `${n} x2` });
    }
    const total = Math.floor(chips * mult);
    const advancement = this.scorched ? 0 : total;
    if (this.scorched) steps.push({ label: 'SCORCHED EARTH: ADVANCES NOTHING', totalChips: chips, totalMult: mult });
    return { kind, name: HAND_NAME[kind], level: 1, cards: cards.map((c) => ({ ...c })), scoring: scoring.map((c) => c.id), steps, chips, mult, total, advancement, block };
  }

  // ---- commands ----

  pick(ids: string[]): Result {
    if (this.phase !== 'pick') return 'ALREADY PICKED';
    if (ids.length !== E_RULES.picks || new Set(ids).size !== ids.length || ids.some((i) => !E_ICE_BY_ID[i])) return `PICK ${E_RULES.picks} ICE`;
    this.ice = ids.map((id, i) => ({ uid: 100 + i, id, offline: false }));
    this.fill();
    this.phase = 'play';
    this.say(`PROJECT ATLAS: ADVANCE ${E_RULES.target} IN ${E_RULES.hands} HANDS. PYROS ATTACKS BEFORE EVERY HAND; IF ${E_RULES.hitsToSteal} ATTACKS LAND IN FULL, PYROS STEALS THE AGENDA.`);
    return null;
  }

  rez(): Result {
    if (this.phase !== 'play') return 'NOT NOW';
    if (!this.intent()) return 'NO ATTACK TO BLOCK';
    if (this.rezzed) return 'ALREADY REZZED';
    if (this.credits < E_RULES.rezCost) return `REZ COSTS ${E_RULES.rezCost} CREDITS`;
    this.credits -= E_RULES.rezCost;
    this.rezzed = true;
    this.say(`REZZED ICE AGAINST ${this.intent()!.name}.`);
    return null;
  }

  discard(cardIds: number[]): Result {
    if (this.phase !== 'play') return 'NOT NOW';
    if (this.discards < 1) return 'NO DISCARDS LEFT';
    if (!cardIds.length || cardIds.length > 5) return 'DISCARD 1 TO 5 CARDS';
    if (cardIds.some((id) => !this.hand.find((c) => c.id === id))) return 'NOT IN HAND';
    this.hand = this.hand.filter((c) => !cardIds.includes(c.id));
    this.discards--;
    this.fill();
    return null;
  }

  move(uid: number, dir: -1 | 1): Result {
    const i = this.ice.findIndex((o) => o.uid === uid), j = i + dir;
    if (i < 0 || j < 0 || j >= this.ice.length) return 'CANNOT MOVE';
    [this.ice[i], this.ice[j]] = [this.ice[j], this.ice[i]];
    return null;
  }

  play(cardIds: number[]): Result {
    if (this.phase !== 'play') return 'NOT NOW';
    const s = this.score(cardIds);
    if (typeof s === 'string') return s;
    this.advancement += s.advancement;
    this.say(`${s.name}: ${s.chips} x ${s.mult} = ${s.total}${this.scorched ? ' (SCORCHED: NOTHING ADVANCES)' : ''}.`);
    this.scorched = false;
    this.hand = this.hand.filter((c) => !cardIds.includes(c.id));
    const it = this.intent();
    if (it && s.block) this.resolve(it, s.block, s.cards);
    if (s.block?.outcome === 'blocked') for (const o of this.ice) if (o.id === 'scrambler' && !o.offline) { this.credits += 3; this.say('TRACE SCRAMBLER: +3 CREDITS.'); }
    this.last = s;
    this.played++;
    this.hands--;
    if (this.overheat) { this.hands = Math.max(0, this.hands - 1); this.overheat = false; }
    this.rezzed = false;
    const hold = it?.id === 'burn' ? this.burnHold : 0;
    this.burnHold = 0;
    this.fill(hold);
    if (this.advancement >= E_RULES.target) this.end(true);
    else if (this.hits >= E_RULES.hitsToSteal || this.hands === 0) this.end(false);
    return null;
  }

  private resolve(it: IntentDef, b: Block, played: PCard[]): void {
    if (b.outcome === 'rezzed' || b.outcome === 'blocked') { this.say(`${it.name}: BLOCKED.`); return; }
    if (b.outcome === 'lands') { this.hits++; this.say(`PYROS GETS IN (${this.hits} OF ${E_RULES.hitsToSteal}).`); }
    switch (it.id) {
      case 'burn': {
        const n = 3;
        const burned = [...this.hand].sort((a, b) => b.rank - a.rank).slice(0, n);
        this.hand = this.hand.filter((c) => !burned.includes(c));
        this.burnHold = burned.length;
        this.say(`${it.name}: ${burned.length} CARD${burned.length === 1 ? '' : 'S'} BURNED.`);
        break;
      }
      case 'meltdown': { const o = this.ice.find((x) => !x.offline); if (o) { o.offline = true; this.say(`${it.name}: ${E_ICE_BY_ID[o.id].name} GOES OFFLINE.`); } break; }
      case 'scorched': this.scorched = true; this.say(`${it.name}: YOUR NEXT HAND WILL BE HALVED.`); break;
      case 'siphon': { const pct = 40; const n = Math.floor((this.advancement * pct) / 100); this.advancement -= n; this.say(`${it.name}: ${pct}% STOLEN (-${n}).`); break; }
      case 'overheat': this.overheat = true; this.say(`${it.name}: YOU LOSE A HAND.`); break;
    }
  }

  /** Draw back to the hand size, less any cards BURN holds back. */
  private fill(hold = 0): void { while (this.hand.length < E_RULES.handSize - hold && this.deck.length) this.hand.push(this.deck.shift()!); }

  private end(won: boolean): void {
    this.phase = 'over';
    this.won = won;
    if (won) { this.corpPoints += E_RULES.points; this.say(`PROJECT ATLAS SCORED. +${E_RULES.points} AGENDA POINTS.`); }
    else { this.runnerPoints += E_RULES.points; this.say(`PYROS STEALS PROJECT ATLAS${this.hits >= E_RULES.hitsToSteal ? '' : ': YOU RAN OUT OF HANDS'}. +${E_RULES.points} TO THE RUNNER.`); }
  }
}

export interface EncounterView {
  seed: number; phase: EPhase; won: boolean | null; target: number; advancement: number; hands: number; discards: number; credits: number;
  corpPoints: number; runnerPoints: number; rezzed: boolean; rezCost: number; scorched: boolean; overheat: boolean; hits: number; hitsToSteal: number;
  intent: IntentDef | null; upcoming: number; hand: PCard[]; deckLeft: number;
  ice: (Owned & { name: string; text: string; kind: string })[]; last: Scored | null; log: string[];
}

export function encounterView(g: Encounter): EncounterView {
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  return {
    seed: g.seed, phase: g.phase, won: g.won, target: E_RULES.target, advancement: g.advancement, hands: g.hands, discards: g.discards, credits: g.credits,
    corpPoints: g.corpPoints, runnerPoints: g.runnerPoints, rezzed: g.rezzed, rezCost: E_RULES.rezCost, scorched: g.scorched, overheat: g.overheat, hits: g.hits, hitsToSteal: E_RULES.hitsToSteal,
    intent: g.intent(), upcoming: Math.max(0, E_RULES.intents - g.played), hand: clone(g.hand), deckLeft: g.deck.length,
    ice: g.ice.map((o) => ({ ...o, name: E_ICE_BY_ID[o.id].name, text: E_ICE_BY_ID[o.id].text, kind: E_ICE_BY_ID[o.id].kind })),
    last: g.last ? clone(g.last) : null, log: [...g.log],
  };
}
