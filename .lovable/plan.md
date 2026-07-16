## Problem
The private “Talk to the DM” channel is still answering as if it has no campaign details. The likely causes are:

- It only sends the first 5,000 characters of the campaign/guide bundle, so real GM Guides can be cut off.
- Non-host players may be sending their own empty guide list instead of the host’s guide list.
- The private DM prompt tells the AI to fall back to “I don’t have details…” too easily, even when the answer may be in the guide/memory/campaign text.
- The prompt does not explicitly support meta-questions like “What GM guides are applied?”

## Plan
1. **Make the private DM receive the right source of truth**
   - Build one reusable campaign-context string for the private DM.
   - Include enabled GM Guides, Memory Anchors, and Campaign Summary in clear labeled sections.
   - For non-host players, load/use the original host’s guides instead of an empty local guide set.

2. **Stop cutting off the useful guide text**
   - Increase the private DM campaign-context limit from 5,000 chars to a safer bounded size.
   - Keep separate caps for guide context and character context so it stays controlled but not useless.

3. **Strengthen the private DM instructions**
   - Tell it that GM Guides and Memory Anchors are authoritative.
   - Tell it to answer from those sections first before using the “I don’t have details” fallback.
   - Add explicit handling for “what guides are applied” so it summarizes the active guide names/topics instead of claiming ignorance.

4. **Preserve privacy and current behavior**
   - Keep the Director as an out-of-fiction private liaison.
   - Keep secret actions private and public actions routed to the party round.
   - Do not make it narrate scenes or alter established outcomes.

5. **Validate**
   - Typecheck the changed files.
   - Confirm the request body sent to the private DM includes GM Guides / Memory Anchors / Campaign Summary sections before the AI call.