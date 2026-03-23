import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const LOVABLE_MODELS = new Set([
  'google/gemini-3-pro-preview', 'google/gemini-2.5-pro', 'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite', 'google/gemini-3-flash-preview',
  'openai/gpt-5', 'openai/gpt-5-mini', 'openai/gpt-5-nano', 'openai/gpt-5.2',
]);

const ANTHROPIC_MODELS: Record<string, string> = {
  'anthropic/claude-sonnet-4': 'claude-sonnet-4-20250514',
  'anthropic/claude-sonnet-4-5': 'claude-sonnet-4-5-20250929',
  'anthropic/claude-sonnet-4-6': 'claude-sonnet-4-6-20260219',
  'anthropic/claude-haiku-4-5': 'claude-haiku-4-5-20251001',
};

const OPENAI_DIRECT_MODELS: Record<string, string> = {
  'openai-direct/gpt-5': 'gpt-5',
  'openai-direct/gpt-4o': 'gpt-4o',
  'openai-direct/gpt-4o-mini': 'gpt-4o-mini',
  'openai-direct/gpt-4-turbo': 'gpt-4-turbo',
  'openai-direct/o1': 'o1',
  'openai-direct/o1-mini': 'o1-mini',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const triggerSecret = Deno.env.get('TRIGGER_SECRET')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Query due jobs
  const { data: jobs, error: queryErr } = await supabase
    .from('scheduled_telegram_jobs')
    .select('*')
    .eq('status', 'pending')
    .lte('run_at', new Date().toISOString())
    .order('run_at', { ascending: true })
    .limit(10);

  if (queryErr) {
    console.error('Query error:', queryErr);
    return new Response(JSON.stringify({ error: queryErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!jobs || jobs.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0, failed: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let successCount = 0;
  let failCount = 0;

  for (const job of jobs) {
    try {
      // a. Mark as running
      await supabase
        .from('scheduled_telegram_jobs')
        .update({ status: 'running', updated_at: new Date().toISOString() })
        .eq('id', job.id);

      // b. Build the message
      let finalMessage: string;

      if (job.ai_prompt && job.ai_prompt.trim()) {
        // AI-powered message — mode-aware system prompt and context
        const mode = job.dm_context_mode || 'party';

        let systemPrompt: string;
        let userMessage = job.ai_prompt;

        if (mode === 'empyrean_dragon') {
          // Extract dragon metadata from job_name fallback: "[DragonName] Dragon Message"
          const dragonName = job.job_name?.replace(/ Dragon Message$/i, '') || 'Unknown Dragon';
          const dragonMood = 'calm';
          const dragonBond = 50;

          systemPrompt =
            `You are ${dragonName}, a powerful bonded dragon in the Empyrean world of Basgiath War College. Your mood is ${dragonMood}. Your bond level with your rider is ${dragonBond}/100. Speak in first person as the dragon — ancient, proud, and emotionally layered. Keep the message under 3 sentences. Do not break character. Reference the rider's prompt naturally. Use HTML formatting: <b>bold</b>, <i>italic</i>. Do NOT use markdown. Keep the response under 3000 characters.`;
        } else if (mode === 'solo') {
          systemPrompt =
            'You are an expert Dungeon Master running a D&D 5e session. You are immersive, adaptive, and mechanically precise. The user has scheduled an automated task. Execute their request and write the output as a Telegram message. Use HTML formatting: <b>bold</b>, <i>italic</i>, <u>underline</u>. Do NOT use markdown. Keep the response under 3000 characters.';
        } else if (mode === 'empyrean') {
          systemPrompt =
            'You are the Dungeon Master for an Empyrean campaign set at Basgiath War College — a dragon-rider fantasy inspired by Fourth Wing. You are immersive, dramatic, and deeply aware of dragon bonds, signet abilities, and war college politics. The user has scheduled an automated task. Execute their request and write the output as a Telegram message. Use HTML formatting: <b>bold</b>, <i>italic</i>, <u>underline</u>. Do NOT use markdown. Keep the response under 3000 characters.';
        } else {
          // party (default)
          systemPrompt =
            'You are an expert Dungeon Master running a multiplayer D&D 5e session for a party of adventurers. You are immersive, adaptive, and aware of all party members and their shared story. The user has scheduled an automated task. Execute their request and write the output as a Telegram message. Use HTML formatting: <b>bold</b>, <i>italic</i>, <u>underline</u>. Do NOT use markdown. Keep the response under 3000 characters.';
        }

        // Fetch context based on mode
        if (job.include_campaign_context) {
          try {
            if (mode === 'party' && job.party_id) {
              // Party mode: fetch party-specific context
              const [summaryRes, membersRes, messagesRes] = await Promise.all([
                supabase
                  .from('party_shared_state')
                  .select('state_data')
                  .eq('party_id', job.party_id)
                  .eq('state_type', 'dm_session')
                  .order('updated_at', { ascending: false })
                  .limit(1)
                  .maybeSingle(),
                supabase
                  .from('party_members')
                  .select('character_name, character_status')
                  .eq('party_id', job.party_id),
                supabase
                  .from('party_dm_messages')
                  .select('content, sender_name, role')
                  .eq('party_id', job.party_id)
                  .order('created_at', { ascending: false })
                  .limit(10),
              ]);

              const contextParts: string[] = ['PARTY CAMPAIGN CONTEXT:'];

              // Campaign summary from shared state
              const sessionState = summaryRes.data?.state_data as any;
              if (sessionState?.campaignSummary) {
                contextParts.push(`Campaign Summary: ${String(sessionState.campaignSummary).substring(0, 3000)}`);
              }

              // Party members
              const members = membersRes.data;
              if (members && members.length > 0) {
                contextParts.push('Party Members:');
                for (const m of members) {
                  const cs = m.character_status as any;
                  const cls = cs?.class || 'Unknown';
                  const lvl = cs?.level || '?';
                  contextParts.push(`  - ${m.character_name} (Level ${lvl} ${cls})`);
                }
              }

              // Recent DM narrative
              const msgs = messagesRes.data;
              if (msgs && msgs.length > 0) {
                contextParts.push('Recent Narrative (newest first):');
                for (const msg of msgs.slice(0, 5)) {
                  const preview = msg.content.substring(0, 300);
                  contextParts.push(`  [${msg.sender_name}]: ${preview}`);
                }
              }

              if (contextParts.length > 1) {
                userMessage = contextParts.join('\n') + `\n\nUSER REQUEST:\n${job.ai_prompt}`;
              }

            } else {
              // Solo and Empyrean: fetch user's personal campaign data
              const [campaignRes, gameStateRes, charRes] = await Promise.all([
                supabase
                  .from('ai_dm_campaigns')
                  .select('name, campaign_summary')
                  .eq('user_id', job.user_id)
                  .order('updated_at', { ascending: false })
                  .limit(1)
                  .maybeSingle(),
                supabase
                  .from('dm_game_state')
                  .select('quest_flags')
                  .eq('user_id', job.user_id)
                  .order('updated_at', { ascending: false })
                  .limit(1)
                  .maybeSingle(),
                supabase
                  .from('character_saves')
                  .select('character_data, extended_data')
                  .eq('user_id', job.user_id)
                  .order('updated_at', { ascending: false })
                  .limit(1)
                  .maybeSingle(),
              ]);

              const campaign = campaignRes.data;
              const gameState = gameStateRes.data;
              const charSave = charRes.data;

              if (campaign || gameState || charSave) {
                const contextLabel = mode === 'empyrean'
                  ? 'EMPYREAN CAMPAIGN CONTEXT (Dragon-rider campaign at Basgiath War College):'
                  : 'CAMPAIGN CONTEXT:';
                const contextParts: string[] = [contextLabel];

                if (campaign) {
                  contextParts.push(`Campaign: ${campaign.name || 'Unknown'}`);
                  if (campaign.campaign_summary) {
                    contextParts.push(`Summary: ${campaign.campaign_summary.substring(0, 3000)}`);
                  }
                }

                if (charSave) {
                  const cd = charSave.character_data as any;
                  const ed = charSave.extended_data as any;
                  const charName = cd?.name || 'Unknown';
                  const charClass = cd?.class || 'Unknown';
                  const charLevel = cd?.level || '?';
                  const hpState = ed?.hpState;
                  const currentHP = hpState?.current ?? '?';
                  const maxHP = hpState?.max ?? '?';
                  contextParts.push(`Character: ${charName}, Level ${charLevel} ${charClass}, ${currentHP}/${maxHP} HP`);
                }

                if (gameState?.quest_flags) {
                  contextParts.push(`Active Quests: ${JSON.stringify(gameState.quest_flags)}`);
                }

                userMessage = contextParts.join('\n') + `\n\nUSER REQUEST:\n${job.ai_prompt}`;
              }
            }
          } catch (ctxErr) {
            console.error(`Context fetch error for job ${job.id}:`, ctxErr);
            // Continue without context
          }
        }

        // Call AI — route by provider
        const selectedModel = job.ai_model || 'google/gemini-2.5-flash-lite';

        if (ANTHROPIC_MODELS[selectedModel]) {
          // Anthropic direct
          const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
          if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not configured for Anthropic model');

          const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': anthropicKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: ANTHROPIC_MODELS[selectedModel],
              max_tokens: 2000,
              system: systemPrompt,
              messages: [{ role: 'user', content: userMessage }],
            }),
          });

          if (!aiResponse.ok) {
            const errText = await aiResponse.text();
            throw new Error(`Anthropic error [${aiResponse.status}]: ${errText}`);
          }

          const aiData = await aiResponse.json();
          finalMessage = aiData.content?.[0]?.text || 'No response generated.';

        } else if (OPENAI_DIRECT_MODELS[selectedModel]) {
          // OpenAI direct — fetch user's key
          let openaiKey: string | null = null;
          try {
            const { data: keyRow } = await supabase
              .from('user_api_keys')
              .select('openai_key')
              .eq('user_id', job.user_id)
              .maybeSingle();
            openaiKey = keyRow?.openai_key || null;
          } catch { /* ignore */ }

          if (!openaiKey) {
            // Fall back to Lovable gateway default
            console.warn(`No OpenAI key for user ${job.user_id}, falling back to gateway`);
            const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: { Authorization: `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash-lite',
                max_tokens: 2000,
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
              }),
            });
            if (!aiResponse.ok) {
              const errText = await aiResponse.text();
              throw new Error(`AI gateway error [${aiResponse.status}]: ${errText}`);
            }
            const aiData = await aiResponse.json();
            finalMessage = aiData.choices?.[0]?.message?.content || 'No response generated.';
          } else {
            const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: OPENAI_DIRECT_MODELS[selectedModel],
                max_tokens: 2000,
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
              }),
            });
            if (!aiResponse.ok) {
              const errText = await aiResponse.text();
              throw new Error(`OpenAI error [${aiResponse.status}]: ${errText}`);
            }
            const aiData = await aiResponse.json();
            finalMessage = aiData.choices?.[0]?.message?.content || 'No response generated.';
          }

        } else {
          // Lovable gateway
          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: selectedModel,
              max_tokens: 2000,
              messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
            }),
          });

          if (!aiResponse.ok) {
            const errText = await aiResponse.text();
            throw new Error(`AI gateway error [${aiResponse.status}]: ${errText}`);
          }

          const aiData = await aiResponse.json();
          finalMessage = aiData.choices?.[0]?.message?.content || 'No response generated.';
        }
      } else {
        // Static message
        finalMessage = job.static_message || 'No message configured.';
      }

      // Prefix dragon name for empyrean_dragon mode
      const mode = job.dm_context_mode || 'party';
      if (mode === 'empyrean_dragon') {
        const dragonName = job.job_name?.replace(/ Dragon Message$/i, '') || 'Unknown Dragon';
        finalMessage = `🐉 ${dragonName}: ${finalMessage}`;
      }

      // c. Send via telegram-notify
      const notifyPayload: Record<string, unknown> = {
        type: mode === 'empyrean_dragon' ? 'dragon_message' : 'custom',
        title: job.job_name,
        body: finalMessage,
        targetUserIds: job.target_user_ids || [job.user_id],
        partyId: job.party_id || undefined,
        mode: mode === 'empyrean_dragon' ? 'empyrean' : (mode || undefined),
        dragonName: mode === 'empyrean_dragon' ? job.job_name?.replace(/ Dragon Message$/i, '') : undefined,
      };

      // If specific chat IDs are targeted, pass them through
      if (job.target_chat_ids && job.target_chat_ids.length > 0) {
        notifyPayload.targetChatIds = job.target_chat_ids;
      }

      const notifyRes = await fetch(
        `${supabaseUrl}/functions/v1/telegram-notify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Trigger-Secret': triggerSecret,
          },
          body: JSON.stringify(notifyPayload),
        }
      );

      if (!notifyRes.ok) {
        const errText = await notifyRes.text();
        throw new Error(`telegram-notify error [${notifyRes.status}]: ${errText}`);
      }

      await notifyRes.text(); // consume body

      // d. Update job on success
      const now = new Date().toISOString();

      if (job.repeat_daily && job.run_time) {
        // Parse HH:MM and schedule for tomorrow
        const [hours, minutes] = job.run_time.split(':').map(Number);
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(hours, minutes, 0, 0);

        await supabase
          .from('scheduled_telegram_jobs')
          .update({
            status: 'pending',
            run_at: tomorrow.toISOString(),
            last_run_at: now,
            last_result: finalMessage.substring(0, 10000),
            error_message: null,
            updated_at: now,
          })
          .eq('id', job.id);
      } else {
        await supabase
          .from('scheduled_telegram_jobs')
          .update({
            status: 'completed',
            last_run_at: now,
            last_result: finalMessage.substring(0, 10000),
            error_message: null,
            updated_at: now,
          })
          .eq('id', job.id);
      }

      successCount++;
    } catch (err: any) {
      console.error(`Job ${job.id} failed:`, err);
      failCount++;

      await supabase
        .from('scheduled_telegram_jobs')
        .update({
          status: 'failed',
          error_message: err?.message || String(err),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, processed: successCount, failed: failCount }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
