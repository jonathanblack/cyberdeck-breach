// A heuristic Corp for the sim: spends charges when the bet is big and the cards say so. `cheat: false` deals straight.
import type { Card } from './api';
import { total } from './blackjack';
import type { Game } from './game';

const BIG = 30;

/** Plays the Corp's side of one breach to the end. */
export function playBreach(g: Game, passives: string[], cheat = true): void {
  g.choosePassives(passives);
  for (let guard = 0; guard < 2000 && g.phase !== 'over'; guard++) step(g, cheat);
}

function step(g: Game, cheat: boolean): void {
  const stake = g.bet * (g.doubled ? 2 : 1);
  switch (g.phase) {
    case 'bet':
      if (cheat && g.canUse('reshuffle') && g.trueCount() >= 2 && g.bet >= BIG) g.reshuffle();
      g.deal();
      return;
    case 'deal':
      g.deal(cheat && g.canUse('second') && stake >= BIG && secondIsBetter(g));
      return;
    case 'hole':
      if (cheat && g.canUse('swap') && stake >= BIG && swapHelps(g)) g.swap();
      if (cheat && g.canUse('void') && stake >= 40 && runnerFavoured(g)) { g.void(); return; }
      g.reveal();
      return;
    case 'settled':
      g.next();
      return;
  }
}

/** Is the second card worse for the Runner (or better for the dealer) than the top one? */
function secondIsBetter(g: Game): boolean {
  const [top, second] = g.shoe;
  if (!second) return false;
  if (g.dealTo === 'runner') return runnerScore(g.runnerCards, second) < runnerScore(g.runnerCards, top);
  return dealerScore(g.dealerCards, second) > dealerScore(g.dealerCards, top);
}
/** Rough value of a Runner hand after one more card: bust is worst, 20–21 best. */
function runnerScore(cards: Card[], c: Card): number {
  const t = total([...cards, c]);
  if (t.bust) return -10;
  if (cards.length < 2) return c.rank === 1 ? 11 : Math.min(c.rank, 10);
  return t.total;
}
function dealerScore(cards: Card[], c: Card): number {
  const t = total([...cards, c]);
  if (t.bust) return -10;
  if (cards.length < 1) return c.rank === 1 ? 11 : Math.min(c.rank, 10);
  return t.total >= 17 ? t.total : t.total - 10;
}
function swapHelps(g: Game): boolean {
  const r = total(g.runnerCards).total;
  const now = total(g.dealerCards).total;
  const swapped = total([g.dealerCards[0], g.shoe[0]]).total;
  return now < Math.max(17, r) && swapped > now && swapped <= 21;
}
function runnerFavoured(g: Game): boolean {
  const r = total(g.runnerCards).total;
  const d = total(g.dealerCards).total;
  return r >= 19 && d >= 17 && d < r;
}
