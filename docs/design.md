# CYBERDECK: BREACH — Design Reference

Current design only. Edit in place; git is the history. Build state lives in `status.md`. Values DRAFT unless marked.

A Corp game set in the CYBERDECK: RUNTIME universe. A Runner has hacked a blackjack table in a Corp casino and is counting cards to drain the house. You are the casino's security: you deal, and your ICE bends the table against them. Runtime supplies lore and stat words; Breach has its own mechanics. Packet and Runtime are unchanged by Breach.

---

## 1. Pillars

- The hook is blackjack: everyone knows it, and in blackjack the house sits at the table.
- The Runner cheats; you defend. A breach is one Runner at one table.
- Every hand asks a small decision: spend a charge now, or save it for the big bet.
- ICE is the build: charged ICE are the active plays, passive ICE are always-on rules (the jokers).
- Corp first, against a bot. No multiplayer for now.

---

## 2. The Table

- Shoe: 2 standard decks. Reshuffled automatically when fewer than 26 cards remain.
- Dealer rules: hits to 17, stands on all 17s. Blackjack pays 3:2. The Runner may double on any first two cards. No splits, no insurance (for now).
- The Corp sees the next two cards in the shoe and the dealer's hole card at all times.
- A dealer blackjack is checked after the deal: the hand ends at once.

---

## 3. The Breach

- The Runner sits with a bankroll and a target. It wins the breach by reaching the target; the house holds if the hands run out first or the Runner can't cover the minimum bet.

| Value | |
|---|---|
| Bankroll | 100 |
| Target | 140 |
| Hands | 12 |
| Base bet | 20 |
| Maximum bet | 80 |
| Minimum bet | 10 |

---

## 4. The Runner (bot)

- Counts cards (Hi-Lo: 2–6 = +1, 7–9 = 0, 10–A = −1) over every card it has seen since the last shuffle. True count = running count / decks left in the shoe.
- Bets the base bet at a true count of 1 or less; otherwise the base bet × the true count, up to the maximum and its bankroll.
- Plays basic strategy for dealer-stands-on-17, without splits.
- Its count and next bet are shown to the Corp.

---

## 5. ICE

- Loadout: all four charged ICE, plus 2 passive ICE picked before the breach.
- Charges do not refill during a breach.

### Charged

| ICE | Charges | When | Effect |
|---|---|---|---|
| RESHUFFLE | 2 | After the bet, before the deal | Shuffle the whole shoe. The Runner's count resets to 0. |
| SECOND DEAL | 3 | Any card about to be dealt | Deal the second card in the shoe instead of the top one. |
| HOLE SWAP | 1 | After the Runner stands | Swap the dealer's hole card with the top card of the shoe. |
| VOID | 1 | Any time before the hand settles | Cancel the hand. The bet returns. |

### Passive (pick 2)

| ICE | Effect |
|---|---|
| HOUSE TIES | Pushes go to the house. |
| EVEN MONEY | Runner blackjacks pay 1:1. |
| STAND 16 | The dealer stands on 16 or more. |
| COLD SHOE | After a RESHUFFLE, the Runner bets the minimum on the next hand whatever the count. |

---

## 6. Presentation

- Suits are drawn as glyphs, never the Unicode suit characters (they carry the Emoji property).
- The deal goes card by card; every card the Corp could second-deal waits for DEAL or SECOND DEAL.

---

## 7. Later

- Rounds against harder Runners; the Boardroom (shop) between them: new ICE, more charges, more slots.
- Named Runners with their own exploits (peeking at the hole card, splitting, two hands).
- Wilder passive ICE that combine.

---

## 8. Open Design

- All numbers in §3–§5.
- Whether the Corp should see two cards ahead or one.
