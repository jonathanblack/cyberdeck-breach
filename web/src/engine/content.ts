// Agendas and ICE (design §4, §5). Typed data; game.ts resolves them. Numbers DRAFT.
import type { Breaker, HandKind, IceType, Suit } from './api';

export interface AgendaDef { id: string; name: string; hand: HandKind; points: number }
export const AGENDAS: AgendaDef[] = [
  { id: 'curfew', name: 'CURFEW PROTOCOL', hand: 'pair', points: 1 },
  { id: 'grid', name: 'GRID PACIFICATION', hand: 'pair', points: 1 },
  { id: 'lobby', name: 'LOBBY LEDGER', hand: 'twopair', points: 2 },
  { id: 'seat', name: 'BOARD SEAT', hand: 'twopair', points: 2 },
  { id: 'corner', name: 'MARKET CORNER', hand: 'trips', points: 2 },
  { id: 'merger', name: 'MERGER TERMS', hand: 'straight', points: 3 },
  { id: 'genome', name: 'GENOME DEED', hand: 'flush', points: 3 },
  { id: 'orbital', name: 'ORBITAL DENIAL', hand: 'fullhouse', points: 4 },
  { id: 'patrol', name: 'PATROL MANDATE', hand: 'pair', points: 1 },
  { id: 'harvest', name: 'DATA HARVEST', hand: 'twopair', points: 2 },
  { id: 'tower', name: 'TOWER LEASE', hand: 'trips', points: 2 },
  { id: 'militia', name: 'PRIVATE MILITIA', hand: 'straight', points: 3 },
  { id: 'slate', name: 'CLEAN SLATE', hand: 'flush', points: 3 },
  { id: 'buyout', name: 'HOSTILE BUYOUT', hand: 'fullhouse', points: 4 },
  { id: 'blacksite', name: 'BLACKSITE', hand: 'quads', points: 5 },
];
export const AGENDA_BY_ID = Object.fromEntries(AGENDAS.map((a) => [a.id, a])) as Record<string, AgendaDef>;

export type IceEffect = 'end' | 'slow' | 'burn';
export interface IceDef { id: string; name: string; type: IceType; suit: Suit; breaker: Breaker; cost: number; str: number; effect: IceEffect; text: string }
export const ICE: IceDef[] = [
  { id: 'rampart', name: 'RAMPART', type: 'barrier', suit: 's', breaker: 'fracter', cost: 2, str: 2, effect: 'end', text: 'Ends the run.' },
  { id: 'cipher', name: 'CIPHER', type: 'codegate', suit: 'h', breaker: 'decoder', cost: 3, str: 3, effect: 'slow', text: 'Ends the run. One fewer run next turn.' },
  { id: 'watchdog', name: 'WATCHDOG', type: 'sentry', suit: 'c', breaker: 'killer', cost: 3, str: 2, effect: 'burn', text: "Ends the run. The Runner's strongest breaker -1." },
];
export const ICE_BY_ID = Object.fromEntries(ICE.map((i) => [i.id, i])) as Record<string, IceDef>;

export const HAND_NAME: Record<HandKind, string> = {
  pair: 'PAIR', twopair: 'TWO PAIR', trips: 'THREE OF A KIND', straight: 'STRAIGHT', flush: 'FLUSH',
  fullhouse: 'FULL HOUSE', quads: 'FOUR OF A KIND', straightflush: 'STRAIGHT FLUSH',
};
export const SUIT_NAME: Record<Suit, string> = { s: 'SPADES', h: 'HEARTS', d: 'DIAMONDS', c: 'CLUBS' };
export const BREAKER_NAME: Record<Breaker, string> = { fracter: 'FRACTER', decoder: 'DECODER', killer: 'KILLER' };
export const ICE_TYPE_NAME: Record<IceType, string> = { barrier: 'BARRIER', codegate: 'CODE GATE', sentry: 'SENTRY' };

/** Design §2, §3, §6. */
export const RULES = {
  goal: 7, runnerGoal: 10, clicks: 4, startHand: 5, startCredits: 5, hqMax: 5, remotes: 3, remoteCards: 5, icePerServer: 3,
  runsPerTurn: 1, breakerStart: 1, growEvery: 3,
};
