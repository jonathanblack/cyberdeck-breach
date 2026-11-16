# CYBERDECK: BREACH — Design Reference

Current design only. Edit in place; git is the history. Build state lives in `status.md`. Values DRAFT unless marked.

A Corp roguelike set in the CYBERDECK: RUNTIME universe. Each round a Runner announces a breach on your agenda; you play poker hands to charge the ICE on your server, order it, and hold. Runtime supplies lore and stat words; Breach has its own mechanics. Packet and Runtime are unchanged by Breach.

---

## 1. Pillars

- Poker is the engine (as in Balatro); ICE is the build (the jokers).
- Every round builds to one breach. The Runner's number and twist are known up front.
- Order matters: the Runner hits ICE outermost first, and twists punish careless order.
- A run carries your deck, ICE collection, slots and credits; the server is rebuilt each round.
- Corp first, against a bot. No multiplayer for now.

---

## 2. The Run

- A run is a series of rounds. Each round has one agenda and one Runner.
- Hold the breach: the agenda scores its points for you. Lose it: the Runner steals them.
- Win the run at 7 agenda points. The Runner reaching 7 ends it.
- Between rounds: the Boardroom (§7).

| Round | Agenda points | Breach |
|---|---|---|
| 1 | 1 | 300 |
| 2 | 1 | 450 |
| 3 | 2 | 700 |
| 4 | 2 | 1000 |
| 5 | 3 | 1350 |
| 6 | 3 | 1750 |
| 7 | 3 | 2200 |
| 8+ | 3 | +500 each round |

---

## 3. A Round

- Draw to a hand of 8 from your deck (52 standard cards, shuffled each round).
- 4 hands and 3 discards per round.
- PLAY: 1–5 cards as a poker hand onto one installed ICE. The hand's STR goes to that ICE (§4, §5).
- DISCARD: 1–5 cards, then draw back to 8.
- The ICE order can be changed any time before the breach, including after the last hand.
- BREACH: you commit when ready (any time; necessarily once the hands are spent).

---

## 4. Hand STR

- STR = the hand's base + the value of its scoring cards (2–10 face value, J Q K 10, A 11).
- Only the cards that make the hand score (a pair scores its two cards; a high card scores one).
- Straights and flushes need 5 cards. Ace plays high or low in a straight.

| Hand | Base |
|---|---|
| High card | 10 |
| Pair | 40 |
| Two pair | 80 |
| Three of a kind | 100 |
| Straight | 130 |
| Flush | 140 |
| Full house | 180 |
| Four of a kind | 250 |
| Straight flush | 400 |

---

## 5. ICE

- Slots: 3 to start. ICE owned beyond the slots sits out; choose what is installed in the Boardroom.
- Start of a run: RAMPART, CIPHER, WATCHDOG.
- Each ICE starts every round at its base STR (0 unless listed).

| ICE | Type | Cost | Power |
|---|---|---|---|
| RAMPART | Barrier | 5¢ | +30 for every spade played on it. |
| CIPHER | Code Gate | 5¢ | A pair or two pair played on it counts ×2. |
| WATCHDOG | Sentry | 5¢ | Every card played on it gives +10 to each other installed ICE. |
| BULWARK | Barrier | 6¢ | A flush played on it counts ×2. |
| TRIPWIRE | Sentry | 6¢ | A straight played on it counts ×2. |
| HUSK | Barrier | 4¢ | Base 150. Cannot be played on. |
| ANCHOR | Barrier | 7¢ | At the breach: ×2 if it is the innermost ICE. |
| SIEVE | Code Gate | 6¢ | At the breach: +60 for every hand left unplayed. |
| LEECH | Sentry | 5¢ | At the breach: +40 for every discard left unused. |
| CHORUS | Code Gate | 6¢ | +15 for every face card played on any ICE. |
| MIRROR | Code Gate | 8¢ | At the breach: gains half the STR of the ICE just inside it. |
| STATIC | Sentry | 4¢ | A high card played on it scores as two pair. |

---

## 6. The Breach

- The Runner's breach number is cut by each ICE in turn, outermost first: each ICE absorbs up to its STR.
- Anything left after the innermost ICE reaches the agenda: the Runner steals it.
- Each Runner has one twist, shown from the start of the round:

| Runner | Faction | Twist |
|---|---|---|
| SPARK | PYROS | Burns the outermost ICE: it counts half. |
| KNOT | THE SYNDICATE | Ignores your weakest ICE. |
| WRIGHT | WRIGHTS | +50 to the breach for every discard you used. |
| HALO | PYROS | Code Gates count half. |
| VEIL | THE SYNDICATE | Hides the breach number until 2 hands are played. |

- Round 1 is SPARK; later rounds draw a Runner at random.

---

## 7. The Boardroom

- Payout after every round: 4¢, +1¢ per hand and discard left unused, +1¢ per 5¢ held (max 5).
- Offers: 3 ICE from the pool you don't own, at their cost. REROLL: 2¢.
- +1 SLOT: 10¢, then 15¢.
- UPGRADE an owned ICE: each level +50% to the STR a hand gives it. Cost 4¢, +3¢ per level already bought. HUSK cannot be upgraded.
- SELL an owned ICE: half its cost.
- Choose which owned ICE is installed, up to the slots.

---

## 8. Presentation

- Suits are drawn as glyphs, never the Unicode suit characters (they carry the Emoji property).
- The breach plays out layer by layer: each ICE absorbs, the number falls.

---

## 9. Later

- Deck work in the Boardroom: remove, copy, change suits, special cards.
- Executives: run-long rules.
- More ICE and Runners; Black ICE as rare pieces.

---

## 10. Open Design

- All numbers.
- Whether the server should persist between rounds instead of being rebuilt.
