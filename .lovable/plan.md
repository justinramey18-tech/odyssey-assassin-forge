

## Momo + Moon Druid Easter Egg: Unlock All Wild Shapes

### What
When the character name contains "momo" AND the class is Druid with Circle of the Moon selected, bypass all CR, swim/fly restrictions and unlock all beast forms, elemental forms, and dragon forms regardless of level or prerequisites.

### Changes

**1. `src/hooks/use-wild-shape.ts`**
- Add `characterName?: string` parameter to `useWildShape`
- Add a `isMomoMoon` flag: `isMomoEasterEgg(characterName) && circle === 'moon'`
- When `isMomoMoon`:
  - `availableForms` returns ALL `BEAST_FORMS` + `MOON_CIRCLE_BEAST_FORMS` (no CR/swim/fly filtering)
  - `canUseElemental` = true, `elementalForms` = `ELEMENTAL_FORMS`
  - `canUseDragon` = true, `dragonForms` = `DRAGON_FORMS`
  - Override `maxUses` to 3 (or higher) so dragon transform cost is always affordable
  - Skip prerequisite checks in `transform`, `transformElemental`, `transformDragon`

**2. `src/pages/Index.tsx`**
- Pass `character.name` to the `useWildShape` call (~line 486)

This keeps the easter egg self-contained in the hook — no UI changes needed. All wild shape forms just appear unlocked when momo + moon druid conditions are met.

