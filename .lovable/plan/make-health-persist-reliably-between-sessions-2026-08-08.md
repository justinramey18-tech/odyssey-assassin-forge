# Make health persist reliably between sessions

## What happens today

Every health change is already written to this device's storage immediately, and health is included in the character snapshot that goes to the cloud. But the cloud copy only goes up on a delay (about 10 seconds after the last change, a 2-minute timer, or when the app is backgrounded/closed). On phones the app can be killed before that delay elapses, so the last fight's damage or healing can be lost and health "resets" to an older value next session.

There is also no re-read of health when you switch characters mid-session, so the health strip can briefly show the previous hero's numbers until something else refreshes it.

## What to change

1. **Push health to the cloud right after it changes.** After any health update (damage, healing, temporary hit points, potions, DM sync, rest), schedule a cloud save about 2 seconds later. Bursts during combat collapse into a single upload instead of one per hit, so this does not spam the backend.

2. **Save immediately at critical moments.** Force the upload without waiting when health hits zero, when it changes while the app is being hidden/closed, and after a long or short rest.

3. **Refresh health on character switch.** When a different hero is loaded, re-read that hero's stored health so the bars show the correct numbers instantly.

4. **Guard the numbers.** Any health value coming back from storage or the cloud must be a real finite number and within 0..max before it is applied; otherwise fall back to the last good value. This prevents a bad value from being written into the save.

## Technical notes

- `src/pages/Index.tsx`: `handleHPChange` (and the max-HP recalculation effect) already call `setScopedItem('odyssey-hp-state', ...)`. Add a small debounced trigger next to it that dispatches the existing `odyssey-force-cloud-sync` event, which `use-auto-cloud-sync.ts` already listens for and turns into an immediate local + cloud save. Zero-HP and rest paths dispatch with no delay.
- Add an `odyssey-character-loaded` listener that re-reads `odyssey-hp-state` into `hpState` (falling back to the calculated max when absent) — same pattern used for druid circle and XP preset in the same file.
- Validate parsed health with `Number.isFinite` in the initial state reader, the cloud-restore paths (lines ~1399 and ~1662), and the character-loaded reader.
- `odyssey-hp-state` is already registered in `scoped-keys.ts`, `resetApp.ts`, and the `SaveData` interface, so no new storage registration is needed.
