
# Full D&D 5e Magic System Compliance - Implementation Plan

## Current Status
**Phase A: Core Mechanics** - ✅ COMPLETE

### Completed in Phase A:
- ✅ Auto-calculate proficiency bonus from character level
- ✅ Connect ability scores to spellcasting modifier (INT/WIS/CHA based on path)
- ✅ Add preparation limits (ability mod + spellcaster level)
- ✅ Display prepared spell count in Arcana header (X/Y format)
- ✅ Implement cantrip damage scaling at levels 5, 11, and 17
- ✅ Show scaled damage on spell cards and detail sheets

---

## What This Upgrade Adds

### What Changes
Right now, your spell attack bonus and save DC are set manually. After this update, they'll automatically calculate from your actual character stats.

**How It Works:**
- The system reads your Intelligence, Wisdom, or Charisma (depending on your chosen path)
- It combines that with your proficiency bonus (which scales from +2 at level 1 to +6 at level 20)
- The results appear in both the Arcana tab AND the Combat tab for quick reference

**Example:** A level 5 Arcane Trickster with 16 Intelligence would see:
- Spell Attack: +6 (proficiency +3, INT mod +3)
- Spell Save DC: 14 (8 + proficiency +3 + INT mod +3)

---

## Part 2: Spell Preparation Rules

### What Changes
Currently, you can prepare as many spells as you want. The new system enforces proper limits based on your abilities.

**New Limits:**
- **How many spells you can prepare** = Your spellcasting ability modifier + your spellcaster level
- **Cantrips don't count** toward this limit - they're always available
- **Minimum of 1** prepared spell even if your modifier is negative

**New Restrictions:**
- You can only change your prepared spells during a Long Rest
- The "Prepare" button will be disabled outside of rest mode
- A new indicator shows "3/5 Prepared" so you always know your limit

**Ritual Casting:**
- If your path has the Ritual Casting feature, you can cast ritual spells without preparing them
- Ritual casting adds 10 minutes to the cast time but doesn't use a spell slot

---

## Part 3: Proper Spell Slot Tables

### What Changes
The current slot progression is already solid, but we're adding more complete tables and fixing edge cases.

**Three Caster Types (already implemented, now fully accurate):**
- **Third-Casters** (Arcane Trickster, Eldritch Knight): Slots start at level 3, max 4th-level spells
- **Half-Casters** (Shadow Blade): Slots start at level 2, max 5th-level spells
- **Pact Magic** (Hexblade): Fewer slots that always cast at highest level, recover on short rest

**What's New:**
- Full caster progression tables added (if you ever need a full wizard option)
- Multiclass spellcasting support (if you combine classes later)
- Slot recovery visual indicator during rest

---

## Part 4: Smarter Casting Rules

### Cantrip Scaling
Cantrips automatically get stronger at character levels 5, 11, and 17:
- **Level 5+:** Damage dice doubles (1d10 → 2d10)
- **Level 11+:** Damage triples (2d10 → 3d10)
- **Level 17+:** Damage quadruples (3d10 → 4d10)

### Upcasting (Already Works)
Casting a spell at a higher level for extra effects - this continues to work as implemented.

### Concentration Rules
- **Only one at a time** - casting a new concentration spell automatically ends the previous one (already works)
- **NEW: Concentration Checks** - When you take damage, you must make a Constitution saving throw
  - DC = 10 OR half the damage taken (whichever is higher)
  - Fail = your concentration breaks and the spell ends
  - A new "Concentration Check" button appears when you have an active concentration spell

### Bonus Action Spell Restriction
**NEW RULE:** If you cast a spell using your bonus action, you can only cast cantrips with your main action that turn.
- The system will warn you if you try to break this rule
- This applies only within the same turn

---

## Part 5: Material Components System

### What Changes
A new inventory panel tracks your spell components.

**Component Types:**
- **No-Cost Materials:** Bypassed if you have a spellcasting focus equipped
- **Costly Materials:** Must actually have the gold-value item (example: 100gp pearl for Identify)
- **Consumed Materials:** Removed from inventory after casting

**Focus Equipment:**
- A toggle in the Arcana tab to indicate you have a focus (wand, staff, crystal, etc.)
- When equipped, non-costly material components are automatically satisfied

**Component Inventory:**
- Add components manually (name, gold cost, quantity)
- System checks if you have required components before allowing the cast
- Consumed components reduce automatically

---

## Part 6: Learning & Knowing Spells

### Path-Based Learning (Already Works)
Each path restricts which spell schools you can learn - this continues as implemented.

### Spells Known System
For paths that use "spells known" (like Arcane Trickster):
- Limited number of spells you can learn at each level
- Can swap one known spell when you level up
- Visual indicator: "8/11 Spells Known"

### Spell Source Indicators
Each spell now shows where it came from:
- Path spell list
- Bonus spells (always prepared, don't count toward limit)
- Learned from scroll (future feature)

---

## Part 7: Range & Targeting Display

### What's New
Each spell card now clearly shows:
- **Range type:** Touch, Self, 30 ft, 120 ft, etc.
- **Area shapes:** Cone, Cube, Cylinder, Line, Sphere (with size)
- **Target requirements:** Number of targets, willing/unwilling, creature/object

### Visual Upgrades
- Range icons that distinguish melee from ranged
- Area of effect diagrams (simple visual representations)
- Color coding for different range categories

---

## Part 8: Duration Tracking

### Active Spell Panel
A new collapsible panel shows all your currently active spells:
- Spell name and remaining duration
- Visual timer that counts down in real-time
- Quick-end button to dismiss a spell early

### Duration Categories
Clear labels for each type:
- **Instantaneous:** Happens immediately, no tracking needed
- **1 round:** Until the start of your next turn
- **Concentration:** Shows max duration with active timer
- **Timed durations:** 1 minute, 10 minutes, 1 hour, 8 hours, 24 hours

---

## Part 9: Attack Rolls & Saving Throws

### Spell Attack Display
When casting a spell that requires an attack roll:
- Shows your total spell attack bonus prominently
- Indicates if it's melee or ranged
- Reminder: "Roll d20 + 6 vs target AC"

### Saving Throw Display
When casting a spell that forces a save:
- Shows which ability the target rolls against (STR, DEX, WIS, etc.)
- Shows your Spell Save DC prominently
- Reminder: "Target makes DEX save vs DC 14"

### Critical Hits
For spell attacks that roll a natural 20:
- Visual celebration effect
- Reminder to double damage dice
- Integration with damage calculator

---

## Part 10: Rest & Recovery Integration

### Long Rest Effects
When you trigger a Long Rest (from the home screen or combat tab):
- **All spell slots** are restored to maximum
- **Prepared spells** can now be changed
- **Concentration** ends on any active spells
- **Daily spell tracking** resets

### Short Rest Effects
When you trigger a Short Rest:
- **Pact slots only** recover (Hexblade path)
- Feature-based recovery (like Arcane Recovery) triggers if available
- Regular spell slots remain unchanged

---

## Part 11: Visual Feedback Improvements

### Color Coding
- **Cantrips:** Gray/silver theme
- **1st-2nd level:** Blue theme
- **3rd-4th level:** Purple theme
- **5th level:** Gold theme

### Status Icons
- 🎯 Attack roll required
- 💾 Saving throw required
- 👁️ Concentration required
- 📿 Ritual available
- 🔥 Damage spell
- 💚 Healing spell
- ⚡ Bonus action cast

### Spell Card Upgrades
- Larger, more readable damage/healing formulas
- Component icons (V, S, M) more prominent
- School symbol watermark in corner

---

## Part 12: Combat Tab Integration

### Quick-Cast Panel
A dedicated section in Combat showing:
- Your 3-4 most-used spells (favorites)
- Current spell slot availability
- One-tap casting without leaving Combat

### Spell Attack Stats
Added to the Combat header alongside weapon stats:
- Spell Attack Bonus
- Spell Save DC
- Current concentration (if any)

---

## Implementation Phases

### Phase A: Core Mechanics (Foundation)
1. Connect ability scores to spell stats
2. Auto-calculate proficiency from character level
3. Add preparation limits
4. Implement cantrip scaling

### Phase B: Resource Management
5. Add material component inventory
6. Implement focus toggle
7. Add consumed component tracking
8. Add concentration check prompts

### Phase C: Duration & Tracking
9. Add active spell panel
10. Implement duration timers
11. Add spell expiration notifications
12. Connect to rest mechanics

### Phase D: UI Polish
13. Upgrade spell card visuals
14. Add range/area indicators
15. Integrate with Combat tab
16. Add visual feedback animations

---

## Files That Will Change

| Area | Files | Purpose |
|------|-------|---------|
| Types | `src/lib/magic/types.ts` | New preparation types, component tracking |
| Hook | `src/hooks/use-spellcasting.ts` | Core spell logic, preparation limits, concentration checks |
| Arcana Tab | `src/components/magic/MagicScreen.tsx` | Stats display, preparation mode toggle |
| Spell Grid | `src/components/magic/SpellbookGrid.tsx` | Preparation limits, visual upgrades |
| Spell Cards | `src/components/magic/SpellCard.tsx` | Enhanced visuals, scaling damage |
| Details Sheet | `src/components/magic/SpellDetailsSheet.tsx` | Range/area display, save types |
| Cast Sheet | `src/components/magic/SpellCastSheet.tsx` | Component checks, concentration check |
| Combat | `src/components/combat/mobile/*.tsx` | Quick-cast integration |
| Main App | `src/pages/Index.tsx` | Connect ability scores to spellcasting |

---

## What Stays the Same
- Path selection and switching
- Spell school restrictions by path
- Basic spell casting flow
- Slot recovery on rests
- Concentration tracking (enhanced, not replaced)

---

## End Result
After this implementation, your Arcana system will fully comply with D&D 5e Player's Handbook spellcasting rules, with automatic calculations, proper restrictions, and clear visual feedback for every mechanic.
