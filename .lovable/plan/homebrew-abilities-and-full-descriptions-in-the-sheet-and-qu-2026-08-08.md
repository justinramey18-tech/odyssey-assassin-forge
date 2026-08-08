# Homebrew abilities and full descriptions in the sheet and quick actions

## What's happening now

- Custom (homebrew) abilities you create do reach the in-game character sheet, but only as a bare name plus "tree · Tier X" — no rules text, no dice, no cooldown, and nothing marking them as your own creation.
- In Quick Actions, custom abilities are meant to sit in their own "Homebrew" group, but the grouping looks for a tree literally named "Homebrew"/"Custom" — your creations are filed under a normal tree, so they always land in the regular Abilities list.
- Quick Action prompts for abilities and spells only say "uses <name>" / "casts <name>". The DM gets no effect text or dice from the button, so custom content is narrated generically.
- The sheet's Magic section lists prepared spells as plain name chips — no level, school, casting time or description, for standard or custom spells.

## What will change

**Character sheet — Abilities tab**
- Each unlocked ability becomes tappable: tap to expand its rules text for the tier you actually have, plus dice, action type (action/bonus/reaction/passive), usage (at-will, per rest) and cooldown when present.
- Player-created abilities get a gold "Homebrew" badge; tweaked built-ins get a "Custom" badge.
- Prepared spells become the same expandable rows: level and school on the line, and on tap the casting time, range, duration, concentration/ritual flags, components, damage or healing dice, and the full description. Custom spells get the homebrew badge and their own stat block.
- Empty states and hidden extras stay as they are; nothing with no data to show gets an expander.

**Quick Actions**
- Homebrew grouping switches to the reliable "this is homebrew" flag instead of the tree name, so custom abilities finally appear in the Homebrew section — along with custom spells, which currently never appear there.
- Ability and spell buttons carry their own details into the prompt: the effect text, dice, and (for spells) level, school, save/attack and damage or healing formula. The DM stops guessing at what your invented power does.
- Spell entries show level/school in the sub-label instead of a generic "Prepared Spell", and cantrips are detected from real spell data rather than a name-contains-"cantrip" guess.

## Technical notes

- `CharacterContext.spellcasting` gains a `preparedSpellDetails` array (name, level, school, casting time, range, duration, concentration, ritual, components, damage/healing formula, save/attack, description, isHomebrew) built in `PromptDrawerProvider.tsx` from `getSpellById` for every prepared spell — the existing `homebrewSpells` block stays for the AI prompt. Type added to `src/components/oracle/types.ts`.
- `SoloCharacterSheet.tsx` abilities tab: rows become collapsible using existing local state; no new packages, no new hooks.
- `PartyDMQuickActions.tsx`: replace the `tree === 'Homebrew' || 'Custom'` test with `a.isHomebrew`, add a homebrew-spell branch from `preparedSpellDetails`, and extend `generateAbilityPrompt` / `generateSpellPrompt` to append effect/dice lines when available.
- All ability data already flows through the context (`effect`, `dice`, `cooldownMinutes`, `isHomebrew`, `isCustomized`) — no new storage keys and no changes to how abilities are saved.
