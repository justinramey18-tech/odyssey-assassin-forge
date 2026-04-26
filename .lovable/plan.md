## Masterwork Pills for Empyrean DM

Add an AI-generated alternative to the static contextual action pills in the Empyrean Solo DM. Each expanded column (Dragon, Situation) gets a small "✨ Masterwork" button that swaps the static pills for 4 AI-tailored pills based on the most recent narrative beat. State is per-column and persists until the user taps "← Show defaults".

### 1. New edge function: `supabase/functions/empyrean-masterwork-pills/index.ts`

- Accepts `{ category: 'dragon' | 'situation', situation_label, recent_narrative, character_name, dragon_name, signet_type }`.
- Calls Lovable AI gateway (`google/gemini-2.5-flash`) with a strict tool-call schema (`generate_masterwork_pills`) returning exactly 4 pills `{ label, emoji, prompt }`.
- Server-side system prompt encodes Empyrean tone + per-column flavor (dragon-synergy vs. independent-rider).
- Validates / sanitizes the tool call output, attaches stable `id`s, returns `{ pills }` or a structured error (handles 429/402 explicitly).
- No DB or auth dependency. CORS headers on every response. `verify_jwt = false` (added to `supabase/config.toml`).

### 2. `src/components/empyrean/EmpyreanContextualActions.tsx`

- Add a new optional prop `fetchMasterworkPills?: (category, situationLabel) => Promise<ActionItem[]>`.
- Add two independent `MasterworkState` slots (one per column): `idle | loading | loaded | error`.
- Add `generateMasterwork(category)` and `revertMasterwork(category)` callbacks.
- In each expanded column, prepend a `MasterworkColumnHeader`:
  - idle/error → small "✨ Masterwork" button (column-tinted, amber for Dragon / purple for Situation), with inline red error text on failure.
  - loading → "Generating moves…" with spinner.
  - loaded → "← Show defaults" revert button.
- When `loaded`, render the AI pills via the existing `PreviewPill` (same long-press preview, same tap-to-send). When `loading`, render 4 pulsing skeleton rows. Otherwise render the existing static pills unchanged.
- Masterwork pills use slightly more saturated tints (`/15` backgrounds) to subtly differentiate.
- No auto-revert: state only changes on explicit user action or a fresh generate.

### 3. `src/components/empyrean/EmpyreanDMScreen.tsx`

- Add `handleFetchMasterworkPills` (`useCallback`) that:
  - Joins the last 1–2 assistant messages into `recent_narrative` (capped at 2500 chars). Throws "No recent narrative to riff on yet." if empty.
  - Invokes `supabase.functions.invoke('empyrean-masterwork-pills', { body: {...} })` with category, situation label, character/dragon/signet from `config`.
  - Surfaces edge function errors and validates the `pills` array shape; returns the array.
- Pass it as `fetchMasterworkPills={handleFetchMasterworkPills}` on the existing `<EmpyreanContextualActions />`.

### Guards (do NOT change)

- Static pill behavior, `handleDragonAction`, action derivations, `SITUATION_META` lookup — untouched.
- `EmpyreanAbilityPicker`, `EmpyreanDirectorScreen`, cooldowns, signet drawer, loadout — untouched.
- Party DM, standard AIDM, Assassin's Ledger — untouched (Empyrean-only feature).
- No useEffect that resets masterwork state on message/loading changes.
- Masterwork header only renders when its column is expanded.
- `PreviewPill` and `usePressPreview` reused as-is — long-press preview works identically for both pill types.

### Verification after implementation

- Edge function deploys and returns 4 pills for both `dragon` and `situation` categories.
- Expanding either column shows the new ✨ Masterwork button at the top.
- Tap → spinner + 4 skeleton rows → 4 tinted AI pills with character-specific labels.
- Tap an AI pill → prompt sends to DM exactly like a static pill; column stays in masterwork state after the DM responds.
- Long-press an AI pill → preview popover with full prompt text.
- "← Show defaults" → restores static pills.
- Both columns operate independently (one can be masterwork, the other static, simultaneously).
- Error path shows inline red text under the header; retry works.
- Regression: chat, dice, OOC notes, signet, cooldowns, abilities, loadout, dragon chat, Director screen, Party DM, standard AIDM all unchanged.
