

# Kick Party Member — Implementation Plan

## Overview
Add a "kick" action so the party host can remove any member from the party. This requires a backend action (to bypass RLS — members can only delete *themselves*) and a UI trigger on the member card.

## Changes

### 1. Backend: `supabase/functions/party-link/index.ts`
Add a new `action === 'kick'` handler:
- Verify the caller is the party creator (`parties.created_by === user.id`)
- Delete the target member from `party_members` where `user_id === body.targetUserId` and `party_id === body.partyId`
- Return success/error

### 2. UI: `src/components/party/PartyMemberCard.tsx`
- Add an `onKick` optional prop and `isCreator` prop
- Show a small kick button (lucide `UserMinus` icon) on non-self cards when `isCreator && onKick` is provided
- Button triggers `onKick(member)` with `e.stopPropagation()`

### 3. Wiring: `src/components/party/PartyPanel.tsx`
- Pass `isCreator={party.isCreator}` and `onKick` to each `PartyMemberCard`
- `onKick` shows a confirmation toast ("Remove {name} from party?") then calls the `party-link` edge function with `action: 'kick'`
- On success, toast confirmation; the realtime subscription on `party_members` will auto-update the member list

No database migration needed — the edge function uses the service role key which bypasses RLS.

