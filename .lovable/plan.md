## Goal
Make it physically impossible for two devices to start the AI narration for the same party + round at the same time. Today the "only host narrates" rule lives on each device; if two devices both believe they're the host (or the host double-taps), the AI can be called twice for one round and produce conflicting story beats. The database will now be the single source of truth for "this round is being narrated."

## How it will work (plain language)

1. Add a small new bookkeeping table in the database whose only job is to hold a **one-and-only-one claim ticket per (party, round)**.
2. When someone's app tries to start narration, it first tries to drop a ticket into that table for the current round. The database itself refuses to accept a second ticket for the same round — that refusal is the lock.
3. If the ticket lands, that device is the narrator, calls the AI, saves the response, then clears the ticket (or marks it complete). If the ticket is refused, the device silently backs off — no duplicate AI call, no duplicate story.
4. A safety timer: if a ticket sits unfinished for too long (e.g., the narrator crashed or lost signal), it's considered stale and another device is allowed to reclaim it. This prevents a wedged round.

## What changes

### Database (new table)
`party_round_locks`
- `party_id` + `round_id` together form the **primary key** — this is what makes duplicates physically impossible.
- `holder_user_id` — who claimed it.
- `status` — `in_progress` or `completed`.
- `started_at`, `completed_at`, `expires_at` — used by the safety timer.
- RLS: only party members can read; only the claim holder (or service role) can update/delete their own row.
- Grants: `authenticated` + `service_role`, standard pattern.

### App-side narration flow (`src/hooks/use-party-dm.ts`, `generateResponse`)
Before calling the AI:
- Try to insert the claim row for the current round.
- If insert succeeds → proceed with narration as today.
- If insert fails because a row already exists AND that row is fresh (not past `expires_at`) → abort silently, let the real holder do it.
- If the existing row is stale (past `expires_at`) → take it over by updating it to the current user with a new expiry, then proceed.

After the AI returns (success or failure):
- Mark the row `completed` (or delete it) so the next round starts clean.
- On error, also release so a retry is possible.

### Existing in-memory host-only guard
Keep it as a fast local check (avoids pointless DB round-trips), but the DB claim is now the authoritative gate. The local flag becomes a courtesy, not a safety mechanism.

## What this fixes
- Two devices both thinking they're host → only one wins the claim; the other backs off.
- Rapid double-tap on "Generate" → second tap sees the fresh claim and does nothing.
- Crashed/disconnected narrator → the safety timer allows someone else to recover the round instead of it being frozen forever.

## What this does not change
- Player prompt submission, ready-up, dedupe logic, UI, and toasts stay exactly as they are.
- No change to the AI edge function itself — the lock lives entirely around the call site in the party hook.

## Rollout
1. One migration: create `party_round_locks` with primary key, RLS, grants, and an index on `expires_at`.
2. One code change in `use-party-dm.ts`'s `generateResponse` to claim → run → release, with the stale-takeover branch.
3. Manual verification: fire two "Generate" clicks back-to-back from two tabs; confirm exactly one AI response is produced and the other tab logs a quiet "already narrating" skip.