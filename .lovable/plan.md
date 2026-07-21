## The bug in plain terms

When a player leaves the Empyrean DM screen (goes home, opens another tab, etc.) and comes back, the linked universe looks unlinked even though the database link is intact. The reason: the "active campaign id" lives only in the DM screen's memory. When the screen closes, that memory is wiped. When they return, the DM screen starts up not knowing which campaign it is, so the Linked Universe feature has nothing to look up and shows unlinked.

There is already a helper (`useAutoCampaign`) that tries to save/restore this id in the browser, but the restore isn't reliable enough in practice, and there are edge cases where the id gets cleared when it shouldn't. We will tighten this so returning to the screen always reconnects to the same campaign automatically.

## What we'll change

Files touched:
- `src/hooks/use-auto-campaign.ts` — make persistence/restore bulletproof
- `src/components/empyrean/EmpyreanDMScreen.tsx` — no logic changes, just verify wiring
- `src/components/ai-dm/AIDMScreen.tsx` — no logic changes, just verify wiring

### 1. Make the saved id survive unmount and reloads

In `use-auto-campaign.ts`:

- Rename the storage keys to the exact keys the user asked for:
  - Empyrean: `empyrean-active-campaign-id`
  - Solo: `solo-active-campaign-id`
  - Read the old keys once as a fallback and copy them over so existing users don't lose their link.
- Only write to storage when the id is a real value. Never clear the stored id just because the component is unmounting or the id momentarily flips to null. The "clear on transition to null" branch in the current mirror effect is removed — clearing will only happen in the two intentional cases below.
- The stored id is cleared only when:
  a. The restore step confirms the saved id no longer belongs to any campaign this user owns (stale id cleanup), or
  b. A different campaign id is written (natural overwrite when the user loads or creates another campaign).
- New Game / clearMessages will still start a fresh campaign the next time the player sends a message, and the auto-create step will then overwrite the stored id with the new one.

### 2. Restore the campaign the moment the screen reopens

Still in `use-auto-campaign.ts`:

- On mount, as soon as the user is signed in and saved sessions have loaded, read the stored id.
- If the id matches a saved session, load that session using the existing load path so messages, summary, memory anchors, and guides all come back — exactly what happens when the player taps a saved campaign in the list.
- If there is already an in‑progress conversation locally with no id yet, just re-attach the id (don't clobber messages).
- The restore is guarded so it only fires once per mount, but the guard is per-mount, so returning to the screen always gets a fresh chance to restore.

### 3. Universe reconnects on its own

The Linked Universe hook already refetches whenever its `campaignId` input changes. Because the DM screen already mirrors `activeCampaignId` into `trackingCampaignId` via an effect, as soon as the restore in step 2 sets the id, the universe hook re-runs and the existing link shows up. No changes needed here beyond confirming the mirror effect still runs — it does.

### 4. Nothing else may clear the link on exit

Audit and confirm that closing the Empyrean or AI DM screen does not:
- call `leaveUniverse`
- clear the stored campaign id
- reset universe-related state in a way that requires re-linking

Any such cleanup found on unmount/onClose paths is removed. Unlinking will only happen when the user explicitly taps Unlink.

## How we'll verify

1. Sign in, open an Empyrean campaign, link a universe.
2. Go home, come back to the same campaign → universe still shows linked with the same riders, no relink prompt.
3. Fully close the app and reopen → still linked.
4. Only tapping Unlink removes the link.
5. Repeat the same steps in classic Solo (AIDMScreen) to confirm the same behavior.