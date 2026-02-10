

# Offline Chronicle Pattern Expansion - Round 3

This plan implements 12 categories of improvements including 2 bug fixes and ~40 new regex patterns across 7 files.

---

## Bug Fixes (Critical)

### Fix 1: `parseConditionMatches()` only uses `CONDITION_PATTERNS[0]`
**File:** `src/lib/chronicleSync/patterns.ts` (lines 542-567)
- Rewrite to iterate ALL patterns in the `CONDITION_PATTERNS` array instead of just index 0
- This unlocks the 6 existing patterns for exhaustion levels, concentration broken, and prone/unconscious that are currently dead code

### Fix 2: `parseGoldMatches()` hardcodes 3 patterns instead of using `GOLD_PATTERNS`
**File:** `src/lib/chronicleSync/patterns.ts` (lines 386-433)
- Rewrite to iterate the full `GOLD_PATTERNS` array (7 patterns) for gain detection
- Keep spend detection as a separate loop using only spend-specific patterns (index 2)
- This unlocks hoard, reward, informal, and mixed currency gold detection

---

## New Patterns

### 1. Expanded Item Use Patterns (`patterns.ts`)
Add 5 new patterns to `ITEM_USE_PATTERNS`:
- Activating magic items ("activates the Wand of Fireballs")
- Throwing items ("throws a flask of oil")
- Breaking/destroying items ("shatters the phylactery")
- Equipping gear ("equips the +1 Shield", "dons the Cloak")
- Feeding/administering ("feeds them a potion", "administers the antidote")

### 2. Improved Crit Patterns (`patterns.ts`)
Add 3 new patterns and fumble detection to `CRIT_PATTERNS`:
- "crits for 24 damage" (crit with damage amount)
- "critical hit on the goblin" (crit with target)
- "natural 1" / "fumble" (fumble/critical miss detection)
- Guard against false positives by requiring attack/combat context

### 3. Rest Pattern Expansion (`enhancedPatterns.ts`)
Add 4 new patterns:
- Short rest: "bandage wounds", "patch up", "catch your breath"
- Long rest: "rest for the night", "set up camp", "make camp"
- Long rest: "meditation", "trance" (elf long rest variant)

### 4. NPC Learning Expansion (`npcLearning.ts`)
Add 3 new intro patterns:
- Dialogue: `"I am Garrick"`, `"My name is Thordak"`, `"Call me Vex"`
- Role/title: "Garrick, the town blacksmith", "Captain Thordak"
- Returning NPCs: "Garrick appears again"

### 5. Dice Roll Improvements (`diceAndMultiHit.ts`)
Add 4 new patterns:
- Advantage/disadvantage: "rolls 14 and 18 with advantage (takes 18)"
- Saving throw dice: "rolls 12 on the save"
- Damage dice without totals: "deals 2d6+3 slashing damage"
- Percentile rolls: "rolls d100: 73", "percentile: 45"

### 6. Initiative Expansion (`initiative.ts`)
Add 3 new patterns:
- Surprise: "surprise round", "caught off guard", "surprised"
- Priority: "goes first", "acts first"
- Win/lose: "wins initiative", "loses initiative"

### 7. Inspiration Expansion (`inspiration.ts`)
Add 3 new pattern categories:
- Lucky feat: "uses Lucky", "spends a luck point"
- Hero points: "spends a hero point", "uses heroic inspiration"
- Narrative: "inspired by the speech"

### 8. Cross-Category Validation (`crossCategoryValidation.ts`)
Add 5 new rules:
- Attack roll near damage --> boost damage confidence
- Saving throw near condition --> boost condition confidence
- Movement near opportunity attack --> boost both
- Rest event near healing --> boost healing confidence
- Spell slot usage near damage/healing --> boost confidence

### 9. Spell Detection Expansion (`enhancedPatterns.ts`)
Add 4 new patterns to `SPELL_SLOT_PATTERNS`:
- Upcast: "casts Fireball at 5th level" (detect higher level)
- Reaction spells: "uses Shield as a reaction"
- Bonus action spells: "casts Healing Word as a bonus action"
- Wild Magic Surge: "wild magic surge", "rolls on the wild magic table"

---

## Technical Details

### Files Modified

| File | Type of Change |
|------|---------------|
| `src/lib/chronicleSync/patterns.ts` | Bug fix in `parseConditionMatches()` and `parseGoldMatches()`, expand `ITEM_USE_PATTERNS` (+5), improve `CRIT_PATTERNS` (+3 including fumble) |
| `src/lib/chronicleSync/enhancedPatterns.ts` | Expand rest patterns (+4), expand spell detection (+4) |
| `src/lib/chronicleSync/patterns/npcLearning.ts` | Add dialogue intro patterns (+3) |
| `src/lib/chronicleSync/patterns/diceAndMultiHit.ts` | Add advantage/disadvantage, percentile, save dice patterns (+4) |
| `src/lib/chronicleSync/patterns/initiative.ts` | Add surprise round, goes first, wins initiative (+3) |
| `src/lib/chronicleSync/patterns/inspiration.ts` | Add Lucky feat, hero points, narrative inspiration (+3) |
| `src/lib/chronicleSync/crossCategoryValidation.ts` | Add 5 new cross-category validation rules |

### No new files created
All changes extend existing pattern arrays and functions, so existing parsers automatically pick them up without pipeline changes.

