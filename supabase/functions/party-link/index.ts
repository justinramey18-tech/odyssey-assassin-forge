import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
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

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, ...body } = await req.json();

    if (action === 'create') {
      // Check user isn't already in an active party
      const { data: existing } = await supabase
        .from('party_members')
        .select('party_id, parties!inner(is_active)')
        .eq('user_id', user.id)
        .eq('parties.is_active', true)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: 'You are already in a party. Leave first.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate unique code
      let code = '';
      let attempts = 0;
      while (attempts < 10) {
        code = generateCode();
        const { data: clash } = await supabase
          .from('parties')
          .select('id')
          .eq('link_code', code)
          .eq('is_active', true)
          .maybeSingle();
        if (!clash) break;
        attempts++;
      }

      // Create party
      const { data: party, error: partyError } = await supabase
        .from('parties')
        .insert({ link_code: code, created_by: user.id })
        .select()
        .single();

      if (partyError) {
        return new Response(JSON.stringify({ error: partyError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Add creator as first member
      const characterName = body.characterName || 'Adventurer';
      const { error: seatError } = await supabase.from('party_members').insert({
        party_id: party.id,
        user_id: user.id,
        character_name: characterName,
        character_status: body.characterStatus || {},
      });
      if (seatError) {
        return new Response(JSON.stringify({ error: seatError.message, party }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ party }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Party onboarding (signup + full character creation) ──
    // The verified user id always comes from the token above, never the body.
    if (typeof action === 'string' && action.startsWith('onboarding_')) {
      const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      const isUuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
      const isInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0;
      const call = async (fn: string, args: Record<string, unknown>) => {
        const { data, error } = await supabase.rpc(fn, args);
        if (error) return json({ status: 'error', error: error.message }, 400);
        return json(data);
      };
      switch (action) {
        case 'onboarding_begin':
          if (typeof body.linkCode !== 'string' || body.linkCode.length > 20) return json({ status: 'invalid_code' }, 400);
          return call('onboarding_begin', { _user_id: user.id, _link_code: body.linkCode });
        case 'onboarding_list':
          return call('onboarding_list', { _user_id: user.id });
        case 'onboarding_resume':
          if (!isUuid(body.sessionId)) return json({ status: 'not_found' }, 400);
          return call('onboarding_resume', { _user_id: user.id, _session_id: body.sessionId });
        case 'onboarding_save_draft':
          if (!isUuid(body.sessionId) || !isInt(body.expectedRevision)) return json({ status: 'invalid_request' }, 400);
          return call('onboarding_save_draft', { _user_id: user.id, _session_id: body.sessionId, _expected_revision: body.expectedRevision, _draft: body.draft });
        case 'onboarding_finalize':
          if (!isUuid(body.sessionId) || !isInt(body.expectedDraftRevision) || !isInt(body.expectedContextRevision)) return json({ status: 'invalid_request' }, 400);
          return call('onboarding_finalize', {
            _user_id: user.id, _session_id: body.sessionId,
            _expected_draft_revision: body.expectedDraftRevision,
            _expected_context_revision: body.expectedContextRevision,
            _payload: body.savePayload,
          });
        default:
          return json({ error: 'Unknown action' }, 400);
      }
    }

    if (action === 'join') {
      const linkCode = (body.linkCode || '').toUpperCase().trim();
      if (!linkCode || linkCode.length !== 6) {
        return new Response(JSON.stringify({ error: 'Invalid link code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check user isn't already in a party
      const { data: existing } = await supabase
        .from('party_members')
        .select('party_id, parties!inner(is_active)')
        .eq('user_id', user.id)
        .eq('parties.is_active', true)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: 'You are already in a party. Leave first.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Find party
      const { data: party } = await supabase
        .from('parties')
        .select('*')
        .eq('link_code', linkCode)
        .eq('is_active', true)
        .maybeSingle();

      if (!party) {
        return new Response(JSON.stringify({ error: 'Party not found or inactive' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check party size
      const { count } = await supabase
        .from('party_members')
        .select('*', { count: 'exact', head: true })
        .eq('party_id', party.id);

      if ((count || 0) >= 6) {
        return new Response(JSON.stringify({ error: 'Party is full (max 6)' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Join
      const characterName = body.characterName || 'Adventurer';
      const { error: joinError } = await supabase.from('party_members').insert({
        party_id: party.id,
        user_id: user.id,
        character_name: characterName,
        character_status: body.characterStatus || {},
      });

      if (joinError) {
        return new Response(JSON.stringify({ error: joinError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ party }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'leave') {
      // Remove self from party
      await supabase
        .from('party_members')
        .delete()
        .eq('user_id', user.id)
        .eq('party_id', body.partyId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'kick') {
      // Only party creator can kick members
      const { data: party } = await supabase
        .from('parties')
        .select('*')
        .eq('id', body.partyId)
        .eq('created_by', user.id)
        .maybeSingle();

      if (!party) {
        return new Response(JSON.stringify({ error: 'Not your party' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!body.targetUserId || body.targetUserId === user.id) {
        return new Response(JSON.stringify({ error: 'Invalid target' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: kickError } = await supabase
        .from('party_members')
        .delete()
        .eq('party_id', body.partyId)
        .eq('user_id', body.targetUserId);

      if (kickError) {
        return new Response(JSON.stringify({ error: kickError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'disband') {
      // Only creator can disband
      const { data: party } = await supabase
        .from('parties')
        .select('*')
        .eq('id', body.partyId)
        .eq('created_by', user.id)
        .maybeSingle();

      if (!party) {
        return new Response(JSON.stringify({ error: 'Not your party to disband' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pid = body.partyId;
      // Clean up dependent tables first (foreign keys may block party deletion)
      await supabase.from('party_dm_prompts').delete().eq('party_id', pid);
      await supabase.from('party_dm_messages').delete().eq('party_id', pid);
      await supabase.from('party_shared_state').delete().eq('party_id', pid);
      await supabase.from('scheduled_telegram_jobs').delete().eq('party_id', pid);
      await supabase.from('party_members').delete().eq('party_id', pid);

      // Now delete the party itself
      const { error: deleteError } = await supabase
        .from('parties')
        .delete()
        .eq('id', pid);

      if (deleteError) {
        console.error('[disband] Delete error:', deleteError);
        return new Response(JSON.stringify({ error: 'Failed to delete party: ' + deleteError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
