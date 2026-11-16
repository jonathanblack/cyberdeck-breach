// THE ENCOUNTER (design §5, on the system in §6): poker hands advance an agenda. Before every hand PYROS runs with a breaker type and a strength.
// Rezzed ICE whose condition the hand meets fires: its effect scores, its strength defends. ICE of the breaker's matching type is broken for that hand.
import type { Suit } from './cards';
import type { HandKind, PCard } from './poker';
import { CONTAINS, HAND_NAME, HAND_VALUE, cardChips, evaluate } from './poker';
import { Rng } from './rng';

export type Result = string | null;

export const E_RULES = { target: 1000, hands: 4, discards: 3, handSize: 8, credits: 4, income: 2, picks: 4, points: 2, hitsToSteal: 2, runStr: [4, 5, 6, 7] };

export type IceType = 'barrier' | 'codegate' | 'sentry';
export type Breaker = 'fracter' | 'decoder' | 'killer';
export const BREAKS: Record<Breaker, IceType> = { fracter: 'barrier', decoder: 'codegate', killer: 'sentry' };
export const TYPE_NAME: Record<IceType, string> = { barrier: 'BARRIER', codegate: 'CODE GATE', sentry: 'SENTRY' };
export const BREAKER_NAME: Record<Breaker, string> = { fracter: 'FRACTER', decoder: 'DECODER', killer: 'KILLER' };

/** What a hand looks like to an ICE condition. */
interface Ctx { cards: PCard[]; kind: HandKind; scoring: PCard[] }
type Effect = { chips?: number; mult?: number; xmult?: number; credits?: number };
export interface EIceDef { id: string; name: string; type: IceType; str: number; rez: number; when: string; does: string }
interface IceRule { when: (h: Ctx) => boolean; effect: (h: Ctx) => Effect }

const has = (h: Ctx, k: HandKind) => CONTAINS[h.kind].includes(k);
export const E_ICE: EIceDef[] = [
  { id: 'wall', name: 'ICE WALL', type: 'barrier', str: 2, rez: 1, when: 'Always.', does: '+4 mult.' },
  { id: 'rampart', name: 'RAMPART', type: 'barrier', str: 4, rez: 3, when: 'A spade scores.', does: '+3 mult per scored spade.' },
  { id: 'blackwall', name: 'BLACKWALL', type: 'barrier', str: 6, rez: 4, when: 'You play 5 cards.', does: 'x1.5 mult.' },
  { id: 'honeypot', name: 'HONEYPOT', type: 'codegate', str: 2, rez: 1, when: 'You play a card ranked 2 to 6.', does: '+30 chips.' },
  { id: 'cipher', name: 'CIPHER', type: 'codegate', str: 4, rez: 2, when: 'The hand contains a pair.', does: '+8 mult.' },
  { id: 'firewall', name: 'NEURAL FIREWALL', type: 'codegate', str: 3, rez: 2, when: 'You play 3 or fewer cards.', does: '+60 chips.' },
  { id: 'scrambler', name: 'TRACE SCRAMBLER', type: 'sentry', str: 3, rez: 2, when: 'You play a face card.', does: '+3 credits.' },
  { id: 'lockdown', name: 'LOCKDOWN', type: 'sentry', str: 4, rez: 3, when: 'The hand has no pair in it.', does: '+6 mult.' },
  { id: 'adaptive', name: 'ADAPTIVE ICE', type: 'sentry', str: 5, rez: 4, when: 'A straight or a flush.', does: 'x2 mult.' },
];
const RULES: Record<string, IceRule> = {
  wall: { when: () => true, effect: () => ({ mult: 4 }) },
  rampart: { when: (h) => h.scoring.some((c) => c.suit === 's'), effect: (h) => ({ mult: 3 * h.scoring.filter((c) => c.suit === 's').length }) },
  blackwall: { when: (h) => h.cards.length === 5, effect: () => ({ xmult: 1.5 }) },
  honeypot: { when: (h) => h.cards.some((c) => c.rank <= 6), effect: () => ({ chips: 30 }) },
  cipher: { when: (h) => has(h, 'pair'), effect: () => ({ mult: 8 }) },
  firewall: { when: (h) => h.cards.length <= 3, effect: () => ({ chips: 60 }) },
  scrambler: { when: (h) => h.cards.some((c) => c.rank >= 11 && c.rank <= 13), effect: () => ({ credits: 3 }) },
  lockdown: { when: (h) => !has(h, 'pair'), effect: () => ({ mult: 6 }) },
  adaptive: { when: (h) => has(h, 'straight') || has(h, 'flush'), effect: () => ({ xmult: 2 }) },
};
export const E_ICE_BY_ID = Object.fromEntries(E_ICE.map((i) => [i.id, i])) as Record<string, EIceDef>;

/** What a run does if it gets through. */
export interface PayloadDef { id: string; name: string; lands: string }
export const PAYLOADS: PayloadDef[] = [
  { id: 'burn', name: 'BURN THE EVIDENCE', lands: 'Burns your 3 highest cards in hand; they are not replaced until after your next hand.' },
  { id: 'meltdown', name: 'MELTDOWN', lands: 'Derezzes your strongest rezzed ICE.' },
  { id: 'scorched', name: 'SCORCHED EARTH', lands: 'Your next hand advances nothing.' },
  { id: 'siphon', name: 'SIPHON', lands: 'Steals 40% of your advancement so far.' },
  { id: 'overheat', name: 'OVERHEAT', lands: 'You lose a hand.' },
];
export const PAYLOAD_BY_ID = Object.fromEntries(PAYLOADS.map((p) => [p.id, p])) as Record<string, PayloadDef>;

export interface Run { breaker: Breaker; str: number; payload: string }
export interface Owned { uid: number; id: string; rezzed: boolean }
export interface Step { card?: number; ice?: number; chips?: number; mult?: number; xmult?: number; label: string; totalChips: number; totalMult: number }
/** How the run resolves: the strength the hand fires against the run's. */
export interface Block { outcome: 'blocked' | 'lands' | 'trashed'; fired: number[]; broken: number[]; str: number; need: number }
export interface Scored { kind: HandKind; name: string; cards: PCard[]; scoring: number[]; steps: Step[]; chips: number; mult: number; total: number; advancement: number; credits: number; block: Block | null }
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
  /** PYROS's runs, one before each hand. */
  runs: Run[];
  played = 0;
  /** An ICE was trashed to stop this run. */
  trashed = false;
  scorched = false;
  overheat = false;
  burnHold = 0;
  hits = 0;
  last: Scored | null = null;
  log: string[] = [];

  constructor(seed: number) {
    this.seed = seed;
    this.rng = new Rng(seed);
    const payloads = this.rng.pick(PAYLOADS.map((p) => p.id), E_RULES.hands);
    const breakers: Breaker[] = ['fracter', 'decoder', 'killer'];
    this.runs = payloads.map((payload, i) => ({ breaker: breakers[this.rng.int(3)], str: E_RULES.runStr[i], payload }));
    let id = 1;
    for (const suit of ['s', 'h', 'd', 'c'] as Suit[]) for (let rank = 2; rank <= 14; rank++) this.deck.push({ id: id++, rank, suit });
    this.rng.shuffle(this.deck);
  }

  // ---- queries ----

  run(): Run | null { return this.phase === 'play' ? this.runs[this.played] ?? null : null; }
  private say(s: string) { this.log.push(s); }

  /** Score these cards as the next hand against the current run. */
  score(cardIds: number[]): Scored | string {
    const cards = cardIds.map((id) => this.hand.find((c) => c.id === id)).filter((c): c is PCard => !!c);
    if (!cards.length) return 'PICK 1 TO 5 CARDS';
    if (cards.length > 5) return 'AT MOST 5 CARDS';
    const { kind, scoring } = evaluate(cards);
    const h: Ctx = { cards, kind, scoring };
    const run = this.run();
    const hv = HAND_VALUE[kind];
    let chips = hv.chips, mult = hv.mult, credits = 0;
    const steps: Step[] = [{ label: HAND_NAME[kind], chips, mult, totalChips: chips, totalMult: mult }];
    const push = (s: Omit<Step, 'totalChips' | 'totalMult'>) => {
      if (s.chips) chips += s.chips;
      if (s.mult) mult += s.mult;
      if (s.xmult) mult = Math.round(mult * s.xmult * 100) / 100;
      steps.push({ ...s, totalChips: chips, totalMult: mult });
    };
    for (const c of scoring) push({ card: c.id, chips: cardChips(c), label: `+${cardChips(c)} CHIPS` });
    const fired: number[] = [], broken: number[] = [];
    let str = 0;
    for (const o of this.ice) {
      if (!o.rezzed) continue;
      const d = E_ICE_BY_ID[o.id];
      if (run && BREAKS[run.breaker] === d.type) { broken.push(o.uid); continue; }
      if (!RULES[o.id].when(h)) continue;
      fired.push(o.uid);
      str += d.str;
      const e = RULES[o.id].effect(h);
      if (e.credits) credits += e.credits;
      const what = [e.chips ? `+${e.chips} CHIPS` : '', e.mult ? `+${e.mult} MULT` : '', e.xmult ? `X${e.xmult} MULT` : '', e.credits ? `+${e.credits} CREDITS` : ''].filter(Boolean).join(' ');
      push({ ice: o.uid, chips: e.chips, mult: e.mult, xmult: e.xmult, label: `${d.name} ${what}` });
    }
    const total = Math.floor(chips * mult);
    const advancement = this.scorched ? 0 : total;
    if (this.scorched) steps.push({ label: 'SCORCHED EARTH: ADVANCES NOTHING', totalChips: chips, totalMult: mult });
    const block: Block | null = run ? { outcome: this.trashed ? 'trashed' : str >= run.str ? 'blocked' : 'lands', fired, broken, str, need: run.str } : null;
    return { kind, name: HAND_NAME[kind], cards: cards.map((c) => ({ ...c })), scoring: scoring.map((c) => c.id), steps, chips, mult, total, advancement, credits, block };
  }

  // ---- commands ----

  pick(ids: string[]): Result {
    if (this.phase !== 'pick') return 'ALREADY PICKED';
    if (ids.length !== E_RULES.picks || new Set(ids).size !== ids.length || ids.some((i) => !E_ICE_BY_ID[i])) return `PICK ${E_RULES.picks} ICE`;
    this.ice = ids.map((id, i) => ({ uid: 100 + i, id, rezzed: false }));
    this.fill();
    this.phase = 'play';
    this.say(`PROJECT ATLAS: ADVANCE ${E_RULES.target} IN ${E_RULES.hands} HANDS. PYROS RUNS BEFORE EVERY HAND; IF ${E_RULES.hitsToSteal} RUNS GET THROUGH, PYROS STEALS THE AGENDA.`);
    return null;
  }

  rez(uid: number): Result {
    if (this.phase !== 'play') return 'NOT NOW';
    const o = this.ice.find((x) => x.uid === uid);
    if (!o) return 'NO SUCH ICE';
    if (o.rezzed) return 'ALREADY REZZED';
    const d = E_ICE_BY_ID[o.id];
    if (this.credits < d.rez) return `${d.name} COSTS ${d.rez} TO REZ`;
    this.credits -= d.rez;
    o.rezzed = true;
    this.say(`REZZED ${d.name} (${d.rez} CREDIT${d.rez === 1 ? "" : "S"}).`);
    return null;
  }

  /** Trash a rezzed ICE: this run is stopped, and the ICE is gone. */
  trash(uid: number): Result {
    if (this.phase !== 'play' || !this.run()) return 'NO RUN TO STOP';
    if (this.trashed) return 'THIS RUN IS ALREADY STOPPED';
    const o = this.ice.find((x) => x.uid === uid);
    if (!o || !o.rezzed) return 'TRASH A REZZED ICE';
    this.ice = this.ice.filter((x) => x !== o);
    this.trashed = true;
    this.say(`TRASHED ${E_ICE_BY_ID[o.id].name} TO STOP THE RUN.`);
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
    this.credits += s.credits + E_RULES.income;
    this.say(`${s.name}: ${s.chips} x ${s.mult} = ${s.total}${this.scorched ? ' (SCORCHED: NOTHING ADVANCES)' : ''}.`);
    this.scorched = false;
    this.hand = this.hand.filter((c) => !cardIds.includes(c.id));
    const run = this.run();
    if (run && s.block) this.resolve(run, s.block);
    this.last = s;
    this.played++;
    this.hands--;
    if (this.overheat) { this.hands = Math.max(0, this.hands - 1); this.overheat = false; }
    this.trashed = false;
    const hold = this.burnHold;
    this.burnHold = 0;
    this.fill(hold);
    if (this.advancement >= E_RULES.target) this.end(true);
    else if (this.hits >= E_RULES.hitsToSteal || this.hands === 0) this.end(false);
    return null;
  }

  private resolve(run: Run, b: Block): void {
    const p = PAYLOAD_BY_ID[run.payload];
    if (b.outcome !== 'lands') { this.say(`${p.name}: STOPPED${b.outcome === 'blocked' ? ` (STRENGTH ${b.str} OF ${b.need})` : ''}.`); return; }
    this.hits++;
    this.say(`PYROS GETS THROUGH (${this.hits} OF ${E_RULES.hitsToSteal}).`);
    switch (run.payload) {
      case 'burn': {
        const burned = [...this.hand].sort((a, c) => c.rank - a.rank).slice(0, 3);
        this.hand = this.hand.filter((c) => !burned.includes(c));
        this.burnHold = burned.length;
        this.say(`${p.name}: ${burned.length} CARDS BURNED.`);
        break;
      }
      case 'meltdown': {
        const o = [...this.ice].filter((x) => x.rezzed).sort((a, c) => E_ICE_BY_ID[c.id].str - E_ICE_BY_ID[a.id].str)[0];
        if (o) { o.rezzed = false; this.say(`${p.name}: ${E_ICE_BY_ID[o.id].name} DEREZZED.`); }
        break;
      }
      case 'scorched': this.scorched = true; this.say(`${p.name}: YOUR NEXT HAND ADVANCES NOTHING.`); break;
      case 'siphon': { const n = Math.floor(this.advancement * 0.4); this.advancement -= n; this.say(`${p.name}: 40% STOLEN (-${n}).`); break; }
      case 'overheat': this.overheat = true; this.say(`${p.name}: YOU LOSE A HAND.`); break;
    }
  }

  private fill(hold = 0): void { while (this.hand.length < E_RULES.handSize - hold && this.deck.length) this.hand.push(this.deck.shift()!); }

  private end(won: boolean): void {
    this.phase = 'over';
    this.won = won;
    if (won) { this.corpPoints += E_RULES.points; this.say(`PROJECT ATLAS SCORED. +${E_RULES.points} AGENDA POINTS.`); }
    else { this.runnerPoints += E_RULES.points; this.say(`PYROS STEALS PROJECT ATLAS${this.hits >= E_RULES.hitsToSteal ? '' : ': YOU RAN OUT OF HANDS'}. +${E_RULES.points} TO THE RUNNER.`); }
  }
}

export interface RunView { breaker: string; breaks: string; str: number; name: string; lands: string }
export interface EncounterView {
  seed: number; phase: EPhase; won: boolean | null; target: number; advancement: number; hands: number; discards: number; credits: number;
  corpPoints: number; runnerPoints: number; trashed: boolean; scorched: boolean; hits: number; hitsToSteal: number;
  run: RunView | null; hand: PCard[]; deckLeft: number;
  ice: (Owned & EIceDef & { typeName: string; broken: boolean })[]; last: Scored | null; log: string[];
}

export function encounterView(g: Encounter): EncounterView {
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  const r = g.run();
  return {
    seed: g.seed, phase: g.phase, won: g.won, target: E_RULES.target, advancement: g.advancement, hands: g.hands, discards: g.discards, credits: g.credits,
    corpPoints: g.corpPoints, runnerPoints: g.runnerPoints, trashed: g.trashed, scorched: g.scorched, hits: g.hits, hitsToSteal: E_RULES.hitsToSteal,
    run: r ? { breaker: BREAKER_NAME[r.breaker], breaks: TYPE_NAME[BREAKS[r.breaker]], str: r.str, name: PAYLOAD_BY_ID[r.payload].name, lands: PAYLOAD_BY_ID[r.payload].lands } : null,
    hand: clone(g.hand), deckLeft: g.deck.length,
    ice: g.ice.map((o) => { const d = E_ICE_BY_ID[o.id]; return { ...d, ...o, typeName: TYPE_NAME[d.type], broken: !!r && BREAKS[r.breaker] === d.type }; }),
    last: g.last ? clone(g.last) : null, log: [...g.log],
  };
}
