// npc-reply: an on-stage NPC answers a player's Live Table line (DECISIONS D-22).
// The NPC's guide and secrets are read here on the server and never sent to a phone.
//
// POST { messageId, npcId }                          a player asks an NPC (the line must be theirs),
//                                                    or shows it the roll it asked for
// POST { action: "spell", messageId }               a player cast a spell: on-stage NPCs react (v2)
// POST { action: "banter", partyId, npcIds, topic?, turns? }   the host starts an NPC scene (v2)
// POST { action: "regenerate", replyMessageId }     the host asks for a new version of an NPC line
//
// The caller must be signed in. Replies are written with the server's keys; if the NPC's
// own model fails (no key, out of credit, down), Gemini 2.5 Flash answers instead and the
// reply record says so.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createModelCaller } from './models.ts';
import { createRepo } from './repo.ts';
import { banter, regenerate, speak, spell, type Deps } from './handler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(500, { error: 'Server configuration error.' });

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Who is asking?
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return json(401, { error: 'Sign in to talk to NPCs.' });
  const { data: authData, error: authError } = await db.auth.getUser(token);
  const userId = authData?.user?.id;
  if (authError || !userId) return json(401, { error: 'Sign in to talk to NPCs.' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'The request body must be JSON.' });
  }

  const deps: Deps = {
    repo: createRepo(db),
    callModel: createModelCaller({
      VENICE_API_KEY: Deno.env.get('VENICE_API_KEY'),
      LOVABLE_API_KEY: Deno.env.get('LOVABLE_API_KEY'),
      ANTHROPIC_API_KEY: Deno.env.get('ANTHROPIC_API_KEY'),
    }),
    now: () => Date.now(),
  };

  try {
    const result = body.action === 'regenerate'
      ? await regenerate({ userId, replyMessageId: body.replyMessageId }, deps)
      : body.action === 'spell'
        ? await spell({ userId, messageId: body.messageId }, deps)
        : body.action === 'banter'
          ? await banter({ userId, partyId: body.partyId, npcIds: body.npcIds, topic: body.topic, turns: body.turns }, deps)
          : await speak({ userId, messageId: body.messageId, npcId: body.npcId }, deps);
    return json(result.status, result.body);
  } catch (err) {
    console.error('[npc-reply] failed:', err);
    return json(500, { error: 'The NPC could not answer because of a server error. Try again in a moment.' });
  }
});
