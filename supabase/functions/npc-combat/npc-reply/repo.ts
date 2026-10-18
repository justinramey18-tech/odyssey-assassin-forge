// npc-reply: every database read and write the function makes, through a
// service-role Supabase client (it bypasses row level security, so every
// permission check happens in handler.ts before anything is read or written).

export interface RoundLine {
  id: string;
  party_id: string;
  user_id: string;
  character_name: string;
  content: string;
  in_character: boolean;
  round_id: string;
  consumed: boolean;
  selected: boolean;
  created_at: string;
  npc_id: string | null;
  /** v3: the mood an NPC line was said in. */
  npc_mood?: string | null;
}

export interface NpcRow {
  id: string;
  party_id: string;
  name: string;
  model: string;
  on_stage: boolean;
  archived: boolean;
  /** v2: false when the host switched spell reactions off. Missing means on. */
  reacts_to_spells?: boolean;
  combat_state?: string | null;
  /** v3: the NPC's current mood. */
  mood?: string | null;
  /** v3: when it came on stage (it only knows what was said since). Null = no window. */
  on_stage_since?: string | null;
  /** Set when this NPC is an away player's character (a stand-in). */
  player_user_id?: string | null;
  /** Persistent social opposition modifiers (may be missing or malformed on old rows). */
  social_stats?: unknown;
  /** D-24: set while this NPC travels and fights with the party. */
  ally_since?: string | null;
  /** D-24: the player who accepted the offer (or the host who added it). */
  ally_of?: string | null;
}

export interface NpcSocialStats { wisdom: number; charisma: number; insight: number; deception: number; perception: number; wisdomSave: number }
const SOCIAL_STAT_KEYS = ['wisdom', 'charisma', 'insight', 'deception', 'perception', 'wisdomSave'] as const;

/** Any stored value → six whole-number modifiers, clamped -10..20; missing or bad values are 0. */
export function normalizeSocialStats(raw: unknown): NpcSocialStats {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: NpcSocialStats = { wisdom: 0, charisma: 0, insight: 0, deception: 0, perception: 0, wisdomSave: 0 };
  for (const k of SOCIAL_STAT_KEYS) {
    const v = src[k];
    const n = Number(v);
    if (v === null || v === '' || typeof v === 'boolean' || !Number.isFinite(n)) continue;
    out[k] = Math.min(20, Math.max(-10, Math.round(n)));
  }
  return out;
}

/** The host's guide for one NPC (v3 adds the structured fields). */
export interface NpcGuideRow {
  guide: string;
  secrets: string;
  wants?: string;
  levers?: string;
  hard_lines?: string;
  mood_range?: string;
  grudge_style?: string;
}

export type ReplyKind = 'reply' | 'spell' | 'roll' | 'banter';

export interface ReplyRecord {
  id: string;
  party_id: string;
  npc_id: string;
  /** Null only for the opening line of an NPC scene. */
  prompt_message_id: string | null;
  reply_message_id: string | null;
  kind?: ReplyKind;
}

/** v2: what one NPC remembers, and how it feels about each character. */
export interface NpcMind {
  /** What happened (oldest first). */
  memory: string[];
  /** v3: unfinished business (oldest first). */
  threads?: string[];
  /** v3: facts it has said about itself (oldest first). */
  selfFacts?: string[];
  attitudes: Array<{
    user_id: string;
    character_name: string;
    score: number;
    /** v3 */
    knows_name?: boolean;
    last_seen_at?: string | null;
    updated_at?: string | null;
  }>;
}

export interface NpcContext {
  guides: Array<{ name: string | null; content: string | null }>;
  anchors: unknown;
  summary: string;
  latestPost: string;
  roster: Array<{ user_id?: string; character_name: string; character_status: Record<string, unknown> | null; updated_at?: string | null }>;
  /** Live Table lines, oldest first. */
  table: Array<Pick<RoundLine, 'id' | 'user_id' | 'character_name' | 'content' | 'in_character' | 'npc_id' | 'created_at'>>;
  /** v2: filled when loadContext is given an NPC id. */
  mind?: NpcMind;
  /** v3: emoji reactions to this NPC's lines in the table above. */
  reactions?: Array<{ message_id: string; emoji: string }>;
  fight?: { hp: number; maxHp: number } | null;
  /** D-24: names of the NPCs that travel with the party right now (on stage or not). */
  allies?: string[];
}

export interface ClaimRow {
  party_id: string;
  npc_id: string;
  prompt_message_id: string;
  requested_by: string;
  model_requested: string;
  /** v2: what kind of answer this is (default 'reply'). */
  kind?: ReplyKind;
}

export interface FinishPatch {
  reply_message_id?: string | null;
  model_used?: string | null;
  fell_back?: boolean;
  fallback_reason?: string | null;
  error?: string | null;
  latency_ms?: number | null;
  cost_usd?: number | null;
}

export interface NpcRepo {
  getLine(id: string): Promise<RoundLine | null>;
  getPartyHost(partyId: string): Promise<string | null>;
  isMember(partyId: string, userId: string): Promise<boolean>;
  getNpc(id: string): Promise<NpcRow | null>;
  getGuide(npcId: string): Promise<NpcGuideRow | null>;
  listStageNames(partyId: string): Promise<string[]>;
  loadContext(partyId: string, hostId: string, until?: string, npcId?: string): Promise<NpcContext>;
  /** Reserve the right to answer a line. "taken" when it was answered, or is being answered right now. */
  claim(row: ClaimRow, now: number): Promise<'claimed' | 'taken'>;
  insertNpcLine(row: Omit<RoundLine, 'id' | 'consumed' | 'created_at'>): Promise<string>;
  updateNpcLine(id: string, content: string, mood?: string | null): Promise<void>;
  finish(promptMessageId: string, npcId: string, patch: FinishPatch): Promise<void>;
  /** Make sure one AI event memory with exactly this note exists for the NPC (idempotent). Optional for older test doubles. */
  ensureEventMemory?(npcId: string, partyId: string, note: string): Promise<void>;
  findReplyRecord(replyMessageId: string): Promise<ReplyRecord | null>;
  // ── v2 (optional so older test doubles still work) ──
  /** On-stage NPCs that react to spells, in roster order. */
  listSpellReactors?(partyId: string): Promise<NpcRow[]>;
  /** A reply record for a scene line (no claim race: each scene line is new). Returns its id. */
  startRecord?(row: Omit<ClaimRow, 'prompt_message_id'> & { prompt_message_id: string | null; kind: ReplyKind }): Promise<string>;
  finishRecord?(id: string, patch: FinishPatch): Promise<void>;
  /** True when a player (not an NPC) posted an in-character line after this time. */
  playerSpokeSince?(partyId: string, sinceIso: string): Promise<boolean>;
  /** Live NPC Combat: true when this NPC posted a Live Table line after this time. */
  npcSpokeSince?(npcId: string, sinceIso: string): Promise<boolean>;
  /** The newest line in the Live Table, for a scene's round id. */
  latestLine?(partyId: string): Promise<RoundLine | null>;
  /** v3: save the NPC's mood after it speaks. */
  setNpcMood?(npcId: string, mood: string): Promise<void>;
  // ── D-24: NPC allies (optional so older test doubles still work) ──
  /** True when this NPC is fighting AGAINST the party in a fight that has not ended. */
  enemyInOpenFight?(npcId: string): Promise<boolean>;
  /** How many NPCs travel with the party right now (archived ones don't count). */
  countAllies?(partyId: string): Promise<number>;
  /** Put an NPC in the party (allyOf = who accepted or added it) or take it out (null). Returns the row. */
  setAlly?(npcId: string, allyOf: string | null, nowIso: string): Promise<NpcRow | null>;
  /** A short party line in the Live Table ("🤝 Wulfgar joins the party."), ticked for the next Send to DM. */
  postPartyLine?(partyId: string, hostId: string, text: string): Promise<void>;
}

/** A claim with no answer that hasn't changed in this long is treated as abandoned. */
export const STALE_CLAIM_MS = 120_000;

const LINE_COLUMNS = 'id, party_id, user_id, character_name, content, in_character, round_id, consumed, selected, created_at, npc_id';
const NPC_COLUMNS = 'id, party_id, name, model, on_stage, archived, reacts_to_spells, mood, on_stage_since, player_user_id, combat_state, social_stats, ally_since, ally_of';
const GUIDE_COLUMNS = 'guide, secrets, wants, levers, hard_lines, mood_range, grudge_style';

// deno-lint-ignore no-explicit-any
export function createRepo(db: any): NpcRepo {
  const fail = (what: string, error: { message?: string } | null) => {
    if (error) throw new Error(`${what}: ${error.message || 'database error'}`);
  };

  return {
    async getLine(id) {
      const { data, error } = await db.from('party_round_chat').select(LINE_COLUMNS).eq('id', id).maybeSingle();
      fail('read line', error);
      return data ?? null;
    },

    async getPartyHost(partyId) {
      const { data, error } = await db.from('parties').select('created_by').eq('id', partyId).maybeSingle();
      fail('read party', error);
      return data?.created_by ?? null;
    },

    async isMember(partyId, userId) {
      const { data, error } = await db.from('party_members').select('user_id').eq('party_id', partyId).eq('user_id', userId).limit(1);
      fail('read seat', error);
      return Array.isArray(data) && data.length > 0;
    },

    async getNpc(id) {
      const { data, error } = await db.from('party_npcs').select(NPC_COLUMNS).eq('id', id).maybeSingle();
      fail('read NPC', error);
      return data ?? null;
    },

    async getGuide(npcId) {
      const { data, error } = await db.from('party_npc_guides').select(GUIDE_COLUMNS).eq('npc_id', npcId).maybeSingle();
      fail('read NPC guide', error);
      return data ?? null;
    },

    async listStageNames(partyId) {
      const { data, error } = await db.from('party_npcs').select('name')
        .eq('party_id', partyId).eq('on_stage', true).eq('archived', false)
        .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
      fail('read stage', error);
      return (data ?? []).map((r: { name: string }) => r.name);
    },

    async loadContext(partyId, hostId, until, npcId) {
      const [guides, anchors, session, posts, roster, table, memory, attitudes, allies] = await Promise.all([
        db.from('gm_guides').select('name, content')
          .eq('user_id', hostId).eq('mode', 'party').eq('enabled', true)
          .order('created_at', { ascending: true }),
        // Each player keeps their own anchors row; the host's is the campaign's.
        db.from('party_shared_state').select('state_data')
          .eq('party_id', partyId).eq('state_type', 'party_memory_anchors').eq('user_id', hostId)
          .limit(1),
        db.from('party_shared_state').select('state_data')
          .eq('party_id', partyId).eq('state_type', 'dm_session')
          .order('updated_at', { ascending: false }).limit(1),
        // The DM's own posts only: sealed NPC lines are saved as assistant rows too, under the NPC's name.
        db.from('party_dm_messages').select('content, team, is_afk_marker')
          .eq('party_id', partyId).eq('role', 'assistant').eq('sender_name', 'DM')
          .order('created_at', { ascending: false }).limit(10),
        db.from('party_members').select('user_id, character_name, character_status, updated_at').eq('party_id', partyId),
        (until
          ? db.from('party_round_chat').select('id, user_id, character_name, content, in_character, npc_id, created_at')
            .eq('party_id', partyId).lte('created_at', until)
          : db.from('party_round_chat').select('id, user_id, character_name, content, in_character, npc_id, created_at')
            .eq('party_id', partyId)
        ).order('created_at', { ascending: false }).limit(40),
        npcId
          ? db.from('party_npc_memories').select('note, kind, created_at').eq('npc_id', npcId)
            .order('created_at', { ascending: false }).limit(80)
          : Promise.resolve({ data: [], error: null }),
        npcId
          ? db.from('party_npc_attitudes').select('user_id, character_name, score, knows_name, last_seen_at, updated_at').eq('npc_id', npcId)
          : Promise.resolve({ data: [], error: null }),
        // D-24: who travels with the party right now.
        db.from('party_npcs').select('name').eq('party_id', partyId).eq('archived', false).not('ally_since', 'is', null)
          .order('sort_order', { ascending: true }),
      ]);
      fail('read guides', guides.error);
      fail('read memory anchors', anchors.error);
      fail('read session', session.error);
      fail('read story', posts.error);
      fail('read roster', roster.error);
      fail('read table', table.error);
      fail('read NPC memory', memory.error);
      fail('read NPC attitudes', attitudes.error);
      fail('read allies', allies.error);

      const post = (posts.data ?? []).find((p: { team: string | null; is_afk_marker: boolean }) =>
        !p.is_afk_marker && !(p.team || '').startsWith('whisper:'));
      const summary = session.data?.[0]?.state_data?.campaignSummary;
      const notes = [...(memory.data ?? [])].reverse() as Array<{ note: string; kind?: string | null }>;
      const ofKind = (k: string) => notes.filter(n => (n.kind || 'event') === k).map(n => n.note);

      // v3: emoji reactions to this NPC's own recent lines.
      let reactions: Array<{ message_id: string; emoji: string }> = [];
      const ownIds = npcId ? (table.data ?? []).filter((l: { npc_id: string | null }) => l.npc_id === npcId).map((l: { id: string }) => l.id).slice(0, 10) : [];
      if (ownIds.length) {
        const r = await db.from('party_round_chat_reactions').select('message_id, emoji').in('message_id', ownIds).limit(200);
        fail('read reactions', r.error);
        reactions = r.data ?? [];
      }
      let fight: { hp: number; maxHp: number } | null = null;
      if (npcId) {
        try {
          const f = await db.from('party_fight_combatants').select('hp, max_hp, status, party_fights!inner(status)')
            .eq('npc_id', npcId).neq('party_fights.status', 'ended').limit(1);
          if (f.error) console.warn('read fight', f.error.message);
          const row = f.data?.[0];
          if (row && row.status === 'up') fight = { hp: row.hp, maxHp: row.max_hp };
        } catch (e) { console.warn('read fight', e); }
      }
      return {
        guides: guides.data ?? [],
        anchors: anchors.data?.[0]?.state_data?.anchors ?? [],
        summary: typeof summary === 'string' ? summary : '',
        latestPost: post?.content ?? '',
        fight,
        roster: roster.data ?? [],
        table: [...(table.data ?? [])].reverse(),
        mind: npcId
          ? {
            memory: ofKind('event'),
            threads: ofKind('thread'),
            selfFacts: ofKind('self'),
            attitudes: (attitudes.data ?? []) as NpcMind['attitudes'],
          }
          : undefined,
        reactions,
        allies: (allies.data ?? []).map((r: { name: string }) => r.name),
      };
    },

    async claim(row, now) {
      const { error } = await db.from('party_npc_replies').insert(row);
      if (!error) return 'claimed';
      if (error.code !== '23505') fail('reserve reply', error);

      const { data: existing, error: readErr } = await db.from('party_npc_replies')
        .select('id, reply_message_id, error, updated_at')
        .eq('prompt_message_id', row.prompt_message_id).eq('npc_id', row.npc_id)
        .maybeSingle();
      fail('read reply record', readErr);
      if (!existing || existing.reply_message_id) return 'taken';
      const stale = now - Date.parse(existing.updated_at) > STALE_CLAIM_MS;
      if (!existing.error && !stale) return 'taken';

      // A failed or abandoned attempt: take it over, unless someone else just did.
      const { data: reset, error: resetErr } = await db.from('party_npc_replies')
        .update({
          error: null,
          model_used: null,
          fell_back: false,
          fallback_reason: null,
          requested_by: row.requested_by,
          model_requested: row.model_requested,
          ...(row.kind ? { kind: row.kind } : {}),
        })
        .eq('id', existing.id).eq('updated_at', existing.updated_at)
        .select('id');
      fail('retry reply record', resetErr);
      return Array.isArray(reset) && reset.length > 0 ? 'claimed' : 'taken';
    },

    async insertNpcLine(row) {
      const { data, error } = await db.from('party_round_chat').insert(row).select('id').single();
      fail('post NPC line', error);
      return data.id as string;
    },

    async updateNpcLine(id, content, mood) {
      const patch: Record<string, unknown> = { content };
      if (mood !== undefined) patch.npc_mood = mood;
      const { error } = await db.from('party_round_chat').update(patch).eq('id', id).not('npc_id', 'is', null);
      fail('rewrite NPC line', error);
    },

    async ensureEventMemory(npcId, partyId, note) {
      const text = note.replace(/\s+/g, ' ').trim().slice(0, 300);
      if (!text) return;
      const { data, error } = await db.from('party_npc_memories').select('id')
        .eq('npc_id', npcId).eq('party_id', partyId).eq('source', 'ai').eq('kind', 'event').eq('note', text).limit(1);
      fail('check NPC memory', error);
      if (Array.isArray(data) && data.length > 0) return;
      const { error: insErr } = await db.from('party_npc_memories').insert({ npc_id: npcId, party_id: partyId, note: text, source: 'ai', kind: 'event' });
      fail('save NPC memory', insErr);
    },

    async finish(promptMessageId, npcId, patch) {
      const { error } = await db.from('party_npc_replies').update(patch)
        .eq('prompt_message_id', promptMessageId).eq('npc_id', npcId);
      fail('save reply record', error);
    },

    async findReplyRecord(replyMessageId) {
      const { data, error } = await db.from('party_npc_replies')
        .select('id, party_id, npc_id, prompt_message_id, reply_message_id, kind')
        .eq('reply_message_id', replyMessageId).maybeSingle();
      fail('read reply record', error);
      return data ?? null;
    },

    async listSpellReactors(partyId) {
      const { data, error } = await db.from('party_npcs').select(NPC_COLUMNS)
        .eq('party_id', partyId).eq('on_stage', true).eq('archived', false).eq('reacts_to_spells', true).is('combat_state', null)
        .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
      fail('read spell reactors', error);
      return data ?? [];
    },

    async startRecord(row) {
      const { data, error } = await db.from('party_npc_replies').insert(row).select('id').single();
      fail('start scene record', error);
      return data.id as string;
    },

    async finishRecord(id, patch) {
      const { error } = await db.from('party_npc_replies').update(patch).eq('id', id);
      fail('save scene record', error);
    },

    async playerSpokeSince(partyId, sinceIso) {
      const { data, error } = await db.from('party_round_chat').select('id')
        .eq('party_id', partyId).is('npc_id', null).eq('in_character', true).gt('created_at', sinceIso)
        .limit(1);
      fail('check for player lines', error);
      return Array.isArray(data) && data.length > 0;
    },

    async npcSpokeSince(npcId, sinceIso) {
      const { data, error } = await db.from('party_round_chat').select('id')
        .eq('npc_id', npcId).gt('created_at', sinceIso)
        .limit(1);
      fail('check for NPC lines', error);
      return Array.isArray(data) && data.length > 0;
    },

    async setNpcMood(npcId, mood) {
      const { error } = await db.from('party_npcs').update({ mood }).eq('id', npcId);
      fail('save NPC mood', error);
    },

    async latestLine(partyId) {
      const { data, error } = await db.from('party_round_chat').select(LINE_COLUMNS)
        .eq('party_id', partyId).order('created_at', { ascending: false }).limit(1);
      fail('read latest line', error);
      return data?.[0] ?? null;
    },

    // ── D-24: NPC allies ──

    async enemyInOpenFight(npcId) {
      const { data, error } = await db.from('party_fight_combatants').select('id, party_fights!inner(status)')
        .eq('npc_id', npcId).eq('ally', false).neq('party_fights.status', 'ended').limit(1);
      fail('read open fights', error);
      return Array.isArray(data) && data.length > 0;
    },

    async countAllies(partyId) {
      const { data, error } = await db.from('party_npcs').select('id')
        .eq('party_id', partyId).eq('archived', false).not('ally_since', 'is', null);
      fail('count allies', error);
      return Array.isArray(data) ? data.length : 0;
    },

    async setAlly(npcId, allyOf, nowIso) {
      const patch = allyOf ? { ally_since: nowIso, ally_of: allyOf, on_stage: true } : { ally_since: null, ally_of: null };
      const { data, error } = await db.from('party_npcs').update(patch).eq('id', npcId).select(NPC_COLUMNS).maybeSingle();
      fail('save ally', error);
      return data ?? null;
    },

    async postPartyLine(partyId, hostId, text) {
      const { data } = await db.from('party_round_chat').select('round_id')
        .eq('party_id', partyId).order('created_at', { ascending: false }).limit(1);
      const roundId = (data?.[0]?.round_id as string | undefined) ?? crypto.randomUUID();
      const { error } = await db.from('party_round_chat').insert({
        party_id: partyId,
        user_id: hostId,
        character_name: '🤝 Party',
        content: text,
        in_character: true,
        round_id: roundId,
        selected: true,
        npc_id: null,
      });
      fail('post party line', error);
    },
  };
}
