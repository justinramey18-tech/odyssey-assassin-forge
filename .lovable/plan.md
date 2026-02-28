

## Plan: Fix Mobile Full-Screen & Keyboard Visibility Issues

### Problem
1. The DevTools panel (after password unlock) and other settings content don't fill the mobile screen properly — the `max-h-[70vh]` on the content wrapper constrains height inside an already-constrained `h-[90vh]` drawer, leaving dead space.
2. The password input field gets hidden behind the mobile keyboard when tapped.

### Changes

#### 1. `src/components/settings/SettingsModal.tsx` — Remove `max-h-[70vh]` on mobile
The mobile drawer is already `h-[90vh]` with its own scroll container (`overflow-y-auto`). The inner `max-h-[70vh]` (designed for the desktop dialog) clips content unnecessarily on mobile. The `SettingsContent` wrapper `max-h-[70vh]` should only apply on desktop.

**Approach:** Wrap the content area in a container that removes the height cap. The simplest fix is to add a CSS override in the mobile drawer's content `div` that neutralizes the `max-h-[70vh]` from `SettingsContent` returns. Add `[&>div]:max-h-none` to the wrapper `div` around `<SettingsContent>` in the mobile branch (line ~247).

Change the mobile content wrapper from:
```tsx
<div className="p-4 w-full max-w-full">
```
to:
```tsx
<div className="p-4 w-full max-w-full [&>div]:max-h-none">
```

This uses Tailwind's child selector to override the `max-h-[70vh]` that each tab's return wrapper sets, allowing content to flow naturally within the drawer's own scroll area.

#### 2. `src/components/settings/DevToolsPanel.tsx` — Fix keyboard visibility for password input
Add `scroll-margin-bottom` and use the `onFocus` event to scroll the input into view when the mobile keyboard appears.

Change the password `<Input>` (line ~271-276) to add an `onFocus` handler:
```tsx
<Input
  type="password"
  placeholder="Password"
  value={password}
  onChange={(e) => { setPassword(e.target.value); setError(false); }}
  className={cn("scroll-mt-20", error ? 'border-destructive' : '')}
  autoFocus
  onFocus={(e) => {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }}
/>
```

The 300ms delay allows the mobile keyboard to finish animating before scrolling.

### Files Modified
- `src/components/settings/SettingsModal.tsx` — add `[&>div]:max-h-none` to mobile content wrapper
- `src/components/settings/DevToolsPanel.tsx` — add `onFocus` scroll-into-view on password input

