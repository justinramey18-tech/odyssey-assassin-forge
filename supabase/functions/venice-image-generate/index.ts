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
  prompt: z.string().min(1).max(4000),
  partyId: uuid,
  npcId: uuid.optional(),
  messageId: uuid.optional(),
});

const FOLDERS = { 'player-portrait': 'player-portraits', 'npc-portrait': 'npc-portraits', 'dm-scene': 'dm-scenes' } as const;
const BUCKET = 'party-chat-images';
const MAX_PROMPT = 1500;

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

  if (mode === 'dm-scene' && messageId) {
    const { data: msg } = await db.from('party_dm_messages').select('id').eq('id', messageId).eq('party_id', partyId).maybeSingle();
    if (!msg) return json(404, { error: 'Message not found in this party.' });
  }

  const finalPrompt = prompt.replace(/\s+/g, ' ').trim().slice(0, MAX_PROMPT);
  if (!finalPrompt) return json(400, { error: 'Prompt is empty.' });

  // Venice
  let b64: string | undefined;
  try {
    const res = await fetch('https://api.venice.ai/api/v1/image/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${VENICE}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'recraft-v4-pro', prompt: finalPrompt, style_preset: 'Cinematic',
        aspect_ratio: '1:1', width: 1024, height: 1024, format: 'png', return_binary: false, safe_mode: false,
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
