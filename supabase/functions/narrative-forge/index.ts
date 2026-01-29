// Narrative Forge Edge Function

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  text: string;
  characterName?: string;
  style?: 'fantasy' | 'noir' | 'literary' | 'action';
}

const styleGuides: Record<string, string> = {
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
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { text, characterName, style = 'fantasy' }: RequestBody = await req.json();

    if (!text || typeof text !== 'string') {
      throw new Error('Text input is required');
    }

    // Truncate very long inputs to prevent token limits
    const truncatedText = text.slice(0, 15000);
    
    const styleGuide = styleGuides[style] || styleGuides.fantasy;

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
          { role: 'user', content: `Transform this game chat into prose narrative:\n\n${truncatedText}` },
        ],
        temperature: 0.7,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', errorText);
      throw new Error(`AI processing failed: ${response.status}`);
    }

    const data = await response.json();
    const narrative = data.choices?.[0]?.message?.content || '';

    return new Response(
      JSON.stringify({ 
        success: true, 
        narrative,
        style,
        inputLength: text.length,
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
