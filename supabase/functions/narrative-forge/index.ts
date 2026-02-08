// Narrative Forge Edge Function
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Authenticate user and return user ID or error response
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

// Input validation constants
const MAX_TEXT_LENGTH = 15000;
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
  ratio: number; // 10-50, how much of secondary style to blend
}

interface PartialContext {
  precedingText: string;
  selectedText: string;
  followingText: string;
  instruction?: string;
}

interface RequestBody {
  text: string;
  characterName?: string;
  style?: string;
  smartParseEnabled?: boolean;
  customEditingRules?: CustomEditingRule[];
  blendConfig?: BlendConfig;
  mode?: 'full' | 'partial';
  partialContext?: PartialContext;
}

type ValidationResult = {
  valid: true;
  text: string;
  characterName: string | null;
  style: ValidStyle;
  smartParseEnabled: boolean;
  customEditingRules: CustomEditingRule[];
  blendConfig?: BlendConfig;
  mode: 'full' | 'partial';
  partialContext?: PartialContext;
} | {
  valid: false;
  error: string;
};

// Sanitize input to remove potential prompt injection patterns
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

// Smart parse: Extract only assistant/DM content from chat logs
// Filters out user/player messages marked with "user" or "User" labels
function extractAssistantContent(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inUserSection = false;
  let inAssistantSection = true; // Default to keeping content until we see a label
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim().toLowerCase();
    
    // Detect section markers
    // Match "user" or "**user**" at start of line (case insensitive)
    if (/^(\*\*)?user(\*\*)?:?\s*$/i.test(line.trim()) || 
        /^user\s*$/i.test(line.trim())) {
      inUserSection = true;
      inAssistantSection = false;
      continue; // Skip the label line itself
    }
    
    // Match "assistant" or "**assistant**" at start of line
    if (/^(\*\*)?assistant(\*\*)?:?\s*$/i.test(line.trim()) || 
        /^assistant\s*$/i.test(line.trim())) {
      inUserSection = false;
      inAssistantSection = true;
      continue; // Skip the label line itself
    }
    
    // Also detect inline patterns like "User: message" or "**User**: message"
    const userInlineMatch = line.match(/^(\*\*)?(user)(\*\*)?:\s*(.*)$/i);
    if (userInlineMatch) {
      // This is a user message, skip it
      continue;
    }
    
    const assistantInlineMatch = line.match(/^(\*\*)?(assistant)(\*\*)?:\s*(.*)$/i);
    if (assistantInlineMatch) {
      // Keep the content after "assistant:"
      result.push(assistantInlineMatch[4]);
      inUserSection = false;
      inAssistantSection = true;
      continue;
    }
    
    // Keep content if we're in an assistant section (or default section before any labels)
    if (inAssistantSection && !inUserSection) {
      result.push(line);
    }
  }
  
  // Clean up: remove excessive blank lines
  let cleaned = result.join('\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  
  return cleaned;
}

// Detect if text appears to be a chat log format (has user/assistant labels)
function isChatLogFormat(text: string): boolean {
  const lowerText = text.toLowerCase();
  // Check for typical chat log markers
  const hasUserLabel = /\buser\b\s*$/im.test(text) || /^\*\*user\*\*\s*$/im.test(text);
  const hasAssistantLabel = /\bassistant\b\s*$/im.test(text) || /^\*\*assistant\*\*\s*$/im.test(text);
  
  return hasUserLabel || hasAssistantLabel;
}

// Sanitize character name - only allow alphanumeric, spaces, and common name characters
function sanitizeCharacterName(name: string): string {
  // Allow letters (including accented), numbers, spaces, hyphens, apostrophes
  return name.replace(/[^a-zA-ZÀ-ÿ0-9\s\-']/g, '').trim();
}

// Validate custom editing rules
const MAX_EDITING_RULES = 10;
const MAX_RULE_LENGTH = 200;

function validateEditingRules(rules: unknown): CustomEditingRule[] {
  if (!rules || !Array.isArray(rules)) return [];
  
  const validatedRules: CustomEditingRule[] = [];
  
  for (const rule of rules.slice(0, MAX_EDITING_RULES)) {
    if (!rule || typeof rule !== 'object') continue;
    
    const { type, instruction, scope } = rule as CustomEditingRule;
    
    if (typeof instruction !== 'string' || instruction.length === 0) continue;
    if (instruction.length > MAX_RULE_LENGTH) continue;
    
    // Sanitize the instruction
    const sanitizedInstruction = sanitizeInput(instruction);
    
    validatedRules.push({
      type: typeof type === 'string' ? type : 'custom',
      instruction: sanitizedInstruction,
      scope: typeof scope === 'string' ? scope : 'all',
    });
  }
  
  return validatedRules;
}

// Validate blend config
function validateBlendConfig(config: unknown): BlendConfig | undefined {
  if (!config || typeof config !== 'object') return undefined;
  
  const { secondaryStyle, ratio } = config as BlendConfig;
  
  if (typeof secondaryStyle !== 'string' || !VALID_STYLES.includes(secondaryStyle as ValidStyle)) {
    return undefined;
  }
  
  if (typeof ratio !== 'number' || ratio < 10 || ratio > 50) {
    return undefined;
  }
  
  return { secondaryStyle, ratio };
}

// Validate partial context for partial regeneration
function validatePartialContext(context: unknown): PartialContext | null {
  if (!context || typeof context !== 'object') return null;
  
  const { precedingText, selectedText, followingText, instruction } = context as PartialContext;
  
  if (typeof selectedText !== 'string' || selectedText.length < 5) {
    return null;
  }
  
  return {
    precedingText: typeof precedingText === 'string' ? sanitizeInput(precedingText) : '',
    selectedText: sanitizeInput(selectedText),
    followingText: typeof followingText === 'string' ? sanitizeInput(followingText) : '',
    instruction: typeof instruction === 'string' ? sanitizeInput(instruction.slice(0, 200)) : undefined,
  };
}

// Validate request body
function validateRequestBody(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }
  
  const { text, characterName, style, smartParseEnabled, customEditingRules, blendConfig, mode, partialContext } = body as RequestBody;
  
  // Determine mode
  const validatedMode = mode === 'partial' ? 'partial' : 'full';
  
  // For partial mode, validate partial context instead of text
  if (validatedMode === 'partial') {
    const validatedPartialContext = validatePartialContext(partialContext);
    if (!validatedPartialContext) {
      return { valid: false, error: 'Invalid partial context for partial regeneration' };
    }
    
    // Validate style
    let validatedStyle: ValidStyle = 'fantasy';
    if (style !== undefined && style !== null && typeof style === 'string') {
      if (VALID_STYLES.includes(style as ValidStyle)) {
        validatedStyle = style as ValidStyle;
      }
    }
    
    return {
      valid: true,
      text: '', // Not used in partial mode
      characterName: characterName ? sanitizeCharacterName(String(characterName)) : null,
      style: validatedStyle,
      smartParseEnabled: false,
      customEditingRules: [],
      mode: 'partial',
      partialContext: validatedPartialContext,
    };
  }
  
  // Full mode validation (existing logic)
  if (text === undefined || text === null) {
    return { valid: false, error: 'Missing text parameter' };
  }
  
  if (typeof text !== 'string') {
    return { valid: false, error: 'text must be a string' };
  }
  
  if (text.length < MIN_TEXT_LENGTH) {
    return { valid: false, error: `text must be at least ${MIN_TEXT_LENGTH} characters` };
  }
  
  if (text.length > MAX_TEXT_LENGTH) {
    return { valid: false, error: `text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` };
  }
  
  // Validate style
  let validatedStyle: ValidStyle = 'fantasy';
  if (style !== undefined && style !== null) {
    if (typeof style !== 'string') {
      return { valid: false, error: 'style must be a string' };
    }
    
    if (!VALID_STYLES.includes(style as ValidStyle)) {
      return { 
        valid: false, 
        error: `Invalid style. Must be one of: ${VALID_STYLES.join(', ')}` 
      };
    }
    
    validatedStyle = style as ValidStyle;
  }
  
  // Validate characterName
  let validatedCharacterName: string | null = null;
  if (characterName !== undefined && characterName !== null) {
    if (typeof characterName !== 'string') {
      return { valid: false, error: 'characterName must be a string' };
    }
    
    if (characterName.length > MAX_CHARACTER_NAME_LENGTH) {
      return { 
        valid: false, 
        error: `characterName exceeds maximum length of ${MAX_CHARACTER_NAME_LENGTH} characters` 
      };
    }
    
    const sanitizedName = sanitizeCharacterName(characterName);
    if (sanitizedName.length > 0) {
      validatedCharacterName = sanitizedName;
    }
  }
  
  // Validate custom editing rules
  const validatedRules = validateEditingRules(customEditingRules);
  
  // Validate blend config
  const validatedBlendConfig = validateBlendConfig(blendConfig);
  
  return {
    valid: true,
    text,
    characterName: validatedCharacterName,
    style: validatedStyle,
    smartParseEnabled: smartParseEnabled !== false, // Default to true
    customEditingRules: validatedRules,
    blendConfig: validatedBlendConfig,
    mode: 'full',
  };
}

const styleGuides: Record<ValidStyle, string> = {
  fantasy: `Write in a rich, evocative fantasy style with vivid descriptions of magic, ancient places, 
    and heroic deeds. Use dramatic language befitting epic tales. Include sensory details about 
    mystical energies, enchanted locations, and the weight of legendary moments.`,
  
  noir: `Write in a hardboiled noir style - short, punchy sentences. The world is dark, cynical, 
    and full of shadows. Characters are tough and world-weary. Use urban imagery, smoky atmospheres, 
    and a sense that everyone has an angle they're playing.`,
  
  literary: `Write in a thoughtful, literary style with attention to character psychology and 
    thematic depth. Use metaphor and symbolism where appropriate. Focus on internal motivations 
    and the emotional weight of moments. Prose should flow with careful rhythm.`,
  
  action: `Write in a fast-paced, cinematic action style. Short paragraphs, punchy verbs, and 
    visceral impact. Think action movie - explosions, quips, and momentum. Every sentence should 
    drive forward with energy and intensity.`,

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
- Poetic sentence rhythm with action beats

FORBIDDEN:
- Generic "he attacked" phrasing
- Combat without emotional context
- Ignoring weapon/armor significance
- Cynicism about heroism`,

  deadpool: `Write in Deadpool's fourth-wall-breaking style.

CORE PRINCIPLES:
- CONSTANT fourth-wall breaks addressing "you" (the reader)
- Pop culture references even when anachronistic
- Self-aware mockery of fantasy tropes and D&D mechanics
- Parenthetical asides interrupt serious moments
- Violence described in cartoonishly graphic detail
- Inappropriate humor at the worst possible timing

MANDATORY ELEMENTS:
- Direct reader address at least once per paragraph
- (Parenthetical commentary on the action like this)
- Reference to "the writer," "the DM," or "plot armor"
- Movie/comic/meme references
- Acknowledge dice rolls or game mechanics meta-textually
- Visual sound effects: THWACK, SLICE, BOOM, etc.

FORBIDDEN:
- Playing anything completely straight without commentary
- Serious emotional moments without undercutting
- Ignoring the absurdity of D&D mechanics`,

  dark_comedy: `Write in a dark comedy style - tragedy played for laughs.

CORE PRINCIPLES:
- SARDONIC NARRATOR voice with cosmic detachment
- Tragedy described with UNDERSTATED dryness
- Murphy's Law as narrative engine - everything gets worse
- Characters make terrible choices, narrated matter-of-factly
- Death/failure treated with gallows humor timing
- Tone: Douglas Adams meets Lemony Snicket meets Terry Pratchett's Death

MANDATORY ELEMENTS:
- Narrator commentary on the futility/irony of actions
- Understated phrasing for horrible events ("mildly inconvenient" death)
- Foreshadowing of doom delivered casually
- Cosmic indifference to character suffering
- Dry wit in sentence structure

FORBIDDEN:
- Slapstick or silly comedy (this is DARK comedy)
- Happy outcomes without ironic cost
- Sympathetic narrator tone`,

  subtle_absurdity: `Write in a subtly absurd style - Kafka meets D&D.

CORE PRINCIPLES:
- BUREAUCRATIC/CLINICAL language for impossible events
- Deadpan delivery with ZERO acknowledgment of weirdness
- Mundane reactions to cosmic horror and magic
- Characters treat the bizarre as routine administrative procedure
- Forms, protocols, and regulations for the impossible

MANDATORY ELEMENTS:
- Formal/technical language for magic and violence
- No exclamation points or emotional language
- Treat physics violations as clerical matters
- Reference forms, protocols, or regulations for the impossible
- Understatement to the point of absurdity

FORBIDDEN:
- Acknowledging anything is strange
- Emotional reactions
- Colorful adjectives
- Excitement or urgency in tone`,

  lovecraftian: `Write in Lovecraftian cosmic horror style.

CORE PRINCIPLES:
- COSMIC DREAD and insignificance of mortals
- Knowledge itself is CORRUPTING and MADDENING
- Entities described through what they're NOT (indescribable, non-Euclidean)
- Escalating paranoia and sanity erosion
- Archaic prose with subordinate clauses and antiquated vocabulary
- Existential terror > physical danger

MANDATORY ELEMENTS:
- Archaic language: "eldritch," "blasphemous," "cyclopean," "gibbous," "squamous"
- Describe entities as "defying geometry" or "beyond comprehension"
- Sanity/mental state deterioration noted
- References to forbidden knowledge or ancient texts
- Atmosphere of WRONGNESS pervading descriptions
- Long, winding sentences with subordinate clauses

FORBIDDEN:
- Direct, clear descriptions of monsters
- Heroic confidence or triumph
- Modern casual language
- Physical combat without psychological cost`,

  gonzo: `Write in Hunter S. Thompson's Gonzo Journalism style.

CORE PRINCIPLES:
- STREAM-OF-CONSCIOUSNESS frantic energy
- Unreliable narrator admitting to altered states
- Savage social commentary embedded in chaos
- Tangents that spiral into philosophy/paranoia
- "Too weird to live, too rare to die" energy
- Present-tense immediacy with visceral detail

MANDATORY ELEMENTS:
- First-person perspective (adapt even third-person to this voice)
- References to exhaustion, sensory overload, or altered consciousness
- Sudden philosophical tangents mid-action
- Savage descriptors for people/creatures
- Paranoid observations about power structures
- Sentence fragments. Rapid fire. Like this.

FORBIDDEN:
- Calm, measured prose
- Objective third-person distance
- Lack of personal voice
- Pretending the narrator is reliable`,

  hemingway: `Write in Ernest Hemingway's minimalist style.

CORE PRINCIPLES:
- SHORT, DECLARATIVE SENTENCES (subject-verb-object)
- NO ADVERBS (never "quickly ran" - just "ran")
- Iceberg theory: SUBTEXT over text (90% unsaid)
- Understated emotion (show through action, not description)
- Focus on PHYSICAL, CONCRETE details
- "True sentences" - every word earns its place

MANDATORY ELEMENTS:
- Sentences averaging 10 words or fewer
- Action verbs without modifiers
- Emotional weight conveyed through what's NOT said
- Dialogue without attributions when possible ("he said" only)
- Physical sensations over abstract feelings
- Repetition for emphasis (not variety)

FORBIDDEN:
- Adverbs (-ly words)
- Flowery adjectives
- Explaining emotions directly
- Complex subordinate clauses
- Metaphors (unless stark and simple)`,
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate request
    const authResult = await authenticateRequest(req);
    if ('error' in authResult) {
      return authResult.error;
    }
    const userId = authResult.userId;
    console.log(`Authenticated request from user: ${userId.slice(0, 8)}...`);
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      console.error('Invalid JSON in request body');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const validation = validateRequestBody(body);
    if (!validation.valid) {
      console.error('Validation failed:', validation.error);
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { characterName, style, smartParseEnabled, customEditingRules, blendConfig, mode, partialContext } = validation;
    
    // Handle partial regeneration mode
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

Respond ONLY with the rewritten text. No explanations, no meta-commentary. The output should slot seamlessly into the surrounding context.`;

      const partialUserPrompt = `CONTEXT (text that comes BEFORE the section to rewrite):
---
${partialContext.precedingText || '[Beginning of text]'}
---

TEXT TO REWRITE:
---
${partialContext.selectedText}
---

CONTEXT (text that comes AFTER the section to rewrite):
---
${partialContext.followingText || '[End of text]'}
---

Rewrite the middle section while maintaining perfect continuity with the surrounding context.`;

      const response = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: partialSystemPrompt },
            { role: 'user', content: partialUserPrompt },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI Gateway error:', response.status, errorText);
        return new Response(
          JSON.stringify({ success: false, error: `AI processing failed: ${response.status}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const narrative = data.choices?.[0]?.message?.content || '';

      console.log(`Partial regeneration completed: ${narrative.length} chars output`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          narrative,
          mode: 'partial',
          style,
          inputLength: partialContext.selectedText.length,
          outputLength: narrative.length,
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Full mode: Sanitize text input to prevent prompt injection
    let sanitizedText = sanitizeInput(validation.text);
    
    // Smart parse: detect chat log format and extract only assistant content (if enabled)
    if (smartParseEnabled) {
      const isChatFormat = isChatLogFormat(sanitizedText);
      if (isChatFormat) {
        console.log('Smart parse enabled - extracting assistant content only');
        sanitizedText = extractAssistantContent(sanitizedText);
        console.log(`After smart parse: ${sanitizedText.length} chars (filtered from ${validation.text.length})`);
      }
    } else {
      console.log('Smart parse disabled - including all content');
    }
    
    // Build style guide - either single style or blended
    let styleGuide: string;
    if (blendConfig) {
      const primaryRatio = 100 - blendConfig.ratio;
      const primaryGuide = styleGuides[style];
      const secondaryGuide = styleGuides[blendConfig.secondaryStyle as ValidStyle];
      
      styleGuide = `
STYLE BLENDING INSTRUCTIONS:
You will blend TWO narrative styles in your writing.

PRIMARY STYLE (${primaryRatio}% weight - favor this style):
${primaryGuide}

SECONDARY STYLE (${blendConfig.ratio}% weight - incorporate elements of this):
${secondaryGuide}

BLENDING APPROACH:
- Use the primary style as your foundation for tone, vocabulary, and structure
- Weave in distinctive elements from the secondary style (characteristic phrases, specific techniques)
- The blend should feel natural, not jarring - like a skilled author who has absorbed multiple influences
- When styles conflict, favor the primary style
`;
      console.log(`Style blending: ${primaryRatio}% ${style} + ${blendConfig.ratio}% ${blendConfig.secondaryStyle}`);
    } else {
      styleGuide = styleGuides[style];
    }

    console.log(`Processing narrative forge request: ${sanitizedText.length} chars, style: ${style}, rules: ${customEditingRules.length}, blended: ${!!blendConfig}`);

    // Build custom editing rules section for the prompt
    let customRulesSection = '';
    if (customEditingRules.length > 0) {
      const rulesText = customEditingRules
        .map((r, i) => {
          const scopeLabel = r.scope !== 'all' ? ` [SCOPE: ${r.scope.toUpperCase()}]` : '';
          return `${i + 1}.${scopeLabel} ${r.instruction}`;
        })
        .join('\n');
      
      customRulesSection = `

<user_editing_rules>
Apply these specific editing rules during transformation:
${rulesText}

Important: Apply each rule exactly as stated. Do not creatively interpret or extend beyond the literal instruction.
</user_editing_rules>`;
    }

    const systemPrompt = `You are a skilled narrative writer and editor who transforms TTRPG (tabletop role-playing game) 
chat logs and AI-generated game sessions into polished prose fiction.

Your task is to:
1. REMOVE all game mechanics: dice rolls (d20, 2d6+3), stat checks (DC 15, STR 18), damage numbers, 
   action economy terms (bonus action, reaction), and system-specific notation.
2. REMOVE out-of-character (OOC) comments, system messages, and meta-gaming discussions.
3. REMOVE player/GM labels and formatting artifacts.
4. PRESERVE the core narrative: character dialogue, actions, descriptions, plot events, and emotional beats.
5. TRANSFORM the content into flowing prose narrative that reads like a novel excerpt.
6. ENHANCE descriptions to be more vivid and immersive while staying faithful to the original events.
7. MAINTAIN character voices and relationships as presented.
8. ENSURE smooth transitions between scenes and moments.

${styleGuide}

${characterName ? `The main character or POV is: ${characterName}` : ''}

Important: Do NOT add new plot elements or significantly change what happens. Your job is to 
transform the FORMAT from game log to prose, not to rewrite the story itself.
${customRulesSection}
Respond ONLY with the transformed prose narrative. No explanations, no meta-commentary.`;

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Transform this game chat into prose narrative:\n\n${sanitizedText}` },
        ],
        temperature: 0.7,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `AI processing failed: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const narrative = data.choices?.[0]?.message?.content || '';

    console.log(`Narrative forge completed: ${narrative.length} chars output`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        narrative,
        style,
        inputLength: validation.text.length,
        outputLength: narrative.length,
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Narrative Forge error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
