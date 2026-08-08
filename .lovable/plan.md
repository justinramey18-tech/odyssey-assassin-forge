# Working Rest Buttons in the DM Character Sheet

Today the Rest section in the in-DM character sheet shows a preview, but only the solo screen actually applies anything, the party screen's rest button does nothing at all, nothing is counted, and the DM is never told a rest happened.

## What changes

**Short rest**
- Restores a quarter of your maximum health (rounded up, capped at full) — same rule the main app already uses.
- Refreshes short-rest resources: pact magic, channel divinity, wild shape uses, action economy, and short-rest conditions.
- Spends one of your available short rests.
- When you have none left, the Short Rest button is disabled and says you need a long rest first.

**Long rest**
- Everything a short rest gives, plus full health, temporary health cleared, death saves reset, and all spell slots and long-rest resources restored.
- Refills your short rests back to 3.

**Short rest tracker**
- The Rest section shows "Short rests remaining: 2 of 3", with three pips so it reads at a glance.
- Saved per character, so switching heroes shows that hero's own count, and it survives closing the app. New characters start with all 3 available.

**Preview before confirming**
- The confirm sheet already lists spell slots and effects; it will also list the exact health you'd get back, which short-rest resources refresh, and how many short rests you'll have left afterwards (or, for a long rest, that they refill to 3).

**Telling the DM**
- After you confirm, a short line is sent automatically, exactly like using a consumable does — for example: "Ramey takes a short rest (1 hour), recovering 9 HP. 1 short rest remaining before a long rest is needed." The DM acknowledges the downtime and continues the scene; it doesn't re-roll or re-award anything, since the app already applied it.


**Party mode**
- The same buttons work in the party DM sheet, applying to your own character and posting the same short line into the round.

## Technical notes

- New `src/lib/restTracker.ts`: scoped remaining-short-rests value (`odyssey-short-rests-remaining`, default 3, max 3) using `getScopedItem`/`setScopedItem` plus `migrateToScoped`, with spend/refill helpers, `Number.isFinite` guarding on read, and an `odyssey-character-loaded` re-read. Registered in `scoped-keys.ts` SCOPED_KEYS, `resetApp.ts` ALL_STORAGE_KEYS, and `use-auto-save.ts` SaveData.
- `SoloCharacterSheet.tsx`: Rest section gains the pips/remaining display and disables Short Rest at zero; on confirm it calls the existing `onRest`, spends or refills the count, and stages/sends the DM line through a new optional `onRestPrompt` callback (falls back to the existing composer-staging path when absent).
- `RestPreviewSheet` already accepts `extraLines`; the sheet will pass health and short-rest resource lines computed from `ctx` (max/current HP, wild shape uses, pact slots).
- `AIDMScreen.tsx`: keeps `onRest -> autoSyncCallbacks.onRestOccurred` (which runs `handleShortRest`/`handleLongRest` in `Index.tsx`) and adds the send path for the rest line.
- `PartyDMScreen.tsx`: replaces the `onRest={() => {}}` no-op with the real handler forwarded from `StandalonePartyDMScreen`'s `autoSyncCallbacks.onRestOccurred`, passing `undefined` when unavailable rather than a no-op; rest line goes through the same send path used by consumables.
- Health changes flow through the existing HP callbacks so scoped storage and cloud sync stay authoritative; no edge function or database changes.
