# Expandable spell descriptions in Quick Actions

## Goal
Show rules and dice details beneath every spell and cantrip without changing other action rows.

## Build
- Mark spell, cantrip, and homebrew-spell rows for the richer display.
- Add the rules text beneath the existing spell detail line, collapsed to two lines by default.
- Measure each rendered description so “more” appears only when two lines genuinely overflow; switch it to “less” when expanded.
- Keep each spell’s expansion independent and clear all expanded rows whenever the drawer closes.
- Prevent the more/less control from triggering Play or spell casting.
- Add a compact amber facts line for damage, healing, and saving throws when those details exist.
- Keep Play and remove controls pinned to the top while descriptions expand.

## Verification
- Check short and long spell descriptions at 375px width.
- Confirm homebrew spells receive the same treatment.
- Confirm more/less never casts, Play still works, and reopening the drawer resets descriptions.
- Confirm weapons, items, and abilities are unchanged and the preview remains healthy.
