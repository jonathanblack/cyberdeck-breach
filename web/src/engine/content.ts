// ICE, named Runners and run numbers (design §2, §5–§7). Typed data; game.ts resolves the effects by id. Numbers DRAFT.

export interface IceDef { id: string; name: string; cost: number; text: string }
export const ICE: IceDef[] = [
  { id: 'wall', name: 'ICE WALL', cost: 4, text: '+4 mult.' },
  { id: 'rampart', name: 'RAMPART', cost: 5, text: 'Each scored spade: +3 mult.' },
  { id: 'chorus', name: 'CHORUS', cost: 5, text: 'Each scored face card: +30 chips.' },
  { id: 'static', name: 'STATIC', cost: 6, text: 'Each scored A, 2, 3, 5 or 8: +8 mult.' },
  { id: 'mirror', name: 'MIRROR', cost: 7, text: 'The first scored card scores twice.' },
  { id: 'cipher', name: 'CIPHER', cost: 4, text: '+8 mult if the hand contains a pair.' },
  { id: 'watchdog', name: 'WATCHDOG', cost: 4, text: '+50 chips if the hand contains a pair.' },
  { id: 'tripwire', name: 'TRIPWIRE', cost: 5, text: '+12 mult if the hand contains a straight.' },
  { id: 'bulwark', name: 'BULWARK', cost: 5, text: '+10 mult if the hand contains a flush.' },
  { id: 'sentinel', name: 'SENTINEL', cost: 5, text: '+20 mult if 3 or fewer cards are played.' },
  { id: 'husk', name: 'HUSK', cost: 5, text: '+30 chips per discard left.' },
  { id: 'leech', name: 'LEECH', cost: 6, text: 'Gains +1 mult every time you play a hand. Grows.' },
  { id: 'hydra', name: 'HYDRA', cost: 7, text: 'x1 mult; +x0.25 each time a hand containing a pair is played. Grows.' },
  { id: 'anchor', name: 'ANCHOR', cost: 7, text: 'x3 mult on the last hand of a round.' },
  { id: 'blackice', name: 'BLACK ICE', cost: 9, text: 'x3 mult.' },
  { id: 'siphon', name: 'SIPHON', cost: 6, text: 'Earn 4 credits at the end of every round.' },
];
export const ICE_BY_ID = Object.fromEntries(ICE.map((i) => [i.id, i])) as Record<string, IceDef>;

export interface RunnerDef { id: string; name: string; faction: string; twist: string }
export const NAMED: RunnerDef[] = [
  { id: 'spark', name: 'SPARK', faction: 'PYROS', twist: "Spades don't score." },
  { id: 'knot', name: 'KNOT', faction: 'THE SYNDICATE', twist: 'Only 1 hand this round.' },
  { id: 'wright', name: 'WRIGHT', faction: 'WRIGHTS', twist: "Face cards don't score." },
  { id: 'halo', name: 'HALO', faction: 'PYROS', twist: 'Your leftmost ICE does nothing.' },
  { id: 'veil', name: 'VEIL', faction: 'THE SYNDICATE', twist: 'No discards this round.' },
];
export const PROBES = ['A PROBE', 'A SECOND PROBE'];

/** Breach numbers by ante, for the probe, the second probe and the named Runner. */
export const TARGETS = [[300, 450, 600], [800, 1200, 1600], [2000, 3000, 4000], [5000, 7500, 10000]];
export const REWARDS = [3, 4, 5];

export const RULES = {
  handSize: 8, hands: 4, discards: 3, maxPlay: 5, slots: 5, startCredits: 4,
  interestPer: 5, interestMax: 5, rerollBase: 5, protocolCost: 3, iceOffers: 2,
};
