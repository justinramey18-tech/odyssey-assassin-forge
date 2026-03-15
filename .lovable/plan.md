

## Prompt Synthesizer — Host Approval Step

After prompts are synthesized into a fused "director's note", the host sees a `SynthesisReviewPanel` with:
- The selected presentation mode and focus character badges
- The narrative spine (italic quote)
- Raw player actions summary
- The fused prompt text (editable)
- Approve ("Send to DM"), Regenerate, and Skip buttons

**Flow:**
1. Prompts collected → synthesized → `pendingSynthesis` state set → generation lock released
2. Host reviews/edits the fused prompt in `SynthesisReviewPanel`
3. On approve: re-acquires generation lock, sends fused prompt to main DM
4. On skip: clears `pendingSynthesis`, raw prompts remain for next round
5. On regenerate: re-runs synthesis with same prompts

Non-host players see "Host is reviewing synthesized prompts..." indicator.

Split mode bypasses this approval step (synthesis is applied directly).
