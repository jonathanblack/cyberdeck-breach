// The Corp's screen: the round (server, hand, play), the breach, the Boardroom. Reads Game views, calls Game commands.
import type { BreachStep, Card, GameView, IceView, Suit } from './engine/api';
import { RULES } from './engine/content';
import { Game } from './engine/game';
import { CHEVRON, SUIT_GLYPH, TYPE_GLYPH } from './glyphs';

const params = new URLSearchParams(location.search);
let game = new Game(Number(params.get('seed')) || (Date.now() % 1_000_000));
let picked: number[] = [];
let target: number | null = null;
let note = '';
/** Breach playback: how many steps are shown. */
let shownSteps = 0;
let playing = false;

const app = document.getElementById('app')!;
const RANK = (r: number) => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' } as Record<number, string>)[r] ?? String(r);
const red = (s: Suit) => s === 'h' || s === 'd';
const pips = (n: number, of: number, cls: string) => Array.from({ length: of }, (_, i) => `<span class="pip ${cls} ${i < n ? 'on' : ''}"></span>`).join('');

function cardHtml(c: Card, scoring: Set<number>): string {
  const on = picked.includes(c.id);
  return `<button class="card ${red(c.suit) ? 'red' : ''} ${on ? 'sel' : ''} ${on && scoring.has(c.id) ? 'scores' : ''}" data-card="${c.id}"><b>${RANK(c.rank)}</b><i>${SUIT_GLYPH[c.suit]}</i></button>`;
}

function iceHtml(i: IceView, k: number, n: number, v: GameView, step?: BreachStep): string {
  const isTarget = target === i.uid && v.phase === 'round';
  const pos = k === 0 ? 'OUTERMOST' : k === n - 1 ? 'INNERMOST' : '';
  const shown = step ?? v.projection?.steps.find((s) => s.uid === i.uid);
  const finalStr = shown ? shown.str : i.str;
  return `<div class="ice t-${i.type.replace(' ', '')} ${isTarget ? 'target' : ''} ${i.playable ? '' : 'noplay'}" data-ice="${i.uid}">
    <div class="ih"><span class="tg">${TYPE_GLYPH[i.type]}</span><b>${i.name}</b>${i.level ? `<span class="lv">L${i.level}</span>` : ''}</div>
    <div class="str">${finalStr}${shown && shown.str !== i.str ? `<small>${i.str}</small>` : ''}</div>
    ${shown?.note ? `<div class="mod">${shown.note}</div>` : ''}
    <div class="txt">${i.text}</div>
    <div class="pos">${pos}</div>
    ${v.phase === 'round' && n > 1 ? `<div class="mv"><button data-move="${i.uid}:-1" ${k === 0 ? 'disabled' : ''}>${CHEVRON.left}</button><button data-move="${i.uid}:1" ${k === n - 1 ? 'disabled' : ''}>${CHEVRON.right}</button></div>` : ''}
  </div>`;
}

function header(v: GameView): string {
  const threat = v.phase === 'board' ? '' : `<div class="threat">
    <div class="rn"><span class="cap">${v.runner.faction}</span><b>${v.runner.name}</b></div>
    <div class="bn"><span class="cap">BREACH</span><b>${v.runner.breach ?? '???'}</b></div>
    <div class="ag"><span class="cap">AGENDA</span><b>${v.agenda.name}</b><span>${v.agenda.points} PT${v.agenda.points > 1 ? 'S' : ''}</span></div>
    <div class="tw">${v.runner.twist}</div>
  </div>`;
  return `<div class="top">
    <div class="brand"><b>CYBERDECK</b><span>// BREACH</span></div>
    <div class="stat"><span class="cap">CORP</span><span class="pips">${pips(v.corpPoints, v.goal, 'corp')}</span></div>
    <div class="stat"><span class="cap">RUNNER</span><span class="pips">${pips(v.runnerPoints, v.goal, 'run')}</span></div>
    <div class="stat"><span class="cap">CREDITS</span><b>${v.credits}¢</b></div>
    <div class="stat"><span class="cap">ROUND</span><b>${v.round}</b></div>
  </div>${threat}`;
}

function roundView(v: GameView): string {
  const scoring = new Set<number>();
  let previewLine = 'PICK UP TO 5 CARDS, THEN AN ICE TO PLAY THEM ON';
  if (picked.length && target !== null) {
    const p = game.preview(picked, target);
    if (typeof p === 'string') previewLine = p;
    else { p.scoring.forEach((id) => scoring.add(id)); previewLine = `${p.detail} &gt; <b>+${p.str}</b> TO ${v.server.find((s) => s.uid === target)!.name}`; }
  } else if (picked.length) previewLine = 'NOW TAP AN ICE';
  const proj = v.projection;
  const projLine = proj ? (proj.held ? `<span class="good">HOLDS NOW</span> with ${proj.steps.reduce((s, x) => s + Math.max(0, x.str), 0) - proj.start} to spare` : `<span class="bad">${proj.through} GETS THROUGH</span> if it breached now`) : 'BREACH NUMBER HIDDEN UNTIL 2 HANDS ARE PLAYED';
  return `
  <div class="serverhead"><span class="cap">YOUR SERVER: THE RUNNER HITS LEFT TO RIGHT</span><span class="proj">${projLine}</span></div>
  <div class="server">${v.server.map((i, k) => iceHtml(i, k, v.server.length, v)).join('')}</div>
  ${target !== null ? `<div class="targetinfo"><b>${v.server.find((s) => s.uid === target)!.name}</b> ${v.server.find((s) => s.uid === target)!.text}</div>` : ''}
  <div class="preview">${previewLine}</div>
  <div class="hand">${v.hand.map((c) => cardHtml(c, scoring)).join('')}</div>
  <div class="actions">
    <button class="btn volt" data-act="play" ${picked.length && target !== null && v.hands > 0 ? '' : 'disabled'}><span>PLAY <em>${v.hands}</em></span></button>
    <button class="btn" data-act="discard" ${picked.length && v.discards > 0 ? '' : 'disabled'}><span>DISCARD <em>${v.discards}</em></span></button>
    <button class="btn hot" data-act="breach"><span>${v.hands > 0 ? 'BREACH NOW' : 'COMMIT: BREACH'}</span></button>
  </div>
  <ul class="log">${v.log.slice(-4).map((l) => `<li>${l}</li>`).join('') || '<li class="dim">PLAY HANDS ONTO YOUR ICE TO CHARGE IT. ORDER IT. THEN LET THE RUNNER IN.</li>'}</ul>`;
}

function breachView(v: GameView): string {
  const b = v.breach!;
  const steps = b.steps.slice(0, shownSteps);
  const done = shownSteps >= b.steps.length;
  const left = steps.length ? steps[steps.length - 1].left : b.start;
  return `
  <div class="breachbig"><span class="cap">BREACH</span><b class="${done ? (b.held ? 'good' : 'bad') : ''}">${left}</b><span class="dim">OF ${b.start}</span></div>
  <div class="server">${v.server.map((i, k) => {
    const st = b.steps.find((s) => s.uid === i.uid)!;
    const idx = b.steps.indexOf(st);
    return `<div class="layer ${idx < shownSteps ? 'hit' : ''}">${iceHtml(i, k, v.server.length, v, st)}${idx < shownSteps ? `<div class="abs">-${st.absorbed}</div>` : ''}</div>`;
  }).join('')}</div>
  ${done ? `<div class="verdict ${b.held ? 'good' : 'bad'}">${b.held ? `HELD. ${v.agenda.name} SCORES ${v.agenda.points}.` : `BREACHED. ${b.through} GOT THROUGH. ${v.runner.name} STEALS ${v.agenda.name}.`}</div>
  <div class="actions"><button class="btn volt" data-act="next"><span>${v.winner ? 'SEE THE RUN' : 'TO THE BOARDROOM'}</span></button></div>` : ''}`;
}

function boardView(v: GameView): string {
  const installedN = v.owned.filter((o) => o.installed).length;
  return `
  <div class="board">
    <h2>THE BOARDROOM</h2>
    <div class="payout">${v.payout.map((p) => `<span>${p}</span>`).join('')}</div>
    <h3>ON OFFER</h3>
    <div class="offers">${v.offers.map((o) => `<div class="offer t-${o.type.replace(' ', '')}"><div class="ih"><span class="tg">${TYPE_GLYPH[o.type]}</span><b>${o.name}</b></div><div class="txt">${o.text}</div><button class="btn volt sm" data-buy="${o.id}" ${o.cost <= v.credits ? '' : 'disabled'}><span>BUY ${o.cost}¢</span></button></div>`).join('') || '<div class="dim">NOTHING LEFT</div>'}</div>
    <div class="row2">
      <button class="btn sm" data-act="reroll" ${v.rerollCost <= v.credits ? '' : 'disabled'}><span>REROLL ${v.rerollCost}¢</span></button>
      ${v.slotCost !== null ? `<button class="btn sm" data-act="slot" ${v.slotCost <= v.credits ? '' : 'disabled'}><span>+1 SLOT ${v.slotCost}¢</span></button>` : ''}
    </div>
    <h3>YOUR ICE <span class="dim">${installedN} / ${v.slots} INSTALLED</span></h3>
    <div class="owned">${v.owned.map((o) => `<div class="own ${o.installed ? 'on' : ''} t-${o.type.replace(' ', '')}">
      <div class="ih"><span class="tg">${TYPE_GLYPH[o.type]}</span><b>${o.name}</b>${o.level ? `<span class="lv">L${o.level}</span>` : ''}</div>
      <div class="txt">${o.text}</div>
      <div class="ownbtns">
        <button class="btn sm ${o.installed ? 'on' : ''}" data-toggle="${o.uid}"><span>${o.installed ? 'INSTALLED' : 'INSTALL'}</span></button>
        ${o.playable ? `<button class="btn sm" data-upgrade="${o.uid}" ${o.upgradeCost <= v.credits ? '' : 'disabled'}><span>UPGRADE ${o.upgradeCost}¢</span></button>` : ''}
        <button class="btn sm" data-sell="${o.uid}"><span>SELL ${Math.floor(o.cost / 2)}¢</span></button>
      </div></div>`).join('')}</div>
    <div class="actions"><button class="btn volt" data-act="round"><span>NEXT ROUND</span></button></div>
  </div>`;
}

function render(): void {
  const v = game.view();
  if (target !== null && !v.server.some((s) => s.uid === target && s.playable)) target = null;
  if (target === null && v.phase === 'round') target = v.server.find((s) => s.playable)?.uid ?? null;
  let body = '';
  if (v.phase === 'round') body = roundView(v);
  else if (v.phase === 'breach') body = breachView(v);
  else if (v.phase === 'board') body = boardView(v);
  else body = breachView({ ...v, phase: 'breach' }).replace(/<div class="actions">[\s\S]*$/, '');
  app.innerHTML = `${header(v)}${body}${note ? `<div class="note">${note}</div>` : ''}<div class="build">${__BUILD__} · SEED ${v.seed}</div>
  ${v.phase === 'over' ? `<div class="over"><div><b class="${v.winner === 'corp' ? 'good' : 'bad'}">${v.winner === 'corp' ? 'THE CORP PREVAILS' : 'THE RUNNERS WIN'}</b><span>${v.corpPoints} SCORED · ${v.runnerPoints} STOLEN · ${v.round} ROUNDS</span><button class="btn volt" data-act="again"><span>NEW RUN</span></button></div></div>` : ''}`;
}

function playBreach(): void {
  const steps = game.view().breach?.steps.length ?? 0;
  playing = true; shownSteps = 0;
  const fast = params.has('fast');
  const tick = () => {
    render();
    if (shownSteps >= steps) { playing = false; return; }
    shownSteps++;
    setTimeout(tick, fast ? 0 : 650);
  };
  setTimeout(tick, fast ? 0 : 300);
}

app.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-act],[data-card],[data-ice],[data-move],[data-buy],[data-toggle],[data-upgrade],[data-sell]');
  if (!el || playing || (el as HTMLButtonElement).disabled) return;
  note = '';
  const d = el.dataset;
  let err: string | null = null;
  if (d.move) { const [u, dir] = d.move.split(':').map(Number); err = game.move(u, dir as -1 | 1); }
  else if (d.card) { const id = Number(d.card); picked = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < RULES.maxPlay ? [...picked, id] : picked; }
  else if (d.ice) { const u = Number(d.ice); if (game.view().server.find((s) => s.uid === u)?.playable) target = u; else note = 'HUSK CANNOT BE PLAYED ON'; }
  else if (d.buy) err = game.buy(d.buy);
  else if (d.toggle) err = game.toggle(Number(d.toggle));
  else if (d.upgrade) err = game.upgrade(Number(d.upgrade));
  else if (d.sell) err = game.sell(Number(d.sell));
  else switch (d.act) {
    case 'play': err = game.play(picked, target!); if (!err) picked = []; break;
    case 'discard': err = game.discard(picked); if (!err) picked = []; break;
    case 'breach': err = game.breachNow(); if (!err) { picked = []; playBreach(); return; } break;
    case 'next': err = game.next(); break;
    case 'reroll': err = game.reroll(); break;
    case 'slot': err = game.buySlot(); break;
    case 'round': err = game.nextRound(); target = null; break;
    case 'again': game = new Game((Date.now() % 1_000_000) + 1); picked = []; target = null; break;
  }
  if (err) note = err;
  render();
});

declare global { interface Window { __breach: Game; __render: () => void } }
Object.defineProperty(window, '__breach', { get: () => game });
window.__render = render;
render();
