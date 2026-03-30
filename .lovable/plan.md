

## Triple Deadpool Command Limits

### What changes
All five Deadpool-powered Telegram commands get 3x word limits and 3x max_tokens.

### Current → New values

| Command | Words | Tokens | → Words | → Tokens |
|---------|-------|--------|---------|----------|
| /lore | 300 | 800 | 900 | 2400 |
| /scene | 150 | 600 | 450 | 1800 |
| /who | 200 | 800 | 600 | 2400 |
| /ask | 250 | 1000 | 750 | 3000 |
| /suggest | 200 | 800 | 600 | 2400 |

### File changed
**`supabase/functions/telegram-poll/index.ts`** — Update the word count in each system prompt string and the `max_tokens` value in each corresponding API call body, across all 5 commands.

