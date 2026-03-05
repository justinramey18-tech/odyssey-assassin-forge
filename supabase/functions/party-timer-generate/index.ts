import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TRIGGER_SECRET = Deno.env.get("TRIGGER_SECRET") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

// ── Lightweight system prompt for server-side generation ──
function buildServerSystemPrompt(partyMembers: Array<{ character_name: string; character_status: Record<string, unknown> }>, campaignSummary: string | null, customGuides: string | null): string {
  const membersSummary = partyMembers.map(m => {
    const s = m.character_status || {};
    return `- ${m.character_name} (Level ${s.level || '?'} ${s.className || 'Adventurer'}, ${s.currentHP || '?'}/${s.maxHP || '?'} HP)`;
  }).join('\n');

  let prompt = `You are an expert Dungeon Master running a live D&D 5e session for a party of players. You are immersive, adaptive, and mechanically precise.

## PARTY MEMBERS
This is a multiplayer session. Multiple players are acting simultaneously each round.
${membersSummary}
Resolve all player actions in order, describing the scene as a cohesive narrative. Address each player character by name.

## YOUR ROLE
- Run engaging D&D 5e encounters, exploration, social encounters, and roleplay
- Write RICH, NOVELISTIC prose — each response should read like a passage from a fantasy novel
- Describe vivid scenes with layered sensory details — sights, sounds, smells, textures, atmosphere
- Control all NPCs, enemies, and environmental effects with distinct personalities, body language, and vocal tics
- Follow D&D 5e rules for combat, skill checks, saving throws
- Write LONG, DETAILED responses — aim for 10-16 paragraphs minimum. Each paragraph should be dense and richly layered. Include extensive environmental description with all five senses, extended NPC dialogue with distinct voices and body language, dramatic tension, atmospheric detail, and moment-to-moment drama. Every response should feel like reading two full pages from an epic fantasy novel. Never truncate, summarize, or rush — let scenes breathe, build tension, and unfold with cinematic depth. Include at least 2-3 lines of NPC dialogue per response where appropriate.

## IMPORTANT
- Never control player characters' actions, thoughts, or speech
- Be fair but not adversarial
- Use markdown formatting: **bold** for important names/items, *italics* for sensory details, internal thoughts, and atmosphere

## OUTPUT FORMAT
Separate mechanical content from narrative prose:
- Dice rolls: <!--ACTION-->Roll a Perception check (DC 14)<!--/ACTION-->
- Tactical tips: <!--TACTICS-->Consider saving Shield for the next attack.<!--/TACTICS-->
- Whispers: <!--WHISPER:CharacterName-->Secret info here.<!--/WHISPER:CharacterName-->`;

  if (campaignSummary?.trim()) {
    prompt += `\n\n## CAMPAIGN SUMMARY\n${campaignSummary.slice(0, 15000)}`;
  }
  if (customGuides?.trim()) {
    prompt += `\n\n## CUSTOM GM GUIDES\n${customGuides.slice(0, 50000)}`;
  }
  return prompt;
}

// ── Build AFK context for absent members ──
function buildAfkContext(
  readyPrompts: Array<{ user_id: string; character_name: string; prompt: string }>,
  partyMembers: Array<{ user_id: string; character_name: string; character_status: Record<string, unknown> }>
): { promptSection: string; guidesSection: string } {
  const absentMembers = partyMembers.filter(
    m => !readyPrompts.some(p => p.user_id === m.user_id)
  );
  const afkLines: string[] = [];
  const afkPromptLines: string[] = [];

  for (const m of absentMembers) {
    const guide = m.character_status?.afkPersonalityGuide as string | null;
    const cascade = m.character_status?.afkPromptCascade as string[] | null;

    if (cascade && cascade.length > 0) {
      afkPromptLines.push(`[${m.character_name}] (AFK — Cascade Prompt): ${cascade[0]}`);
      if (guide) afkLines.push(`- ${m.character_name}: ${guide}`);
    } else if (guide) {
      afkLines.push(`- ${m.character_name}: ${guide}`);
      afkPromptLines.push(`[${m.character_name}] (AFK): ${guide}`);
    } else {
      afkPromptLines.push(`[${m.character_name}]: Holds their action`);
    }
  }

  const guidesSection = afkLines.length > 0
    ? `\n\n## AFK CHARACTER GUIDES\nRoleplay the following absent characters in-character:\n${afkLines.join('\n')}`
    : '';
  const promptSection = afkPromptLines.length > 0 ? '\n' + afkPromptLines.join('\n') : '';
  return { guidesSection, promptSection };
}

// ── Schedule next recurrence ──
async function scheduleNextRecurrence(
  supabase: ReturnType<typeof createClient>,
  event: Record<string, unknown>,
  partyId: string
): Promise<void> {
  const recurrence = event.recurrence as string | null;
  if (!recurrence) return; // one-time event, nothing to do

  let nextDate: Date | null = null;

  if (recurrence === "weekly") {
    nextDate = new Date(event.scheduled_at as string);
    nextDate.setDate(nextDate.getDate() + 7);
  }

  if (!nextDate || nextDate.getTime() <= Date.now()) {
    // If somehow the next date is in the past, skip forward
    if (nextDate && recurrence === "weekly") {
      while (nextDate.getTime() <= Date.now()) {
        nextDate.setDate(nextDate.getDate() + 7);
      }
    } else {
      return;
    }
  }

  // 1. Create the next event
  const { data: nextEvent, error: insertErr } = await supabase
    .from("party_scheduled_events")
    .insert({
      party_id: partyId,
      created_by: event.created_by as string,
      event_name: event.event_name as string,
      event_prompt: event.event_prompt as string,
      event_type: event.event_type as string,
      recurrence,
      scheduled_at: nextDate.toISOString(),
    })
    .select("id")
    .single();

  if (insertErr || !nextEvent) {
    console.error(`[recurrence] Failed to create next occurrence:`, insertErr);
    return;
  }

  // 2. Schedule the QStash callback
  const QSTASH_TOKEN = Deno.env.get("QSTASH_TOKEN");
  if (!QSTASH_TOKEN) {
    console.error("[recurrence] QSTASH_TOKEN not configured");
    return;
  }

  const targetUrl = `${SUPABASE_URL}/functions/v1/party-timer-generate`;
  const notBefore = Math.floor(nextDate.getTime() / 1000);

  const qstashResponse = await fetch("https://qstash.upstash.io/v2/publish", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${QSTASH_TOKEN}`,
      "Content-Type": "application/json",
      "Upstash-Url": targetUrl,
      "Upstash-Retries": "2",
      "Upstash-Not-Before": String(notBefore),
    },
    body: JSON.stringify({
      partyId,
      eventId: nextEvent.id,
      triggerSecret: TRIGGER_SECRET,
    }),
  });

  if (qstashResponse.ok) {
    const result = await qstashResponse.json();
    await supabase
      .from("party_scheduled_events")
      .update({ qstash_message_id: result.messageId })
      .eq("id", nextEvent.id);
    console.log(`[recurrence] Scheduled next ${recurrence} occurrence for ${nextDate.toISOString()}, messageId: ${result.messageId}`);
  } else {
    console.error(`[recurrence] QStash scheduling failed:`, qstashResponse.status);
  }
}

// ── Handle scheduled narrative events ──
async function handleScheduledEvent(
  supabase: ReturnType<typeof createClient>,
  partyId: string,
  eventId: string
): Promise<boolean> {
  // 1. Fetch the event
  const { data: event, error: evErr } = await supabase
    .from("party_scheduled_events")
    .select("*")
    .eq("id", eventId)
    .eq("party_id", partyId)
    .single();

  if (evErr || !event) {
    console.error(`[scheduled-event] Event ${eventId} not found:`, evErr);
    return false;
  }

  if (event.status !== "pending") {
    console.log(`[scheduled-event] Event ${eventId} already ${event.status}, skipping`);
    return false;
  }

  // Route by event type
  if (event.event_type === "scheduled_round") {
    return handleScheduledRound(supabase, partyId, eventId, event);
  }

  // ── Default: narrative event with custom prompt ──

  // 2. Mark as fired
  await supabase
    .from("party_scheduled_events")
    .update({ status: "fired" })
    .eq("id", eventId);

  // 3. Fetch party members and recent messages
  const { data: members } = await supabase
    .from("party_members")
    .select("user_id, character_name, character_status")
    .eq("party_id", partyId);

  const { data: recentMessages } = await supabase
    .from("party_dm_messages")
    .select("role, content, team")
    .eq("party_id", partyId)
    .order("created_at", { ascending: true })
    .limit(100);

  // 4. Insert a system-level user message describing the scheduled event
  const eventPromptText = `[SCHEDULED EVENT: ${event.event_name}]\n${event.event_prompt}`;
  await supabase.from("party_dm_messages").insert({
    party_id: partyId,
    role: "user",
    content: eventPromptText,
    sender_user_id: null,
    sender_name: "⏰ Scheduled Event",
  });

  // 5. Build AI messages
  const apiMessages = (recentMessages || [])
    .map((m: Record<string, unknown>) => ({
      role: m.role as string,
      content: m.content as string,
    }));
  apiMessages.push({ role: "user", content: eventPromptText });

  // 6. Fetch GM guides
  let customGuides: string | null = null;
  const { data: party } = await supabase
    .from("parties")
    .select("created_by")
    .eq("id", partyId)
    .single();

  if (party?.created_by) {
    const { data: guides } = await supabase
      .from("gm_guides")
      .select("name, content")
      .eq("user_id", party.created_by)
      .eq("enabled", true);

    if (guides && guides.length > 0) {
      customGuides = guides.map((g: Record<string, unknown>) => `### ${g.name}\n${g.content}`).join('\n\n');
    }
  }

  // Fetch campaign summary from dm_session shared state
  let campaignSummary: string | null = null;
  const { data: sessionState } = await supabase
    .from("party_shared_state")
    .select("state_data")
    .eq("party_id", partyId)
    .eq("state_type", "dm_session")
    .limit(1)
    .single();

  if (sessionState?.state_data) {
    campaignSummary = (sessionState.state_data as Record<string, unknown>).campaignSummary as string | null;
  }

  const systemPrompt = buildServerSystemPrompt(
    (members || []) as Array<{ character_name: string; character_status: Record<string, unknown> }>,
    campaignSummary,
    customGuides
  );

  // 7. Call AI
  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...apiMessages.slice(-100),
      ],
      stream: false,
      max_tokens: 8000,
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error(`[scheduled-event] AI error for event ${eventId}:`, aiResponse.status, errText);
    await supabase.from("party_scheduled_events").update({ status: "failed" }).eq("id", eventId);
    return false;
  }

  const aiResult = await aiResponse.json();
  const assistantContent = aiResult.choices?.[0]?.message?.content || "";

  if (assistantContent.trim()) {
    await supabase.from("party_dm_messages").insert({
      party_id: partyId,
      role: "assistant",
      content: assistantContent,
      sender_user_id: null,
      sender_name: "DM",
    });
  }

  console.log(`[scheduled-event] Event ${eventId} completed for party ${partyId}`);

  // Schedule next recurrence if applicable
  await scheduleNextRecurrence(supabase, event, partyId);

  return true;
}

// ── Handle scheduled round advance ──
// Collects all submitted prompts, fills gaps with AFK guides, and runs normal round generation
async function handleScheduledRound(
  supabase: ReturnType<typeof createClient>,
  partyId: string,
  eventId: string,
  event: Record<string, unknown>
): Promise<boolean> {
  // 1. Mark as fired
  await supabase
    .from("party_scheduled_events")
    .update({ status: "fired" })
    .eq("id", eventId);

  // 2. Fetch dm_session shared state to get current round
  const { data: sessionState } = await supabase
    .from("party_shared_state")
    .select("id, state_data")
    .eq("party_id", partyId)
    .eq("state_type", "dm_session")
    .limit(1)
    .single();

  if (!sessionState?.state_data) {
    console.error(`[scheduled-round] No dm_session found for party ${partyId}`);
    await supabase.from("party_scheduled_events").update({ status: "failed" }).eq("id", eventId);
    return false;
  }

  const config = sessionState.state_data as Record<string, unknown>;
  const roundId = config.currentRoundId as string;

  // 3. Lock generation
  const { data: lockData, error: lockErr } = await supabase
    .from("party_shared_state")
    .update({ state_data: { ...config, isGenerating: true } })
    .eq("id", sessionState.id)
    .eq("state_type", "dm_session")
    .not("state_data->isGenerating", "eq", true)
    .select("id");

  if (lockErr || !lockData || lockData.length === 0) {
    console.log(`[scheduled-round] Party ${partyId}: already generating, skipping`);
    return false;
  }

  try {
    // 4. Fetch party members
    const { data: members } = await supabase
      .from("party_members")
      .select("user_id, character_name, character_status")
      .eq("party_id", partyId);

    // 5. Fetch submitted prompts for this round
    const { data: readyPrompts } = await supabase
      .from("party_dm_prompts")
      .select("*")
      .eq("party_id", partyId)
      .eq("round_id", roundId)
      .eq("is_ready", true);

    // 6. For players who readied up without a prompt, or didn't submit at all → use AFK guides
    // Treat ALL members as potentially AFK — the buildAfkContext function handles absent members
    const submittedPrompts = (readyPrompts || []) as Array<{ user_id: string; character_name: string; prompt: string }>;
    
    const { promptSection: afkPrompts, guidesSection: afkGuides } = buildAfkContext(
      submittedPrompts,
      (members || []) as Array<{ user_id: string; character_name: string; character_status: Record<string, unknown> }>
    );

    // Build combined prompt from submitted + AFK
    const playerLines = submittedPrompts
      .map(p => `[${p.character_name}]: ${p.prompt?.trim() || '(no action)'}`)
      .join('\n');
    
    const combinedPrompt = (playerLines + afkPrompts).trim() || '[All players are AFK this round]';

    // 7. Insert user message
    const eventLabel = event.event_name ? ` — ${event.event_name}` : '';
    await supabase.from("party_dm_messages").insert({
      party_id: partyId,
      role: "user",
      content: `[⏰ Scheduled Round${eventLabel}]\n${combinedPrompt}`,
      sender_user_id: null,
      sender_name: "⏰ Scheduled Round",
    });

    // 8. Fetch recent messages for context
    const { data: recentMessages } = await supabase
      .from("party_dm_messages")
      .select("role, content, team")
      .eq("party_id", partyId)
      .order("created_at", { ascending: true })
      .limit(100);

    const apiMessages = (recentMessages || [])
      .map((m: Record<string, unknown>) => ({
        role: m.role as string,
        content: m.content as string,
      }));

    // 9. Fetch GM guides
    let customGuides: string | null = null;
    const { data: party } = await supabase
      .from("parties")
      .select("created_by")
      .eq("id", partyId)
      .single();

    if (party?.created_by) {
      const { data: guides } = await supabase
        .from("gm_guides")
        .select("name, content")
        .eq("user_id", party.created_by)
        .eq("enabled", true);

      if (guides && guides.length > 0) {
        customGuides = guides.map((g: Record<string, unknown>) => `### ${g.name}\n${g.content}`).join('\n\n');
      }
    }

    const systemPrompt = buildServerSystemPrompt(
      (members || []) as Array<{ character_name: string; character_status: Record<string, unknown> }>,
      config.campaignSummary as string | null,
      [customGuides || '', afkGuides].filter(Boolean).join('\n\n') || null
    );

    // 10. Call AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...apiMessages.slice(-100),
        ],
        stream: false,
        max_tokens: 8000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[scheduled-round] AI error for party ${partyId}:`, aiResponse.status, errText);
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const assistantContent = aiResult.choices?.[0]?.message?.content || "";

    if (assistantContent.trim()) {
      await supabase.from("party_dm_messages").insert({
        party_id: partyId,
        role: "assistant",
        content: assistantContent,
        sender_user_id: null,
        sender_name: "DM",
      });
    }

    // 11. Consume cascade prompts for AFK members
    if (members) {
      const absentMembers = (members as Array<{ user_id: string; character_status: Record<string, unknown> }>)
        .filter(m => !submittedPrompts.some(p => p.user_id === m.user_id));
      for (const m of absentMembers) {
        const cascade = m.character_status?.afkPromptCascade as string[] | null;
        if (cascade && cascade.length > 0) {
          await supabase
            .from("party_members")
            .update({
              character_status: {
                ...m.character_status,
                afkPromptCascade: cascade.length > 1 ? cascade.slice(1) : null,
              },
            })
            .eq("party_id", partyId)
            .eq("user_id", m.user_id);
        }
      }
    }

    // 12. Delete prompts and start new round
    await supabase
      .from("party_dm_prompts")
      .delete()
      .eq("party_id", partyId)
      .eq("round_id", roundId);

    const newRoundId = crypto.randomUUID();
    await supabase
      .from("party_shared_state")
      .update({
        state_data: {
          ...config,
          currentRoundId: newRoundId,
          isGenerating: false,
          timerStartedAt: config.timerEnabled ? new Date().toISOString() : null,
          timerPausedRemaining: null,
          extensionRequests: [],
        },
      })
      .eq("id", sessionState.id)
      .eq("state_type", "dm_session");

    console.log(`[scheduled-round] Event ${eventId} completed for party ${partyId}, round advanced`);

    // Schedule next recurrence if applicable
    await scheduleNextRecurrence(supabase, event, partyId);

    return true;
  } catch (genError) {
    console.error(`[scheduled-round] Generation failed for party ${partyId}:`, genError);
    await supabase
      .from("party_shared_state")
      .update({ state_data: { ...config, isGenerating: false } })
      .eq("id", sessionState.id)
      .eq("state_type", "dm_session");
    await supabase.from("party_scheduled_events").update({ status: "failed" }).eq("id", eventId);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate: accept trigger secret from header (pg_cron) OR body (QStash callback)
    let body: Record<string, unknown> = {};
    let targetPartyId: string | null = null;

    try {
      body = await req.json();
    } catch {
      // empty body is fine for cron
    }

    const triggerHeader = req.headers.get("X-Trigger-Secret");
    const bodySecret = body.triggerSecret as string | undefined;

    if (triggerHeader !== TRIGGER_SECRET && bodySecret !== TRIGGER_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If QStash sends a specific partyId, only process that party
    if (body.partyId && typeof body.partyId === "string") {
      targetPartyId = body.partyId;
    }

    const eventId = body.eventId as string | undefined;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Handle scheduled narrative events ──
    if (eventId && targetPartyId) {
      console.log(`[timer-gen] Processing scheduled event ${eventId} for party ${targetPartyId}`);
      const eventGenerated = await handleScheduledEvent(supabase, targetPartyId, eventId);
      return new Response(JSON.stringify({ ok: true, generated: eventGenerated ? 1 : 0, type: "scheduled_event" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Normal timer-based generation ──
    // 1. Find dm_session shared states (scoped to a single party if targeted)
    let query = supabase
      .from("party_shared_state")
      .select("id, party_id, state_data")
      .eq("state_type", "dm_session");

    if (targetPartyId) {
      query = query.eq("party_id", targetPartyId);
    }

    const { data: sessions, error: sessErr } = await query;

    if (sessErr) {
      console.error("Failed to fetch sessions:", sessErr);
      return new Response(JSON.stringify({ error: "DB error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let generated = 0;

    for (const session of sessions || []) {
      const config = session.state_data as Record<string, unknown>;

      // Skip if not active, already generating, or timer not enabled/started
      if (!config?.active) continue;
      if (config.isGenerating) continue;
      if (!config.timerEnabled) continue;
      if (!config.timerStartedAt) continue;

      // Check if timer has expired
      const startedAt = new Date(config.timerStartedAt as string).getTime();
      const duration = (config.timerDurationSeconds as number) || 0;
      const elapsed = (Date.now() - startedAt) / 1000;
      if (elapsed < duration) continue; // not yet expired

      const partyId = session.party_id;
      const roundId = config.currentRoundId as string;

      // 2. Check for ready prompts in this round
      const { data: prompts, error: promptErr } = await supabase
        .from("party_dm_prompts")
        .select("*")
        .eq("party_id", partyId)
        .eq("round_id", roundId)
        .eq("is_ready", true);

      if (promptErr || !prompts || prompts.length === 0) continue;

      // 3. Atomically lock: set isGenerating=true only if still false
      const { data: lockData, error: lockErr } = await supabase
        .from("party_shared_state")
        .update({
          state_data: { ...config, isGenerating: true },
        })
        .eq("id", session.id)
        .eq("state_type", "dm_session")
        .not("state_data->isGenerating", "eq", true)
        .select("id");

      if (lockErr || !lockData || lockData.length === 0) {
        console.log(`[timer-gen] Party ${partyId}: already generating, skipping`);
        continue;
      }

      console.log(`[timer-gen] Party ${partyId}: timer expired, generating response for ${prompts.length} prompts`);

      try {
        // 4. Fetch party members
        const { data: members } = await supabase
          .from("party_members")
          .select("user_id, character_name, character_status")
          .eq("party_id", partyId);

        // 5. Fetch recent messages for context
        const { data: recentMessages } = await supabase
          .from("party_dm_messages")
          .select("role, content, team")
          .eq("party_id", partyId)
          .order("created_at", { ascending: true })
          .limit(100);

        // 6. Build the combined prompt from ready player prompts
        const { promptSection: afkPrompts, guidesSection: afkGuides } = buildAfkContext(
          prompts as Array<{ user_id: string; character_name: string; prompt: string }>,
          (members || []) as Array<{ user_id: string; character_name: string; character_status: Record<string, unknown> }>
        );

        const combinedPrompt = prompts
          .map((p: Record<string, unknown>) => `[${p.character_name}]: ${(p.prompt as string)?.trim() || '(no action)'}`)
          .join('\n') + afkPrompts;

        // 7. Insert the user message
        await supabase.from("party_dm_messages").insert({
          party_id: partyId,
          role: "user",
          content: combinedPrompt,
          sender_user_id: null,
          sender_name: "Party",
        });

        // 8. Build API messages
        const apiMessages = (recentMessages || [])
          .map((m: Record<string, unknown>) => ({
            role: m.role as string,
            content: m.content as string,
          }));
        apiMessages.push({ role: "user", content: combinedPrompt });

        // Fetch any gm_guides used by the party host
        let customGuides: string | null = null;
        const { data: party } = await supabase
          .from("parties")
          .select("created_by")
          .eq("id", partyId)
          .single();

        if (party?.created_by) {
          const { data: guides } = await supabase
            .from("gm_guides")
            .select("name, content")
            .eq("user_id", party.created_by)
            .eq("enabled", true);

          if (guides && guides.length > 0) {
            customGuides = guides.map((g: Record<string, unknown>) => `### ${g.name}\n${g.content}`).join('\n\n');
          }
        }

        const systemPrompt = buildServerSystemPrompt(
          (members || []) as Array<{ character_name: string; character_status: Record<string, unknown> }>,
          config.campaignSummary as string | null,
          [customGuides || '', afkGuides].filter(Boolean).join('\n\n') || null
        );

        // 9. Call AI (non-streaming)
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL,
            messages: [
              { role: "system", content: systemPrompt },
              ...apiMessages.slice(-100),
            ],
            stream: false,
            max_tokens: 8000,
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`[timer-gen] AI error for party ${partyId}:`, aiResponse.status, errText);
          throw new Error(`AI error: ${aiResponse.status}`);
        }

        const aiResult = await aiResponse.json();
        const assistantContent = aiResult.choices?.[0]?.message?.content || "";

        if (assistantContent.trim()) {
          // 10. Insert assistant message
          await supabase.from("party_dm_messages").insert({
            party_id: partyId,
            role: "assistant",
            content: assistantContent,
            sender_user_id: null,
            sender_name: "DM",
          });
        }

        // 11. Consume cascade prompts for AFK members
        if (members) {
          const absentMembers = (members as Array<{ user_id: string; character_status: Record<string, unknown> }>)
            .filter(m => !prompts.some((p: Record<string, unknown>) => p.user_id === m.user_id));
          for (const m of absentMembers) {
            const cascade = m.character_status?.afkPromptCascade as string[] | null;
            if (cascade && cascade.length > 0) {
              await supabase
                .from("party_members")
                .update({
                  character_status: {
                    ...m.character_status,
                    afkPromptCascade: cascade.length > 1 ? cascade.slice(1) : null,
                  },
                })
                .eq("party_id", partyId)
                .eq("user_id", m.user_id);
            }
          }
        }

        // 12. Delete prompts and start new round
        await supabase
          .from("party_dm_prompts")
          .delete()
          .eq("party_id", partyId)
          .eq("round_id", roundId);

        const newRoundId = crypto.randomUUID();
        await supabase
          .from("party_shared_state")
          .update({
            state_data: {
              ...config,
              currentRoundId: newRoundId,
              isGenerating: false,
              timerStartedAt: config.timerEnabled ? new Date().toISOString() : null,
              timerPausedRemaining: null,
              extensionRequests: [],
            },
          })
          .eq("id", session.id)
          .eq("state_type", "dm_session");

        generated++;
        console.log(`[timer-gen] Party ${partyId}: generation complete`);
      } catch (genError) {
        console.error(`[timer-gen] Generation failed for party ${partyId}:`, genError);
        // Unlock
        await supabase
          .from("party_shared_state")
          .update({
            state_data: { ...config, isGenerating: false },
          })
          .eq("id", session.id)
          .eq("state_type", "dm_session");
      }
    }

    return new Response(JSON.stringify({ ok: true, generated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[timer-gen] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
