

# Shared Guide Library + Campaign Assignments + Guide Presets

## What This Adds (Non-Technical)

Right now, GM guides live in one flat list, and campaigns already quietly track which guides they used -- but there's no visual way to manage that. This plan adds two things:

1. **Campaign Guide Assignments** -- When you open a campaign in the AI DM saves drawer, you'll see a "Guides" tab where you can check/uncheck which guides from your library should be active for that campaign. Switching campaigns auto-activates the right guides.

2. **Guide Presets** -- You can save a named combo of guides (e.g., "Horror Kit", "Exploration Bundle") and apply it to any campaign with one tap, instead of toggling guides individually every time.

Your guide library stays shared and global -- guides are never duplicated. Campaigns and presets just reference them by ID.

---

## Changes

### 1. New Database Table: `gm_guide_presets`

Store named presets in the cloud so they sync across devices.

```text
gm_guide_presets
  id          uuid (PK, default gen_random_uuid())
  user_id     uuid (NOT NULL)
  name        text (NOT NULL)
  guide_ids   text[] (NOT NULL, default '{}')
  created_at  timestamptz (default now())
  updated_at  timestamptz (default now())
```

RLS: Users can only CRUD their own presets (same pattern as gm_guides).

### 2. New Hook: `src/hooks/use-guide-presets.ts`

- `presets` -- list of all presets
- `createPreset(name, guideIds)` -- save current combo as a preset
- `deletePreset(id)` -- remove a preset
- `applyPreset(presetId, onApply)` -- calls a callback with the preset's guide IDs

Loads from cloud on mount (same pattern as `use-gm-guides.ts`), with localStorage fallback.

### 3. New Component: `src/components/campaign/CampaignGuidesTab.tsx`

A new tab ("Guides") inside `CampaignDetailView` showing:

- **Checklist** of all guides from the user's library, with checkboxes indicating which are assigned to this campaign (sourced from `ai_dm_campaigns.gm_guide_ids`).
- **Toggle a guide** updates the campaign's `gm_guide_ids` array in the database.
- **Presets section** at the top: a row of preset chips. Tapping one bulk-assigns those guide IDs to the campaign.
- **"Save as Preset"** button: saves the current campaign's guide selection as a new named preset.

### 4. Update: `CampaignDetailView.tsx`

- Add a 4th tab: "Guides" (using a Book icon) alongside Sessions, Stats, and Import.
- Pass down the user's full guide list + the campaign's `gm_guide_ids`.
- New props: `guides`, `guidePresets`, `onUpdateGuideIds`, `onCreatePreset`, `onDeletePreset`.

### 5. Update: `CampaignManagerScreen.tsx`

- Import and use `useGMGuides()` and `useGuidePresets()` hooks.
- Pass `guides`, `presets`, and handlers down to `CampaignDetailView`.
- When guide IDs are updated, call `updateCampaign(id, { gmGuideIds: [...] })` to persist.

### 6. Update: `useCampaigns` hook (if needed)

- Ensure `updateCampaign` supports updating `gm_guide_ids` on the `ai_dm_campaigns` table. If it already uses a generic update, this may just work. Otherwise, add a `updateCampaignGuides(campaignId, guideIds)` method.

---

## Files Modified or Created

| File | Action | Purpose |
|------|--------|---------|
| Database migration | Create | `gm_guide_presets` table + RLS |
| `src/hooks/use-guide-presets.ts` | Create | Hook for CRUD on guide presets |
| `src/components/campaign/CampaignGuidesTab.tsx` | Create | Checklist UI + preset chips |
| `src/components/campaign/CampaignDetailView.tsx` | Edit | Add "Guides" tab |
| `src/components/campaign/CampaignManagerScreen.tsx` | Edit | Wire up guides + presets hooks |
| `src/components/campaign/index.ts` | Edit | Export new component |
| `src/hooks/use-campaigns.ts` | Edit | Ensure guide ID updates are supported |

---

## User Flow

1. Open Campaigns screen, select a campaign.
2. Tap the new "Guides" tab.
3. See your full guide library as a checklist -- tick the ones relevant to this campaign.
4. Optionally tap "Save as Preset" to name and save the current selection.
5. Next time, tap a preset chip to instantly apply that combo to any campaign.
6. When you load this campaign in the AI DM, the correct guides auto-activate (existing `gm_guide_ids` + `onCampaignSwitch` flow handles this already).

