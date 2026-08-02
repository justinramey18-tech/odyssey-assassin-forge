# Wire NPC social rolls to the Dice Odds setting

Right now, when you tag an NPC and tap Persuasion / Intimidation / Insight / Deception, only *your* roll respects the Dice Roll Odds setting. The NPC's opposing roll is always a plain random d20 plus a random bonus, so the contest doesn't reflect the mode you chose.

## What changes

The NPC's opposing roll gets its own odds mode, mirrored from yours:

| Your setting | NPC uses |
| --- | --- |
| Fair Play | Fair Play |
| Heroic | Cursed |
| Dramatic | Dramatic |
| Chaotic Neutral | Chaotic Neutral |
| Cursed | Heroic |

So in Heroic you almost always come out on top, in Cursed the NPC almost always does, in Fair it's a genuine coin-flip, and in Dramatic both sides swing to extremes.

## Also checked as part of the fix

Since you're seeing failures every time, I'll also confirm the bonus math isn't quietly stacked against you: the NPC currently gets a random bonus of up to roughly +4 or more (scaling with your level), while your own bonus comes from your character's Charisma/Wisdom and skill proficiencies. If your character sheet's ability scores aren't reaching this feature, your bonus would be 0 while the NPC always gets one — which alone would explain constant losses. I'll verify that during the change and, if it's broken, make sure your real modifier is used and the NPC's bonus is centred rather than always positive.

## Technical notes

- `src/lib/npcSocialChecks.ts`: add an odds-mirror map, and change `rollNpcOpposingCheck` to take the player's mode and roll via `rollWeightedDie(20, mirroredMode)` instead of the unweighted `rollDie(20)`. `resolveSocialCheck` reads the mode once (`loadDiceOddsMode()`) and passes it to both rolls so player and NPC stay in sync.
- No UI or edge function changes; the roll-block text and outcome logic stay as they are.
