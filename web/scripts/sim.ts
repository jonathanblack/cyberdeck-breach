// Headless sanity report: greedy players. THE ENCOUNTER (blocking vs ignoring PYROS), SOLITAIRE, RUMMY round 1. `npm run sim -- 300`.
import type { Card, Suit } from '../src/engine/cards';
import { RUN_AFTER, Rummy, isOp, meldOf } from '../src/engine/rummy';
import { Solitaire } from '../src/engine/solitaire';

const N = Number(process.argv[2] ?? 300);
const S: Suit[] = ['s', 'h', 'd', 'c'];
const pct = (a: number) => `${((100 * a) / N).toFixed(0)}%`;
const report = (name: string, scores: number[], target: number) => {
  scores.sort((a, b) => a - b);
  console.log(`${name.padEnd(10)} target ${String(target).padStart(3)} · median ${scores[N >> 1]} · p25 ${scores[N >> 2]} · p90 ${scores[Math.floor(N * 0.9)]} · passes ${pct(scores.filter((x) => x >= target).length)}`);
};

// SOLITAIRE: vault fronts, move series that uncover face-down cards, kings to empty lines, RECOVER 3, PULL/RESTORE when held.
function greedyMoves(s: Solitaire): void {
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 0; i < s.lines.length && !moved; i++) {
      const f = s.front(i);
      if (!f) continue;
      const v = s.vaults.findIndex((_, j) => s.fitsVault(f, j));
      if (v >= 0 && !s.move(i, s.lines[i].up.length - 1, { vault: v })) moved = true;
    }
    for (let i = 0; i < s.lines.length && !moved; i++) {
      const l = s.lines[i];
      if (!l.up.length || l.flooded) continue;
      // move the whole face-up series if that uncovers a card, or empties a line onto a king
      const k = l.up.findIndex((_, kk) => s.series(i, kk));
      const ser = s.series(i, k);
      if (!ser) continue;
      for (let j = 0; j < s.lines.length && !moved; j++) {
        if (j === i || !s.fitsLine(ser[0], j)) continue;
        if (s.isEmpty(j) && k === 0 && !l.down.length) continue; // pointless king shuffle
        if (k === 0 && (l.down.length || !s.isEmpty(j))) { if (!s.move(i, k, { line: j })) moved = true; }
      }
    }
    if (!moved) return;
  }
}
const sol: number[] = []; const saved: number[] = [];
for (let seed = 1; seed <= N; seed++) {
  const s = new Solitaire(seed);
  for (let i = 0; i < 3000 && s.phase !== 'over'; i++) {
    if (s.phase === 'turn') {
      greedyMoves(s);
      if (s.phase !== 'turn') continue;
      const op = s.hand.find((o) => (o === 'pull' || o === 'restore') && !s.opBlocked(o));
      if (op) { s.playOp(op); continue; }
      s.recover(3);
    } else if (s.phase === 'place') {
      const order = s.pending.map((c, k) => ({ c, k })).filter(({ c }) => s.canGoAnywhere(c));
      const vaultable = order.find(({ c }) => s.vaults.some((_, j) => s.fitsVault(c, j)));
      const pick = vaultable ?? order[0];
      const v = s.vaults.findIndex((_, j) => s.fitsVault(pick.c, j));
      s.place(pick.k, v >= 0 ? { vault: v } : { line: s.lines.findIndex((_, j) => s.fitsLine(pick.c, j)) });
    } else break;
  }
  sol.push(s.score()); saved.push(s.saved());
}
saved.sort((a, b) => a - b);
sol.sort((a, b) => a - b);
console.log(`SOLITAIRE  cards saved: median ${saved[N >> 1]} · p25 ${saved[N >> 2]} · p90 ${saved[Math.floor(N * 0.9)]} of 52 · score median ${sol[N >> 1]}`);

// RUMMY: lay the biggest meld, extend, ice the Runner's target, cash big or threatened melds.
function findMeld(hand: Card[]): Card[] | null {
  let best: Card[] | null = null;
  const by = new Map<number, Card[]>(); for (const c of hand) by.set(c.rank, [...(by.get(c.rank) ?? []), c]);
  for (const g of by.values()) if (g.length >= 3 && (!best || g.length > best.length)) best = g;
  for (const su of S) {
    const cs = hand.filter((c) => c.suit === su).sort((a, b) => a.rank - b.rank);
    for (let i = 0; i < cs.length; i++) for (let j = cs.length; j >= i + 3; j--) { const sub = cs.slice(i, j); if (meldOf(sub) && (!best || sub.length > best.length)) best = sub; }
  }
  return best;
}
const rum: number[] = [];
for (let seed = 1; seed <= N; seed++) {
  const g = new Rummy(seed);
  const cardsOf = () => g.hq.filter((x): x is Card => !isOp(x));
  for (let guard = 0; guard < 100 && g.roundIdx === 0 && g.phase !== 'over'; guard++) {
    if (g.phase === 'draw') { g.drawRD(); continue; }
    for (const o of g.hq.filter(isOp)) if (o.op !== 'shortmeld') g.playOp(o.id);
    let m, tries = 0; while (tries++ < 6 && g.servers.length < 4 && (m = findMeld(cardsOf()))) { if (g.lay(m.map((c) => c.id))) break; }
    for (const sv of [...g.servers]) for (const c of cardsOf()) g.extend(sv.id, c.id);
    const runSoon = RUN_AFTER.includes(g.turn);
    const t = g.runnerTarget();
    if (runSoon && t && !t.ice && g.credits >= 2 && g.value(t).total > 40) g.installIce(t.id);
    for (const sv of [...g.servers]) if (sv.cards.length >= 5 || g.turn >= g.turns || (runSoon && sv === g.runnerTarget() && !sv.ice) || g.score + g.value(sv).total >= g.round.target) g.cash(sv.id);
    const cards = cardsOf();
    if (!cards.length) break;
    const keep = (c: Card) => cards.filter((x) => x.rank === c.rank).length >= 2 || cards.some((x) => x.suit === c.suit && Math.abs(x.rank - c.rank) <= 2 && x !== c);
    g.discard([...cards].sort((a, b) => Number(keep(a)) - Number(keep(b)) || b.rank - a.rank)[0].id);
  }
  rum.push(g.score);
}
report('RUMMY', rum, new Rummy(1).round.target);

// THE ENCOUNTER: a greedy player that weighs each hand's advancement against what the attack would cost; REZ when that cost is high.
{
  const { E_ICE, Encounter } = await import('../src/engine/encounter');
  const { Rng } = await import('../src/engine/rng');
  type PC = { id: number; rank: number; suit: string };
  const subsets = (h: PC[]) => { const o: PC[][] = []; for (let m = 1; m < 1 << h.length; m++) { const p: PC[] = []; for (let i = 0; i < h.length; i++) if (m & (1 << i)) p.push(h[i]); if (p.length <= 5) o.push(p); } return o; };
  const PEN: Record<string, number> = { burn: 250, meltdown: 300, scorched: 450, siphon: 300, overheat: 450 };
  const play = (seed: number, aware: boolean) => {
    const g = new Encounter(seed);
    g.pick(new Rng(seed * 7).pick(E_ICE.map((i) => i.id), 4));
    for (let guard = 0; guard < 30 && g.phase === 'play'; guard++) {
      let best: { ids: number[]; v: number; kind: string; pen: number } | null = null;
      for (const s of subsets(g.hand)) {
        const sc = g.score(s.map((c) => c.id)); if (typeof sc === 'string') continue;
        const pen = aware && sc.block && sc.block.outcome === 'lands' ? PEN[sc.block.intent] + 900 * (g.hits + 1) : 0;
        if (!best || sc.advancement - pen > best.v) best = { ids: sc.cards.map((c) => c.id), v: sc.advancement - pen, kind: sc.kind, pen };
      }
      if (aware && best!.pen >= 900 && g.credits >= 4) { g.rez(); continue; }
      if (best!.kind === 'high' && g.discards > 0) { const keep = new Set(best!.ids); g.discard(g.hand.filter((c) => !keep.has(c.id)).sort((a, b) => a.rank - b.rank).slice(0, 5).map((c) => c.id)); continue; }
      g.play(best!.ids);
    }
    return !!g.won;
  };
  let a = 0, b = 0;
  for (let s = 1; s <= N; s++) { if (play(s, true)) a++; if (play(s, false)) b++; }
  console.log(`ENCOUNTER  holds the agenda: blocking ${pct(a)} · ignoring PYROS ${pct(b)}`);
}
