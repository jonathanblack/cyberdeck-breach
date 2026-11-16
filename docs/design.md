# CYBERDECK: BREACH — Design Reference

Current design only. Edit in place; git is the history. Build state lives in `status.md`. Values DRAFT unless marked.

A Corp card roguelike set in the CYBERDECK: RUNTIME universe. Two cores are being tested as slices (2 rounds with a shop between): RUMMY (build melds as servers while a Runner raids them) and SOLITAIRE (save data into vaults while a breach spreads, after SOS Titanic). One is kept. Runtime supplies lore and stat words. Packet and Runtime are unchanged by Breach.

---

## 1. Shared

- Standard 52-card deck. Suits are drawn glyphs.
- Card points: 2–10 face value, J Q K 10, A 11.
- A slice is 2 rounds with a shop between. Fail a round: the slice ends.
- Shop: 3 offers drawn from the slice's pool; credits carry over.

---

## 2. RUMMY

### Zones
| Zone | Is |
|---|---|
| R&D | Draw pile: 52 cards + 4 operations. |
| HQ | Your hand. Start 10. |
| Archives | Discard pile; its top card is visible. |
| Server | A meld on the table. Up to 4. |

### A turn
1. DRAW: the top 2 of R&D, or TAKE the top of Archives.
2. Any number of: LAY a meld from HQ as a new server · EXTEND a server with a card that fits · play an OPERATION · install ICE on a server (2 credits) · CASH a server.
3. DISCARD 1 card to Archives: the turn ends.
- +1 credit at the start of every turn. Start with 4.

### Melds
- Set: 3+ cards of one rank. Run: 3+ consecutive cards of one suit (ace high or low, no wrap).
- CASH: points = card points x mult; mult = cards − 2 (min 1), plus levels and Assets. The server is cleared.
- Cashing pays +1 credit per diamond.

### The round
| Round | Agenda | Target | Turns | Runner STR |
|---|---|---|---|---|
| 1 | PROJECT ATLAS | 100 | 10 | 2 |
| 2 | ORBITAL DENIAL | 200 | 10 | 3 |

- The Runner runs after every even turn at your highest-value server.
- Credits after round 1: 4 + 1 per 20 points over the target.
- ICE with STR ≥ the Runner's STR stops the run. Otherwise the Runner steals the meld's highest card; a meld left under 3 cards breaks and its cards go to Archives.
- ICE starts at STR 2; one ICE per server; it stays until its server is cashed or broken.
- Reach the target by the end of the last turn, or the round is lost.

### Operations (one use each per round; in R&D)
| Operation | Effect |
|---|---|
| FAST TRACK | Draw 2. |
| HOSTILE TAKEOVER | Take the top 3 cards of Archives. |
| SHORT MELD | The next meld you lay may be 2 cards. |
| OVERTIME | +2 turns this round. |

### Shop pool
| Offer | Cost | Effect |
|---|---|---|
| SPADE FOUNDRY | 6 | Asset: spade runs score x2. |
| QUORUM | 6 | Asset: sets of 4 score x2. |
| ARCHIVIST | 5 | Asset: taking from Archives also draws 1 from R&D. |
| DIAMOND DESK | 5 | Asset: cashing pays +2 more per diamond. |
| LONG GAME | 7 | Asset: melds of 6+ cards score x3. |
| RUN PROTOCOL | 4 | Runs +1 mult. |
| SET PROTOCOL | 4 | Sets +1 mult. |
| ICE GRADE | 4 | All ICE +1 STR. |
| OVERTIME | 3 | A second OVERTIME in R&D. |

---

## 3. SOLITAIRE

### Zones
| Zone | Is |
|---|---|
| Deck | 52 cards, face down. |
| Server | 4 columns. A card goes on a server whose top card is one rank higher and the other colour; an empty server takes any card. |
| Vault | 4, one per suit. Takes that suit in order from the ace up. |
| Recovery row | Cards revealed this turn. |

### A turn
- Free, any number: move a server's top card to a vault or another server, if it fits.
- Then one action:
  - RECOVER: reveal 4 from the deck. Place exactly one (vault or server); the rest go to the bottom of the deck. If none fits: NONE FITS, and the breach spreads 1.
  - Or play an OPERATION.
- Every 4th turn the breach spreads 1 on its own.

### The breach
- Track 0–8. At 2, 4, 6 and 8 the next server goes dark (left to right): its cards are lost.
- At 8 the round ends. LOCK DOWN ends it early.
- Score: cards in the vaults.

| Round | Target |
|---|---|
| 1 | 8 |
| 2 | 14 |

### ICE (placed on a server before each round)
| ICE | When its server would go dark |
|---|---|
| BARRIER | The ICE breaks; the server survives. |
| CODE GATE | The breach skips to the next server. |
| SENTRY | The server goes dark, the breach falls back 1. |
- Start with one BARRIER.

### Operations (one use each per round)
| Operation | Effect |
|---|---|
| TRACE | The breach falls back 1. |
| DEEP SEARCH | Take any card from the deck into the recovery row; place it. |
| FAST TRACK | RECOVER reveals 7 this turn. |

### Shop pool
| Offer | Cost | Effect |
|---|---|---|
| COLD STORAGE | 8 | Executive: a vault takes the next rank in any suit. |
| WIDE NET | 5 | Executive: RECOVER reveals 5. |
| REDUNDANCY | 5 | Executive: the first server to go dark each round survives. |
| SLOW BURN | 5 | Executive: the breach spreads on its own every 6th turn. |
| BARRIER / CODE GATE / SENTRY | 3 / 4 / 4 | One more ICE. |
| TRACE | 4 | A second TRACE. |

- Credits after round 1: 6 + 1 per card saved over the target.

---

## 4. Later

- The kept core grows into a full run: more rounds, Runners with twists, deck work.
