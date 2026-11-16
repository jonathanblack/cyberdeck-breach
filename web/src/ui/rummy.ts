// The RUMMY slice's screen (design §2).
import type { Card } from '../engine/cards';
import type { HandItem } from '../engine/rummy';
import { R_OPS, Rummy, isOp, rummyView } from '../engine/rummy';
import { cardHtml, logHtml, overHtml, shopHtml, top } from './common';

export function mountRummy(app: HTMLElement, seed: number): { game: () => Rummy; render: () => void } {
  let g = new Rummy(seed);
  let picked: number[] = [];
  let note = '';

  const item = (x: HandItem, on: boolean): string => isOp(x)
    ? `<button class="card op ${on ? 'sel' : ''}" data-pick="${x.id}"><b>OP</b><span>${R_OPS[x.op].name}</span></button>`
    : cardHtml(x, on ? 'sel' : '', `data-pick="${x.id}"`);

  function render(): void {
    const v = rummyView(g);
    picked = picked.filter((id) => v.hq.some((x) => x.id === id));
    const sel = picked.map((id) => v.hq.find((x) => x.id === id)!);
    const selCards = sel.filter((x): x is Card => !isOp(x));
    const selOp = sel.length === 1 && isOp(sel[0]) ? sel[0] : null;
    const pct = Math.min(100, (100 * v.score) / v.target);
    const main = v.phase === 'main';
    const drawPhase = v.phase === 'draw';
    let body = `
    <div class="agenda"><div><span class="cap">AGENDA</span><b>${v.agenda}</b></div><div class="sc"><b>${v.score}</b><span class="dim"> / ${v.target}</span></div>
      <div class="bar"><span style="width:${pct}%"></span></div><div class="cap">TURN ${v.turn} OF ${v.turns}</div></div>
    <div class="runnerline ${v.nextRun === v.turn ? 'hot' : ''}"><b>${v.runner}</b> STR ${v.runnerStr} · ${v.nextRun ? (v.nextRun === v.turn ? 'RUNS AT THE END OF THIS TURN' : `RUNS AFTER TURN ${v.nextRun}`) : 'NO MORE RUNS'} · YOUR ICE STR ${v.iceStr}</div>
    <div class="servers">${v.servers.map((s, i) => `
      <div class="srv ${v.targetServer === s.id ? 'targeted' : ''} ${selCards.length === 1 ? 'droppable' : ''}" data-server="${s.id}">
        <div class="sh"><span class="cap">SERVER ${i + 1} · ${s.kind.toUpperCase()}</span>${s.ice ? '<span class="iceb">ICE</span>' : ''}${v.targetServer === s.id ? '<span class="tgt">RUNNER TARGET</span>' : ''}</div>
        <div class="mini-cards">${s.cards.map((c) => cardHtml(c, 'mini')).join('')}</div>
        <div class="sv"><span>${s.value.points} x ${s.value.mult} = <b>${s.value.total}</b></span>${s.value.notes.length ? `<span class="dim"> ${s.value.notes.join(' ')}</span>` : ''}</div>
        <div class="sb">${!s.ice ? `<button class="btn sm" data-ice="${s.id}" ${main && v.credits >= 2 ? '' : 'disabled'}><span>ICE 2</span></button>` : ''}<button class="btn volt sm" data-cash="${s.id}" ${main && s.cards.length >= 3 ? '' : 'disabled'}><span>CASH ${s.value.total}</span></button></div>
      </div>`).join('')}
      ${v.servers.length < 4 ? `<div class="srv empty"><span class="cap">${v.servers.length ? 'ROOM FOR' : 'NO SERVERS YET. LAY A MELD:'} ${4 - v.servers.length} MORE</span></div>` : ''}
    </div>
    <div class="piles">
      <div><span class="cap">R&amp;D ${v.rdCount}</span></div>
      <div class="arch"><span class="cap">ARCHIVES ${v.archivesCount}</span>${v.archivesTop ? cardHtml(v.archivesTop, 'mini') : ''}</div>
    </div>
    ${drawPhase ? `<div class="actions"><button class="btn volt" data-act="draw"><span>DRAW 2 FROM R&amp;D</span></button><button class="btn" data-act="take" ${v.archivesTop ? '' : 'disabled'}><span>TAKE FROM ARCHIVES</span></button></div>` : ''}
    <div class="cap hqlabel">HQ ${v.hq.length}${v.shortMeld ? ' · SHORT MELD READY' : ''}</div>
    <div class="hand wrap">${v.hq.map((x) => item(x, picked.includes(x.id))).join('')}</div>
    ${main ? `<div class="actions three">
      <button class="btn volt" data-act="lay" ${selCards.length >= 2 && !selOp ? '' : 'disabled'}><span>LAY MELD</span></button>
      <button class="btn" data-act="op" ${selOp ? '' : 'disabled'}><span>PLAY OP</span></button>
      <button class="btn hot" data-act="discard" ${selCards.length === 1 && sel.length === 1 ? '' : 'disabled'}><span>DISCARD: END TURN</span></button>
    </div>
    <div class="hint">${selOp ? R_OPS[selOp.op].text : selCards.length === 1 ? 'TAP A SERVER TO ADD THIS CARD TO IT, OR DISCARD IT' : 'PICK 3+ CARDS FOR A SET OR A RUN, OR 1 CARD TO EXTEND A SERVER'}</div>` : ''}
    ${note ? `<div class="note">${note}</div>` : ''}
    ${logHtml(v.log)}`;
    if (v.phase === 'shop') body = shopHtml(v.credits, v.offers, v.owned.length ? `<div class="owned cap">OWNED: ${v.owned.map((o) => o.name).join(', ')}</div>` : '') + logHtml(v.log, 2);
    app.innerHTML = `${top([['ROUND', `${v.round} / ${v.rounds}`], ['CREDITS', String(v.credits)]])}${body}
      ${v.phase === 'over' ? overHtml(!!v.won, v.won ? 'BOTH AGENDAS SCORED' : 'THE AGENDA FAILS', `${v.score} OF ${v.target} IN ROUND ${v.round}`) : ''}`;
  }

  app.onclick = (ev) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-pick],[data-act],[data-server],[data-cash],[data-ice],[data-buy]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    note = '';
    const d = el.dataset;
    let err: string | null = null;
    if (d.pick) { const id = Number(d.pick); picked = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]; }
    else if (d.cash) err = g.cash(Number(d.cash));
    else if (d.ice) err = g.installIce(Number(d.ice));
    else if (d.buy) err = g.buy(d.buy);
    else if (d.server) { if (picked.length === 1) { err = g.extend(Number(d.server), picked[0]); if (!err) picked = []; } }
    else switch (d.act) {
      case 'draw': err = g.drawRD(); break;
      case 'take': err = g.takeArchives(); break;
      case 'lay': err = g.lay(picked); if (!err) picked = []; break;
      case 'op': err = g.playOp(picked[0]); if (!err) picked = []; break;
      case 'discard': err = g.discard(picked[0]); if (!err) picked = []; break;
      case 'next': err = g.nextRound(); break;
      case 'again': g = new Rummy((Date.now() % 1_000_000) + 1); picked = []; break;
    }
    if (err) note = err;
    render();
  };
  return { game: () => g, render };
}
