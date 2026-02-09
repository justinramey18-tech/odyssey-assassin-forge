

# Comprehensive Wild Shape Expansion: 14 Creatures + 6 Dragons + Interactive Abilities

## What This Adds

20 new Wild Shape forms with unique, interactive special abilities that generate AI DM prompts when tapped. The forms span from a humble Screaming Goat (CR 0) all the way to ancient dragons (CR 13-17). Every special ability across ALL forms (existing and new) becomes a tappable button that copies a rich, context-aware prompt to your clipboard.

---

## Part 1: New Forms Data

### Base Beast Forms (added to `wildShape.ts`)
Available to ALL druids based on standard CR/level restrictions.

| Form | CR | HP | AC | Speed | Special Abilities |
|---|---|---|---|---|---|
| Screaming Goat | 0 | 4 | 10 | 40 ft. | Terrifying Scream (DC 10, frightened 1 round), Sure-Footed (advantage vs. knockdown), Charge (ram + knockdown) |
| Utah Raptor | 1 | 32 | 14 | 60 ft. | Pounce (knockdown + bonus bite), Pack Tactics, Keen Smell, Disemboweling Claw (2d8 slashing) |

### Moon Circle Beast Forms (added to `druidCircles.ts`)
Available only to Circle of the Moon druids, filtered by their enhanced CR cap.

| Form | CR | HP | AC | Speed | Special Abilities |
|---|---|---|---|---|---|
| Owlbear | 3 | 59 | 13 | 40 ft. | Keen Sight and Smell, Multiattack (Beak + Claws), Bear Hug (grapple on claw hit, DC 14) |
| Chupacabra | 3 | 45 | 14 | 40 ft., climb 30 ft. | Blood Drain (regain HP equal to damage), Stealthy Predator (advantage on Stealth at night), Darkvision 120 ft., Spider Climb |
| Giant Otter | 3 | 52 | 13 | 40 ft., swim 60 ft. | Hold Breath 30 min, Powerful Jaws (2d10 bite + grapple), Playful Dodge (Disengage as bonus action), Keen Smell |
| Mothman | 4 | 65 | 15 | 30 ft., fly 60 ft. | Hypnotic Gaze (DC 14, charmed), Prophetic Shriek (DC 14, frightened + prone), Darkvision 120 ft., Flyby |
| Skinwalker | 4 | 71 | 14 | 40 ft. | Shapechanger (mimic any Medium humanoid), Terrifying Howl (DC 14, frightened 30 ft.), Multiattack (Bite + Claw), Darkvision 60 ft. |
| Mi-Go (Brain Fungus) | 5 | 76 | 16 | 30 ft., fly 60 ft. | Surgical Claws (2d8 + stun DC 15), Extract Brain (incapacitated target, instant kill), Innate Spellcasting (Detect Thoughts at will), Blindsight 30 ft. |
| Shoggoth Spawn | 5 | 95 | 14 | 30 ft., swim 30 ft. | Amorphous (squeeze through 1-inch gaps), Pseudopod Multiattack (3x 2d6+5), Maddening Form (DC 14, frightened on sight), Acid Secretion (melee attackers take 1d6 acid) |
| Spinosaurus | 5 | 95 | 14 | 40 ft., swim 40 ft. | Multiattack (Bite + 2 Claws), Amphibious, Bite (3d12 + grapple), Sail Display (DC 14, frightened), Siege Monster |
| T-Rex | 8 | 136 | 13 | 50 ft. | Multiattack (Bite + Tail), Bite (4d12 + grapple, swallow Medium), Tail (3d8 + knockdown), Legendary Resistance (1/day) |
| Hydra | 8 | 172 | 15 | 30 ft., swim 30 ft. | Reactive Heads (one reaction per head), Multiple Bites (5 heads, 1d10+5 each), Head Regrowth (2 new heads unless fire damage), Hold Breath 1 hour, Wakeful |
| Flesh Cathedral | 10 | 200 | 16 | 20 ft. | Absorb (grappled creatures merge, healing the form), Maddening Aura (DC 16, 3d6 psychic in 30 ft.), Siege Monster, Regeneration (10 HP/round unless fire/acid), Amorphous |
| Mothra (Kaiju) | 12 | 250 | 17 | 20 ft., fly 120 ft. | Radiant Dust (DC 17, 6d8 radiant 60 ft. cone), Blinding Scales (DC 17, blinded), Legendary Resistance (2/day), Gust Wings (DC 17, push 30 ft.), Silk Spray (restrain DC 17) |

### Dragon Forms (new category in `druidCircles.ts`)
Moon Circle level 18+ only. Costs **3 Wild Shape uses** per transformation.

| Dragon | CR | HP | AC | Speed | Special Abilities |
|---|---|---|---|---|---|
| White Dragon | 13 | 200 | 18 | 40 ft., fly 80 ft., burrow 40 ft., swim 40 ft. | Cold Breath (DC 19, 12d8 cold, 60 ft. cone), Cold Immunity, Ice Walk, Blindsight 60 ft. |
| Black Dragon | 14 | 195 | 19 | 40 ft., fly 80 ft., swim 40 ft. | Acid Breath (DC 18, 12d8 acid, 60 ft. line), Acid Immunity, Amphibious, Blindsight 60 ft. |
| Copper Dragon | 14 | 184 | 18 | 40 ft., fly 80 ft., climb 40 ft. | Acid Breath (DC 18, 12d8 acid, 60 ft. line), Slowing Breath (DC 18, speed halved), Acid Immunity |
| Silver Dragon | 16 | 243 | 19 | 40 ft., fly 80 ft. | Cold Breath (DC 20, 13d8 cold, 60 ft. cone), Paralyzing Breath (DC 20, CON save or paralyzed), Cold Immunity |
| Red Dragon | 17 | 256 | 19 | 40 ft., fly 80 ft., climb 40 ft. | Fire Breath (DC 21, 18d6 fire, 60 ft. cone), Frightful Presence (DC 19), Fire Immunity, Legendary Resistance (3/day) |
| Gold Dragon | 17 | 256 | 19 | 40 ft., fly 80 ft., swim 40 ft. | Fire Breath (DC 21, 12d10 fire, 60 ft. cone), Weakening Breath (DC 21, STR disadvantage), Fire Immunity, Amphibious |

---

## Part 2: Interactive Special Abilities (AI Prompts)

Currently, special abilities display as static green tags. This plan converts them into tappable buttons across the entire app.

### New shared utility: `src/lib/wildShapePrompts.ts`

A single function `generateWildShapeAbilityPrompt` that:
- Accepts character name, form name, form CR, HP/maxHP, AC, speed, and the specific ability name
- Wraps output with `applyTimePrefix()` for 4th Wall Time
- Produces a prompt like:

```text
## [4th Wall Time] Wild Shape Ability: Pack Tactics

**Character:** Vex in Wolf form (CR 1/4)
**Beast HP:** 8/11 | AC: 13
**Ability:** Pack Tactics

Pack Tactics grants advantage on attack rolls against a creature
if at least one ally is within 5 ft. of the target.

Narrate Vex's wolf form coordinating with allies, using Pack
Tactics to press the advantage.
```

### Where abilities become tappable

1. **QuickActionsDrawer.tsx** -- The transformed form view (lines 613-621): static `<span>` tags become buttons with tap-to-copy + toast feedback
2. **WildShapeOverlay.tsx** -- The home screen overlay (lines 126-144): same treatment, requires adding `characterName` and form CR as new props
3. **HomeScreen.tsx / Index.tsx** -- Thread `characterName` to the overlay component

---

## Part 3: Dragon Wild Shape System

### Config changes in `druidCircles.ts`

- Add `canDragon: boolean` to `MoonCircleWildShapeConfig` interface
- Extend `MOON_CIRCLE_WILD_SHAPE` at levels 18-20:
  - Level 18: maxCR 6, canDragon true
  - Level 19: maxCR 6, canDragon true
  - Level 20: maxCR 6, canDragon true
- Add `DragonForm` interface (extends `BeastForm` with `element`, `immunities`, `resistances`)
- Add `DRAGON_FORMS: DragonForm[]` array with all 6 dragons

### Hook changes in `use-wild-shape.ts`

- Add `dragonForms: DragonForm[]` and `canUseDragon: boolean` to `UseWildShapeReturn`
- Add `transformDragon(form: DragonForm)` function -- costs 3 uses, validates Moon Circle level 18+
- Expose dragon forms filtered by availability

### UI changes in `QuickActionsDrawer.tsx`

- Add a **Dragon Forms** section below Elemental Forms
- Purple/gold accent styling to distinguish from green (beast) and orange (elemental)
- "3 uses" badge on each dragon card
- When transformed into a dragon, show the same active-form panel with stats, abilities, and dismiss button

---

## Part 4: Updating Existing Form Abilities

The existing base and Moon Circle forms that currently have minimal abilities will get enriched special ability lists. For example:
- **Polar Bear**: already has Keen Smell, Multiattack -- stays as-is
- **Giant Elk**: Charge (ram + knockdown) -- stays as-is
- All existing forms keep their current abilities (no removals)

---

## File Change Summary

| File | Changes |
|---|---|
| `src/lib/magic/wildShape.ts` | Add Screaming Goat (CR 0) and Utah Raptor (CR 1) to `BEAST_FORMS` |
| `src/lib/classes/druidCircles.ts` | Add `canDragon` to config interface, extend levels 18-20, add 12 Moon beast forms, add `DragonForm` interface, add `DRAGON_FORMS` array with 6 dragons |
| `src/lib/wildShapePrompts.ts` | **New file** -- shared `generateWildShapeAbilityPrompt` utility |
| `src/hooks/use-wild-shape.ts` | Add `dragonForms`, `canUseDragon`, `transformDragon` to hook return; filter dragon forms by level/circle |
| `src/components/drawers/QuickActionsDrawer.tsx` | Add Dragon Forms section with purple/gold styling; convert all special ability tags to tappable prompt-copy buttons |
| `src/components/home/WildShapeOverlay.tsx` | Accept `characterName` and form CR props; convert ability tags to tappable prompt-copy buttons |
| `src/components/home/HomeScreen.tsx` | Pass `characterName` to `WildShapeOverlay` |
| `src/pages/Index.tsx` | Pass `characterName` to HomeScreen for overlay threading |

---

## How It All Syncs

- **No sync architecture changes needed** -- all new forms use the existing `BeastForm` interface (dragons via a compatible `DragonForm` extension)
- HP bar turns green and shows the form name for all 20 new forms
- Combat damage routes through the beast/dragon HP pool with overflow carry-over
- Rest handlers revert and restore uses (dragons restore all 3 consumed uses)
- Quick Actions drawer auto-filters forms by druid level and circle
- Every special ability across all forms (old and new) generates a copyable AI DM prompt with 4th Wall Time

