

# Performance Fix: Party DM Lag

## Root Causes

After reviewing the 2216-line `PartyDMScreen.tsx` and `use-party-dm.ts`, the lag stems from several compounding issues:

### 1. Every message re-renders on any state change
`PartyDMMessage` is not wrapped in `React.memo`. Every time *anything* changes (typing, prompts, timer tick, realtime updates), all messages re-render. With a long chat history, this is devastating.

### 2. `allMessages` prop causes O(n) invalidation
Every `PartyDMMessage` receives `allMessages={partyDm.messages}` as a prop. Since `messages` is a new array reference on every realtime INSERT/UPDATE/DELETE, every single message component gets a new prop and re-renders — even if nothing about *that* message changed.

### 3. Unstable callback references
Callbacks like `handleSubmit`, `handleEditMessage`, etc. depend on `[partyDm]`, but `partyDm` is a new object every render (it's a hook return value). This defeats `useCallback` and forces child re-renders.

### 4. Broadcast indicator subscription is too broad
The Spotify broadcast indicator subscribes to ALL `party_shared_state` changes for the party, triggering `setBroadcastPlaylist` state updates on every config/timer/prompt state change — causing full re-renders.

### 5. `scrollRef` effect fires on every prompt change
Line 784-788: `useEffect` scrolls on `[partyDm.messages, partyDm.currentPrompts]` — prompt realtime updates trigger scroll logic and re-render.

## Plan

### File: `src/components/ai-dm/PartyDMScreen.tsx`

**A. Wrap `PartyDMMessage` in `React.memo` with a custom comparator**
- Compare only `message.id`, `message.content`, `message.role`, `ttsSelectMode`, `ttsSelected`, `whisperTrayEnabled`
- Skip deep comparison of `allMessages` and `members`

**B. Remove `allMessages` prop from `PartyDMMessage`**
- The only use of `allMessages` is extracting AFK names from the *preceding* message (lines 240-260)
- Pre-compute `afkCharNames` in the parent's message map and pass it as a simple `string[]` prop instead — this is stable across renders

**C. Stabilize callback references**
- Change `handleSubmit`, `handleEditMessage`, `handleDeleteMessage`, `handleRegenerateMessage`, `handleRegenerateWhispers` to use refs for the `partyDm` methods instead of depending on the `partyDm` object
- Pattern: `const partyDmRef = useRef(partyDm); useEffect(() => { partyDmRef.current = partyDm; });` then callbacks read from the ref

**D. Fix broadcast indicator subscription filter**
- Currently subscribes to all `party_shared_state` changes. The `state_type` filter check happens *after* the state update triggers. Change the realtime channel to only react when `state_type === 'spotify_sync'` (already partially done on line 727, but `setBroadcastPlaylist` path still triggers a render for every payload)

**E. Throttle scroll effect**
- Replace direct scroll on `[partyDm.messages, partyDm.currentPrompts]` with a ref-based check: only scroll when message count actually increases, not on prompt updates

**F. Memoize the message list rendering**
- Extract the message `.map()` block into a memoized component (`MemoizedMessageList`) that only depends on `partyDm.messages` length and last message id, preventing full list re-computation on unrelated state changes

### File: `src/hooks/use-party-dm.ts`

**G. Stabilize the hook return object**
- Wrap the return value in `useMemo` so downstream consumers don't get a new object reference every render
- This prevents `PartyDMScreen` from re-rendering on every tick when only internal hook state that isn't exposed has changed

These changes target the core render loop — reducing per-frame work from "re-render every message on every event" to "re-render only the message that changed."

