

## Repurpose Party Chat as Dragon Network Chat

### What this does

Instead of dragon network messages going to individual players' private dragon bond chats, they'll be posted to the **shared party chat** that everyone can see. Players still compose messages through their dragon bond chat (type @, pick a target, voice it, preview it), but when they hit Send, the voiced message lands in the party chat as a special dragon-styled message visible to all party members.

### Changes needed

**1. Update `deliverNetworkMessage` in `use-party-dragon-bonds.ts`**
- Instead of inserting two rows into `party_shared_state` (one for sender, one for recipient), insert one row into `party_messages` using the existing party chat table
- The `sender_name` will be the dragon's name (e.g. "Tairn" instead of the player's name)
- The `message` will be the voiced text, prefixed with a tag like `[🐉 → TargetDragonName]` so everyone can see who it's addressed to
- This means dragon messages show up in the same chat feed as regular player messages — no separate system needed

**2. Update `PartyDMScreen.tsx` — change the `onDeliverNetworkMessage` prop**
- Instead of calling `dragonBonds.deliverNetworkMessage`, call `partySync.sendMessage` (which inserts into `party_messages`)
- Format the message so it's clear it's a dragon network message (include the sender dragon name and target dragon name)

**3. Update `FullscreenPartyChat.tsx` — style dragon messages differently**
- Detect messages that start with the dragon tag prefix `[🐉 →`
- Render those with the purple border styling and italic text to visually distinguish them from regular player chat
- This is purely a display change — no new data storage needed

**4. Clean up what's no longer needed**
- Remove the `dragon_network_message` state type handling from `use-party-sync.ts` (the initial fetch, the realtime handler, and the `dragonNetworkMessages`/`setDragonNetworkMessages` state)
- Remove the `syncedDragonNetworkMessages` prop threading through `Index.tsx`, `PromptDrawerProvider.tsx`, `StandalonePartyDMScreen.tsx`, and `PartyDMScreen.tsx`
- Remove network message rendering from `PartyDragonChat.tsx` (the `item.kind === 'network'` block) since those messages now live in the party chat
- Remove the `dragonNetworkMessages` state from `use-party-dragon-bonds.ts`

**5. Keep the Reply flow working**
- When someone sees a dragon message in party chat and wants to reply through their dragon, they go to their dragon bond chat, type @, pick the dragon, and send as normal
- No special Reply button needed in party chat — the @ flow in dragon bond chat already handles targeting

### Files to change
- `src/hooks/use-party-dragon-bonds.ts` — simplify `deliverNetworkMessage` 
- `src/components/ai-dm/PartyDMScreen.tsx` — update the delivery callback
- `src/components/party/FullscreenPartyChat.tsx` — add dragon message styling
- `src/hooks/use-party-sync.ts` — remove dragon network message state and handlers
- `src/pages/Index.tsx` — remove synced dragon network message prop threading
- `src/components/drawers/PromptDrawerProvider.tsx` — remove synced dragon network message props
- `src/components/ai-dm/StandalonePartyDMScreen.tsx` — remove synced dragon network message props
- `src/components/ai-dm/PartyDragonChat.tsx` — remove network message rendering

### What stays the same
- The voice → preview → send flow in dragon bond chat (type @, pick target, AI voices it, preview screen)
- The `voiceAsMyDragon` function
- All dragon bond chat logic (normal rider-dragon telepathy)
- Dragon bond config, trust, mood, memories

