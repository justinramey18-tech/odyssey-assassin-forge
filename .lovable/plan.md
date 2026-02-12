

## Make Party DM a Truly Real-Time Shared Experience

### What's Missing

Right now, the Party DM has three gaps preventing real-time sync of host actions:

1. **No database permissions** for the host to edit or delete messages (only INSERT and SELECT policies exist)
2. **Incomplete realtime event data** -- when a message is deleted, other clients don't receive enough information to know which message was removed (replica identity is set to "default" instead of "full")
3. **The code only listens for new messages** -- edits and deletions are ignored by the realtime subscription

### Changes

#### 1. Database Migration

- Add an **UPDATE** RLS policy so the party creator can edit any message in their party
- Add a **DELETE** RLS policy so the party creator can delete any message in their party
- Set **REPLICA IDENTITY FULL** on `party_dm_messages` so DELETE realtime events include the full row (letting clients identify which message was removed)

#### 2. Realtime Subscription Fix (`src/hooks/use-party-dm.ts`)

Change the message channel from listening to only `INSERT` to listening for all events (`*`), then handle each type:

- **INSERT** -- add the new message to state (existing behavior)
- **UPDATE** -- replace the matching message in state with the updated version
- **DELETE** -- remove the matching message from state using the old row's ID

### Technical Details

**SQL Migration:**
```text
-- Host can edit messages
CREATE POLICY "Party creator can update dm messages"
  ON public.party_dm_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.parties
      WHERE id = party_id AND created_by = auth.uid()
    )
  );

-- Host can delete messages
CREATE POLICY "Party creator can delete dm messages"
  ON public.party_dm_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.parties
      WHERE id = party_id AND created_by = auth.uid()
    )
  );

-- Full row data on DELETE events for realtime
ALTER TABLE public.party_dm_messages REPLICA IDENTITY FULL;
```

**Hook change** (around line 109-123 in `use-party-dm.ts`):
- Change event from `'INSERT'` to `'*'`
- Add branching for `UPDATE` (replace in state) and `DELETE` (remove from state), matching the pattern already used for `party_dm_prompts`

