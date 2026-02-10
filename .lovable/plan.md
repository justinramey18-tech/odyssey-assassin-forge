

## Multiplayer Feature Pack: 1 Low-Risk + 3 Medium-Risk

---

### Feature 1: Party Chat (Low Risk)

Real-time text messaging within the Party Panel.

**What it does:**
- Collapsible "Party Chat" section matching existing Rolls/Loot pattern
- Text input (max 200 chars) with send button
- Shows sender name, message, relative timestamp
- Real-time via Realtime subscription on a new `party_messages` table
- Loads last 50 messages on open, auto-scrolls to newest
- Unread count badge on collapsed header

---

### Feature 2: Party Encounter Voting (Medium Risk)

A polling system where any member can propose a decision for the group (e.g., "Sneak past the guards or fight?", "Rest or push forward?").

**What it does:**
- "Start Vote" button in a new collapsible "Party Votes" section
- Creator enters a question + 2-4 options
- All members see the poll and can cast one vote each
- Results update in real-time showing vote counts and who voted for what
- Poll auto-closes after all members vote (or creator can force-close)
- Uses `party_shared_state` with `state_type: 'vote'`

**Why medium risk:** Introduces interactive decision-making that affects party flow. Requires conflict resolution (simultaneous votes, edge cases with members leaving mid-vote).

---

### Feature 3: Party Battlefield Map Markers (Medium Risk)

A shared coordinate-based marker system where members can place named tokens on a simple grid, giving the party a lightweight tactical overview.

**What it does:**
- Collapsible "Battle Map" section showing a 10x10 grid
- Each member can place/move their own marker (color-coded by member)
- Anyone can place enemy markers (red, named)
- Markers sync in real-time via `party_shared_state` with `state_type: 'map_markers'`
- Tap a cell to place, tap your marker to remove
- Shows marker legend with names below the grid

**Why medium risk:** Visual state synchronization with potential race conditions when multiple members move markers simultaneously. Grid rendering adds UI complexity.

---

### Feature 4: Party Combat Log (Medium Risk)

An aggregated, real-time feed of combat actions across all party members, creating a shared narrative of what is happening in the fight.

**What it does:**
- Collapsible "Combat Log" section in the Party Panel
- Automatically broadcasts key actions: damage dealt, damage taken, heals, spell casts, kills, death saves
- Each entry shows: timestamp, member name, action icon, description (e.g., "Aric dealt 14 slashing damage", "Luna cast Fireball")
- Color-coded by action type (red for damage taken, green for heals, orange for attacks, purple for spells)
- Keeps last 30 entries, auto-scrolls
- New `party_combat_log` table with RLS for persistence and Realtime

**Why medium risk:** Requires integration points with existing combat/spell systems to auto-broadcast events. The hook needs to expose a `logCombatEvent` function that other parts of the app call at the right moments.

---

### Technical Details

#### Database Changes

Two new tables:

```text
party_messages
  id            UUID PK default gen_random_uuid()
  party_id      UUID NOT NULL FK -> parties(id) ON DELETE CASCADE
  user_id       UUID NOT NULL
  sender_name   TEXT NOT NULL
  message       TEXT NOT NULL
  created_at    TIMESTAMPTZ default now()

  RLS: SELECT/INSERT restricted to is_party_member(auth.uid(), party_id)
  Realtime enabled

party_combat_log
  id            UUID PK default gen_random_uuid()
  party_id      UUID NOT NULL FK -> parties(id) ON DELETE CASCADE
  user_id       UUID NOT NULL
  character_name TEXT NOT NULL
  action_type   TEXT NOT NULL (attack, damage_taken, heal, spell, kill, death_save)
  description   TEXT NOT NULL
  metadata      JSONB default '{}'
  created_at    TIMESTAMPTZ default now()

  RLS: SELECT/INSERT restricted to is_party_member(auth.uid(), party_id)
  Realtime enabled
```

Features 2 (Voting) and 3 (Map Markers) use existing `party_shared_state` with new `state_type` values -- no additional tables.

#### New Components

| Component | Purpose |
|---|---|
| `src/components/party/PartyChat.tsx` | Message list with ScrollArea + text input |
| `src/components/party/PartyVote.tsx` | Vote creation form + ballot UI + results display |
| `src/components/party/PartyBattleMap.tsx` | 10x10 grid with color-coded markers |
| `src/components/party/PartyCombatLog.tsx` | Aggregated combat event feed |

#### Modified Files

| File | Changes |
|---|---|
| `src/hooks/use-party-sync.ts` | Add state, subscriptions, and functions for all 4 features: `sendMessage`, `partyMessages`, `startVote`, `castVote`, `closeVote`, `activeVote`, `updateMapMarkers`, `mapMarkers`, `logCombatEvent`, `combatLog`. Add Realtime channels for `party_messages` and `party_combat_log`. |
| `src/components/party/PartyPanel.tsx` | Add 4 new collapsible sections using existing Collapsible pattern |
| `src/components/party/index.ts` | Export new components |

#### Risk Assessment

| Feature | Risk | Reason |
|---|---|---|
| Party Chat | Low | Follows exact pattern of `party_dice_rolls`. Simple insert/read. |
| Encounter Voting | Medium | State machine logic (open/closed/expired). Edge cases with members leaving mid-vote. |
| Battle Map Markers | Medium | Concurrent upserts to shared state. Grid UI complexity. |
| Combat Log | Medium | Requires integration hooks into existing combat flows. New table + subscription. |

No changes to core character state, HP calculations, ability systems, or prestige mechanics.

