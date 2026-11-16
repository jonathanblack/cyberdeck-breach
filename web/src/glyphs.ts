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

/** ICE type marks. */
export const TYPE_GLYPH: Record<string, string> = {
  BARRIER: line('<path d="M2 6h20M2 12h20M2 18h20M2 6v12M22 6v12M8 6v6M16 6v6M5 12v6M12 12v6M19 12v6"/>'),
  'CODE GATE': line('<path d="M6 11V8a6 6 0 0 1 12 0v3"/><path d="M4 11h16v10H4z"/><path d="M12 14v4"/>'),
  SENTRY: line('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
};

/** Chevrons for moving ICE (drawn: arrow characters carry the Emoji property). */
export const CHEVRON = {
  left: line('<path d="M15 5l-7 7 7 7"/>'),
  right: line('<path d="M9 5l7 7-7 7"/>'),
};
