

## Remove Prompt Synthesizer from Party DM

### Why this fixes the issue

The synthesizer is the root cause of the infinite spinner. Here's what happens:

1. All players ready up → `generateResponse` fires
2. Synthesizer makes an extra AI call (15s timeout) to fuse prompts
3. If synthesis succeeds → generation **returns early** at line 1334, shows a `SynthesisReviewPanel` to the host
4. The host sees a spinner because `isGenerating` was set to `true`, then set back to `false` — but the actual DM response **never generates** until the host interacts with the synthesis panel
5. If the host doesn't notice or the panel is obscured by the chat, it looks like the DM is stuck

Removing the synthesizer eliminates this extra step and lets prompts flow directly to the AI DM. The DM's system prompt already instructs it to weave multiple player actions into cohesive narrative — the synthesizer was adding latency and a mandatory approval gate for marginal style-direction benefit.

### What gets removed

- `synthesizePrompts` function (~65 lines)
- `pendingSynthesis` state + localStorage persistence
- `approveSynthesis`, `discardSynthesis`, `regenerateSynthesis` callbacks (~250 lines)
- `synthesisMode`, `recentModes`, `useSynthesisMemory` hook usage
- `SynthesisReviewPanel` component rendering in `PartyDMScreen.tsx`
- Non-host "Host is reviewing synthesized prompts..." indicator
- `src/lib/narrative-synthesis-prompt.ts` (entire file)
- `src/components/ai-dm/SynthesisReviewPanel.tsx` (entire file)
- `src/hooks/use-synthesis-memory.ts` (if it exists as a separate file)

### What changes in the flow

**Normal mode** (lines 1306-1398): The synthesis block (lines 1313-1335) gets deleted. Prompts go straight to raw concatenation → `streamAIResponse` → insert message. No approval gate.

**Split mode**: Same removal — the alpha/beta synthesis calls get deleted; split prompts go directly to `streamAIResponse` with raw concatenation.

### Files changed

1. **`src/hooks/use-party-dm.ts`** — Remove `synthesizePrompts`, `pendingSynthesis` state, `approveSynthesis`/`discardSynthesis`/`regenerateSynthesis` callbacks, `synthesisMode`/`recentModes` state, and all synthesis-related branches in `generateResponse`. Remove these from the returned hook object.

2. **`src/components/ai-dm/PartyDMScreen.tsx`** — Remove `SynthesisReviewPanel` import and rendering, remove non-host synthesis indicator, remove synthesis-related props from destructuring.

3. **`src/lib/narrative-synthesis-prompt.ts`** — Delete file.

4. **`src/components/ai-dm/SynthesisReviewPanel.tsx`** — Delete file.

5. **`src/hooks/use-synthesis-memory.ts`** — Delete file (if separate) or remove the hook.

6. **`src/lib/scoped-storage.ts`** — No changes needed (used by other features too).

