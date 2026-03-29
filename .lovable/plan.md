

## Plan: Add `/bond` Command to Telegram Bot

### What it does
`/bond <message>` lets a player talk to their bonded dragon via Telegram. The dragon responds using the full personality guide, trust-gated communication style, mood, and memories — matching the in-app Dragon Bond Chat experience.

### Single file change
**`supabase/functions/telegram-poll/index.ts`**

### Implementation

**1. Add a server-side version of `buildDragonChatPrompt`**

Port a simplified version of the prompt builder from `src/lib/dragonBondState.ts` directly into the edge function (edge functions cannot import from `src/`). This includes:
- Trust-gated communication style (wary/guarded/open/deep/profound)
- Mood modifier instructions
- Dragon personality notes injection (the `dragonNotes` field)
- Memory inclusion (from `state_data.memories` if available)
- Output format instructions (plain text only, no mood/memory tags since this is a one-shot response)

**2. Add `/bond` command handler**

Insert a new command block (after `/dragon`, before `/party`):

```
/bond <message to your dragon>
```

Flow:
1. Validate user is linked, get userId
2. Fetch dragon data from both solo (`extended_data.dragonBond`) and party (`party_shared_state` where `state_type = 'dragon_bond'`) — use the first dragon found (prefer party over solo)
3. Extract: `dragonName`, `dragonNotes`, `trust`, `bond`, `mood`, `memories`
4. Build a system prompt using the ported prompt builder
5. Fetch recent narrative (last 3 DM messages) for campaign context
6. Call the Lovable AI gateway (`google/gemini-2.5-flash`) with the system prompt + user message
7. Strip any meta tags from response, send back via Telegram as `🐉 <b>DragonName</b>\n\n<response>`

**3. Update `/help` messages**

Add `/bond` to the AI Tools help section (message 6) with usage examples.

**4. Register `/bond` in the bot command list**

After deployment, register the new command with the Telegram `setMyCommands` API.

**5. Update the Telegram Settings reference**

Add `/bond` to the command reference list in `src/components/settings/TelegramSettingsTab.tsx`.

### Technical notes
- One-shot (no conversation memory in Telegram) — each `/bond` message is independent
- Max response: 1000 tokens, under 250 words instruction to fit Telegram's 4096 char limit
- The prompt builder is ~80 lines, simplified from the 150-line client version (omits rider emotional log, speech habits, party context, vision blocks)
- Uses the user's actual trust/bond/mood values so the dragon's voice authentically matches their in-app experience

