import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AvatarKind = 'ic' | 'ooc';
export interface ChatAvatars { ic?: string; ooc?: string }

const STATE_TYPE = 'chat_avatars';

/**
 * Per-player chat avatars (one in-character portrait, one out-of-character photo).
 * Stored per user in party_shared_state so every player sees the same faces.
 */
export function useChatAvatars(partyId: string | null, userId: string | undefined) {
  const [avatars, setAvatars] = useState<Record<string, ChatAvatars>>({});
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!partyId) return;
    const { data } = await (supabase.from('party_shared_state') as any)
      .select('user_id, state_data')
      .eq('party_id', partyId)
      .eq('state_type', STATE_TYPE);
    const next: Record<string, ChatAvatars> = {};
    for (const row of (data || []) as Array<{ user_id: string; state_data: any }>) {
      const d = row.state_data || {};
      next[row.user_id] = {
        ic: typeof d.ic === 'string' ? d.ic : undefined,
        ooc: typeof d.ooc === 'string' ? d.ooc : undefined,
      };
    }
    setAvatars(next);
  }, [partyId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!partyId) return;
    const channel = supabase
      .channel(`chat-avatars-${partyId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'party_shared_state',
        filter: `party_id=eq.${partyId}`,
      }, (payload: any) => {
        const row = payload.new as { state_type?: string } | null;
        if (row?.state_type === STATE_TYPE) load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partyId, load]);

  const uploadAvatar = useCallback(async (kind: AvatarKind, file: File) => {
    if (!partyId || !userId) return;
    if (file.size > 8 * 1024 * 1024) throw new Error('Image too large (max 8MB)');
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `avatars/${partyId}/${userId}-${kind}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('party-chat-images').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('party-chat-images').getPublicUrl(path);
      const url = urlData.publicUrl;
      const next: ChatAvatars = { ...(avatars[userId] || {}), [kind]: url };
      setAvatars(prev => ({ ...prev, [userId]: next }));
      await (supabase.from('party_shared_state') as any).upsert({
        party_id: partyId,
        user_id: userId,
        state_type: STATE_TYPE,
        state_data: next as unknown as Record<string, unknown>,
      }, { onConflict: 'party_id,user_id,state_type' });
    } finally {
      setUploading(false);
    }
  }, [partyId, userId, avatars]);

  return { avatars, uploadAvatar, uploading };
}
