

## Bug: Authenticated Users See Wizard Instead of Their Cloud Character

### Root Cause
`showWizard` initializes as `true`. The only path to `false` on mount is `loadAutoSave()` finding data in localStorage. When localStorage is empty (new device, cleared storage, iOS PWA purge), the wizard shows even if the user is authenticated with cloud saves available.

There is **no auto-load-from-cloud fallback** — the app never checks the database for existing saves when localStorage is empty.

### Fix

**File: `src/pages/Index.tsx`**

Add a new `useEffect` after the existing auto-save load (around line 1034) that:

1. Waits for auth to resolve (`!loading && isAuthenticated && user`)
2. Only runs if `showWizard` is still `true` (no local save was found)
3. Checks if `activeCloudSaveId` exists in localStorage — if so, fetches that specific save from the `character_saves` table
4. If no `activeCloudSaveId`, fetches the most recent cloud save for the user (`ORDER BY updated_at DESC LIMIT 1`)
5. If a cloud save is found, calls `handleLoadCloudSave(data, saveId)` which already handles full state restoration and sets `showWizard(false)`
6. Uses a ref to prevent double-execution

```typescript
// After line 1034 (after the loadAutoSave useEffect)
const hasAttemptedCloudRestore = useRef(false);
useEffect(() => {
  if (!showWizard || hasAttemptedCloudRestore.current) return;
  if (loading || !isAuthenticated || !user) return;
  
  hasAttemptedCloudRestore.current = true;
  
  (async () => {
    try {
      // Try active save ID first, then most recent
      const targetId = localStorage.getItem('odyssey-active-cloud-save-id');
      let query = supabase
        .from('character_saves')
        .select('id')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);
      
      if (targetId) {
        query = supabase
          .from('character_saves')
          .select('id')
          .eq('user_id', user.id)
          .eq('id', targetId)
          .limit(1);
      }
      
      const { data: saves } = await query;
      if (saves && saves.length > 0) {
        // Use existing loadFromCloud + handleLoadCloudSave flow
        const { loadFromCloud } = useCloudSave — NO, need to call directly
      }
    } catch (e) {
      console.warn('[AutoRestore] Failed:', e);
    }
  })();
}, [showWizard, loading, isAuthenticated, user]);
```

**Refined approach** — since `handleLoadCloudSave` needs a full `SaveData` object and the `useCloudSave` hook is not used in Index.tsx directly, the effect should:

1. Query `character_saves` for the save row
2. Parse it into `SaveData` format (same logic as `loadFromCloud` in `use-cloud-save.ts`)
3. Call `handleLoadCloudSave(saveData, saveId)`

However, to avoid duplicating the parsing logic, a cleaner approach:

**Add `useCloudSave` to Index.tsx** (or just the `loadFromCloud` function), and call it in the effect.

### Implementation Steps

1. **Import `useCloudSave`** in `Index.tsx` and instantiate it with `user?.id`
2. **Add a `useEffect`** after the local auto-save load that:
   - Guards on `showWizard === true && !loading && isAuthenticated && user`
   - Uses a ref to run only once
   - Fetches the active or most recent save ID
   - Calls `loadFromCloud(saveId)` to get full `SaveData`
   - Calls `handleLoadCloudSave(data, saveId)` to restore state
3. **Also need to import `loading`** from `useAuth()` (currently only `user` and `isAuthenticated` are destructured — need to add `loading`)
4. **Edge case**: If auth is still loading when the wizard renders, consider showing a brief loading spinner instead of the wizard to prevent flash-of-wizard before cloud restore completes

### Additional Consideration
The wizard currently renders immediately while auth is resolving. We should delay showing the wizard by ~1-2 seconds or until auth resolves, to prevent the wizard from flashing before the cloud restore can run. A simple approach: when `loading` is true from useAuth, show a loading screen instead of the wizard.

### Files to Modify
- `src/pages/Index.tsx` — Add cloud restore effect, update `useAuth` destructuring, add brief loading gate before wizard

