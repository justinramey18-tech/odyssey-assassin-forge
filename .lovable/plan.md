

# Character-Scoped Party Membership

## Overview

Two changes isolate party membership and play mode per character, so switching characters automatically connects you to the right group (or solo mode).

## Changes

### 1. `src/hooks/use-play-mode.ts` -- Scope play mode per character

Replace raw `localStorage` calls with scoped storage so each character independently remembers solo vs party mode.

- Import `getScopedItem`, `setScopedItem`, `migrateToScoped` from `@/lib/scoped-storage`
- In the `useState` initializer: call `migrateToScoped(STORAGE_KEY)` then read via `getScopedItem(STORAGE_KEY)`
- In `setPlayMode`: write via `setScopedItem(STORAGE_KEY, mode)`

### 2. `src/hooks/use-party-sync.ts` -- Scope fresh-load reconnection

Update the `checkExisting` function (lines 350-407) so that when no `odyssey-active-party-id` flag exists (fresh page load), it checks the active character's cloud save for their stored `partyId` instead of querying the DB for any membership.

**Current logic (lines 369-380):**
```typescript
// No flag set (fresh load) — check DB for any existing membership
const { data: membership } = await supabase
  .from('party_members')
  .select('party_id')
  .eq('user_id', user.id)
  .limit(1);
```

**New logic:**
```typescript
// No flag set (fresh load) — check active character's cloud save for their partyId
const activeSaveId = localStorage.getItem('odyssey-active-cloud-save-id');
if (activeSaveId) {
  // Character-scoped: read partyId from that character's cloud save
  const { data: saveData } = await supabase
    .from('character_saves')
    .select('extended_data')
    .eq('id', activeSaveId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (saveData) {
    const extData = saveData.extended_data as Record<string, unknown> | null;
    targetPartyId = (extData?.partyId as string) || null;
  }
} else {
  // Guest/no save — fall back to existing DB membership query
  const { data: membership } = await supabase
    .from('party_members')
    .select('party_id')
    .eq('user_id', user.id)
    .limit(1);
  if (membership && membership.length > 0) {
    targetPartyId = membership[0].party_id;
  }
}
```

### 3. `src/hooks/use-cloud-save.ts` -- Add play mode to SCOPED_KEYS

Add `'odyssey-play-mode'` to the `SCOPED_KEYS` array so each character's play mode preference is also captured in cloud saves.

## Files Modified

| File | Change |
|------|--------|
| `src/hooks/use-play-mode.ts` | Use scoped storage for per-character solo/party preference |
| `src/hooks/use-party-sync.ts` | Read partyId from active character's cloud save on fresh load |
| `src/hooks/use-cloud-save.ts` | Add `odyssey-play-mode` to SCOPED_KEYS |

## What This Fixes

- Character A in Party X and Character B in Party Y each reconnect to their own party on load
- Character A set to solo mode stays solo when you switch back to it, even if Character B is in party mode
- Guest users (no cloud save) retain existing behavior

