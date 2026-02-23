

## Add Local API Key Management

### Overview
Allow users to enter and manage their own API keys directly within the app. Keys are stored locally in `localStorage` (never sent to the backend for storage) and passed to edge functions at request time. This lets each user use their own Anthropic key without relying on a shared backend secret.

### What You'll See
- A new **"API Keys"** section in the Settings modal under the **Character** tab (collapsible, similar to Account Settings)
- An input field for the **Anthropic API key** with show/hide toggle and save/clear buttons
- A green checkmark indicator when a key is saved
- All AI features (Solo AI DM, Scribe, Novel Builder) will automatically use your locally stored key when calling Claude models
- If no local key is saved, the system falls back to the shared backend key (current behavior)

### How It Works

1. User enters their Anthropic API key in Settings
2. Key is saved to `localStorage` under `dnd-anthropic-api-key`
3. When calling Claude models, the frontend includes the key in the request body as `user_api_key`
4. Edge functions (`ai-dm`, `scribe-ai`) check for `user_api_key` first, then fall back to the backend secret `ANTHROPIC_API_KEY`

---

### Technical Details

#### New File: `src/lib/api-keys.ts`
- `localStorage` helpers: `loadApiKey(provider)`, `saveApiKey(provider, key)`, `clearApiKey(provider)`, `hasApiKey(provider)`
- Storage key: `dnd-anthropic-api-key`
- Designed to support additional providers in the future

#### New Component: `src/components/settings/ApiKeySettings.tsx`
- Collapsible panel (matches `AccountSettings` pattern)
- Anthropic key input with eye toggle, save, and clear buttons
- Shows masked key preview when saved (e.g., `sk-ant-...xxxx`)
- Warning text: "Your key is stored locally in your browser and sent directly to the API. It is never stored on our servers."

#### Modified: `src/components/settings/SettingsContent.tsx`
- Import and render `ApiKeySettings` in the **Character** tab, between the Account Settings and Danger Zone sections

#### Modified: `src/hooks/use-ai-dm.ts`
- Import `loadApiKey` from `api-keys.ts`
- When calling the `ai-dm` edge function with an Anthropic model, include `user_api_key: loadApiKey('anthropic')` in the request body

#### Modified: `src/components/home/ChroniclerHomeView.tsx`
- When calling `scribe-ai`, include `user_api_key: loadApiKey('anthropic')` in the body

#### Modified: `src/components/scribe/NarrativeForgeScreen.tsx`
- When calling `scribe-ai`, include `user_api_key: loadApiKey('anthropic')` in the body

#### Modified: `src/components/drawers/ScribeDrawer.tsx`
- When calling `scribe-ai`, include `user_api_key: loadApiKey('anthropic')` in the body

#### Modified: `supabase/functions/ai-dm/index.ts`
- In `callAnthropic()`: extract `user_api_key` from the request context; use it if provided, otherwise fall back to `Deno.env.get("ANTHROPIC_API_KEY")`

#### Modified: `supabase/functions/scribe-ai/index.ts`
- Extract `user_api_key` from request body; use it if provided, otherwise fall back to `Deno.env.get("ANTHROPIC_API_KEY")`

### Files Summary

**Create:**
- `src/lib/api-keys.ts`
- `src/components/settings/ApiKeySettings.tsx`

**Modify:**
- `src/components/settings/SettingsContent.tsx`
- `src/hooks/use-ai-dm.ts`
- `src/components/home/ChroniclerHomeView.tsx`
- `src/components/scribe/NarrativeForgeScreen.tsx`
- `src/components/drawers/ScribeDrawer.tsx`
- `supabase/functions/ai-dm/index.ts`
- `supabase/functions/scribe-ai/index.ts`

