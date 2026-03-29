

## "Empyrean Speaks" Banner — Dragon Network Message Alert

### What it does

When a player sends a dragon-to-dragon message through the party chat, a full-screen tappable banner (the uploaded "Empyrean Speaks" image) takes over the narrative chat window. Tapping it navigates to the party chat. The banner sticks around per-player until they tap it. Once they return from the party chat, it's gone and the normal narrative view is back.

### How it works

1. **Copy the image** into `src/assets/empyrean-speaks.jpg` so it can be imported and used in the component.

2. **Track banner visibility with a state variable** in `PartyDMScreen.tsx`:
   - `showEmpyreanBanner` (boolean, default `false`)
   - When `deliverNetworkMessage` is called successfully (the `onDeliverNetworkMessage` callback), set `showEmpyreanBanner = true`

3. **Listen for incoming dragon messages from other players** via realtime. The party chat messages from `usePartySync` already update in real time. Add a `useEffect` that watches the party chat messages array — when a new message arrives that starts with `[🐉 `, set `showEmpyreanBanner = true`. This way both the sender and all receivers see the banner.

4. **Render the banner over the narrative chat area**. In the messages section (the `flex-1 min-h-0 relative flex flex-col overflow-hidden` container around line 1702), when `showEmpyreanBanner` is true, render the image as a tappable overlay that fills the entire chat area. The image covers the message list but does NOT hide the header, input area, or bottom nav — just the scrollable narrative window.

5. **On tap**: Call `onShowChat()` to navigate to the party chat, and set `showEmpyreanBanner = false`. When the player comes back from the party chat, the banner is already gone.

6. **Per-player persistence**: Since this is just React state on each player's own `PartyDMScreen` instance, each player independently sees and dismisses the banner. No database tracking needed — the realtime subscription fires for each connected player.

### Technical details

**Files to change:**
- Copy `user-uploads://Screenshot_20260328_213555_ChatOn.jpg` → `src/assets/empyrean-speaks.jpg`
- `src/components/ai-dm/PartyDMScreen.tsx`:
  - Import the image asset
  - Add `showEmpyreanBanner` state
  - Add useEffect watching party chat messages for new `[🐉 ` messages
  - Set banner true in the `onDeliverNetworkMessage` callback
  - Render a full-area tappable image overlay inside the messages container when banner is active
  - On tap: call `onShowChat?.()` and clear banner

**What the banner looks like:**
- The uploaded image fills the narrative chat window (object-cover, rounded corners)
- Slight animated entrance (fade + scale)
- Tapping anywhere on it navigates to party chat

**Props needed:** `onShowChat` is already available in `PartyDMScreen` — it's passed down from the parent and opens the `FullscreenPartyChat`.

