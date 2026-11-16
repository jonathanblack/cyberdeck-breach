# CLAUDE.md

CYBERDECK: BREACH: a Corp game set in the CYBERDECK: RUNTIME universe (`jonathanblack/cyberdeck-runtime`; read its `beta` branch, `master` lags). Step 1 of a plan: Balatro's scoring core (chips x mult, card by card, ICE as the jokers, Runners as the blinds) under Netrunner names, with Corp twists to be added one at a time only if they make it more fun (design §9). (Earlier prototypes are in git history: poker servers at `9d46330`, the blackjack table at `fe71afa`, ICE charged by hands at `3014611`.) Runtime supplies lore and every name and stat word (corps, ICE, agendas, STR, clicks, credits, R&D, HQ, Archives, palette); Breach has its own mechanics. Copy content across; never import from the Runtime or Packet repos, and never change them from here.

## Design docs (`docs/`)

- `docs/design.md`: single source of truth for what the game is (decided design only). Read the relevant section on demand.
  - Edit in place. Never create `design_v2.md` or version headers; git is the history.
  - Terse reference: rules, values, constraints in bullets/tables. No narrative, rationale, or changelog.
  - Unresolved conflicts go in a `> NEEDS RECONCILIATION:` block listing both sides. Don't pick a winner; Jonathan resolves them.
- `docs/status.md`: the board: NOW (max 3) / NEXT / LATER / BUILT. Order within a section is priority. Jonathan adds his own lines freely.
  - Jonathan sets priority. Claude keeps it in sync.
  - When design.md changes, add or move the matching board line.
  - When work finishes, move its line to BUILT (note only what's partial) in the same commit as the code.
  - Before implementing a line: read its design.md section. If there's none, or the intent isn't clear, ask Jonathan first.
- No new spec or prompt files in the repo.

## Commands (`cd web`)

- `npm run dev` · `npm run build` (typecheck + build to `web/dist`) · `npm test` (vitest) · `npm run sim -- 200` (a greedy bot plays whole runs: win rate and where runs end).
- `npm run playtest`: after a build, drives it in headless Chromium and writes `web/screenshots/` (phone portrait, phone landscape, desktop). Look at them before handing back UI work.
- Deploy: Cloudflare Workers Builds (Worker `cyberdeck-breach`), root `web`, build `npm run build`, deploy `npx wrangler deploy`, non-production branches `npx wrangler preview` (`web/wrangler.jsonc`). `beta` is where Jonathan tests.
- URL params: `?seed=7`, `?fast` (no scoring playback delay). `window.__breach` is the game; `window.__render()` repaints.

## Working rules (mirrors Runtime)

- TypeScript + Vite, plain HTML/CSS UI.
- Engine (`web/src/engine/`) is pure TS: no DOM, deterministic (seeded RNG). `poker.ts` hand evaluation and values, `game.ts` the run (`scoreHand` returns every scoring step for playback; ICE effects by id; cashout; shop), `bot.ts` the greedy bot for the sim. Content in `web/src/engine/content.ts` as typed data.
- Engine↔UI contract in one `api.ts`: views are plain snapshots, the UI only reads views and calls commands.
- Colors only via palette-role CSS variables.

## Conventions

- Never use emoji, in player-facing text, code, comments or docs. That includes any character with the Unicode Emoji property, which an iPhone may draw as a colour emoji even when it is a plain symbol: the four card suit characters, the eight-pointed black star, play triangles, arrows, hearts, warning signs. Suits are SVG glyphs. `web/src/engine/no-emoji.test.ts` scans the shipped sources.
- Never use the word "boss" — in player-facing text, code identifiers, comments or docs. The term is **Black ICE**.
