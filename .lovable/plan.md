
# Cloud Sync for Chronicle Campaigns

## Overview

The Chronicle campaign manager (the "Campaigns" screen with session logs, stats, and batch import) currently stores everything in localStorage only. This plan adds cloud persistence so campaigns and their sessions sync across devices, following the same dual-layer pattern used by GM guides.

## Database Tables

### 1. `chronicle_campaigns` -- Campaign metadata

| Column | Type | Default |
|--------|------|---------|
| id | uuid (PK) | gen_random_uuid() |
| user_id | uuid (NOT NULL) | -- |
| name | text (NOT NULL) | 'Untitled Campaign' |
| description | text | NULL |
| dm_name | text | NULL |
| setting | text | NULL |
| start_date | text | NULL |
| current_arc | text | NULL |
| session_count | integer | 0 |
| last_session_date | text | NULL |
| tags | text[] | '{}' |
| gm_guide_ids | text[] | '{}' |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

RLS: Users can only CRUD their own rows (`auth.uid() = user_id`).

### 2. `chronicle_campaign_sessions` -- Session data per campaign

| Column | Type | Default |
|--------|------|---------|
| id | uuid (PK) | gen_random_uuid() |
| user_id | uuid (NOT NULL) | -- |
| campaign_id | uuid (NOT NULL, FK to chronicle_campaigns.id ON DELETE CASCADE) | -- |
| session_number | integer | 1 |
| session_name | text | 'Session' |
| session_date | text | NULL |
| input_preview | text | '' |
| input_hash | text | '' |
| input_length | integer | 0 |
| parse_mode | text | 'offline' |
| parsed_at | text | NULL |
| parse_result | jsonb | NULL |
| enhanced_patterns | jsonb | NULL |
| summary | jsonb | NULL |
| arc_markers | jsonb | '[]' |
| notes | text | NULL |
| created_at | timestamptz | now() |

RLS: Users can CRUD their own rows. DELETE cascade ensures sessions are cleaned up when a campaign is deleted.

## Hook Rewrite: `src/hooks/use-campaigns.ts`

Follow the same pattern as `use-gm-guides.ts`:

1. **On mount**: Load from localStorage immediately (fast startup), then fetch from cloud if signed in.
2. **Cloud is source of truth**: When cloud data exists, merge with any local-only items and push local-only to cloud.
3. **Every mutation** (create, update, delete campaign/session) writes to both localStorage and cloud simultaneously.
4. **Fallback**: If not signed in, localStorage-only behavior is preserved exactly as-is.

Key changes to the hook:
- Add `supabase` import and cloud read/write helpers (`persistCampaignToCloud`, `deleteCampaignFromCloud`, `persistSessionToCloud`, `deleteSessionFromCloud`).
- The `loadCampaignSessions` function will also check cloud when cache misses.
- `createCampaign` / `updateCampaign` / `deleteCampaign` each call their cloud counterpart after updating local state.
- `addSessionToCampaign` / `deleteSession` / `importSessions` do the same for the sessions table.

## Files Modified or Created

| File | Action | Purpose |
|------|--------|---------|
| Database migration | Create | `chronicle_campaigns` + `chronicle_campaign_sessions` tables with RLS |
| `src/hooks/use-campaigns.ts` | Edit | Add cloud sync (read on mount, write on every mutation) |

## What Stays the Same

- The `Campaign` and `CampaignSession` TypeScript interfaces remain unchanged.
- All UI components (`CampaignManagerScreen`, `CampaignDetailView`, etc.) continue to work via the same hook API -- no prop or component changes needed.
- localStorage remains the fast-load layer; cloud is the durable sync layer.
- Guest users (not signed in) keep the same localStorage-only experience.

## Technical Details

```text
Data flow after change:

  Hook init
    |
    +--> Read localStorage (instant)
    |
    +--> Check auth session
           |
           +--> Signed in: fetch cloud tables
           |      |
           |      +--> Cloud has data: merge, push local-only to cloud
           |      +--> No cloud data: push all local to cloud
           |
           +--> Not signed in: done (localStorage only)

  On mutation (create/update/delete):
    |
    +--> Update React state
    +--> Write to localStorage
    +--> If signed in: write to cloud (fire-and-forget)
```
