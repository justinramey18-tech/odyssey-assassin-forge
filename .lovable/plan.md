

## Adapt Empyrean Pack: Mobile-First Full-Screen + Infinity Stone Prompts

### Overview

Two major UI rewrites:

1. **EmpyreanCampaignPack** becomes a full-screen overlay (like `InfinityGauntletScreen`) instead of an `EdgeDrawer`, with GM guides organized as collapsible accordion sections containing the full copyable guide text.

2. **EmpyreanPromptLibrary** is replaced with an Infinity Stone-style drawer (like `InfinityStoneDrawer`) that maps the 7 Empyrean prompt categories to 7 stones.

---

### 1. EmpyreanCampaignPack -- Full-Screen with Dropdown Guides

**Current**: Right-side `EdgeDrawer` (320px max) with toggle switches and truncated previews.

**New**: Full-screen overlay (`fixed inset-0 z-[60]`) with:
- Dark gradient background with amber accent
- Close button (X) top-right
- Title header: "Empyrean Campaign Pack"
- ScrollArea covering the full viewport
- Four accordion sections (Lore, Tone, Pacing, Alternate) using the existing `Accordion` component
- Each guide is an `AccordionItem` that expands to show the **full guide content** in a readable `<pre>` block
- Each expanded guide has:
  - A "Copy" button that copies the full guide text to clipboard
  - An "Install" toggle (Switch) to add/enable the guide
  - Character count shown at the bottom
- "Install All Lore" and "Remove All" buttons remain at the top
- Stacking rules info box stays

**File changes**: `src/components/settings/EmpyreanCampaignPack.tsx` -- full rewrite from EdgeDrawer to full-screen overlay with Accordion-based guide display.

---

### 2. EmpyreanPromptLibrary -- Infinity Stone Mapping

**Current**: EdgeDrawer with flat filter tabs and card list.

**New**: EdgeDrawer (same shell) but uses the Infinity Stone accordion pattern from `InfinityStoneDrawer.tsx`:

**Category-to-Stone mapping** (7 categories to 7 stones):

| Empyrean Category | Stone | Color |
|---|---|---|
| Dragon Bond | Soul Stone | Orange (#f97316) |
| Signet Abilities | Mind Stone | Yellow (#eab308) |
| Basgiath War College | Power Stone | Purple (#a855f7) |
| Venin and Dark Forces | Reality Stone | Red (#ef4444) |
| Relationships and Politics | Space Stone | Blue (#3b82f6) |
| Combat and Survival | Masterwork Stone | Silver (#f5f5f5) |
| Meta and Narrative | Time Stone | Green (#22c55e) |

**UI pattern**: Accordion with colored stone headers (gem icon + stone name + count badge), expandable to show prompts within. Each prompt row has: icon, title, favorite star, copy button. Random button and favorites filter at top.

**File changes**: `src/components/settings/EmpyreanPromptLibrary.tsx` -- rewrite internals to use Accordion with Infinity Stone groupings instead of flat filter tabs.

---

### 3. SettingsContent Integration Update

The `EmpyreanCampaignPack` changes from a drawer to a full-screen component, so its open/close pattern changes slightly. The `open` and `onOpenChange` props stay the same -- the component just renders differently internally. No changes needed in `SettingsContent.tsx`.

---

### Technical Details

**Dependencies used** (all already installed):
- `@radix-ui/react-accordion` for collapsible guide sections and stone groups
- `lucide-react` icons (X, Copy, Check, Gem, Star, Shuffle, Download, Trash2)
- `ScrollArea` for full-screen scrolling
- Existing `InfinityGauntletStyles.css` not needed (that's for the gauntlet image screen)

**No new files created.** Two existing files rewritten:
- `src/components/settings/EmpyreanCampaignPack.tsx`
- `src/components/settings/EmpyreanPromptLibrary.tsx`

**Touch targets**: All buttons minimum 44px, accordion triggers padded for mobile touch.

**Copy behavior**: Uses `navigator.clipboard.writeText()` with toast feedback, same pattern as existing prompt copy system. For GM guides, copies the full raw guide content. For prompts, applies `[Character Name]` replacement and `applyTimePrefix()`.
