

## Scaffold Character Sheet + Reduce Empyrean Solo Nav to 2 Tabs

### What you'll see after this prompt

The Empyrean solo DM bottom bar collapses from five tabs down to just two: **SHEET** (left) and **[DRAGON NAME]** (right). Tapping SHEET slides up a full-screen panel with your character name in the header and three section tabs across the top — **Character**, **Talk to the DM**, **Settings**. Each section currently shows a clearly-marked placeholder explaining what's coming. Tapping the dragon name still opens Dragon Bond Chat exactly as before.

This is foundation work only. The three sections will be filled in by the next prompts. Everything currently behind the hidden tabs (Prompts library, Actions drawer, AFK guide, Settings drawer) stays wired in the background so we can flip a single flag to restore any of them.

### What's being added

**1. New file: `src/components/empyrean/CharacterSheet.tsx`**
- Full-screen overlay panel (z-[70]) with a header showing the character name and a close button.
- Horizontal scrollable tab strip with three pill buttons (Character / Talk to the DM / Settings), each with its own color theme.
- Animated content area that swaps between three placeholder sections.

**2. Updated: `src/components/ai-dm/DMBottomNav.tsx`**
- New optional flags: `hideAfk`, `hidePrompts`, `hideActions`, `hideSettings`, `showCharacterSheet`, plus an `onCharacterSheet` callback.
- New tab definition for SHEET (sky-blue, ScrollText icon).
- Tab list builder updated so each hide-flag filters its tab and the SHEET tab is prepended when enabled.
- Tap handler routes the SHEET tab to its callback instead of the normal tab-change flow.

**3. Updated: `src/components/empyrean/EmpyreanDMScreen.tsx`**
- New local state `characterSheetOpen` to control the panel.
- DMBottomNav receives all five hide flags + `showCharacterSheet` + the open callback.
- CharacterSheet is mounted near the other drawers and reads the existing character name.

### What stays untouched (reversibility safety net)

- All existing drawers, sheets, hooks, and tab handlers in EmpyreanDMScreen remain mounted and wired. Hiding is purely a nav-visibility change — flipping any `hide*` flag back to `false` instantly restores that tab.
- Party DM and standard AI DM are not modified — they keep their full nav.
- The Dragon Bond (oracle) tab is unchanged.
- The contextual action pills above the chat are not touched.

### Verification checklist (matches the task)

- Empyrean solo nav shows only SHEET + [DRAGON NAME].
- Tapping SHEET opens the full-screen panel with three working tab pills and placeholder content in each.
- Close button returns to the DM chat.
- Dragon Bond tab still opens Dragon Bond Chat.
- Party DM and standard AI DM nav unchanged.
- No TypeScript errors.

