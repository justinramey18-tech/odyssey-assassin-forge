

## Root Cause

Vaul (the drawer library) has a feature called `repositionInputs` (enabled by default) that **directly modifies the drawer's inline `style.height`** when a text input is focused and the mobile keyboard opens. Here's what happens step by step:

1. User opens Settings → drawer renders at `h-[90vh]` — looks correct
2. User navigates to R&D Developer Tools → password input appears
3. User taps the password input → mobile keyboard opens
4. Vaul's `onVisualViewportChange` handler fires, caches the drawer height as `initialDrawerHeight`, then sets a new smaller `style.height` inline to fit above the keyboard
5. User submits password or keyboard closes → Vaul tries to restore `initialDrawerHeight`, but the inline `style.height` now **permanently overrides** the CSS class `h-[90vh]`
6. The drawer is now stuck at a reduced height — the "cut off" you see in the screenshot
7. Navigating back to tab menu or other tabs doesn't fix it because the inline style persists on the same DOM element

This only affects DevTools because it's the only settings tab with a text input that triggers the keyboard.

## Fix — 2 files

### 1. `src/components/settings/SettingsModal.tsx` (line 213-214)

Add `repositionInputs={false}` to the Drawer and change to 100dvh:

```tsx
// Before
<Drawer open={open} onOpenChange={handleOpenChange}>
  <DrawerContent className="h-[90vh] max-h-[90vh] overflow-x-hidden">

// After
<Drawer open={open} onOpenChange={handleOpenChange} repositionInputs={false}>
  <DrawerContent className="h-[100dvh] max-h-[100dvh] overflow-x-hidden">
```

- `repositionInputs={false}` prevents Vaul from modifying the drawer's height when the keyboard opens, using native browser scroll behavior instead ("stability first")
- `100dvh` makes the drawer truly full-screen per user preference

### 2. `src/components/settings/SettingsContent.tsx` (line 648)

Remove `max-h-[70vh]` from the devTools wrapper since the parent is now 100dvh and the mobile override `[&>div]:max-h-none` already neutralizes it — but on desktop the dialog still needs it. Keep the pattern consistent with other tabs:

No change needed here — the existing `[&>div]:max-h-none` on the mobile wrapper (line 242) already handles this correctly.

### Files Modified
- `src/components/settings/SettingsModal.tsx` — add `repositionInputs={false}`, change to `100dvh`

