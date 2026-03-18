import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function rollDice(expression: string): { total: number; breakdown: string } | null {
  const match = expression.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) return null;
  const count = Math.min(parseInt(match[1]), 100);
  const sides = Math.min(parseInt(match[2]), 1000);
  const modifier = match[3] ? parseInt(match[3]) : 0;
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  const sum = rolls.reduce((a, b) => a + b, 0);
  const total = sum + modifier;
  const modStr = modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${Math.abs(modifier)}` : '';
  return { total, breakdown: `[${rolls.join(', ')}]${modStr} = ${total}` };
}

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function modStr(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

async function sendTelegram(chatId: number, text: string, lovableKey: string, telegramKey: string) {
  const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': telegramKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`sendMessage failed [${res.status}]:`, err);
  }
  return res;
}

// ── Character data fetcher ───────────────────────────────────────────────────

async function getCharacterData(userId: string, supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase
    .from('character_saves')
    .select('character_data, extended_data, equipment_data, xp_data')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function getUserIdFromChat(chatId: number, supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data } = await supabase
    .from('telegram_user_links')
    .select('user_id')
    .eq('chat_id', chatId)
    .maybeSingle();
  return data?.user_id || null;
}

// ── Command processor ────────────────────────────────────────────────────────

async function processCommand(
  chatId: number,
  text: string,
  username: string | null,
  supabase: ReturnType<typeof createClient>,
  lovableKey: string,
  telegramKey: string,
) {
  const cmd = text.trim().toLowerCase();
  const parts = text.trim().split(/\s+/);

  // /start
  if (cmd === '/start') {
    await sendTelegram(chatId,
      `⚔️ <b>Odyssey Assassin Bot</b>\n\n` +
      `Link your account to receive party notifications, check your character, and roll dice from Telegram.\n\n` +
      `Type /help for all commands.`,
      lovableKey, telegramKey,
    );
    return;
  }

  // /help
  if (cmd === '/help') {
    await sendTelegram(chatId,
      `📜 <b>Available Commands</b>\n\n` +
      `<b>🔗 Account</b>\n` +
      `/link CODE — Link your Odyssey account\n` +
      `/unlink — Unlink your account\n` +
      `/status — Check link status\n` +
      `/notify on|off — Toggle notifications\n\n` +
      `<b>🎭 Character</b>\n` +
      `/character — Character summary\n` +
      `/stats — Ability scores\n` +
      `/hp — Current HP\n` +
      `/slots — Spell slot usage\n\n` +
      `<b>⚔️ Actions</b>\n` +
      `/damage N — Take N damage\n` +
      `/heal N — Heal N HP\n` +
      `/cast LEVEL — Use a spell slot\n` +
      `/initiative — Roll initiative\n` +
      `/roll NdS+M — Roll dice\n\n` +
      `<b>📖 Campaign</b>\n` +
      `/quests — Active quest flags\n` +
      `/lore QUESTION — AI lore lookup\n` +
      `/recap — AI session recap`,
      lovableKey, telegramKey,
    );
    return;
  }

  // /link CODE
  if (cmd.startsWith('/link ')) {
    const code = parts[1]?.toUpperCase();
    if (!code) {
      await sendTelegram(chatId, '❌ Usage: /link YOUR_CODE', lovableKey, telegramKey);
      return;
    }
    const { data: linkCode } = await supabase
      .from('telegram_link_codes')
      .select('*')
      .eq('code', code)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();
    if (!linkCode) {
      await sendTelegram(chatId, '❌ Invalid or expired code. Generate a new one in Settings → Telegram.', lovableKey, telegramKey);
      return;
    }
    const { error: linkErr } = await supabase
      .from('telegram_user_links')
      .upsert({
        user_id: linkCode.user_id,
        chat_id: chatId,
        username: username || null,
        linked_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (linkErr) {
      console.error('Link upsert error:', linkErr);
      await sendTelegram(chatId, '❌ Failed to link account. Try again.', lovableKey, telegramKey);
      return;
    }
    await supabase.from('telegram_link_codes').delete().eq('id', linkCode.id);
    await sendTelegram(chatId,
      `✅ <b>Account linked!</b>\n\nYou'll now receive party notifications here. Type /character to see your sheet.`,
      lovableKey, telegramKey,
    );
    return;
  }

  // /unlink
  if (cmd === '/unlink') {
    const { error } = await supabase.from('telegram_user_links').delete().eq('chat_id', chatId);
    await sendTelegram(chatId,
      error ? '❌ Failed to unlink.' : '✅ Account unlinked.',
      lovableKey, telegramKey,
    );
    return;
  }

  // /status
  if (cmd === '/status') {
    const { data: link } = await supabase
      .from('telegram_user_links')
      .select('linked_at, notify_ready_up, notify_timer, notify_combat, notify_dragon')
      .eq('chat_id', chatId)
      .maybeSingle();
    if (!link) {
      await sendTelegram(chatId, '🔗 Not linked. Use /link CODE to connect.', lovableKey, telegramKey);
    } else {
      const f = (v: boolean) => v ? '✅' : '❌';
      await sendTelegram(chatId,
        `🔗 <b>Linked</b> since ${new Date(link.linked_at).toLocaleDateString()}\n\n` +
        `${f(link.notify_ready_up)} Ready-ups\n${f(link.notify_timer)} Timer\n${f(link.notify_combat)} Combat\n${f(link.notify_dragon)} Dragon Bond`,
        lovableKey, telegramKey,
      );
    }
    return;
  }

  // /notify on|off
  if (cmd.startsWith('/notify ')) {
    const toggle = parts[1]?.toLowerCase();
    if (toggle !== 'on' && toggle !== 'off') {
      await sendTelegram(chatId, '❌ Usage: /notify on or /notify off', lovableKey, telegramKey);
      return;
    }
    const enabled = toggle === 'on';
    const { error } = await supabase
      .from('telegram_user_links')
      .update({ notify_ready_up: enabled, notify_timer: enabled, notify_combat: enabled, notify_dragon: enabled })
      .eq('chat_id', chatId);
    await sendTelegram(chatId,
      error ? '❌ Failed to update.' : `✅ All notifications ${enabled ? 'enabled' : 'disabled'}.`,
      lovableKey, telegramKey,
    );
    return;
  }

  // /roll NdS+M
  if (cmd.startsWith('/roll ')) {
    const expr = parts[1];
    const result = rollDice(expr || '');
    if (!result) {
      await sendTelegram(chatId, '❌ Invalid dice. Usage: /roll 2d20+5', lovableKey, telegramKey);
    } else {
      await sendTelegram(chatId, `🎲 <b>${expr}</b>\n${result.breakdown}`, lovableKey, telegramKey);
    }
    return;
  }

  // ── Character commands (require linked account) ──

  // /character
  if (cmd === '/character') {
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first with /link CODE', lovableKey, telegramKey); return; }
    const save = await getCharacterData(userId, supabase);
    if (!save) { await sendTelegram(chatId, '❌ No character found. Create one in the app first.', lovableKey, telegramKey); return; }
    const c = save.character_data as any;
    const ext = (save.extended_data || {}) as any;
    const hp = ext.hpState;
    const identity = ext.characterIdentity;
    const gold = ext.shopGold ?? 0;
    const xp = (save.xp_data as any)?.currentXP ?? 0;

    const classStr = c.primaryClass ? c.primaryClass.charAt(0).toUpperCase() + c.primaryClass.slice(1) : 'Adventurer';
    const raceStr = identity?.race || '';
    const genderStr = identity?.gender || '';
    const subtitle = [genderStr, raceStr].filter(Boolean).join(' ');

    let msg = `🎭 <b>${c.name || 'Unnamed'}</b>\n`;
    if (subtitle) msg += `${subtitle}\n`;
    msg += `📊 Level ${c.level || 1} ${classStr}\n`;
    if (hp) msg += `❤️ HP: ${hp.current}/${hp.max}${hp.temp ? ` (+${hp.temp} temp)` : ''}\n`;
    msg += `💰 Gold: ${gold}\n`;
    msg += `✨ XP: ${xp}`;

    // Multiclass info
    if (c.multiclassLevels) {
      const classes = Object.entries(c.multiclassLevels as Record<string, number>)
        .filter(([, lvl]) => (lvl as number) > 0)
        .map(([cls, lvl]) => `${cls.charAt(0).toUpperCase() + cls.slice(1)} ${lvl}`)
        .join(', ');
      if (classes) msg += `\n📚 Classes: ${classes}`;
    }

    if (ext.conditions?.activeConditions?.length) {
      const conds = ext.conditions.activeConditions.map((c: any) => c.name || c.id).join(', ');
      msg += `\n⚠️ Conditions: ${conds}`;
    }

    await sendTelegram(chatId, msg, lovableKey, telegramKey);
    return;
  }

  // /stats
  if (cmd === '/stats') {
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first with /link CODE', lovableKey, telegramKey); return; }
    const save = await getCharacterData(userId, supabase);
    if (!save) { await sendTelegram(chatId, '❌ No character found.', lovableKey, telegramKey); return; }
    const ext = (save.extended_data || {}) as any;
    const scores = ext.abilityScores;
    if (!scores) {
      await sendTelegram(chatId, '❌ No ability scores set. Configure them in the app.', lovableKey, telegramKey);
      return;
    }
    const stats = [
      ['STR', scores.strength],
      ['DEX', scores.dexterity],
      ['CON', scores.constitution],
      ['INT', scores.intelligence],
      ['WIS', scores.wisdom],
      ['CHA', scores.charisma],
    ];
    const lines = stats.map(([name, val]) => `<b>${name}</b>: ${val} (${modStr(abilityMod(val as number))})`);
    await sendTelegram(chatId, `📊 <b>Ability Scores</b>\n\n${lines.join('\n')}`, lovableKey, telegramKey);
    return;
  }

  // /hp
  if (cmd === '/hp') {
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first with /link CODE', lovableKey, telegramKey); return; }
    const save = await getCharacterData(userId, supabase);
    if (!save) { await sendTelegram(chatId, '❌ No character found.', lovableKey, telegramKey); return; }
    const hp = ((save.extended_data || {}) as any).hpState;
    const ds = ((save.extended_data || {}) as any).deathSaves;
    if (!hp) {
      await sendTelegram(chatId, '❌ No HP data. Set it in the app.', lovableKey, telegramKey);
      return;
    }
    let msg = `❤️ <b>Hit Points</b>\n\n`;
    msg += `Current: <b>${hp.current}</b> / ${hp.max}`;
    if (hp.temp) msg += ` (+${hp.temp} temp)`;
    const pct = Math.round((hp.current / hp.max) * 100);
    const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
    msg += `\n[${bar}] ${pct}%`;
    if (ds && (ds.successes > 0 || ds.failures > 0)) {
      msg += `\n\n💀 Death Saves: ✅${ds.successes} ❌${ds.failures}`;
    }
    await sendTelegram(chatId, msg, lovableKey, telegramKey);
    return;
  }

  // /slots
  if (cmd === '/slots') {
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first with /link CODE', lovableKey, telegramKey); return; }
    const save = await getCharacterData(userId, supabase);
    if (!save) { await sendTelegram(chatId, '❌ No character found.', lovableKey, telegramKey); return; }
    const sc = ((save.extended_data || {}) as any).spellcasting;
    if (!sc?.spellSlots || Object.keys(sc.spellSlots).length === 0) {
      await sendTelegram(chatId, '❌ No spell slots configured.', lovableKey, telegramKey);
      return;
    }
    let msg = `🔮 <b>Spell Slots</b>\n\n`;
    const used = sc.usedSlots || {};
    for (const [level, total] of Object.entries(sc.spellSlots as Record<string, number>)) {
      if ((total as number) <= 0) continue;
      const usedCount = (used[level] as number) || 0;
      const remaining = (total as number) - usedCount;
      msg += `Level ${level}: ${'◆'.repeat(remaining)}${'◇'.repeat(usedCount)} (${remaining}/${total})\n`;
    }
    await sendTelegram(chatId, msg, lovableKey, telegramKey);
    return;
  }

  // /damage N
  if (cmd.startsWith('/damage ')) {
    const amount = parseInt(parts[1]);
    if (isNaN(amount) || amount <= 0) {
      await sendTelegram(chatId, '❌ Usage: /damage 15', lovableKey, telegramKey);
      return;
    }
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first.', lovableKey, telegramKey); return; }
    const save = await getCharacterData(userId, supabase);
    if (!save) { await sendTelegram(chatId, '❌ No character found.', lovableKey, telegramKey); return; }
    const ext = (save.extended_data || {}) as any;
    const hp = ext.hpState;
    if (!hp) { await sendTelegram(chatId, '❌ No HP data set.', lovableKey, telegramKey); return; }

    // Apply damage: temp HP absorbs first
    let remaining = amount;
    let newTemp = hp.temp || 0;
    if (newTemp > 0) {
      const absorbed = Math.min(newTemp, remaining);
      newTemp -= absorbed;
      remaining -= absorbed;
    }
    const newCurrent = Math.max(0, hp.current - remaining);
    ext.hpState = { ...hp, current: newCurrent, temp: newTemp };

    await supabase
      .from('character_saves')
      .update({ extended_data: ext })
      .eq('user_id', userId);

    const pct = Math.round((newCurrent / hp.max) * 100);
    let msg = `💥 Took <b>${amount}</b> damage!\n❤️ HP: <b>${newCurrent}</b>/${hp.max}`;
    if (newCurrent === 0) msg += `\n\n💀 <b>You've fallen to 0 HP!</b>`;
    else if (pct <= 25) msg += `\n⚠️ <i>Bloodied!</i>`;
    await sendTelegram(chatId, msg, lovableKey, telegramKey);
    return;
  }

  // /heal N
  if (cmd.startsWith('/heal ')) {
    const amount = parseInt(parts[1]);
    if (isNaN(amount) || amount <= 0) {
      await sendTelegram(chatId, '❌ Usage: /heal 10', lovableKey, telegramKey);
      return;
    }
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first.', lovableKey, telegramKey); return; }
    const save = await getCharacterData(userId, supabase);
    if (!save) { await sendTelegram(chatId, '❌ No character found.', lovableKey, telegramKey); return; }
    const ext = (save.extended_data || {}) as any;
    const hp = ext.hpState;
    if (!hp) { await sendTelegram(chatId, '❌ No HP data set.', lovableKey, telegramKey); return; }

    const newCurrent = Math.min(hp.max, hp.current + amount);
    const healed = newCurrent - hp.current;
    ext.hpState = { ...hp, current: newCurrent };

    await supabase
      .from('character_saves')
      .update({ extended_data: ext })
      .eq('user_id', userId);

    await sendTelegram(chatId,
      `💚 Healed <b>${healed}</b> HP!\n❤️ HP: <b>${newCurrent}</b>/${hp.max}`,
      lovableKey, telegramKey,
    );
    return;
  }

  // /cast LEVEL
  if (cmd.startsWith('/cast ')) {
    const level = parseInt(parts[1]);
    if (isNaN(level) || level < 1 || level > 9) {
      await sendTelegram(chatId, '❌ Usage: /cast 3 (spell level 1-9)', lovableKey, telegramKey);
      return;
    }
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first.', lovableKey, telegramKey); return; }
    const save = await getCharacterData(userId, supabase);
    if (!save) { await sendTelegram(chatId, '❌ No character found.', lovableKey, telegramKey); return; }
    const ext = (save.extended_data || {}) as any;
    const sc = ext.spellcasting;
    if (!sc?.spellSlots) { await sendTelegram(chatId, '❌ No spell slots configured.', lovableKey, telegramKey); return; }

    const total = sc.spellSlots[level.toString()] || 0;
    if (total <= 0) {
      await sendTelegram(chatId, `❌ You have no level ${level} spell slots.`, lovableKey, telegramKey);
      return;
    }
    const used = sc.usedSlots?.[level.toString()] || 0;
    if (used >= total) {
      await sendTelegram(chatId, `❌ No level ${level} slots remaining! (${used}/${total} used)`, lovableKey, telegramKey);
      return;
    }

    if (!sc.usedSlots) sc.usedSlots = {};
    sc.usedSlots[level.toString()] = used + 1;
    ext.spellcasting = sc;

    await supabase
      .from('character_saves')
      .update({ extended_data: ext })
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);

    const remaining = total - used - 1;
    await sendTelegram(chatId,
      `🔮 Used a <b>level ${level}</b> spell slot!\n${'◆'.repeat(remaining)}${'◇'.repeat(used + 1)} (${remaining}/${total} remaining)`,
      lovableKey, telegramKey,
    );
    return;
  }

  // /initiative
  if (cmd === '/initiative') {
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first.', lovableKey, telegramKey); return; }
    const save = await getCharacterData(userId, supabase);
    if (!save) { await sendTelegram(chatId, '❌ No character found.', lovableKey, telegramKey); return; }
    const ext = (save.extended_data || {}) as any;
    const dex = ext.abilityScores?.dexterity || 10;
    const dexMod = abilityMod(dex);
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + dexMod;
    const name = (save.character_data as any)?.name || 'You';
    let msg = `⚡ <b>${name}'s Initiative</b>\n\n🎲 ${d20} ${modStr(dexMod)} = <b>${total}</b>`;
    if (d20 === 20) msg += `\n🌟 <i>Natural 20!</i>`;
    else if (d20 === 1) msg += `\n💀 <i>Natural 1...</i>`;
    await sendTelegram(chatId, msg, lovableKey, telegramKey);
    return;
  }

  // /quests
  if (cmd === '/quests') {
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first.', lovableKey, telegramKey); return; }
    const { data: gameState } = await supabase
      .from('dm_game_state')
      .select('quest_flags')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!gameState || !gameState.quest_flags || Object.keys(gameState.quest_flags as any).length === 0) {
      await sendTelegram(chatId, '📜 No active quests. Start an AI DM campaign to track quests!', lovableKey, telegramKey);
      return;
    }
    const flags = gameState.quest_flags as Record<string, any>;
    let msg = `📜 <b>Quest Flags</b>\n\n`;
    const entries = Object.entries(flags).slice(0, 15);
    for (const [key, value] of entries) {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const icon = value === true ? '✅' : value === false ? '❌' : '📌';
      msg += `${icon} <b>${label}</b>: ${typeof value === 'boolean' ? (value ? 'Complete' : 'Incomplete') : value}\n`;
    }
    if (Object.keys(flags).length > 15) msg += `\n<i>+${Object.keys(flags).length - 15} more...</i>`;
    await sendTelegram(chatId, msg, lovableKey, telegramKey);
    return;
  }

  // /lore QUESTION
  if (cmd.startsWith('/lore ')) {
    const question = text.trim().substring(6).trim();
    if (!question) {
      await sendTelegram(chatId, '❌ Usage: /lore What is the Feywild?', lovableKey, telegramKey);
      return;
    }
    await sendTelegram(chatId, '📖 <i>Consulting the archives...</i>', lovableKey, telegramKey);
    try {
      const response = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            {
              role: 'system',
              content: 'You are a D&D 5e lore expert. Answer questions concisely (max 300 words). Use plain text only — no markdown. Focus on official D&D lore from published sourcebooks. If a question is not D&D-related, politely redirect.',
            },
            { role: 'user', content: question },
          ],
          max_tokens: 500,
        }),
      });
      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || 'No answer found.';
      // Truncate for Telegram
      const truncated = answer.length > 1500 ? answer.substring(0, 1500) + '...' : answer;
      await sendTelegram(chatId, `📖 <b>Lore: ${question.substring(0, 50)}</b>\n\n${truncated}`, lovableKey, telegramKey);
    } catch (err) {
      console.error('Lore AI error:', err);
      await sendTelegram(chatId, '❌ Failed to consult the archives. Try again later.', lovableKey, telegramKey);
    }
    return;
  }

  // /recap
  if (cmd === '/recap') {
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first.', lovableKey, telegramKey); return; }

    // Find the most recent campaign with a summary
    const { data: campaigns } = await supabase
      .from('ai_dm_campaigns')
      .select('name, campaign_summary, updated_at')
      .eq('user_id', userId)
      .not('campaign_summary', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (!campaigns || campaigns.length === 0 || !campaigns[0].campaign_summary) {
      await sendTelegram(chatId, '📖 No campaign recap available. Play an AI DM session first!', lovableKey, telegramKey);
      return;
    }

    const campaign = campaigns[0];
    const summary = campaign.campaign_summary!;
    const truncated = summary.length > 2000 ? summary.substring(0, 2000) + '\n\n<i>...truncated</i>' : summary;
    await sendTelegram(chatId,
      `📖 <b>${campaign.name}</b>\n<i>Last updated: ${new Date(campaign.updated_at).toLocaleDateString()}</i>\n\n${truncated}`,
      lovableKey, telegramKey,
    );
    return;
  }

  // Unknown command
  if (cmd.startsWith('/')) {
    await sendTelegram(chatId, `❓ Unknown command. Type /help for all commands.`, lovableKey, telegramKey);
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not set' }), { status: 500 });

  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
  if (!TELEGRAM_API_KEY) return new Response(JSON.stringify({ error: 'TELEGRAM_API_KEY not set' }), { status: 500 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let totalProcessed = 0;

  const { data: state, error: stateErr } = await supabase
    .from('telegram_bot_state')
    .select('update_offset')
    .eq('id', 1)
    .single();

  if (stateErr) {
    return new Response(JSON.stringify({ error: stateErr.message }), { status: 500 });
  }

  let currentOffset = state.update_offset;

  while (true) {
    const elapsed = Date.now() - startTime;
    const remainingMs = MAX_RUNTIME_MS - elapsed;
    if (remainingMs < MIN_REMAINING_MS) break;

    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    const response = await fetch(`${GATEWAY_URL}/getUpdates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TELEGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        offset: currentOffset,
        timeout,
        allowed_updates: ['message'],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify({ error: data }), { status: 502 });
    }

    const updates = data.result ?? [];
    if (updates.length === 0) continue;

    // Store messages
    const rows = updates
      .filter((u: any) => u.message)
      .map((u: any) => ({
        update_id: u.update_id,
        chat_id: u.message.chat.id,
        text: u.message.text ?? null,
        raw_update: u,
      }));

    if (rows.length > 0) {
      await supabase.from('telegram_messages').upsert(rows, { onConflict: 'update_id' });
      totalProcessed += rows.length;
    }

    // Process commands
    for (const update of updates) {
      const msg = update.message;
      if (msg?.text && msg.text.startsWith('/')) {
        await processCommand(
          msg.chat.id,
          msg.text,
          msg.from?.username || null,
          supabase,
          LOVABLE_API_KEY,
          TELEGRAM_API_KEY,
        );
      }
    }

    // Advance offset
    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await supabase
      .from('telegram_bot_state')
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq('id', 1);

    currentOffset = newOffset;
  }

  return new Response(
    JSON.stringify({ ok: true, processed: totalProcessed, finalOffset: currentOffset }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
