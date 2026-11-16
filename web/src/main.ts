// Start screen: pick a slice. `?mode=rummy` or `?mode=solitaire` skips it.
import { mountRummy } from './ui/rummy';
import { mountSolitaire } from './ui/solitaire';

const params = new URLSearchParams(location.search);
const app = document.getElementById('app')!;
const seed = () => Number(params.get('seed')) || (Date.now() % 1_000_000);

declare global { interface Window { __breach: unknown; __render: () => void } }

function start(mode: string | null): void {
  if (mode === 'rummy' || mode === 'solitaire') {
    const m = mode === 'rummy' ? mountRummy(app, seed()) : mountSolitaire(app, seed());
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
    <p class="lead">Two Corp cores to try. Each is a slice: 2 rounds with a shop between.</p>
    <button class="choice" data-mode="rummy"><b>RUMMY</b><span>Build melds on the table as servers. Cash them to score your agenda before the Runner raids them. Operations bend the rules; ICE keeps the Runner out.</span></button>
    <button class="choice" data-mode="solitaire"><b>SOLITAIRE</b><span>The breach has started. Sort data into vaults before every server goes dark. ICE changes where the breach lands; operations buy you time.</span></button>
  </div>
  <div class="build">${__BUILD__}</div>`;
}

// The brand returns to the start screen.
document.addEventListener('click', (ev) => {
  if ((ev.target as HTMLElement).closest('[data-home]')) { ev.stopPropagation(); history.replaceState(null, '', location.pathname); start(null); }
}, true);

start(params.get('mode'));
