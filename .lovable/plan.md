

# Fix: Party Reconnection Fails After Page Reload

## Problem
You're the host of your party, the database confirms you're still a member and creator, but the app thinks you're not in a party. This creates a deadlock:
- The app's reconnection logic checks your cloud save for the party ID
- Your cloud save has no party ID stored (it was never synced in time)
- So the app concludes you're not in a party
- But you can't create or join a new one because the database still has you as a member
- The "Waiting for Host" screen appears because the app can't determine you're the creator

## Root Cause
The reconnection logic in `use-party-sync.ts` trusts the cloud save's `partyId` field as the source of truth. But cloud saves happen on a 30-second debounce, so if the party was joined/created and the page was closed before the next cloud sync, the `partyId` never gets persisted. On next load, the app has no idea you're in a party.

## Solution

### 1. Fix reconnection fallback logic (use-party-sync.ts)
Currently, if a cloud save ID exists but has no `partyId`, the code stops looking. Change it to **always fall back to a direct database membership query** when no party ID is found from the cloud save. This way, even if the cloud save missed the `partyId`, the app will still find the user's active party from the database.

**Before (simplified):**
```
if (cloudSaveId exists) {
  look up partyId from cloud save extended_data
  if not found -> give up  // BUG: stops here!
} else {
  query party_members table  // only runs for guests
}
```

**After:**
```
if (cloudSaveId exists) {
  look up partyId from cloud save extended_data
}
if still no partyId {
  query party_members table  // ALWAYS falls back to DB
}
```

### 2. Force immediate cloud save when party state changes (use-party-sync.ts)
After creating or joining a party, dispatch a custom event that triggers an immediate cloud sync (bypassing the 30-second debounce). This ensures the `partyId` is written to the cloud save right away.

### 3. Listen for force-sync event in auto-cloud-sync (use-auto-cloud-sync.ts)
Add a listener for the `odyssey-force-cloud-sync` event that immediately triggers a cloud save, ensuring party membership is persisted without waiting for the debounce timer.

## Technical Details

### File: `src/hooks/use-party-sync.ts`
- **Lines 369-397**: Remove the `else` branch that gates the DB fallback behind "no cloud save ID". Instead, always query `party_members` when no `targetPartyId` is found from the cloud save.
- **In `createParty` and `joinParty` functions**: After successfully setting party state, dispatch `window.dispatchEvent(new CustomEvent('odyssey-force-cloud-sync'))` to trigger immediate persistence.

### File: `src/hooks/use-auto-cloud-sync.ts`
- Add an event listener for `odyssey-force-cloud-sync` that calls `saveToCloudNow()` immediately.

## Testing
1. Sign in, create a party, then reload the page -- should reconnect automatically
2. Sign in, join a party via code, reload -- should reconnect
3. Verify the creator still sees creator controls (not "Waiting for Host")
4. Verify you can still create/join if genuinely not in a party

