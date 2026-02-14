

# Battle Map Background Image

## Overview
Add the ability to upload a background image (e.g., a dungeon map, tavern layout) to the battle map. The image will sit behind the grid, scrolling and zooming together with it, so grid cells overlay the terrain image perfectly.

## How It Works

1. **Upload Button** -- A new "Background" button in the MapControls toolbar. Tapping it opens a file picker. The selected image is uploaded to cloud storage (gear-images bucket) and the URL is saved to localStorage alongside the other map state.

2. **Image Rendering** -- The image is rendered as an absolutely-positioned `<img>` element behind the grid (z-index below grid cells). It is sized to exactly match the grid dimensions (`gridSize * cellSize` px), so it scales with zoom and scrolls naturally with the scroll container.

3. **Grid Opacity** -- When a background is active, grid cell borders become semi-transparent so the map image is clearly visible beneath the tactical grid.

4. **Remove Background** -- A small "X" button appears next to the Background button when an image is set, allowing the user to clear it.

## Technical Details

### Files to Modify

**`src/components/party/battlemap/types.ts`**
- Add `backgroundUrl?: string` to the `SavedMapState` interface (used by StandaloneBattleMap's localStorage persistence).

**`src/components/home/StandaloneBattleMap.tsx`**
- Add `backgroundUrl` state, initialized from localStorage.
- Include `backgroundUrl` in the auto-save effect.
- Pass `backgroundUrl` and `onSetBackground` / `onClearBackground` as new props to `FullscreenBattleMap`.
- `onSetBackground`: Uploads file to Supabase storage (`gear-images` bucket, path `battlemap-backgrounds/{timestamp}.{ext}`), gets public URL, sets state.
- `onClearBackground`: Clears state and optionally deletes the file from storage.

**`src/components/party/battlemap/FullscreenBattleMap.tsx`**
- Accept new props: `backgroundUrl`, `onSetBackground(file: File)`, `onClearBackground()`.
- Render a background `<img>` element inside the grid container (the `<div className="relative">` at line 308), positioned absolutely at `0,0` with dimensions matching `gridSize * cellSize`. The image uses `object-fit: cover` and `pointer-events: none` so it doesn't interfere with cell clicks.
- When `backgroundUrl` is set, reduce grid cell border opacity (e.g., `border-white/5` instead of `border-border/10`) to let the map show through.

**`src/components/party/battlemap/MapControls.tsx`**
- Add new props: `hasBackground`, `onBackgroundUpload`, `onClearBackground`.
- Render an "Image" button (using the `ImageIcon` from lucide-react). Clicking it triggers a hidden `<input type="file" accept="image/*">`.
- When a background is active, show a small "X" clear button beside it.

### Data Flow

```text
User taps "Image" button
  --> file picker opens
  --> file selected
  --> StandaloneBattleMap.onSetBackground(file)
    --> upload to Supabase storage
    --> get public URL
    --> setState(backgroundUrl)
    --> auto-save writes URL to localStorage
  --> FullscreenBattleMap renders <img> behind grid
```

### Storage
- **Cloud**: `gear-images` bucket, path `battlemap-backgrounds/{timestamp}.{ext}`
- **Local**: Persisted as part of the existing `dnd-battlemap-state` localStorage key (adds `backgroundUrl` string field)
- No base64 in localStorage or database -- only the public URL is stored

### Edge Cases
- Large images: The 5MB Supabase upload limit applies; files over 5MB show an error toast.
- Grid size changes: The image stretches to fit the new grid dimensions, which is the expected behavior (the uploaded map should always fill the grid).
- No background set: Grid renders exactly as it does today -- no visual changes.

