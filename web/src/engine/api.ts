// The engine-to-UI contract: plain types and view snapshots. The UI reads views and calls the Game's commands.

export type Suit = 's' | 'h' | 'd' | 'c';
/** 2..14 (14 = ace). */
export interface Card { id: number; rank: number; suit: Suit }
export type HandKind = 'high' | 'pair' | 'twopair' | 'trips' | 'straight' | 'flush' | 'fullhouse' | 'quads' | 'straightflush';

/** round: playing hands · breach: the breach has resolved, showing its steps · board: the Boardroom · over: the run is over. */
export type Phase = 'round' | 'breach' | 'board' | 'over';

export interface IceView {
  uid: number; id: string; name: string; type: string; text: string; cost: number;
  /** STR charged this round (before breach-time powers). */
  str: number; installed: boolean; playable: boolean; level: number; upgradeCost: number;
}
export interface Preview { kind: HandKind; name: string; scoring: number[]; str: number; detail: string }
export interface BreachStep { uid: number; name: string; str: number; note: string; absorbed: number; left: number }
export interface OfferView { id: string; name: string; type: string; text: string; cost: number }

export interface GameView {
  seed: number; phase: Phase; round: number; winner: 'corp' | 'runner' | null;
  corpPoints: number; runnerPoints: number; goal: number;
  credits: number; slots: number;
  agenda: { name: string; points: number };
  runner: { name: string; faction: string; twist: string; breach: number | null };
  hand: Card[]; deckLeft: number; hands: number; discards: number;
  /** Installed ICE in order, outermost first. */
  server: IceView[];
  /** Everything owned, installed or not. */
  owned: IceView[];
  /** In a round: how the breach would go if committed now (null while VEIL hides the number). */
  projection: { steps: BreachStep[]; start: number; through: number; held: boolean } | null;
  /** The breach as it resolved (phase breach/board/over). */
  breach: { steps: BreachStep[]; start: number; through: number; held: boolean } | null;
  offers: OfferView[]; slotCost: number | null; rerollCost: number; payout: string[];
  log: string[];
}
