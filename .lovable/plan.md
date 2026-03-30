

## Telegram Active Mode Preference

### Summary
Add a persistent "active mode" preference to each Telegram-linked account. A new `/mode` command and an in-app setting let users choose which DM context (Solo, Party, Empyrean) their Telegram commands pull from. All narrative commands (`/last`, `/scene`, `/who`, `/ask`, `/suggest`, `/recap`, `/bond`, `/ready`) will respect this preference.

### Database change
Add a `telegram_active_mode` column to `telegram_user_links`:

```sql
ALTER TABLE telegram_user_links
ADD COLUMN telegram_active_mode text NOT NULL DEFAULT 'party'
CHECK (telegram_active_mode IN ('solo', 'party', 'empyrean'));
```

### Edge function changes (`telegram-poll/index.ts`)

**New `/mode` command:**
- `/mode` (no args) — queries the user's link row + all 3 mode sources, replies with:
  ```
  🎯 Active Telegram Mode

  ✅ Party — "Shadows of Aretia" (2d ago, session active)
  ○  Solo — "Lone Wolf" (5d ago)
  ○  Empyrean — No campaign found

  Switch with /mode solo, /mode party, or /mode empyrean
  ```
- `/mode solo|party|empyrean` — updates `telegram_active_mode` on the link row, confirms with campaign name + last activity date if a matching campaign exists, or warns "No campaign found for this mode — commands may return empty results."

**Session info lookup helper:**
Create a `getModeSessions(userId, supabase)` helper that returns status for all 3 modes:
- **Solo**: query `ai_dm_campaigns` where `mode = 'solo'`, get latest by `updated_at`
- **Empyrean**: query `ai_dm_campaigns` where `mode = 'solo-empyrean'`, get latest
- **Party**: query `party_members` → `party_shared_state` (dm_session) for active session info

**Refactor affected commands to use active mode:**

1. **`/last`** — Currently hardcoded to party (`party_dm_messages`). With mode:
   - `party` → existing logic (query `party_dm_messages`)
   - `solo` / `empyrean` → query `ai_dm_campaigns` for the latest campaign matching mode, return last assistant message from the `messages` JSON array

2. **`/recap`** — Currently picks most recent campaign. With mode:
   - Filter `ai_dm_campaigns` by mode (`solo` or `solo-empyrean` or all-party-campaigns)
   - `party` → query `party_shared_state` dm_session for `campaignSummary`

3. **`/scene`** — Currently party-only. With mode:
   - `party` → existing logic
   - `solo`/`empyrean` → pull last 5 messages from `ai_dm_campaigns.messages` JSON, feed to AI

4. **`/ask`** — Currently party-only context. With mode:
   - `party` → existing logic
   - `solo`/`empyrean` → pull campaign summary + recent messages from `ai_dm_campaigns`

5. **`/suggest`** — Same pattern as `/ask`

6. **`/who`** — Same pattern as `/ask`/`/scene`

7. **`/bond`** — Currently uses `:solo`/`:party` suffix. With active mode, bare `/bond` uses the active mode instead of defaulting. Explicit suffixes still override.

8. **`/ready`** — Currently party-only. With mode set to `party`, works as-is. For `solo`/`empyrean`, reply "Ready-up is only available in party mode."

**Helper: `getActiveMode(chatId, supabase)`**
Returns the `telegram_active_mode` from the user's link row. Used at the top of each affected command.

### In-app UI change (`TelegramSettingsTab.tsx`)

Add a "Active Telegram Mode" selector below each linked chat card:
- Three radio-style buttons: Solo / Party / Empyrean
- Selecting one updates `telegram_active_mode` on the link row via Supabase
- Shows current active mode with a highlight color

### Files changed
1. **Migration SQL** — add `telegram_active_mode` column
2. **`supabase/functions/telegram-poll/index.ts`** — add `/mode` command, `getActiveMode` helper, `getModeSessions` helper, refactor all 8 commands
3. **`src/components/settings/TelegramSettingsTab.tsx`** — add mode selector UI

