

## Fix Ellie Easter Egg to Check Dragon Name Instead of Character Name

The Ellie easter egg currently checks the **character name** but should check the **dragon name**. Three locations need changes:

### 1. `src/lib/easter-eggs.ts`
- Update the JSDoc comment on `isEllieEasterEgg` to say "dragon name" instead of "character name"
- Update `getEllieBadges` to accept a dragon name parameter (or just update callers)

### 2. `src/hooks/use-dragon-bond.ts`
- Change the easter egg check from `isEllieEasterEgg(characterName)` to `isEllieEasterEgg(dragonName)`
- The `dragonName` parameter is already available in the hook options

### 3. `src/components/home/CharacterNamePlaque.tsx`
- Currently calls `getEllieBadges(name)` where `name` is the character name
- Need to add an optional `dragonName` prop and pass it to `getEllieBadges(dragonName)` instead
- Update `HomeScreen.tsx` to pass the dragon name from the Empyrean config to the plaque

### 4. `src/components/home/HomeScreen.tsx`
- Need to load the dragon name (from `loadEmpyreanConfig` or similar) and pass it as a prop to `CharacterNamePlaque`

### Technical Detail
- In solo mode, dragon name lives in the Empyrean config (`loadEmpyreanConfig().dragonName`)
- The `useDragonBond` hook already receives `dragonName` as a parameter, so the fix there is trivial
- For the badge display, we need to thread the dragon name through to `CharacterNamePlaque`

### Retroactivity
- The **badge** will apply retroactively since it's evaluated on every render — as soon as a dragon is named "Ellie", the badge appears
- The **trust boost** (trust: 25, mood: playful) only applies when bond state is at defaults, so it won't retroactively boost an already-progressed bond — this is the existing behavior and remains unchanged

