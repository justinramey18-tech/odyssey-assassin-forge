

## Party Member Quick Actions Viewer and Profile Avatars

### What This Does

Two enhancements to the party system:

1. **Tap a party member card** to open a read-only drawer showing their character's quick actions summary (weapons, spells, abilities, consumables). Since party members don't share their full character sheet, we expand the `character_status` broadcast to include lightweight action summaries.

2. **Profile picture on party cards** using the player's custom home background image (already stored in localStorage). The background image URL is included in the broadcast data so other players can see a cropped avatar on each card.

---

### Approach

#### Expanding the Broadcast Data

The `character_status` JSONB currently contains HP, AC, conditions, level, and class. We extend it with:
- `quickActions`: A lightweight summary object containing:
  - `weapons`: Array of `{ name, damage, damageType }` (equipped weapons)
  - `abilities`: Array of `{ name, tree, tier, actionType }` (equipped abilities)
  - `spells`: Array of `{ name, level, school, concentration }` (prepared spells)
  - `cantrips`: Array of `{ name, school }` (known cantrips)
  - `consumables`: Array of `{ name, quantity, effect }` (inventory consumables)
- `profileImage`: The player's custom background as a data URL (or null). Since this can be large (~5MB), we will compress/resize it to a small thumbnail (~64x64) before broadcasting, keeping JSONB payload manageable.

#### Profile Image Handling

- When broadcasting status, capture the custom background from localStorage, resize it to a tiny thumbnail (64x64 JPEG, ~2-5KB), and include it in `character_status.profileImage`.
- On the `PartyMemberCard`, render this as a circular avatar next to the character name using the existing `Avatar` component.

#### View-Only Quick Actions Drawer

- A new `PartyMemberQuickActionsViewer` component renders as a bottom Sheet showing the tapped member's action summaries in a read-only format (no roll buttons, no cast buttons -- just a categorized list).
- Clicking a `PartyMemberCard` (when it's not your own) opens this viewer.

---

### Technical Details

#### Files Modified

| File | Changes |
|------|---------|
| `src/hooks/use-party-sync.ts` | Extend `PartyMember.character_status` type with `quickActions` and `profileImage` fields |
| `src/pages/Index.tsx` | Include quick action summaries and resized profile image in `broadcastStatus` call |
| `src/components/party/PartyMemberCard.tsx` | Add avatar display, make card tappable (non-self), pass `onClick` |
| `src/components/party/PartyPanel.tsx` | Track selected member state, render viewer drawer |

#### New Files

| File | Purpose |
|------|---------|
| `src/components/party/PartyMemberQuickActionsViewer.tsx` | Read-only bottom sheet showing a member's weapons, abilities, spells, cantrips, and consumables |
| `src/lib/utils/image-resize.ts` | Utility to resize an image data URL to a small thumbnail using canvas |

#### Implementation Steps

1. **Create `image-resize.ts`**: A utility function `resizeImageToThumbnail(dataUrl: string, size: number): Promise<string>` that uses an offscreen canvas to produce a tiny JPEG thumbnail.

2. **Extend `character_status` type** in `use-party-sync.ts` to include `quickActions` (object with arrays of summaries) and `profileImage` (string or null).

3. **Update `broadcastStatus` call in `Index.tsx`**: Gather equipped weapons (from equipment), equipped abilities (from character), prepared spells and cantrips (from spellcasting), and consumables. Build lightweight summary arrays. Load custom background from localStorage, resize to thumbnail, and include as `profileImage`.

4. **Update `PartyMemberCard.tsx`**:
   - Add an `Avatar` component showing `profileImage` (with a fallback showing the first letter of the character name).
   - Accept an `onViewActions` callback prop. Make the card tappable for non-self members.
   - Show a subtle "tap to view" indicator on non-self cards.

5. **Create `PartyMemberQuickActionsViewer.tsx`**:
   - A `Sheet` (bottom) that receives the selected member's `character_status`.
   - Renders collapsible sections: Weapons, Abilities, Magic, Cantrips, Consumables.
   - Each item shows name and key stats in a compact read-only card (no interactive buttons).
   - Header shows member name, class, level, and avatar.

6. **Update `PartyPanel.tsx`**:
   - Add `selectedMember` state.
   - Pass `onViewActions` to each `PartyMemberCard`.
   - Render `PartyMemberQuickActionsViewer` when a member is selected.

