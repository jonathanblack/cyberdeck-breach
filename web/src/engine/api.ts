// The engine-to-UI contract: plain types and view snapshots. The UI reads views and calls the Game's commands.

export type Suit = 's' | 'h' | 'd' | 'c';
/** 2..14 (14 = ace). */
export type Rank = number;
export type HandKind = 'pair' | 'twopair' | 'trips' | 'straight' | 'flush' | 'fullhouse' | 'quads' | 'straightflush';
export type IceType = 'barrier' | 'codegate' | 'sentry';
export type Breaker = 'fracter' | 'decoder' | 'killer';
export type RemoteId = 'r1' | 'r2' | 'r3';
export type ServerId = 'hq' | 'rd' | RemoteId;

export interface PokerCard { kind: 'poker'; id: number; rank: Rank; suit: Suit }
export interface AgendaCard { kind: 'agenda'; id: number; def: string }
export type Card = PokerCard | AgendaCard;

export interface IceInst { id: number; def: string }

export type Phase = 'corp' | 'discard' | 'over';

/** One step of the Runner's turn, for playback. */
export type RunnerEvent =
  | { kind: 'turn'; turn: number }
  | { kind: 'grow'; breaker: Breaker; to: number }
  | { kind: 'run'; server: ServerId }
  | { kind: 'broken'; server: ServerId; ice: string; str: number; breaker: Breaker; strength: number }
  | { kind: 'fired'; server: ServerId; ice: string; str: number; breaker: Breaker; strength: number; effect: string }
  | { kind: 'steal'; server: ServerId; agenda: string; points: number }
  | { kind: 'trash'; server: ServerId; card: PokerCard }
  | { kind: 'empty'; server: ServerId }
  | { kind: 'over'; winner: 'corp' | 'runner'; why: string };

export interface IceView { id: number; def: string; name: string; type: IceType; str: number; base: number; bonus: number }
export interface ServerView {
  id: ServerId; name: string; ice: IceView[]; // outermost first
  /** Remotes only. */
  cards: PokerCard[]; agenda: AgendaCard | null; exists: boolean;
  /** The agenda's hand is made. */
  scorable: boolean;
  /** "2 / 5" style progress toward the agenda's hand, or null. */
  progress: string | null;
}
export interface GameView {
  seed: number; turn: number; phase: Phase; winner: 'corp' | 'runner' | null; why: string;
  clicks: number; credits: number; corpPoints: number; runnerPoints: number; goal: number;
  hq: Card[]; hqMax: number; rdCount: number; archivesCount: number;
  servers: ServerView[];
  runner: Record<Breaker, number> & { runs: number };
  scored: string[]; stolen: string[];
  /** The last Runner turn, for playback. */
  events: RunnerEvent[];
}
