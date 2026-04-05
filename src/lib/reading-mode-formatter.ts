import { getAuthToken } from '@/lib/auth-token';
import { loadApiKey } from '@/lib/api-keys';

export interface FormattedReading {
  html: string;
  mood: string;
  ambientColor: string;
  particles: string;
  pullQuote: string;
}

const FORMAT_SYSTEM_PROMPT = `You are a cinematic text formatter for a D&D companion app. You receive plain narrative text from an AI Dungeon Master and transform it into visually stunning HTML for a full-screen reading experience on a mobile phone with a near-black background (#0a0a10).

You MUST respond with ONLY a valid JSON object. No markdown, no backticks, no explanation — raw JSON only.

JSON SCHEMA:
{
  "html": "string — the formatted HTML",
  "mood": "string — one of: neutral, dark, warm, cold, danger, triumph, grief, tension, mystery",
  "ambientColor": "string — hex color for background tint, very subtle (e.g. #1a0c08 for warm)",
  "particles": "string — one of: none, embers, dust, snow, rain, sparks, mist",
  "pullQuote": "string — the single most dramatic or impactful line"
}

HTML FORMATTING RULES:

1. STRUCTURE: Break the narrative into logical sections. Use these HTML patterns:
   - Wrap scene-setting narration in: <div class="rm-narration">...</div>
   - Wrap action/combat sequences in: <div class="rm-action">...</div>
   - Wrap emotional/internal moments in: <div class="rm-internal">...</div>
   - Add section breaks between major shifts: <div class="rm-divider"></div>

2. NPC DIALOGUE: Each NPC gets a unique color. Wrap dialogue in styled spans:
   <div class="rm-dialogue"><span class="rm-speaker" style="color:{npcColor}">{NPC Name}</span><span class="rm-speech" style="color:{npcColor}; border-left-color:{npcColor}">{dialogue text}</span></div>

   ONLY use these NPC colors (chosen for readability on #0a0a10 background):
   - First NPC: #fbbf24 (amber)
   - Second NPC: #22d3ee (cyan)
   - Third NPC: #fb7185 (rose)
   - Fourth NPC: #34d399 (emerald)
   - Fifth NPC: #a78bfa (violet)
   - Sixth NPC: #38bdf8 (sky)
   - Seventh NPC: #fb923c (orange)
   - Eighth NPC: #f472b6 (pink)
   Assign colors consistently — the same NPC always gets the same color throughout the text.

3. EMPHASIS: Use these for dramatic moments:
   - Pull quotes (most impactful lines): <blockquote class="rm-pullquote">{text}</blockquote>
   - Dramatic emphasis: <em class="rm-dramatic">{text}</em>
   - Sound effects or environmental text: <span class="rm-ambient">{text}</span>
   - Important names/items on first mention: <strong class="rm-highlight">{text}</strong>

4. PACING: Add breathing room:
   - Use <div class="rm-beat"></div> for dramatic pauses between tense moments
   - Use <div class="rm-divider"></div> for scene transitions

5. DO NOT:
   - Do NOT add any <style> tags, <script> tags, or CSS
   - Do NOT change the actual words or meaning of the narrative
   - Do NOT add content that wasn't in the original text
   - Do NOT use colors other than the ones listed above
   - Do NOT use background colors on text (only foreground colors)
   - Keep ALL original text — this is reformatting, not rewriting`;

const AI_DM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`;

export async function formatForReadingMode(narrativeText: string): Promise<FormattedReading | null> {
  try {
    const authToken = await getAuthToken();

    const resp = await fetch(AI_DM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        messages: [{ role: 'user', content: narrativeText }],
        systemPromptOverride: FORMAT_SYSTEM_PROMPT,
        model: 'google/gemini-2.5-flash-lite',
        maxTokens: 4000,
      }),
    });

    if (!resp.ok) throw new Error(`Format API error: ${resp.status}`);
    if (!resp.body) throw new Error('No response body');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let assembled = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (delta) assembled += delta;
        } catch { /* ignore partial JSON */ }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split('\n')) {
        if (!raw || !raw.startsWith('data: ')) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (delta) assembled += delta;
        } catch { /* ignore */ }
      }
    }

    // Parse JSON response
    const clean = assembled.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean) as FormattedReading;

    // Validate
    if (!result.html || !result.mood || !result.ambientColor || !result.particles || !result.pullQuote) {
      console.error('[ReadingModeFormatter] Missing required fields in response');
      return null;
    }

    return result;
  } catch (e) {
    console.error('[ReadingModeFormatter] Failed to format narrative:', e);
    return null;
  }
}
