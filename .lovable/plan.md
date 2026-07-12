# Custom Party Chat Background

Add a new entry in the Party DM **Tools** drawer that lets a user pick an image from their device and use it as the background of the Party DM chat screen. They can preview, replace, or clear it at any time.

## What the user sees

In the Tools drawer (the ⚒ panel on the right of the Party DM screen), a new row appears:

- **Chat Background** — with a small thumbnail if one is set
  - Tap → opens a small panel with:
    - "Upload image" (opens file picker, images only, up to 5MB)
    - "Clear background" (only shown if one is set)
  - After upload, the picture immediately appears behind the party chat messages, dimmed slightly so text stays readable.

The background is remembered per character (same scoped storage the rest of the app uses), so switching characters or reloading keeps it in place. It does not affect other players — it's a personal visual preference.

## Where it plugs in

1. **New hook** `src/hooks/use-party-chat-background.ts`
   - Modeled on the existing ability-images hook: scoped localStorage, image validation (image/*, ≤5MB), read as data URL, re-loads on the `odyssey-character-loaded` event.
   - Registers its storage key (`odyssey-party-chat-background`) in `src/lib/scoped-keys.ts`, `src/lib/resetApp.ts`, and the `SaveData` interface in `src/hooks/use-auto-save.ts` so it syncs to cloud and clears on reset.

2. **Tools drawer** `src/components/ai-dm/DMToolsDrawer.tsx`
   - Add two new props: `partyChatBackground` and `onPartyChatBackgroundChange(file | null)`.
   - Add a new tool row "Chat Background" with an Image icon that opens a hidden file input and, when a background exists, shows a "Clear" secondary action.

3. **Party DM screen** `src/components/ai-dm/PartyDMScreen.tsx`
   - Call the new hook, pass its state and handlers to `DMToolsDrawer`.
   - Right next to the existing empyrean background block (around line 1982), render an additional absolutely-positioned `<div>` using the uploaded image as `background-image` (cover / center, ~0.25 opacity, with a soft dark gradient overlay for legibility). This layer is skipped when no image is set, so default behavior is unchanged.

## Notes / limits

- Images only in v1 (no video), 5MB cap — matches the app's existing image upload patterns and avoids blowing out localStorage.
- Personal to the character, not broadcast to the party.
- No changes to the fullscreen chat popup or any business logic — purely a presentation layer addition.
