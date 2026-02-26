

# Party Split Feature: Snapshot + Restore Model with Hidden Split Summaries

## Updated Concept

Based on your clarification, the split works differently from what was originally planned:

```text
SPLIT INITIATION:
1. Host assigns teams
2. Main chat is SNAPSHOT-SAVED (quick save to DB)
3. Both teams start fresh parallel chats from that save point
4. Each team sees ONLY their own split chat (not the other's)

DURING SPLIT:
- Ready-up remains synced across all members
- Host generates two sequential AI responses (one per team)
- The AI DM knows BOTH teams' context via hidden "split summaries"
- Split summaries are auto-generated and visible ONLY to the host

REGROUP:
1. Host initiates regroup with a reunion prompt
2. The ORIGINAL snapshot chat is RELOADED (not the split chats)
3. A unification response from the AI is appended to that restored chat
4. Neither team ever sees the other team's split adventure messages
5. The split summaries remain available to the host for narrative continuity
```

## Key Difference from Previous Plan

Previously: split messages would be tagged with a `team` column and merged chronologically on regroup.

Now: split messages are **ephemeral side adventures** stored separately. On regroup, the **original pre-split chat is restored** plus a unification scene. The split adventures are never visible to non-host players after regroup — they exist only as AI-summarized context.

## Database Changes

### 1. Add `team` column to `party_dm_messages`
Still needed so that during the split, messages are tagged and filtered per team.

```sql
ALTER TABLE party_dm_messages ADD COLUMN team text DEFAULT NULL;
```

### 2. Add `team` column to `party_dm_prompts`
So prompts are also team-scoped during a split.

```sql
ALTER TABLE party_dm_prompts ADD COLUMN team text DEFAULT NULL;
```

### 3. Split state stored in `party_shared_state` (`state_type: 'dm_split'`)

```typescript
interface DmSplitState {
  active: boolean;
  alphaMembers: string[];    // user_ids
  betaMembers: string[];     // user_ids
  initiatedBy: string;
  initiatedAt: string;
  snapshotMessages: Array<{  // The quick-saved main chat at split time
    id: string;
    role: string;
    content: string;
    sender_user_id: string | null;
    sender_name: string;
    created_at: string;
  }>;
  alphaSummary: string | null;  // Hidden split summary for Team Alpha
  betaSummary: string | null;   // Hidden split summary for Team Beta
}
```

The `snapshotMessages` array stores the full pre-split chat so it can be restored on regroup. The `alphaSummary` and `betaSummary` fields hold AI-generated summaries of each team's side adventure, visible only to the host.

**Why store the snapshot in `state_data` rather than a new table?** The snapshot is bounded by the existing 200-message limit. A JSONB field in `party_shared_state` handles this without schema complexity. If the snapshot is too large for a single JSONB field (unlikely at ~200 messages), we can truncate to the last 100.

## Flow Details

### Split Initiation (`initiateSplit`)
1. Snapshot current `messages` array into the split state
2. Delete all `party_dm_messages` for this party (clears the visible chat)
3. Delete all `party_dm_prompts` for this party
4. Insert the `dm_split` state into `party_shared_state`
5. Update `dm_session` config to add `splitActive: true`
6. Start a new round

### During Split — Message Handling
- When a user submits a prompt, the `team` column is set based on their membership in `alphaMembers` or `betaMembers`
- Messages inserted by the AI are also tagged with the appropriate `team`
- The realtime subscription filters: each user only sees messages where `team` matches their assignment (or `team IS NULL` for pre-split history — but there won't be any since the chat was cleared)
- The host sees ALL messages but with team labels

### During Split — Generation
When all members ready up, the host generates two sequential responses:
1. Filter alpha prompts, build alpha context (alpha messages + main campaign summary + alpha split summary), call AI
2. Filter beta prompts, build beta context (beta messages + main campaign summary + beta split summary), call AI
3. After each generation, trigger a mini-summary for that team's split adventure and store it in the split state's `alphaSummary`/`betaSummary`

### During Split — Split Summaries
After every AI response during a split, the host auto-generates a rolling summary of that team's adventure. This uses the existing `ai-dm-summarize` edge function. The summaries are stored in the `DmSplitState` and are:
- **Visible to the host** via a "Split Summaries" button in the UI
- **Hidden from team members** (client-side filtering — the host reads from `party_shared_state`)
- **Fed to the AI** during generation so it maintains narrative coherence across both threads

### Regroup (`regroupParty`)
1. Host provides a reunion prompt (e.g., "The two groups meet at the tavern")
2. Restore the `snapshotMessages` from the split state back into `party_dm_messages`
3. Delete all team-tagged messages (the split adventures)
4. Generate a unification response using: restored chat context + alphaSummary + betaSummary + reunion prompt
5. Append the unification response to the restored chat
6. Clear the `dm_split` state
7. Update `dm_session` config to remove `splitActive`
8. The split summaries persist in the host's local state for reference but are no longer in the DB

### What Players See After Regroup
- The original pre-split chat, exactly as it was
- Plus a new AI message describing the reunion scene
- No trace of either team's split adventures in the chat
- The AI DM still knows what happened (via the summaries fed into its context)

## Files Changed

| File | Change |
|------|--------|
| **Migration SQL** | Add `team` column to `party_dm_messages` and `party_dm_prompts` |
| `src/hooks/use-party-dm.ts` | Add split state management, snapshot/restore logic, team-filtered message display, split-aware dual generation, `initiateSplit()`, `regroupParty()`, split summary generation |
| `src/components/ai-dm/PartyDMScreen.tsx` | Add Split/Regroup buttons in sub-header, team banner, split member selection UI, host-only "Split Summaries" viewer |
| `src/components/ai-dm/StandalonePartyDMScreen.tsx` | Pass through new split-related props |

## Risk Mitigation

1. **Snapshot stored in JSONB** — no new tables, bounded by message count
2. **Sequential generation** — avoids race conditions
3. **Client-side team filtering** — no RLS changes needed (all party members can already read all `party_dm_messages`)
4. **Clean restore** — snapshot is the source of truth; split messages are deleted on regroup
5. **Split summaries as JSONB fields** — no separate storage, auto-cleaned when split state is deleted
6. **Single split only** — enforced by checking `splitState.active`
7. **Minimum 2 per team** — validated in UI

## Technical Details: Split Summary Generation

After each AI response during a split, the host calls the existing `ai-dm-summarize` function with that team's messages and stores the result:

```typescript
// After generating Team Alpha's response:
const alphaSummaryResult = await fetch(SUMMARIZE_URL, {
  method: 'POST',
  body: JSON.stringify({
    messages: alphaMessages.map(m => ({ role: m.role, content: m.content })),
    previousSummary: splitState.alphaSummary || undefined,
  }),
});
// Update splitState.alphaSummary in party_shared_state
```

This happens every round during the split (not on an interval like the main summary) to keep the summaries fresh for the AI and for the eventual regroup context.

