## Bulletproof Private Mode via RLS

Replace the leaky render-time privacy filter with database-level enforcement. When the host enables Private Mode, the Supabase SELECT policy on `party_messages` will physically refuse to return other players' user-role rows to each viewer. Render code can no longer leak content it never receives.

### Step 1 — New migration

Create `supabase/migrations/<new_timestamp>_party_messages_private_mode.sql`:

- `ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS private_mode boolean NOT NULL DEFAULT false;`
- `ALTER TABLE public.party_messages ADD COLUMN IF NOT EXISTS is_afk_marker boolean NOT NULL DEFAULT false;`
- Partial indexes on both new columns for hot-path lookups.
- New `SECURITY DEFINER` SQL function `public.party_is_private(_party_id uuid) returns boolean` that reads `parties.private_mode` with fixed search_path.
- `DROP POLICY "Party members can read messages" ON public.party_messages;`
- `CREATE POLICY "Party members can read messages with privacy" ... FOR SELECT TO authenticated USING (is_party_member(auth.uid(), party_id) AND (NOT party_is_private(party_id) OR role = 'assistant' OR (role = 'user' AND user_id = auth.uid()) OR is_afk_marker = true OR (team IS NOT NULL AND team LIKE 'whisper:%')))`
- INSERT/UPDATE/DELETE policies and realtime publication untouched.

### Step 2 — `src/components/ai-dm/PartyDMScreen.tsx`

**A. Toggle handler (~line 3288):** in `onToggleMode`, after the existing `party_shared_state` update, also write the boolean to the new column:

```ts
(supabase.from('parties') as any)
  .update({ private_mode: newMode === 'private' })
  .eq('id', partyId)
  .then(() => {});
```

**B. Render-time check (~lines 428–439):** delete the entire `if (mode === 'private' && !isAssistant && !isMine && !isWhisper && !isDialogueMessage && !isAfkLine) return null;` block and the `isAfkLine` constant (verified unused elsewhere in this file). Keep `const isWhisper = message.team?.startsWith('whisper:');` as it's used downstream. Replace the surrounding comment with a note that privacy is now enforced via RLS.

`AFK_LINE_REGEX` itself stays — it's still used at lines 243 and 279 by other logic.

### Step 3 — `src/hooks/use-party-dm.ts`

Add `is_afk_marker: true` to the three AFK insert loops (and only those), keeping non-AFK player prompt inserts unchanged:

- Line ~1616 `for (const entry of alphaAfkEntries)` — alpha split AFK insert.
- Line ~1686 `for (const entry of betaAfkEntries)` — beta split AFK insert.
- Line ~1821 `for (const entry of normalAfkEntries)` — non-split AFK insert.

`insertPartyMessage` accepts `Record<string, unknown>`, so no helper-type change needed.

### Step 4 — TypeScript message type

If a `PartyDmMessage` interface exists with the `party_messages` columns, add optional `is_afk_marker?: boolean;`. Otherwise rely on the regenerated `src/integrations/supabase/types.ts` (auto-updated by the migration).

### Step 5 — One-time host action after deploy

Existing parties default to `private_mode = false`. Hosts who already had Private Mode on (stored in `state_data.mode`) must toggle Private Mode OFF then ON once to populate the new column. This is documented but not automated.

### Guards (do not touch)

- INSERT/UPDATE/DELETE policies on `party_messages`.
- `is_party_member`, realtime publication, dialogue mode logic.
- Per-player row insert refactor.
- Director / OOC / Whisper / Empyrean / Solo / onboarding / dragon bonds flows.
- DM context assembly — AI still receives the full combined prompt string.

### Verification

- TypeScript compiles, migration applies cleanly.
- Two-player party in Private Mode: each player sees only their own user prompts + assistant narrative + AFK markers. Other player's prompt rows literally absent from the client (verifiable in network tab and via raw SQL as that user).
- Shared Mode unchanged.
- Realtime respects RLS — no flicker of hidden rows on insert.
- Whispers, Director, dialogue mode, AFK guides, splits all unaffected.
