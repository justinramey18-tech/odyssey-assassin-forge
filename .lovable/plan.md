

# Cleric Spell List Audit: Missing D&D 5e Spells

## Summary

The current cleric spell file contains **38 spells** across cantrips through 5th level. Compared to the official D&D 5e Player's Handbook cleric spell list, there are **approximately 40+ missing spells**. Below is the full breakdown.

---

## Currently Implemented

| Level | Count | Spells |
|-------|-------|--------|
| Cantrip | 6 | Sacred Flame, Guidance, Spare the Dying, Thaumaturgy, Toll the Dead, Word of Radiance |
| 1st | 9 | Bless, Cure Wounds, Guiding Bolt, Healing Word, Shield of Faith, Sanctuary, Inflict Wounds, Command, Detect Magic |
| 2nd | 7 | Spiritual Weapon, Hold Person, Lesser Restoration, Prayer of Healing, Aid, Silence, Zone of Truth |
| 3rd | 6 | Spirit Guardians, Revivify, Beacon of Hope, Dispel Magic, Mass Healing Word, Remove Curse |
| 4th | 4 | Death Ward, Guardian of Faith, Banishment, Freedom of Movement |
| 5th | 6 | Mass Cure Wounds, Flame Strike, Greater Restoration, Raise Dead, Holy Weapon, Dispel Evil and Good |

---

## Missing Spells by Level

### Cantrips (3 missing)
- **Light** - Evocation, touch an object to emit bright light 20ft
- **Mending** - Transmutation, repair a single break or tear in an object
- **Resistance** - Abjuration, concentration, target adds 1d4 to one saving throw

### 1st Level (5 missing)
- **Create or Destroy Water** - Transmutation, create/destroy up to 10 gallons
- **Detect Evil and Good** - Divination, concentration, sense aberrations/celestials/etc.
- **Detect Poison and Disease** - Divination, concentration, sense poisons and diseases within 30ft
- **Protection from Evil and Good** - Abjuration, concentration, ward against creature types
- **Purify Food and Drink** - Transmutation, ritual, remove poison/disease from food/drink

### 2nd Level (10 missing -- includes Calm Emotions, the user's reported missing spell)
- **Calm Emotions** - Enchantment, concentration, suppress charm/fear or make hostile creatures indifferent
- **Augury** - Divination, ritual, receive an omen about a specific course of action
- **Blindness/Deafness** - Necromancy, blind or deafen a foe (CON save)
- **Continual Flame** - Evocation, create a permanent magical flame (no heat)
- **Enhance Ability** - Transmutation, concentration, grant advantage on one ability's checks
- **Find Traps** - Divination, sense the presence of traps within line of sight
- **Gentle Repose** - Necromancy, ritual, preserve a corpse from decay
- **Locate Object** - Divination, concentration, sense direction to a known object
- **Protection from Poison** - Abjuration, neutralize one poison and grant advantage vs. poison
- **Warding Bond** - Abjuration, link with a creature to share damage and grant +1 AC/saves

### 3rd Level (14 missing)
- **Animate Dead** - Necromancy, raise a skeleton or zombie servant
- **Bestow Curse** - Necromancy, concentration, curse a creature with various effects
- **Clairvoyance** - Divination, concentration, create an invisible sensor to see/hear remotely
- **Create Food and Water** - Conjuration, create 45 lbs of food and 30 gallons of water
- **Daylight** - Evocation, create a 60-foot-radius sphere of bright light
- **Feign Death** - Necromancy, ritual, make a willing creature appear dead
- **Glyph of Warding** - Abjuration, inscribe a glyph that triggers a spell or explosion
- **Magic Circle** - Abjuration, create a cylinder warding against creature types
- **Meld into Stone** - Transmutation, ritual, step into stone to hide
- **Protection from Energy** - Abjuration, concentration, grant resistance to one damage type
- **Sending** - Evocation, send a 25-word message to a known creature
- **Speak with Dead** - Necromancy, ask a corpse up to 5 questions
- **Tongues** - Divination, understand and speak any language
- **Water Walk** - Transmutation, ritual, up to 10 creatures can walk on water

### 4th Level (4 missing)
- **Control Water** - Transmutation, concentration, manipulate freestanding water
- **Divination** - Divination, ritual, ask your deity one question about a goal/event
- **Locate Creature** - Divination, concentration, sense direction to a specific creature
- **Stone Shape** - Transmutation, reshape stone into any form

### 5th Level (8 missing)
- **Commune** - Divination, ritual, ask your deity 3 yes-or-no questions
- **Contagion** - Necromancy, infect a creature with a disease on touch
- **Geas** - Enchantment, command a creature for 30 days (charm effect)
- **Hallow** - Evocation, 24-hour casting, consecrate or desecrate an area
- **Insect Plague** - Conjuration, concentration, 20-foot sphere of biting locusts
- **Legend Lore** - Divination, learn lore about a person, place, or object
- **Planar Binding** - Abjuration, bind a celestial/elemental/fey/fiend to your service
- **Scrying** - Divination, concentration, observe a creature on any plane

---

## Implementation Plan

### Approach
Add all ~44 missing spells to `src/lib/magic/spells/cleric-spells.ts`, following the existing pattern exactly: full `SpellDefinition` objects with proper `id`, `school`, `components`, `classes` arrays (shared spells like Enhance Ability tagged for multiple classes), and all three `personalityQuips`.

### Execution
Since the file is already 850 lines and we are adding ~44 spells (roughly 25 lines each), the file will grow significantly. The spells will be inserted into their correct level sections in alphabetical order within each level group.

### Shared Spells Note
Some missing spells (e.g., Protection from Evil and Good, Enhance Ability, Tongues, Bestow Curse) also appear on other class lists. They will be added to the cleric file with the appropriate `classes` array including all relevant classes, matching how Hold Person and Detect Magic are currently handled.

### Testing
- Open the Arcana tab as a Cleric at various levels and verify new spells appear at the correct level thresholds
- Search for "Calm Emotions" specifically to confirm the user's reported missing spell is now available
- Check that shared spells (e.g., Enhance Ability) appear for other classes that should have them

