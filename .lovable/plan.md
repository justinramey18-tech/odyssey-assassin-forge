## Goal

Move the "Request character redo" entry point off the floating bottom-of-screen link and into the player's in-DM Settings panel, so it lives alongside the other tools (GM Guides, Quest Log, AFK Guide, etc.).

## Changes

### 1. `src/components/ai-dm/PartyDMSettings.tsx`
- Add two optional props to `PartyDMSettingsProps`:
  - `onRequestCharacterRedo?: () => void`
  - `hasPendingRedoRequest?: boolean` (so we can show "Request pending" state and disable)
- In the **Tools** section (~line 466, before the Bookmark row), render a `ToolRow` only when `onRequestCharacterRedo` is provided:
  - Icon: `RefreshCw` (lucide) tinted amber if a pending request exists
  - Label: "Request Character Redo"
  - Description: `hasPendingRedoRequest ? 'Awaiting host approval…' : 'Ask the host to redo your character'`
  - `onClick={onRequestCharacterRedo}`, `disabled={hasPendingRedoRequest}`
- Destructure the new props in the component signature.

### 2. `src/components/ai-dm/PartyDMScreen.tsx`
- Add two optional props to its props interface:
  - `onRequestCharacterRedo?: () => void`
  - `hasPendingRedoRequest?: boolean`
- Forward them to `<PartyDMSettings>` in the `settingsContent` block (~line 3317).

### 3. `src/components/ai-dm/StandalonePartyDMScreen.tsx`
- **Remove** the floating "Request character redo" button block (lines 631–644) — the absolute-positioned link at the bottom of the chat area.
- On the `<PartyDMScreen>` invocation (~line 645), pass:
  - `onRequestCharacterRedo` — only when the gating conditions are met (non-host, `myStatus === 'complete'`, `campaignStarted`); otherwise leave undefined so the row hides
  - `hasPendingRedoRequest={!!(userId && onboardingRequests.myPendingRequest(userId))}`
- The handler simply calls `setShowRedoDialog(true)`.
- `<PlayerRedoRequestDialog>` mount and state stay exactly as they are.

## Behavior

- Non-host players who finished onboarding and whose campaign has started will now see a "Request Character Redo" row in their DM **Settings** tab (Tools section) instead of a floating link at the bottom of the chat.
- If the player already has a pending request, the row shows "Awaiting host approval…" and is disabled (matches the existing `hasExistingPending` semantics already wired into the dialog).
- Hosts and players who don't qualify never see the row.
- All other Phase 3c behavior (dialog content, submit, host approval flow) is unchanged.

## Out of scope

- No changes to the dialog itself, the host requests panel, the `use-party-onboarding-requests` hook, or any edge function / DB.
- No changes to Solo or Empyrean modes.