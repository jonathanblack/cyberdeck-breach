// Start screen: pick a core. `?mode=encounter`, `?mode=rummy` or `?mode=solitaire` skips it.
import { mountEncounter } from './ui/encounter';
import { mountRummy } from './ui/rummy';
import { mountSolitaire } from './ui/solitaire';

const params = new URLSearchParams(location.search);
const app = document.getElementById('app')!;
const seed = () => Number(params.get('seed')) || (Date.now() % 1_000_000);

declare global { interface Window { __breach: unknown; __render: () => void } }

function start(mode: string | null): void {
  if (mode === 'encounter' || mode === 'rummy' || mode === 'solitaire') {
    const m = mode === 'encounter' ? mountEncounter(app, seed(), params.has('fast')) : mode === 'rummy' ? mountRummy(app, seed()) : mountSolitaire(app, seed());
    Object.defineProperty(window, '__breach', { get: () => m.game(), configurable: true });
    window.__render = m.render;
    m.render();
    return;
  }
  app.onclick = (ev) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-mode]');
    if (el) start(el.dataset.mode!);
  };
  app.innerHTML = `
  <div class="top"><div class="brand"><b>CYBERDECK</b><span>// BREACH</span></div></div>
  <div class="pick">
    <p class="lead">Corp cores to try. THE ENCOUNTER is the current one.</p>
    <button class="choice main" data-mode="encounter"><b>THE ENCOUNTER</b><span>Play poker hands to advance PROJECT ATLAS. Before every hand PYROS runs at you; the ICE your hand fires scores and stops the run. Two runs get through and PYROS steals the agenda.</span></button>
    <button class="choice" data-mode="rummy"><b>RUMMY</b><span>Build melds on the table as servers. Cash them to score your agenda before the Runner raids them. Operations bend the rules; ICE keeps the Runner out.</span></button>
    <button class="choice" data-mode="solitaire"><b>SOLITAIRE</b><span>Set aside: it felt hopeless rather than like defending. SOS Titanic's rules: save data into vaults while the breach floods your servers.</span></button>
  </div>
  <div class="build">${__BUILD__}</div>`;
}

// The brand returns to the start screen.
document.addEventListener('click', (ev) => {
  if ((ev.target as HTMLElement).closest('[data-home]')) { ev.stopPropagation(); history.replaceState(null, '', location.pathname); start(null); }
}, true);

start(params.get('mode'));
