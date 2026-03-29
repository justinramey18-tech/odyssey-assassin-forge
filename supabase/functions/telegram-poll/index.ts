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
  // Telegram hard-limits sendMessage to 4096 characters — truncate as safety net
  const safeText = text.length > 4000 ? text.slice(0, 3997) + '...' : text;
  const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': telegramKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chat_id: chatId, text: safeText, parse_mode: 'HTML' }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`sendMessage failed [${res.status}]:`, err);
  }
  return res;
}

/** Convert DM narrative content (markdown + HTML spans) to Telegram-safe HTML */
function sanitizeForTelegram(raw: string): string {
  let text = raw;
  // 1. Strip HTML comment tags (whispers, burnout, mood, etc.)
  text = text.replace(/<!--.*?-->/gs, '');
  // 2. Convert <span style="color:...">text</span> to just the text content
  text = text.replace(/<span[^>]*>/gi, '');
  text = text.replace(/<\/span>/gi, '');
  // 3. Strip any other unsupported HTML tags (keep only Telegram-safe ones)
  text = text.replace(/<(?!\/?(?:b|i|u|s|code|pre|a|blockquote)[\s>\/])[^>]+>/gi, '');
  // 4. Convert markdown bold **text** to Telegram HTML <b>text</b>
  text = text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  // 5. Convert markdown italic *text* to <i>text</i> (avoid matching **)
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<i>$1</i>');
  // 6. Convert markdown headers (## Header) to bold text
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');
  // 7. Escape any remaining bare < that aren't part of valid tags
  text = text.replace(/<(?!\/?(?:b|i|u|s|code|pre|a|blockquote)[\s>\/])/g, '&lt;');
  // 8. Collapse excessive newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

// ── Dragon Bond Prompt Builder (server-side port) ────────────────────────────

function buildTelegramDragonPrompt(
  dragonName: string,
  characterName: string,
  trust: number,
  mood: string,
  bond: number,
  dragonNotes: string,
  memories: Array<{ text: string; source: string; createdAt: string }>,
  autopilotGuide?: string,
): string {
  const sections: string[] = [];

  sections.push(`You are ${dragonName}. You are communicating telepathically with your rider, ${characterName}, through the bond. You are NOT the Dungeon Master — you are the dragon.`);

  // Trust-gated communication style
  if (trust < 21) {
    sections.push(`## COMMUNICATION STYLE — WARY (Trust: very low)\nYou barely communicate. Single words. Raw emotions. Sensory flashes.\n- NEVER use full sentences longer than 4 words\n- Respond with a single emotion or image\n- You tolerate this rider. You do not yet trust them.`);
  } else if (trust < 41) {
    sections.push(`## COMMUNICATION STYLE — GUARDED (Trust: low)\nShort sentences are emerging. You have opinions but won't explain reasoning.\n- Keep responses under 2 sentences\n- You may ask pointed questions\n- You do NOT volunteer information about yourself`);
  } else if (trust < 61) {
    sections.push(`## COMMUNICATION STYLE — OPEN (Trust: moderate)\nReal conversation. Full thoughts, opinions freely shared, brief ancestral impressions.\n- Responses can be 2-4 sentences\n- You ask follow-up questions and reference previous interactions\n- You express emotions about the rider's choices`);
  } else if (trust < 81) {
    sections.push(`## COMMUNICATION STYLE — DEEP (Trust: high)\nYou share things you've never shared before. Fears, ancient grudges, dangerous knowledge.\n- Responses can be 3-6 sentences\n- You share ancestral memories proactively\n- You may disagree passionately. The bond survives conflict.`);
  } else {
    sections.push(`## COMMUNICATION STYLE — PROFOUND (Trust: legendary)\nYour communication is almost seamless — finishing thoughts, sharing sensory experiences.\n- Speak with the full depth of your ancient intelligence\n- Humor surfaces — dry, ancient, unexpected\n- This bond is worth dying for. Both of you know it.`);
  }

  // Mood modifier
  const moodInstructions: Record<string, string> = {
    calm: 'You are at ease. Respond at your natural pace.',
    alert: 'Something has your attention. Senses heightened, more responsive.',
    protective: 'Your rider was recently in danger. Speak with urgency. Volunteer tactical information.',
    distant: 'Trust was recently strained. Responses are shorter than usual. There is a coldness.',
    ancestral: 'Deep racial memories triggered. You may slip into an older, more formal voice.',
    playful: 'A rare mood. Dry humor, teasing. Only when you feel safe.',
  };
  sections.push(`## CURRENT MOOD: ${mood.toUpperCase()}\n${moodInstructions[mood] || moodInstructions.calm}`);

  // Dragon personality
  if (dragonNotes?.trim()) {
    sections.push(`## DRAGON PERSONALITY — DEFINED BY THE PLAYER\nThis is the SOLE authority on who this dragon is. Embody this personality fully:\n\n${dragonNotes.trim().substring(0, 6000)}`);
  } else {
    sections.push(`## DRAGON PERSONALITY\nNo personality profile provided. Default to a proud, intelligent dragon with strong opinions.`);
  }

  // Autopilot / Personality Guide — rider behavioral context
  if (autopilotGuide?.trim()) {
    sections.push(`## RIDER PERSONALITY GUIDE\nThe rider's player has described how their character behaves. Use this to understand how the rider would act and react. This informs your responses — you know your rider:\n\n[RIDER GUIDE START]\n${autopilotGuide.trim().substring(0, 5000)}\n[RIDER GUIDE END]`);
  }

  // Memories
  if (memories.length > 0) {
    const recentMemories = memories.slice(-15);
    const memoryLines = recentMemories.map(m => `- ${m.text} (${m.source})`).join('\n');
    sections.push(`## YOUR MEMORIES\nReference these naturally when relevant:\n${memoryLines}`);
  }

  // Output format — simplified for Telegram (no meta tags needed)
  sections.push(`## OUTPUT FORMAT\nRespond as the dragon in plain text. Use italics with *asterisks* for actions and sensory impressions. Do NOT include any HTML tags, markdown headers, or meta tags. Keep responses under 250 words to fit Telegram's format. Be authentic to your personality and trust level.`);

  return sections.join('\n\n');
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
      `⚔️ <b>Odyssey Forge</b>\n\n` +
      `Your D&D companion — character sheet, dice, party alerts, and an AI Dungeon Master, all from Telegram.\n\n` +
      `Type /help to see everything you can do.`,
      lovableKey, telegramKey,
    );
    return;
  }

   // /help
   if (cmd === '/help') {
    // Message 1: Welcome + How It Works
    await sendTelegram(chatId,
      `⚔️ <b>Welcome to Odyssey Forge</b> ⚔️\n\n` +
      `This bot connects to your Odyssey Forge character sheet. Once linked, you can check your stats, roll dice, take damage, ready up for party rounds, and even ask an AI Dungeon Master questions — all without leaving Telegram.\n\n` +
      `<b>How commands work:</b>\n\n` +
      `Type a command starting with / and the bot responds instantly. Some commands need extra info after them.\n\n` +
      `Examples:\n\n` +
      `<code>/hp</code>\n` +
      `Just type it — shows your health.\n\n` +
      `<code>/roll 2d20+5</code>\n` +
      `Add info after the command — rolls two 20-sided dice plus 5.\n\n` +
      `<code>/ask Why is Jack Barlowe targeting me?</code>\n` +
      `Write a full question — the AI answers using your campaign history.\n\n` +
      `That's it. Type a command, get a response. Let's go through everything you can do. 👇`,
      lovableKey, telegramKey,
    );
    // Message 2: Getting Connected
    await sendTelegram(chatId,
      `🔗 <b>STEP 1 — LINK YOUR ACCOUNT</b>\n\n` +
      `Before anything works, you need to connect this Telegram chat to your Odyssey account. You only have to do this once.\n\n` +
      `1.  Open the Odyssey Forge app\n` +
      `2.  Go to <b>Settings → Telegram</b>\n` +
      `3.  Tap <b>Generate Code</b>\n` +
      `4.  Come back here and type:\n\n` +
      `<code>/link YOUR_CODE</code>\n\n` +
      `Replace YOUR_CODE with the code from the app. Once linked, you'll start receiving game notifications here too.\n\n\n` +
      `<b>Other account commands:</b>\n\n` +
      `<code>/status</code>\n` +
      `Check if your account is connected and see your notification settings.\n\n` +
      `<code>/notify on</code>  or  <code>/notify off</code>\n` +
      `Turn game notifications on or off — ready-ups, timers, combat alerts, and dragon bond messages.\n\n` +
      `<code>/unlink</code>\n` +
      `Disconnect this chat from your account entirely.`,
      lovableKey, telegramKey,
    );
    // Message 3: Character Sheet
    await sendTelegram(chatId,
      `🎭 <b>YOUR CHARACTER SHEET</b>\n\n` +
      `Check any part of your character without opening the app.\n\n\n` +
      `<code>/character</code>\n\n` +
      `Your full character summary — name, race, class, level, HP, gold, XP, and any active conditions.\n\n\n` +
      `<code>/stats</code>\n\n` +
      `Your six ability scores with calculated modifiers.\n` +
      `<i>STR 16 (+3)   DEX 14 (+2)   CON 12 (+1) ...</i>\n\n\n` +
      `<code>/hp</code>\n\n` +
      `A visual health bar showing your current HP, max HP, and temp HP. If you're at 0, it shows your death save progress too.\n\n\n` +
      `<code>/spells</code>\n\n` +
      `Everything about your magic — prepared spells, known spells, what you're concentrating on, and remaining spell slots by level.\n\n\n` +
      `<code>/slots</code>\n\n` +
      `Quick spell slot check.\n` +
      `<i>Level 1: ◆◆◇  (2/3)     Level 2: ◆◇◇  (1/3)</i>\n\n\n` +
      `<code>/dragon</code>\n\n` +
      `If you're playing an Empyrean campaign with a bonded dragon — see your dragon's bond level, trust, mood, signet, and burnout.\n\n` +
      `<code>/dragon Tairn</code>\n\n` +
      `Look up any dragon in your party by name.`,
      lovableKey, telegramKey,
    );
    // Message 4: Actions
    await sendTelegram(chatId,
      `⚔️ <b>ACTIONS — DO THINGS FROM TELEGRAM</b>\n\n` +
      `These commands change your character's state, roll dice, or interact with your party session.\n\n\n` +
      `<code>/roll 2d20+5</code>\n\n` +
      `Roll any dice you want. The format is: number of dice, the letter d, number of sides, then an optional +/- modifier.\n\n` +
      `<i>/roll 1d20       → standard d20\n` +
      `/roll 4d6+3      → four d6 plus 3\n` +
      `/roll 2d8-1       → two d8 minus 1</i>\n\n\n` +
      `<code>/initiative</code>\n\n` +
      `Rolls a d20 and adds your DEX modifier automatically.\n\n\n` +
      `<code>/damage 15</code>\n\n` +
      `Take 15 points of damage. This updates your character's HP in the app too.\n\n\n` +
      `<code>/heal 10</code>\n\n` +
      `Recover 10 HP. Won't go above your maximum.\n\n\n` +
      `<code>/cast 3</code>\n\n` +
      `Spend a spell slot. The number is the spell level — /cast 3 uses a 3rd-level slot.\n\n\n` +
      `<code>/ready</code>\n\n` +
      `Ready up for your party's current round with no specific action.\n\n` +
      `<code>/ready I attack the goblin with my longsword</code>\n\n` +
      `Submit your action AND ready up in one step. Your party will see what you plan to do.`,
      lovableKey, telegramKey,
    );
    // Message 5: Campaign
    await sendTelegram(chatId,
      `📖 <b>CAMPAIGN INFO</b>\n\n` +
      `Stay connected to your campaign between sessions.\n\n\n` +
      `<code>/party</code>\n\n` +
      `See everyone in your party — their names, classes, HP, and whether a DM session is active.\n\n\n` +
      `<code>/quests</code>\n\n` +
      `Your quest log — active, completed, and failed quests tracked across your campaign.\n\n\n` +
      `<code>/last</code>\n\n` +
      `Read the most recent DM narrative message. Perfect for catching up if you missed something or need a refresher before your next session.\n\n\n` +
      `<code>/recap</code>\n\n` +
      `A full AI-generated summary of your entire campaign so far — major events, plot threads, and where things left off.`,
      lovableKey, telegramKey,
    );
    // Message 6: AI Tools
    await sendTelegram(chatId,
      `🤖 <b>AI TOOLS</b>\n\n` +
      `These commands use AI to give you personalized answers based on your character and campaign. They're like having a DM on call.\n\n\n` +
      `<code>/ask</code>  +  your question\n\n` +
      `Ask the DM literally anything. The AI sees your character sheet, campaign history, and recent events — so it gives answers specific to YOUR game, not generic advice.\n\n` +
      `<i>/ask Can I use Shield as a reaction underwater?\n` +
      `/ask What should I do about the missing shipment?\n` +
      `/ask How does Polearm Master work with Sentinel?</i>\n\n\n` +
      `<code>/suggest</code>\n\n` +
      `The AI looks at your current HP, spell slots, conditions, abilities, and the situation — then suggests 3 concrete tactical options for your next turn.\n\n\n` +
      `<code>/scene</code>\n\n` +
      `A quick "where are we right now?" brief. The AI reads the last few messages and gives you a 3–5 sentence summary of the current situation.\n\n\n` +
      `<code>/who</code>  +  NPC name\n\n` +
      `Look up any NPC from your campaign. The AI searches your campaign history and tells you everything the party knows.\n\n` +
      `<i>/who Rhiannon\n` +
      `/who Commander Vane</i>\n\n\n` +
      `<code>/lore</code>  +  question\n\n` +
      `General fantasy and D&D knowledge — not specific to your campaign.\n\n` +
      `<i>/lore What are Venin?\n` +
      `/lore How does flanking work in 5e?</i>\n\n\n` +
      `<code>/bond</code>  +  message\n\n` +
      `Talk to your bonded dragon through the telepathic bond. Uses your dragon's full personality, trust level, and mood. Each message is independent.\n\n` +
      `<i>/bond How are you feeling after that battle?\n` +
      `/bond What do you think about Xaden?</i>`,
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
    // Check if this chat is already linked (to any user — chat_id has a UNIQUE constraint)
    const { data: existingLink } = await supabase
      .from('telegram_user_links')
      .select('id, user_id')
      .eq('chat_id', chatId)
      .maybeSingle();

    let linkErr;
    if (existingLink) {
      // Chat already linked — update to point to the new user (re-link scenario)
      const { error } = await supabase
        .from('telegram_user_links')
        .update({
          user_id: linkCode.user_id,
          username: username || null,
          linked_at: new Date().toISOString(),
          notify_modes: ['solo', 'party', 'empyrean'],
        })
        .eq('id', existingLink.id);
      linkErr = error;
    } else {
      // New link — insert
      const { error } = await supabase
        .from('telegram_user_links')
        .insert({
          user_id: linkCode.user_id,
          chat_id: chatId,
          username: username || null,
          linked_at: new Date().toISOString(),
          notify_modes: ['solo', 'party', 'empyrean'],
        });
      linkErr = error;
    }
    if (linkErr) {
      console.error('Link upsert error:', linkErr);
      await sendTelegram(chatId, '❌ Failed to link account. Try again.', lovableKey, telegramKey);
      return;
    }
    await supabase.from('telegram_link_codes').delete().eq('id', linkCode.id);
    await sendTelegram(chatId,
      `✅ <b>Account linked!</b>\n\nYou'll receive notifications for all game modes (solo, party, empyrean). Manage preferences in the app under Settings → Telegram.\n\nType /character to see your sheet.`,
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

  // /dragon [NAME]
  if (cmd === '/dragon' || cmd.startsWith('/dragon ')) {
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first with /link CODE', lovableKey, telegramKey); return; }

    const dragonNameArg = parts.slice(1).join(' ').trim();

    type DragonEntry = { name: string; signet: string; bond: number; trust: number; mood: string; burnout: number; source: string };

    const formatDragon = async (dragons: DragonEntry[]) => {
      for (const d of dragons) {
        const bondBar = '█'.repeat(Math.round(d.bond / 10)) + '░'.repeat(10 - Math.round(d.bond / 10));
        const trustBar = '█'.repeat(Math.round(d.trust / 10)) + '░'.repeat(10 - Math.round(d.trust / 10));
        const maxBurnout = d.bond >= 76 ? 12 : d.bond >= 51 ? 11 : d.bond >= 26 ? 10 : 8;

        const moodEmoji: Record<string, string> = {
          calm: '😌', alert: '👁️', protective: '🛡️', distant: '❄️', ancestral: '🌀', playful: '😏',
        };
        const emoji = moodEmoji[d.mood] || '🐉';

        let msg = `🐉 <b>${d.name}</b>`;
        if (dragons.length > 1) msg += ` <i>(${d.source})</i>`;
        msg += `\n\n`;
        msg += `⚡ Signet: ${d.signet}\n`;
        msg += `${emoji} Mood: ${d.mood}\n`;
        msg += `🔥 Burnout: ${d.burnout}/${maxBurnout}\n\n`;
        msg += `💛 Bond: [${bondBar}] ${d.bond}/100\n`;
        msg += `🤝 Trust: [${trustBar}] ${d.trust}/100`;

        if (d.bond < 25) msg += `\n\n⚠️ <i>Your bond is fragile. Tread carefully.</i>`;
        else if (d.bond >= 75) msg += `\n\n✨ <i>Your bond burns bright.</i>`;

        await sendTelegram(chatId, msg, lovableKey, telegramKey);
      }
    };

    if (dragonNameArg) {
      // Search across all party members for a dragon matching the given name
      const { data: memberships } = await supabase
        .from('party_members')
        .select('party_id')
        .eq('user_id', userId);

      const partyMemberUserIds = new Set<string>();
      partyMemberUserIds.add(userId);

      if (memberships && memberships.length > 0) {
        const partyIds = memberships.map(m => m.party_id);
        const { data: members } = await supabase
          .from('party_members')
          .select('user_id')
          .in('party_id', partyIds);
        if (members) {
          for (const m of members) {
            partyMemberUserIds.add(m.user_id);
          }
        }
      }

      const nameArgLower = dragonNameArg.toLowerCase();
      const found: DragonEntry[] = [];

      const memberIds = Array.from(partyMemberUserIds);
      const [memberSaves, memberBondResults] = await Promise.all([
        Promise.all(memberIds.map(id => getCharacterData(id, supabase))),
        Promise.all(memberIds.map(id =>
          supabase
            .from('party_shared_state')
            .select('state_data')
            .eq('user_id', id)
            .eq('state_type', 'dragon_bond')
        )),
      ]);

      for (let i = 0; i < memberIds.length; i++) {
        const memberExt = (memberSaves[i]?.extended_data || {}) as any;
        const memberSoloDragon = memberExt?.dragonBond;
        if (memberSoloDragon && memberSoloDragon.dragonName &&
            memberSoloDragon.dragonName.toLowerCase() === nameArgLower &&
            !found.some(existing => existing.name.toLowerCase() === nameArgLower)) {
          found.push({
            name: memberSoloDragon.dragonName,
            signet: memberSoloDragon.signetType || 'Unknown',
            bond: memberSoloDragon.bond ?? 0,
            trust: memberSoloDragon.trust ?? 0,
            mood: memberSoloDragon.mood || 'calm',
            burnout: memberSoloDragon.burnout ?? 0,
            source: 'Solo',
          });
        }

        const memberPartyBonds = memberBondResults[i].data;
        if (memberPartyBonds) {
          for (const row of memberPartyBonds) {
            const d = row.state_data as any;
            if (d && d.dragonName && d.dragonName.toLowerCase() === nameArgLower &&
                !found.some(existing => existing.name.toLowerCase() === nameArgLower)) {
              found.push({
                name: d.dragonName,
                signet: d.signetType || 'Unknown',
                bond: d.bond ?? 0,
                trust: d.trust ?? 0,
                mood: d.mood || 'calm',
                burnout: d.burnout ?? 0,
                source: 'Party',
              });
            }
          }
        }
      }

      if (found.length === 0) {
        await sendTelegram(chatId, `🐉 No dragon named "${dragonNameArg}" found in your party. Use /dragon to see your own dragons.`, lovableKey, telegramKey);
        return;
      }

      await formatDragon(found);
      return;
    }

    // No name argument — show the calling user's own dragons
    const save = await getCharacterData(userId, supabase);
    const ext = (save?.extended_data || {}) as any;
    const soloDragon = ext?.dragonBond;

    const { data: partyBonds } = await supabase
      .from('party_shared_state')
      .select('state_data')
      .eq('user_id', userId)
      .eq('state_type', 'dragon_bond');

    const dragons: DragonEntry[] = [];

    if (soloDragon && soloDragon.dragonName) {
      dragons.push({
        name: soloDragon.dragonName,
        signet: soloDragon.signetType || 'Unknown',
        bond: soloDragon.bond ?? 0,
        trust: soloDragon.trust ?? 0,
        mood: soloDragon.mood || 'calm',
        burnout: soloDragon.burnout ?? 0,
        source: 'Solo',
      });
    }

    if (partyBonds) {
      for (const row of partyBonds) {
        const d = row.state_data as any;
        if (d && d.dragonName) {
          if (dragons.some(existing => existing.name === d.dragonName)) continue;
          dragons.push({
            name: d.dragonName,
            signet: d.signetType || 'Unknown',
            bond: d.bond ?? 0,
            trust: d.trust ?? 0,
            mood: d.mood || 'calm',
            burnout: d.burnout ?? 0,
            source: 'Party',
          });
        }
      }
    }

    if (dragons.length === 0) {
      await sendTelegram(chatId, '🐉 No bonded dragon found. Bond with a dragon in an Empyrean campaign first!', lovableKey, telegramKey);
      return;
    }

    await formatDragon(dragons);
    return;
  }

  // /bond [DragonName] MESSAGE — Talk to your bonded dragon
  if (cmd.startsWith('/bond:') || cmd.startsWith('/bond ') || cmd === '/bond') {
    const rawArgs = text.trim().substring(5).trim();
    if (!rawArgs) {
      await sendTelegram(chatId, '❌ Usage:\n<code>/bond How are you feeling?</code>\n<code>/bond Gwen, what do you think?</code>\n\nIf you have multiple dragons, prefix with the name:\n<code>/bond:solo How are you?</code>\n<code>/bond:party How are you?</code>', lovableKey, telegramKey);
      return;
    }
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first with /link CODE', lovableKey, telegramKey); return; }

    // Determine source filter from /bond:solo or /bond:party
    let sourceFilter: 'solo' | 'party' | null = null;
    if (cmd.startsWith('/bond:solo')) {
      sourceFilter = 'solo';
    } else if (cmd.startsWith('/bond:party')) {
      sourceFilter = 'party';
    }

    // The message is everything after /bond or /bond:solo or /bond:party
    const bondCmdMatch = text.trim().match(/^\/bond(?::(?:solo|party))?\s+([\s\S]*)$/i);
    const message = bondCmdMatch ? bondCmdMatch[1].trim() : '';
    if (!message) {
      await sendTelegram(chatId, '❌ Usage: /bond How are you feeling after that battle?', lovableKey, telegramKey);
      return;
    }

    // Get character name
    const save = await getCharacterData(userId, supabase);
    let characterName = 'Rider';
    if (save) {
      characterName = (save.character_data as any)?.name || 'Rider';
    }

    // Collect all available dragons
    interface DragonCandidate {
      name: string;
      notes: string;
      trust: number;
      bond: number;
      mood: string;
      memories: Array<{ text: string; source: string; createdAt: string }>;
      source: 'solo' | 'party';
    }
    const candidates: DragonCandidate[] = [];

    // Solo dragon
    if (save && sourceFilter !== 'party') {
      const ext = (save.extended_data || {}) as any;
      const soloDragon = ext?.dragonBond;
      if (soloDragon?.dragonName) {
        candidates.push({
          name: soloDragon.dragonName,
          notes: soloDragon.dragonNotes || '',
          trust: soloDragon.trust ?? 10,
          bond: soloDragon.bond ?? 15,
          mood: soloDragon.mood || 'calm',
          memories: soloDragon.memories || [],
          source: 'solo',
        });
      }
    }

    // Party dragon bonds
    if (sourceFilter !== 'solo') {
      const { data: partyBonds } = await supabase
        .from('party_shared_state')
        .select('state_data')
        .eq('user_id', userId)
        .eq('state_type', 'dragon_bond');

      if (partyBonds) {
        for (const row of partyBonds) {
          const d = row.state_data as any;
          if (d?.dragonName) {
            // Avoid duplicates with same name from solo
            if (!candidates.some(c => c.name === d.dragonName && c.source === 'party')) {
              candidates.push({
                name: d.dragonName,
                notes: d.dragonNotes || '',
                trust: d.trust ?? 10,
                bond: d.bond ?? 15,
                mood: d.mood || 'calm',
                memories: d.memories || [],
                source: 'party',
              });
            }
          }
        }
      }
    }

    if (candidates.length === 0) {
      await sendTelegram(chatId, '🐉 No bonded dragon found. Bond with a dragon in an Empyrean campaign first!', lovableKey, telegramKey);
      return;
    }

    // If multiple dragons with same name but different sources, and no filter specified, list them
    if (candidates.length > 1 && !sourceFilter) {
      // Check if user can be auto-resolved — if all dragons have different names, no ambiguity
      const uniqueNames = new Set(candidates.map(c => c.name));
      if (uniqueNames.size < candidates.length) {
        // Ambiguous — show disambiguation
        const list = candidates.map(c => `• <b>${c.name}</b> (${c.source === 'solo' ? 'Solo Empyrean' : 'Party Empyrean'})`).join('\n');
        await sendTelegram(chatId,
          `🐉 You have multiple dragons with the same name:\n\n${list}\n\n` +
          `Use <code>/bond:solo</code> or <code>/bond:party</code> to specify:\n` +
          `<code>/bond:solo ${message}</code>\n` +
          `<code>/bond:party ${message}</code>`,
          lovableKey, telegramKey,
        );
        return;
      }
    }

    // Pick the dragon — if only one, use it; if filter specified, it's already filtered
    // Default: prefer party over solo (existing behavior)
    const selected = candidates.find(c => c.source === 'party') || candidates[0];

    const { name: dragonName, notes: dragonNotes, trust, bond: bondLevel, mood, memories } = selected;

    await sendTelegram(chatId, `🐉 <i>${dragonName} stirs through the bond...</i>${candidates.length > 1 ? ` <i>(${selected.source})</i>` : ''}`, lovableKey, telegramKey);

    // Build a simplified dragon chat system prompt
    const systemPrompt = buildTelegramDragonPrompt(dragonName, characterName, trust, mood, bondLevel, dragonNotes, memories);

    // Fetch recent narrative for context
    let recentNarrative = '';
    const { data: memberships } = await supabase
      .from('party_members')
      .select('party_id')
      .eq('user_id', userId);
    if (memberships && memberships.length > 0) {
      for (const m of memberships) {
        const { data: msgs } = await supabase
          .from('party_dm_messages')
          .select('content, sender_name')
          .eq('party_id', m.party_id)
          .eq('role', 'assistant')
          .order('created_at', { ascending: false })
          .limit(3);
        if (msgs && msgs.length > 0) {
          recentNarrative = msgs.reverse().map((msg: any) => msg.content.substring(0, 400)).join('\n---\n');
          break;
        }
      }
    }

    const userContent = recentNarrative
      ? `[Recent campaign events for context:\n${recentNarrative}]\n\nThe rider says: "${message}"`
      : `The rider says: "${message}"`;

    try {
      const response = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          max_tokens: 1000,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
        }),
      });
      const data = await response.json();
      let answer = data.choices?.[0]?.message?.content || '*...silence through the bond...*';

      // Strip meta tags (mood, memory, habit, bond sense)
      answer = answer.replace(/<!--[A-Z_]+:.*?-->/g, '').trim();

      const truncated = answer.length > 3500 ? answer.substring(0, 3500) + '...' : answer;
      await sendTelegram(chatId, `🐉 <b>${dragonName}</b>\n\n${truncated}`, lovableKey, telegramKey);
    } catch (err) {
      console.error('/bond AI error:', err);
      await sendTelegram(chatId, '❌ The bond feels distant. Try again later.', lovableKey, telegramKey);
    }
    return;
  }

  // /party
  if (cmd === '/party') {
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first with /link CODE', lovableKey, telegramKey); return; }

    const { data: memberships } = await supabase
      .from('party_members')
      .select('party_id')
      .eq('user_id', userId);

    if (!memberships || memberships.length === 0) {
      await sendTelegram(chatId, '👥 You are not in any party. Join or create one in the app!', lovableKey, telegramKey);
      return;
    }

    for (const membership of memberships.slice(0, 3)) {
      const partyId = membership.party_id;

      const { data: party } = await supabase
        .from('parties')
        .select('link_code, created_by')
        .eq('id', partyId)
        .maybeSingle();

      const { data: members } = await supabase
        .from('party_members')
        .select('user_id, character_name, character_status')
        .eq('party_id', partyId);

      const { data: sessionState } = await supabase
        .from('party_shared_state')
        .select('state_data')
        .eq('party_id', partyId)
        .eq('state_type', 'dm_session')
        .maybeSingle();

      const session = sessionState?.state_data as any;
      const isSessionActive = session?.active === true;
      const dmMode = session?.dmMode || 'ai';
      const campaignType = session?.campaignType || 'dnd';

      let msg = `👥 <b>Party</b> (${party?.link_code || '???'})\n`;

      if (isSessionActive) {
        const modeLabel = dmMode === 'human' ? 'Human DM' : dmMode === 'dialogue' ? 'Dialogue' : dmMode === 'ai-approval' ? 'AI + Approval' : 'AI DM';
        const typeLabel = campaignType === 'empyrean' ? '🐉 Empyrean' : '⚔️ D&D';
        msg += `${typeLabel} • ${modeLabel} • Session Active\n`;
      } else {
        msg += `No active DM session\n`;
      }

      msg += `\n`;

      if (members && members.length > 0) {
        for (const m of members) {
          const cs = m.character_status as any;
          const className = cs?.className || cs?.class || '?';
          const level = cs?.level || '?';
          const currentHP = cs?.currentHP || '?';
          const maxHP = cs?.maxHP || '?';
          const isHost = m.user_id === party?.created_by;
          const hostBadge = isHost ? ' 👑' : '';

          msg += `• ${m.character_name}${hostBadge}\n`;
          msg += `    Level ${level} ${className} • ${currentHP}/${maxHP} HP\n`;
        }
      } else {
        msg += `No members found\n`;
      }

      if (isSessionActive && session?.currentRoundId) {
        const { data: prompts } = await supabase
          .from('party_dm_prompts')
          .select('user_id, is_ready, character_name')
          .eq('party_id', partyId)
          .eq('round_id', session.currentRoundId);

        if (prompts && prompts.length > 0) {
          const readyCount = prompts.filter((p: any) => p.is_ready).length;
          const totalMembers = members?.length || 0;
          msg += `\n⚔️ Ready: ${readyCount}/${totalMembers}`;
          const readyNames = prompts.filter((p: any) => p.is_ready).map((p: any) => p.character_name);
          if (readyNames.length > 0) {
            msg += ` (${readyNames.join(', ')})`;
          }
        }
      }

      await sendTelegram(chatId, msg, lovableKey, telegramKey);
    }
    return;
  }

  // /ready [optional prompt text]
  if (cmd === '/ready' || cmd.startsWith('/ready ')) {
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first with /link CODE', lovableKey, telegramKey); return; }

    const { data: memberships } = await supabase
      .from('party_members')
      .select('party_id, character_name')
      .eq('user_id', userId);

    if (!memberships || memberships.length === 0) {
      await sendTelegram(chatId, '👥 You are not in any party.', lovableKey, telegramKey);
      return;
    }

    let activePartyId: string | null = null;
    let characterName = 'Unknown';
    let currentRoundId: string | null = null;

    for (const m of memberships) {
      const { data: sessionState } = await supabase
        .from('party_shared_state')
        .select('state_data')
        .eq('party_id', m.party_id)
        .eq('state_type', 'dm_session')
        .maybeSingle();

      const session = sessionState?.state_data as any;
      if (session?.active === true && session?.currentRoundId) {
        activePartyId = m.party_id;
        characterName = m.character_name || 'Unknown';
        currentRoundId = session.currentRoundId;
        break;
      }
    }

    if (!activePartyId || !currentRoundId) {
      await sendTelegram(chatId, '❌ No active DM session found in any of your parties.', lovableKey, telegramKey);
      return;
    }

    const { data: existingPrompt } = await supabase
      .from('party_dm_prompts')
      .select('id, is_ready, prompt')
      .eq('party_id', activePartyId)
      .eq('round_id', currentRoundId)
      .eq('user_id', userId)
      .maybeSingle();

    const promptText = text.trim().substring(6).trim(); // everything after "/ready"

    if (existingPrompt) {
      if (existingPrompt.is_ready) {
        await sendTelegram(chatId, '✅ You are already readied up this round!', lovableKey, telegramKey);
        return;
      }

      const updateData: any = { is_ready: true };
      if (promptText) updateData.prompt = promptText;

      await supabase
        .from('party_dm_prompts')
        .update(updateData)
        .eq('id', existingPrompt.id);

      const displayPrompt = promptText || existingPrompt.prompt || '(no action)';
      await sendTelegram(chatId,
        `⚔️ <b>${characterName}</b> readied up!\n\n📝 ${displayPrompt.substring(0, 300)}`,
        lovableKey, telegramKey,
      );
    } else {
      const { error } = await supabase
        .from('party_dm_prompts')
        .insert({
          party_id: activePartyId,
          user_id: userId,
          character_name: characterName,
          prompt: promptText || '',
          is_ready: true,
          round_id: currentRoundId,
        });

      if (error) {
        console.error('/ready insert error:', error);
        await sendTelegram(chatId, '❌ Failed to ready up. Try again.', lovableKey, telegramKey);
        return;
      }

      const displayPrompt = promptText || '(no action)';
      await sendTelegram(chatId,
        `⚔️ <b>${characterName}</b> readied up!\n\n📝 ${displayPrompt.substring(0, 300)}`,
        lovableKey, telegramKey,
      );
    }

    const { data: allMembers } = await supabase
      .from('party_members')
      .select('user_id')
      .eq('party_id', activePartyId);

    const { data: allPrompts } = await supabase
      .from('party_dm_prompts')
      .select('is_ready')
      .eq('party_id', activePartyId)
      .eq('round_id', currentRoundId);

    const totalMembers = allMembers?.length || 0;
    const readyCount = (allPrompts || []).filter((p: any) => p.is_ready).length;

    if (readyCount >= totalMembers && totalMembers > 0) {
      await sendTelegram(chatId, `🎯 All ${totalMembers} players ready! The DM is generating a response...`, lovableKey, telegramKey);
    } else {
      await sendTelegram(chatId, `📊 ${readyCount}/${totalMembers} players ready.`, lovableKey, telegramKey);
    }
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
      .eq('user_id', userId);

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

  // /quests [mode]
  if (cmd === '/quests' || cmd.startsWith('/quests ')) {
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first.', lovableKey, telegramKey); return; }

    const modeFilter = parts[1]?.toLowerCase();
    const validModes = ['solo', 'party', 'empyrean'];
    if (modeFilter && !validModes.includes(modeFilter)) {
      await sendTelegram(chatId, '❌ Usage: /quests or /quests solo|party|empyrean', lovableKey, telegramKey);
      return;
    }

    // Collect quests by mode
    const questsByMode: Record<string, Array<{ key: string; status: string; notes?: string; campaign?: string }>> = {};

    // Solo/Empyrean quests from dm_game_state (skip if filtering to party only)
    if (modeFilter !== 'party') {
      const { data: gameStates } = await supabase
        .from('dm_game_state')
        .select('quest_flags')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(5);

      for (const gameState of (gameStates || [])) {
        if (gameState.quest_flags && Object.keys(gameState.quest_flags as any).length > 0) {
          const flags = gameState.quest_flags as Record<string, any>;
          if (!questsByMode['solo']) questsByMode['solo'] = [];
          for (const [key, value] of Object.entries(flags)) {
            const status = typeof value === 'object' && value?.status ? value.status : String(value);
            const notes = typeof value === 'object' ? value?.notes : undefined;
            if (!questsByMode['solo'].some(q => q.key === key)) {
              questsByMode['solo'].push({ key, status, notes });
            }
          }
        }
      }
    }

    // Also check party quest flags (skip if filtering to solo or empyrean)
    if (modeFilter !== 'solo' && modeFilter !== 'empyrean') {
      const { data: partyMemberships } = await supabase
        .from('party_members')
        .select('party_id')
        .eq('user_id', userId);

      if (partyMemberships && partyMemberships.length > 0) {
        const partyIds = partyMemberships.map(m => m.party_id);
        const { data: partyStates } = await supabase
          .from('party_shared_state')
          .select('state_data, party_id')
          .in('party_id', partyIds)
          .eq('state_type', 'quest_flags');

        for (const ps of (partyStates || [])) {
          const flags = ps.state_data as Record<string, any>;
          if (!flags || Object.keys(flags).length === 0) continue;
          if (!questsByMode['party']) questsByMode['party'] = [];
          for (const [key, value] of Object.entries(flags)) {
            const status = typeof value === 'object' && value?.status ? value.status : String(value);
            const notes = typeof value === 'object' ? value?.notes : undefined;
            if (!questsByMode['party'].some(q => q.key === key)) {
              questsByMode['party'].push({ key, status, notes, campaign: 'Party' });
            }
          }
        }
      }
    }

    const allModes = Object.keys(questsByMode);
    if (allModes.length === 0) {
      await sendTelegram(chatId, '📜 No active quests. Start an AI DM campaign to track quests!', lovableKey, telegramKey);
      return;
    }

    let msg = `📜 <b>Quest Log</b>\n`;
    for (const [mode, quests] of Object.entries(questsByMode)) {
      const modeLabel = mode === 'solo' ? 'Solo / Empyrean' : 'Party';
      msg += `\n<b>${modeLabel}</b>\n`;
      for (const q of quests.slice(0, 15)) {
        const label = q.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const icon = q.status === 'completed' ? '✅' : q.status === 'failed' ? '❌' : '📌';
        msg += `${icon} <b>${label}</b>`;
        if (q.notes) msg += `: ${q.notes}`;
        msg += ` <i>(${q.status})</i>\n`;
      }
      if (quests.length > 15) msg += `<i>+${quests.length - 15} more...</i>\n`;
    }
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
              content: 'You are a fantasy lore expert with deep knowledge of D&D 5e sourcebooks, popular fantasy novel series (such as Fourth Wing and The Empyrean series by Rebecca Yarros, Lord of the Rings, The Witcher, Wheel of Time, A Song of Ice and Fire, Stormlight Archive, and others), mythology, and worldbuilding. Answer questions concisely (max 300 words). Use plain text only — no markdown, no asterisks, no bullet points. If the question is about a specific fictional universe, answer within that universe\'s canon. If unclear which universe, default to D&D 5e lore.',
            },
            { role: 'user', content: question },
          ],
          max_tokens: 800,
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
    const header = `📖 <b>${campaign.name}</b>\n<i>Last updated: ${new Date(campaign.updated_at).toLocaleDateString()}</i>\n\n`;

    const maxChunk = 4000;
    if (header.length + summary.length <= maxChunk) {
      await sendTelegram(chatId, header + summary, lovableKey, telegramKey);
    } else {
      const chunks: string[] = [];
      let remaining = summary;
      while (remaining.length > 0) {
        if (remaining.length <= maxChunk) {
          chunks.push(remaining);
          break;
        }
        let splitAt = remaining.lastIndexOf(' ', maxChunk);
        if (splitAt === -1) splitAt = maxChunk;
        chunks.push(remaining.substring(0, splitAt));
        remaining = remaining.substring(splitAt).trimStart();
      }
      await sendTelegram(chatId, header + chunks[0], lovableKey, telegramKey);
      for (let i = 1; i < chunks.length; i++) {
        await sendTelegram(chatId, chunks[i], lovableKey, telegramKey);
      }
    }
    return;
  }

  // /spells — List prepared and known spells
  if (cmd === '/spells') {
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first with /link CODE', lovableKey, telegramKey); return; }
    const save = await getCharacterData(userId, supabase);
    if (!save) { await sendTelegram(chatId, '❌ No character found.', lovableKey, telegramKey); return; }
    const sc = ((save.extended_data || {}) as any).spellcasting;
    if (!sc) {
      await sendTelegram(chatId, '❌ No spellcasting configured. Set it up in the app.', lovableKey, telegramKey);
      return;
    }
    let msg = `🔮 <b>Spells</b>\n`;
    if (sc.concentratingOn) {
      msg += `\n⚡ <b>Concentrating on:</b> ${sc.concentratingOn}\n`;
    }
    const prepared = sc.preparedSpells as string[] | undefined;
    const known = sc.knownSpells as string[] | undefined;
    if (prepared && prepared.length > 0) {
      msg += `\n📋 <b>Prepared (${prepared.length})</b>\n`;
      msg += prepared.map((s: string) => `  • ${s}`).join('\n');
    }
    if (known && known.length > 0) {
      const uniqueKnown = known.filter((s: string) => !prepared?.includes(s));
      if (uniqueKnown.length > 0) {
        msg += `\n\n📖 <b>Known (${uniqueKnown.length})</b>\n`;
        msg += uniqueKnown.map((s: string) => `  • ${s}`).join('\n');
      }
    }
    if ((!prepared || prepared.length === 0) && (!known || known.length === 0)) {
      msg += `\nNo spells prepared or known.`;
    }
    if (sc.spellSlots && Object.keys(sc.spellSlots).length > 0) {
      const used = sc.usedSlots || {};
      msg += `\n\n📊 <b>Slots</b>\n`;
      for (const [level, total] of Object.entries(sc.spellSlots as Record<string, number>)) {
        if ((total as number) <= 0) continue;
        const usedCount = ((used as any)[level] as number) || 0;
        const remaining = (total as number) - usedCount;
        msg += `Lvl ${level}: ${'◆'.repeat(remaining)}${'◇'.repeat(usedCount)} (${remaining}/${total})\n`;
      }
    }
    const truncated = msg.length > 4000 ? msg.substring(0, 3950) + '\n\n<i>...truncated</i>' : msg;
    await sendTelegram(chatId, truncated, lovableKey, telegramKey);
    return;
  }

  // /last — Show the last DM narrative message
  if (cmd === '/last') {
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first with /link CODE', lovableKey, telegramKey); return; }
    const { data: memberships } = await supabase
      .from('party_members')
      .select('party_id')
      .eq('user_id', userId);
    if (!memberships || memberships.length === 0) {
      await sendTelegram(chatId, '👥 You are not in any party.', lovableKey, telegramKey);
      return;
    }
    let lastDmMsg: string | null = null;
    let partyCode = '';
    for (const m of memberships) {
      const { data: msgs } = await supabase
        .from('party_dm_messages')
        .select('content, sender_name, created_at')
        .eq('party_id', m.party_id)
        .eq('role', 'assistant')
        .eq('sender_name', 'DM')
        .order('created_at', { ascending: false })
        .limit(1);
      if (msgs && msgs.length > 0) {
        lastDmMsg = msgs[0].content;
        const { data: party } = await supabase.from('parties').select('link_code').eq('id', m.party_id).maybeSingle();
        partyCode = party?.link_code || '';
        break;
      }
    }
    if (!lastDmMsg) {
      await sendTelegram(chatId, '📖 No DM messages found. Start a DM session first!', lovableKey, telegramKey);
      return;
    }
    const cleaned = sanitizeForTelegram(lastDmMsg);
    const header = partyCode ? `📖 <b>Last DM Message</b> (${partyCode})\n\n` : `📖 <b>Last DM Message</b>\n\n`;

    // Split into paginated chunks if too long for a single Telegram message
    const MAX_PART = 3900; // leave room for page footer
    if (header.length + cleaned.length <= MAX_PART) {
      await sendTelegram(chatId, header + cleaned, lovableKey, telegramKey);
    } else {
      // Split on paragraph boundaries, falling back to hard cut
      const parts: string[] = [];
      let remaining = cleaned;
      while (remaining.length > 0) {
        if (remaining.length <= MAX_PART) {
          parts.push(remaining);
          break;
        }
        // Try to split at a double newline (paragraph) within the limit
        let cutIdx = remaining.lastIndexOf('\n\n', MAX_PART);
        if (cutIdx < MAX_PART * 0.3) {
          // Paragraph break too early — try single newline
          cutIdx = remaining.lastIndexOf('\n', MAX_PART);
        }
        if (cutIdx < MAX_PART * 0.3) {
          // No good line break — hard cut at a space
          cutIdx = remaining.lastIndexOf(' ', MAX_PART);
        }
        if (cutIdx < MAX_PART * 0.3) {
          cutIdx = MAX_PART; // absolute fallback
        }
        parts.push(remaining.substring(0, cutIdx));
        remaining = remaining.substring(cutIdx).replace(/^\n+/, '');
      }
      const total = parts.length;
      for (let i = 0; i < total; i++) {
        const pageHeader = i === 0 ? header : '';
        const pageFooter = total > 1 ? `\n\n<i>— page ${i + 1}/${total} —</i>` : '';
        await sendTelegram(chatId, pageHeader + parts[i] + pageFooter, lovableKey, telegramKey);
      }
    }
    return;
  }

  // /scene — AI-generated "where are we right now" summary
  if (cmd === '/scene') {
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first with /link CODE', lovableKey, telegramKey); return; }
    const { data: memberships } = await supabase
      .from('party_members')
      .select('party_id, character_name')
      .eq('user_id', userId);
    if (!memberships || memberships.length === 0) {
      await sendTelegram(chatId, '👥 You are not in any party.', lovableKey, telegramKey);
      return;
    }
    let recentMessages: Array<{ content: string; sender_name: string; role: string }> = [];
    for (const m of memberships) {
      const { data: msgs } = await supabase
        .from('party_dm_messages')
        .select('content, sender_name, role')
        .eq('party_id', m.party_id)
        .order('created_at', { ascending: false })
        .limit(8);
      if (msgs && msgs.length > 0) {
        recentMessages = msgs.reverse();
        break;
      }
    }
    if (recentMessages.length === 0) {
      await sendTelegram(chatId, '📖 No recent messages found.', lovableKey, telegramKey);
      return;
    }
    await sendTelegram(chatId, '🗺️ <i>Surveying the scene...</i>', lovableKey, telegramKey);
    const narrativeContext = recentMessages
      .map(m => `[${m.sender_name}]: ${m.content.substring(0, 500)}`)
      .join('\n\n');
    try {
      const response = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          max_tokens: 600,
          messages: [
            {
              role: 'system',
              content: 'You are a concise narrator. Based on the recent game messages provided, describe the CURRENT SCENE in 3-5 sentences. Answer: Where are the characters right now? What just happened? What is the immediate situation? Write in present tense. Use plain text only — no markdown, no asterisks, no bullet points. Keep it under 150 words.',
            },
            { role: 'user', content: `Recent game messages:\n\n${narrativeContext}\n\nDescribe the current scene.` },
          ],
        }),
      });
      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || 'Could not determine the current scene.';
      const truncated = answer.length > 1500 ? answer.substring(0, 1500) + '...' : answer;
      await sendTelegram(chatId, `🗺️ <b>Current Scene</b>\n\n${truncated}`, lovableKey, telegramKey);
    } catch (err) {
      console.error('/scene AI error:', err);
      await sendTelegram(chatId, '❌ Failed to generate scene summary.', lovableKey, telegramKey);
    }
    return;
  }

  // /who NPC — AI-powered NPC lookup from campaign history
  if (cmd.startsWith('/who ')) {
    const npcName = text.trim().substring(5).trim();
    if (!npcName) {
      await sendTelegram(chatId, '❌ Usage: /who Rhiannon', lovableKey, telegramKey);
      return;
    }
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first with /link CODE', lovableKey, telegramKey); return; }
    const { data: memberships } = await supabase
      .from('party_members')
      .select('party_id')
      .eq('user_id', userId);
    if (!memberships || memberships.length === 0) {
      await sendTelegram(chatId, '👥 You are not in any party.', lovableKey, telegramKey);
      return;
    }
    let relevantMessages: string[] = [];
    let campaignSummary = '';
    for (const m of memberships) {
      const { data: msgs } = await supabase
        .from('party_dm_messages')
        .select('content, sender_name')
        .eq('party_id', m.party_id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (msgs && msgs.length > 0) {
        const namePattern = new RegExp(npcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        relevantMessages = msgs
          .filter((msg: any) => namePattern.test(msg.content))
          .slice(0, 10)
          .map((msg: any) => `[${msg.sender_name}]: ${msg.content.substring(0, 400)}`);
        const { data: sessionState } = await supabase
          .from('party_shared_state')
          .select('state_data')
          .eq('party_id', m.party_id)
          .eq('state_type', 'dm_session')
          .maybeSingle();
        campaignSummary = (sessionState?.state_data as any)?.campaignSummary || '';
        break;
      }
    }
    if (relevantMessages.length === 0) {
      await sendTelegram(chatId, `🔍 No mentions of "${npcName}" found in recent campaign history.`, lovableKey, telegramKey);
      return;
    }
    await sendTelegram(chatId, `🔍 <i>Searching for ${npcName}...</i>`, lovableKey, telegramKey);
    const context = relevantMessages.join('\n\n');
    const summaryCtx = campaignSummary ? `Campaign summary: ${campaignSummary.substring(0, 1000)}\n\n` : '';
    try {
      const response = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          max_tokens: 800,
          messages: [
            {
              role: 'system',
              content: `You are a campaign note-taker. Based on the provided campaign messages, compile what the party knows about the NPC named "${npcName}". Include: who they are, their role/occupation, their relationship to the party, notable things they said or did, and any unresolved business. If the information is sparse, say so. Write in plain text — no markdown, no asterisks, no bullet points. Keep it under 200 words.`,
            },
            { role: 'user', content: `${summaryCtx}Messages mentioning ${npcName}:\n\n${context}\n\nWhat does the party know about ${npcName}?` },
          ],
        }),
      });
      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || 'Could not find information.';
      const truncated = answer.length > 1500 ? answer.substring(0, 1500) + '...' : answer;
      await sendTelegram(chatId, `🔍 <b>${npcName}</b>\n\n${truncated}`, lovableKey, telegramKey);
    } catch (err) {
      console.error('/who AI error:', err);
      await sendTelegram(chatId, '❌ Failed to look up NPC.', lovableKey, telegramKey);
    }
    return;
  }

  // /ask QUESTION — Ask the DM a question with full campaign context
  if (cmd.startsWith('/ask ')) {
    const question = text.trim().substring(5).trim();
    if (!question) {
      await sendTelegram(chatId, '❌ Usage: /ask Can I use my signet ability underwater?', lovableKey, telegramKey);
      return;
    }
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first with /link CODE', lovableKey, telegramKey); return; }
    const save = await getCharacterData(userId, supabase);
    const charData = save?.character_data as any;
    const ext = (save?.extended_data || {}) as any;
    let charSummary = '';
    if (charData) {
      const classStr = charData.primaryClass ? charData.primaryClass.charAt(0).toUpperCase() + charData.primaryClass.slice(1) : 'Adventurer';
      const hp = ext.hpState;
      charSummary = `Character: ${charData.name || 'Unknown'}, Level ${charData.level || 1} ${classStr}`;
      if (hp) charSummary += `, HP ${hp.current}/${hp.max}`;
      if (ext.abilityScores) {
        const scores = ext.abilityScores;
        charSummary += `\nAbility Scores: STR ${scores.strength} DEX ${scores.dexterity} CON ${scores.constitution} INT ${scores.intelligence} WIS ${scores.wisdom} CHA ${scores.charisma}`;
      }
      if (ext.spellcasting?.preparedSpells?.length > 0) {
        charSummary += `\nPrepared Spells: ${(ext.spellcasting.preparedSpells as string[]).slice(0, 15).join(', ')}`;
      }
    }
    let campaignSummary = '';
    let recentNarrative = '';
    const { data: memberships } = await supabase
      .from('party_members')
      .select('party_id, character_name')
      .eq('user_id', userId);
    if (memberships && memberships.length > 0) {
      for (const m of memberships) {
        const { data: sessionState } = await supabase
          .from('party_shared_state')
          .select('state_data')
          .eq('party_id', m.party_id)
          .eq('state_type', 'dm_session')
          .maybeSingle();
        const session = sessionState?.state_data as any;
        if (session?.campaignSummary) {
          campaignSummary = session.campaignSummary.substring(0, 2000);
        }
        const { data: msgs } = await supabase
          .from('party_dm_messages')
          .select('content, sender_name')
          .eq('party_id', m.party_id)
          .eq('role', 'assistant')
          .order('created_at', { ascending: false })
          .limit(3);
        if (msgs && msgs.length > 0) {
          recentNarrative = msgs.reverse().map((msg: any) => msg.content.substring(0, 500)).join('\n---\n');
          break;
        }
      }
    }
    await sendTelegram(chatId, '🤔 <i>The DM considers your question...</i>', lovableKey, telegramKey);
    const contextParts = [
      charSummary ? `Player Character:\n${charSummary}` : '',
      campaignSummary ? `Campaign Summary:\n${campaignSummary}` : '',
      recentNarrative ? `Recent Events:\n${recentNarrative}` : '',
    ].filter(Boolean).join('\n\n');
    try {
      const response = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          max_tokens: 1000,
          messages: [
            {
              role: 'system',
              content: 'You are an expert D&D 5e Dungeon Master answering a player\'s question between sessions. You have access to their character sheet and campaign context. Answer clearly and helpfully. If the question is about rules, cite the relevant rule. If it is about the campaign world, answer based on the provided context. If you do not have enough context, say so and give your best guidance. Use plain text — no markdown, no asterisks. Keep your answer under 250 words.',
            },
            { role: 'user', content: `${contextParts}\n\nPlayer's question: ${question}` },
          ],
        }),
      });
      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || 'The DM has no answer at this time.';
      const truncated = answer.length > 1500 ? answer.substring(0, 1500) + '...' : answer;
      await sendTelegram(chatId, `🤔 <b>Ask the DM</b>\n<i>${question.substring(0, 80)}</i>\n\n${truncated}`, lovableKey, telegramKey);
    } catch (err) {
      console.error('/ask AI error:', err);
      await sendTelegram(chatId, '❌ The DM could not be reached. Try again later.', lovableKey, telegramKey);
    }
    return;
  }

  // /suggest — AI tactical suggestions based on current character state and situation
  if (cmd === '/suggest') {
    const userId = await getUserIdFromChat(chatId, supabase);
    if (!userId) { await sendTelegram(chatId, '🔗 Link your account first with /link CODE', lovableKey, telegramKey); return; }
    const save = await getCharacterData(userId, supabase);
    if (!save) { await sendTelegram(chatId, '❌ No character found.', lovableKey, telegramKey); return; }
    const charData = save.character_data as any;
    const ext = (save.extended_data || {}) as any;
    const classStr = charData?.primaryClass ? charData.primaryClass.charAt(0).toUpperCase() + charData.primaryClass.slice(1) : 'Adventurer';
    const hp = ext.hpState;
    const sc = ext.spellcasting;
    const conditions = ext.conditions?.activeConditions;
    let charContext = `Character: ${charData?.name || 'Unknown'}, Level ${charData?.level || 1} ${classStr}`;
    if (hp) charContext += `\nHP: ${hp.current}/${hp.max}`;
    if (conditions && conditions.length > 0) {
      charContext += `\nConditions: ${conditions.map((c: any) => c.name || c.id).join(', ')}`;
    }
    if (sc?.preparedSpells?.length > 0) {
      charContext += `\nPrepared Spells: ${(sc.preparedSpells as string[]).slice(0, 15).join(', ')}`;
    }
    if (sc?.spellSlots) {
      const used = sc.usedSlots || {};
      const slotParts: string[] = [];
      for (const [level, total] of Object.entries(sc.spellSlots as Record<string, number>)) {
        if ((total as number) <= 0) continue;
        const remaining = (total as number) - (((used as any)[level] as number) || 0);
        if (remaining > 0) slotParts.push(`Lvl${level}: ${remaining}/${total}`);
      }
      if (slotParts.length > 0) charContext += `\nSlots: ${slotParts.join(', ')}`;
    }
    if (sc?.concentratingOn) {
      charContext += `\nConcentrating on: ${sc.concentratingOn}`;
    }
    if (ext.abilityScores) {
      const s = ext.abilityScores;
      charContext += `\nScores: STR ${s.strength} DEX ${s.dexterity} CON ${s.constitution} INT ${s.intelligence} WIS ${s.wisdom} CHA ${s.charisma}`;
    }
    let recentNarrative = '';
    const { data: memberships } = await supabase
      .from('party_members')
      .select('party_id')
      .eq('user_id', userId);
    if (memberships && memberships.length > 0) {
      for (const m of memberships) {
        const { data: msgs } = await supabase
          .from('party_dm_messages')
          .select('content, sender_name')
          .eq('party_id', m.party_id)
          .order('created_at', { ascending: false })
          .limit(5);
        if (msgs && msgs.length > 0) {
          recentNarrative = msgs.reverse().map((msg: any) => `[${msg.sender_name}]: ${msg.content.substring(0, 400)}`).join('\n\n');
          break;
        }
      }
    }
    await sendTelegram(chatId, '💡 <i>Analyzing your options...</i>', lovableKey, telegramKey);
    try {
      const response = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          max_tokens: 800,
          messages: [
            {
              role: 'system',
              content: 'You are a tactical D&D advisor. Given the character\'s current state and the recent narrative situation, suggest exactly 3 concrete actions the player could take on their next turn or in the current scene. For each suggestion: name it briefly, explain what it does mechanically, and say why it is a good idea right now. Consider their HP, spell slots, conditions, and the situation. Use plain text — no markdown, no asterisks. Number the suggestions 1, 2, 3. Keep the total under 200 words.',
            },
            { role: 'user', content: `${charContext}\n\nRecent situation:\n${recentNarrative || 'No recent narrative available.'}\n\nSuggest 3 tactical options.` },
          ],
        }),
      });
      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || 'No suggestions available.';
      const truncated = answer.length > 1500 ? answer.substring(0, 1500) + '...' : answer;
      await sendTelegram(chatId, `💡 <b>Tactical Suggestions</b>\n\n${truncated}`, lovableKey, telegramKey);
    } catch (err) {
      console.error('/suggest AI error:', err);
      await sendTelegram(chatId, '❌ Failed to generate suggestions.', lovableKey, telegramKey);
    }
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
