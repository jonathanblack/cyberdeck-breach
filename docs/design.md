# CYBERDECK: BREACH — Design Reference

Current design only. Edit in place; git is the history. Build state lives in `status.md`. Values DRAFT unless marked.

A Corp roguelike set in the CYBERDECK: RUNTIME universe. Step 1 of a plan: Balatro's proven scoring core under Netrunner names, with no Corp twist yet. Each round a Runner probes your server; you play poker hands to out-score its breach number. Once this core is confirmed fun, Corp twists are added one at a time and kept only if they make it better. Runtime supplies lore and stat words. Packet and Runtime are unchanged by Breach.

---

## 1. Pillars

- Balatro's scoring as-is: chips x mult, card by card, with ICE (the jokers) triggering in order.
- ICE stacks: flat chips, +mult, xmult, per-card triggers, scaling, economy.
- The score plays out step by step on screen.
- One change at a time from here.

---

## 2. The Run

- 4 antes of 3 rounds: two Runner probes, then a named Runner with a twist. Beat ante 4's named Runner to win the run.
- Fail a round (hands run out below the breach number): the run ends.

| Ante | Probe | Second probe | Named Runner |
|---|---|---|---|
| 1 | 300 | 450 | 600 |
| 2 | 800 | 1,200 | 1,600 |
| 3 | 2,000 | 3,000 | 4,000 |
| 4 | 5,000 | 7,500 | 10,000 |

- Reward on winning a round: 3¢ / 4¢ / 5¢, +1¢ per hand left, +1¢ per 5¢ held (max 5). Start with 4¢.

---

## 3. A Round

- Deck: 52 standard cards, shuffled each round. Hand of 8.
- 4 hands and 3 discards.
- PLAY 1–5 cards: score = chips x mult, added to the round total.
- DISCARD 1–5 cards, draw back to 8.

---

## 4. Scoring

1. The hand's base chips and mult (by its level).
2. Each scoring card, left to right: its chips (2–10 face value, J Q K 10, A 11), then ICE that trigger on cards.
3. Each installed ICE, left to right: its independent effect (+chips, +mult, then xmult in that order).
- Only the cards that make the hand score. "Contains": two pair, three of a kind, full house and four of a kind contain a pair; a full house contains three of a kind and two pair; a straight flush contains a straight and a flush.

| Hand | Chips | Mult | Per level |
|---|---|---|---|
| High card | 5 | 1 | +10 / +1 |
| Pair | 10 | 2 | +15 / +1 |
| Two pair | 20 | 2 | +20 / +1 |
| Three of a kind | 30 | 3 | +20 / +2 |
| Straight | 30 | 4 | +30 / +3 |
| Flush | 35 | 4 | +15 / +2 |
| Full house | 40 | 4 | +25 / +2 |
| Four of a kind | 60 | 7 | +30 / +3 |
| Straight flush | 100 | 8 | +40 / +4 |

---

## 5. ICE

- 5 slots. Order matters: left to right.

| ICE | Cost | Effect |
|---|---|---|
| ICE WALL | 4¢ | +4 mult. |
| RAMPART | 5¢ | Each scored spade: +3 mult. |
| CHORUS | 5¢ | Each scored face card: +30 chips. |
| STATIC | 6¢ | Each scored A, 2, 3, 5 or 8: +8 mult. |
| MIRROR | 7¢ | The first scored card scores twice. |
| CIPHER | 4¢ | +8 mult if the hand contains a pair. |
| WATCHDOG | 4¢ | +50 chips if the hand contains a pair. |
| TRIPWIRE | 5¢ | +12 mult if the hand contains a straight. |
| BULWARK | 5¢ | +10 mult if the hand contains a flush. |
| SENTINEL | 5¢ | +20 mult if 3 or fewer cards are played. |
| HUSK | 5¢ | +30 chips per discard left. |
| LEECH | 6¢ | Gains +1 mult every time you play a hand (grows). |
| HYDRA | 7¢ | x1 mult, +x0.25 every time a hand containing a pair is played (grows). |
| ANCHOR | 7¢ | x3 mult on the last hand of a round. |
| BLACK ICE | 9¢ | x3 mult. |
| SIPHON | 6¢ | Earn 4¢ at the end of every round. |

---

## 6. Named Runners

| Runner | Faction | Twist |
|---|---|---|
| SPARK | PYROS | Spades don't score. |
| KNOT | THE SYNDICATE | Only 1 hand this round. |
| WRIGHT | WRIGHTS | Face cards don't score. |
| HALO | PYROS | Your leftmost ICE does nothing. |
| VEIL | THE SYNDICATE | No discards this round. |

- A card that doesn't score still counts toward the hand's type.
- Each ante's named Runner is drawn at random, without repeats.

---

## 7. The Shop

- After every round won.
- 2 ICE and 1 PROTOCOL on offer. PROTOCOL: +1 level to one named hand, 3¢.
- REROLL: 5¢, +1¢ each time this shop.
- SELL an ICE: half its cost.
- Drag order: move ICE left or right.

---

## 8. Presentation

- Suits are drawn as glyphs, never the Unicode suit characters (they carry the Emoji property).
- Each played hand plays out: base, then every card and ICE that adds, with chips and mult counting up.

---

## 9. Next: Corp twists to test, one at a time

- The agenda: a round's breach target is an agenda; losing a round steals it instead of ending the run (7 points).
- Server order: ICE positions as layers the Runner hits.
- Runner breakers that disable an ICE type.
