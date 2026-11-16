// The Corp's table. Reads Game views, calls Game commands.
import type { Card, GameView, HandView, Suit } from './engine/api';
import { PASSIVE_PICKS } from './engine/content';
import { Game } from './engine/game';
import { ICE_GLYPH, SUIT_GLYPH } from './glyphs';

const params = new URLSearchParams(location.search);
let game = new Game(Number(params.get('seed')) || (Date.now() % 1_000_000));
let picks: string[] = [];
let note = '';
/** Card ids already drawn, so new ones can animate in. */
let seen = new Set<number>();

const app = document.getElementById('app')!;
const RANK = (r: number) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' } as Record<number, string>)[r] ?? String(r);
const red = (s: Suit) => s === 'h' || s === 'd';

function card(c: Card, extra = ''): string {
  const fresh = seen.has(c.id) ? '' : 'fresh';
  return `<div class="card ${red(c.suit) ? 'red' : ''} ${fresh} ${extra}"><b>${RANK(c.rank)}</b><i>${SUIT_GLYPH[c.suit]}</i></div>`;
}
const mini = (c: Card | undefined) => (c ? `<span class="mini ${red(c.suit) ? 'red' : ''}"><b>${RANK(c.rank)}</b><i>${SUIT_GLYPH[c.suit]}</i></span>` : '<span class="mini">-</span>');
const totalText = (h: HandView) => (h.cards.length ? `${h.soft && !h.bust ? 'SOFT ' : ''}${h.total}${h.bust ? ' BUST' : h.natural ? ' BLACKJACK' : ''}` : '');

function loadout(v: GameView): string {
  return `<div class="loadout">
    <p class="lead">A Runner has hacked your blackjack table and is counting cards to drain the house. You deal. Your ICE bends the table.</p>
    <p class="cap">THE RUNNER WINS AT ${v.target} FROM ${v.startBankroll}. YOU HOLD FOR ${v.hands} HANDS.</p>
    <h2>CHARGED ICE</h2>
    <div class="icelist">${v.ice.map((i) => `<div class="iceinfo"><span class="ig">${ICE_GLYPH[i.id]}</span><b>${i.name}</b><span class="charges">${i.max}x</span><span class="t">${i.text}</span></div>`).join('')}</div>
    <h2>PICK ${PASSIVE_PICKS} PASSIVE ICE</h2>
    <div class="passpick">${v.passives.map((p) => `<button class="pass ${picks.includes(p.id) ? 'on' : ''}" data-pick="${p.id}"><b>${p.name}</b><span>${p.text}</span></button>`).join('')}</div>
    <button class="btn volt big" data-act="start" ${picks.length === PASSIVE_PICKS ? '' : 'disabled'}><span>SIT THE RUNNER DOWN</span></button>
  </div>`;
}

function controls(v: GameView): string {
  const btn = (act: string, label: string, cls = '', on = true) => `<button class="btn ${cls}" data-act="${act}" ${on ? '' : 'disabled'}><span>${label}</span></button>`;
  const second = v.ice.find((i) => i.id === 'second')!;
  switch (v.phase) {
    case 'bet':
      return `<div class="prompt">THE RUNNER BETS <b>${v.bet}</b>. RESHUFFLE OR VOID NOW, OR DEAL.</div>
        <div class="row">${btn('deal', 'DEAL', 'volt big')}</div>`;
    case 'deal':
      return `<div class="prompt">NEXT CARD TO THE <b>${v.dealTo === 'runner' ? 'RUNNER' : 'DEALER'}</b></div>
        <div class="row">${btn('deal', `DEAL ${mini(v.next[0])}`, 'volt big')}${btn('second', `SECOND DEAL ${mini(v.next[1])} <em>${second.charges}</em>`, 'hot big', second.usable)}</div>`;
    case 'hole':
      const swap = v.ice.find((i) => i.id === 'swap')!;
      return `<div class="prompt">THE RUNNER IS DONE. THE DEALER PLAYS NEXT.</div>
        <div class="row">${btn('reveal', 'REVEAL', 'volt big')}${btn('swap', `HOLE SWAP ${mini(v.dealer.cards[1])} FOR ${mini(v.next[0])} <em>${swap.charges}</em>`, 'hot big', swap.usable)}</div>`;
    case 'settled': {
      const r = v.result!;
      const word = { win: 'RUNNER WINS', blackjack: 'RUNNER BLACKJACK', lose: 'HOUSE WINS', bust: 'RUNNER BUSTS', push: 'PUSH', void: 'VOIDED' }[r.outcome];
      const cls = r.delta > 0 ? 'bad' : r.delta < 0 ? 'good' : 'dim';
      return `<div class="prompt result ${cls}">${word} <b>${r.delta > 0 ? '+' : ''}${r.delta}</b></div><div class="row">${btn('next', 'NEXT HAND', 'volt big')}</div>`;
    }
    default: return '';
  }
}

function render(): void {
  const v = game.view();
  if (v.phase === 'loadout') { app.innerHTML = `${top(v)}${loadout(v)}`; return; }
  const pct = (x: number) => Math.max(0, Math.min(100, (100 * x) / v.target));
  const rack = v.ice.map((i) => {
    const pips = Array.from({ length: i.max }, (_, k) => `<span class="pip ${k < i.charges ? 'on' : ''}"></span>`).join('');
    const clickable = i.id === 'reshuffle' || i.id === 'void';
    return `<button class="ice ${i.usable ? 'ready' : ''}" ${clickable ? `data-act="${i.id}"` : ''} ${clickable && i.usable ? '' : 'disabled'}><span class="ig">${ICE_GLYPH[i.id]}</span><b>${i.name}</b><span class="pips">${pips}</span></button>`;
  }).join('');
  app.innerHTML = `
  ${top(v)}
  <div class="bank">
    <div class="bar"><span class="fill" style="width:${pct(v.bankroll)}%"></span><span class="start" style="left:${pct(v.startBankroll)}%"></span></div>
    <div class="banknums"><span>RUNNER <b>${v.bankroll}</b></span><span class="dim">BREACH AT ${v.target}</span></div>
  </div>
  <div class="intel"><span class="cap">RUNNER INTEL</span><span>COUNT <b>${v.count >= 0 ? '+' : ''}${v.count}</b></span><span>TRUE <b>${v.trueCount >= 0 ? '+' : ''}${v.trueCount.toFixed(1)}</b></span><span>BET <b>${v.bet}${v.doubled ? ' x2' : ''}</b></span></div>
  <div class="table">
    <div class="seat dealer"><span class="cap">DEALER</span><div class="cards">${v.dealer.cards.map((c, i) => card(c, i === 1 && v.holeHidden ? 'hole' : '')).join('')}</div><span class="tot">${totalText(v.dealer)}${v.holeHidden ? ' <small>RUNNER SEES ' + mini(v.dealer.cards[0]) + '</small>' : ''}</span></div>
    <div class="seat runner ${v.dealTo === 'runner' ? 'to' : ''}"><span class="cap">RUNNER</span><div class="cards">${v.runner.cards.map((c) => card(c)).join('')}</div><span class="tot">${totalText(v.runner)}</span></div>
    <div class="shoe"><span class="cap">SHOE ${v.shoeLeft}</span><span>NEXT ${mini(v.next[0])} THEN ${mini(v.next[1])}</span></div>
  </div>
  <div class="controls">${controls(v)}</div>
  ${note ? `<div class="note">${note}</div>` : ''}
  <div class="rack">${rack}</div>
  <div class="passives">${v.passives.filter((p) => p.on).map((p) => `<span class="pchip"><b>${p.name}</b> ${p.text}</span>`).join('')}</div>
  <ul class="log">${v.log.map((l) => `<li>${l}</li>`).join('')}</ul>
  <div class="build">${__BUILD__} · SEED ${v.seed}</div>
  ${v.phase === 'over' ? `<div class="over"><div><b class="${v.winner === 'house' ? 'good' : 'bad'}">${v.winner === 'house' ? 'THE HOUSE HOLDS' : 'BREACHED'}</b><span>${v.why}</span><span class="dim">${v.hand} HANDS · RUNNER ${v.bankroll}</span><button class="btn volt big" data-act="again"><span>NEW BREACH</span></button></div></div>` : ''}`;
  for (const c of [...v.runner.cards, ...v.dealer.cards]) seen.add(c.id);
}

function top(v: GameView): string {
  return `<div class="top"><div class="brand"><b>CYBERDECK</b><span>// BREACH</span></div>${v.phase === 'loadout' ? '' : `<div class="stat"><span class="cap">HAND</span><b>${v.hand} / ${v.hands}</b></div>`}</div>`;
}

app.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-act],[data-pick]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  note = '';
  const d = el.dataset;
  if (d.pick) { picks = picks.includes(d.pick) ? picks.filter((p) => p !== d.pick) : [...picks, d.pick].slice(-PASSIVE_PICKS); render(); return; }
  const err = (() => {
    switch (d.act) {
      case 'start': return game.choosePassives(picks);
      case 'deal': return game.deal(false);
      case 'second': return game.deal(true);
      case 'reshuffle': return game.reshuffle();
      case 'void': return game.void();
      case 'swap': return game.swap();
      case 'reveal': return game.reveal();
      case 'next': return game.next();
      case 'again': game = new Game((Date.now() % 1_000_000) + 1); seen = new Set(); return game.choosePassives(picks);
    }
    return null;
  })();
  if (err) note = err;
  render();
});

declare global { interface Window { __breach: Game; __render: () => void } }
Object.defineProperty(window, '__breach', { get: () => game });
window.__render = render;
render();
