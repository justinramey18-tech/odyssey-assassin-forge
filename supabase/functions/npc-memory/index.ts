// npc-memory (Live NPCs v2, D-22): after a Send to DM, each NPC in the handed-off lines
// remembers the scene (up to 3 short notes) and may warm up or cool down one step toward
// characters in it. Runs on the server with the service role; never changes HP, gold,
// items or quests.
//
// POST { lineIds: string[] }   the NPC lines that were just handed to the DM (max 40)
//
// v3: also opens and closes unfinished business, saves what the NPC said about itself,
// marks names it learned, records when it last spoke with each character, and lets
// feelings fade without contact before applying new changes.
//
// The caller must be signed in and seated at the table (or be the host). Each NPC line is
// remembered once: a retried hand-off is ignored. If the AI fails, nothing is saved and
// the lines can be remembered on the next try.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createModelCaller } from './models.ts';
import { tableText } from './prompt.ts';
import { MAX_AI_NOTES, MAX_SELF_FACTS, MAX_THREADS, buildMemoryPrompt, fadeAttitude, parseMemoryUpdate, shiftAttitude } from './memory.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Cheap and good at JSON; the NPC's usual model is the backup. */
const MEMORY_MODEL = 'google/gemini-2.5-flash';
const MEMORY_BACKUP = 'venice/qwen-3-6-plus';
const MAX_NPCS = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(500, { error: 'Server configuration error.' });
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
  if (!token) return json(401, { error: 'Sign in first.' });
  const { data: authData, error: authError } = await db.auth.getUser(token);
  const userId = authData?.user?.id;
  if (authError || !userId) return json(401, { error: 'Sign in first.' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'The request body must be JSON.' });
  }
  const lineIds = Array.isArray(body.lineIds)
    ? Array.from(new Set(body.lineIds.filter((x): x is string => typeof x === 'string' && UUID_RE.test(x)))).slice(0, 40)
    : [];
  if (lineIds.length === 0) return json(400, { error: 'No NPC lines to remember.' });

  const callModel = createModelCaller({
    VENICE_API_KEY: Deno.env.get('VENICE_API_KEY'),
    LOVABLE_API_KEY: Deno.env.get('LOVABLE_API_KEY'),
    ANTHROPIC_API_KEY: Deno.env.get('ANTHROPIC_API_KEY'),
  });

  try {
    const { data: lines, error: linesErr } = await db.from('party_round_chat')
      .select('id, party_id, npc_id, created_at').in('id', lineIds).not('npc_id', 'is', null);
    if (linesErr) throw new Error(`read lines: ${linesErr.message}`);
    if (!lines || lines.length === 0) return json(200, { ok: true, results: [], note: 'No NPC lines found.' });

    const partyId = lines[0].party_id as string;
    const mine = lines.filter((l: { party_id: string }) => l.party_id === partyId);

    const [{ data: party }, { data: seat }] = await Promise.all([
      db.from('parties').select('created_by').eq('id', partyId).maybeSingle(),
      db.from('party_members').select('user_id').eq('party_id', partyId).eq('user_id', userId).limit(1),
    ]);
    const hostId = party?.created_by as string | undefined;
    if (!hostId) return json(404, { error: 'Party not found.' });
    if (hostId !== userId && !(Array.isArray(seat) && seat.length > 0)) return json(403, { error: "You're not seated at this table." });

    const { data: seats } = await db.from('party_members').select('user_id, character_name').eq('party_id', partyId);
    const seated = (seats ?? []).filter((s: { character_name: string | null }) => (s.character_name || '').trim()) as Array<{ user_id: string; character_name: string }>;

    const byNpc = new Map<string, Array<{ id: string; created_at: string }>>();
    for (const l of mine) {
      const list = byNpc.get(l.npc_id) ?? [];
      list.push({ id: l.id, created_at: l.created_at });
      byNpc.set(l.npc_id, list);
    }

    const results: Array<Record<string, unknown>> = [];
    const failed: Array<{ npc: string; error: string }> = [];

    for (const [npcId, npcLines] of Array.from(byNpc.entries()).slice(0, MAX_NPCS)) {
      const { data: npc } = await db.from('party_npcs').select('id, name, model').eq('id', npcId).maybeSingle();
      if (!npc) continue;

      // Each NPC line is remembered once. Only lines not seen before go on.
      const { data: fresh, error: logErr } = await db.from('party_npc_memory_log')
        .upsert(npcLines.map(l => ({ npc_id: npcId, party_id: partyId, line_id: l.id })), { onConflict: 'npc_id,line_id', ignoreDuplicates: true })
        .select('line_id');
      if (logErr) throw new Error(`memory log: ${logErr.message}`);
      const freshIds = new Set((fresh ?? []).map((r: { line_id: string }) => r.line_id));
      if (freshIds.size === 0) continue;
      const releaseLog = () => db.from('party_npc_memory_log').delete().eq('npc_id', npcId).in('line_id', Array.from(freshIds));

      try {
        const times = npcLines.filter(l => freshIds.has(l.id)).map(l => Date.parse(l.created_at)).sort((a, b) => a - b);
        const from = new Date(times[0] - 20 * 60_000).toISOString();
        const to = new Date(times[times.length - 1] + 1000).toISOString();

        const [scene, guide, notes, feelings] = await Promise.all([
          db.from('party_round_chat').select('user_id, character_name, content, in_character, npc_id, created_at')
            .eq('party_id', partyId).eq('in_character', true).gte('created_at', from).lte('created_at', to)
            .order('created_at', { ascending: true }).limit(60),
          db.from('party_npc_guides').select('guide, grudge_style').eq('npc_id', npcId).maybeSingle(),
          db.from('party_npc_memories').select('id, note, kind').eq('npc_id', npcId).order('created_at', { ascending: false }).limit(120),
          db.from('party_npc_attitudes').select('user_id, score, knows_name, last_seen_at, updated_at').eq('npc_id', npcId),
        ]);
        if (scene.error) throw new Error(`read scene: ${scene.error.message}`);
        if (notes.error) throw new Error(`read notes: ${notes.error.message}`);
        if (feelings.error) throw new Error(`read attitudes: ${feelings.error.message}`);

        const sceneRows = (scene.data ?? []) as Array<{ user_id: string; character_name: string; content: string; npc_id: string | null }>;
        const transcript = sceneRows.map(l => {
          const who = l.npc_id === npcId ? `${npc.name} (you)` : l.npc_id ? `${l.character_name} (NPC)` : l.character_name;
          const text = tableText(l.content).replace(/\s+/g, ' ').trim().slice(0, 600);
          return text ? `${who}: ${text}` : '';
        }).filter(Boolean);
        const allNotes = [...(notes.data ?? [])].reverse() as Array<{ id: string; note: string; kind: string | null }>;
        const ofKind = (k: string) => allNotes.filter(n => (n.kind || 'event') === k);
        const memory = ofKind('event').map(n => n.note);
        const openThreads = ofKind('thread');
        const selfFacts = ofKind('self').map(n => n.note);
        type Feeling = { user_id: string; score: number; knows_name: boolean | null; last_seen_at: string | null; updated_at: string | null };
        const feelingOf = new Map<string, Feeling>((feelings.data ?? []).map((f: Feeling) => [f.user_id, f] as [string, Feeling]));
        const style = (guide.data?.grudge_style as string | undefined) ?? 'normal';
        const now = Date.now();
        // Feelings fade without contact (D-22 v3) before anything new happens.
        const scoreNow = (userId: string) => {
          const f = feelingOf.get(userId);
          return f ? fadeAttitude(f.score, f.last_seen_at ?? f.updated_at, style, now) : 0;
        };
        const attitudes = seated.map(s => ({ name: s.character_name.trim(), score: scoreNow(s.user_id) }));
        const knownNames = seated.filter(s => feelingOf.get(s.user_id)?.knows_name).map(s => s.character_name.trim());

        const { system, user } = buildMemoryPrompt({
          npcName: npc.name, guide: guide.data?.guide ?? '', transcript, memory, attitudes,
          threads: openThreads.map(t => t.note), selfFacts, knownNames,
        });
        const opts = { threads: openThreads.map(t => t.note), selfFacts, knownNames };
        let answer = await callModel(MEMORY_MODEL, system, user);
        let update = answer.ok ? parseMemoryUpdate(answer.text || '', attitudes.map(a => a.name), memory, opts) : null;
        if (!answer.ok) {
          answer = await callModel(npc.model || MEMORY_BACKUP, system, user);
          update = answer.ok ? parseMemoryUpdate(answer.text || '', attitudes.map(a => a.name), memory, opts) : null;
        }
        if (!update) throw new Error(answer.reason || 'the memory model did not answer');

        const newRows = [
          ...update.notes.map(note => ({ npc_id: npcId, party_id: partyId, note, source: 'ai', kind: 'event' })),
          ...update.threadsOpened.map(note => ({ npc_id: npcId, party_id: partyId, note, source: 'ai', kind: 'thread' })),
          ...update.selfFacts.map(note => ({ npc_id: npcId, party_id: partyId, note, source: 'ai', kind: 'self' })),
        ];
        if (newRows.length) {
          const { error } = await db.from('party_npc_memories').insert(newRows);
          if (error) throw new Error(`save notes: ${error.message}`);
        }
        const closedIds = update.threadsClosed.map(i => openThreads[i]?.id).filter(Boolean);
        if (closedIds.length) {
          const { error } = await db.from('party_npc_memories').delete().in('id', closedIds);
          if (error) throw new Error(`close threads: ${error.message}`);
        }
        // Keep the newest AI notes of each kind; notes the host wrote are never dropped.
        for (const [kind, keep] of [['event', MAX_AI_NOTES], ['thread', MAX_THREADS], ['self', MAX_SELF_FACTS]] as Array<[string, number]>) {
          const { data: old } = await db.from('party_npc_memories').select('id')
            .eq('npc_id', npcId).eq('source', 'ai').eq('kind', kind).order('created_at', { ascending: false })
            .range(keep, keep + 50);
          if (old && old.length) await db.from('party_npc_memories').delete().in('id', old.map((o: { id: string }) => o.id));
        }

        // Feelings, names learned and last contact, for everyone in the scene or named in the update.
        const inScene = new Set(sceneRows.filter(l => !l.npc_id).map(l => l.user_id));
        const learned = new Set(update.namesLearned.map(n => n.toLowerCase()));
        const nowIso = new Date(now).toISOString();
        const moved: Array<{ name: string; from: number; to: number }> = [];
        for (const s of seated) {
          const key = s.character_name.trim().toLowerCase();
          const change = update.changes.find(c => c.name.toLowerCase() === key);
          const met = inScene.has(s.user_id);
          const learnedName = learned.has(key);
          if (!change && !met && !learnedName) continue;
          const before = scoreNow(s.user_id);
          const after = change ? shiftAttitude(before, change.change) : before;
          const stored = feelingOf.get(s.user_id)?.score ?? 0;
          const row: Record<string, unknown> = {
            npc_id: npcId,
            party_id: partyId,
            user_id: s.user_id,
            character_name: s.character_name.trim(),
            score: after,
            reason: c.reason,
            updated_by: 'ai',
          }, { onConflict: 'npc_id,user_id' });
          if (error) throw new Error(`save attitude: ${error.message}`);
          moved.push({ name: s.character_name.trim(), from: before, to: after });
        }
        results.push({ npc: npc.name, notes: update.notes.length, attitudes: moved });
      } catch (err) {
        await releaseLog();
        failed.push({ npc: npc.name, error: err instanceof Error ? err.message : 'unexpected error' });
      }
    }

    if (results.length === 0 && failed.length > 0) {
      return json(502, { error: `${failed.map(f => f.npc).join(' and ')} couldn't remember this scene (${failed[0].error}).`, results, failed });
    }
    return json(200, { ok: true, results, failed });
  } catch (err) {
    console.error('[npc-memory] failed:', err);
    return json(500, { error: 'NPC memory could not be updated because of a server error.' });
  }
});
