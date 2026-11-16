// The SOLITAIRE slice's screen (design §3).
import type { Suit } from '../engine/cards';
import { SUITS, isRed } from '../engine/cards';
import type { From, To } from '../engine/solitaire';
import { ICE_INFO, S_OPS, Solitaire, solView } from '../engine/solitaire';
import { SUIT_GLYPH } from '../glyphs';
import { cardHtml, logHtml, overHtml, shopHtml, top } from './common';

export function mountSolitaire(app: HTMLElement, seed: number): { game: () => Solitaire; render: () => void } {
  let g = new Solitaire(seed);
  let sel: From | null = null;
  let note = '';

  function render(): void {
    const v = solView(g);
    const isSel = (f: From) => sel !== null && JSON.stringify(sel) === JSON.stringify(f);
    const meter = Array.from({ length: v.breachMax }, (_, i) => `<span class="seg ${i < v.breach ? 'on' : ''} ${v.darkAt.includes(i + 1) ? 'mark' : ''}"></span>`).join('');
    const turnish = v.phase === 'turn' || v.phase === 'place';
    let body = `
    <div class="agenda"><div><span class="cap">SAVED</span><b>${v.score}</b><span class="dim"> / ${v.target}</span></div><div class="cap">TURN ${v.turn} · DECK ${v.deckCount}</div></div>
    <div class="breach"><div class="bh"><span class="cap">BREACH ${v.breach} / ${v.breachMax}</span><span class="cap">${v.nextToFall >= 0 ? `NEXT TO FALL: SERVER ${v.nextToFall + 1}` : 'ALL DARK'} · CREEPS AFTER TURN ${v.nextCreep}</span></div><div class="meter">${meter}</div></div>
    <div class="vaults">${SUITS.map((s) => {
      const top = v.vaults[s][v.vaults[s].length - 1];
      return `<div class="vault ${sel ? 'droppable' : ''}" data-vault="${s}"><span class="vs ${isRed(s) ? 'red' : ''}">${SUIT_GLYPH[s]}</span>${top ? cardHtml(top, 'mini') : '<span class="cap">ACE</span>'}<span class="cap">${v.vaults[s].length}</span></div>`;
    }).join('')}</div>
    <div class="columns">${v.servers.map((s, i) => `
      <div class="col ${s.dark ? 'dark' : ''} ${v.nextToFall === i ? 'next' : ''} ${(sel && !s.dark) || (v.phase === 'setup' && v.unplaced.length) ? 'droppable' : ''}" data-col="${i}">
        <div class="ch"><span class="cap">S${i + 1}</span>${s.ice ? `<span class="iceb">${ICE_INFO[s.ice].name}</span>` : ''}</div>
        ${s.dark ? '<div class="darkmsg">DARK</div>' : s.cards.map((c, k) => cardHtml(c, `stack ${k === s.cards.length - 1 && isSel({ server: i }) ? 'sel' : ''}`, k === s.cards.length - 1 ? `data-top="${i}"` : '')).join('')}
      </div>`).join('')}</div>`;
    if (v.phase === 'setup') {
      body += `<div class="prompt">${v.unplaced.length ? `PLACE YOUR ${ICE_INFO[v.unplaced[0]].name}: TAP A SERVER. <span class="dim">${ICE_INFO[v.unplaced[0]].text}</span>` : 'ICE PLACED.'}</div>
      <div class="actions one"><button class="btn volt" data-act="begin"><span>BEGIN</span></button></div>`;
    }
    if (v.phase === 'place') {
      body += v.searching
        ? `<div class="prompt">DEEP SEARCH: TAKE ANY CARD.</div><div class="hand wrap search">${v.deck.map((c) => cardHtml(c, 'mini', `data-search="${c.id}"`)).join('')}</div>`
        : `<div class="prompt">RECOVERED: PLACE ONE (TAP IT, THEN A VAULT OR SERVER). THE REST GO UNDER THE DECK.</div>
        <div class="hand row">${v.row.map((c, k) => cardHtml(c, isSel({ row: k }) ? 'sel' : '', `data-row="${k}"`)).join('')}</div>
        <div class="actions one"><button class="btn hot" data-act="none"><span>NONE FITS: THE BREACH SPREADS</span></button></div>`;
    }
    if (v.phase === 'turn') {
      body += `<div class="prompt">MOVE SERVER TOPS FOR FREE, THEN ONE ACTION.</div>
      <div class="actions"><button class="btn volt" data-act="recover"><span>RECOVER ${v.revealCount}</span></button><button class="btn sm" data-act="lock"><span>LOCK DOWN</span></button></div>
      <div class="ops">${v.opsLeft.map((o) => `<button class="btn sm opb" data-op="${o}"><span>${S_OPS[o].name}</span></button>`).join('')}</div>
      ${v.opsLeft.length ? `<div class="hint">${v.opsLeft.map((o) => `${S_OPS[o].name}: ${S_OPS[o].text}`).join(' · ')}</div>` : ''}`;
    }
    if (turnish && v.execs.length) body += `<div class="owned cap">EXECUTIVES: ${v.execs.map((e) => e.name).join(', ')}</div>`;
    body += `${note ? `<div class="note">${note}</div>` : ''}${logHtml(v.log)}`;
    if (v.phase === 'shop') body = shopHtml(v.credits, v.offers, v.execs.length ? `<div class="owned cap">EXECUTIVES: ${v.execs.map((e) => e.name).join(', ')}</div>` : '') + logHtml(v.log, 2);
    app.innerHTML = `${top([['ROUND', `${v.round} / ${v.rounds}`], ['CREDITS', String(v.credits)]])}${body}
      ${v.phase === 'over' ? overHtml(!!v.won, v.won ? 'THE DATA IS SAFE' : 'THE BREACH WINS', `${v.score} OF ${v.target} SAVED IN ROUND ${v.round}`) : ''}`;
  }

  const target = (d: DOMStringMap): To | null => (d.vault ? { vault: d.vault as Suit } : d.col !== undefined ? { server: Number(d.col) } : null);

  app.onclick = (ev) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-top],[data-row],[data-vault],[data-col],[data-act],[data-op],[data-buy],[data-search]');
    if (!el && sel) { sel = null; render(); return; }
    if (!el || (el as HTMLButtonElement).disabled) return;
    note = '';
    const d = el.dataset;
    let err: string | null = null;
    const v = solView(g);
    if (d.top !== undefined && v.phase !== 'setup') {
      const f: From = { server: Number(d.top) };
      if (sel && JSON.stringify(sel) !== JSON.stringify(f)) { err = g.move(sel, { server: Number(d.top) }); sel = null; }
      else sel = sel ? null : f;
    } else if (d.row !== undefined) { const f: From = { row: Number(d.row) }; sel = sel && 'row' in sel && sel.row === f.row ? null : f; }
    else if (d.search) err = g.search(Number(d.search));
    else if (d.buy) err = g.buy(d.buy);
    else if (d.op) err = g.playOp(d.op);
    else if (d.act) switch (d.act) {
      case 'begin': err = g.begin(); break;
      case 'recover': err = g.recover(); sel = null; break;
      case 'none': err = g.noneFits(); sel = null; break;
      case 'lock': err = g.lockDown(); break;
      case 'next': err = g.nextRound(); break;
      case 'again': g = new Solitaire((Date.now() % 1_000_000) + 1); sel = null; break;
    }
    else {
      const to = target(d);
      if (to && v.phase === 'setup' && 'server' in to) err = g.placeIce(to.server);
      else if (to && sel) { err = g.move(sel, to); sel = null; }
    }
    if (err) note = err;
    render();
  };
  return { game: () => g, render };
}
