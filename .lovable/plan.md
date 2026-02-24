

# Fix `scribe-ai` Edge Function Error

## Root Cause Analysis

The `scribe-ai` edge function requires JWT authentication via `getClaims()` (lines 101-120). If the user is **not signed in**, the Supabase JS client sends the anon key as the Bearer token. `getClaims(anonKey)` fails, and the function returns a **401 status**. The Supabase JS client wraps non-2xx responses as `FunctionsHttpError`, which surfaces as "Failed to send a request to the Edge Function" in the toast.

This is unnecessary for users providing their own Anthropic API key — they aren't accessing any protected backend resources, just proxying a request to Anthropic's API.

Additionally, the `claude-sonnet-4-6` model from `scribe-models.ts` is missing from the edge function's `modelMap`.

## Fix

### 1. `supabase/functions/scribe-ai/index.ts` — Skip auth when user provides their own key

Restructure the handler to:
1. Parse the request body **first** (before auth)
2. If `user_api_key` is present and non-empty, **skip `getClaims()` entirely** — the user is paying with their own key
3. Only require auth when falling back to the backend `ANTHROPIC_API_KEY` secret

This matches the intent: auth gates access to *our* API key, not to the proxy itself.

### 2. `supabase/functions/scribe-ai/index.ts` — Add missing model mapping

Add `'anthropic/claude-sonnet-4-6'` to the `modelMap` so it resolves to the correct Anthropic model ID instead of silently falling back.

### 3. Improve client-side error message (`ScribeDrawer.tsx`, `ChroniclerHomeView.tsx`)

The current catch block shows raw error messages that may not be user-friendly. Add a check: if the error looks like an auth/fetch error, suggest signing in or checking the API key.

## Changes Summary

| File | Change |
|------|--------|
| `supabase/functions/scribe-ai/index.ts` | Parse body before auth; skip auth when `user_api_key` present; add `claude-sonnet-4-6` to modelMap |
| `src/components/drawers/ScribeDrawer.tsx` | Better error message in catch block |
| `src/components/home/ChroniclerHomeView.tsx` | Better error message in catch block |

