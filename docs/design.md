# CYBERDECK: BREACH — Design Reference

Current design only. Edit in place; git is the history. Build state lives in `status.md`. Values DRAFT unless marked.

A Corp card roguelike set in the CYBERDECK: RUNTIME universe. Current core: THE ENCOUNTER (§5): poker hands advance an agenda; before each hand a Runner announces a run, and the ICE your hand fires both scores and stops it. Both sides (Corp and Runner) are built on one system (§6); the Corp side comes first. Earlier cores (RUMMY §2, SOLITAIRE §3, rejected: it felt hopeless, not like defending) stay playable from the start screen for comparison. Runtime supplies lore and stat words. Packet and Runtime are unchanged by Breach.

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

After SOS Titanic's rules (Cathala and Maublanc), on a standard deck. One round, no shop yet.

### Classes and cards
- Colour is class: red (hearts and diamonds) and black (spades and clubs). Classes never mix.
- Each class has every rank 1–13 twice.

### Zones
| Zone | Is |
|---|---|
| Server | 6 lines, S1 (first to flood) to S6. S1–S4 start with 4 / 6 / 8 / 10 cards face down, the front card face up. S5–S6 start empty. |
| Vault | 4 slots. An ace opens an empty slot; the vault then takes its colour in order upward (2, 3, ...). Nothing leaves a vault. |
| Deck | The rest, face down. Discards go to a discard pile. |

### A turn
1. Move cards, optional, any number:
   - A series (face-up cards in exact descending order, one colour) moves onto a line whose front card is the same colour and exactly one higher than the series' top card.
   - An empty line takes only a series topped by a king.
   - A line's front card moves into a vault if it fits.
   - When a line's face-up cards are gone, its next face-down card turns up.
2. One action, compulsory: RECOVER or play an operation.

### RECOVER
- Choose how many to draw: 1 to 3.
- If any drawn card fits a line or a vault, place exactly one of them; discard the rest.
- If none fits: discard them all, the breach advances 1, take an operation as compensation.
- Deck empty when drawing: shuffle the discards into a new deck; the breach advances 1 (no operation).

### The breach
- 12 steps. Each floods one compartment: S1 has 1, S2–S5 have 2, S6 has 3, flooded in order S1 to S6.
- When a server's last compartment floods, its cards are shuffled into the next server's cards face down, with the front card face up. Nothing is lost, but it is buried.
- The round ends at step 12, or when every card is in a vault.

### Score
- The highest card in each vault, plus the steps left.

### Operations
- Start with 2. The operation pile holds 17; used ones go to a used pile.

| Operation | Copies | Effect (SOS card) |
|---|---|---|
| LOOKAHEAD | 2 | Look at the top 5 of the deck; send any to the bottom. (Get Ready) |
| DEFRAG | 1 | Shuffle the deck and the discards together. No breach. (Save Time) |
| PLAN A | 1 | Take any operation from the pile. (Plan A) |
| PLAN B | 1 | Take any used operation. (Plan B) |
| PULL | 3 | Search the deck for a card that fits and place it. None: the breach advances 1. (Come On!) |
| RESTORE | 3 | As PULL, from the discards. (Come Back!) |
| REINDEX | 2 | Choose a line; pick any of its cards to be its face-up front; the rest go face down behind it. (Your Turn!) |
| REBALANCE | 2 | Choose two lines; shuffle their cards and deal them back face down in equal shares, front cards face up. (Same Lines!) |
| PURGE | 2 | Discard all face-up cards of one line; the next turns up. (Wait!) |

- ICE, executives and the shop come back once this round is fun.

---

## 5. THE ENCOUNTER

The Corp side on the system (§6). One agenda, one Runner. No shop, acts or corporations yet.

### Setup
- Pick 4 of 9 ICE. Order matters: left to right. All start unrezzed.
- Agenda: PROJECT ATLAS, 2 points, advancement 1,000.
- 4 hands, 3 discards, hand of 8, 52-card deck. 4 credits; +2 after every hand.
- Points track: CORP 0/7, RUNNER 0/7. Hold the agenda: +2 CORP. Lose it: PYROS steals it, +2 RUNNER.

### A hand
1. PYROS announces a run: a breaker (FRACTER, DECODER or KILLER, random) and a strength (4, 5, 6, 7 across the 4 hands), plus a payload.
2. Before playing, any number of: REZ an ICE (its rez cost) · TRASH a rezzed ICE (this run is stopped; the ICE is gone) · reorder ICE · discard.
3. Play 1–5 cards, scored as Balatro (chips x mult, card by card). Then rezzed ICE fires left to right if the hand meets its condition and the breaker does not break its type: its effect scores, its strength adds up.
4. Fired strength at or above the run's: stopped. Below: the payload lands, and it counts as a hit.
- 2 hits: PYROS steals the agenda at once. Reach 1,000 before then (and before the hands run out) to hold it.
- Selecting cards previews advancement, which ICE fire, and strength against the run.

### Payloads (4 of 5, no repeats)
| Payload | If it lands |
|---|---|
| BURN THE EVIDENCE | Burns your 3 highest cards in hand; not replaced until after your next hand |
| MELTDOWN | Derezzes your strongest rezzed ICE |
| SCORCHED EARTH | Your next hand advances nothing |
| SIPHON | Steals 40% of your advancement so far |
| OVERHEAT | You lose a hand |

### ICE (pick 4)
| ICE | Type | STR | Rez | Fires when | Effect |
|---|---|---|---|---|---|
| ICE WALL | Barrier | 2 | 1 | Always | +4 mult |
| RAMPART | Barrier | 4 | 3 | A spade scores | +3 mult per scored spade |
| BLACKWALL | Barrier | 6 | 4 | You play 5 cards | x1.5 mult |
| HONEYPOT | Code gate | 2 | 1 | You play a card ranked 2 to 6 | +30 chips |
| CIPHER | Code gate | 4 | 2 | The hand contains a pair | +8 mult |
| NEURAL FIREWALL | Code gate | 3 | 2 | You play 3 or fewer cards | +60 chips |
| TRACE SCRAMBLER | Sentry | 3 | 2 | You play a face card | +3 credits |
| LOCKDOWN | Sentry | 4 | 3 | The hand has no pair | +6 mult |
| ADAPTIVE ICE | Sentry | 5 | 4 | A straight or a flush | x2 mult |

---

## 6. The system (both sides)

One rules set, two asymmetric roles. Each side's build is the other side's content.

### Shared
- A poker hand (1–5 cards, scored as Balatro) is the action.
- Named pieces fire left to right: Corp ICE, Runner breakers. Each has a type, a strength, a condition and an effect.
- Type triangle: barrier / fracter, code gate / decoder, sentry / killer.
- Contests are strength against strength. Credits pay to switch pieces on.

### Contest
- An attacker names a type and a strength. Every defending piece of the matching type is broken for that hand.
- Pieces whose condition the hand meets fire: their effect scores, their strength adds to the contest.
- Fired strength at or above the attacker's: the defender wins the contest.

### Asymmetry
| | Corp | Runner |
|---|---|---|
| Goal | Advance an agenda over many hands | One deep run past layers of ICE |
| Information | Sees the attack coming | ICE face down until approached |
| Main decision | Score or defend | Go one layer deeper or jack out |
| Credits | Rez ICE (each agenda, per piece) | Boost or break, per ICE |
| Lose by | Too many runs land: agenda stolen | Damage shrinks hand size |
| Build | Wide: cover every type | Narrow: answer specific threats |
- A row that plays the same on both sides is a defect.

### Play
- Single player against bots first.
- Multiplayer, if ever: async only. A player's Corp build (agenda + ICE in order) becomes a server other players' Runners attack, played by the bot. No live play.


---

## 4. Later

- The kept core grows into a full run: more rounds, Runners with twists, deck work.
