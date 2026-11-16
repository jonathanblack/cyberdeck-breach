// Pieces both slices draw with.
import type { Card } from '../engine/cards';
import { isRed, rankName } from '../engine/cards';
import { SUIT_GLYPH } from '../glyphs';

export const cardHtml = (c: Card, cls = '', attrs = ''): string =>
  `<button class="card ${isRed(c.suit) ? 'red' : ''} ${cls}" ${attrs}><b>${rankName(c.rank)}</b><i>${SUIT_GLYPH[c.suit]}</i></button>`;

export const top = (stats: [string, string][]): string => `<div class="top">
  <button class="brand" data-home><b>CYBERDECK</b><span>// BREACH</span></button>
  ${stats.map(([k, v]) => `<div class="stat"><span class="cap">${k}</span><b>${v}</b></div>`).join('')}
</div>`;

export const shopHtml = (credits: number, offers: { id: string; name: string; text: string; cost: number; kind: string }[], owned: string): string => `
  <div class="shop"><h2>THE SHOP <span class="dim">${credits} CREDITS</span></h2>
    <div class="offers">${offers.map((o) => `<div class="offer k-${o.kind}"><span class="cap">${o.kind.toUpperCase()}</span><b>${o.name}</b><div class="itxt">${o.text}</div><button class="btn volt sm" data-buy="${o.id}" ${o.cost <= credits ? '' : 'disabled'}><span>BUY ${o.cost}</span></button></div>`).join('') || '<div class="dim">SOLD OUT</div>'}</div>
    ${owned}
    <div class="actions one"><button class="btn volt" data-act="next"><span>NEXT ROUND</span></button></div>
  </div>`;

export const overHtml = (won: boolean, title: string, line: string): string =>
  `<div class="over"><div><b class="${won ? 'good' : 'bad'}">${title}</b><span>${line}</span><button class="btn volt" data-act="again"><span>PLAY AGAIN</span></button><button class="btn sm" data-home><span>BACK TO THE START</span></button></div></div>`;

export const logHtml = (log: string[], n = 3): string => `<ul class="log">${log.slice(-n).map((l) => `<li>${l}</li>`).join('')}</ul>`;
