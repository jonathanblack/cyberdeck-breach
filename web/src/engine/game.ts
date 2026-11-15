// The rules (design §2, §3, §6): one game of Corp against the Runner bot. Pure, deterministic from the seed.
import type { AgendaCard, Breaker, Card, GameView, IceInst, Phase, PokerCard, RemoteId, RunnerEvent, ServerId, ServerView, Suit } from './api';
import { AGENDAS, AGENDA_BY_ID, ICE_BY_ID, RULES } from './content';
import { made, progress } from './hands';
import { Rng } from './rng';

export interface Remote { id: RemoteId; exists: boolean; cards: PokerCard[]; agenda: AgendaCard | null }

const REMOTE_IDS: RemoteId[] = ['r1', 'r2', 'r3'];
const SERVER_NAME: Record<ServerId, string> = { hq: 'HQ', rd: 'R&D', r1: 'REMOTE 1', r2: 'REMOTE 2', r3: 'REMOTE 3' };
export const serverName = (s: ServerId): string => SERVER_NAME[s];

/** Every command returns null on success or a short player-facing reason. */
export type Result = string | null;

export class Game {
  readonly seed: number;
  private rng: Rng;
  private nextId = 1;
  turn = 0;
  phase: Phase = 'corp';
  winner: 'corp' | 'runner' | null = null;
  why = '';
  clicks = 0;
  credits = RULES.startCredits;
  corpPoints = 0;
  runnerPoints = 0;
  rd: Card[] = [];
  hq: Card[] = [];
  archives: Card[] = [];
  remotes: Remote[] = REMOTE_IDS.map((id) => ({ id, exists: false, cards: [], agenda: null }));
  ice: Record<ServerId, IceInst[]> = { hq: [], rd: [], r1: [], r2: [], r3: [] };
  runner: Record<Breaker, number> = { fracter: RULES.breakerStart, decoder: RULES.breakerStart, killer: RULES.breakerStart };
  /** Runs lost next Runner turn (CIPHER). */
  runnerSlow = 0;
  scored: string[] = [];
  stolen: string[] = [];
  events: RunnerEvent[] = [];
  /** Turns from an agenda's install to its score, for the sim. */
  scoreLog: { def: string; turns: number }[] = [];
  private installedAt = new Map<number, number>();
  /** Run outcomes, for the sim. */
  runLog: { server: ServerId; result: 'stopped' | 'stole' | 'trashed' | 'empty' }[] = [];

  constructor(seed: number) {
    this.seed = seed;
    this.rng = new Rng(seed);
    const deck: Card[] = [];
    for (const suit of ['s', 'h', 'd', 'c'] as Suit[]) for (let rank = 2; rank <= 14; rank++) deck.push({ kind: 'poker', id: this.nextId++, rank, suit });
    for (const a of AGENDAS) deck.push({ kind: 'agenda', id: this.nextId++, def: a.id });
    this.rd = this.rng.shuffle(deck);
    for (let i = 0; i < RULES.startHand; i++) this.hq.push(this.rd.shift()!);
    this.startTurn();
  }

  // ---- queries ----

  remote(id: RemoteId): Remote { return this.remotes.find((r) => r.id === id)!; }
  /** An ICE's STR where it stands: base + 1 per poker card of its suit in its remote. */
  iceStr(inst: IceInst, server: ServerId): { str: number; base: number; bonus: number } {
    const def = ICE_BY_ID[inst.def];
    const bonus = server === 'hq' || server === 'rd' ? 0 : this.remote(server).cards.filter((c) => c.suit === def.suit).length;
    return { str: def.str + bonus, base: def.str, bonus };
  }
  iceCost(def: string, server: ServerId): number { return ICE_BY_ID[def].cost + this.ice[server].length; }
  scorable(id: RemoteId): boolean {
    const r = this.remote(id);
    return !!r.agenda && made(AGENDA_BY_ID[r.agenda.def].hand, r.cards);
  }
  isOver(): boolean { return this.phase === 'over'; }
  private takeId(): number { return this.nextId++; }

  // ---- the Corp's commands (design §3) ----

  private spend(): Result {
    if (this.phase !== 'corp') return this.phase === 'over' ? 'THE GAME IS OVER' : 'DISCARD FIRST';
    if (this.clicks < 1) return 'NO CLICKS LEFT';
    return null;
  }

  draw(): Result {
    const e = this.spend(); if (e) return e;
    if (!this.rd.length) return 'R&D IS EMPTY';
    this.clicks--;
    this.hq.push(this.rd.shift()!);
    return null;
  }

  credit(): Result {
    const e = this.spend(); if (e) return e;
    this.clicks--;
    this.credits++;
    return null;
  }

  /** `target`: a remote id, or 'new' for the first remote not yet created. */
  install(cardId: number, target: RemoteId | 'new'): Result {
    const e = this.spend(); if (e) return e;
    const card = this.hq.find((c) => c.id === cardId);
    if (!card) return 'NOT IN HQ';
    const r = target === 'new' ? this.remotes.find((x) => !x.exists) : this.remote(target);
    if (!r) return 'NO ROOM FOR A NEW REMOTE';
    if (target !== 'new' && !r.exists) return 'NO SUCH REMOTE';
    if (card.kind === 'agenda') { if (r.agenda) return 'ONE AGENDA PER REMOTE'; }
    else if (r.cards.length >= RULES.remoteCards) return 'REMOTE IS FULL';
    this.clicks--;
    this.hq = this.hq.filter((c) => c !== card);
    r.exists = true;
    if (card.kind === 'agenda') { r.agenda = card; this.installedAt.set(card.id, this.turn); }
    else r.cards.push(card);
    return null;
  }

  installIce(def: string, server: ServerId): Result {
    const e = this.spend(); if (e) return e;
    if (!ICE_BY_ID[def]) return 'NO SUCH ICE';
    if (server !== 'hq' && server !== 'rd' && !this.remote(server).exists) return 'NO SUCH REMOTE';
    if (this.ice[server].length >= RULES.icePerServer) return 'SERVER HAS 3 ICE';
    const cost = this.iceCost(def, server);
    if (this.credits < cost) return `NEEDS ${cost}¢`;
    this.clicks--;
    this.credits -= cost;
    this.ice[server].push({ id: this.takeId(), def });
    return null;
  }

  score(id: RemoteId): Result {
    const e = this.spend(); if (e) return e;
    if (!this.scorable(id)) return 'HAND NOT MADE';
    const r = this.remote(id);
    const agenda = r.agenda!, def = AGENDA_BY_ID[agenda.def];
    this.clicks--;
    this.corpPoints += def.points;
    this.credits += r.cards.filter((c) => c.suit === 'd').length;
    this.scored.push(def.id);
    this.scoreLog.push({ def: def.id, turns: this.turn - (this.installedAt.get(agenda.id) ?? this.turn) });
    this.archives.push(...r.cards);
    r.cards = [];
    r.agenda = null;
    if (this.corpPoints >= RULES.goal) this.end('corp', `${this.corpPoints} AGENDA POINTS SCORED`);
    return null;
  }

  trash(id: RemoteId, cardId: number): Result {
    const e = this.spend(); if (e) return e;
    const r = this.remote(id);
    const card = r.cards.find((c) => c.id === cardId);
    if (!card) return 'NOT IN THAT REMOTE';
    this.clicks--;
    r.cards = r.cards.filter((c) => c !== card);
    this.archives.push(card);
    return null;
  }

  /** Discard a card from HQ to Archives. Free during the Corp's turn; at end of turn, until HQ is down to its max. */
  discard(cardId: number): Result {
    if (this.phase !== 'discard' && this.phase !== 'corp') return 'THE GAME IS OVER';
    const card = this.hq.find((c) => c.id === cardId);
    if (!card) return 'NOT IN HQ';
    this.hq = this.hq.filter((c) => c !== card);
    this.archives.push(card);
    if (this.phase === 'discard' && this.hq.length <= RULES.hqMax) this.runnerTurn();
    return null;
  }

  /** Clear a remote: its poker cards go to Archives, its agenda back to HQ. Its ICE stays. */
  clear(id: RemoteId): Result {
    const e = this.spend(); if (e) return e;
    const r = this.remote(id);
    if (!r.exists || (!r.cards.length && !r.agenda)) return 'NOTHING TO CLEAR';
    this.clicks--;
    this.archives.push(...r.cards);
    r.cards = [];
    if (r.agenda) { this.hq.push(r.agenda); this.installedAt.delete(r.agenda.id); r.agenda = null; }
    return null;
  }

  /** Ends the Corp's turn: discard down to the HQ max, then the Runner's turn, then the next Corp turn. */
  endTurn(): Result {
    if (this.phase !== 'corp') return this.phase === 'over' ? 'THE GAME IS OVER' : 'DISCARD FIRST';
    if (this.hq.length > RULES.hqMax) { this.phase = 'discard'; return null; }
    this.runnerTurn();
    return null;
  }

  // ---- turns ----

  private startTurn(): void {
    this.turn++;
    this.clicks = RULES.clicks;
    this.phase = 'corp';
    if (!this.rd.length) { this.end('runner', 'R&D IS EMPTY'); return; }
    // the forced draw spends the first click
    this.hq.push(this.rd.shift()!);
    this.clicks--;
  }

  private end(winner: 'corp' | 'runner', why: string): void {
    this.phase = 'over';
    this.winner = winner;
    this.why = why;
    this.events.push({ kind: 'over', winner, why });
  }

  /** Design §6: grow a breaker, then run. */
  private runnerTurn(): void {
    this.phase = 'corp';
    this.events = [{ kind: 'turn', turn: this.turn }];
    const breakers: Breaker[] = ['fracter', 'decoder', 'killer'];
    if (this.turn % RULES.growEvery === 0) {
      const grow = breakers[this.rng.int(3)];
      this.runner[grow]++;
      this.events.push({ kind: 'grow', breaker: grow, to: this.runner[grow] });
    }
    const runs = Math.max(0, RULES.runsPerTurn - this.runnerSlow);
    this.runnerSlow = 0;
    for (let i = 0; i < runs && !this.isOver(); i++) this.run(this.pickTarget());
    if (!this.isOver()) this.startTurn();
  }

  private pickTarget(): ServerId {
    const options: ServerId[] = ['rd'];
    if (this.hq.length) options.push('hq');
    for (const r of this.remotes) if (r.exists && (r.cards.length || r.agenda)) options.push(r.id);
    return options[this.rng.int(options.length)];
  }

  private run(server: ServerId): void {
    this.events.push({ kind: 'run', server });
    // outermost (last installed) first
    for (const inst of [...this.ice[server]].reverse()) {
      const def = ICE_BY_ID[inst.def];
      const { str } = this.iceStr(inst, server);
      const strength = this.runner[def.breaker];
      if (strength >= str) {
        this.events.push({ kind: 'broken', server, ice: def.id, str, breaker: def.breaker, strength });
        continue;
      }
      let effect = 'THE RUN ENDS';
      if (def.effect === 'slow') { this.runnerSlow++; effect = 'THE RUN ENDS. ONE FEWER RUN NEXT TURN'; }
      if (def.effect === 'burn') {
        const top = (['fracter', 'decoder', 'killer'] as Breaker[]).reduce((a, b) => (this.runner[b] > this.runner[a] ? b : a));
        if (this.runner[top] > 1) this.runner[top]--;
        effect = `THE RUN ENDS. ${top.toUpperCase()} -1`;
      }
      this.events.push({ kind: 'fired', server, ice: def.id, str, breaker: def.breaker, strength, effect });
      this.runLog.push({ server, result: 'stopped' });
      return;
    }
    this.access(server);
  }

  private access(server: ServerId): void {
    if (server === 'hq' || server === 'rd') {
      const pile = server === 'hq' ? this.hq : this.rd;
      if (!pile.length) { this.events.push({ kind: 'empty', server }); this.runLog.push({ server, result: 'empty' }); return; }
      const i = server === 'hq' ? this.rng.int(pile.length) : 0;
      const card = pile[i];
      if (card.kind === 'agenda') { pile.splice(i, 1); this.steal(server, card); }
      else { this.events.push({ kind: 'empty', server }); this.runLog.push({ server, result: 'empty' }); }
      return;
    }
    const r = this.remote(server);
    if (r.agenda) { const a = r.agenda; r.agenda = null; this.steal(server, a); return; }
    if (r.cards.length) {
      const card = r.cards[this.rng.int(r.cards.length)];
      r.cards = r.cards.filter((c) => c !== card);
      this.archives.push(card);
      this.events.push({ kind: 'trash', server, card });
      this.runLog.push({ server, result: 'trashed' });
      return;
    }
    this.events.push({ kind: 'empty', server });
    this.runLog.push({ server, result: 'empty' });
  }

  private steal(server: ServerId, agenda: AgendaCard): void {
    const def = AGENDA_BY_ID[agenda.def];
    this.runnerPoints += def.points;
    this.stolen.push(def.id);
    this.events.push({ kind: 'steal', server, agenda: def.id, points: def.points });
    this.runLog.push({ server, result: 'stole' });
    if (this.runnerPoints >= RULES.runnerGoal) this.end('runner', `${this.runnerPoints} AGENDA POINTS STOLEN`);
  }

  // ---- the view ----

  view(): GameView {
    const servers: ServerView[] = (['hq', 'rd', ...REMOTE_IDS] as ServerId[]).map((id) => {
      const ice = [...this.ice[id]].reverse().map((inst) => {
        const def = ICE_BY_ID[inst.def];
        return { id: inst.id, def: def.id, name: def.name, type: def.type, ...this.iceStr(inst, id) };
      });
      if (id === 'hq' || id === 'rd') return { id, name: SERVER_NAME[id], ice, cards: [], agenda: null, exists: true, scorable: false, progress: null };
      const r = this.remote(id);
      const p = r.agenda ? progress(AGENDA_BY_ID[r.agenda.def].hand, r.cards) : null;
      return {
        id, name: SERVER_NAME[id], ice, cards: r.cards.map((c) => ({ ...c })), agenda: r.agenda ? { ...r.agenda } : null, exists: r.exists,
        scorable: this.scorable(id), progress: p ? `${Math.min(p.have, p.need)} / ${p.need}` : null,
      };
    });
    return {
      seed: this.seed, turn: this.turn, phase: this.phase, winner: this.winner, why: this.why,
      clicks: this.clicks, credits: this.credits, corpPoints: this.corpPoints, runnerPoints: this.runnerPoints, goal: RULES.goal, runnerGoal: RULES.runnerGoal,
      hq: this.hq.map((c) => ({ ...c })), hqMax: RULES.hqMax, rdCount: this.rd.length, archivesCount: this.archives.length,
      servers, runner: { ...this.runner, runs: Math.max(0, RULES.runsPerTurn - this.runnerSlow) },
      scored: [...this.scored], stolen: [...this.stolen], events: [...this.events],
    };
  }
}
