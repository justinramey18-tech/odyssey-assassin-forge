// Narrative Forge Edge Function
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ── Auth ──────────────────────────────────────────────────────────────
async function authenticateRequest(req: Request): Promise<{ userId: string } | { error: Response }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      error: new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getClaims(token);
  
  if (error || !data?.claims) {
    console.error('Authentication failed:', error?.message);
    return {
      error: new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  return { userId: data.claims.sub as string };
}

// ── Validation constants ──────────────────────────────────────────────
const MAX_TEXT_LENGTH = 50000;
const MIN_TEXT_LENGTH = 10;
const MAX_CHARACTER_NAME_LENGTH = 100;
const VALID_STYLES = [
  'fantasy', 'noir', 'literary', 'action',
  'salvatore', 'deadpool', 'dark_comedy', 'subtle_absurdity',
  'lovecraftian', 'gonzo', 'hemingway'
] as const;

type ValidStyle = typeof VALID_STYLES[number];

interface CustomEditingRule {
  type: string;
  instruction: string;
  scope: string;
}

interface BlendConfig {
  secondaryStyle: string;
  ratio: number;
  tertiaryStyle?: string;
  tertiaryRatio?: number;
}

interface PartialContext {
  precedingText: string;
  selectedText: string;
  followingText: string;
  instruction?: string;
}

interface CommandContext {
  fullText: string;
  instruction: string;
}

interface CharacterCardInput {
  name: string;
  raceClass?: string;
  personality: string;
  speechStyle: string;
}

interface ProtagonistCardInput {
  name: string;
  raceClass?: string;
  personality: string;
  speechStyle: string;
  povStyle: 'first' | 'third' | 'rotating';
  backstory?: string;
  goalsConflicts?: string;
  relationships?: string;
  appearanceMannerisms?: string;
  flawsWeaknesses?: string;
  skillsAbilities?: string;
  characterArc?: string;
}

interface RequestBody {
  text: string;
  characterName?: string;
  style?: string;
  smartParseEnabled?: boolean;
  customEditingRules?: CustomEditingRule[];
  blendConfig?: BlendConfig;
  mode?: 'full' | 'partial' | 'command';
  partialContext?: PartialContext;
  commandContext?: CommandContext;
  model?: string;
  processingMode?: 'transform' | 'enhance';
  campaignSummary?: string;
  storyContext?: string;
  characterCards?: CharacterCardInput[];
  protagonistCards?: ProtagonistCardInput[];
}

type ValidationResult = {
  valid: true;
  text: string;
  characterName: string | null;
  style: ValidStyle;
  smartParseEnabled: boolean;
  customEditingRules: CustomEditingRule[];
  blendConfig?: BlendConfig;
  mode: 'full' | 'partial' | 'command';
  partialContext?: PartialContext;
  commandContext?: CommandContext;
} | {
  valid: false;
  error: string;
};

// ── Input sanitization ────────────────────────────────────────────────
function sanitizeInput(text: string): string {
  const injectionPatterns = [
    /ignore\s+(previous|above|all)\s+instructions?/gi,
    /disregard\s+(previous|above|all)\s+instructions?/gi,
    /forget\s+(everything|all|previous)/gi,
    /new\s+instructions?:/gi,
    /system\s*:\s*/gi,
    /\[INST\]/gi,
    /<<SYS>>/gi,
    /<\|im_start\|>/gi,
  ];
  let sanitized = text;
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

function extractAssistantContent(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inUserSection = false;
  let inAssistantSection = true;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^(\*\*)?user(\*\*)?:?\s*$/i.test(line.trim()) || /^user\s*$/i.test(line.trim())) {
      inUserSection = true; inAssistantSection = false; continue;
    }
    if (/^(\*\*)?assistant(\*\*)?:?\s*$/i.test(line.trim()) || /^assistant\s*$/i.test(line.trim())) {
      inUserSection = false; inAssistantSection = true; continue;
    }
    const userInlineMatch = line.match(/^(\*\*)?(user)(\*\*)?:\s*(.*)$/i);
    if (userInlineMatch) continue;
    const assistantInlineMatch = line.match(/^(\*\*)?(assistant)(\*\*)?:\s*(.*)$/i);
    if (assistantInlineMatch) { result.push(assistantInlineMatch[4]); inUserSection = false; inAssistantSection = true; continue; }
    if (inAssistantSection && !inUserSection) result.push(line);
  }
  let cleaned = result.join('\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

function isChatLogFormat(text: string): boolean {
  const hasUserLabel = /\buser\b\s*$/im.test(text) || /^\*\*user\*\*\s*$/im.test(text);
  const hasAssistantLabel = /\bassistant\b\s*$/im.test(text) || /^\*\*assistant\*\*\s*$/im.test(text);
  return hasUserLabel || hasAssistantLabel;
}

function sanitizeCharacterName(name: string): string {
  return name.replace(/[^a-zA-ZÀ-ÿ0-9\s\-']/g, '').trim();
}

const MAX_EDITING_RULES = 10;
const MAX_RULE_LENGTH = 200;

function validateEditingRules(rules: unknown): CustomEditingRule[] {
  if (!rules || !Array.isArray(rules)) return [];
  const validatedRules: CustomEditingRule[] = [];
  for (const rule of rules.slice(0, MAX_EDITING_RULES)) {
    if (!rule || typeof rule !== 'object') continue;
    const { type, instruction, scope } = rule as CustomEditingRule;
    if (typeof instruction !== 'string' || instruction.length === 0 || instruction.length > MAX_RULE_LENGTH) continue;
    validatedRules.push({ type: typeof type === 'string' ? type : 'custom', instruction: sanitizeInput(instruction), scope: typeof scope === 'string' ? scope : 'all' });
  }
  return validatedRules;
}

function validateBlendConfig(config: unknown): BlendConfig | undefined {
  if (!config || typeof config !== 'object') return undefined;
  const { secondaryStyle, ratio, tertiaryStyle, tertiaryRatio } = config as BlendConfig;
  if (typeof secondaryStyle !== 'string' || !VALID_STYLES.includes(secondaryStyle as ValidStyle)) return undefined;
  if (typeof ratio !== 'number' || ratio < 10 || ratio > 90) return undefined;
  const result: BlendConfig = { secondaryStyle, ratio };
  if (tertiaryStyle !== undefined && typeof tertiaryStyle === 'string' && VALID_STYLES.includes(tertiaryStyle as ValidStyle)) {
    result.tertiaryStyle = tertiaryStyle;
    result.tertiaryRatio = typeof tertiaryRatio === 'number' && tertiaryRatio >= 5 && tertiaryRatio <= 30 ? tertiaryRatio : 10;
  }
  return result;
}

function validatePartialContext(context: unknown): PartialContext | null {
  if (!context || typeof context !== 'object') return null;
  const { precedingText, selectedText, followingText, instruction } = context as PartialContext;
  if (typeof selectedText !== 'string' || selectedText.length < 5) return null;
  return {
    precedingText: typeof precedingText === 'string' ? sanitizeInput(precedingText) : '',
    selectedText: sanitizeInput(selectedText),
    followingText: typeof followingText === 'string' ? sanitizeInput(followingText) : '',
    instruction: typeof instruction === 'string' ? sanitizeInput(instruction.slice(0, 200)) : undefined,
  };
}

function validateCommandContext(context: unknown): CommandContext | null {
  if (!context || typeof context !== 'object') return null;
  const { fullText, instruction } = context as CommandContext;
  if (typeof fullText !== 'string' || fullText.length < 10 || fullText.length > MAX_TEXT_LENGTH) return null;
  if (typeof instruction !== 'string' || instruction.length < 3 || instruction.length > 1000) return null;
  return { fullText: sanitizeInput(fullText), instruction: sanitizeInput(instruction) };
}

function validateRequestBody(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Invalid request body' };
  const { text, characterName, style, smartParseEnabled, customEditingRules, blendConfig, mode, partialContext, commandContext } = body as RequestBody;
  const validatedMode = mode === 'partial' ? 'partial' : mode === 'command' ? 'command' : 'full';
  let validatedStyle: ValidStyle = 'fantasy';
  if (style !== undefined && style !== null && typeof style === 'string' && VALID_STYLES.includes(style as ValidStyle)) {
    validatedStyle = style as ValidStyle;
  }
  if (validatedMode === 'command') {
    const vc = validateCommandContext(commandContext);
    if (!vc) return { valid: false, error: 'Invalid command context. Requires fullText (10-50000 chars) and instruction (3-1000 chars)' };
    return { valid: true, text: '', characterName: characterName ? sanitizeCharacterName(String(characterName)) : null, style: validatedStyle, smartParseEnabled: false, customEditingRules: [], mode: 'command', commandContext: vc };
  }
  if (validatedMode === 'partial') {
    const vp = validatePartialContext(partialContext);
    if (!vp) return { valid: false, error: 'Invalid partial context for partial regeneration' };
    return { valid: true, text: '', characterName: characterName ? sanitizeCharacterName(String(characterName)) : null, style: validatedStyle, smartParseEnabled: false, customEditingRules: [], mode: 'partial', partialContext: vp };
  }
  if (text === undefined || text === null) return { valid: false, error: 'Missing text parameter' };
  if (typeof text !== 'string') return { valid: false, error: 'text must be a string' };
  if (text.length < MIN_TEXT_LENGTH) return { valid: false, error: `text must be at least ${MIN_TEXT_LENGTH} characters` };
  if (text.length > MAX_TEXT_LENGTH) return { valid: false, error: `text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` };
  let validatedCharacterName: string | null = null;
  if (characterName !== undefined && characterName !== null) {
    if (typeof characterName !== 'string') return { valid: false, error: 'characterName must be a string' };
    if (characterName.length > MAX_CHARACTER_NAME_LENGTH) return { valid: false, error: `characterName exceeds maximum length of ${MAX_CHARACTER_NAME_LENGTH} characters` };
    const sn = sanitizeCharacterName(characterName);
    if (sn.length > 0) validatedCharacterName = sn;
  }
  return {
    valid: true, text, characterName: validatedCharacterName, style: validatedStyle,
    smartParseEnabled: smartParseEnabled !== false, customEditingRules: validateEditingRules(customEditingRules),
    blendConfig: validateBlendConfig(blendConfig), mode: 'full',
  };
}

// ── Context blocks builder ────────────────────────────────────────────
function buildContextBlocks(
  campaignSummary?: string,
  storyContext?: string,
  characterCards?: CharacterCardInput[],
  protagonistCards?: ProtagonistCardInput[],
): string {
  let blocks = '';
  if (campaignSummary && campaignSummary.length > 0) {
    blocks += `\nCAMPAIGN REFERENCE (ENFORCE CONSISTENCY):
${campaignSummary}
You MUST maintain strict consistency with the above. Character names, relationships, locations, world rules must match. Do not contradict established facts.\n`;
  }
  if (storyContext && storyContext.length > 0) {
    blocks += `\nPRECEDING NARRATIVE (match voice, tone, plot continuity, character speech patterns):
${storyContext}\n`;
  }

  // Protagonist profiles (high priority)
  if (protagonistCards && protagonistCards.length > 0) {
    const protagLines = protagonistCards.map(p => {
      const rc = p.raceClass ? ` (${p.raceClass})` : '';
      const povLabel = p.povStyle === 'first' ? 'First Person' : p.povStyle === 'rotating' ? 'Rotating' : 'Third Person Close';
      let entry = `[${p.name}${rc}] -- POV: ${povLabel}\nPersonality: ${p.personality}\nSpeech Style: ${p.speechStyle}`;
      if (p.backstory) entry += `\nBackstory: ${p.backstory}`;
      if (p.goalsConflicts) entry += `\nGoals & Conflicts: ${p.goalsConflicts}`;
      if (p.relationships) entry += `\nRelationships: ${p.relationships}`;
      if (p.appearanceMannerisms) entry += `\nAppearance & Mannerisms: ${p.appearanceMannerisms}`;
      if (p.flawsWeaknesses) entry += `\nFlaws & Weaknesses: ${p.flawsWeaknesses}`;
      if (p.skillsAbilities) entry += `\nSkills & Abilities: ${p.skillsAbilities}`;
      if (p.characterArc) entry += `\nCharacter Arc: ${p.characterArc}`;
      return entry;
    }).join('\n\n');

    const povDirectives: string[] = [];
    const povStyles = new Set(protagonistCards.map(p => p.povStyle));
    if (povStyles.has('first')) povDirectives.push('- Write from the first-person POV of the protagonist');
    if (povStyles.has('third')) povDirectives.push('- Write in tight third-person POV, revealing the protagonist\'s inner thoughts');
    if (povStyles.has('rotating')) povDirectives.push('- When using Rotating POV, shift perspective between scenes');
    povDirectives.push('- Include inner monologue revealing thoughts and emotional reactions');
    povDirectives.push('- Protagonist details take priority over supporting cast');

    blocks += `\nPROTAGONIST PROFILES (PRIMARY CHARACTERS -- prioritize in narration):

${protagLines}

NARRATION DIRECTIVES:
${povDirectives.join('\n')}\n`;
  }

  if (characterCards && characterCards.length > 0) {
    const lines = characterCards.map(c => {
      const rc = c.raceClass ? ` (${c.raceClass})` : '';
      return `- ${c.name}${rc}: ${c.personality}. Speech style: ${c.speechStyle}`;
    });
    blocks += `\nCHARACTER PROFILES (use for dialogue voice and consistency):
${lines.join('\n')}\n`;
  }
  return blocks;
}

// ── Style guides ──────────────────────────────────────────────────────
const styleGuides: Record<ValidStyle, string> = {
  fantasy: `Write in a rich, evocative fantasy style with vivid descriptions of magic, ancient places, and heroic deeds. Use dramatic language befitting epic tales. Include sensory details about mystical energies, enchanted locations, and the weight of legendary moments.`,
  noir: `Write in a hardboiled noir style - short, punchy sentences. The world is dark, cynical, and full of shadows. Characters are tough and world-weary. Use urban imagery, smoky atmospheres, and a sense that everyone has an angle they're playing.`,
  literary: `Write in a thoughtful, literary style with attention to character psychology and thematic depth. Use metaphor and symbolism where appropriate. Focus on internal motivations and the emotional weight of moments. Prose should flow with careful rhythm.`,
  action: `Write in a fast-paced, cinematic action style. Short paragraphs, punchy verbs, and visceral impact. Think action movie - explosions, quips, and momentum. Every sentence should drive forward with energy and intensity.`,
  salvatore: `Write in the style of R.A. Salvatore, author of The Legend of Drizzt.
CORE PRINCIPLES:
- Combat is a DANCE with rhythm and poetry - describe it blow-by-blow with fluid choreography
- Weapons have NAMES and PERSONALITIES (reference their history, enchantments)
- Inner monologue reveals philosophical warrior code during external battle
- Deep focus on bonds of friendship, loyalty, and honor
- Action flows with emotional stakes - every fight has meaning
MANDATORY ELEMENTS:
- Name fighting techniques ("the Hunter's dance," "the double-thrust-low")
- Use simile for weapon movement (blade "sang," "whispered," "screamed")
- Include internal conflict during external battle
- Reference character relationships in combat context
FORBIDDEN:
- Generic "he attacked" phrasing
- Combat without emotional context
- Cynicism about heroism`,
  deadpool: `Write in Deadpool's fourth-wall-breaking style.
CORE PRINCIPLES:
- CONSTANT fourth-wall breaks addressing "you" (the reader)
- Pop culture references even when anachronistic
- Self-aware mockery of fantasy tropes and D&D mechanics
- Parenthetical asides interrupt serious moments
- Violence described in cartoonishly graphic detail
MANDATORY ELEMENTS:
- Direct reader address at least once per paragraph
- (Parenthetical commentary on the action like this)
- Reference to "the writer," "the DM," or "plot armor"
- Visual sound effects: THWACK, SLICE, BOOM, etc.
FORBIDDEN:
- Playing anything completely straight without commentary
- Serious emotional moments without undercutting`,
  dark_comedy: `Write in a dark comedy style - tragedy played for laughs.
CORE PRINCIPLES:
- SARDONIC NARRATOR voice with cosmic detachment
- Tragedy described with UNDERSTATED dryness
- Murphy's Law as narrative engine - everything gets worse
- Tone: Douglas Adams meets Lemony Snicket meets Terry Pratchett's Death
MANDATORY ELEMENTS:
- Narrator commentary on the futility/irony of actions
- Understated phrasing for horrible events
- Foreshadowing of doom delivered casually
FORBIDDEN:
- Slapstick or silly comedy (this is DARK comedy)
- Happy outcomes without ironic cost`,
  subtle_absurdity: `Write in a subtly absurd style - Kafka meets D&D.
CORE PRINCIPLES:
- BUREAUCRATIC/CLINICAL language for impossible events
- Deadpan delivery with ZERO acknowledgment of weirdness
- Characters treat the bizarre as routine administrative procedure
MANDATORY ELEMENTS:
- Formal/technical language for magic and violence
- No exclamation points or emotional language
- Reference forms, protocols, or regulations for the impossible
FORBIDDEN:
- Acknowledging anything is strange
- Emotional reactions or colorful adjectives`,
  lovecraftian: `Write in Lovecraftian cosmic horror style.
CORE PRINCIPLES:
- COSMIC DREAD and insignificance of mortals
- Knowledge itself is CORRUPTING and MADDENING
- Entities described through what they're NOT (indescribable, non-Euclidean)
- Archaic prose with subordinate clauses and antiquated vocabulary
MANDATORY ELEMENTS:
- Archaic language: "eldritch," "blasphemous," "cyclopean," "gibbous"
- Sanity/mental state deterioration
- Atmosphere of WRONGNESS pervading descriptions
FORBIDDEN:
- Direct, clear descriptions of monsters
- Heroic confidence or triumph
- Modern casual language`,
  gonzo: `Write in Hunter S. Thompson's Gonzo Journalism style.
CORE PRINCIPLES:
- STREAM-OF-CONSCIOUSNESS frantic energy
- Unreliable narrator admitting to altered states
- Savage social commentary embedded in chaos
- "Too weird to live, too rare to die" energy
MANDATORY ELEMENTS:
- First-person perspective
- Sudden philosophical tangents mid-action
- Sentence fragments. Rapid fire. Like this.
FORBIDDEN:
- Calm, measured prose
- Objective third-person distance`,
  hemingway: `Write in Ernest Hemingway's minimalist style.
CORE PRINCIPLES:
- SHORT, DECLARATIVE SENTENCES (subject-verb-object)
- NO ADVERBS (never "quickly ran" - just "ran")
- Iceberg theory: SUBTEXT over text (90% unsaid)
- Focus on PHYSICAL, CONCRETE details
MANDATORY ELEMENTS:
- Sentences averaging 10 words or fewer
- Emotional weight conveyed through what's NOT said
- Dialogue without attributions when possible
FORBIDDEN:
- Adverbs (-ly words)
- Flowery adjectives
- Explaining emotions directly`,
};

// ── Main handler ──────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await authenticateRequest(req);
    if ('error' in authResult) return authResult.error;
    const userId = authResult.userId;
    console.log(`Authenticated request from user: ${userId.slice(0, 8)}...`);

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = validateRequestBody(body);
    if (!validation.valid) {
      console.error('Validation failed:', validation.error);
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { characterName, style, smartParseEnabled, customEditingRules, blendConfig, mode, partialContext, commandContext } = validation;
    const rb = body as RequestBody;
    const requestedModel = rb.model;
    const isEnhance = rb.processingMode === 'enhance';
    const multiplier = typeof rb.targetMultiplier === 'number' ? rb.targetMultiplier : 1.5;
    const contextBlocks = buildContextBlocks(rb.campaignSummary, rb.storyContext, rb.characterCards, rb.protagonistCards);

    // ── Command mode ─────────────────────────────────────────────
    if (mode === 'command' && commandContext) {
      console.log(`Processing command mode: ${commandContext.fullText.length} chars`);
      const styleGuide = styleGuides[style];
      const commandSystemPrompt = `You are an expert prose editor. Your task is to apply the user's editing instruction to the provided text.

RULES:
1. APPLY the instruction PRECISELY as stated
2. MAINTAIN the overall structure and narrative voice unless instructed otherwise
3. PRESERVE important story elements, character names, and plot points unless the instruction specifically targets them
4. RETURN the complete modified text - do not summarize or truncate
5. Do NOT add explanations, notes, or meta-commentary - respond only with the edited text

${styleGuide}
${characterName ? `Primary character for reference: ${characterName}` : ''}
${contextBlocks}
Respond ONLY with the edited text. No explanations, no meta-commentary.`;

      const commandUserPrompt = `EDITING INSTRUCTION:\n${commandContext.instruction}\n\nTEXT TO EDIT:\n---\n${commandContext.fullText}\n---\n\nApply the instruction above and return the complete edited text.`;

      const response = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: requestedModel || 'google/gemini-3-pro-preview',
          messages: [{ role: 'system', content: commandSystemPrompt }, { role: 'user', content: commandUserPrompt }],
          temperature: 0.5, max_tokens: 16000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI Gateway error:', response.status, errorText);
        return new Response(JSON.stringify({ success: false, error: `AI processing failed: ${response.status}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const data = await response.json();
      const narrative = data.choices?.[0]?.message?.content || '';
      return new Response(JSON.stringify({ success: true, narrative, mode: 'command', style, inputLength: commandContext.fullText.length, outputLength: narrative.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Partial mode ─────────────────────────────────────────────
    if (mode === 'partial' && partialContext) {
      console.log(`Processing partial regeneration: ${partialContext.selectedText.length} chars selected`);
      const styleGuide = styleGuides[style];
      const partialSystemPrompt = `You are a skilled narrative writer who can seamlessly rewrite portions of prose fiction.

Your task is to rewrite the SELECTED TEXT while:
1. MAINTAINING perfect continuity with the surrounding context
2. PRESERVING the same narrative perspective and tense
3. MATCHING the tone and style of the surrounding text
4. KEEPING the same basic plot events and character actions (unless instructed otherwise)

${styleGuide}
${characterName ? `The main character or POV is: ${characterName}` : ''}
${partialContext.instruction ? `SPECIAL INSTRUCTION: ${partialContext.instruction}` : ''}
${contextBlocks}
Respond ONLY with the rewritten text. No explanations, no meta-commentary.`;

      const partialUserPrompt = `CONTEXT (text that comes BEFORE the section to rewrite):\n---\n${partialContext.precedingText || '[Beginning of text]'}\n---\n\nTEXT TO REWRITE:\n---\n${partialContext.selectedText}\n---\n\nCONTEXT (text that comes AFTER the section to rewrite):\n---\n${partialContext.followingText || '[End of text]'}\n---\n\nRewrite the middle section while maintaining perfect continuity with the surrounding context.`;

      const response = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: requestedModel || 'google/gemini-3-flash-preview',
          messages: [{ role: 'system', content: partialSystemPrompt }, { role: 'user', content: partialUserPrompt }],
          temperature: 0.7, max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI Gateway error:', response.status, errorText);
        return new Response(JSON.stringify({ success: false, error: `AI processing failed: ${response.status}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const data = await response.json();
      const narrative = data.choices?.[0]?.message?.content || '';
      return new Response(JSON.stringify({ success: true, narrative, mode: 'partial', style, inputLength: partialContext.selectedText.length, outputLength: narrative.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Full mode ────────────────────────────────────────────────
    let sanitizedText = sanitizeInput(validation.text);
    
    if (smartParseEnabled) {
      if (isChatLogFormat(sanitizedText)) {
        console.log('Smart parse enabled - extracting assistant content only');
        sanitizedText = extractAssistantContent(sanitizedText);
        console.log(`After smart parse: ${sanitizedText.length} chars`);
      }
    }

    // Build style guide (single or blended)
    let styleGuide: string;
    if (blendConfig) {
      const tertiaryRatio = blendConfig.tertiaryStyle ? (blendConfig.tertiaryRatio || 10) : 0;
      const primaryRatio = 100 - blendConfig.ratio - tertiaryRatio;
      const primaryGuide = styleGuides[style];
      const secondaryGuide = styleGuides[blendConfig.secondaryStyle as ValidStyle];

      if (blendConfig.tertiaryStyle) {
        const tertiaryGuide = styleGuides[blendConfig.tertiaryStyle as ValidStyle];
        styleGuide = `STYLE BLENDING INSTRUCTIONS:
PRIMARY STYLE (${primaryRatio}% weight):
${primaryGuide}

SECONDARY STYLE (${blendConfig.ratio}% weight):
${secondaryGuide}

TERTIARY STYLE (${tertiaryRatio}% weight):
${tertiaryGuide}

BLENDING: Use primary as foundation. Weave in secondary elements. Add subtle tertiary touches. When styles conflict, favor primary.`;
        console.log(`Style blending: ${primaryRatio}% ${style} + ${blendConfig.ratio}% ${blendConfig.secondaryStyle} + ${tertiaryRatio}% ${blendConfig.tertiaryStyle}`);
      } else {
        styleGuide = `STYLE BLENDING INSTRUCTIONS:
PRIMARY STYLE (${primaryRatio}% weight):
${primaryGuide}

SECONDARY STYLE (${blendConfig.ratio}% weight):
${secondaryGuide}

BLENDING: Use primary as foundation. Weave in secondary elements naturally. When styles conflict, favor primary.`;
        console.log(`Style blending: ${primaryRatio}% ${style} + ${blendConfig.ratio}% ${blendConfig.secondaryStyle}`);
      }
    } else {
      styleGuide = styleGuides[style];
    }

    // Custom editing rules
    let customRulesSection = '';
    if (customEditingRules.length > 0) {
      const rulesText = customEditingRules.map((r, i) => {
        const scopeLabel = r.scope !== 'all' ? ` [SCOPE: ${r.scope.toUpperCase()}]` : '';
        return `${i + 1}.${scopeLabel} ${r.instruction}`;
      }).join('\n');
      customRulesSection = `\n<user_editing_rules>\nApply these specific editing rules during transformation:\n${rulesText}\n\nImportant: Apply each rule exactly as stated.\n</user_editing_rules>`;
    }

    console.log(`Processing narrative forge: ${sanitizedText.length} chars, style: ${style}, mode: ${isEnhance ? 'enhance' : 'transform'}`);

    let systemPrompt: string;

    if (isEnhance) {
      systemPrompt = `You are a masterful narrative embellisher.
ENHANCE existing prose by adding descriptive detail, atmosphere, and sensory language AROUND the original text.

${styleGuide}

CRITICAL RULES:
- PRESERVE every original sentence, paragraph, and piece of dialogue VERBATIM
- Do NOT rewrite, rephrase, or reorganize existing text
- Do NOT continue the story beyond what is written
- Do NOT remove any content from the original
- ALL original dialogue must remain word-for-word unchanged
- You MAY add new dialogue that is logical within the scene context, consistent with established character voices
- ADD descriptive prose BETWEEN existing paragraphs: sensory details, atmosphere, emotional beats, environmental descriptions
- PRESERVE all **bold** and *italic* markdown formatting in the original
- Maintain the author's voice and tone

${characterName ? `The main character or POV is: ${characterName}` : ''}
${contextBlocks}${customRulesSection}
Respond ONLY with the enhanced prose. No explanations, no meta-commentary.`;
    } else {
      systemPrompt = `You are a skilled narrative writer and editor who transforms TTRPG chat logs and AI-generated game sessions into polished prose fiction.

Your task is to:
1. REMOVE all game mechanics: dice rolls, stat checks, damage numbers, system-specific notation.
2. REMOVE out-of-character comments, system messages, and meta-gaming discussions.
3. REMOVE player/GM labels and formatting artifacts.
4. PRESERVE the core narrative: character dialogue, actions, descriptions, plot events, and emotional beats.
5. TRANSFORM the content into flowing prose narrative that reads like a novel excerpt.
6. ENHANCE descriptions to be more vivid and immersive while staying faithful to the original events.
7. MAINTAIN character voices and relationships as presented.
8. ENSURE smooth transitions between scenes and moments.

${styleGuide}

${characterName ? `The main character or POV is: ${characterName}` : ''}

Important: Do NOT add new plot elements or significantly change what happens. Your job is to transform the FORMAT from game log to prose, not to rewrite the story itself.
PRESERVE all **bold** and *italic* markdown formatting.
${contextBlocks}${customRulesSection}
Respond ONLY with the transformed prose narrative. No explanations, no meta-commentary.`;
    }

    const userMessage = isEnhance
      ? `Enhance this prose with rich descriptive detail while preserving every original word:\n\n${sanitizedText}`
      : `Transform this game chat into prose narrative:\n\n${sanitizedText}`;

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: requestedModel || 'google/gemini-3-pro-preview',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
        temperature: 0.7, max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      return new Response(JSON.stringify({ success: false, error: `AI processing failed: ${response.status}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const narrative = data.choices?.[0]?.message?.content || '';
    const usage = data.usage ?? {};

    console.log(`Narrative forge completed: ${narrative.length} chars output`);

    return new Response(
      JSON.stringify({ success: true, narrative, style, inputLength: validation.text.length, outputLength: narrative.length, usage: { input_tokens: usage.prompt_tokens ?? 0, output_tokens: usage.completion_tokens ?? 0 } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Narrative Forge error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
