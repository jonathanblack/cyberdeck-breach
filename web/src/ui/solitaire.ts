// The SOLITAIRE round's screen (design §3).
import { isRed } from '../engine/cards';
import type { To } from '../engine/solitaire';
import { MAX_DRAW, OPS, Solitaire, solView } from '../engine/solitaire';
import { cardHtml, logHtml, top } from './common';

/** What the player has picked up: a series from a line (from face-up index k), or a pending card. */
type Sel = { line: number; k: number } | { pending: number } | null;

export function mountSolitaire(app: HTMLElement, seed: number): { game: () => Solitaire; render: () => void } {
  let g = new Solitaire(seed);
  let sel: Sel = null;
  let bottom: number[] = [];
  let note = '';
  let draw = 2;

  function render(): void {
    const v = solView(g);
    const seg: string[] = [];
    let n = 0;
    v.compartments.forEach((c, i) => { for (let k = 0; k < c; k++) { seg.push(`<span class="seg ${n < v.breach ? 'on' : ''} ${k === c - 1 ? 'end' : ''}" title="S${i + 1}"></span>`); n++; } });
    const picking = v.phase === 'pickline';
    const selLine = sel && 'line' in sel ? sel : null;
    const lines = v.lines.map((l, i) => {
      const cls = `${l.flooded ? 'dark' : ''} ${v.nextFlood === i ? 'next' : ''} ${(sel || picking) && !l.flooded ? 'droppable' : ''} ${v.picked.includes(i) ? 'picked' : ''}`;
      const water = Array.from({ length: l.compartments }, (_, k) => `<span class="cmp ${k < l.floodedComps ? 'wet' : ''}"></span>`).join('');
      const cards = l.flooded ? '<div class="darkmsg">FLOODED</div>' : `${l.down ? `<div class="down">${l.down}</div>` : ''}${l.up.map((c, k) => cardHtml(c, `stack ${selLine && selLine.line === i && k >= selLine.k ? 'sel' : ''}`, `data-up="${i}:${k}"`)).join('')}${l.empty ? '<div class="emptymsg">KING ONLY</div>' : ''}`;
      return `<div class="col ${cls}" data-line="${i}"><div class="ch"><span class="cap">S${i + 1}</span><span class="cmps">${water}</span></div>${cards}</div>`;
    }).join('');
    const vaults = v.vaults.map((vault, j) => {
      const t = vault[vault.length - 1];
      return `<div class="vault ${sel ? 'droppable' : ''} ${t ? (isRed(t.suit) ? 'redv' : 'blackv') : ''}" data-vault="${j}">${t ? cardHtml(t, 'mini') : '<span class="cap">ACE</span>'}<span class="cap">${vault.length}</span></div>`;
    }).join('');
    let action = '';
    switch (v.phase) {
      case 'turn':
        action = `<div class="prompt">MOVE CARDS FOR FREE (TAP A FACE-UP CARD TO PICK UP IT AND EVERYTHING BELOW IT), THEN ONE ACTION.</div>
        <div class="drawpick"><span class="cap">RECOVER</span>${Array.from({ length: MAX_DRAW }, (_, k) => `<button class="btn sm ${draw === k + 1 ? 'on' : ''}" data-draw="${k + 1}"><span>${k + 1}</span></button>`).join('')}
        <button class="btn volt" data-act="recover"><span>RECOVER ${draw}</span></button></div>
        <div class="ops">${v.hand.map((o) => `<button class="opcard" data-op="${o}"><b>${OPS[o].name}</b><span>${OPS[o].text}</span></button>`).join('') || '<span class="cap">NO OPERATIONS: FAILING A RECOVER EARNS ONE</span>'}</div>`;
        break;
      case 'place':
        action = `<div class="prompt">${v.pendingFrom === 'draw' ? 'PLACE EXACTLY ONE (TAP IT, THEN A LINE OR VAULT). THE REST ARE DISCARDED.' : `${v.pendingFrom === 'deck' ? 'PULL' : 'RESTORE'}: PICK ONE THAT FITS AND PLACE IT.`}</div>
        <div class="hand row">${v.pending.map((c, k) => cardHtml(c, `${sel && 'pending' in sel && sel.pending === k ? 'sel' : ''} ${g.canGoAnywhere(c) ? 'fits' : 'nofit'}`, `data-pending="${k}"`)).join('')}</div>`;
        break;
      case 'look':
        action = `<div class="prompt">LOOKAHEAD: TAP CARDS TO SEND THEM TO THE BOTTOM, THEN DONE. THE REST STAY ON TOP IN THIS ORDER.</div>
        <div class="hand row">${v.look.map((c) => cardHtml(c, bottom.includes(c.id) ? 'nofit' : '', `data-look="${c.id}"`)).join('')}</div>
        <div class="actions one"><button class="btn volt" data-act="lookdone"><span>DONE</span></button></div>`;
        break;
      case 'pickop':
        action = `<div class="prompt">${v.asking === 'plana' ? 'PLAN A: TAKE ANY OPERATION FROM THE PILE.' : 'PLAN B: TAKE ANY USED OPERATION.'}</div>
        <div class="ops">${v.pickOps.map((o) => `<button class="opcard" data-pickop="${o}"><b>${OPS[o].name}</b><span>${OPS[o].text}</span></button>`).join('')}</div>`;
        break;
      case 'pickline':
        action = `<div class="prompt">${OPS[v.asking!].name}: TAP ${v.asking === 'rebalance' ? `${v.picked.length ? 'A SECOND' : 'TWO'} LINES` : 'A LINE'}.</div>`;
        break;
      case 'pickcard':
        action = `<div class="prompt">REINDEX S${v.picked[0] + 1}: PICK THE CARD TO PUT FACE UP AT THE FRONT.</div>
        <div class="hand wrap">${v.pickCards.map((c) => cardHtml(c, '', `data-pickcard="${c.id}"`)).join('')}</div>`;
        break;
    }
    app.innerHTML = `${top([['TURN', String(v.turn)], ['SCORE', String(v.score)]])}
    <div class="breach"><div class="bh"><span class="cap">BREACH ${v.breach} / ${v.breachMax}</span><span class="cap">${v.nextFlood >= 0 ? `S${v.nextFlood + 1} TAKES THE NEXT STEP` : ''} · DECK ${v.deckCount} · DISCARDS ${v.discardCount}</span></div><div class="meter m12">${seg.join('')}</div></div>
    <div class="vaults">${vaults}</div>
    <div class="columns six">${lines}</div>
    ${action}
    ${note ? `<div class="note">${note}</div>` : ''}
    ${logHtml(v.log, 4)}
    ${v.phase === 'over' ? `<div class="over"><div><b class="${v.saved >= 26 ? 'good' : 'bad'}">${v.saved === 52 ? 'EVERY CARD IS SAFE' : 'THE LAST SERVER FLOODS'}</b><span>${v.saved} OF 52 SAVED · SCORE ${v.score}</span><span class="dim">SCORE: THE TOP CARD OF EACH VAULT, PLUS BREACH STEPS LEFT</span><button class="btn volt" data-act="again"><span>PLAY AGAIN</span></button><button class="btn sm" data-home><span>BACK TO THE START</span></button></div></div>` : ''}`;
  }

  app.onclick = (ev) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-up],[data-pending],[data-vault],[data-line],[data-act],[data-op],[data-draw],[data-look],[data-pickop],[data-pickcard]');
    if (!el) { if (sel) { sel = null; render(); } return; }
    if ((el as HTMLButtonElement).disabled) return;
    note = '';
    const d = el.dataset;
    let err: string | null = null;
    const phase = g.phase;
    const dropOn = (to: To): string | null => {
      if (!sel) return null;
      const r = 'pending' in sel ? g.place(sel.pending, to) : g.move(sel.line, sel.k, to);
      sel = null;
      return r;
    };
    if (phase === 'pickline' && (d.line !== undefined || d.up !== undefined)) err = g.pickLine(Number(d.line ?? d.up!.split(':')[0]));
    else if (d.up !== undefined) {
      const [i, k] = d.up.split(':').map(Number);
      if (sel && !('line' in sel && sel.line === i)) err = dropOn({ line: i });
      else if (sel && 'line' in sel && sel.line === i && sel.k === k) sel = null;
      else sel = { line: i, k };
    }
    else if (d.pending !== undefined) { const k = Number(d.pending); sel = sel && 'pending' in sel && sel.pending === k ? null : { pending: k }; }
    else if (d.vault !== undefined) err = dropOn({ vault: Number(d.vault) });
    else if (d.line !== undefined) err = dropOn({ line: Number(d.line) });
    else if (d.draw) draw = Number(d.draw);
    else if (d.op) err = g.playOp(d.op);
    else if (d.look) { const id = Number(d.look); bottom = bottom.includes(id) ? bottom.filter((x) => x !== id) : [...bottom, id]; }
    else if (d.pickop) err = g.pickOp(d.pickop);
    else if (d.pickcard) err = g.pickCard(Number(d.pickcard));
    else switch (d.act) {
      case 'recover': err = g.recover(draw); sel = null; break;
      case 'lookdone': err = g.lookDone(bottom); bottom = []; break;
      case 'again': g = new Solitaire((Date.now() % 1_000_000) + 1); sel = null; break;
    }
    if (err) note = err;
    render();
  };
  return { game: () => g, render };
}
