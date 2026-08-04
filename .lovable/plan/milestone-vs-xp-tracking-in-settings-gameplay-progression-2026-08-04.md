# Milestone vs XP tracking in Settings > Gameplay > Progression

## What you get

The Progression panel gains a top-level choice:

- **XP Tracking (numbers)** — the current behaviour: you gain XP, the bar fills, levels happen automatically. The existing Slow / Natural / Fast Track speed options stay visible underneath this choice.
- **Milestone Tracking (no numbers)** — no XP totals, no progress bar, no "Add XP" button. Instead you get a clear "Advance a Level" button the storyteller presses when the group earns it. The speed options are hidden, since they mean nothing without XP.

Switching between the two is instant and does not wipe anything: if you go to Milestone and later switch back to XP, your accumulated XP is still there.

## How it behaves in each place

- **Progression settings panel** — two large choice cards (XP vs Milestone) at the top, then the speed options shown only for XP mode.
- **Character/stats XP widget** — in XP mode it looks exactly as today. In Milestone mode it shows the current level, a short "Milestone progression" line, and the level-up button; the bar and XP entry controls are hidden.
- **Level-up button on the character screen** — currently hidden by the "Organic Leveling" rule of Honest Mode. It will always be available in Milestone mode, since manual advancement is the only way to level there.
- **Character creation wizard** — already offers a Milestone preset. Picking it there will now show as Milestone in Settings, and vice versa.

## Technical notes

Today two separate stores describe progression and they can disagree:

- `odyssey-xp-progression` (scoped storage, read by `useXPProgression` and the settings widget) holds slow/natural/fast.
- `xpPreset` state in `src/pages/Index.tsx` (saved into the cloud save blob, set only by the wizard) holds standard/fast/slow/**milestone**, and is what the actual level-up math in `handleAddXP` uses.

Work:

1. Extend `XPProgressionMode` in `src/components/settings/XPProgressionWidget.tsx` with `milestone` (multiplier 0) and restructure the widget into the tracking-style choice plus conditional speed options.
2. Make `Index.tsx` the single source of truth by syncing the two: `xpPreset` is derived from the settings mode (`milestone` → `milestone`, `slow` → `slow`, `natural` → `standard`, `fast` → `fast`), listening to the existing `odyssey-xp-progression-change` event, and the settings value is initialised from a loaded save so cloud loads and the wizard stay consistent.
3. In `src/components/character/XPTracker.tsx`, branch on `multiplier === 0` to hide the bar/XP dialog and render the level-up action instead (calling the same manual level-up path used by the existing "Trigger Level Up" button).
4. In `Index.tsx`, allow the manual level-up button when the mode is milestone even if the Honest Mode organic-leveling rule is on, and update the helper text below it.
5. No database or backend changes; storage keys already exist in the scoped-key registries.
