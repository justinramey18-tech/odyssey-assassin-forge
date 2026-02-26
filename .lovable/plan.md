

## Plan: Mandatory Auth Gate + Logout Button

### Problem
Currently, the app renders all features regardless of authentication. Users can access everything without signing in. The user wants:
1. Auth as the mandatory first experience
2. A visible logout button with confirmation
3. Sessions that persist forever until explicit logout

### Changes

#### 1. Auth gate in `App.tsx`
Create a new `<AuthGuard>` wrapper component that checks `useAuth()`. If not authenticated and not loading, redirect to `/auth`. Wrap the `"/"` route's `<Index />` with it. Leave `/auth`, `/reset-password`, `/install`, and `/features` as public routes.

**File**: `src/components/auth/AuthGuard.tsx` (new)
- Uses `useAuth()` hook
- If `loading`: show spinner
- If `!isAuthenticated`: `<Navigate to="/auth" />`
- If authenticated: render `children`

**File**: `src/App.tsx`
- Wrap `<Index />` route with `<AuthGuard>`

#### 2. Update Auth page — remove "Back" button
**File**: `src/pages/Auth.tsx`
- Remove the "Back" / `navigate('/')` button since auth is now the entry point
- Update copy from "Cloud Saves" to something like "Welcome" or "Sign In to Continue"

#### 3. Add Logout button with confirmation toast
**File**: `src/components/navigation/AssassinHeader.tsx`
- Add a `LogOut` icon button in the header bar
- On click, show an `AlertDialog` confirmation: "Are you sure you want to log out?"
- On confirm, call `signOut()` from `useAuth()`, which navigates to `/auth`

**Props change**: `AssassinHeader` will receive `onSignOut` callback from `Index.tsx`.

**File**: `src/pages/Index.tsx`
- Destructure `signOut` from `useAuth()` (line ~569)
- Pass `onSignOut` handler to `AssassinHeader` that calls `signOut()` + shows success toast + navigates to `/auth`

#### 4. Session persistence (already handled)
The Supabase client is already configured with `persistSession: true` and `autoRefreshToken: true`. The `use-auth.ts` hook tracks `was-signed-in` via IndexedDB. No additional changes needed — sessions already persist until explicit sign-out.

### Files to create
- `src/components/auth/AuthGuard.tsx`

### Files to modify
- `src/App.tsx` — wrap Index route with AuthGuard
- `src/pages/Auth.tsx` — remove Back button, update title copy
- `src/pages/Index.tsx` — add signOut + navigate to header props
- `src/components/navigation/AssassinHeader.tsx` — add logout button with AlertDialog confirmation
- `src/hooks/use-auth.ts` — no changes needed (already has IndexedDB persistence)

