
# Auto-Save AI DM Campaigns to the Cloud

## Overview
Add a 30-second cloud auto-save for the active AI DM campaign, mirroring the pattern used by the character auto-save system. localStorage remains a fast-restore cache (1s debounce), while the cloud save runs silently in the background. A small sync indicator in the context banner shows status.

## Changes

### 1. `src/hooks/use-ai-dm.ts` -- Add cloud auto-save logic

**New state and refs:**
- `activeCampaignId` state (moved from AIDMScreen into the hook so auto-save can reference it)
- `cloudSaveTimerRef` for the 30-second debounce
- `lastCloudSaveJsonRef` for dirty-checking against the cloud
- `pendingCloudSave` flag

**New `saveToCloudNow` function:**
- Serializes current messages and campaign summary
- Dirty-checks against `lastCloudSaveJsonRef` to skip no-op saves
- If `activeCampaignId` exists: upserts to `ai_dm_campaigns` table via Supabase client
- If no `activeCampaignId` and user is signed in and messages exist: auto-creates a new campaign row named "Auto-Save" (or derived from first user message) and stores the returned ID
- Silently catches errors (no toast for background saves, only console.warn)

**New effects:**
- 30-second debounced cloud save effect: resets timer on messages/campaignSummary change, fires `saveToCloudNow` when timer expires
- Periodic 2-minute interval fallback (same pattern as `use-auto-cloud-sync.ts`)
- `beforeunload` handler also fires cloud save (best-effort)

**Updated hook return:**
- Add `activeCampaignId`, `setActiveCampaignId`, `lastCloudSyncTime`, `isCloudSyncing` to the returned object

**Updated `loadCampaign`:**
- Sets `activeCampaignId` internally
- Resets `lastCloudSaveJsonRef` to the loaded data

**Updated `newGame` / `clearMessages`:**
- Resets `activeCampaignId` to null

### 2. `src/components/ai-dm/AIDMScreen.tsx` -- Consume from hook, show sync status

**Remove local `activeCampaignId` state** -- now comes from the hook.

**Update `handleLoadCampaign`:**
- Call `loadCampaign(session.messages, session.campaign_summary, session.id)` (pass session ID so the hook tracks it)

**Update `handleSaveCampaign` (manual save):**
- After manual save returns an ID, update the hook's `activeCampaignId` via setter

**Context banner addition:**
- Show a small cloud icon with "Synced Xm ago" or a spinning icon when `isCloudSyncing` is true, next to the existing summary indicator

**New Game button:**
- Already calls `newGame()` which will now clear the `activeCampaignId` in the hook

### 3. `src/hooks/use-campaign-sessions.ts` -- Add silent upsert method

Add a `silentSave` method that performs the same upsert as `saveSession` but without toasts or `loadSessions()` refresh (to avoid UI disruption during background saves). Returns the saved ID or null.

## Data Flow

```text
Message arrives (user or assistant)
  -> localStorage save (1s debounce, existing)
  -> Cloud save timer resets to 30s
  -> 30s elapses with no new messages:
     -> Dirty-check against lastCloudSaveJson
     -> If changed & signed in & activeCampaignId exists: upsert to ai_dm_campaigns
     -> If changed & signed in & no activeCampaignId: insert new row, store returned ID
     -> Update lastCloudSyncTime
```

## What stays the same
- Manual "Save As New" and "Quick Save" in the Campaigns overlay still work
- localStorage persistence (1s debounce, versioned, corruption-guarded)
- The `ai_dm_campaigns` table schema (no migration needed)
- Campaign summary auto-generation every 10 assistant messages
