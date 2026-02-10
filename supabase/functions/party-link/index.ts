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
      await supabase.from('party_members').insert({
        party_id: party.id,
        user_id: user.id,
        character_name: characterName,
        character_status: body.characterStatus || {},
      });

      return new Response(JSON.stringify({ party }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

      if ((count || 0) >= 4) {
        return new Response(JSON.stringify({ error: 'Party is full (max 4)' }), {
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

      // Delete all members (cascade will handle via FK)
      await supabase
        .from('parties')
        .update({ is_active: false })
        .eq('id', body.partyId);

      // Also remove all members
      await supabase
        .from('party_members')
        .delete()
        .eq('party_id', body.partyId);

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
