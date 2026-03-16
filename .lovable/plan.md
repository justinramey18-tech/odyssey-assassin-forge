

# Fix: Filter Split Mode Messages by Team for Host

## Problem
In `src/hooks/use-party-dm.ts` (line 194-196), the host explicitly bypasses team filtering during split mode — they see all messages from both teams. The code reads:
```
isCreator ? messages : messages.filter(m => !m.team || m.team === myTeam)
```

## Solution
Apply the same team filter to the host as non-host players. The host should only see messages tagged with their team (or untagged pre-split messages).

### File: `src/hooks/use-party-dm.ts` (~line 192-197)
Change the `displayMessages` memo to remove the `isCreator` bypass:
```typescript
const teamFiltered = isSplitActive && myTeam
  ? messages.filter(m => !m.team || m.team === myTeam)
  : messages;
```

This single-line change removes the `isCreator ? messages :` branch so everyone — host included — only sees their own team's messages plus any pre-split (untagged) messages.

The `showTeamTag` prop on `PartyDMScreen.tsx` line 1115 (`isCreator && partyDm.isSplitActive`) can remain as-is since it's just cosmetic for tagged messages that slip through (e.g., pre-split).

### Prompts
The same logic should be checked for `currentPrompts` filtering to ensure the host only sees their team's prompts too. I'll verify and apply the same pattern if needed.

