// The Corp's screen. Reads Game views, calls Game commands; the Runner's turn plays back event by event.
import type { Card, GameView, PokerCard, RemoteId, RunnerEvent, ServerId, ServerView, Suit } from './engine/api';
import { AGENDA_BY_ID, BREAKER_NAME, HAND_NAME, ICE, ICE_BY_ID, RULES, SUIT_NAME } from './engine/content';
import { Game, serverName } from './engine/game';
import { AGENDA_GLYPH, ICE_GLYPH, SUIT_GLYPH } from './glyphs';

type Sel = { kind: 'hand'; id: number } | { kind: 'ice'; def: string } | { kind: 'rcard'; remote: RemoteId; id: number } | { kind: 'remote'; remote: RemoteId } | null;

const params = new URLSearchParams(location.search);
let game = new Game(Number(params.get('seed')) || (Date.now() % 1_000_000));
let sel: Sel = null;
let note = '';
let noteHot = false;
let showRules = false;
/** Runner playback: events shown so far, and the turn they belong to. */
let shown: RunnerEvent[] = [];
let playing = false;
let playedFor = -1;
let hit: ServerId | null = null;

const app = document.getElementById('app')!;
const RANK = (r: number) => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' } as Record<number, string>)[r] ?? String(r);
const red = (s: Suit) => s === 'h' || s === 'd';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function poker(c: PokerCard, extra = '', attrs = ''): string {
  return `<div class="card poker ${red(c.suit) ? 'red' : ''} ${extra}" ${attrs}><b>${RANK(c.rank)}</b><i>${SUIT_GLYPH[c.suit]}</i></div>`;
}
function agenda(def: string, extra = '', attrs = '', progress: string | null = null): string {
  const a = AGENDA_BY_ID[def];
  return `<div class="card agenda ${extra}" ${attrs}><span class="ag">${AGENDA_GLYPH}</span><b>${a.name}</b><em>${HAND_NAME[a.hand]}</em><span class="pts">${a.points} PT${a.points > 1 ? 'S' : ''}${progress ? ` <s>${progress}</s>` : ''}</span></div>`;
}
function handCard(c: Card, v: GameView): string {
  const on = sel?.kind === 'hand' && sel.id === c.id ? 'sel' : '';
  const attrs = `data-hand="${c.id}"`;
  const extra = `${on} ${v.phase === 'discard' ? 'drop' : ''}`;
  return c.kind === 'poker' ? poker(c, extra, attrs) : agenda(c.def, extra, attrs);
}

function iceChip(s: ServerView, i: ServerView['ice'][number]): string {
  const def = ICE_BY_ID[i.def];
  return `<div class="ice t-${i.type}"><span class="ig">${ICE_GLYPH[i.type]}</span><b>${i.name}</b><span class="str">${i.str}${i.bonus ? `<small>+${i.bonus}</small>` : ''}</span><span class="sg ${red(def.suit) ? 'red' : ''}">${s.id === 'hq' || s.id === 'rd' ? '' : SUIT_GLYPH[def.suit]}</span></div>`;
}

function server(s: ServerView, v: GameView): string {
  const targetable = (sel?.kind === 'hand' && s.id !== 'hq' && s.id !== 'rd' && s.exists) || (sel?.kind === 'ice' && s.exists);
  const ice = s.ice.length ? s.ice.map((i) => iceChip(s, i)).join('') : `<div class="noice">NO ICE</div>`;
  let body = '';
  if (s.id === 'hq') body = `<div class="pile"><b>${v.hq.length}</b> CARDS</div>`;
  else if (s.id === 'rd') body = `<div class="pile"><b>${v.rdCount}</b> CARDS</div><div class="pile dim">ARCHIVES ${v.archivesCount}</div>`;
  else {
    const cards = s.cards.map((c) => poker(c, sel?.kind === 'rcard' && sel.id === c.id ? 'sel' : '', `data-rcard="${s.id}:${c.id}"`)).join('');
    const empty = Array.from({ length: RULES.remoteCards - s.cards.length }, () => '<div class="card slot"></div>').join('');
    body = `${s.agenda ? agenda(s.agenda.def, `${s.scorable ? 'ready' : ''} ${sel?.kind === 'remote' && sel.remote === s.id ? 'sel' : ''}`, `data-ragenda="${s.id}"`, s.progress) : '<div class="card agenda none">NO AGENDA</div>'}<div class="hand5">${cards}${empty}</div>`;
    if (s.scorable && v.phase === 'corp') body += `<button class="btn volt sm" data-score="${s.id}"><span>SCORE</span></button>`;
    if (sel?.kind === 'rcard' && sel.remote === s.id && v.phase === 'corp') body += `<button class="btn hot sm" data-trash="${s.id}"><span>TRASH CARD</span></button>`;
    if ((sel?.kind === 'rcard' || sel?.kind === 'remote') && sel.remote === s.id && v.phase === 'corp') body += `<button class="btn hot sm" data-clear="${s.id}"><span>CLEAR REMOTE</span></button>`;
  }
  return `<section class="server ${s.id === 'hq' || s.id === 'rd' ? 'central' : 'remote'} ${targetable ? 'target' : ''} ${hit === s.id ? 'hit' : ''}" data-server="${s.id}">
    <header>${s.name}</header><div class="icestack">${ice}</div>${body}</section>`;
}

function newRemote(v: GameView): string {
  const any = v.servers.some((s) => !s.exists);
  if (!any) return '';
  const targetable = sel?.kind === 'hand';
  return `<section class="server remote new ${targetable ? 'target' : ''}" data-server="new"><header>NEW REMOTE</header><div class="newhint">${targetable ? 'TAP TO INSTALL HERE' : `${v.servers.filter((s) => !s.exists).length} LEFT`}</div></section>`;
}

function eventLine(e: RunnerEvent): string {
  switch (e.kind) {
    case 'turn': return `<li class="cap">RUNNER TURN ${e.turn}</li>`;
    case 'grow': return `<li>${BREAKER_NAME[e.breaker]} UPGRADED TO <b>${e.to}</b></li>`;
    case 'run': return `<li class="run">RUN ON <b>${serverName(e.server)}</b></li>`;
    case 'broken': return `<li class="dim">${BREAKER_NAME[e.breaker]} ${e.strength} BREAKS ${ICE_BY_ID[e.ice].name} (STR ${e.str})</li>`;
    case 'fired': return `<li class="good">${ICE_BY_ID[e.ice].name} HOLDS: STR ${e.str} vs ${BREAKER_NAME[e.breaker]} ${e.strength}. ${e.effect}</li>`;
    case 'steal': return `<li class="bad">STOLE <b>${AGENDA_BY_ID[e.agenda].name}</b> (${e.points} PT${e.points > 1 ? 'S' : ''})</li>`;
    case 'trash': return `<li class="bad">TRASHED ${RANK(e.card.rank)} OF ${SUIT_NAME[e.card.suit]}</li>`;
    case 'empty': return `<li class="dim">ACCESSED ${serverName(e.server)}: NOTHING</li>`;
    case 'over': return `<li class="${e.winner === 'corp' ? 'good' : 'bad'}">${e.winner === 'corp' ? 'CORP' : 'RUNNER'} WINS: ${e.why}</li>`;
  }
}

function hint(v: GameView): string {
  if (playing) return 'THE RUNNER IS MOVING';
  if (note) return note;
  if (v.phase === 'discard') return `HQ HOLDS ${v.hq.length}. TAP CARDS TO DISCARD DOWN TO ${v.hqMax}`;
  if (sel?.kind === 'hand') {
    const id = sel.id;
    const c = v.hq.find((x) => x.id === id);
    return c?.kind === 'agenda' ? 'TAP A REMOTE OR NEW REMOTE TO INSTALL THE AGENDA, OR DISCARD IT' : 'TAP A REMOTE OR NEW REMOTE TO INSTALL THE CARD, OR DISCARD IT (FREE)';
  }
  if (sel?.kind === 'ice') return `TAP A SERVER TO INSTALL ${ICE_BY_ID[sel.def].name}`;
  if (sel?.kind === 'rcard') return 'TRASH THE CARD, OR CLEAR THE REMOTE: CARDS TO ARCHIVES, AGENDA BACK TO HQ';
  if (sel?.kind === 'remote') return 'CLEAR THE REMOTE: CARDS TO ARCHIVES, AGENDA BACK TO HQ';
  if (v.clicks === 0) return 'NO CLICKS LEFT: END TURN';
  return 'TAP A CARD IN HQ, AN ICE, OR AN ACTION';
}

function render(): void {
  const v = game.view();
  const clickPips = Array.from({ length: RULES.clicks }, (_, i) => `<span class="pip ${i < v.clicks ? 'on' : ''}"></span>`).join('');
  const pts = (n: number, cls: string, goal: number) => Array.from({ length: goal }, (_, i) => `<span class="pip ${cls} ${i < n ? 'on' : ''}"></span>`).join('');
  const busy = playing || v.phase !== 'corp';
  const iceShelf = ICE.map((d) => `<button class="btn sm iceb ${sel?.kind === 'ice' && sel.def === d.id ? 'on' : ''}" data-ice="${d.id}" ${busy || v.clicks < 1 ? 'disabled' : ''}><span><i class="ig">${ICE_GLYPH[d.type]}</i>${d.name} <em>${d.cost}¢</em> <i class="sg ${red(d.suit) ? 'red' : ''}">${SUIT_GLYPH[d.suit]}</i></span></button>`).join('');
  const log = shown.length ? `<ul class="log">${shown.map(eventLine).join('')}</ul>` : `<ul class="log"><li class="dim">THE RUNNER HAS NOT MOVED YET</li></ul>`;
  const remotes = v.servers.filter((s) => s.id !== 'hq' && s.id !== 'rd' && s.exists);
  app.innerHTML = `
  <div class="top">
    <div class="brand"><b>CYBERDECK</b><span>// BREACH</span></div>
    <div class="stat"><span class="cap">CORP</span><span class="pips">${pts(v.corpPoints, 'corp', v.goal)}</span></div>
    <div class="stat"><span class="cap">RUNNER</span><span class="pips">${pts(v.runnerPoints, 'run', v.runnerGoal)}</span></div>
    <div class="stat"><span class="cap">CREDITS</span><b>${v.credits}¢</b></div>
    <div class="stat"><span class="cap">CLICKS</span><span class="pips">${clickPips}</span></div>
    <div class="stat"><span class="cap">TURN</span><b>${v.turn}</b></div>
    <span class="grow"></span>
    <button class="btn sm" data-rules><span>${showRules ? 'CLOSE' : 'RULES'}</span></button>
  </div>
  ${showRules ? rules() : ''}
  <div class="runner">
    <span class="cap">RUNNER RIG</span>
    <span>FRACTER <b>${v.runner.fracter}</b></span><span>DECODER <b>${v.runner.decoder}</b></span><span>KILLER <b>${v.runner.killer}</b></span>
    <span class="dim">${v.runner.runs} RUN${v.runner.runs === 1 ? '' : 'S'} NEXT TURN</span>
  </div>
  <div class="board">
    <div class="centrals">${v.servers.filter((s) => s.id === 'hq' || s.id === 'rd').map((s) => server(s, v)).join('')}</div>
    <div class="remotes">${remotes.map((s) => server(s, v)).join('')}${newRemote(v)}</div>
  </div>
  <div class="hint ${noteHot ? 'hot' : ''}">${esc(hint(v))}</div>
  <div class="hqrow"><span class="cap">HQ</span><div class="hand">${v.hq.map((c) => handCard(c, v)).join('')}</div></div>
  <div class="actions">
    <button class="btn" data-act="draw" ${busy || v.clicks < 1 ? 'disabled' : ''}><span>DRAW</span></button>
    <button class="btn" data-act="credit" ${busy || v.clicks < 1 ? 'disabled' : ''}><span>+1¢</span></button>
    ${sel?.kind === 'hand' && v.phase === 'corp' ? '<button class="btn hot" data-act="discard"><span>DISCARD</span></button>' : ''}
    <div class="shelf">${iceShelf}</div>
    <span class="grow"></span>
    <button class="btn ${v.clicks === 0 ? 'volt' : ''}" data-act="end" ${busy ? 'disabled' : ''}><span>END TURN</span></button>
  </div>
  ${log}
  <div class="build">${__BUILD__} · SEED ${v.seed}</div>
  ${v.phase === 'over' && !playing ? `<div class="over"><div><b class="${v.winner === 'corp' ? 'good' : 'bad'}">${v.winner === 'corp' ? 'CORP WINS' : 'RUNNER WINS'}</b><span>${esc(v.why)}</span><span class="dim">TURN ${v.turn} · SCORED ${v.corpPoints} · STOLEN ${v.runnerPoints}</span><button class="btn volt" data-act="new"><span>NEW GAME</span></button></div></div>` : ''}`;
}

function rules(): string {
  return `<div class="rules">
    <p><b>SCORE ${RULES.goal} AGENDA POINTS</b> before the Runner steals ${RULES.runnerGoal}.</p>
    <p>Install an agenda in a remote, then install poker cards with it. When the cards make the agenda's hand, SCORE it.</p>
    <p>${RULES.clicks} clicks a turn; the first is always a draw. Then: draw, +1¢, install a card, install ICE, score, trash a card from a remote, or clear a remote (cards to Archives, agenda back to HQ). Discarding from HQ is free.</p>
    <p>ICE on a remote gains +1 STR for every card of its suit there: RAMPART spades, CIPHER hearts, WATCHDOG clubs. Diamonds pay 1¢ each when you score.</p>
    <p>The Runner makes ${RULES.runsPerTurn} run${RULES.runsPerTurn === 1 ? '' : 's'} a turn at random targets and gets stronger every ${RULES.growEvery === 1 ? 'turn' : RULES.growEvery === 2 ? 'other turn' : `${RULES.growEvery} turns`}. Past your ICE it steals agendas from HQ, the top of R&amp;D, or a remote, or trashes a card from a remote.</p>
  </div>`;
}

function act(err: string | null, okNote = ''): void {
  note = err ?? okNote;
  noteHot = !!err;
  if (!err) sel = null;
  afterCommand();
}

/** After a command: if a Runner turn happened, play it back. */
function afterCommand(): void {
  const v = game.view();
  const t = v.events.find((e) => e.kind === 'turn');
  if (t && t.kind === 'turn' && t.turn !== playedFor) { playedFor = t.turn; play(v.events); return; }
  render();
}

function play(events: RunnerEvent[]): void {
  playing = true;
  shown = [];
  sel = null;
  let i = 0;
  const fast = params.has('fast');
  const tick = () => {
    if (i >= events.length) { playing = false; hit = null; render(); return; }
    const e = events[i++];
    shown.push(e);
    if ('server' in e) hit = e.server;
    render();
    setTimeout(tick, fast ? 0 : e.kind === 'run' ? 650 : 450);
  };
  tick();
}

app.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-act],[data-hand],[data-ice],[data-server],[data-score],[data-trash],[data-clear],[data-rcard],[data-ragenda],[data-rules]');
  if (playing) return;
  note = ''; noteHot = false;
  if (!el) { sel = null; render(); return; }
  const d = el.dataset;
  if (d.rules !== undefined) { showRules = !showRules; render(); return; }
  if (d.act === 'new') { game = new Game((Date.now() % 1_000_000) + 1); shown = []; playedFor = -1; sel = null; render(); return; }
  if (d.act === 'draw') return act(game.draw());
  if (d.act === 'credit') return act(game.credit());
  if (d.act === 'end') { sel = null; return act(game.endTurn()); }
  if (d.score) return act(game.score(d.score as RemoteId));
  if (d.clear) return act(game.clear(d.clear as RemoteId));
  if (d.act === 'discard') { if (sel?.kind === 'hand') return act(game.discard(sel.id)); return; }
  if (d.ragenda) {
    if (sel?.kind === 'hand') return act(game.install(sel.id, d.ragenda as RemoteId));
    sel = sel?.kind === 'remote' && sel.remote === d.ragenda ? null : { kind: 'remote', remote: d.ragenda as RemoteId };
    render(); return;
  }
  if (d.trash) { if (sel?.kind === 'rcard') return act(game.trash(sel.remote, sel.id)); return; }
  if (d.hand) {
    const id = Number(d.hand);
    if (game.phase === 'discard') return act(game.discard(id));
    sel = sel?.kind === 'hand' && sel.id === id ? null : { kind: 'hand', id };
    render(); return;
  }
  if (d.ice) { sel = sel?.kind === 'ice' && sel.def === d.ice ? null : { kind: 'ice', def: d.ice }; render(); return; }
  if (d.rcard) {
    const [remote, id] = d.rcard.split(':');
    if (sel?.kind === 'hand') return act(game.install(sel.id, remote as RemoteId));
    sel = sel?.kind === 'rcard' && sel.id === Number(id) ? null : { kind: 'rcard', remote: remote as RemoteId, id: Number(id) };
    render(); return;
  }
  if (d.server) {
    const s = d.server as ServerId | 'new';
    if (sel?.kind === 'hand') { if (s === 'hq' || s === 'rd') { note = 'CARDS GO INTO REMOTES'; noteHot = true; render(); return; } return act(game.install(sel.id, s)); }
    if (sel?.kind === 'ice') { if (s === 'new') { note = 'CREATE THE REMOTE FIRST: INSTALL A CARD'; noteHot = true; render(); return; } return act(game.installIce(sel.def, s)); }
    sel = null; render();
  }
});

declare global { interface Window { __breach: Game; __render: () => void } }
Object.defineProperty(window, '__breach', { get: () => game });
window.__render = render;
render();
