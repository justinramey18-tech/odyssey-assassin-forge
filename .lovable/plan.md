# Restyle the live chat composer with the supplied artwork

## What will change

- Add the eight supplied composer images under the live-chat artwork folder and import them into the existing live chat drawer.
- Replace the two speaker tiles with the framed TABLE TALK and SPEAK IN CHARACTER designs, keeping their current selection and rename behavior.
- Move the table-name rename control onto the sapphire name tag while preserving second-tap rename and the existing rename field.
- Wrap the message box in the obsidian-and-gold frame, shorten its placeholder wording, and keep all typing, paste, reply, and send behavior unchanged.
- Replace the picture and send icons with matching 44px artwork buttons, retaining their current disabled and loading states.

## Checks

- Confirm the supplied image names and dimensions after extraction.
- Check the finished composer at 390px and 360px widths, including tile selection, rename opening, placeholder switching, typing glow, and disabled send appearance.
- Confirm the project builds without errors.

## Boundaries

- Only `RoundChatDrawer.tsx`, the eight supplied images, and the task checklist will change.
- Message behavior, selection rules, uploads, sending, replies, seals, chat history, and the Action Menu remain untouched.
