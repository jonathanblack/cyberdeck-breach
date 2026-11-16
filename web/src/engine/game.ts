// One breach (design §2–§5): the Runner bot at the Corp's blackjack table. Pure, deterministic from the seed.
import type { Card, GameView, Outcome, Phase, Suit, Who } from './api';
import { basicStrategy, hiLo, total } from './blackjack';
import { CHARGED, PASSIVES, PASSIVE_PICKS, RULES } from './content';
import { Rng } from './rng';

/** Every command returns null on success or a short player-facing reason. */
export type Result = string | null;

const RANK = (r: number) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' } as Record<number, string>)[r] ?? String(r);
export const cardName = (c: Card) => RANK(c.rank);

export class Game {
  readonly seed: number;
  private rng: Rng;
  phase: Phase = 'loadout';
  winner: 'house' | 'runner' | null = null;
  why = '';
  shoe: Card[] = [];
  discards: Card[] = [];
  runnerCards: Card[] = [];
  dealerCards: Card[] = [];
  holeRevealed = false;
  /** Cards the Runner has seen since the last shuffle, as a Hi-Lo running count. */
  count = 0;
  bankroll = RULES.bankroll;
  bet = 0;
  doubled = false;
  hand = 0;
  charges: Record<string, number> = Object.fromEntries(CHARGED.map((i) => [i.id, i.charges]));
  passives = new Set<string>();
  /** COLD SHOE: the next bet is the minimum. */
  private coldNext = false;
  /** The cards still to come in the initial deal, in order. */
  private dealQueue: Who[] = [];
  /** Who the waiting card goes to. */
  dealTo: Who | null = null;
  result: { outcome: Outcome; delta: number } | null = null;
  log: string[] = [];

  constructor(seed: number) {
    this.seed = seed;
    this.rng = new Rng(seed);
    let id = 1;
    for (let d = 0; d < RULES.decks; d++) for (const suit of ['s', 'h', 'd', 'c'] as Suit[]) for (let rank = 1; rank <= 13; rank++) this.shoe.push({ id: id++, rank, suit });
    this.rng.shuffle(this.shoe);
  }

  // ---- queries ----

  trueCount(): number { return this.count / Math.max(0.5, this.shoe.length / 52); }
  has(p: string): boolean { return this.passives.has(p); }
  canUse(id: string): boolean {
    if (this.charges[id] < 1) return false;
    switch (id) {
      case 'reshuffle': return this.phase === 'bet';
      case 'second': return this.phase === 'deal' && this.shoe.length >= 2;
      case 'swap': return this.phase === 'hole';
      case 'void': return this.phase === 'bet' || this.phase === 'deal' || this.phase === 'hole';
    }
    return false;
  }
  private say(s: string): void { this.log.push(s); }

  // ---- commands ----

  /** Pick the passive ICE and sit the Runner down. */
  choosePassives(ids: string[]): Result {
    if (this.phase !== 'loadout') return 'THE BREACH HAS STARTED';
    if (ids.length !== PASSIVE_PICKS || new Set(ids).size !== ids.length || ids.some((i) => !PASSIVES.find((p) => p.id === i))) return `PICK ${PASSIVE_PICKS}`;
    ids.forEach((i) => this.passives.add(i));
    this.startHand();
    return null;
  }

  reshuffle(): Result {
    if (!this.canUse('reshuffle')) return 'CANNOT RESHUFFLE NOW';
    this.charges.reshuffle--;
    this.shuffleAll();
    if (this.has('coldshoe')) this.coldNext = true;
    this.say('RESHUFFLE: THE SHOE IS SHUFFLED. COUNT 0.');
    return null;
  }

  /** Bet phase: start the deal. Deal phase: deal the waiting card from the top (second = false) or second from the top. */
  deal(second = false): Result {
    if (this.phase === 'bet') { this.phase = 'deal'; this.dealQueue = ['runner', 'dealer', 'runner', 'dealer']; this.dealTo = this.dealQueue.shift()!; return null; }
    if (this.phase !== 'deal' || !this.dealTo) return 'NOTHING TO DEAL';
    if (second && !this.canUse('second')) return 'NO SECOND DEAL LEFT';
    if (second) this.charges.second--;
    const card = this.shoe.splice(second ? 1 : 0, 1)[0];
    const to = this.dealTo;
    const isHole = to === 'dealer' && this.dealerCards.length === 1;
    (to === 'runner' ? this.runnerCards : this.dealerCards).push(card);
    if (!isHole) this.count += hiLo(card);
    this.say(`${second ? 'SECOND DEAL: ' : ''}${cardName(card)} TO THE ${to === 'runner' ? 'RUNNER' : isHole ? 'DEALER (HOLE)' : 'DEALER'}`);
    this.dealTo = null;
    if (this.dealQueue.length) { this.dealTo = this.dealQueue.shift()!; return null; }
    if (isHole) this.afterInitialDeal();
    else if (to === 'runner') this.runnerAct();
    else this.dealerAct();
    return null;
  }

  /** Hole phase: swap the dealer's hole card with the top card of the shoe. */
  swap(): Result {
    if (!this.canUse('swap')) return 'CANNOT SWAP NOW';
    this.charges.swap--;
    const top = this.shoe.shift()!;
    const hole = this.dealerCards[1];
    this.dealerCards[1] = top;
    this.shoe.unshift(hole);
    this.say(`HOLE SWAP: THE HOLE CARD IS NOW ${cardName(top)}`);
    return null;
  }

  /** Hole phase: reveal the hole card and play the dealer. */
  reveal(): Result {
    if (this.phase !== 'hole') return 'NOT YET';
    this.revealHole();
    this.dealerAct();
    return null;
  }

  void(): Result {
    if (!this.canUse('void')) return 'CANNOT VOID NOW';
    this.charges.void--;
    this.say('VOID: THE HAND IS CANCELLED.');
    this.settle('void');
    return null;
  }

  /** Settled: on to the next hand. */
  next(): Result {
    if (this.phase !== 'settled') return 'THE HAND IS NOT OVER';
    this.startHand();
    return null;
  }

  // ---- the hand ----

  private shuffleAll(): void {
    this.shoe.push(...this.discards);
    this.discards = [];
    this.rng.shuffle(this.shoe);
    this.count = 0;
  }

  private startHand(): void {
    this.discards.push(...this.runnerCards, ...this.dealerCards);
    this.runnerCards = []; this.dealerCards = []; this.holeRevealed = false;
    this.doubled = false; this.result = null; this.log = [];
    if (this.shoe.length < RULES.reshuffleBelow) { this.shuffleAll(); this.say('THE SHOE RUNS LOW AND IS SHUFFLED. COUNT 0.'); }
    if (this.bankroll < RULES.minBet) return this.end('house', 'THE RUNNER CANNOT COVER THE MINIMUM');
    this.hand++;
    const tc = this.trueCount();
    let bet = tc <= 1 ? RULES.baseBet : Math.min(RULES.maxBet, Math.max(RULES.baseBet, Math.floor(tc) * RULES.baseBet));
    if (this.coldNext) { bet = RULES.minBet; this.coldNext = false; this.say('COLD SHOE: THE RUNNER BETS THE MINIMUM.'); }
    this.bet = Math.min(bet, Math.floor(this.bankroll / RULES.betUnit) * RULES.betUnit);
    this.say(`HAND ${this.hand}: THE RUNNER BETS ${this.bet} (TRUE COUNT ${tc >= 0 ? '+' : ''}${tc.toFixed(1)})`);
    this.phase = 'bet';
  }

  private afterInitialDeal(): void {
    const r = total(this.runnerCards), d = total(this.dealerCards);
    if (d.natural) { this.revealHole(); this.say('DEALER BLACKJACK.'); return this.settle(r.natural ? 'push' : 'lose'); }
    if (r.natural) { this.revealHole(); this.say('RUNNER BLACKJACK.'); return this.settle('blackjack'); }
    this.runnerAct();
  }

  /** The Runner decides; a hit or double waits for the Corp to deal. */
  private runnerAct(): void {
    const r = total(this.runnerCards);
    if (r.bust) { this.say(`THE RUNNER BUSTS WITH ${r.total}.`); return this.settle('bust'); }
    if (this.doubled || r.total === 21) return this.toHole();
    const canDouble = this.runnerCards.length === 2 && this.bankroll >= this.bet * 2;
    const play = basicStrategy(this.runnerCards, this.dealerCards[0], canDouble);
    if (play === 'stand') { this.say(`THE RUNNER STANDS ON ${r.total}.`); return this.toHole(); }
    if (play === 'double') { this.doubled = true; this.say(`THE RUNNER DOUBLES TO ${this.bet * 2}.`); }
    else this.say(`THE RUNNER HITS ON ${r.soft ? 'SOFT ' : ''}${r.total}.`);
    this.phase = 'deal';
    this.dealTo = 'runner';
  }

  private toHole(): void { this.phase = 'hole'; this.dealTo = null; }

  private revealHole(): void {
    if (this.holeRevealed) return;
    this.holeRevealed = true;
    if (this.dealerCards[1]) this.count += hiLo(this.dealerCards[1]);
  }

  /** The dealer draws to its rule; each draw waits for the Corp. */
  private dealerAct(): void {
    const d = total(this.dealerCards);
    const standOn = this.has('stand16') ? 16 : 17;
    if (d.bust) { this.say(`THE DEALER BUSTS WITH ${d.total}.`); return this.settle('win'); }
    if (d.total >= standOn) {
      const r = total(this.runnerCards).total;
      this.say(`THE DEALER STANDS ON ${d.total}.`);
      return this.settle(r > d.total ? 'win' : r < d.total ? 'lose' : 'push');
    }
    this.phase = 'deal';
    this.dealTo = 'dealer';
  }

  private settle(outcome: Outcome): void {
    const stake = this.bet * (this.doubled ? 2 : 1);
    let o = outcome;
    if (o === 'push' && this.has('ties')) { o = 'lose'; this.say('HOUSE TIES: THE PUSH GOES TO THE HOUSE.'); }
    const delta = o === 'win' ? stake : o === 'blackjack' ? (this.has('evenmoney') ? stake : Math.floor(stake * 1.5)) : o === 'lose' || o === 'bust' ? -stake : 0;
    this.bankroll += delta;
    this.result = { outcome: o, delta };
    this.phase = 'settled';
    this.dealTo = null;
    this.revealHole();
    if (this.bankroll >= RULES.target) return this.end('runner', `THE RUNNER REACHED ${this.bankroll}`);
    if (this.hand >= RULES.hands) return this.end('house', `THE TABLE HELD FOR ${RULES.hands} HANDS`);
    if (this.bankroll < RULES.minBet) return this.end('house', 'THE RUNNER IS BROKE');
  }

  private end(winner: 'house' | 'runner', why: string): void {
    this.phase = 'over';
    this.winner = winner;
    this.why = why;
  }

  // ---- the view ----

  view(): GameView {
    const hv = (cards: Card[]) => ({ cards: cards.map((c) => ({ ...c })), ...total(cards) });
    return {
      seed: this.seed, phase: this.phase, winner: this.winner, why: this.why,
      hand: this.hand, hands: RULES.hands, bankroll: this.bankroll, target: RULES.target, startBankroll: RULES.bankroll,
      bet: this.bet, doubled: this.doubled, count: this.count, trueCount: this.trueCount(),
      runner: hv(this.runnerCards), dealer: hv(this.dealerCards), holeHidden: !this.holeRevealed && this.dealerCards.length === 2,
      next: this.shoe.slice(0, 2).map((c) => ({ ...c })), shoeLeft: this.shoe.length, dealTo: this.dealTo,
      ice: CHARGED.map((i) => ({ id: i.id, name: i.name, text: i.text, charges: this.charges[i.id], max: i.charges, usable: this.canUse(i.id) })),
      passives: PASSIVES.map((p) => ({ ...p, on: this.passives.has(p.id) })),
      result: this.result ? { ...this.result } : null, log: [...this.log],
    };
  }
}
