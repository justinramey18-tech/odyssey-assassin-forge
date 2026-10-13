# Open directly to the Live Table

Make the exact screen in your screenshot—the expanded chat with **Return to Story**, **Table Talk**, **Speak in Character**, and the bottom action bar—the landing screen when an existing party player opens the app.

## Confirmed problem

The app already attempts to open the party screen on launch, but the Live Table starts collapsed. Opening the party screen is not the same as opening the chat shown in your screenshot. The recent-message cache added earlier also serves the DM story messages, not this Live Table conversation.

## Changes

1. Carry the app-opening choice through to the Live Table so it starts expanded, rather than showing the story first and opening chat afterward.
2. Keep the opening focused on this chat: skip Enter Story and avoid the usual chat-opening reveal delay on automatic launch. Other panels continue loading separately.
3. Show this conversation’s recently saved lines while newer lines load. Keep saved conversations separated by account and party, preserve message order, and never replace saved messages with an empty result from a failed connection.
4. Keep **Return to Story** working normally. Open automatically only once per launch, not repeatedly after closing chat. Players without an active party keep their existing opening screen; leaving or losing a party must not trap anyone in an old conversation.

## Technical scope

- Reuse the existing party-opening path and pass an explicit initial Live Table choice through each screen that receives it.
- Update `RoundChatDrawer` to support starting expanded, without changing normal manual opening.
- Connect a bounded Live Table cache to `use-round-chat`, separate from the existing DM-message cache. Treat refreshed server messages as authoritative and handle party changes and deleted messages.
- Preserve shared state ownership, both `PromptDrawerProvider` branches, party recovery, and the current screen design.
- No database, permission, combat-rule, or sign-in changes.

## Checks

- Add focused checks for automatic opening, closing without reopening, account/party separation, and failed refreshes retaining recent lines.
- Run relevant tests and check for new errors.
- Verify the pictured chat starts expanded and Return to Story closes it using available test state, without signing in or creating accounts. If a real party session is unavailable, report real-party launch verification as untested.