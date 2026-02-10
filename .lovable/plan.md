

# More Regex Patterns for Offline Chronicle — Round 3

After reviewing all pattern files post-expansion, these are the remaining concrete gaps.

---

## 1. Item Use Patterns (patterns.ts) — Critically Underdeveloped

`ITEM_USE_PATTERNS` only has 1 pattern matching potions/scrolls. Missing:

- **Activating magic items**: "activates the Wand of Fireballs", "uses the Staff of Healing"
- **Throwing items**: "throws a flask of oil", "hurls a vial of acid"
- **Breaking/destroying items**: "breaks the gem", "shatters the phylactery"
- **Reading scrolls**: "reads the Scroll of Fireball" (only partially caught by current)
- **Equipping gear**: "equips the +1 Shield", "dons the Cloak of Protection"
- **Feeding items**: "feeds them a potion", "administers the antidote"

---

## 2. Gold Spending in `parseGoldMatches()` — Incomplete

`parseGoldMatches()` hardcodes only 3 patterns (find/loot, found/looted, spend/pay) but `GOLD_PATTERNS` now has 7. The function doesn't use the expanded patterns for gain detection (hoard, reward, informal, mixed currency). Fix: make it iterate `GOLD_PATTERNS` like other parsers do.

---

## 3. Condition Application Context — Only Pattern[0] Used

`parseConditionMatches()` only iterates `CONDITION_PATTERNS[0]` (the standard conditions regex). The 6 new patterns for exhaustion levels, concentration broken, and knocked prone/unconscious are **never parsed**. Fix: iterate all patterns in the array.

---

## 4. Crit Pattern Improvements (patterns.ts)

Current crit patterns are too simple and can false-positive on "rolls 20" (which could be any d20 check, not necessarily a crit). Missing:

- **"crits for 24 damage"** — crit with damage amount
- **"critical hit on the goblin"** — crit with target
- **Avoiding false positives**: "rolls 20 on Perception" should NOT be a crit
- **Natural 1 fumble**: No dedicated fumble detection exists

---

## 5. Rest Pattern Gaps (enhancedPatterns.ts)

Missing rest phrasings:

- **"rest for the night"** — common informal
- **"set up camp"**, **"make camp"** — implies long rest
- **"bandage wounds"**, **"patch up"** — implies short rest behavior
- **"meditation"**, **"trance"** (elf long rest variant)

---

## 6. NPC Learning — Missing Patterns

Current NPC intro patterns miss:

- **Dialogue introductions**: `"I am Garrick"`, `"My name is Thordak"`, `"Call me Vex"`
- **NPC descriptions with roles**: "Garrick, the town blacksmith", "Captain Thordak"
- **Returning NPCs**: "Garrick appears again", "you see Thordak once more"

---

## 7. Dice Roll Improvements (diceAndMultiHit.ts)

Missing patterns:

- **Advantage/disadvantage rolls**: "rolls 14 and 18 with advantage (takes 18)"
- **Saving throw dice**: "rolls 12 on the save", "save result: 16"
- **Damage dice expressions without totals**: "deals 2d6+3 slashing damage" (extract expression only)
- **Percentile rolls**: "rolls d100: 73", "percentile: 45"

---

## 8. Initiative Pattern Gaps

Missing:

- **"goes first"**, **"acts first"** — implies high initiative
- **Surprise round**: "surprised", "caught off guard", "surprise round"
- **"wins initiative"**, **"loses initiative"**

---

## 9. Inspiration Pattern Gaps

Missing:

- **Lucky feat**: "uses Lucky", "spends a luck point"
- **Hero/heroic points**: "spends a hero point", "uses heroic inspiration"  
- **Narrative inspiration**: "inspired by the speech", "gains courage"

---

## 10. Cross-Category Validation Gaps

Missing rules in `crossCategoryValidation.ts`:

- **Attack roll near damage** → boost damage confidence
- **Saving throw near condition** → boost condition confidence (failed save = condition applied)
- **Movement near opportunity attack** → boost both
- **Rest event near healing** → boost healing confidence
- **Spell slot usage near damage/healing** → boost damage/healing confidence

---

## 11. Enhanced Spell Detection

Current `SPELL_LEVELS` map is extensive but the cast detection pattern is fragile. Missing:

- **"casts at higher level"**: "casts Fireball at 5th level" (upcast detection)
- **Reaction spells**: "uses Shield as a reaction", "casts Counterspell in response"
- **Bonus action spells**: "casts Healing Word as a bonus action"
- **Wild Magic Surge**: "wild magic surge", "rolls on the wild magic table"

---

## 12. Multi-Currency in `parseGoldMatches()` — Not Integrated

The `parseMultiCurrencyMatches()` function exists but `parseGoldMatches()` doesn't call it. Multi-currency gains/spends are parsed separately and may not be aggregated into the gold total during offline processing.

---

## Technical Details

### Files to modify:

| File | Changes |
|------|---------|
| `src/lib/chronicleSync/patterns.ts` | Expand `ITEM_USE_PATTERNS` (+5 patterns), fix `parseGoldMatches()` to use `GOLD_PATTERNS` array, fix `parseConditionMatches()` to iterate all `CONDITION_PATTERNS`, improve `CRIT_PATTERNS` (+3 patterns, add fumble), integrate multi-currency into gold parser |
| `src/lib/chronicleSync/enhancedPatterns.ts` | Expand rest patterns (+4), improve spell detection (+4 upcast/reaction/bonus patterns) |
| `src/lib/chronicleSync/patterns/npcLearning.ts` | Add dialogue intro patterns (+3), role/title patterns |
| `src/lib/chronicleSync/patterns/diceAndMultiHit.ts` | Add advantage/disadvantage rolls (+3), percentile, saving throw dice |
| `src/lib/chronicleSync/patterns/initiative.ts` | Add surprise round, "goes first", "wins initiative" patterns |
| `src/lib/chronicleSync/patterns/inspiration.ts` | Add Lucky feat, hero points, narrative inspiration |
| `src/lib/chronicleSync/crossCategoryValidation.ts` | Add 5 new cross-category rules (attack→damage, save→condition, movement→AoO, rest→healing, spell→damage) |

### Approach:

- Fix 2 parser bugs first (condition parsing + gold parsing only use subset of their patterns)
- Then add new patterns to existing arrays
- Finally add new cross-validation rules
