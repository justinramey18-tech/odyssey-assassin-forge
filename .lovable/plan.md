

## Multi-Select TTS Narration Mode

### Overview
When a user clicks the ElevenLabs/Volume button, instead of immediately narrating the last AI message, the app enters a **selection mode**. Checkboxes appear next to every AI DM message. The user selects which messages to narrate, then taps a "Finish Selection" button to send all selected content to ElevenLabs. The spinner animation plays on the button while audio is being fetched.

### Changes Required

**1. Both `AIDMScreen.tsx` and `PartyDMScreen.tsx` — Add selection mode state**
- Add `ttsSelectMode: boolean` and `ttsSelectedIds: Set<string>` state
- When the narrator button is clicked and not currently playing: toggle `ttsSelectMode` on (instead of immediately narrating)
- When already in select mode and user clicks the button again: exit select mode
- When playing: stop narration as before

**2. `DMMessageBubble` (in `AIDMScreen.tsx`) and `PartyDMMessage` (in `PartyDMScreen.tsx`) — Add checkbox prop**
- Add optional props: `ttsSelectMode?: boolean`, `ttsSelected?: boolean`, `onTtsToggle?: (id: string) => void`
- When `ttsSelectMode` is true and the message is an assistant message, render a styled checkbox (amber/gold themed) to the left of the DM avatar
- Clicking the checkbox toggles the message ID in `ttsSelectedIds`

**3. "Narrate Selection" floating button**
- When `ttsSelectMode` is true and at least one message is selected, show a fixed/sticky button at the bottom of the message area: **"Narrate (N)"** where N is the count
- Tapping it: concatenates selected messages' content in chronological order, calls `narrator.playMessage(combinedText)`, exits select mode
- The existing narrator button shows the spinner (`narrator.isLoading`) / stop icon (`narrator.isPlaying`) as it does today

**4. Cancel selection**
- A small "Cancel" or X button next to the "Narrate Selection" bar to exit select mode without narrating

### UI Flow
```text
1. User taps 🔊 (Volume2 icon)
2. ✅ checkboxes fade in beside each AI message
3. User taps checkboxes on desired messages
4. Bottom bar appears: [Cancel] [Narrate 3 ▶]
5. User taps "Narrate 3" → checkboxes disappear, spinner shows on 🔊 button
6. Audio plays → spinner becomes stop icon → finishes → back to normal
```

### Files to Modify
- `src/components/ai-dm/AIDMScreen.tsx` — selection state, pass props to `DMMessageBubble`, add floating narrate bar, update narrator button behavior
- `src/components/ai-dm/PartyDMScreen.tsx` — same pattern for `PartyDMMessage`, update both narrator button instances (submitted and ready states)

