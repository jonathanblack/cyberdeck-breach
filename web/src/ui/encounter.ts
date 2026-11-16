// THE ENCOUNTER's screen (design §5, §6): PYROS's run, the score box with the strength preview, ICE (rez, trash, order), the hand; card-by-card playback.
import type { Suit } from '../engine/cards';
import type { RunView, Scored } from '../engine/encounter';
import { E_ICE, E_RULES, Encounter, TYPE_NAME, encounterView } from '../engine/encounter';
import type { PCard } from '../engine/poker';
import { CHEVRON, SUIT_GLYPH } from '../glyphs';
import { logHtml } from './common';

const RANK = (r: number) => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' } as Record<number, string>)[r] ?? String(r);
const red = (s: Suit) => s === 'h' || s === 'd';
const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString('en-US');
const SO: Record<Suit, number> = { s: 0, h: 1, c: 2, d: 3 };
const pips = (n: number, of: number, cls: string) => Array.from({ length: of }, (_, i) => `<span class="pip ${cls} ${i < n ? 'on' : ''}"></span>`).join('');

export function mountEncounter(app: HTMLElement, seed: number, fast: boolean): { game: () => Encounter; render: () => void } {
  let g = new Encounter(seed);
  let picks: string[] = [];
  let picked: number[] = [];
  let selIce: number | null = null;
  let sortBy: 'rank' | 'suit' = 'rank';
  let note = '';
  let anim: { s: Scored; shown: number; adv: number; done: boolean; run: RunView | null; hits: number } | null = null;

  const card = (c: PCard, cls = '', attrs = '') => `<button class="card ${red(c.suit) ? 'red' : ''} ${cls}" ${attrs}><b>${RANK(c.rank)}</b><i>${SUIT_GLYPH[c.suit]}</i></button>`;

  function pickView(): string {
    return `<div class="pick">
      <p class="lead">PROJECT ATLAS needs ${fmt(E_RULES.target)} advancement in ${E_RULES.hands} hands. Before every hand PYROS runs with a breaker that breaks one type of ICE. Your rezzed ICE fires when your hand meets its condition: it scores, and its strength stops the run. ${E_RULES.hitsToSteal} runs get through and PYROS steals the agenda.</p>
      <h2 class="cap">PICK ${E_RULES.picks} ICE</h2>
      <div class="passpick">${E_ICE.map((i) => `<button class="pass t-${i.type} ${picks.includes(i.id) ? 'on' : ''}" data-pickice="${i.id}"><span class="cap">${TYPE_NAME[i.type]} · STR ${i.str} · REZ ${i.rez}</span><b>${i.name}</b><span>${i.when} ${i.does}</span></button>`).join('')}</div>
      <div class="actions one"><button class="btn volt" data-act="start" ${picks.length === E_RULES.picks ? '' : 'disabled'}><span>BEGIN</span></button></div>
    </div>`;
  }

  function render(): void {
    const v = encounterView(g);
    const top = `<div class="top"><button class="brand" data-home><b>CYBERDECK</b><span>// BREACH</span></button>
      <div class="stat"><span class="cap">CORP</span><b class="good">${v.corpPoints}</b></div>
      <div class="stat"><span class="cap">RUNNER</span><b class="bad">${v.runnerPoints}</b></div>
      <div class="stat"><span class="cap">CREDITS</span><b>${v.credits}</b></div></div>`;
    if (v.phase === 'pick') { app.innerHTML = top + pickView(); return; }

    const adv = anim ? anim.adv : v.advancement;
    const pct = Math.min(100, (100 * adv) / v.target);
    let name = '', chips = 0, mult = 0, label = '', blockLine = '';
    let scoring = new Set<number>(), firing = new Set<number>();
    const run = anim ? anim.run : v.run;
    const strLine = (s: Scored, done: boolean) => {
      const b = s.block;
      if (!b || !run) return '';
      if (b.outcome === 'trashed') return `<div class="blockline good">${done ? 'STOPPED' : 'STOPS THE RUN'}: AN ICE WAS TRASHED.</div>`;
      const ok = b.outcome === 'blocked';
      return `<div class="blockline ${ok ? 'good' : 'bad'}">STRENGTH <b>${b.str}</b> OF ${b.need}: ${ok ? (done ? 'THE RUN IS STOPPED.' : 'STOPS THE RUN.') : `${done ? 'PYROS GETS THROUGH' : 'GETS THROUGH'}. ${run.name}.`}</div>`;
    };
    if (anim) {
      const st = anim.s.steps[Math.max(0, anim.shown - 1)];
      name = anim.s.name; chips = st.totalChips; mult = st.totalMult; label = anim.done ? `+${fmt(anim.s.advancement)} ADVANCEMENT` : st.label;
      if (anim.done) blockLine = strLine(anim.s, true);
    } else if (picked.length) {
      const s = g.score(picked);
      if (typeof s !== 'string') {
        name = s.name; chips = s.chips; mult = s.mult; label = `ADVANCES ${fmt(s.advancement)}${v.scorched ? ' (SCORCHED: 0)' : ''}${s.credits ? ` · +${s.credits} CREDITS` : ''}`;
        scoring = new Set(s.scoring);
        firing = new Set(s.block?.fired ?? []);
        blockLine = strLine(s, false);
      }
    }
    const hits = anim && !anim.done ? anim.hits : v.hits;
    const runHtml = run ? `<div class="attack">
        <div class="ah"><span class="cap">PYROS RUNS</span><b>${run.breaker} · STR ${run.str}</b><span class="hits">${pips(hits, v.hitsToSteal, 'run')}<span class="cap">TO STEAL</span></span></div>
        <div class="al"><span class="cap">BREAKS</span>Your ${run.breaks} ICE: it does not fire this hand.</div>
        <div class="al"><span class="cap">IF IT GETS IN</span><span><b>${run.name}</b> ${run.lands}</span></div>
        ${anim ? `<div class="ar">${anim.done && anim.s.block ? `<span class="${anim.s.block.outcome === 'lands' ? 'bad' : 'good'}">${anim.s.block.outcome === 'lands' ? 'GOT THROUGH' : 'STOPPED'}</span>` : '<span class="dim">RESOLVING</span>'}</div>` : v.trashed ? '<div class="ar good">STOPPED: YOU TRASHED AN ICE.</div>' : ''}
      </div>` : `<div class="attack quiet"><span class="cap">PYROS</span> ${v.phase === 'over' ? '' : 'IS OUT OF RUNS.'}</div>`;
    const status = v.scorched && !anim ? 'SCORCHED EARTH: YOUR NEXT HAND ADVANCES NOTHING' : '';
    const active = anim ? anim.s.steps[anim.shown - 1] : undefined;
    const iceCells = v.ice.map((i) => {
      i = { ...i, broken: anim ? !!anim.run && anim.run.breaks === i.typeName : i.broken };
      const state = i.broken && i.rezzed ? '<span class="ctr bad">BROKEN</span>' : i.rezzed ? '<span class="ctr good">REZZED</span>' : `<span class="ctr dim">REZ ${i.rez}</span>`;
      return `<div class="ice t-${i.type} ${selIce === i.uid ? 'sel' : ''} ${i.rezzed ? '' : 'off'} ${i.broken ? 'broken' : ''} ${firing.has(i.uid) ? 'fires' : ''} ${active?.ice === i.uid ? 'fire' : ''}" data-ice="${i.uid}"><span class="cap">${i.typeName} · ${i.str}</span><b>${i.name}</b>${state}</div>`;
    }).join('');
    const sk = v.ice.findIndex((i) => i.uid === selIce);
    const si = v.ice[sk];
    const detail = si && !anim ? `<div class="icedetail"><div><b>${si.name}</b> ${si.typeName}, STRENGTH ${si.str}. <span class="dim">FIRES:</span> ${si.when} ${si.does}</div>
      <div class="mv"><button data-move="${selIce}:-1" ${sk === 0 ? 'disabled' : ''}>${CHEVRON.left}</button><button data-move="${selIce}:1" ${sk === v.ice.length - 1 ? 'disabled' : ''}>${CHEVRON.right}</button></div>
      <div class="iceacts">${si.rezzed
        ? `<button class="btn sm" data-trash="${si.uid}" ${v.run && !v.trashed ? '' : 'disabled'}><span>TRASH IT: STOP THIS RUN</span></button>`
        : `<button class="btn sm volt" data-rez="${si.uid}" ${v.credits >= si.rez ? '' : 'disabled'}><span>REZ FOR ${si.rez} CREDIT${si.rez === 1 ? "" : "S"}</span></button>`}</div></div>` : '';
    const hand = [...v.hand].sort((a, b) => (sortBy === 'rank' ? b.rank - a.rank || SO[a.suit] - SO[b.suit] : SO[a.suit] - SO[b.suit] || b.rank - a.rank));
    const handHtml = anim
      ? `<div class="played">${anim.s.cards.map((c) => card(c, `${anim!.s.scoring.includes(c.id) ? 'scoring' : 'dead'} ${active?.card === c.id ? 'fire' : ''}`)).join('')}</div>`
      : `<div class="hand">${hand.map((c) => card(c, `${picked.includes(c.id) ? 'sel' : ''} ${scoring.has(c.id) ? 'scores' : ''}`, `data-card="${c.id}"`)).join('')}</div>`;

    app.innerHTML = `${top}
    <div class="agenda"><div><span class="cap">AGENDA</span><b>PROJECT ATLAS</b><span class="dim"> 2 PTS</span></div><div class="sc"><b>${fmt(adv)}</b><span class="dim"> / ${fmt(v.target)}</span></div>
      <div class="bar"><span style="width:${pct}%"></span></div><div class="cap">HANDS ${v.hands} · DISCARDS ${v.discards} · DECK ${v.deckLeft} · +${E_RULES.income} CREDITS A HAND</div></div>
    ${runHtml}
    ${status ? `<div class="statusline bad">${status}</div>` : ''}
    <div class="scorebox">
      <div class="hname">${name || '<span class="dim">SELECT CARDS</span>'}</div>
      <div class="cm"><span class="chips">${fmt(chips)}</span><span class="x">X</span><span class="mult">${fmt(mult)}</span></div>
      <div class="steplabel">${label}</div>
      ${blockLine}
    </div>
    <div class="icehead"><span class="cap">ICE: FIRES LEFT TO RIGHT</span><span class="cap dim">TAP TO REZ, TRASH OR MOVE</span></div>
    <div class="icerow four">${iceCells}</div>${detail}
    ${handHtml}
    <div class="actions">
      <button class="btn volt" data-act="play" ${picked.length && !anim && v.phase === 'play' ? '' : 'disabled'}><span>PLAY</span></button>
      <button class="btn" data-act="discard" ${picked.length && v.discards && !anim && v.phase === 'play' ? '' : 'disabled'}><span>DISCARD <em>${v.discards}</em></span></button>
    </div>
    <div class="tools"><button class="btn sm" data-act="sort"><span>SORT: ${sortBy === 'rank' ? 'RANK' : 'SUIT'}</span></button></div>
    ${note ? `<div class="note">${note}</div>` : ''}
    ${logHtml(v.log, 4)}
    ${v.phase === 'over' && !anim ? `<div class="over"><div><b class="${v.won ? 'good' : 'bad'}">${v.won ? 'PROJECT ATLAS SCORED' : 'PYROS STEALS THE AGENDA'}</b><span>${v.won ? '+2 AGENDA POINTS FOR THE CORP' : '+2 AGENDA POINTS FOR THE RUNNER'}</span><span class="dim">${fmt(v.advancement)} OF ${fmt(v.target)} · ${v.hits} OF ${v.hitsToSteal} RUNS GOT THROUGH</span><button class="btn volt" data-act="again"><span>PLAY AGAIN</span></button><button class="btn sm" data-home><span>BACK TO THE START</span></button></div></div>` : ''}`;
  }

  function playback(s: Scored, before: number, run: RunView | null, hits: number): void {
    anim = { s, shown: 0, adv: before, done: false, run, hits };
    const tick = () => {
      if (!anim) return;
      if (anim.shown < s.steps.length) { anim.shown++; render(); setTimeout(tick, fast ? 0 : anim.shown === 1 ? 450 : 300); return; }
      anim.adv = before + s.advancement; anim.done = true; render();
      setTimeout(() => { anim = null; render(); }, fast ? 0 : 1400);
    };
    tick();
  }

  app.onclick = (ev) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-act],[data-card],[data-ice],[data-move],[data-pickice],[data-rez],[data-trash]');
    if (!el || anim || (el as HTMLButtonElement).disabled) return;
    note = '';
    const d = el.dataset;
    let err: string | null = null;
    if (d.pickice) picks = picks.includes(d.pickice) ? picks.filter((x) => x !== d.pickice) : [...picks, d.pickice].slice(-E_RULES.picks);
    else if (d.move) { const [u, dir] = d.move.split(':').map(Number); err = g.move(u, dir as -1 | 1); }
    else if (d.rez) err = g.rez(Number(d.rez));
    else if (d.trash) { err = g.trash(Number(d.trash)); if (!err) selIce = null; }
    else if (d.card) { const id = Number(d.card); picked = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < 5 ? [...picked, id] : picked; }
    else if (d.ice) { const u = Number(d.ice); selIce = selIce === u ? null : u; }
    else switch (d.act) {
      case 'start': err = g.pick(picks); break;
      case 'play': { const before = g.advancement; const pv = encounterView(g); err = g.play(picked); if (!err) { picked = []; playback(g.last!, before, pv.run, pv.hits); return; } break; }
      case 'discard': err = g.discard(picked); if (!err) picked = []; break;
      case 'sort': sortBy = sortBy === 'rank' ? 'suit' : 'rank'; break;
      case 'again': g = new Encounter((Date.now() % 1_000_000) + 1); picked = []; selIce = null; break;
    }
    if (err) note = err;
    render();
  };
  return { game: () => g, render };
}
