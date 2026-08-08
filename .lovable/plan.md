# Working Rest Buttons in the DM Character Sheet

Today the Rest section in the in-DM character sheet shows a preview, but only the solo screen actually applies anything, the party screen's rest button does nothing at all, nothing is counted, and the DM is never told a rest happened.

## What changes

**Short rest**
- Restores a quarter of your maximum health (rounded up, capped at full) — same rule the main app already uses.
- Refreshes short-rest resources: pact magic, channel divinity, wild shape uses, action economy, and short-rest conditions.
- Adds 1 to a short-rest counter.

**Long rest**
- Everything a short rest gives, plus full health, temporary health cleared, death saves reset, and all spell slots and long-rest resources restored.
- Resets the short-rest counter back to zero.

**Short rest tracker**
- The Rest section shows "Short rests since your last long rest: N".
- Saved per character, so switching heroes shows that hero's own count, and it survives closing the app.

**Preview before confirming**
- The confirm sheet already lists spell slots and effects; it will also list the exact health you'd get back, which short-rest resources refresh, and (for a long rest) that the short-rest count resets.

**Telling the DM**
- After you confirm, a short line is sent automatically, exactly like using a consumable does — for example: "Ramey takes a short rest (1 hour), recovering 9 HP. Second short rest since the last long rest." The DM acknowledges the downtime and continues the scene; it doesn't re-roll or re-award anything, since the app already applied it.

**Party mode**
- The same buttons work in the party DM sheet, applying to your own character and posting the same short line into the round.

## Technical notes

- New `src/lib/restTracker.ts`: scoped short-rest counter (`odyssey-short-rest-count`) using `getScopedItem`/`setScopedItem` plus `migrateToScoped`, with increment/reset helpers and an `odyssey-character-loaded` re-read. Registered in `scoped-keys.ts` SCOPED_KEYS, `resetApp.ts` ALL_STORAGE_KEYS, and `use-auto-save.ts` SaveData.
- `SoloCharacterSheet.tsx`: Rest section gains the counter display; on confirm it calls the existing `onRest`, updates the counter, and stages/sends the DM line through a new optional `onRestPrompt` callback (falls back to the existing composer-staging path when absent).
- `RestPreviewSheet` already accepts `extraLines`; the sheet will pass health and short-rest resource lines computed from `ctx` (max/current HP, wild shape uses, pact slots).
- `AIDMScreen.tsx`: keeps `onRest -> autoSyncCallbacks.onRestOccurred` (which runs `handleShortRest`/`handleLongRest` in `Index.tsx`) and adds the send path for the rest line.
- `PartyDMScreen.tsx`: replaces the `onRest={() => {}}` no-op with the real handler forwarded from `StandalonePartyDMScreen`'s `autoSyncCallbacks.onRestOccurred`, passing `undefined` when unavailable rather than a no-op; rest line goes through the same send path used by consumables.
- Health changes flow through the existing HP callbacks so scoped storage and cloud sync stay authoritative; no edge function or database changes.
