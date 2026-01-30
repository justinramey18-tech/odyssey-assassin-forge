// Narrative Forge Edge Function

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Input validation constants
const MAX_TEXT_LENGTH = 15000;
const MIN_TEXT_LENGTH = 10;
const MAX_CHARACTER_NAME_LENGTH = 100;
const VALID_STYLES = ['fantasy', 'noir', 'literary', 'action'] as const;

type ValidStyle = typeof VALID_STYLES[number];

interface RequestBody {
  text: string;
  characterName?: string;
  style?: string;
}

type ValidationResult = {
  valid: true;
  text: string;
  characterName: string | null;
  style: ValidStyle;
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

// Sanitize character name - only allow alphanumeric, spaces, and common name characters
function sanitizeCharacterName(name: string): string {
  // Allow letters (including accented), numbers, spaces, hyphens, apostrophes
  return name.replace(/[^a-zA-ZÀ-ÿ0-9\s\-']/g, '').trim();
}

// Validate request body
function validateRequestBody(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }
  
  const { text, characterName, style } = body as RequestBody;
  
  // Validate text
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
  
  return {
    valid: true,
    text,
    characterName: validatedCharacterName,
    style: validatedStyle,
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
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Sanitize text input to prevent prompt injection
    const sanitizedText = sanitizeInput(validation.text);
    const { characterName, style } = validation;
    
    const styleGuide = styleGuides[style];

    console.log(`Processing narrative forge request: ${sanitizedText.length} chars, style: ${style}`);

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
