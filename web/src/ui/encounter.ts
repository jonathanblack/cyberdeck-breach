// THE ENCOUNTER's screen (design §5): the attack, the score box with block preview, ICE, the hand; card-by-card scoring playback.
import type { Suit } from '../engine/cards';
import type { Scored } from '../engine/encounter';
import { E_ICE, E_RULES, Encounter, encounterView } from '../engine/encounter';
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
  let anim: { s: Scored; shown: number; adv: number; done: boolean; it: ReturnType<typeof encounterView>['intent']; hits: number } | null = null;

  const card = (c: PCard, cls = '', attrs = '') => `<button class="card ${red(c.suit) ? 'red' : ''} ${cls}" ${attrs}><b>${RANK(c.rank)}</b><i>${SUIT_GLYPH[c.suit]}</i></button>`;

  function pickView(): string {
    return `<div class="pick">
      <p class="lead">PROJECT ATLAS needs ${fmt(E_RULES.target)} advancement in ${E_RULES.hands} hands. PYROS attacks before every hand; if ${E_RULES.hitsToSteal} attacks land, PYROS steals the agenda. Each hand you play scores and can block the attack.</p>
      <h2 class="cap">PICK ${E_RULES.picks} ICE</h2>
      <div class="passpick">${E_ICE.map((i) => `<button class="pass ${picks.includes(i.id) ? 'on' : ''}" data-pickice="${i.id}"><span class="cap">${i.kind === 'defense' ? 'PAYS WHEN YOU BLOCK' : 'SCORING'}</span><b>${i.name}</b><span>${i.text}</span></button>`).join('')}</div>
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
    // preview or playback
    let name = '', chips = 0, mult = 0, label = '', blockLine = '';
    let scoring = new Set<number>();
    if (anim) {
      const st = anim.s.steps[Math.max(0, anim.shown - 1)];
      name = anim.s.name; chips = st.totalChips; mult = st.totalMult; label = anim.done ? `+${fmt(anim.s.advancement)} ADVANCEMENT` : st.label;
      if (anim.done && anim.s.block) blockLine = `<div class="blockline ${anim.s.block.outcome === 'lands' ? 'bad' : 'good'}">${anim.s.block.outcome === 'lands' ? 'THE ATTACK LANDS: ' : ''}${anim.s.block.text}</div>`;
    } else if (picked.length) {
      const s = g.score(picked);
      if (typeof s !== 'string') {
        name = s.name; chips = s.chips; mult = s.mult; label = `ADVANCES ${fmt(s.advancement)}${v.scorched ? ' (SCORCHED: 0)' : ''}`;
        scoring = new Set(s.scoring);
        if (s.block) blockLine = `<div class="blockline ${s.block.outcome === 'lands' ? 'bad' : 'good'}">${s.block.outcome === 'lands' ? `DOES NOT BLOCK: ${s.block.text}` : s.block.outcome === 'rezzed' ? 'REZZED ICE BLOCKS THIS ATTACK.' : 'THIS HAND BLOCKS THE ATTACK.'}</div>`;
      }
    }
    const it = anim ? anim.it : v.intent;
    const hits = anim && !anim.done ? anim.hits : v.hits;
    const attack = it ? `<div class="attack">
        <div class="ah"><span class="cap">PYROS ATTACKS</span><b>${it.name}</b><span class="hits">${pips(hits, v.hitsToSteal, 'run')}<span class="cap">HITS TO STEAL</span></span></div>
        <div class="al"><span class="cap">IF IT LANDS</span>${it.lands}</div>
        <div class="ab"><span class="cap">BLOCK IT</span>${it.block}</div>
        <div class="ar">${anim ? (anim.done && anim.s.block ? `<span class="${anim.s.block.outcome === 'lands' ? 'bad' : 'good'}">${anim.s.block.outcome === 'lands' ? 'LANDED' : 'BLOCKED'}</span>` : '<span class="dim">RESOLVING</span>') : v.rezzed ? '<span class="good">REZZED: THIS ATTACK IS BLOCKED</span>' : `<button class="btn sm" data-act="rez" ${v.credits >= v.rezCost && !anim ? '' : 'disabled'}><span>REZ ICE: BLOCK FOR ${v.rezCost} CREDITS</span></button>`}</div>
      </div>` : `<div class="attack quiet"><span class="cap">PYROS</span> ${v.phase === 'over' ? '' : 'IS OUT OF ATTACKS.'}</div>`;
    const status = [v.scorched ? 'SCORCHED: YOUR NEXT HAND ADVANCES NOTHING' : '', v.ice.some((i) => i.offline) ? 'MELTDOWN: AN ICE IS OFFLINE' : ''].filter(Boolean).join(' · ');
    const active = anim ? anim.s.steps[anim.shown - 1] : undefined;
    const iceCells = v.ice.map((i) => `<div class="ice ${selIce === i.uid ? 'sel' : ''} ${i.offline ? 'off' : ''} ${active?.ice === i.uid ? 'fire' : ''} k-${i.kind}" data-ice="${i.uid}"><b>${i.name}</b>${i.offline ? '<span class="ctr bad">OFFLINE</span>' : ''}</div>`).join('');
    const sk = v.ice.findIndex((i) => i.uid === selIce);
    const detail = sk >= 0 && !anim ? `<div class="icedetail"><div><b>${v.ice[sk].name}</b> ${v.ice[sk].text}</div><div class="mv"><button data-move="${selIce}:-1" ${sk === 0 ? 'disabled' : ''}>${CHEVRON.left}</button><button data-move="${selIce}:1" ${sk === v.ice.length - 1 ? 'disabled' : ''}>${CHEVRON.right}</button></div></div>` : '';
    const hand = [...v.hand].sort((a, b) => (sortBy === 'rank' ? b.rank - a.rank || SO[a.suit] - SO[b.suit] : SO[a.suit] - SO[b.suit] || b.rank - a.rank));
    const handHtml = anim
      ? `<div class="played">${anim.s.cards.map((c) => card(c, `${anim!.s.scoring.includes(c.id) ? 'scoring' : 'dead'} ${active?.card === c.id ? 'fire' : ''}`)).join('')}</div>`
      : `<div class="hand">${hand.map((c) => card(c, `${picked.includes(c.id) ? 'sel' : ''} ${scoring.has(c.id) ? 'scores' : ''}`, `data-card="${c.id}"`)).join('')}</div>`;

    app.innerHTML = `${top}
    <div class="agenda"><div><span class="cap">AGENDA</span><b>PROJECT ATLAS</b><span class="dim"> 2 PTS</span></div><div class="sc"><b>${fmt(adv)}</b><span class="dim"> / ${fmt(v.target)}</span></div>
      <div class="bar"><span style="width:${pct}%"></span></div><div class="cap">HANDS ${v.hands} · DISCARDS ${v.discards} · DECK ${v.deckLeft}</div></div>
    ${attack}
    ${status && !anim ? `<div class="statusline bad">${status}</div>` : ''}
    <div class="scorebox">
      <div class="hname">${name || '<span class="dim">SELECT CARDS</span>'}</div>
      <div class="cm"><span class="chips">${fmt(chips)}</span><span class="x">X</span><span class="mult">${fmt(mult)}</span></div>
      <div class="steplabel">${label}</div>
      ${blockLine}
    </div>
    <div class="icehead"><span class="cap">ICE: TRIGGERS LEFT TO RIGHT</span><span class="cap dim">TAP TO READ OR MOVE</span></div>
    <div class="icerow four">${iceCells}</div>${detail}
    ${handHtml}
    <div class="actions">
      <button class="btn volt" data-act="play" ${picked.length && !anim && v.phase === 'play' ? '' : 'disabled'}><span>PLAY</span></button>
      <button class="btn" data-act="discard" ${picked.length && v.discards && !anim && v.phase === 'play' ? '' : 'disabled'}><span>DISCARD <em>${v.discards}</em></span></button>
    </div>
    <div class="tools"><button class="btn sm" data-act="sort"><span>SORT: ${sortBy === 'rank' ? 'RANK' : 'SUIT'}</span></button></div>
    ${note ? `<div class="note">${note}</div>` : ''}
    ${logHtml(v.log, 4)}
    ${v.phase === 'over' && !anim ? `<div class="over"><div><b class="${v.won ? 'good' : 'bad'}">${v.won ? 'PROJECT ATLAS SCORED' : 'PYROS STEALS THE AGENDA'}</b><span>${v.won ? '+2 AGENDA POINTS FOR THE CORP' : '+2 AGENDA POINTS FOR THE RUNNER'}</span><span class="dim">${fmt(v.advancement)} OF ${fmt(v.target)} · ${v.hits} OF ${v.hitsToSteal} ATTACKS LANDED</span><button class="btn volt" data-act="again"><span>PLAY AGAIN</span></button><button class="btn sm" data-home><span>BACK TO THE START</span></button></div></div>` : ''}`;
  }

  function playback(s: Scored, before: number, it: ReturnType<typeof encounterView>['intent'], hits: number): void {
    anim = { s, shown: 0, adv: before, done: false, it, hits };
    const tick = () => {
      if (!anim) return;
      if (anim.shown < s.steps.length) { anim.shown++; render(); setTimeout(tick, fast ? 0 : anim.shown === 1 ? 450 : 300); return; }
      anim.adv = before + s.advancement; anim.done = true; render();
      setTimeout(() => { anim = null; render(); }, fast ? 0 : 1400);
    };
    tick();
  }

  app.onclick = (ev) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-act],[data-card],[data-ice],[data-move],[data-pickice]');
    if (!el || anim || (el as HTMLButtonElement).disabled) return;
    note = '';
    const d = el.dataset;
    let err: string | null = null;
    if (d.pickice) picks = picks.includes(d.pickice) ? picks.filter((x) => x !== d.pickice) : [...picks, d.pickice].slice(-E_RULES.picks);
    else if (d.move) { const [u, dir] = d.move.split(':').map(Number); err = g.move(u, dir as -1 | 1); }
    else if (d.card) { const id = Number(d.card); picked = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < 5 ? [...picked, id] : picked; }
    else if (d.ice) { const u = Number(d.ice); selIce = selIce === u ? null : u; }
    else switch (d.act) {
      case 'start': err = g.pick(picks); break;
      case 'rez': err = g.rez(); break;
      case 'play': { const before = g.advancement; const pv = encounterView(g); err = g.play(picked); if (!err) { picked = []; playback(g.last!, before, pv.intent, pv.hits); return; } break; }
      case 'discard': err = g.discard(picked); if (!err) picked = []; break;
      case 'sort': sortBy = sortBy === 'rank' ? 'suit' : 'rank'; break;
      case 'again': g = new Encounter((Date.now() % 1_000_000) + 1); picked = []; selIce = null; break;
    }
    if (err) note = err;
    render();
  };
  return { game: () => g, render };
}
