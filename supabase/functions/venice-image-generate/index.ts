// venice-image-generate: signed-in image generation through Venice (key stays on the server).
// POST { mode: 'player-portrait'|'npc-portrait'|'dm-scene', prompt, partyId, npcId?, messageId? }
// -> { imageUrl, finalPrompt, path }
// player-portrait: seated member (or host) for their own portrait. npc/dm-scene: host or co-host.
// Stored in the public party-chat-images bucket under generated/<partyId>/<mode folder>/.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const uuid = z.string().uuid();
const Body = z.object({
  mode: z.enum(['player-portrait', 'npc-portrait', 'dm-scene']),
  prompt: z.string().min(1).max(4000).optional(),
  partyId: uuid,
  npcId: uuid.optional(),
  messageId: uuid.optional(),
});

const FOLDERS = { 'player-portrait': 'player-portraits', 'npc-portrait': 'npc-portraits', 'dm-scene': 'dm-scenes' } as const;
const BUCKET = 'party-chat-images';
const MAX_PROMPT = 1500;
const MAX_SCENE_SOURCE = 12000;
const DIRECTOR_MODEL = 'qwen-3-6-plus';
const STORY_SCENE_SENDER = 'Scene';

const DIRECTOR_SYSTEM = `You are a Scene Director turning a tabletop RPG narration into ONE image-generation prompt.
Rules:
- Return ONLY the finished image prompt. No explanation, headings, JSON or markdown.
- Select ONE coherent cinematic moment that is actually happening in the narration. Never a montage; never combine separate locations or times.
- Ignore meta/table commentary, game mechanics, travel-control explanations, jokes to players and any closing "what do you do?" choices.
- Prefer the most visually important active beat, especially a meaningful interaction involving the player characters.
- Named player characters present in the chosen moment are the primary subjects; do not let incidental clerks, merchants, guards or scenery replace them unless the scene genuinely centers on those NPCs.
- Use the CHARACTER CONTINUITY block to preserve each player's identity, species/body form and recognizable gear. Never invent a different form because a generic fantasy image would be easier. Example: if a character is a Pegasus in true form and the scene does not say she changed to human form, depict her as a Pegasus companion, not a woman, ordinary horse or mount.
- Respect relationship framing: a companion is not automatically a mount, servant or possession.
- Include only NPCs who are part of the selected beat. Infer their look from the narration only; do not invent elaborate details.
- Preserve the exact location, time of day, weather and important environmental story clues of that beat.
- Describe concrete visible action and staging: who is in the foreground, what each focal subject is doing, important props, and what is in the background.
- Compose for a square 1:1 frame with a clear focal point.
- Cinematic dark-fantasy realism, but let the scene set the mood rather than forcing gloom.
- No readable text, captions, UI, speech bubbles, watermarks, or signs as focal content.
- Never depict future options or events that have not happened.
- About 100-180 words of dense visual direction, not story prose.`;

function cleanScene(raw: string): string {
  return raw
    .replace(/\[TABLE\][\s\S]*?(\[\/TABLE\]|$)/gi, ' ')
    .replace(/\[VOICE:\s*([^\]]+)\]([\s\S]*?)\[\/VOICE\]/gi, (_m, name, words) => `${String(name).trim()} says: "${String(words).trim()}"`)
    .replace(/\[[A-Z_][A-Z0-9_ -]*(:[^\]]*)?\]/g, ' ')
    .replace(/\[\/[A-Z_][A-Z0-9_ -]*\]/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_#>`]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_SCENE_SOURCE);
}

const str = (v: unknown, cap = 200): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, cap) : '');

function continuityLine(cs: any): string {
  if (!cs || typeof cs !== 'object') return '';
  const name = str(cs.characterName || cs.name, 60);
  if (!name) return '';
  const parts: string[] = [];
  const race = str(cs.race || cs.species, 60); if (race) parts.push(`species: ${race}`);
  const cls = str(cs.className || cs.characterClass || cs.class, 60); if (cls) parts.push(`class: ${cls}`);
  const look = str(cs.appearance || cs.physicalDescription || cs.description, 300); if (look) parts.push(`appearance: ${look}`);
  const back = str(cs.backstory, 300); if (back) parts.push(`identity: ${back}`);
  const gearSrc = Array.isArray(cs.equippedGear) ? cs.equippedGear : Array.isArray(cs.equipment) ? cs.equipment : [];
  const gear = gearSrc.map((g: any) => str(typeof g === 'string' ? g : g?.name, 40)).filter(Boolean).slice(0, 8);
  if (gear.length) parts.push(`gear: ${gear.join(', ')}`);
  return `- ${name}${parts.length ? ' — ' + parts.join('; ') : ''}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });

  const URL_ = Deno.env.get('SUPABASE_URL');
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const VENICE = Deno.env.get('VENICE_API_KEY');
  if (!URL_ || !SERVICE || !VENICE) return json(500, { error: 'Server configuration error.' });
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'Sign in required.' });
  const { data: u, error: authErr } = await db.auth.getUser(token);
  const userId = u?.user?.id;
  if (authErr || !userId) return json(401, { error: 'Sign in required.' });

  let raw: unknown;
  try { raw = await req.json(); } catch { return json(400, { error: 'Invalid JSON.' }); }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json(400, { error: parsed.error.flatten().fieldErrors });
  const { mode, prompt, partyId, npcId, messageId } = parsed.data;

  // Permissions
  const { data: party } = await db.from('parties').select('id, created_by, is_active').eq('id', partyId).maybeSingle();
  if (!party || party.is_active === false) return json(404, { error: 'Party not found.' });
  const isHost = party.created_by === userId;
  let isCoHost = false;
  if (!isHost) {
    const { data: co } = await db.from('party_shared_state').select('state_data')
      .eq('party_id', partyId).eq('state_type', 'co_hosts').limit(5);
    isCoHost = (co || []).some((r: any) => Array.isArray(r?.state_data?.userIds) && r.state_data.userIds.includes(userId));
  }
  if (mode === 'player-portrait') {
    if (!isHost) {
      const { data: seat } = await db.from('party_members').select('id')
        .eq('party_id', partyId).eq('user_id', userId).limit(1).maybeSingle();
      if (!seat) return json(403, { error: 'Only seated party members can generate their portrait.' });
    }
  } else if (!isHost && !isCoHost) {
    return json(403, { error: 'Only the host or a co-host can do that.' });
  }

  let finalPrompt = '';
  if (mode === 'dm-scene') {
    if (!messageId) return json(400, { error: 'messageId is required for scene images.' });
    const { data: post } = await db.from('party_dm_messages')
      .select('id, role, content, sender_name, is_afk_marker')
      .eq('id', messageId).eq('party_id', partyId).maybeSingle();
    if (!post || post.role !== 'assistant' || post.is_afk_marker || post.sender_name === STORY_SCENE_SENDER) {
      return json(400, { error: 'Only DM story posts can be illustrated.' });
    }
    const scene = cleanScene(String(post.content || ''));
    if (!scene) return json(400, { error: 'This post has no scene to illustrate.' });

    const { data: roster } = await db.from('party_members').select('character_status').eq('party_id', partyId).limit(8);
    const lines = (roster || []).map((r: any) => continuityLine(r?.character_status)).filter(Boolean);
    const continuity = lines.length ? lines.join('\n') : '- (no stored player details)';

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      let res: Response;
      try {
        res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${VENICE}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: DIRECTOR_MODEL,
            max_tokens: 400,
            temperature: 0.3,
            messages: [
              { role: 'system', content: DIRECTOR_SYSTEM },
              { role: 'user', content: `CHARACTER CONTINUITY (player characters):\n${continuity}\n\nDM NARRATION:\n${scene}` },
            ],
            stream: false,
            venice_parameters: { include_venice_system_prompt: false, strip_thinking_response: true, disable_thinking: true, enable_web_search: 'off' },
          }),
          signal: controller.signal,
        });
      } finally { clearTimeout(timer); }
      if (!res.ok) {
        console.error('[venice-image] director error', res.status);
        return json(502, { error: 'Could not plan the scene image. Try again shortly.' });
      }
      const d = await res.json();
      const c = d?.choices?.[0]?.message?.content;
      const text = typeof c === 'string' ? c : Array.isArray(c) ? c.map((p: any) => p?.text || '').join('') : '';
      finalPrompt = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^```\w*|```$/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_PROMPT);
    } catch (e) {
      console.error('[venice-image] director failed', e);
      return json(502, { error: 'Could not plan the scene image. Try again shortly.' });
    }
    if (finalPrompt.length < 40) return json(502, { error: 'Could not plan the scene image. Try again shortly.' });
  } else {
    if (!prompt) return json(400, { error: 'Prompt is required.' });
    finalPrompt = prompt.replace(/\s+/g, ' ').trim().slice(0, MAX_PROMPT);
    // NPC portraits fill the wide Talk to card (21:9): keep the character centered so small round avatars crop well.
    if (mode === 'npc-portrait') finalPrompt = `${finalPrompt} Wide banner framing: the character centered, head and shoulders in the middle of the frame.`;
    if (!finalPrompt) return json(400, { error: 'Prompt is empty.' });
  }

  // Venice
  let b64: string | undefined;
  try {
    const res = await fetch('https://api.venice.ai/api/v1/image/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${VENICE}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'recraft-v4-pro', prompt: finalPrompt, style_preset: 'Cinematic',
        ...(mode === 'npc-portrait' ? { aspect_ratio: '21:9' } : { aspect_ratio: '1:1', width: 1024, height: 1024 }),
        format: 'png', return_binary: false, safe_mode: false,
      }),
    });
    if (!res.ok) {
      console.error('[venice-image] Venice error', res.status, (await res.text()).slice(0, 300));
      return json(502, { error: 'Image generation failed. Try again shortly.' });
    }
    const data = await res.json();
    b64 = data?.images?.[0];
  } catch (e) {
    console.error('[venice-image] fetch failed', e);
    return json(502, { error: 'Image generation failed. Try again shortly.' });
  }
  if (!b64) return json(502, { error: 'No image was returned.' });

  const bytes = Uint8Array.from(atob(b64.replace(/^data:[^,]+,/, '')), (c) => c.charCodeAt(0));
  const owner = mode === 'player-portrait' ? userId : mode === 'npc-portrait' ? (npcId ?? 'unassigned') : (messageId ?? 'unassigned');
  const path = `generated/${partyId}/${FOLDERS[mode]}/${owner}/${crypto.randomUUID()}.png`;
  const { error: upErr } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/png' });
  if (upErr) { console.error('[venice-image] upload', upErr.message); return json(500, { error: 'Could not store the image.' }); }
  const imageUrl = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  return json(200, { imageUrl, finalPrompt, path });
});
