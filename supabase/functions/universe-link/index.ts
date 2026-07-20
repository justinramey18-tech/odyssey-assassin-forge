import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const { action, ...body } = await req.json();

    async function verifyCampaignOwnership(campaignId: string) {
      const { data } = await supabase
        .from('ai_dm_campaigns')
        .select('id, user_id')
        .eq('id', campaignId)
        .maybeSingle();
      return data && data.user_id === user.id;
    }

    if (action === 'create') {
      const { name, campaignId, characterName } = body;
      if (!campaignId) return json({ error: 'campaignId required' }, 400);
      if (!(await verifyCampaignOwnership(campaignId))) {
        return json({ error: 'You do not own this campaign' }, 403);
      }

      let code = '';
      let attempts = 0;
      while (attempts < 10) {
        code = generateCode();
        const { data: clash } = await supabase
          .from('linked_universes')
          .select('id')
          .eq('link_code', code)
          .maybeSingle();
        if (!clash) break;
        attempts++;
      }

      const { data: universe, error: uErr } = await supabase
        .from('linked_universes')
        .insert({
          link_code: code,
          name: name || 'Shared Universe',
          created_by: user.id,
        })
        .select()
        .single();

      if (uErr) return json({ error: uErr.message }, 500);

      const { error: mErr } = await supabase.from('universe_members').insert({
        universe_id: universe.id,
        user_id: user.id,
        campaign_id: campaignId,
        character_name: characterName || 'Rider',
      });

      if (mErr) return json({ error: mErr.message }, 500);

      return json({ universeId: universe.id, linkCode: code });
    }

    if (action === 'join') {
      const linkCode = (body.linkCode || '').toUpperCase().trim();
      const { campaignId, characterName } = body;
      if (!linkCode || linkCode.length !== 6) return json({ error: 'Invalid link code' }, 400);
      if (!campaignId) return json({ error: 'campaignId required' }, 400);
      if (!(await verifyCampaignOwnership(campaignId))) {
        return json({ error: 'You do not own this campaign' }, 403);
      }

      const { data: universe } = await supabase
        .from('linked_universes')
        .select('*')
        .eq('link_code', linkCode)
        .eq('is_active', true)
        .maybeSingle();

      if (!universe) return json({ error: 'Universe not found or inactive' }, 404);

      const { count } = await supabase
        .from('universe_members')
        .select('*', { count: 'exact', head: true })
        .eq('universe_id', universe.id);

      if ((count || 0) >= (universe.max_members || 8)) {
        return json({ error: `Universe is full (max ${universe.max_members || 8})` }, 400);
      }

      const { data: dup } = await supabase
        .from('universe_members')
        .select('id')
        .eq('universe_id', universe.id)
        .eq('campaign_id', campaignId)
        .maybeSingle();
      if (dup) return json({ error: 'This campaign is already linked to this universe' }, 400);

      const { error: mErr } = await supabase.from('universe_members').insert({
        universe_id: universe.id,
        user_id: user.id,
        campaign_id: campaignId,
        character_name: characterName || 'Rider',
      });

      if (mErr) return json({ error: mErr.message }, 500);

      return json({ universeId: universe.id, universeName: universe.name });
    }

    if (action === 'leave') {
      const { universeId, campaignId } = body;
      if (!universeId || !campaignId) return json({ error: 'universeId and campaignId required' }, 400);

      await supabase
        .from('universe_members')
        .delete()
        .eq('universe_id', universeId)
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id);

      const { count } = await supabase
        .from('universe_members')
        .select('*', { count: 'exact', head: true })
        .eq('universe_id', universeId);

      if ((count || 0) === 0) {
        await supabase
          .from('linked_universes')
          .update({ is_active: false })
          .eq('id', universeId);
      }

      return json({ success: true });
    }

    if (action === 'status') {
      const { campaignId } = body;
      if (!campaignId) return json({ error: 'campaignId required' }, 400);

      const { data: myMembership } = await supabase
        .from('universe_members')
        .select('universe_id')
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!myMembership) return json({ universe: null });

      const universeId = myMembership.universe_id;

      const { data: universe } = await supabase
        .from('linked_universes')
        .select('*')
        .eq('id', universeId)
        .maybeSingle();

      if (!universe) return json({ universe: null });

      const { data: members } = await supabase
        .from('universe_members')
        .select('id, campaign_id, user_id, character_name, story_digest, digest_updated_at, visibility, region, story_day')
        .eq('universe_id', universeId);


      const { data: events } = await supabase
        .from('universe_events')
        .select('id, event_text, event_type, importance, created_at, created_by_member, is_canon, occurred_on_day')
        .eq('universe_id', universeId)
        .eq('is_canon', true)
        .order('created_at', { ascending: false })
        .limit(25);

      // Attribute each event to the member (character) who created it
      const memberNameById = new Map<string, string>();
      for (const m of members || []) memberNameById.set(m.id, m.character_name);
      const eventsWithNames = (events || []).map((e: any) => ({
        ...e,
        created_by_name: e.created_by_member ? memberNameById.get(e.created_by_member) || null : null,
      }));

      // Caller's outgoing relationships (their view of others)
      const myMember = (members || []).find((m: any) => m.user_id === user.id && m.campaign_id === campaignId);
      let relationships: any[] = [];
      if (myMember) {
        const { data: rels } = await supabase
          .from('universe_relationships')
          .select('id, member_a, member_b, relation, note, updated_at')
          .eq('universe_id', universeId)
          .eq('member_a', myMember.id);
        relationships = rels || [];
      }

      return json({ universe, members: members || [], events: eventsWithNames, relationships });
    }

    if (action === 'saveDigest') {
      const { campaignId, digest } = body;
      if (!campaignId) return json({ error: 'campaignId required' }, 400);
      if (typeof digest !== 'string') return json({ error: 'digest must be a string' }, 400);
      if (digest.length > 5000) return json({ error: 'Digest must be 5000 characters or fewer' }, 400);
      if (!(await verifyCampaignOwnership(campaignId))) {
        return json({ error: 'You do not own this campaign' }, 403);
      }

      const { data: membership } = await supabase
        .from('universe_members')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) return json({ error: 'Campaign is not linked to a universe' }, 404);

      const { error: updateErr } = await supabase
        .from('universe_members')
        .update({ story_digest: digest, digest_updated_at: new Date().toISOString() })
        .eq('id', membership.id);

      if (updateErr) return json({ error: updateErr.message }, 500);
      return json({ success: true });
    }

    if (action === 'setVisibility') {
      const { campaignId, visibility } = body;
      if (!campaignId) return json({ error: 'campaignId required' }, 400);
      if (!['full', 'headline', 'hidden'].includes(visibility)) {
        return json({ error: 'visibility must be full, headline, or hidden' }, 400);
      }
      if (!(await verifyCampaignOwnership(campaignId))) {
        return json({ error: 'You do not own this campaign' }, 403);
      }

      const { data: membership } = await supabase
        .from('universe_members')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) return json({ error: 'Campaign is not linked to a universe' }, 404);

      const { error: updateErr } = await supabase
        .from('universe_members')
        .update({ visibility })
        .eq('id', membership.id);

      if (updateErr) return json({ error: updateErr.message }, 500);
      return json({ success: true });
    }

    if (action === 'setRegion') {
      const { campaignId } = body;
      let region: string | null = body.region ?? null;
      if (!campaignId) return json({ error: 'campaignId required' }, 400);
      if (region !== null) {
        if (typeof region !== 'string') return json({ error: 'region must be a string or null' }, 400);
        region = region.trim().slice(0, 64);
        if (!region) region = null;
      }
      if (!(await verifyCampaignOwnership(campaignId))) {
        return json({ error: 'You do not own this campaign' }, 403);
      }

      const { data: membership } = await supabase
        .from('universe_members')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) return json({ error: 'Campaign is not linked to a universe' }, 404);

      const { error: updateErr } = await supabase
        .from('universe_members')
        .update({ region })
        .eq('id', membership.id);

      if (updateErr) return json({ error: updateErr.message }, 500);
      return json({ success: true, region });
    }

    if (action === 'setStoryDay') {
      const { campaignId } = body;
      let storyDay = parseInt(String(body.storyDay ?? 0), 10);
      if (!Number.isFinite(storyDay)) storyDay = 0;
      if (storyDay < 0) storyDay = 0;
      if (storyDay > 100000) storyDay = 100000;
      if (!campaignId) return json({ error: 'campaignId required' }, 400);
      if (!(await verifyCampaignOwnership(campaignId))) {
        return json({ error: 'You do not own this campaign' }, 403);
      }

      const { data: membership } = await supabase
        .from('universe_members')
        .select('id, universe_id')
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!membership) return json({ error: 'Campaign is not linked to a universe' }, 404);

      const { error: mErr } = await supabase
        .from('universe_members')
        .update({ story_day: storyDay })
        .eq('id', membership.id);
      if (mErr) return json({ error: mErr.message }, 500);

      // Bump universe clock if this rider is furthest ahead
      const { data: uni } = await supabase
        .from('linked_universes')
        .select('current_day')
        .eq('id', membership.universe_id)
        .maybeSingle();
      const cur = uni?.current_day ?? 0;
      if (storyDay > cur) {
        await supabase
          .from('linked_universes')
          .update({ current_day: storyDay })
          .eq('id', membership.universe_id);
      }
      return json({ success: true, storyDay });
    }


    if (action === 'setRelationship') {
      const { fromCampaignId, toMemberId, relation, note } = body;
      if (!fromCampaignId || !toMemberId) return json({ error: 'fromCampaignId and toMemberId required' }, 400);
      const ALLOWED = ['ally', 'friend', 'rival', 'enemy', 'owes-you', 'you-owe-them', 'acquaintance'];
      const rel = typeof relation === 'string' && ALLOWED.includes(relation) ? relation : 'acquaintance';
      const cleanNote = typeof note === 'string' ? note.trim().slice(0, 500) || null : null;
      if (!(await verifyCampaignOwnership(fromCampaignId))) return json({ error: 'You do not own this campaign' }, 403);

      const fromMember = await memberFromCampaign(fromCampaignId);
      if (!fromMember) return json({ error: 'Campaign not linked to a universe' }, 404);

      const { data: toMember } = await supabase
        .from('universe_members')
        .select('id, universe_id')
        .eq('id', toMemberId)
        .maybeSingle();
      if (!toMember || toMember.universe_id !== fromMember.universe_id) {
        return json({ error: 'Target rider is not in this universe' }, 400);
      }
      if (toMember.id === fromMember.id) {
        return json({ error: 'You cannot set a relationship with yourself' }, 400);
      }

      const { error: upErr } = await supabase
        .from('universe_relationships')
        .upsert({
          universe_id: fromMember.universe_id,
          member_a: fromMember.id,
          member_b: toMember.id,
          relation: rel,
          note: cleanNote,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'universe_id,member_a,member_b' });
      if (upErr) return json({ error: upErr.message }, 500);
      return json({ success: true, relation: rel, note: cleanNote });
    }

    if (action === 'generateDigest') {
      const { campaignId, campaignSummary, characterName } = body;
      if (!campaignId) return json({ error: 'campaignId required' }, 400);
      if (!(await verifyCampaignOwnership(campaignId))) {
        return json({ error: 'You do not own this campaign' }, 403);
      }

      const { data: membership } = await supabase
        .from('universe_members')
        .select('id, universe_id, story_day')
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) return json({ skipped: true });

      const summary = typeof campaignSummary === 'string' ? campaignSummary.slice(0, 6000) : '';
      if (!summary.trim()) return json({ skipped: true });

      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) return json({ error: 'LOVABLE_API_KEY not configured' }, 500);

      const systemPrompt = `You compress a tabletop RPG campaign into a SHORT shared-world digest that OTHER players' game masters will read, AND extract world-changing events for a shared canon ledger, AND estimate in-fiction time passage.

Output ONLY valid JSON in this exact shape, no markdown fences, no extra text:
{
  "digest": "CHARACTER: {name, role, defining traits/powers}\\nLOCATION: {where they currently are}\\nSTATUS: {alive/injured/etc, current condition}\\nRECENT: {1-2 sentences on their most recent significant events}\\nHOOKS: {1-2 concrete things another player's story could latch onto — items they carry, people they seek, debts, rumors about them}",
  "events": [ { "text": "concise past-tense sentence with proper nouns", "type": "story|location|npc|death|crossover", "importance": 1-3 } ],
  "dayAdvance": 0
}

DIGEST rules: at most 120 words. Be concrete and specific. Use proper nouns. This is read by other people's AI game masters to weave a shared world.

EVENTS rules: ONLY include things that would be visible or consequential to OTHER people in this shared world — world-changing occurrences (importance 3) or notable public events (importance 2). Do NOT include private/minor character moments. Most turns produce ZERO events; an empty array is correct and expected. Never invent events not grounded in the story.

TIME rules — "dayAdvance": Estimate how many in-fiction DAYS passed during these recent events. A single scene is usually 0. A night's rest is 1. A journey or explicit time-skip may be several. Be conservative; output an integer dayAdvance. If you cannot tell, use 0.`;

      const userMsg = `Character name: ${characterName || 'Unknown'}\n\nCAMPAIGN SUMMARY:\n${summary}`;

      const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg },
          ],
          max_tokens: 700,
        }),
      });

      if (!aiRes.ok) {
        const txt = await aiRes.text();
        console.error('generateDigest AI error', aiRes.status, txt);
        return json({ error: 'AI gateway error' }, aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500);
      }

      const aiData = await aiRes.json();
      const raw = (aiData.choices?.[0]?.message?.content || '').trim();
      if (!raw) return json({ error: 'Empty response' }, 500);

      // Safe JSON parse — strip code fences, fall back to raw as digest
      let digest = '';
      let events: Array<{ text: string; type: string; importance: number }> = [];
      try {
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        digest = typeof parsed.digest === 'string' ? parsed.digest.trim() : '';
        if (Array.isArray(parsed.events)) {
          events = parsed.events
            .filter((e: any) => e && typeof e.text === 'string' && e.text.trim())
            .map((e: any) => ({
              text: String(e.text).trim().slice(0, 500),
              type: ['story', 'location', 'npc', 'death', 'crossover'].includes(e.type) ? e.type : 'story',
              importance: Math.max(1, Math.min(3, parseInt(e.importance, 10) || 1)),
            }));
        }
      } catch {
        digest = raw;
        events = [];
      }

      if (!digest) digest = raw;
      if (digest.length > 5000) digest = digest.slice(0, 5000);

      const { error: updateErr } = await supabase
        .from('universe_members')
        .update({ story_digest: digest, digest_updated_at: new Date().toISOString() })
        .eq('id', membership.id);

      if (updateErr) return json({ error: updateErr.message }, 500);

      // Event extraction — only importance 2 & 3, cap at 3, dedupe against last 20
      let eventsAdded = 0;
      try {
        const filtered = events
          .filter(e => e.importance >= 2)
          .sort((a, b) => b.importance - a.importance)
          .slice(0, 3);

        if (filtered.length > 0) {
          const { data: recent } = await supabase
            .from('universe_events')
            .select('event_text')
            .eq('universe_id', membership.universe_id)
            .order('created_at', { ascending: false })
            .limit(20);

          const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
          const wordOverlap = (a: string, b: string) => {
            const aw = new Set(a.split(' ').filter(w => w.length > 3));
            const bw = new Set(b.split(' ').filter(w => w.length > 3));
            if (aw.size === 0 || bw.size === 0) return 0;
            let shared = 0;
            aw.forEach(w => { if (bw.has(w)) shared++; });
            return shared / Math.min(aw.size, bw.size);
          };
          const existingNorms = (recent || []).map((r: any) => normalize(r.event_text || ''));

          const toInsert = filtered.filter(ev => {
            const n = normalize(ev.text);
            for (const ex of existingNorms) {
              if (!ex) continue;
              if (ex.includes(n) || n.includes(ex)) return false;
              if (wordOverlap(n, ex) > 0.8) return false;
            }
            return true;
          });

          if (toInsert.length > 0) {
            const rows = toInsert.map(ev => ({
              universe_id: membership.universe_id,
              created_by_member: membership.id,
              event_text: ev.text,
              event_type: ev.type,
              importance: ev.importance,
              is_canon: true,
            }));
            const { error: insErr } = await supabase.from('universe_events').insert(rows);
            if (!insErr) eventsAdded = rows.length;
            else console.error('universe_events insert error', insErr);
          }
        }
      } catch (e) {
        console.error('event extraction failed (non-blocking)', e);
      }

      return json({ success: true, digest, eventsAdded });
    }

    if (action === 'flagConflict') {
      const { universeId, proposedText } = body;
      if (!universeId || typeof proposedText !== 'string' || !proposedText.trim()) {
        return json({ conflict: false });
      }

      // Verify caller is a member of this universe (cheap auth check)
      const { data: myMember } = await supabase
        .from('universe_members')
        .select('id')
        .eq('universe_id', universeId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!myMember) return json({ conflict: false });

      const { data: canon } = await supabase
        .from('universe_events')
        .select('event_text, importance')
        .eq('universe_id', universeId)
        .eq('is_canon', true)
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(25);

      const canonList = (canon || [])
        .map((c: any, i: number) => `${i + 1}. [imp ${c.importance}] ${c.event_text}`)
        .join('\n');
      if (!canonList) return json({ conflict: false });

      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) return json({ conflict: false });

      const sys = `You check whether a PROPOSED story text contradicts established SHARED CANON facts. Reply ONLY with valid JSON: {"conflict": boolean, "reason": "one short sentence or empty"}. A conflict means the proposed text directly reverses or contradicts a canon fact (e.g. treating a destroyed place as intact, a dead NPC as alive). Building on or adding nuance is NOT a conflict. If unsure, return false.`;
      const usr = `SHARED CANON:\n${canonList}\n\nPROPOSED TEXT:\n${proposedText.slice(0, 4000)}`;

      try {
        const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: usr },
            ],
            max_tokens: 150,
          }),
        });
        if (!aiRes.ok) return json({ conflict: false });
        const d = await aiRes.json();
        const raw = (d.choices?.[0]?.message?.content || '').trim();
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        return json({
          conflict: !!parsed.conflict,
          reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : undefined,
        });
      } catch {
        return json({ conflict: false });
      }
    }

    // ============ CROSSOVERS ============
    async function memberFromCampaign(campaignId: string) {
      const { data } = await supabase
        .from('universe_members')
        .select('id, universe_id, character_name')
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    }

    if (action === 'requestCrossover') {
      const { fromCampaignId, toMemberId, scenePremise } = body;
      if (!fromCampaignId || !toMemberId) return json({ error: 'fromCampaignId and toMemberId required' }, 400);
      if (!(await verifyCampaignOwnership(fromCampaignId))) return json({ error: 'You do not own this campaign' }, 403);

      const fromMember = await memberFromCampaign(fromCampaignId);
      if (!fromMember) return json({ error: 'Campaign not linked to a universe' }, 404);

      const { data: toMember } = await supabase
        .from('universe_members')
        .select('id, universe_id')
        .eq('id', toMemberId)
        .maybeSingle();
      if (!toMember || toMember.universe_id !== fromMember.universe_id) {
        return json({ error: 'Target rider is not in this universe' }, 400);
      }
      if (toMember.id === fromMember.id) {
        return json({ error: 'You cannot request a crossover with yourself' }, 400);
      }

      const { data: inserted, error: insErr } = await supabase
        .from('crossover_requests')
        .insert({
          universe_id: fromMember.universe_id,
          from_member: fromMember.id,
          to_member: toMember.id,
          scene_premise: typeof scenePremise === 'string' ? scenePremise.slice(0, 500) : null,
          status: 'pending',
        })
        .select()
        .single();
      if (insErr) return json({ error: insErr.message }, 500);
      return json({ crossover: inserted });
    }

    if (action === 'respondCrossover') {
      const { crossoverId, accept } = body;
      if (!crossoverId) return json({ error: 'crossoverId required' }, 400);

      const { data: cx } = await supabase
        .from('crossover_requests')
        .select('id, to_member, status')
        .eq('id', crossoverId)
        .maybeSingle();
      if (!cx) return json({ error: 'Crossover not found' }, 404);
      if (cx.status !== 'pending') return json({ error: 'Already resolved' }, 400);

      const { data: toM } = await supabase
        .from('universe_members')
        .select('user_id')
        .eq('id', cx.to_member)
        .maybeSingle();
      if (!toM || toM.user_id !== user.id) return json({ error: 'Only the invited rider can respond' }, 403);

      const newStatus = accept ? 'accepted' : 'declined';
      const { error: upErr } = await supabase
        .from('crossover_requests')
        .update({ status: newStatus, resolved_at: accept ? null : new Date().toISOString() })
        .eq('id', crossoverId);
      if (upErr) return json({ error: upErr.message }, 500);
      return json({ success: true, status: newStatus });
    }

    if (action === 'listCrossovers') {
      const { campaignId } = body;
      if (!campaignId) return json({ error: 'campaignId required' }, 400);
      const me = await memberFromCampaign(campaignId);
      if (!me) return json({ crossovers: [] });

      const { data: rows } = await supabase
        .from('crossover_requests')
        .select('*')
        .eq('universe_id', me.universe_id)
        .or(`from_member.eq.${me.id},to_member.eq.${me.id}`)
        .order('created_at', { ascending: false })
        .limit(30);

      const memberIds = new Set<string>();
      (rows || []).forEach((r: any) => { memberIds.add(r.from_member); memberIds.add(r.to_member); });
      const { data: memberRows } = memberIds.size
        ? await supabase
            .from('universe_members')
            .select('id, character_name, story_digest, campaign_id')
            .in('id', Array.from(memberIds))
        : { data: [] as any[] };
      const memMap = new Map<string, any>();
      (memberRows || []).forEach((m: any) => memMap.set(m.id, m));

      const crossovers = (rows || []).map((r: any) => {
        const iAmFrom = r.from_member === me.id;
        const other = memMap.get(iAmFrom ? r.to_member : r.from_member);
        return {
          id: r.id,
          universeId: r.universe_id,
          fromMember: r.from_member,
          toMember: r.to_member,
          scenePremise: r.scene_premise,
          status: r.status,
          narrationA: r.narration_a,
          narrationB: r.narration_b,
          createdAt: r.created_at,
          resolvedAt: r.resolved_at,
          direction: iAmFrom ? 'outgoing' : 'incoming',
          mySide: iAmFrom ? 'a' : 'b',
          otherCharacterName: other?.character_name ?? 'Unknown Rider',
          otherStoryDigest: other?.story_digest ?? null,
        };
      });

      return json({ crossovers, myMemberId: me.id });
    }

    if (action === 'saveCrossoverNarration') {
      const { crossoverId, side, narration, relation, note } = body;
      if (!crossoverId || (side !== 'a' && side !== 'b') || typeof narration !== 'string') {
        return json({ error: 'crossoverId, side (a|b), narration required' }, 400);
      }

      const { data: cx } = await supabase
        .from('crossover_requests')
        .select('*')
        .eq('id', crossoverId)
        .maybeSingle();
      if (!cx) return json({ error: 'Crossover not found' }, 404);

      const memberIdForSide = side === 'a' ? cx.from_member : cx.to_member;
      const otherMemberId = side === 'a' ? cx.to_member : cx.from_member;
      const { data: memberRow } = await supabase
        .from('universe_members')
        .select('user_id')
        .eq('id', memberIdForSide)
        .maybeSingle();
      if (!memberRow || memberRow.user_id !== user.id) {
        return json({ error: 'You may only save your own side' }, 403);
      }

      const trimmed = narration.slice(0, 8000);
      const patch: Record<string, unknown> = side === 'a' ? { narration_a: trimmed } : { narration_b: trimmed };
      const bothPresent = side === 'a' ? (trimmed && cx.narration_b) : (cx.narration_a && trimmed);
      if (bothPresent) {
        patch.status = 'completed';
        patch.resolved_at = new Date().toISOString();
      }

      const { error: upErr } = await supabase
        .from('crossover_requests')
        .update(patch)
        .eq('id', crossoverId);
      if (upErr) return json({ error: upErr.message }, 500);

      // Optional inline relationship upsert from the caller's side
      const ALLOWED = ['ally', 'friend', 'rival', 'enemy', 'owes-you', 'you-owe-them', 'acquaintance'];
      if (typeof relation === 'string' && ALLOWED.includes(relation)) {
        const cleanNote = typeof note === 'string' ? note.trim().slice(0, 500) || null : null;
        await supabase
          .from('universe_relationships')
          .upsert({
            universe_id: cx.universe_id,
            member_a: memberIdForSide,
            member_b: otherMemberId,
            relation,
            note: cleanNote,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'universe_id,member_a,member_b' });
      }

      return json({ success: true, completed: !!bothPresent });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
