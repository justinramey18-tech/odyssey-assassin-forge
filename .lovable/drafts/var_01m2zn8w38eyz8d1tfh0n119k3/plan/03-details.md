## Interaction and safeguards
- Tapping an equipped card body opens the same attack preview as the existing Use control.
- The top-right Use and Remove controls keep their current behavior and gain a dark translucent backing for readability.
- Stat chips wrap within the card at 360px; names truncate rather than collide with controls.
- Existing spell, ability, consumable, and other Quick Actions sections remain untouched.

## Technical details
- Extend the existing character equipment summary with optional `stats`, `properties`, and `enchantments` fields, populated from the already-loaded equipment slots. Keep the matching character descriptions aligned wherever that shared shape is declared.
- Attach the full slot detail to each weapon action only for card presentation; prompt generation and saved equipment remain unchanged.
- Use the existing rarity styling and action-cost styling.
- Upload the supplied JPGs through the app asset flow, import their pointers, and lazy-load the images.

## Verification
- Confirm the app compiles cleanly.
- At 360px, verify all three cards stack without horizontal overflow and chips wrap cleanly.
- Verify equipped cards can be tapped, Use opens the same roll flow, Remove clears the same slot, and empty cards have no active controls.
