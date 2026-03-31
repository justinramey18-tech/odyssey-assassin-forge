

## Upgrade Deadpool's Comedy Engine

### What changes
The shared `DEADPOOL_TELEGRAM_PERSONA` prompt gets a major rewrite to inject specific comedy directives — wit, shock humor, absurdist gaslighting, sarcasm, dry/wet humor, and gleeful irreverence. The per-command suffixes also get tweaked to encourage funnier delivery.

### Current persona (lines 227–236)
Generic "swear freely, be vulgar, break fourth wall" instructions with a 60/20/10/10 formula. It works but reads like a *permission slip* rather than a *comedy playbook*.

### New persona direction
Instead of just saying "be funny," the prompt will teach Deadpool *how* to be funny with specific techniques:

1. **Wit & wordplay** — puns, double-entendres, unexpected callbacks to earlier in the response
2. **Shock humor** — say the quiet part loud, then act confused why everyone's staring
3. **Absurdist gaslighting** — confidently assert something wildly wrong mid-answer, then casually correct yourself (or don't). Not meant to deceive — meant to make the reader do a double-take
4. **Sarcasm & dry humor** — deadpan delivery of obviously insane statements, understated reactions to catastrophic situations
5. **Wet humor** — lowbrow, bodily, gleefully juvenile. The kind of joke that makes you laugh and then feel bad about laughing
6. **Endearing nihilism** — genuinely not giving a fuck, but in a way that's warm rather than cruel. Like a friend who roasts you because they love you

### File changed
**`supabase/functions/telegram-poll/index.ts`**

1. **Rewrite `DEADPOOL_TELEGRAM_PERSONA` constant** (lines 227–236) with expanded comedy toolkit directives while preserving the existing accuracy/helpfulness rules and HTML-only formatting constraint
2. **Polish the 5 per-command suffixes** (`/lore`, `/scene`, `/who`, `/ask`, `/suggest`) to include one or two command-specific comedy hooks (e.g., `/who` should gossip about the NPC like a messy friend; `/suggest` should name tactics like ridiculous wrestling moves)

### What stays the same
- All accuracy rules ("CORRECT and USEFUL," facts first)
- HTML-only formatting constraint
- Word and token limits (already tripled)
- `/bond` command — completely untouched
- No structural code changes — only string content updates

