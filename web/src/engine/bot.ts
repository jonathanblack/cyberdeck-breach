// A heuristic Corp for the sim: scores when it can, builds toward its agendas, protects what it builds. Not the Runner bot (that lives in game.ts).
import type { HandKind, PokerCard, RemoteId, ServerId } from './api';
import { AGENDA_BY_ID, ICE, RULES } from './content';
import type { Game } from './game';
import { progress } from './hands';

const score = (kind: HandKind, cards: PokerCard[]): number => { const p = progress(kind, cards); return p.have / p.need; };

/** Plays one whole Corp turn (clicks, then end of turn and discards). */
export function corpTurn(g: Game): void {
  while (g.phase === 'corp' && g.clicks > 0) {
    if (!step(g)) break;
  }
  if (g.phase === 'corp') g.endTurn();
  while (g.phase === 'discard') {
    // discard the lowest poker card
    const pokers = g.hq.filter((c) => c.kind === 'poker') as PokerCard[];
    const card = pokers.sort((a, b) => a.rank - b.rank)[0] ?? g.hq[0];
    g.discard(card.id);
  }
}

function step(g: Game): boolean {
  const live = g.remotes.filter((r) => r.exists);
  // 1. score
  for (const r of live) if (g.scorable(r.id)) return g.score(r.id) === null;
  // 2. an agenda in HQ goes to a remote with no agenda, preferring the remote whose cards already suit it
  const agendas = g.hq.filter((c) => c.kind === 'agenda');
  for (const a of agendas) {
    const hand = AGENDA_BY_ID[a.def].hand;
    const free = live.filter((r) => !r.agenda).sort((x, y) => score(hand, y.cards) - score(hand, x.cards));
    if (free.length) return g.install(a.id, free[0].id) === null;
    if (g.remotes.some((r) => !r.exists)) return g.install(a.id, 'new') === null;
  }
  // 3. protect a remote holding an agenda, then R&D and HQ
  const guard = (server: ServerId, max: number): boolean => {
    if (g.ice[server].length >= max) return false;
    const pick = bestIce(g, server);
    if (pick && g.credits >= g.iceCost(pick, server)) return g.installIce(pick, server) === null;
    return false;
  };
  for (const r of live) if (r.agenda && guard(r.id, g.credits >= 8 ? 3 : 2)) return true;
  // 4. a poker card that moves a remote's agenda forward, now or together with what else is in HQ
  const pokers = g.hq.filter((c) => c.kind === 'poker') as PokerCard[];
  let best: { card: PokerCard; remote: RemoteId; gain: number } | null = null;
  for (const c of pokers) {
    const others = pokers.filter((x) => x !== c);
    for (const r of live) {
      if (!r.agenda || r.cards.length >= RULES.remoteCards) continue;
      const hand = AGENDA_BY_ID[r.agenda.def].hand;
      const now = score(hand, [...r.cards, c]) - score(hand, r.cards);
      const later = score(hand, [...r.cards, ...pokers]) - score(hand, [...r.cards, ...others]);
      const gain = now + later * 0.5;
      if (gain > 0 && (!best || gain > best.gain)) best = { card: c, remote: r.id, gain };
    }
  }
  if (best) return g.install(best.card.id, best.remote) === null;
  // 5. a full remote that cannot finish: trash its weakest card
  for (const r of live) {
    if (!r.agenda || r.cards.length < RULES.remoteCards) continue;
    const hand = AGENDA_BY_ID[r.agenda.def].hand;
    const worst = r.cards.map((c) => ({ c, s: score(hand, r.cards.filter((x) => x !== c)) })).sort((a, b) => b.s - a.s)[0];
    if (worst) return g.trash(r.id, worst.c.id) === null;
  }
  if (guard('rd', 1) || guard('hq', 1)) return true;
  // 6. dig or bank; first discard (free) poker cards no remote's agenda wants
  for (const c of g.hq.filter((x) => x.kind === 'poker') as PokerCard[]) {
    const wanted = live.some((r) => r.agenda && r.cards.length < RULES.remoteCards && score(AGENDA_BY_ID[r.agenda.def].hand, [...r.cards, ...pokers]) > score(AGENDA_BY_ID[r.agenda.def].hand, [...r.cards, ...pokers.filter((x) => x !== c)]));
    if (!wanted && g.hq.length >= 4) g.discard(c.id);
  }
  if ((g.hq.length < 4 || g.credits >= 6) && g.rd.length > 5) return g.draw() === null;
  return g.credit() === null;
}

/** The ICE that stands strongest on this server. */
function bestIce(g: Game, server: ServerId): string | null {
  const cards = server === 'hq' || server === 'rd' ? [] : g.remote(server).cards;
  let best: string | null = null, bestStr = -1;
  for (const def of ICE) {
    const str = def.str + cards.filter((c) => c.suit === def.suit).length;
    if (g.credits >= g.iceCost(def.id, server) && str > bestStr) { best = def.id; bestStr = str; }
  }
  return best;
}
