// The engine-to-UI contract: plain types and view snapshots. The UI reads views and calls the Game's commands.

export type Suit = 's' | 'h' | 'd' | 'c';
/** 2..14 (14 = ace). */
export interface Card { id: number; rank: number; suit: Suit }
export type HandKind = 'high' | 'pair' | 'twopair' | 'trips' | 'straight' | 'flush' | 'fullhouse' | 'quads' | 'straightflush';

/** round: playing · cashout: the round is won, rewards shown · shop · over: the run is over. */
export type Phase = 'round' | 'cashout' | 'shop' | 'over';

/** One step of a scored hand, for playback. `card` or `ice` says what triggered it. */
export interface ScoreStep { card?: number; ice?: number; chips?: number; mult?: number; xmult?: number; label: string; totalChips: number; totalMult: number }
export interface Scored { kind: HandKind; name: string; level: number; cards: Card[]; played: number[]; scoring: number[]; steps: ScoreStep[]; chips: number; mult: number; total: number }

export interface IceView { uid: number; id: string; name: string; text: string; cost: number; sell: number; counter: string | null; disabled: boolean }
export interface OfferView { kind: 'ice' | 'protocol'; id: string; name: string; text: string; cost: number }

export interface GameView {
  seed: number; phase: Phase; won: boolean | null;
  ante: number; antes: number; roundInAnte: number;
  runner: { name: string; faction: string; twist: string | null; target: number; reward: number };
  score: number; hands: number; discards: number; credits: number;
  hand: Card[]; deckLeft: number;
  ice: IceView[]; slots: number;
  levels: { kind: HandKind; name: string; level: number; chips: number; mult: number }[];
  /** The last hand played this round. */
  last: Scored | null;
  cashout: string[];
  offers: OfferView[]; rerollCost: number;
}
