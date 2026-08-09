import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AvatarKind = 'ic' | 'ooc';
export interface ChatAvatars { ic?: string; ooc?: string }

const LEGACY_STATE_TYPE = 'chat_avatars';

/**
 * Per-player chat avatars (one in-character portrait, one out-of-character photo).
 * Stored per user in `player_chat_avatars`, so the faces follow each player across
 * every party and every session. Legacy party-scoped rows are migrated on load.
 */
export function useChatAvatars(partyId: string | null, userId: string | undefined) {
  const [avatars, setAvatars] = useState<Record<string, ChatAvatars>>({});
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const next: Record<string, ChatAvatars> = {};

    // Legacy party-scoped avatars first, so the durable table can override them.
    if (partyId) {
      const { data: legacy } = await (supabase.from('party_shared_state') as any)
        .select('user_id, state_data')
        .eq('party_id', partyId)
        .eq('state_type', LEGACY_STATE_TYPE);
      for (const row of (legacy || []) as Array<{ user_id: string; state_data: any }>) {
        const d = row.state_data || {};
        next[row.user_id] = {
          ic: typeof d.ic === 'string' ? d.ic : undefined,
          ooc: typeof d.ooc === 'string' ? d.ooc : undefined,
        };
      }
    }

    const { data } = await (supabase.from('player_chat_avatars') as any)
      .select('user_id, ic_url, ooc_url');
    for (const row of (data || []) as Array<{ user_id: string; ic_url: string | null; ooc_url: string | null }>) {
      next[row.user_id] = {
        ic: row.ic_url || next[row.user_id]?.ic,
        ooc: row.ooc_url || next[row.user_id]?.ooc,
      };
    }
    setAvatars(next);

    // One-time upgrade: copy this player's legacy pictures into the durable table.
    if (userId && next[userId] && !(data || []).some((r: any) => r.user_id === userId)) {
      const mine = next[userId];
      if (mine.ic || mine.ooc) {
        await (supabase.from('player_chat_avatars') as any).upsert({
          user_id: userId,
          ic_url: mine.ic ?? null,
          ooc_url: mine.ooc ?? null,
        }, { onConflict: 'user_id' });
      }
    }
  }, [partyId, userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('player-chat-avatars')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'player_chat_avatars',
      }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const uploadAvatar = useCallback(async (kind: AvatarKind, file: File) => {
    if (!userId) return;
    if (file.size > 8 * 1024 * 1024) throw new Error('Image too large (max 8MB)');
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `avatars/${userId}/${kind}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('party-chat-images').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('party-chat-images').getPublicUrl(path);
      const url = urlData.publicUrl;

      setAvatars(prev => ({ ...prev, [userId]: { ...(prev[userId] || {}), [kind]: url } }));

      const { error: saveError } = await (supabase.from('player_chat_avatars') as any).upsert({
        user_id: userId,
        ...(kind === 'ic' ? { ic_url: url } : { ooc_url: url }),
      }, { onConflict: 'user_id' });
      if (saveError) throw saveError;
    } finally {
      setUploading(false);
    }
  }, [userId]);

  return { avatars, uploadAvatar, uploading };
}
