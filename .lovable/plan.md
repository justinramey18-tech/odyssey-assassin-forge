
# Multiplayer AI Dungeon Master

## Overview
Add a shared AI DM experience for party members. All players in a party can open the AI DM and participate in a shared campaign. The party host's AI credits are used for all generation. Players submit prompts that are queued, and either everyone clicks "Ready" to trigger a combined AI response, or the host bypasses the queue with a "Generate" button. Two visibility modes control whether players see each other's prompts.

## How It Works

**Shared Campaign Model**: When a party is active and the host starts a multiplayer DM session, all party members see the same AI DM chat history. Messages are stored in a new `party_dm_messages` table and synced via Realtime.

**Prompt Queue + Ready System**:
1. Each player types a prompt describing their character's action
2. The prompt is submitted to a `party_dm_prompts` queue table with a `ready` flag
3. Each player clicks a "Ready" button to mark themselves ready
4. When ALL party members are ready, the system auto-fires: all queued prompts are bundled into a single combined message, sent to the AI DM edge function using the host's context, and the response streams to everyone
5. The host has a "Generate Now" button that bypasses the ready check and fires immediately with whatever prompts are queued

**Two Visibility Modes** (set by host):
- **Shared Prompts**: Everyone sees all submitted prompts in real-time as they're queued
- **Private Prompts**: Players only see their own submitted prompt; the AI still receives all prompts and produces a single shared response

**Credit Usage**: Only the host's edge function call is made. The `ai-dm` edge function uses `LOVABLE_API_KEY` (not user-specific), so any party member triggering it through the host's flow uses the project's shared balance.

---

## Database Changes

### New Table: `party_dm_messages`
Stores the shared AI DM conversation for a party.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default gen_random_uuid() |
| party_id | uuid | FK to parties(id) ON DELETE CASCADE |
| role | text | 'user' or 'assistant' |
| content | text | Message content |
| sender_user_id | uuid | nullable (null for assistant messages) |
| sender_name | text | Character name or 'DM' |
| created_at | timestamptz | default now() |

RLS: party members can SELECT; members can INSERT with own user_id; no UPDATE/DELETE.
Enable Realtime.

### New Table: `party_dm_prompts`
Stores the current round's queued prompts and ready status.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| party_id | uuid | FK to parties(id) ON DELETE CASCADE |
| user_id | uuid | Who submitted |
| character_name | text | |
| prompt | text | The player's action text |
| is_ready | boolean | default false |
| round_id | uuid | Groups prompts into a generation round |
| created_at | timestamptz | default now() |

RLS: members can SELECT all for their party; members can INSERT/UPDATE own rows; host can DELETE all (to clear after generation).
Enable Realtime.

### New Row in `party_shared_state`
Use existing `party_shared_state` with `state_type = 'dm_session'` to store session config:
```json
{
  "active": true,
  "mode": "shared" | "private",
  "currentRoundId": "uuid",
  "campaignSummary": "...",
  "isGenerating": false
}
```

---

## File Changes

### 1. New Hook: `src/hooks/use-party-dm.ts`
Central hook for multiplayer DM logic.

**State managed**:
- `partyDmMessages` -- full shared chat history from `party_dm_messages`
- `currentPrompts` -- this round's prompt queue from `party_dm_prompts`
- `dmSessionConfig` -- from `party_shared_state` (mode, active, roundId, isGenerating)
- `isGenerating` -- whether AI is currently streaming
- `allReady` -- derived: every party member has a prompt with `is_ready = true`

**Key functions**:
- `startMultiplayerDM(mode)` -- host creates the session config in `party_shared_state`, sets mode
- `submitPrompt(text, characterName)` -- inserts into `party_dm_prompts` for current round
- `setReady()` -- updates own prompt row to `is_ready = true`
- `generateResponse(characterContexts)` -- host-only; bundles all prompts into a combined user message, calls `ai-dm` edge function, streams response, inserts user+assistant messages into `party_dm_messages`, clears prompts, creates new round
- `endSession()` -- host clears session config

**Realtime subscriptions**:
- `party_dm_messages` -- INSERT events to append new messages
- `party_dm_prompts` -- INSERT/UPDATE/DELETE to track ready status
- `party_shared_state` filtered to `dm_session` type -- config changes (mode, isGenerating)

### 2. New Component: `src/components/ai-dm/PartyDMScreen.tsx`
Full-screen overlay (same layout as `AIDMScreen`) but for multiplayer.

**UI sections**:
- **Header**: "Party DM" title, mode toggle (host only), end session button (host only), back button
- **Chat area**: Shows `partyDmMessages` with player names and avatars color-coded by party member. In private mode, user-role messages from other players are hidden (replaced with "[Player] is acting...")
- **Prompt Queue Panel**: Bottom section above input showing who has submitted/is ready. Shows prompt text in shared mode, just names in private mode. Green checkmarks for ready players.
- **Input area**: Text input + "Submit" button. After submitting, input changes to a "Ready" toggle button. Once ready, shows waiting state.
- **Host controls**: "Generate Now" button visible only to host, always available regardless of ready status. Disabled while generating.

### 3. Modified: `src/components/ai-dm/AIDMScreen.tsx`
- Add a "Party DM" button in the header (visible when user is in a party)
- Clicking it opens `PartyDMScreen` instead of solo mode

### 4. Modified: `src/hooks/use-party-sync.ts`
- Add `dmSessionConfig` state synced from `party_shared_state` where `state_type = 'dm_session'`
- Expose it in `UsePartySyncReturn` so `PartyPanel` and `AIDMScreen` can check if a multiplayer DM session is active

### 5. Modified: `src/components/party/PartyPanel.tsx`
- Add a "Party DM" button/chip in the party panel toolbar (next to Chat, Rolls, Loot, etc.)
- Host sees "Start DM Session", members see "Join DM Session" (if active)

### 6. Modified: `supabase/functions/ai-dm/index.ts`
- No changes needed to the edge function itself. The combined prompt from multiple players will be sent as a single user message like: `"[Thorin]: I attack the dragon with my axe\n[Elara]: I cast Shield on Thorin\n[Finn]: I search the room for traps"`
- The existing character context will use the host's character, but the system prompt will be augmented client-side with a "PARTY MEMBERS" section listing all members' names and basic stats

---

## Data Flow

```text
Player A types "I attack the goblin" -> Submit
  -> INSERT into party_dm_prompts (Realtime broadcasts to all)
  -> UI shows "Player A: submitted" in queue

Player B types "I cast Healing Word on A" -> Submit
  -> INSERT into party_dm_prompts

Player A clicks Ready -> UPDATE is_ready = true
Player B clicks Ready -> UPDATE is_ready = true

All ready detected (client-side check):
  -> Host auto-triggers generateResponse()
  -> Bundles prompts: "[Thorin]: I attack the goblin\n[Elara]: I cast Healing Word on Thorin"
  -> INSERT combined user message into party_dm_messages
  -> Calls ai-dm edge function with combined message + host's character context + party member summary
  -> Streams response, INSERT assistant message into party_dm_messages
  -> DELETE all prompts for this round, create new round_id
  -> Realtime pushes new messages to all players
```

---

## Technical Details

### Combined Prompt Format
When generating, all queued prompts are merged into a single user message:
```
[Character A]: I swing my sword at the nearest goblin
[Character B]: I cast Shield of Faith on Character A
[Character C]: I investigate the strange rune on the wall
```

### System Prompt Augmentation
The existing `buildDMSystemPrompt` will receive an additional `partyMembers` array parameter. A new section will be added:
```
## PARTY MEMBERS
This is a multiplayer session. Multiple players are acting simultaneously each round.
- Thorin (Level 5 Fighter, 45/52 HP)
- Elara (Level 5 Cleric, 38/40 HP)
- Finn (Level 4 Rogue, 28/32 HP)
Resolve all player actions in order, describing the scene as a cohesive narrative.
```

### Private Mode Filtering
In private mode, the client filters `party_dm_prompts` to only show the current user's prompt text. Other players' prompts show as "submitted" without content. The combined message sent to the AI still contains all prompts (assembled by the host client before sending).

### Ready Detection
The host client watches `party_dm_prompts` via Realtime. When the count of `is_ready = true` rows equals the party member count and is greater than 0, auto-generation triggers. A short 2-second delay is added to prevent race conditions with late Realtime events.

---

## Security Considerations
- RLS on `party_dm_messages` and `party_dm_prompts` restricted to party members via `is_party_member()`
- Only the host calls the AI edge function (enforced client-side; the edge function itself uses the project API key)
- Prompt deletion after generation restricted to host via RLS
- Foreign keys with ON DELETE CASCADE to `parties` table for cleanup
