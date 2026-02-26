

## Mount `useOneSignal` at App Root

**File: `src/App.tsx`**

The `useOneSignal` hook needs to be called inside a component (not the arrow-function JSX expression). Since `App` is currently a stateless arrow returning JSX, we need to either:
- Convert it to use a body with the hook call, or
- Create a small wrapper component inside the routes that calls the hook.

The simplest approach: create an `AppContent` component inside `App.tsx` that wraps the existing JSX and calls `useOneSignal()`. This ensures OneSignal initializes and logs in the user as soon as the app loads, regardless of which route they're on.

### Changes

1. **`src/App.tsx`**
   - Import `useOneSignal` from `@/hooks/use-onesignal`
   - Extract the inner JSX into an `AppContent` component that calls `useOneSignal()`
   - Render `<AppContent />` inside the providers

This is a single-file, ~5-line change.

