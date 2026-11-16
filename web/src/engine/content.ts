// ICE, Runners, agendas and run numbers (design §2–§7). Typed data; game.ts resolves the powers by id. Numbers DRAFT.

export interface IceDef { id: string; name: string; type: 'BARRIER' | 'CODE GATE' | 'SENTRY'; cost: number; base: number; text: string }
export const ICE: IceDef[] = [
  { id: 'rampart', name: 'RAMPART', type: 'BARRIER', cost: 5, base: 0, text: '+30 for every spade played on it.' },
  { id: 'cipher', name: 'CIPHER', type: 'CODE GATE', cost: 5, base: 0, text: 'A pair or two pair played on it counts x2.' },
  { id: 'watchdog', name: 'WATCHDOG', type: 'SENTRY', cost: 5, base: 0, text: 'Every card played on it gives +10 to each other installed ICE.' },
  { id: 'bulwark', name: 'BULWARK', type: 'BARRIER', cost: 6, base: 0, text: 'A flush played on it counts x2.' },
  { id: 'tripwire', name: 'TRIPWIRE', type: 'SENTRY', cost: 6, base: 0, text: 'A straight played on it counts x2.' },
  { id: 'husk', name: 'HUSK', type: 'BARRIER', cost: 4, base: 150, text: 'Base 150. Cannot be played on.' },
  { id: 'anchor', name: 'ANCHOR', type: 'BARRIER', cost: 7, base: 0, text: 'At the breach: x2 if it is the innermost ICE.' },
  { id: 'sieve', name: 'SIEVE', type: 'CODE GATE', cost: 6, base: 0, text: 'At the breach: +60 for every hand left unplayed.' },
  { id: 'leech', name: 'LEECH', type: 'SENTRY', cost: 5, base: 0, text: 'At the breach: +40 for every discard left unused.' },
  { id: 'chorus', name: 'CHORUS', type: 'CODE GATE', cost: 6, base: 0, text: '+15 for every face card played on any ICE.' },
  { id: 'mirror', name: 'MIRROR', type: 'CODE GATE', cost: 8, base: 0, text: 'At the breach: gains half the STR of the ICE just inside it.' },
  { id: 'static', name: 'STATIC', type: 'SENTRY', cost: 4, base: 0, text: 'A high card played on it scores as two pair.' },
];
export const ICE_BY_ID = Object.fromEntries(ICE.map((i) => [i.id, i])) as Record<string, IceDef>;
export const STARTING_ICE = ['rampart', 'cipher', 'watchdog'];

export interface RunnerDef { id: string; name: string; faction: string; twist: string }
export const RUNNERS: RunnerDef[] = [
  { id: 'spark', name: 'SPARK', faction: 'PYROS', twist: 'Burns the outermost ICE: it counts half.' },
  { id: 'knot', name: 'KNOT', faction: 'THE SYNDICATE', twist: 'Ignores your weakest ICE.' },
  { id: 'wright', name: 'WRIGHT', faction: 'WRIGHTS', twist: '+50 to the breach for every discard you used.' },
  { id: 'halo', name: 'HALO', faction: 'PYROS', twist: 'Code Gates count half.' },
  { id: 'veil', name: 'VEIL', faction: 'THE SYNDICATE', twist: 'Hides the breach number until 2 hands are played.' },
];

export const AGENDAS = [
  'CURFEW PROTOCOL', 'GRID PACIFICATION', 'LOBBY LEDGER', 'BOARD SEAT', 'MARKET CORNER', 'MERGER TERMS',
  'GENOME DEED', 'ORBITAL DENIAL', 'DATA HARVEST', 'TOWER LEASE', 'CLEAN SLATE', 'HOSTILE BUYOUT',
];

/** Design §2: agenda points and breach number by round. */
export function roundSpec(round: number): { points: number; breach: number } {
  const table = [[1, 300], [1, 450], [2, 700], [2, 1000], [3, 1350], [3, 1750], [3, 2200]];
  if (round <= table.length) { const [points, breach] = table[round - 1]; return { points, breach }; }
  return { points: 3, breach: 2200 + 500 * (round - table.length) };
}

export const RULES = {
  goal: 7, handSize: 8, hands: 4, discards: 3, maxPlay: 5, startSlots: 3,
  payout: 4, interestPer: 5, interestMax: 5, reroll: 2, slotCosts: [10, 15], offers: 3,
  /** Each level: +50% to the STR a hand gives that ICE. Cost 4 + 3 per level already bought. */
  upgradeStep: 0.5, upgradeBase: 4, upgradeRise: 3,
};
