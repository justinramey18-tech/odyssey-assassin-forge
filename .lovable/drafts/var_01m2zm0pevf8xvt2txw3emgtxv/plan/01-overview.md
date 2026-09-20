# Player portraits in the Party DM story feed

## Goal

Replace generic player markers with each speaker’s current in-character portrait and character name, without changing saved messages or any DM, whisper, media, reaction, bookmark, or host-control behavior.

## What will change

- Pass the existing live avatar collection into every story-feed message using the same shared object reference.
- For a normal player message, show the sender’s IC portrait in a 36px circle with their party color and show their character name instead of “Party Actions.”
- If no IC portrait exists, show initials from the first two words of the character name on a circle using that player’s party color. OOC photos will never be used.
- Remove a leading `[Character Name]: ` only from the visible story text. The saved text, editor, copy action, and narration source remain unchanged.
- For combined “Party” messages, separate each `[Name]: ...` contribution into its own portrait-and-text row, matching the name to the party member and preserving each contribution’s AFK marker behavior.
- Leave system/held-action lines in their current presentation instead of treating them as ordinary player contributions.

## Acceptance checks

- A player’s newly uploaded IC portrait appears on old messages without refreshing stored message data.
- Dialogue and regular player messages use the same portrait treatment; whispers keep the purple lock.
- Combined messages show the correct portrait, name, and wrapped text for every recognized player.
- Missing portraits produce readable initials; missing member matches degrade safely without an OOC image.
- The story feed remains readable at 360px with long names and long messages.
- Existing reactions, bookmarks, editing, deletion, copying, media, audio, team tags, and narration continue unchanged.
