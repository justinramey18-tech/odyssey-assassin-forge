

## Plan: Restore DevTools Tab to Match Other Settings Tabs

### Problem
The devTools tab wrapper is missing `max-h-[70vh]` that all other tabs use, and lacks the inner `<div className="space-y-3 pb-6">` wrapper.

### Change in `src/components/settings/SettingsContent.tsx` (lines 646-651)
Restore the same wrapper pattern used by other tabs:

```tsx
// Before
<div className="flex-1 overflow-y-auto">
  <DevToolsPanel />
</div>

// After
<div className="flex-1 overflow-y-auto max-h-[70vh]">
  <div className="space-y-3 pb-6">
    <DevToolsPanel />
  </div>
</div>
```

### Files Modified
- `src/components/settings/SettingsContent.tsx` — single 3-line change

