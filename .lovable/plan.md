

# Multiplayer Party Link System

## Overview

This adds a "Party Link" feature where one player generates a short code (e.g., `AX7K2M`), shares it with up to 3 other players, and all linked players can see each other's full status (HP, conditions, spell slots) in real time -- plus send healing spells and potions directly to each other's characters.

## How It Works for Players

1. **Creating a party**: Open Settings or the Home Screen, tap "Create Party." A 6-character link code appears (e.g., `AX7K2M`) with a copy button.
2. **Joining a party**: Another player taps "Join Party," enters the code, and instantly connects. Up to 4 total players.
3. **Seeing teammates**: A new "Party" panel (accessible from Home or Combat) shows each linked player's character name, HP bar, AC, active conditions, and spell slot usage -- all updating in real time.
4. **Healing a teammate**: When casting a healing spell or using a healing potion, a target picker appears letting you choose yourself OR any party member. Choosing a party member sends the heal to their device, updating their HP bar instantly.
5. **Leaving**: Any player can leave at any time. The party creator can disband the whole party.

## Database Design

### New Tables

**`parties`** -- One row per active party
- `id` (uuid, PK)
- `link_code` (text, unique, 6-char alphanumeric)
- `created_by` (uuid, references auth.users)
- `created_at` (timestamptz)
- `is_active` (boolean, default true)

**`party_members`** -- One row per player in a party
- `id` (uuid, PK)
- `party_id` (uuid, FK to parties)
- `user_id` (uuid, references auth.users)
- `character_name` (text)
- `character_status` (jsonb) -- HP, maxHP, tempHP, AC, conditions, spell slots snapshot
- `joined_at` (timestamptz)
- `updated_at` (timestamptz)

**`party_actions`** -- Log of cross-player actions (heals, potions)
- `id` (uuid, PK)
- `party_id` (uuid, FK to parties)
- `sender_user_id` (uuid)
- `target_user_id` (uuid)
- `action_type` (text) -- 'heal_spell', 'heal_potion'
- `action_data` (jsonb) -- spell name, dice roll, HP healed, etc.
- `created_at` (timestamptz)
- `applied` (boolean, default false)

### RLS Policies
- Party members can only read/write their own party's data
- Members can only update their own `character_status` row
- Anyone authenticated can read a party row (needed for join-by-code lookup)
- Actions can be inserted by any party member, read by target user

### Realtime
- Enable realtime on `party_members` (status updates) and `party_actions` (incoming heals)
- Each client subscribes to their party's channel for instant updates

## Feature Flow

```text
┌─────────────┐     link code      ┌─────────────┐
│  Player A   │ ──────────────────> │  Player B   │
│ (creates)   │                    │  (joins)    │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │  writes own status every 1-2s    │
       ▼                                  ▼
  ┌──────────────────────────────────────────┐
  │         party_members table              │
  │  (realtime subscription broadcasts)      │
  └──────────────────────────────────────────┘
       │                                  │
       │  reads all party member statuses │
       ▼                                  ▼
  ┌───────────┐                    ┌───────────┐
  │ Party UI  │                    │ Party UI  │
  │ (A sees B)│                    │ (B sees A)│
  └───────────┘                    └───────────┘
       │                                  
       │ "Cast Cure Wounds on Player B"   
       ▼                                  
  ┌──────────────────────────────────────────┐
  │         party_actions table              │
  │  (insert heal action, target = B)        │
  └──────────────────────────────────────────┘
       │
       ▼  realtime event received by Player B
  Player B's HP updates automatically
```

## UI Components

### Party Management (new)
- **PartyPanel**: Shows party members' status cards (name, HP bar, AC, conditions, spell slots). Accessible from Home Screen or Combat tab.
- **CreatePartyDialog**: Generates link code, shows it with copy button
- **JoinPartyDialog**: Text input for 6-char code, join button
- **PartyMemberCard**: Compact card showing one teammate's live status

### Modified Existing Components
- **Healing spell cast flow**: Add target picker (self vs. party members) before resolving heal
- **Potion use flow** (QuickActionsDrawer, MobileItemsGrid): Add target picker when healing potion is detected
- **Home Screen**: Add "Party" button/indicator showing connected count
- **Settings**: Add Party section for create/join/leave/disband

## Technical Details

### Status Broadcasting
- A custom hook `usePartySync` runs on each client
- Every 2 seconds (debounced on change), it writes the local character's current HP, maxHP, tempHP, AC, active conditions, and spell slot usage to their `party_members.character_status` row
- A realtime subscription on `party_members` (filtered to party_id) updates the local Party UI when other members' statuses change

### Incoming Heal Processing
- Realtime subscription on `party_actions` (filtered to target_user_id = self)
- When a heal action arrives, the hook calls the existing `handleHPChange` to apply healing
- A toast notification appears: "PlayerA healed you for 12 HP with Cure Wounds!"
- The action is marked `applied = true`

### Link Code Generation
- Server-side (edge function) generates a random 6-char alphanumeric code
- Checks uniqueness against active parties
- Codes are reusable after a party is disbanded

### File Changes Summary

| File | Change |
|------|--------|
| `src/hooks/use-party-sync.ts` | **New** -- Core hook for party state, realtime subscriptions, status broadcasting |
| `src/components/party/PartyPanel.tsx` | **New** -- Party member status display |
| `src/components/party/CreatePartyDialog.tsx` | **New** -- Code generation UI |
| `src/components/party/JoinPartyDialog.tsx` | **New** -- Code input UI |
| `src/components/party/PartyMemberCard.tsx` | **New** -- Individual member status card |
| `src/components/party/HealTargetPicker.tsx` | **New** -- Target selection when healing |
| `src/components/drawers/QuickActionsDrawer.tsx` | **Modified** -- Add target picker for healing potions |
| `src/components/combat/mobile/MobileItemsGrid.tsx` | **Modified** -- Add target picker for healing potions |
| `src/pages/Index.tsx` | **Modified** -- Initialize `usePartySync`, pass party context down |
| `src/components/settings/SettingsContent.tsx` | **Modified** -- Add Party section |
| DB migration | **New** -- Create parties, party_members, party_actions tables with RLS |

### Authentication Requirement
- This feature requires users to be signed in (cloud saves already handle this)
- The Party buttons will show a prompt to sign in if the user is not authenticated

