// npc-build: Quick Build for the host's NPC Roster (Live NPCs).
// POST { partyId | practiceMode: true + practiceCharacter/practiceScene/practiceTakenNames, description?, useScene?, count?, role?, difficulty?, fight? }
// The AI writes each NPC's personality; build.ts computes balanced fight stats from the seated party.
// Nothing is saved here: the host reviews the drafts and creates them from the roster.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as B from './build.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODEL = 'google/gemini-2.5-flash';

/** One call to the Lovable AI gateway. Returns the text, or an error in plain words. */
async function askModel(key: string, system: string, user: string): Promise<{ ok: boolean; text?: string; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 6000, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], stream: false }),
      signal: controller.signal,
    });
    if (res.status === 402) return { ok: false, error: 'Lovable AI credits are out.' };
    if (res.status === 429) return { ok: false, error: 'The AI is busy. Try again in a moment.' };
    if (!res.ok) return { ok: false, error: `The AI returned an error (${res.status}).` };
    const out = await res.json();
    const content = out?.choices?.[0]?.message?.content;
    const textOut = typeof content === 'string' ? content
      : Array.isArray(content) ? content.map((c: { text?: string }) => c?.text || '').join('') : '';
    return { ok: true, text: textOut };
  } catch {
    return { ok: false, error: 'The AI took too long to answer. Try again.' };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')?.trim();
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(500, { error: 'Server configuration error.' });
  if (!LOVABLE_API_KEY) return json(500, { error: 'No Lovable AI key on the server.' });
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return json(401, { error: 'Sign in to build NPCs.' });
  const { data: authData, error: authError } = await db.auth.getUser(token);
  const userId = authData?.user?.id;
  if (authError || !userId) return json(401, { error: 'Sign in to build NPCs.' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'The request body must be JSON.' });
  }

  try {
    const practiceMode = body.practiceMode === true;
    const count = Math.min(4, Math.max(1, Math.round(Number(body.count) || 1)));
    const role: B.Role = B.ROLES.includes(body.role as B.Role) ? (body.role as B.Role) : 'fighter';
    const difficulty: B.Difficulty = B.DIFFICULTIES.includes(body.difficulty as B.Difficulty) ? (body.difficulty as B.Difficulty) : 'medium';
    const fight = body.fight !== false;
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 1500) : '';
    const useScene = body.useScene === true;

    let statRows: Array<{ character_status?: Record<string, unknown> | null }>;
    let scene: string;
    let world: string;
    let takenNames: string[];

    if (practiceMode) {
      // Arena practice: no party is read or changed; balance against the one practice character.
      if (!description && !useScene) return json(400, { error: 'Describe the NPCs, or use the current scene.' });
      const pc = (body.practiceCharacter && typeof body.practiceCharacter === 'object' ? body.practiceCharacter : {}) as Record<string, unknown>;
      const n = (v: unknown, f: number, lo: number, hi: number) => { const x = Number(v); return Math.min(hi, Math.max(lo, Number.isFinite(x) ? Math.round(x) : f)); };
      const pcName = typeof pc.name === 'string' ? pc.name.trim().slice(0, 60) : '';
      statRows = [{ character_status: { level: n(pc.level, 1, 1, 20), ac: n(pc.ac, 12, 5, 30), maxHP: n(pc.maxHP, 10, 1, 500) } }];
      scene = useScene && typeof body.practiceScene === 'string' ? body.practiceScene.replace(/<!--[\s\S]*?-->/g, '').trim().slice(-5000) : '';
      if (useScene && !scene && !description) return json(409, { error: 'There is no DM post to read yet. Describe the NPCs instead.' });
      world = '';
      takenNames = [
        ...(Array.isArray(body.practiceTakenNames) ? body.practiceTakenNames : []).filter((x): x is string => typeof x === 'string').map((x) => x.trim().slice(0, 60)),
        pcName,
      ].filter(Boolean).slice(0, 60);
    } else {
      const partyId = typeof body.partyId === 'string' && UUID_RE.test(body.partyId) ? body.partyId : null;
      if (!partyId) return json(400, { error: 'Missing party.' });
      const { data: party, error: partyError } = await db.from('parties').select('created_by').eq('id', partyId).maybeSingle();
      if (partyError) throw new Error(partyError.message);
      if (!party) return json(404, { error: 'Party not found.' });
      if (party.created_by !== userId) return json(403, { error: 'Only the host can build NPCs.' });
      if (!description && !useScene) return json(400, { error: 'Describe the NPCs, or use the current scene.' });

      const [members, npcs, guides, posts] = await Promise.all([
        db.from('party_members').select('character_name, character_status').eq('party_id', partyId),
        db.from('party_npcs').select('name').eq('party_id', partyId).eq('archived', false),
        db.from('gm_guides').select('name, content').eq('user_id', userId).eq('mode', 'party').eq('enabled', true)
          .order('created_at', { ascending: true }),
        useScene
          ? db.from('party_dm_messages').select('content, team, is_afk_marker')
            .eq('party_id', partyId).eq('role', 'assistant').eq('sender_name', 'DM')
            .order('created_at', { ascending: false }).limit(10)
          : Promise.resolve({ data: [], error: null }),
      ]);
      for (const r of [members, npcs, guides, posts]) if (r.error) throw new Error(r.error.message);

      const post = (posts.data ?? []).find((p: { team: string | null; is_afk_marker: boolean }) =>
        !p.is_afk_marker && !(p.team || '').startsWith('whisper:'));
      scene = typeof post?.content === 'string'
        ? post.content.replace(/<!--[\s\S]*?-->/g, '').replace(/\[\/?VOICE[^\]]*\]/g, '').trim().slice(-5000)
        : '';
      if (useScene && !scene && !description) return json(409, { error: 'There is no DM post to read yet. Describe the NPCs instead.' });
      world = (guides.data ?? [])
        .map((g: { name: string | null; content: string | null }) => `${g.name || 'Guide'}: ${g.content || ''}`)
        .join('\n\n').slice(0, 8000);
      takenNames = [
        ...(npcs.data ?? []).map((n: { name: string }) => n.name),
        ...(members.data ?? []).map((m: { character_name: string }) => m.character_name),
      ].filter(Boolean).slice(0, 60);
      statRows = (members.data ?? []) as Array<{ character_status?: Record<string, unknown> | null }>;
    }

    const request: B.BuildRequest = { description, count, role, difficulty, scene, world, takenNames };
    let drafts: B.NpcDraft[] = [];
    let lastError = 'The AI answer could not be read.';
    for (let attempt = 0; attempt < 2 && drafts.length === 0; attempt++) {
      const out = await askModel(LOVABLE_API_KEY, B.BUILD_SYSTEM, B.buildUserMessage(request));
      if (!out.ok) {
        lastError = out.error || lastError;
        continue;
      }
      drafts = B.parseDrafts(out.text || '', count);
    }
    if (drafts.length === 0) return json(502, { error: `${lastError} Try again.` });

    const partyNow = B.partyStats(statRows);
    const stats = fight ? B.npcStats(partyNow, difficulty, role, drafts.length) : null;
    return json(200, {
      party: partyNow,
      drafts: drafts.map(({ skills, ...d }) => ({
        ...d,
        combatStats: stats ? { ...stats, skills: B.finalSkills(skills, role, d.attack) } : null,
      })),
    });
  } catch (err) {
    console.error('[npc-build] failed:', err);
    return json(500, { error: 'The NPC builder had a problem. Try again in a moment.' });
  }
});
