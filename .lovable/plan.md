

## Plan: Move Party DM Subheader Options into a Settings Tab

### Problem
The Party DM subheader strip (Row 2) is cluttered with many small buttons: Mode indicator, Sync, Map, Saves, Chat, Guides, AFK, Alerts, Split/Regroup, Share toggle, New Campaign, and End Session. This makes it hard to use, especially on mobile.

### Solution
1. **Add a 5th "Settings" tab** to `DMBottomNav` with a ⚙️ gear icon
2. **Create a new `PartyDMSettings` panel component** styled like the existing Settings modal (collapsible `SettingsSection` groups)
3. **Strip the subheader** down to minimal status info only (mode indicator, message count, summarizing status, Geralt HP if applicable)
4. **Move all action buttons** into the new settings panel, organized into logical sections

### New Settings Panel Structure

```text
⚙️ PARTY SETTINGS (tab content)
├── 📋 Session Controls (collapsible)
│   ├── Share Mode toggle (shared/private)
│   ├── Auto-Sync toggle
│   └── Push Notifications toggle
├── 🗺️ Tools (collapsible)
│   ├── Battle Map
│   ├── Campaign Saves
│   ├── GM Guides (with badge)
│   ├── Party Chat
│   └── AFK Guide (with cascade count)
├── 👥 Party (collapsible, creator-only)
│   ├── Split Party / Regroup / View Summaries
│   └── New Campaign
└── ⚠️ Danger Zone (collapsible, creator-only)
    └── End Session
```

### File Changes

1. **`src/components/ai-dm/DMBottomNav.tsx`**
   - Add `'settings'` to the `DMNavTab` union type
   - Add a SETTINGS tab entry with a `Settings` (gear) icon from lucide-react, color `text-white/70`

2. **`src/components/ai-dm/PartyDMSettings.tsx`** (new file)
   - Create a settings panel using `SettingsSection` for collapsible groups
   - Accept all the callback/state props currently used by subheader buttons
   - Render toggles as Switch components, actions as styled rows similar to `DMToolsDrawer`'s `ToolRow` pattern

3. **`src/components/ai-dm/PartyDMScreen.tsx`**
   - Reduce the subheader strip to only: mode indicator, message count, summarizing status, Geralt HP
   - Remove all action buttons (Sync, Map, Saves, Chat, Guides, AFK, Alerts, Split, Share toggle, New Campaign, End Session) from the subheader
   - When the `settings` tab is active in DMBottomNav, render the `PartyDMSettings` panel in the content area (similar to how dice content is rendered)
   - Pass all relevant props to `PartyDMSettings`

### Subheader After Change
The subheader will only show read-only status: `[Shared/Private] • 42 msgs • Summarizing...` — clean and uncluttered.

