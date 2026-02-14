

# Fix: Per-Character Background Images in Cloud Saves

## Problem

Two issues prevent backgrounds from persisting per-character:

1. **Storage path collision**: When you upload a background, it always saves to `backgrounds/{userId}/home-bg.jpg` -- the same file path regardless of which character is active. So uploading Character B's background overwrites Character A's file in cloud storage.

2. **Stale URL on restore**: Character A's save stores the cloud URL, but the actual file behind that URL has been replaced by Character B's image. Loading Character A back gives you Character B's photo (or a broken image if the file extension changed).

## Solution

Make each character's background upload to a **unique path** that includes the character's cloud save ID, so files never overwrite each other.

---

## Changes

### 1. `src/hooks/use-custom-background.ts` -- Add `saveId` parameter to upload

Update `handleImageUpload` to accept an optional `saveId` parameter. When provided, the storage path becomes:

```
backgrounds/{userId}/{saveId}/home-bg.{ext}
```

Instead of the current:

```
backgrounds/{userId}/home-bg.{ext}
```

This ensures each character save gets its own storage file that is never overwritten by another character.

**Signature change:**
```typescript
handleImageUpload: (file: File, userId?: string, saveId?: string) => Promise<void>;
```

**Path logic change (line ~129):**
```typescript
const path = saveId
  ? `backgrounds/${userId}/${saveId}/home-bg.${ext}`
  : `backgrounds/${userId}/home-bg.${ext}`;
```

### 2. `src/pages/Index.tsx` -- Pass active save ID to upload handler

Find where `handleImageUpload` is called (around line 2120) and pass the current cloud save ID so the upload goes to the correct per-character path.

This requires tracking the active cloud save ID (which is already available when a save is loaded from cloud or created). A small state variable (`activeCloudSaveId`) will be added and set during:
- `handleLoadCloudSave` -- set to the loaded save's ID
- Initial cloud save creation -- set to the newly created save's ID

**Call site change:**
```typescript
onCustomBackgroundUpload={(file: File) =>
  customBackground.handleImageUpload(file, user?.id, activeCloudSaveId)
}
```

### 3. `src/hooks/use-custom-background.ts` -- Interface update

Update the `CustomBackgroundState` interface to reflect the new parameter on `handleImageUpload`.

---

## What This Fixes

- Character A's background uploads to `backgrounds/user123/saveA/home-bg.jpg`
- Character B's background uploads to `backgrounds/user123/saveB/home-bg.jpg`
- They never overwrite each other
- Loading Character A restores the correct URL pointing to Character A's file
- The existing save/restore logic for `backgroundUrl` in `saveData` and `handleLoadCloudSave` already works correctly -- it stores and restores the URL. The only problem was the file behind the URL being overwritten, which this fix addresses.

## Edge Case: First-Time Save (No Save ID Yet)

If a user uploads a background before their first cloud save, there's no `saveId` yet. In this case, the upload falls back to the existing `backgrounds/{userId}/home-bg.{ext}` path. Once the character is saved to the cloud, subsequent uploads will use the save-specific path.

## Files Modified

- `src/hooks/use-custom-background.ts` -- Add `saveId` to upload path
- `src/pages/Index.tsx` -- Track active save ID, pass it to upload handler
