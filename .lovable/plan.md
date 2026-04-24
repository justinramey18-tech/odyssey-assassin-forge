

## Talk to the DM — full campaign reconfiguration via chat

### What changes
The Director already handles guides, memory anchors, summaries, dragon personality, and OOC notes. This adds the last two missing slots: **identity** (rider/dragon names, color, signet, year) and **campaign settings** (focus, lore guides, tone guides, session template). After this, anything you can edit in the Reconfigure Campaign form is also reachable through natural conversation with the Director.

The Reconfigure Campaign form stays untouched as the wholesale-edit backup.

### How it works
- The Director receives, alongside everything it already gets, a snapshot of your **current campaign config** plus a **catalog** of valid lore-guide IDs, tone-guide IDs, and session-template IDs.
- When you say "make it darker" or "shift focus to political", the Director picks the right catalog IDs and proposes a single card.
- For renames or year advancement, it acknowledges the in-fiction weight ("That's a major shift…") then proposes an UPDATE IDENTITY card.
- If you ask for something that isn't in the catalog (e.g. "Steampunk Gritty tone"), the Director tells you and points you at the Reconfigure form instead of inventing IDs.

### Two new action card types
- **UPDATE IDENTITY** — shows whichever of name / dragon / color / signet / year are changing. Destructive (overwrites). Confirm → setConfig + save.
- **UPDATE SETTINGS** — shows focus / guide counts / template. Destructive. Replaces the full lore- or tone-guide list (not a delta). Confirm → setConfig + save. Unknown IDs are filtered out client-side with a warn log.

### Files touched
- `supabase/functions/empyrean-director/index.ts` — add 2 enum values, payload schema fields, system-prompt sections (action types 8 & 9), 2 catalog discipline rules, current-config + catalog blocks in the state serializer, 2 new validation branches.
- `src/hooks/use-director-chat.ts` — extend `DirectorActionType` and `DirectorProposedAction` with the new fields; propagate them in the raw-to-typed mapper; extend `buildStatePayload` to ship `campaign_config` + the three catalogs (id/name/description only — no guide bodies).
- `src/components/empyrean/DirectorChat.tsx` — add 2 new cases in `getActionMeta` so the cards render previews.
- `src/components/empyrean/EmpyreanDMScreen.tsx` — add 2 dispatcher branches in `handleConfirmDirectorAction`. Each diff-checks against current config, calls `setConfig` + `saveEmpyreanDMConfig`, validates IDs against the catalogs, and toasts a summary of what changed.

### Guards (carried from the brief)
- Identity fields are free text — no catalog validation.
- Guide-list updates are full replacements, not deltas. Director computes `current + new` or `current − removed` itself.
- Catalog payload is id + name + short description only — guide bodies are never sent (keeps payload small).
- One action per Confirm. No batched transactions, no undo, no auto-close of the Talk tab.
- All earlier action types unchanged.

### How you'll know it's working
1. "Change my name to Xeyrin" → UPDATE IDENTITY card → Confirm → header reflects new name, persists across reload.
2. "Shift focus to political intrigue" → UPDATE SETTINGS card with `Focus: political` → Confirm → reflected in next DM turn and in Reconfigure form.
3. "Make it darker, more horror" → Director picks the matching tone-guide ID(s) from the catalog and proposes UPDATE SETTINGS.
4. "Add the Steampunk Gritty tone guide" → Director declines, suggests Reconfigure form.
5. Open Settings → Reconfigure Campaign → form pre-fills with whatever the Director just changed. Backup path still works.

