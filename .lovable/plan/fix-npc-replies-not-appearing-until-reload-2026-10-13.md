# Fix: NPC replies not appearing until reload

## What is happening
Your own messages now appear right away because the phone adds the saved message itself. NPC replies work differently: the server writes them, and the phone only finds out through the live update. When that live update is missed or late, the reply sits saved but invisible until you reload. The same applies to NPC reply rewrites ("regenerate") and spell reactions.

## The fix
1. Whenever the app asks an NPC to speak (normal reply, roll reply, regenerate, spell reaction, automatic triggers) and the server says it succeeded, the Live Table immediately re-reads the latest messages. The new NPC line then shows up without depending on the live update.
2. One extra catch-up read about 2 seconds later covers replies that were saved a moment after the server answered.
3. Nothing is written by these refreshes; they only read. Existing merging keeps every line once, in order, and never drops a just-posted message.
4. Add tests: after a successful NPC reply the chat refreshes; a failed reply does not trigger a refresh; a reply arriving by both routes still shows once.

## Not changed
No server, database, or NPC behavior changes. No changes to the chat screen layout, sealing, reactions, or the fight referee. Combat NPC lines (from the fight referee) are left alone unless you want them covered too.

## Technical details
- `src/hooks/use-party-npcs.ts`: after each successful `npc-reply` invoke (askNpc, regenerateLine, reactToSpell, scene/auto paths), dispatch a window event `odyssey-round-chat-refresh` with the partyId; schedule a second dispatch at ~2s.
- `src/hooks/use-round-chat.ts`: listen for that event inside the existing realtime effect; when the partyId matches, call `loadMessages()` (already reconciles via `reconcileTableLines`). Clean up on unmount.
- Tests in `src/hooks/__tests__/use-round-chat-npcs.test.ts` (event triggers a read; other-party event ignored) and the existing use-party-npcs test file (event dispatched only on success).
