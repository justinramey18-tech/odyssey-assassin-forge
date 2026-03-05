

## Plan: Add Co-Host Access to Host's GM Guides

### Problem
Currently, GM guides are user-scoped (RLS: `auth.uid() = user_id`). In party DM, each user loads their own guides via `useGMGuides()`. Co-hosts need to see, create, and edit the **host's** guides since those are what drive the shared AI DM narrative.

### Database Changes (1 migration)

**Create a security definer function** `is_co_host_of(target_user_id uuid)` that checks whether `auth.uid()` is listed as a co-host in any active party created by `target_user_id`:

```sql
CREATE OR REPLACE FUNCTION public.is_co_host_of(_owner_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM party_shared_state pss
    JOIN parties p ON p.id = pss.party_id
    WHERE pss.state_type = 'co_hosts'
    AND p.created_by = _owner_id
    AND p.is_active = true
    AND pss.state_data->'userIds' ? auth.uid()::text
  )
$$;
```

**Add RLS policies on `gm_guides`:**
- SELECT: `Co-hosts can view host guides` → `is_co_host_of(user_id)`
- UPDATE: `Co-hosts can update host guides` → `is_co_host_of(user_id)`
- INSERT: `Co-hosts can insert guides for host` → `is_co_host_of(user_id)`
- DELETE: `Co-hosts can delete host guides` → `is_co_host_of(user_id)`

### Frontend Changes

**1. `src/hooks/use-gm-guides.ts`** — Add optional `ownerUserId` parameter
- When `ownerUserId` is provided (co-host scenario), fetch guides for that user instead of the current user
- On persist-to-cloud, use `ownerUserId` as the `user_id` in upserts
- This keeps the hook reusable; solo DM calls it without `ownerUserId`, party DM co-hosts pass the host's ID

**2. `src/components/ai-dm/StandalonePartyDMScreen.tsx`**
- Determine the party creator's user ID (already available or derivable from `isPartyCreator` + party data)
- When current user is a co-host (`!isPartyCreator` but `isHost` from the co-host plan), pass `ownerUserId: partyCreatorId` to `useGMGuides()`
- This makes the GMGuidesManager show the host's guides and all CRUD operations target the host's guides

**3. Pass `partyCreatorId` into `StandalonePartyDMScreen`**
- The parent component that renders `StandalonePartyDMScreen` needs to pass the party creator's user ID as a new prop so the co-host can load their guides

### How It Integrates with the Co-Host Plan
This is an addition to the previously approved co-host plan. The co-host plan computes `isHost = isPartyCreator || isCoHost`. When `isHost && !isPartyCreator` (i.e., co-host), the `useGMGuides` hook targets the host's guides. The `onShowGuides` callback in settings (already gated by `isCreator`) becomes available to co-hosts automatically.

### What This Enables for Co-Hosts
- View all of the host's GM guides
- Toggle guides on/off
- Edit existing guide content
- Create new guides (stored under the host's user_id)
- Delete guides
- Use the AI Guide Creator to generate new guides (existing feature in GMGuidesManager)

