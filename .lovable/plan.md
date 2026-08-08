# Gear bonus breakdown in the Stats tab

Show exactly where every number on the character comes from, so it's clear which equipped piece is giving what.

## What you'll see

A new "Equipment Bonuses" block in the Stats tab, in both the in-game DM character sheet and the main app stats panel.

Collapsed (default) — one line per stat with the combined gear total:

```text
Equipment Bonuses                          [tap to expand]
Armor Class      10 base  +4 gear  +2 DEX  +1 abilities   = 17
Attack           +3 prof  +2 DEX  +1 gear                 = +6
Damage           +2 DEX  +1 abilities                     = +3
DEX +1   CON +2   Perception +2   Saves +1   Move +10 ft
Set bonus: Shadowweave (3/5) — advantage on Stealth
Carried 42 / 78 lb
```

Expanded — each equipped piece with its own contributions:

```text
Ember Cuirass (chest)     +4 AC, +1 CON
Whisper Daggers (main)    +1 attack, 1d6 damage
Ring of the Fox (ring)    +1 DEX, +2 Perception
```

Rules:
- Items and slots that give no bonuses are hidden entirely.
- Passive ability bonuses (Archery Master, Warrior's Resilience, Sixth Sense) are shown as their own "abilities" line so gear vs. talent is never confused.
- Numbers are live — equipping or removing anything updates the block immediately.

## Coverage

- Armor Class: base 10, gear armor, DEX modifier, passive ability bonuses
- Attack and damage: proficiency bonus, STR/DEX modifier, gear, passive abilities, weapon damage dice
- Ability score boosts from gear (STR/DEX/CON/INT/WIS/CHA)
- Other: perception, saves, movement, active set bonuses, and carried vs. equipped weight against the carry limit

## Technical notes

- New shared presentation component `src/components/character/GearBonusBreakdown.tsx`. It takes the already-computed `AggregatedStats` (from `use-equipment-stats`), the `CombatStats` breakdown (from `use-combat-stats`), and the equipped slot map, and renders the collapsed/expanded views. No new calculation logic — all totals already exist in those two hooks.
- Per-item lines come from reading `item.stats` on each equipped `EquipmentItem` and mapping non-zero entries to friendly labels (reuse the label style already used in the inventory tooltips). Items whose stats object yields no non-zero entries are skipped.
- Main app: render the component inside `StatsDrawer.tsx`, which already receives `equipmentStats`; it also needs the equipped slots and combat stats passed down from `Index.tsx` (both already live there).
- In-game DM sheet: `SoloCharacterSheet.tsx` only receives `CharacterContext`, whose `equipment` entries carry just slot/name/rarity. Extend those entries with an optional `stats` object plus optional aggregate/combat breakdown fields on the context, populated in `PromptDrawerProvider.tsx` from the same hooks. Fields are optional, so the AI DM side is unaffected; the block simply doesn't render when the data isn't present.
- `PromptDrawerProvider` builds `aiDMCharacterContext` in a `useMemo` — the equipment stats hook values get added to its dependency array (no localStorage reads inside the memo).
- Both provider return branches in `Index.tsx` must receive any new props.
- Collapse state via the existing `Collapsible` primitive; 48px tap target on the toggle; theme tokens only.
