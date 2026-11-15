# CYBERDECK: BREACH — Design Reference

Current design only. Edit in place; git is the history. Build state lives in `status.md`. Values DRAFT unless marked.

A Corp card game set in the CYBERDECK: RUNTIME universe: you build poker hands face down inside your servers to score agendas, while a Runner bot runs your servers to steal them. Runtime supplies lore and stat words; Breach has its own mechanics. Packet and Runtime are unchanged by Breach.

Terminology: ICE has **STR**. Money is **credits** (¢). Actions are **clicks**. The draw pile is **R&D**, the hand is **HQ**, the discard pile is **Archives**.

---

## 1. Pillars

- Corp first, against a bot. No multiplayer for now.
- A server is a poker hand built over several turns, face down. Greed against exposure is the core decision.
- Agendas are cards that name the hand they need.
- Suits are the four plain suits. They feed ICE (§5) and credits; they are not corps or card types.
- One trigger, one effect, plain numbers.

---

## 2. The Board

| Zone | What it is |
|---|---|
| R&D | The Corp's draw pile: 52 poker cards + 8 agendas, shuffled. |
| HQ | The Corp's hand. Max 5 at end of turn. |
| Archives | Discard pile. Not runnable (for now). |
| Remote | Up to 3. Each holds up to 5 poker cards + 1 agenda (the agenda is outside the 5). Created by installing into a new remote; a remote stays once created. |
| ICE | Up to 3 per server, on HQ, R&D or a remote. The last installed is outermost. |

- Start: 5 cards in HQ, 5¢.

---

## 3. The Corp Turn

1. Draw 1 (free). R&D empty → the Corp loses.
2. Spend 4 clicks, one action each:

| Action | Effect |
|---|---|
| DRAW | Draw 1. |
| CREDIT | +1¢. |
| INSTALL | A card from HQ into a remote (existing or new). |
| ICE | Install an ICE (§5) on any server: its cost + 1¢ per ICE already on that server. Installed rezzed. |
| SCORE | A remote whose agenda's hand is made: the agenda scores, +1¢ per diamond in the remote, its poker cards go to Archives. ICE stays. |
| TRASH | A poker card from a remote to Archives. |

3. Discard down to 5 in HQ (Corp's pick).
4. The Runner's turn (§6).

- Win: 7 agenda points. Lose: the Runner steals 7, or R&D is empty at a draw.

---

## 4. Agendas

- An agenda names a hand. It scores when its remote's poker cards contain that hand.
- Hands as poker: a pair, two pair, three of a kind, straight (ace high or low), flush, full house, four of a kind, straight flush. "Contains": a pair is also made by three of a kind; two pair by a full house.

| Agenda | Hand | Points |
|---|---|---|
| CURFEW PROTOCOL | Pair | 1 |
| GRID PACIFICATION | Pair | 1 |
| LOBBY LEDGER | Two pair | 2 |
| BOARD SEAT | Two pair | 2 |
| MARKET CORNER | Three of a kind | 2 |
| MERGER TERMS | Straight | 3 |
| GENOME DEED | Flush | 3 |
| ORBITAL DENIAL | Full house | 4 |

---

## 5. ICE

- ICE on a remote gains +1 STR per poker card of its suit in that remote. ICE on HQ or R&D has its base STR.
- Diamonds feed no ICE: they pay on SCORE.

| ICE | Type | Suit | Cost | STR | When it fires |
|---|---|---|---|---|---|
| RAMPART | Barrier | spades | 2¢ | 2 | Ends the run. |
| CIPHER | Code Gate | hearts | 3¢ | 3 | Ends the run. The Runner makes one fewer run next turn. |
| WATCHDOG | Sentry | clubs | 3¢ | 2 | Ends the run. The Runner's strongest breaker −1. |

---

## 6. The Runner (bot)

- Three breakers: FRACTER (breaks Barriers), DECODER (Code Gates), KILLER (Sentries). Each starts at 1.
- Each Runner turn: on even turns one random breaker +1; then 2 runs.
- A run picks a random target: HQ (if not empty), R&D, or a remote holding a card.
- ICE is encountered outermost first. The matching breaker's strength ≥ the ICE's STR → broken, go on. Otherwise the ICE fires and the run ends.
- Access (past every ICE):
  - HQ: one random card. An agenda is stolen.
  - R&D: the top card. An agenda is stolen.
  - Remote: the agenda is stolen if there is one; otherwise one random poker card is trashed.
- The Runner sees only card counts. Later bots read them (§8).

---

## 7. Presentation

- Suits are drawn as glyphs, never the Unicode suit characters (they carry the Emoji property).
- The Corp sees its own cards face up; the Runner's view is counts only.

---

## 8. Later

- Smarter Runner bots: favour fuller remotes, then read install patterns (the first bot bluffing can fool).
- Traps (a card that punishes access), assets and upgrades as non-poker cards: wild cards, rank shifters.
- Corp identities (ENCLAVE, SAMSARA, LIMINAL, KERN): starting rules and ICE pools.
- Executives: run-long rules picked between rounds.
- The roguelike: rounds against stronger Runners, drafting agendas and ICE between them.

---

## 9. Open Design

- All numbers: points to win, breaker growth, runs per turn, ICE stats, agenda mix.
- Whether HQ and R&D access should be stronger than one card.
- A click to peek at or bottom the top of R&D, if draws prove too swingy.
