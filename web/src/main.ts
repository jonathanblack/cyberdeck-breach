// The run's screen: the round (score box, ICE row, hand), card-by-card scoring playback, cashout, the shop.
import type { Card, GameView, Scored, Suit } from './engine/api';
import { RULES } from './engine/content';
import { Game } from './engine/game';
import { CHEVRON, SUIT_GLYPH } from './glyphs';

const params = new URLSearchParams(location.search);
let game = new Game(Number(params.get('seed')) || (Date.now() % 1_000_000));
let picked: number[] = [];
let selIce: number | null = null;
let sortBy: 'rank' | 'suit' = 'rank';
let showLevels = false;
let note = '';
/** Scoring playback: the hand being played out and how many steps are shown. */
let anim: { s: Scored; shown: number; scoreBefore: number } | null = null;

const app = document.getElementById('app')!;
const RANK = (r: number) => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' } as Record<number, string>)[r] ?? String(r);
const red = (s: Suit) => s === 'h' || s === 'd';
const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString('en-US');
const SUIT_ORDER: Record<Suit, number> = { s: 0, h: 1, c: 2, d: 3 };

function cardHtml(c: Card, cls = '', attrs = ''): string {
  return `<button class="card ${red(c.suit) ? 'red' : ''} ${cls}" ${attrs}><b>${RANK(c.rank)}</b><i>${SUIT_GLYPH[c.suit]}</i></button>`;
}

function scoreBox(v: GameView): string {
  let name = '', chips = 0, mult = 0, label = '';
  if (anim) {
    const st = anim.s.steps[Math.max(0, anim.shown - 1)];
    name = `${anim.s.name} <small>LV ${anim.s.level}</small>`; chips = st.totalChips; mult = st.totalMult; label = st.label;
  } else if (picked.length) {
    const s = game.scoreHand(picked);
    if (typeof s !== 'string') { name = `${s.name} <small>LV ${s.level}</small>`; chips = s.steps[0].totalChips; mult = s.steps[0].totalMult; label = `SCORES ${fmt(s.total)}`; }
  }
  const pct = Math.min(100, (100 * (anim ? anim.scoreBefore : v.score)) / v.runner.target);
  return `<div class="scorebox">
    <div class="round"><span class="cap">ROUND SCORE</span><b>${fmt(anim ? anim.scoreBefore : v.score)}</b><span class="dim">/ ${fmt(v.runner.target)}</span></div>
    <div class="bar"><span style="width:${pct}%"></span></div>
    <div class="hname">${name || '<span class="dim">SELECT CARDS</span>'}</div>
    <div class="cm"><span class="chips">${fmt(chips)}</span><span class="x">X</span><span class="mult">${fmt(mult)}</span></div>
    <div class="steplabel">${label}</div>
  </div>`;
}

function iceRow(v: GameView, inShop: boolean): string {
  const active = anim ? anim.s.steps[anim.shown - 1]?.ice : undefined;
  const cells = v.ice.map((i) => `<div class="ice ${selIce === i.uid ? 'sel' : ''} ${i.disabled ? 'off' : ''} ${active === i.uid ? 'fire' : ''}" data-ice="${i.uid}"><b>${i.name}</b>${i.counter ? `<span class="ctr">${i.counter}</span>` : ''}</div>`);
  for (let k = v.ice.length; k < v.slots; k++) cells.push('<div class="ice empty"></div>');
  const k = v.ice.findIndex((i) => i.uid === selIce);
  const sel = k >= 0 ? v.ice[k] : null;
  const detail = sel && !anim ? `<div class="icedetail"><div><b>${sel.name}</b> ${sel.text}${sel.disabled ? ' <span class="bad">DISABLED THIS ROUND</span>' : ''}</div>
    <div class="mv"><button data-move="${sel.uid}:-1" ${k === 0 ? 'disabled' : ''}>${CHEVRON.left}</button>${inShop ? `<button class="sellb" data-sell="${sel.uid}">SELL ${sel.sell}</button>` : ''}<button data-move="${sel.uid}:1" ${k === v.ice.length - 1 ? 'disabled' : ''}>${CHEVRON.right}</button></div></div>` : '';
  return `<div class="icehead"><span class="cap">ICE ${v.ice.length} / ${v.slots}: TRIGGERS LEFT TO RIGHT</span>${v.ice.length ? '<span class="cap dim">TAP ONE TO READ OR MOVE</span>' : ''}</div><div class="icerow">${cells.join('')}</div>${detail}`;
}

function top(v: GameView): string {
  return `<div class="top">
    <div class="brand"><b>CYBERDECK</b><span>// BREACH</span></div>
    <div class="stat"><span class="cap">ANTE</span><b>${v.ante} / ${v.antes}</b></div>
    <div class="stat"><span class="cap">CREDITS</span><b>${v.credits}</b></div>
  </div>`;
}

function runnerPanel(v: GameView): string {
  return `<div class="runner ${v.runner.twist ? 'named' : ''}">
    <div><span class="cap">${v.runner.faction}</span><b>${v.runner.name}</b></div>
    <div class="tgt"><span class="cap">BREACH</span><b>${fmt(v.runner.target)}</b></div>
    ${v.runner.twist ? `<div class="tw">${v.runner.twist}</div>` : ''}
  </div>`;
}

function roundView(v: GameView): string {
  const hand = [...v.hand].sort((a, b) => (sortBy === 'rank' ? b.rank - a.rank || SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] : SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || b.rank - a.rank));
  const scoringIds = new Set<number>();
  if (picked.length && !anim) { const s = game.scoreHand(picked); if (typeof s !== 'string') s.scoring.forEach((i) => scoringIds.add(i)); }
  const activeCard = anim ? anim.s.steps[anim.shown - 1]?.card : undefined;
  const played = anim ? `<div class="played">${anim.s.cards.map((c) => cardHtml(c, `${anim!.s.scoring.includes(c.id) ? 'scoring' : 'dead'} ${activeCard === c.id ? 'fire' : ''}`)).join('')}</div>` : '';
  return `
  ${runnerPanel(v)}
  ${scoreBox(v)}
  ${iceRow(v, false)}
  ${played || `<div class="hand">${hand.map((c) => cardHtml(c, `${picked.includes(c.id) ? 'sel' : ''} ${scoringIds.has(c.id) ? 'scores' : ''}`, `data-card="${c.id}"`)).join('')}</div>`}
  <div class="actions">
    <button class="btn volt" data-act="play" ${picked.length && !anim ? '' : 'disabled'}><span>PLAY <em>${v.hands}</em></span></button>
    <button class="btn hot" data-act="discard" ${picked.length && v.discards && !anim ? '' : 'disabled'}><span>DISCARD <em>${v.discards}</em></span></button>
  </div>
  <div class="tools">
    <button class="btn sm" data-act="sort"><span>SORT: ${sortBy === 'rank' ? 'RANK' : 'SUIT'}</span></button>
    <button class="btn sm ${showLevels ? 'on' : ''}" data-act="levels"><span>HAND LEVELS</span></button>
    <span class="dim deck">DECK ${v.deckLeft}</span>
  </div>
  ${showLevels ? levels(v) : ''}`;
}

function levels(v: GameView): string {
  return `<div class="levels">${v.levels.map((l) => `<div><span>${l.name}</span><span class="lv">LV ${l.level}</span><span class="chips">${l.chips}</span><span class="x">X</span><span class="mult">${l.mult}</span></div>`).join('')}</div>`;
}

function cashoutView(v: GameView): string {
  return `${runnerPanel(v)}
  <div class="cashout"><h2>BREACH HELD</h2><div class="lines">${v.cashout.map((l) => `<div>${l.replace(/\+(\d+)$/, '<b>+$1</b>')}</div>`).join('')}</div>
  <button class="btn volt" data-act="collect"><span>COLLECT</span></button></div>`;
}

function shopView(v: GameView): string {
  return `
  ${iceRow(v, true)}
  <div class="shop"><h2>THE SHOP</h2>
    <div class="offers">${v.offers.map((o, i) => `<div class="offer ${o.kind}"><b>${o.name}</b><div class="itxt">${o.text}</div><button class="btn volt sm" data-buy="${i}" ${o.cost <= v.credits ? '' : 'disabled'}><span>BUY ${o.cost}</span></button></div>`).join('') || '<div class="dim">SOLD OUT</div>'}</div>
    <div class="tools"><button class="btn sm" data-act="reroll" ${v.rerollCost <= v.credits ? '' : 'disabled'}><span>REROLL ${v.rerollCost}</span></button><button class="btn sm ${showLevels ? 'on' : ''}" data-act="levels"><span>HAND LEVELS</span></button></div>
    ${showLevels ? levels(v) : ''}
    <div class="actions"><button class="btn volt" data-act="next"><span>NEXT ROUND</span></button></div>
  </div>`;
}

function render(): void {
  const v = game.view();
  if (selIce !== null && !v.ice.some((i) => i.uid === selIce)) selIce = null;
  let body = '';
  if (v.phase === 'round' || anim) body = roundView(v);
  else if (v.phase === 'cashout') body = cashoutView(v);
  else if (v.phase === 'shop') body = shopView(v);
  else body = roundView(v);
  app.innerHTML = `${top(v)}${body}${note ? `<div class="note">${note}</div>` : ''}<div class="build">${__BUILD__} · SEED ${v.seed}</div>
  ${v.phase === 'over' && !anim ? `<div class="over"><div><b class="${v.won ? 'good' : 'bad'}">${v.won ? 'THE SERVER HOLDS' : 'BREACHED'}</b><span>ANTE ${v.ante} · ROUND ${v.roundInAnte}</span><span class="dim">${v.won ? 'EVERY RUNNER STOPPED.' : `${fmt(v.score)} OF ${fmt(v.runner.target)}`}</span><button class="btn volt" data-act="again"><span>NEW RUN</span></button></div></div>` : ''}`;
}

function playback(s: Scored, scoreBefore: number): void {
  anim = { s, shown: 0, scoreBefore };
  const fast = params.has('fast');
  const tick = () => {
    if (!anim) return;
    if (anim.shown < s.steps.length) { anim.shown++; render(); setTimeout(tick, fast ? 0 : anim.shown === 1 ? 500 : 320); return; }
    anim.scoreBefore += s.total; render();
    setTimeout(() => { anim = null; render(); }, fast ? 0 : 650);
  };
  tick();
}

app.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-act],[data-card],[data-ice],[data-move],[data-buy],[data-sell]');
  if (!el || anim || (el as HTMLButtonElement).disabled) return;
  note = '';
  const d = el.dataset;
  let err: string | null = null;
  if (d.move) { const [u, dir] = d.move.split(':').map(Number); err = game.move(u, dir as -1 | 1); }
  else if (d.sell) err = game.sell(Number(d.sell));
  else if (d.card) { const id = Number(d.card); picked = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < RULES.maxPlay ? [...picked, id] : picked; }
  else if (d.ice) { const u = Number(d.ice); selIce = selIce === u ? null : u; }
  else if (d.buy) err = game.buy(Number(d.buy));
  else switch (d.act) {
    case 'play': {
      const before = game.score;
      err = game.play(picked);
      if (!err) { picked = []; playback(game.last!, before); return; }
      break;
    }
    case 'discard': err = game.discard(picked); if (!err) picked = []; break;
    case 'sort': sortBy = sortBy === 'rank' ? 'suit' : 'rank'; break;
    case 'levels': showLevels = !showLevels; break;
    case 'collect': err = game.collect(); break;
    case 'reroll': err = game.reroll(); break;
    case 'next': err = game.nextRound(); selIce = null; break;
    case 'again': game = new Game((Date.now() % 1_000_000) + 1); picked = []; selIce = null; break;
  }
  if (err) note = err;
  render();
});

declare global { interface Window { __breach: Game; __render: () => void } }
Object.defineProperty(window, '__breach', { get: () => game });
window.__render = render;
render();
