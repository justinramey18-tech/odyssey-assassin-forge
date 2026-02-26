

## Plan: Collapsible Accordion Sections in App & System Tab

### Current state
The App & System tab renders everything in a flat vertical layout with separators. AppModeSettings internally has "Active Mode" and "Feature Visibility" as static headers. SystemPreferences has "AI Integration" and "Notifications" as static headers. ApiCredentials is a single block.

### Changes

#### 1. Restructure `SettingsContent.tsx` — appSystem branch (lines 716-817)
Replace the flat layout with:
1. **App Updates** card at the very top (moved from middle)
2. **Accordion** with `type="multiple"` and `defaultValue={['active-mode']}` (only Active Mode open by default) containing 5 collapsible sections:
   - **Active Mode** — the mode selector grid from AppModeSettings
   - **Feature Visibility** — the feature toggle accordion from AppModeSettings
   - **AI Integration** — 4th Wall Time + Timezone from SystemPreferences
   - **Notifications** — notification toggles from SystemPreferences
   - **API Keys** — ApiCredentials content
3. **Danger Zone** stays at the bottom, outside the accordion

This requires splitting `AppModeSettings` and `SystemPreferences` into sub-components or rendering their internals directly.

#### 2. Split `AppModeSettings.tsx` into two exported sections
Export two additional components:
- `ActiveModeSection` — just the mode selector grid
- `FeatureVisibilitySection` — the feature toggles with reset button

Keep the existing `AppModeSettings` export for backward compatibility (renders both).

#### 3. Split `SystemPreferences.tsx` into two exported sections
Export two additional components:
- `AIIntegrationSection` — 4th Wall Time + Timezone
- `NotificationsSection` — notification toggles

Keep the existing `SystemPreferences` export intact.

### Files to modify
- `src/components/settings/AppModeSettings.tsx` — export `ActiveModeSection` and `FeatureVisibilitySection`
- `src/components/settings/SystemPreferences.tsx` — export `AIIntegrationSection` and `NotificationsSection`
- `src/components/settings/SettingsContent.tsx` — rewrite appSystem branch with accordion + reordered content

