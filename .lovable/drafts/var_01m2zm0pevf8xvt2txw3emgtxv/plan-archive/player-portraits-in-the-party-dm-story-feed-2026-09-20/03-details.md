## Technical details

### Message rendering

Add the optional avatar map to `PartyDMMessage` and pass `chatAvatars.avatars` directly from the existing hook. This preserves the live object update path and avoids creating a replacement map during rendering.

Create small display-only helpers inside the same file for:

- deriving up to two initials from a character name;
- rendering either an IC image or the color-backed initials fallback;
- removing only an exact leading `[sender_name]: ` prefix;
- parsing combined `Party` content into named contributions while retaining any unmatched/system text safely.

For ordinary real-player messages, use `sender_user_id` for both the party color and IC-photo lookup. The outer row becomes top-aligned, and both the avatar and bubble retain fixed/shrinking behavior so the bubble can wrap at 360px.

For combined `Party` messages, parse line boundaries beginning with `[Name]: `. Match each name case-insensitively against `members.character_name`, then use that member’s `user_id` for color and avatar lookup. Render each recognized contribution as its own top-aligned row. Run `extractAfkNames` and `AfkAnnotatedContent` on each contribution independently. Lines identified as system/hold/AFK-only content retain the existing generic presentation rather than receiving a player portrait.

### Boundaries

Only `PartyDMScreen.tsx` changes. No saved content, database data, avatar uploads, OOC photos, editing text, copying, narration, assistant messages, whispers, media blocks, reactions, bookmarks, team tags, or host controls change.

### Verification

- Check normal and dialogue player messages with and without IC photos.
- Check a multi-player `Party` bundle, including wrapped text and AFK/held-action lines.
- Replace an IC photo and confirm existing feed rows update.
- Check whisper, system, image, video, and audio messages remain unchanged.
- Verify the feed at 360px and confirm no horizontal overflow.
