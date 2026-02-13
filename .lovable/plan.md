

# Easter Egg: "Thistle" / "ThistlePig" Badges

## What It Does
When any player sets their character name to "thistle" or "thistlepig" (case-insensitive), three special badges automatically appear:
- **R4** (styled in emerald/green)
- **The True Butler** (styled in amber/gold)
- **007, DTF, Rising Pheonix** (styled in purple)

These badges show in two places:
1. The **home screen name plaque** (`CharacterNamePlaque`)
2. The **party member card** (`PartyMemberCard`) -- visible to all party members

## Helper Utility

Create a small helper function (e.g., in `src/lib/easter-eggs.ts`) to keep it DRY:

```typescript
const THISTLE_NAMES = ['thistle', 'thistlepig'];

const THISTLE_BADGES = [
  { label: 'R4', color: 'emerald' },
  { label: 'The True Butler', color: 'amber' },
  { label: '007, DTF, Rising Pheonix', color: 'purple' },
];

export function getThistleBadges(name: string) {
  return THISTLE_NAMES.includes(name.toLowerCase().trim())
    ? THISTLE_BADGES
    : [];
}
```

## Changes

### 1. New File: `src/lib/easter-eggs.ts`
Contains `getThistleBadges(name)` -- returns badge array or empty array.

### 2. `src/components/home/CharacterNamePlaque.tsx`
- Import `getThistleBadges`
- After the "Level X" span, render the badges as small styled pills (similar to the condition badges on party cards)
- Badges use `text-[9px]` sizing with colored backgrounds matching the Dark Odyssey theme

### 3. `src/components/party/PartyMemberCard.tsx`
- Import `getThistleBadges`
- Call it with `member.character_name`
- Render the badges in a flex-wrap row below the name/level line (before the HP bar), using the same pill style as conditions but with distinct colors per badge

## Visual Style
Each badge is a small pill:
- `text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider`
- R4: `bg-emerald-500/20 text-emerald-300 border border-emerald-500/30`
- The True Butler: `bg-amber-500/20 text-amber-300 border border-amber-500/30`
- 007, DTF, Rising Pheonix: `bg-purple-500/20 text-purple-300 border border-purple-500/30`

## Files
1. `src/lib/easter-eggs.ts` -- **NEW** -- badge lookup helper
2. `src/components/home/CharacterNamePlaque.tsx` -- render badges on nameplate
3. `src/components/party/PartyMemberCard.tsx` -- render badges on party card
