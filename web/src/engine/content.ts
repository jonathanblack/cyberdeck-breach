// ICE and table rules (design §2–§5). Typed data; game.ts resolves them. Numbers DRAFT.

export interface IceDef { id: string; name: string; charges: number; text: string }
export const CHARGED: IceDef[] = [
  { id: 'reshuffle', name: 'RESHUFFLE', charges: 2, text: "Shuffle the whole shoe. The Runner's count resets." },
  { id: 'second', name: 'SECOND DEAL', charges: 3, text: 'Deal the second card instead of the top one.' },
  { id: 'swap', name: 'HOLE SWAP', charges: 1, text: "Swap the dealer's hole card with the top card." },
  { id: 'void', name: 'VOID', charges: 1, text: 'Cancel the hand. The bet returns.' },
];

export interface PassiveDef { id: string; name: string; text: string }
export const PASSIVES: PassiveDef[] = [
  { id: 'ties', name: 'HOUSE TIES', text: 'Pushes go to the house.' },
  { id: 'evenmoney', name: 'EVEN MONEY', text: 'Runner blackjacks pay 1:1.' },
  { id: 'stand16', name: 'STAND 16', text: 'The dealer stands on 16 or more.' },
  { id: 'coldshoe', name: 'COLD SHOE', text: 'After a RESHUFFLE the Runner bets the minimum next hand.' },
];
export const PASSIVE_PICKS = 2;

export const RULES = {
  decks: 2, reshuffleBelow: 26, bankroll: 100, target: 140, hands: 12,
  minBet: 10, baseBet: 20, maxBet: 80, betUnit: 10,
};
