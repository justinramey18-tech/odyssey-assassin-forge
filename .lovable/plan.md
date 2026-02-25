

# Increase Max Party Size to 6 with Adaptive UI Layout

## Summary

Update the party system to support 6 players instead of 4. This touches the backend enforcement, all four `MEMBER_COLORS` arrays across the codebase, the UI counter, and the member card list layout to keep things readable at higher member counts.

## Changes

### 1. Backend enforcement
**File:** `supabase/functions/party-link/index.ts` (line 153-154)

Change the join cap from 4 to 6 and update the error message.

### 2. Member colors — 4 locations all need 2 extra colors (`#ef4444` red, `#06b6d4` cyan)

| File | Line |
|------|------|
| `src/components/party/battlemap/types.ts` | 14 |
| `src/components/party/PartyPanel.tsx` | 71 |
| `src/components/ai-dm/PartyDMScreen.tsx` | 48 |
| `src/components/ai-dm/InlineBattleMap.tsx` | uses import from `battlemap/types.ts` — covered by #1 |

### 3. UI counter
**File:** `src/components/party/PartyPanel.tsx` (line 206)

`{party.members.length}/4` → `{party.members.length}/6`

### 4. Adaptive member list layout
**File:** `src/components/party/PartyPanel.tsx` (lines 233-245)

When 5+ members are present, switch from a single-column vertical stack to a responsive 2-column grid so the panel doesn't become excessively tall:

```tsx
<div className={cn(
  party.members.length >= 5
    ? "grid grid-cols-2 gap-2"
    : "space-y-2"
)}>
```

### 5. Compact mode for PartyMemberCard
**File:** `src/components/party/PartyMemberCard.tsx`

Add a `compact?: boolean` prop. When true:

- Outer padding: `p-2` instead of `p-3`
- Avatar: `w-6 h-6` instead of `w-7 h-7`
- Character name truncation: `max-w-[90px]` instead of `max-w-[120px]`
- Hide timezone display
- Hide spell slot summary (keep expand button only)
- HP bar height: `h-1.5` instead of `h-2`

Pass from PartyPanel: `compact={party.members.length >= 5}`

### 6. Edge function redeployment

The edge function `party-link` will be automatically redeployed after the code change.

## Files Changed

| File | What |
|------|------|
| `supabase/functions/party-link/index.ts` | `>= 4` → `>= 6`, error message |
| `src/components/party/PartyPanel.tsx` | Counter `/6`, 6 colors, 2-col grid for 5+, pass `compact` |
| `src/components/party/PartyMemberCard.tsx` | Add `compact` prop with tighter layout |
| `src/components/party/battlemap/types.ts` | Add 2 colors to `MEMBER_COLORS` |
| `src/components/ai-dm/PartyDMScreen.tsx` | Add 2 colors to `MEMBER_COLORS` |

## Testing

1. Create a party — counter shows `/6`
2. With 1-4 members: single-column layout, normal card size
3. With 5-6 members: 2-column grid, compact cards with smaller avatars and hidden timezone
4. Attempt to join a full 6-member party — "Party is full (max 6)" error
5. Battle map markers for members 5 and 6 use red and cyan colors
6. Verify no horizontal overflow on mobile in 2-column mode

