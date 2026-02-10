

# More Regex Patterns for Offline Chronicle

After thoroughly reviewing every pattern file in the system, here are the concrete gaps where adding more regex patterns will meaningfully improve detection accuracy.

---

## 1. Expanded Damage Patterns (patterns.ts)

Current patterns miss several common DM phrasings:

- **Dice result damage**: "The fireball deals 8d6 (28) fire damage" -- the parenthetical total is missed
- **Named attacker damage**: "The orc hits you for 12" -- no "damage" keyword present
- **Passive/environmental**: "You fall 30 feet, taking 3d6 (10) damage" or "the lava deals 10 fire damage per round"
- **Damage on failed save**: "On a failed save, you take 14 radiant damage"
- **Reduction wording**: "Your HP drops by 15", "HP reduced by 8"

---

## 2. Expanded Healing Patterns (patterns.ts)

Missing natural language healing:

- **Named spell healing**: "Cure Wounds heals you for 12 HP" (verb before amount)
- **Passive recovery**: "You are healed for 8 hit points"
- **Dice result healing**: "heals 2d8+3 (14) HP" -- parenthetical total
- **Generic positive HP**: "You feel 10 hit points return", "recovers to full HP"

---

## 3. Expanded XP Patterns (patterns.ts)

Missing variants:

- **Party XP split**: "each party member gains 200 XP", "split 800 XP among 4 players"
- **Per-creature XP**: "100 XP per goblin", "worth 450 XP each"
- **Milestone phrasing**: "milestone reached: 1000 XP", "quest reward: 500 XP"
- **Negative XP phrasing used positively**: "XP reward of 300", "XP bounty: 200"

---

## 4. Expanded Gold Patterns (patterns.ts)

Missing:

- **Treasure hoard**: "a hoard containing 500 gold", "the chest holds 200 gp"
- **Reward phrasing**: "reward of 100 gold", "bounty: 300 gp", "payment of 50 gold"
- **Informal**: "hands you 100 gold", "gives the party 250 gp"
- **Mixed currency in one phrase**: "2 pp, 15 gp, 30 sp" (comma-separated list)

---

## 5. Expanded Item Detection (patterns.ts)

Missing item types and phrasings:

- **Non-consumable magic items**: "find a +1 Longsword", "loot a Ring of Protection"
- **Wondrous items**: "Bag of Holding", "Cloak of Elvenkind", "Boots of Speed"
- **Ammunition**: "20 arrows", "a quiver of bolts", "3 silvered arrows"
- **Generic loot phrasing**: "takes the amulet", "picks up the staff", "pockets the gem"
- **Gift/reward items**: "the king gives you a magical sword", "rewards you with a ring"

---

## 6. Expanded Condition Patterns (patterns.ts)

Missing conditions and phrasings:

- **Exhaustion levels**: "gains 1 level of exhaustion", "exhaustion level increases to 3"
- **Concentration broken**: "loses concentration", "concentration is broken"
- **Temp conditions**: "is knocked prone", "falls prone", "knocked unconscious"
- **Advantage/disadvantage context**: "has advantage on attacks", "disadvantage on saves"
- **More removal phrases**: "recovers from", "throws off the", "resists the", "saves against the"

---

## 7. Expanded Shop Item Patterns (shopItems.ts)

Missing merchant interaction styles:

- **List format with bullets**: "* Healing Potion - 50 gp" (asterisk/bullet lists)
- **Numbered lists**: "1. Longsword - 15 gp"
- **Quantity in shop**: "3x Potion of Healing at 50 gp each", "Arrows (20) - 1 gp"
- **Discount/haggle**: "reduced to 40 gp", "offers it for 80 gp instead"
- **Multi-currency shop prices**: "costs 5 pp" or "selling for 50 sp"

---

## 8. Expanded Enemy Detection (enemies.ts)

Missing encounter phrasings:

- **Summoned creatures**: "summons a fire elemental", "conjures 4 wolves"
- **Revealed enemies**: "a mimic reveals itself", "the chest is actually a mimic"
- **Lair/environmental**: "the dragon's lair contains", "guarded by 2 wights"
- **Multi-enemy in one line**: "3 goblins and 2 hobgoblins" (split on "and")
- **Reinforcements**: "reinforcements arrive: 4 more orcs", "2 additional skeletons rise"

---

## 9. Expanded Saving Throw Patterns (savesAndChecks.ts)

Missing:

- **Group saves**: "everyone makes a DEX save", "the party rolls WIS saves"
- **Contested checks**: "contested Strength check", "opposed Athletics vs Acrobatics"
- **Flat check**: "DC 10 flat check", "make a flat DC 15 check"
- **Advantage/disadvantage on saves**: "save with advantage", "disadvantage on the save"
- **Aura/AoE saves**: "all creatures within 20 feet must make a CON save"

---

## 10. New Pattern Category: Attack Roll Detection

Currently no dedicated attack roll parsing. Add:

- **Hit/miss**: "rolls 18 to hit (AC 15) -- hit!", "attack roll: 12 vs AC 16 -- miss"
- **Named weapon attacks**: "swings the greataxe -- 22 to hit", "fires an arrow -- 17 to hit"
- **Attack modifiers**: "+7 to hit", "attack bonus: +5"
- **Sneak attack**: "adds 3d6 sneak attack damage", "sneak attack for 14 extra damage"

---

## 11. New Pattern Category: Movement & Positioning

- **Distance moved**: "moves 30 feet", "dashes 60 feet"
- **Positioning**: "flanking the orc", "within 5 feet of", "30 feet away"
- **Opportunity attacks**: "provokes an opportunity attack", "AoO from the guard"
- **Disengage/Dodge**: "takes the Disengage action", "uses Dodge"

---

## 12. Expanded Healing Attribution (healingAttribution.ts)

Missing healing sources:

- **Racial features**: "dwarven fortitude", "relentless endurance" (not healing but related)
- **Subclass features**: "twilight sanctuary", "circle of dreams healing", "life transference"
- **Magic items**: "staff of healing", "ring of regeneration", "periapt of wound closure"
- **Environmental**: "the fountain heals you", "blessed water restores HP"

---

## 13. Expanded Damage Type Context (damageTypes.ts)

Missing context words:

- **Weapons**: "longbow" -> piercing, "greataxe" -> slashing, "warhammer" -> bludgeoning
- **Spells**: "toll the dead" -> necrotic, "spiritual weapon" -> force, "moonbeam" -> radiant
- **Environmental**: "lava" -> fire, "drowning" -> bludgeoning, "falling" -> bludgeoning
- **Monster abilities**: "breath weapon" -> varies, "bite" -> piercing, "tail swipe" -> bludgeoning

---

## Technical Details

### Files to modify:

| File | Changes |
|------|---------|
| `src/lib/chronicleSync/patterns.ts` | Add ~20 new regex patterns across XP, damage, healing, gold, items, conditions |
| `src/lib/chronicleSync/patterns/shopItems.ts` | Add ~6 new shop detection patterns (bullets, numbered lists, multi-currency) |
| `src/lib/chronicleSync/patterns/enemies.ts` | Add ~5 new enemy detection patterns (summons, reveals, reinforcements, multi-enemy split) |
| `src/lib/chronicleSync/patterns/savesAndChecks.ts` | Add ~4 new save/check patterns (group saves, contested, flat checks) |
| `src/lib/chronicleSync/patterns/damageTypes.ts` | Add ~30 new context words (weapons, spells, environmental) |
| `src/lib/chronicleSync/patterns/healingAttribution.ts` | Add ~12 new healing source entries (subclass features, magic items) |
| `src/lib/chronicleSync/patterns/attackRolls.ts` | New file: attack roll detection (hit/miss, modifiers, sneak attack) |
| `src/lib/chronicleSync/patterns/movement.ts` | New file: movement/positioning detection (distance, flanking, AoO) |
| `src/lib/chronicleSync/enhancedPatterns.ts` | Integrate new attack roll and movement parsers into `parseEnhancedPatterns()` |
| `src/lib/chronicleSync/enhancedTypes.ts` | Add `ParsedAttackRoll` and `ParsedMovement` types |

### Approach:

- All new patterns follow the existing `PatternMatch` structure and regex style
- New patterns are added to existing arrays (e.g., appending to `DAMAGE_PATTERNS`, `XP_PATTERNS`) so the existing parse functions automatically pick them up
- Attack rolls and movement are new categories requiring new parser functions, types, and integration into the enhanced patterns pipeline
- No changes to the processor pipeline itself -- new patterns in existing categories work immediately; new categories get wired through `enhancedPatterns.ts`

