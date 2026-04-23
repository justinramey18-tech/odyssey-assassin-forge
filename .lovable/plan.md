

## Fix Reconfigure Campaign — pre-fill the form with existing values

### What you'll see after this prompt

In the Empyrean DM, tap **SHEET → Settings → Reconfigure Campaign**. Instead of being dumped on the home screen, the DM closes, the Empyrean menu surfaces briefly, and the **Manual Setup** form opens automatically with every field already filled in from your current campaign — dragon name, color, signet, year, focus, lore picks, tone picks. Tweak any value, walk through the steps, launch — only the changed values update. New Campaign and the back arrow keep their existing behavior.

### What's being changed

**1. `src/components/empyrean/EmpyreanDMScreen.tsx`**
- Extend the `onClose` reason union from `'newCampaign'` to `'newCampaign' | 'reconfigure'`.
- The Reconfigure row in CharacterSheet now closes the DM with reason `'reconfigure'` instead of a plain close.

**2. `src/components/home/HomeScreen.tsx`**
- New piece of local state: `empyreanScreenAutoOpen` (either `'manual'` or `null`) used to tell the Empyrean menu to auto-open the Manual Setup form.
- The DM's `onClose` handler now also catches `'reconfigure'` — sets the auto-open flag and opens the Empyrean menu.
- The `<EmpyreanScreen>` render gets two new props: `autoOpen` and `onAutoOpenConsumed` (the menu calls the latter once it has acted on the signal so it doesn't re-fire).
- Closing the Empyrean menu also clears the auto-open flag.

**3. `src/components/empyrean/EmpyreanScreen.tsx`**
- Accepts the new `autoOpen` and `onAutoOpenConsumed` props.
- A small effect: when the menu opens with `autoOpen === 'manual'`, it immediately flips `showSetup` true and calls the consumed callback.
- Passes the existing `empyreanConfig` into `<EmpyreanCampaignSetup>` as `initialConfig` so the form can pre-fill regardless of how it was opened.

**4. `src/components/empyrean/EmpyreanCampaignSetup.tsx`**
- New optional prop `initialConfig?: EmpyreanDMConfig | null`.
- The Step 1 fields (`dragonName`, `dragonColor`, `signetType`, `yearAtBasgiath`), Step 2 (`campaignFocus`), Step 3 (`selectedLore`), and Step 4 (`selectedTone`) initialize from `initialConfig` when present, else fall back to today's defaults.
- `selectedLore`/`selectedTone` (the actual variable names in this file — not `selectedLoreIds`/`selectedMetaIds`) hydrate from `initialConfig.selectedLoreGuides` / `initialConfig.selectedToneGuides`.
- Save/launch logic is untouched — submitting still overwrites the same storage key cleanly.

### What stays untouched

- `'newCampaign'` reason handling — still wipes config and opens the setup menu fresh.
- AI Setup (`EmpyreanAICampaignSetup`) routing — unchanged.
- Party DM, AIDMScreen, and other DM screens.
- The Empyrean menu cards (Launch with AI / Manual Setup / Enter DM / Reconfigure) — they still work; the Reconfigure card now also benefits from the pre-fill since `initialConfig` is wired in for all entry paths.
- The back arrow at the top of the DM container — still returns to HomeScreen with no auto-open.
- The `isUnbonded` behavior — empty dragon fields still render correctly because the prefill only takes effect when values exist.

### Verification

- Reconfigure from Settings auto-opens the Manual Setup form pre-filled with current campaign values.
- Editing one field (e.g. year) and launching keeps every other value intact.
- New Campaign still wipes everything and lands on the empty setup menu.
- Back arrow still goes to HomeScreen with no setup opened.
- Tapping Reconfigure card directly from the Empyrean menu also shows pre-filled values.
- No TypeScript errors.

