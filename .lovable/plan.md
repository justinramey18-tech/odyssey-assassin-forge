
# Fix: Party Deleted When Switching Characters

## Problem
When switching from Coomlord (party creator) to Xeyle via cloud save, the code calls `partySync.leaveParty()` which **permanently deletes** the user's membership from the `party_members` database table. When switching back to Coomlord, the party membership is gone and the party is effectively destroyed.

## Root Cause
The `handleLoadCloudSave` function (line 984-1002 in `Index.tsx`) calls `partySync.leaveParty()` during character switches. This function invokes the `party-link` edge function with action `'leave'`, which deletes the row from `party_members`. The party association saved in cloud save metadata then points to a party the user is no longer a member of.

## Solution
Replace the server-side `leaveParty()` call during character switching with a **local-only disconnect**. This resets the in-memory party state (so the new character starts clean) without touching the database. The old character's party membership remains intact on the server.

### Changes

**File: `src/hooks/use-party-sync.ts`**
- Add a new function `disconnectLocally()` that resets all party-related state (partyId, members, rolls, loot, messages, etc.) to defaults **without** calling the server. This is a local-only cleanup.
- Export it alongside the existing functions.

**File: `src/pages/Index.tsx`**
- In `handleLoadCloudSave` (around lines 984-1002), replace both calls to `partySync.leaveParty()` with `partySync.disconnectLocally()`.
- This ensures switching characters only clears local state, preserving the server-side party membership for when the user switches back.

### Technical Details

The new `disconnectLocally` function will execute the same local state resets as `leaveParty` (lines 826-835):
```
setParty({ partyId: null, linkCode: null, isCreator: false, members: [], isLoading: false });
setPartyRolls([]);
setPartyLoot([]);
setFocusTarget(null);
setPartyInitiatives([]);
setIncomingBuffs([]);
setPartyMessages([]);
setActiveVote(null);
setMapMarkers([]);
setCombatLog([]);
```
But it will **not** invoke the `party-link` edge function, so the database row in `party_members` stays intact.

### Testing
1. Create a party on Character A
2. Switch to Character B via cloud save
3. Verify Character B loads without the party
4. Switch back to Character A
5. Verify the party is still accessible and functional
