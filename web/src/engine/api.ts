// The engine-to-UI contract: plain types and view snapshots. The UI reads views and calls the Game's commands.

export type Suit = 's' | 'h' | 'd' | 'c';
/** 1 = ace, 11–13 = J Q K. */
export interface Card { id: number; rank: number; suit: Suit }

/**
 * loadout: pick passive ICE · bet: the Runner has bet, the Corp may RESHUFFLE · deal: a card waits for DEAL or SECOND DEAL ·
 * hole: the Runner stands, the Corp may HOLE SWAP · settled: the hand is over · over: the breach is over.
 */
export type Phase = 'loadout' | 'bet' | 'deal' | 'hole' | 'settled' | 'over';
export type Who = 'runner' | 'dealer';
export type Outcome = 'win' | 'blackjack' | 'lose' | 'bust' | 'push' | 'void';

export interface HandView { cards: Card[]; total: number; soft: boolean; bust: boolean; natural: boolean }
export interface IceView { id: string; name: string; text: string; charges: number; max: number; usable: boolean }
export interface PassiveView { id: string; name: string; text: string; on: boolean }

export interface GameView {
  seed: number; phase: Phase; winner: 'house' | 'runner' | null; why: string;
  hand: number; hands: number; bankroll: number; target: number; startBankroll: number;
  bet: number; doubled: boolean;
  /** What the Runner sees: its running count and true count. */
  count: number; trueCount: number;
  runner: HandView;
  /** The Corp always sees the hole card; `holeHidden` is whether the Runner can. */
  dealer: HandView; holeHidden: boolean;
  /** The next two cards in the shoe (the Corp sees them). */
  next: Card[]; shoeLeft: number;
  /** Who the waiting card goes to, in the deal phase. */
  dealTo: Who | null;
  ice: IceView[]; passives: PassiveView[];
  /** The last hand's outcome and the bankroll change. */
  result: { outcome: Outcome; delta: number } | null;
  log: string[];
}
