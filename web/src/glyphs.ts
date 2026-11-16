// Inline SVG glyphs (currentColor). Suits are drawn, never typed: the Unicode suit characters carry the Emoji property.
import type { Suit } from './engine/api';

const fill = (body: string) => `<svg class="gl" viewBox="0 0 24 24" fill="currentColor">${body}</svg>`;
const line = (body: string) => `<svg class="gl" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="square">${body}</svg>`;

export const SUIT_GLYPH: Record<Suit, string> = {
  s: fill('<path d="M12 2C9.5 6 3 9 3 14a4.2 4.2 0 0 0 7.3 2.8L9 22h6l-1.3-5.2A4.2 4.2 0 0 0 21 14c0-5-6.5-8-9-12z"/>'),
  h: fill('<path d="M12 21C6 16.3 2 12.6 2 8.6A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 10 2.4c0 4-4 7.7-10 12.4z"/>'),
  d: fill('<path d="M12 2l8 10-8 10-8-10z"/>'),
  c: fill('<circle cx="12" cy="7" r="4.2"/><circle cx="6.8" cy="13.4" r="4.2"/><circle cx="17.2" cy="13.4" r="4.2"/><path d="M10.8 13h2.4l1.3 9h-5z"/>'),
};

/** Charged ICE, by id. */
export const ICE_GLYPH: Record<string, string> = {
  reshuffle: line('<path d="M4 9a8 8 0 0 1 14-3l2 2"/><path d="M20 3v5h-5"/><path d="M20 15a8 8 0 0 1-14 3l-2-2"/><path d="M4 21v-5h5"/>'),
  second: line('<path d="M8 2h11v15H8z"/><path d="M5 6v16h11"/>'),
  swap: line('<path d="M3 8h16l-4-4"/><path d="M21 16H5l4 4"/>'),
  void: line('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>'),
};
