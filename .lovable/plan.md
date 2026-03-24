

# Emote Reactions on Party DM Messages

## Summary
Add emoji reactions to DM messages. The `party_message_reactions` table already exists with RLS policies. Work is purely frontend — load, subscribe, CRUD, and render reactions inside `PartyDMScreen.tsx`.

## Emoji Set
```
🤣 😅 🤪 🙄 😬 😏 🤮 🥵 🥶 🤯 🧐 😎 😱 😭 🤬 😈 ❤️ 💯 👏 🙌 🤝 🖕 🫦 🗣 🍑 🍆
```

## Changes

### 1. PartyDMScreen.tsx — Reaction state and logic (near line 788)

Add inside the `PartyDMScreen` function:
- `messageReactions` state: `Array<{ id: string; message_id: string; emoji: string; user_id: string; sender_name: string }>`
- `useEffect` to load all reactions for the current `partyId` from `party_message_reactions` (ordered by `created_at`)
- `useEffect` for realtime subscription on `party_message_reactions` filtered by `party_id` — handle INSERT (append) and DELETE (remove by id)
- `addReaction(messageId, emoji, senderName)` callback — upsert into `party_message_reactions` with `{ message_id, party_id, user_id, emoji, sender_name }`
- `removeReaction(messageId, emoji)` callback — delete from `party_message_reactions` where `message_id`, `user_id`, and `emoji` match

### 2. PartyDMMessage component — New props and UI

Add props:
- `reactions: Array<{ id, message_id, emoji, user_id, sender_name }>`
- `onAddReaction: (messageId: string, emoji: string, senderName: string) => void`
- `onRemoveReaction: (messageId: string, emoji: string) => void`
- `currentUserId` already exists

Update memo comparison (line ~739): add `prev.reactions?.length === next.reactions?.length` and a shallow content check.

**UI — below message content, before the bookmark button (around line 683):**

1. **Reaction pills row**: Group reactions by emoji. Each pill is a small `rounded-full` button showing `emoji + count`. If current user reacted with that emoji, highlight with `bg-amber-900/30 border-amber-500/30`. Tap highlighted = remove; tap unhighlighted = add. Show tooltip with sender names on hover.

2. **Add reaction trigger**: A small `SmilePlus` (lucide) icon button that appears on hover/tap. Opens a Popover with the 26 emojis in a flex-wrap grid (dark bg, `bg-black/95 border border-white/10`). Tap emoji = call `addReaction`, close popover.

### 3. Pass reactions to PartyDMMessage (line ~1510)

In the `partyDm.messages.map(...)` loop, add:
```
reactions={messageReactions.filter(r => r.message_id === msg.id)}
onAddReaction={addReaction}
onRemoveReaction={removeReaction}
```

### 4. Styling
- Reaction pills: `h-6 px-1.5 text-xs rounded-full bg-white/5 border border-white/10 hover:bg-white/10` — highlighted: `bg-amber-900/30 border-amber-500/30`
- Emoji picker popover: `w-[280px]` grid with `grid-cols-7`, each emoji button `w-8 h-8 hover:bg-white/10 rounded`
- Reactions row uses `flex flex-wrap gap-1 mt-1`
- Mobile: tap to open picker, tap pill to toggle — no hover dependency for core interactions

### Technical Notes
- Table has unique constraint on `(message_id, user_id, emoji)` so upsert is safe
- Realtime is already configured for the table
- Filter reactions client-side per message before passing as props
- No new database changes needed

