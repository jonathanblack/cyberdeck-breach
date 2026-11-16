// A greedy Corp for the sim: plays the strongest hand it can find each turn, digs with discards, orders for the twist, buys what it can.
import type { Card } from './api';
import type { Game } from './game';

/** Every subset of 1–5 cards from the hand. */
function subsets(hand: Card[]): Card[][] {
  const out: Card[][] = [];
  const n = hand.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const pick: Card[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) pick.push(hand[i]);
    if (pick.length <= 5) out.push(pick);
  }
  return out;
}

/** Best (cards, ICE) by STR gained on that ICE. */
function bestPlay(g: Game): { ids: number[]; uid: number; str: number; kind: string } | null {
  let best: { ids: number[]; uid: number; str: number; kind: string } | null = null;
  for (const cards of subsets(g.hand)) {
    const ids = cards.map((c) => c.id);
    for (const uid of g.order) {
      const p = g.preview(ids, uid);
      if (typeof p === 'string') continue;
      // prefer fewer cards at equal STR, so the rest stay for later hands
      const score = p.str - cards.length * 0.01;
      if (!best || score > best.str) best = { ids, uid, str: score, kind: p.kind };
    }
  }
  return best;
}

function playRound(g: Game): void {
  for (let guard = 0; guard < 30 && g.phase === 'round'; guard++) {
    const b = g.hands > 0 ? bestPlay(g) : null;
    if (!b) { bestOrder(g); g.breachNow(); return; }
    // weak hand and discards left: throw the cards that don't score and dig
    if (b.kind === 'high' && g.discards > 0) {
      const keep = new Set(b.ids);
      const toss = g.hand.filter((c) => !keep.has(c.id)).sort((x, y) => x.rank - y.rank).slice(0, 5).map((c) => c.id);
      if (toss.length) { g.discard(toss); continue; }
    }
    g.play(b.ids, b.uid);
  }
}

/** Try every order of the installed ICE (at most 5! = 120) and keep the one that lets least through. */
function bestOrder(g: Game): void {
  const perms = (a: number[]): number[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
  let best = g.order, bestThrough = Infinity;
  for (const p of perms([...g.order])) {
    const through = g.computeBreach(p).through;
    if (through < bestThrough) { bestThrough = through; best = p; }
  }
  g.order = [...best];
}

/** Plays a whole run. */
export function playRun(g: Game): void {
  for (let guard = 0; guard < 100 && g.phase !== 'over'; guard++) {
    if (g.phase === 'round') playRound(g);
    if (g.phase === 'breach') { g.next(); continue; }
    if (g.phase === 'board') {
      for (let i = 0; i < 8; i++) {
        const offers = g.view().offers.filter((o) => o.cost <= g.credits);
        const sc = g.slotCost();
        if (g.order.length < g.slots && offers.length) { g.buy(offers[0].id); continue; }
        if (sc !== null && g.credits >= sc) { g.buySlot(); continue; }
        // upgrade the installed ICE that took the most STR this round
        const top = [...g.order].filter((u) => g.ice(u)!.id !== 'husk').sort((a, b) => (g.str.get(b) ?? 0) - (g.str.get(a) ?? 0))[0];
        if (top !== undefined && g.credits >= g.upgradeCost(top)) { g.upgrade(top); continue; }
        break;
      }
      g.nextRound();
    }
  }
}

export { bestOrder, bestPlay };
