## Fix: Dad Huddle chat message length limit

**Problem**: The party chat input caps messages at 200 characters — anything typed or pasted beyond that gets silently cut off.

**Change**: In `src/components/party/PartyChat.tsx`, remove the 200-character truncation on the chat input so players can send long messages. Also swap the single-line `Input` for a `Textarea` that grows as needed (with Enter to send, Shift+Enter for a new line) so long messages are actually readable while typing.

**Not changing**:
- The send handler, database write path, or any other chat behavior.
- Message rendering (already wraps long text via `break-words`).
- Any other chat surface (DM composer, solo input, etc.).

**Note**: If there's also a server-side length cap on the party chat message column, sending very large messages could still fail. Want me to check for and lift that too, or just the input-side limit for now?