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
        .select('id, campaign_id, user_id, character_name, story_digest, digest_updated_at, visibility')
        .eq('universe_id', universeId);


      const { data: events } = await supabase
        .from('universe_events')
        .select('*')
        .eq('universe_id', universeId)
        .eq('is_canon', true)
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);

      return json({ universe, members: members || [], events: events || [] });
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

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
