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
}

export interface NpcRow {
  id: string;
  party_id: string;
  name: string;
  model: string;
  on_stage: boolean;
  archived: boolean;
}

export interface ReplyRecord {
  id: string;
  party_id: string;
  npc_id: string;
  prompt_message_id: string;
  reply_message_id: string | null;
}

export interface NpcContext {
  guides: Array<{ name: string | null; content: string | null }>;
  anchors: unknown;
  summary: string;
  latestPost: string;
  roster: Array<{ character_name: string; character_status: Record<string, unknown> | null }>;
  /** Live Table lines, oldest first. */
  table: Array<Pick<RoundLine, 'id' | 'user_id' | 'character_name' | 'content' | 'in_character' | 'npc_id' | 'created_at'>>;
}

export interface ClaimRow {
  party_id: string;
  npc_id: string;
  prompt_message_id: string;
  requested_by: string;
  model_requested: string;
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
  getGuide(npcId: string): Promise<{ guide: string; secrets: string } | null>;
  listStageNames(partyId: string): Promise<string[]>;
  loadContext(partyId: string, hostId: string, until?: string): Promise<NpcContext>;
  /** Reserve the right to answer a line. "taken" when it was answered, or is being answered right now. */
  claim(row: ClaimRow, now: number): Promise<'claimed' | 'taken'>;
  insertNpcLine(row: Omit<RoundLine, 'id' | 'consumed' | 'created_at'>): Promise<string>;
  updateNpcLine(id: string, content: string): Promise<void>;
  finish(promptMessageId: string, npcId: string, patch: FinishPatch): Promise<void>;
  findReplyRecord(replyMessageId: string): Promise<ReplyRecord | null>;
}

/** A claim with no answer that hasn't changed in this long is treated as abandoned. */
export const STALE_CLAIM_MS = 120_000;

const LINE_COLUMNS = 'id, party_id, user_id, character_name, content, in_character, round_id, consumed, selected, created_at, npc_id';

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
      const { data, error } = await db.from('party_npcs').select('id, party_id, name, model, on_stage, archived').eq('id', id).maybeSingle();
      fail('read NPC', error);
      return data ?? null;
    },

    async getGuide(npcId) {
      const { data, error } = await db.from('party_npc_guides').select('guide, secrets').eq('npc_id', npcId).maybeSingle();
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

    async loadContext(partyId, hostId, until) {
      const [guides, anchors, session, posts, roster, table] = await Promise.all([
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
        db.from('party_members').select('character_name, character_status').eq('party_id', partyId),
        (until
          ? db.from('party_round_chat').select('id, user_id, character_name, content, in_character, npc_id, created_at')
            .eq('party_id', partyId).lte('created_at', until)
          : db.from('party_round_chat').select('id, user_id, character_name, content, in_character, npc_id, created_at')
            .eq('party_id', partyId)
        ).order('created_at', { ascending: false }).limit(40),
      ]);
      fail('read guides', guides.error);
      fail('read memory anchors', anchors.error);
      fail('read session', session.error);
      fail('read story', posts.error);
      fail('read roster', roster.error);
      fail('read table', table.error);

      const post = (posts.data ?? []).find((p: { team: string | null; is_afk_marker: boolean }) =>
        !p.is_afk_marker && !(p.team || '').startsWith('whisper:'));
      const summary = session.data?.[0]?.state_data?.campaignSummary;
      return {
        guides: guides.data ?? [],
        anchors: anchors.data?.[0]?.state_data?.anchors ?? [],
        summary: typeof summary === 'string' ? summary : '',
        latestPost: post?.content ?? '',
        roster: roster.data ?? [],
        table: [...(table.data ?? [])].reverse(),
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

    async updateNpcLine(id, content) {
      const { error } = await db.from('party_round_chat').update({ content }).eq('id', id).not('npc_id', 'is', null);
      fail('rewrite NPC line', error);
    },

    async finish(promptMessageId, npcId, patch) {
      const { error } = await db.from('party_npc_replies').update(patch)
        .eq('prompt_message_id', promptMessageId).eq('npc_id', npcId);
      fail('save reply record', error);
    },

    async findReplyRecord(replyMessageId) {
      const { data, error } = await db.from('party_npc_replies')
        .select('id, party_id, npc_id, prompt_message_id, reply_message_id')
        .eq('reply_message_id', replyMessageId).maybeSingle();
      fail('read reply record', error);
      return data ?? null;
    },
  };
}
