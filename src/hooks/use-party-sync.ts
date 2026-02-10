import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

export interface PartyMember {
  id: string;
  party_id: string;
  user_id: string;
  character_name: string;
  character_status: {
    currentHP?: number;
    maxHP?: number;
    tempHP?: number;
    ac?: number;
    conditions?: string[];
    spellSlots?: Record<string, { current: number; max: number }>;
    level?: number;
    className?: string;
  };
  joined_at: string;
  updated_at: string;
}

export interface PartyAction {
  id: string;
  party_id: string;
  sender_user_id: string;
  target_user_id: string;
  action_type: string;
  action_data: {
    senderName?: string;
    spellName?: string;
    itemName?: string;
    hpHealed?: number;
    diceRoll?: string;
  };
  created_at: string;
  applied: boolean;
}

export interface PartyState {
  partyId: string | null;
  linkCode: string | null;
  isCreator: boolean;
  members: PartyMember[];
  isLoading: boolean;
}

export interface UsePartySyncReturn {
  party: PartyState;
  createParty: (characterName: string, status: PartyMember['character_status']) => Promise<string | null>;
  joinParty: (linkCode: string, characterName: string, status: PartyMember['character_status']) => Promise<boolean>;
  leaveParty: () => Promise<void>;
  disbandParty: () => Promise<void>;
  broadcastStatus: (status: PartyMember['character_status']) => void;
  sendHealAction: (targetUserId: string, actionData: PartyAction['action_data']) => Promise<void>;
  sendPing: (pingType: string, senderName: string) => Promise<void>;
  onIncomingHeal: React.MutableRefObject<((hpHealed: number, senderName: string, source: string) => void) | null>;
}

export function usePartySync(): UsePartySyncReturn {
  const { user } = useAuth();
  const [party, setParty] = useState<PartyState>({
    partyId: null,
    linkCode: null,
    isCreator: false,
    members: [],
    isLoading: false,
  });

  const onIncomingHeal = useRef<((hpHealed: number, senderName: string, source: string) => void) | null>(null);
  const statusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<string>('');

  // On mount, check if user is already in a party
  useEffect(() => {
    if (!user) return;

    const checkExisting = async () => {
      const { data: membership } = await supabase
        .from('party_members')
        .select('party_id')
        .eq('user_id', user.id)
        .limit(1) as { data: Array<{ party_id: string }> | null };

      if (membership && membership.length > 0) {
        const partyId = membership[0].party_id;
        // Load party info
        const { data: partyData } = await supabase
          .from('parties')
          .select('*')
          .eq('id', partyId)
          .eq('is_active', true)
          .maybeSingle() as { data: { id: string; link_code: string; created_by: string; is_active: boolean } | null };

        if (partyData) {
          // Load members
          const { data: members } = await supabase
            .from('party_members')
            .select('*')
            .eq('party_id', partyId) as { data: PartyMember[] | null };

          setParty({
            partyId,
            linkCode: partyData.link_code,
            isCreator: partyData.created_by === user.id,
            members: members || [],
            isLoading: false,
          });
        }
      }
    };

    checkExisting();
  }, [user]);

  // Realtime subscriptions
  useEffect(() => {
    if (!party.partyId || !user) return;

    // Subscribe to party member changes
    const membersChannel = supabase
      .channel(`party-members-${party.partyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'party_members',
          filter: `party_id=eq.${party.partyId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMember = payload.new as PartyMember;
            setParty(prev => ({
              ...prev,
              members: [...prev.members.filter(m => m.id !== newMember.id), newMember],
            }));
            if (newMember.user_id !== user.id) {
              toast.success(`${newMember.character_name} joined the party!`);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as PartyMember;
            setParty(prev => ({
              ...prev,
              members: prev.members.map(m => m.id === updated.id ? updated : m),
            }));
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string; user_id?: string; character_name?: string };
            setParty(prev => ({
              ...prev,
              members: prev.members.filter(m => m.id !== old.id),
            }));
            if (old.user_id === user.id) {
              // We were removed (party disbanded)
              setParty({ partyId: null, linkCode: null, isCreator: false, members: [], isLoading: false });
              toast.info('Party disbanded');
            }
          }
        }
      )
      .subscribe();

    // Subscribe to incoming heal actions
    const actionsChannel = supabase
      .channel(`party-actions-${party.partyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'party_actions',
          filter: `target_user_id=eq.${user.id}`,
        },
        async (payload) => {
          const action = payload.new as PartyAction;
          if (action.applied) return;

          const hpHealed = action.action_data.hpHealed || 0;
          const senderName = action.action_data.senderName || 'A party member';
          const source = action.action_data.spellName || action.action_data.itemName || 'unknown';

          // Call the heal callback
          if (onIncomingHeal.current && hpHealed > 0) {
            onIncomingHeal.current(hpHealed, senderName, source);
          }

          // Mark as applied
          await supabase
            .from('party_actions')
            .update({ applied: true })
            .eq('id', action.id);

          toast.success(`${senderName} healed you for ${hpHealed} HP with ${source}!`, {
            duration: 5000,
          });
        }
      )
      .subscribe();

    // Subscribe to party pings
    const pingsChannel = supabase
      .channel(`party-pings-${party.partyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'party_pings',
          filter: `party_id=eq.${party.partyId}`,
        },
        (payload) => {
          const ping = payload.new as { sender_user_id: string; sender_name: string; ping_type: string; message?: string };
          if (ping.sender_user_id === user.id) return; // Don't show own pings
          
          const pingEmojis: Record<string, string> = {
            need_heal: '❤️‍🩹', danger: '⚠️', focus_target: '🎯',
            ready: '✅', help: '🆘', retreat: '🏃',
          };
          const pingLabels: Record<string, string> = {
            need_heal: 'needs healing!', danger: 'signals DANGER!', focus_target: 'calls FOCUS FIRE!',
            ready: 'is ready!', help: 'needs HELP!', retreat: 'calls RETREAT!',
          };
          const emoji = pingEmojis[ping.ping_type] || '📢';
          const label = pingLabels[ping.ping_type] || 'pinged!';
          
          toast(`${emoji} ${ping.sender_name} ${label}`, {
            description: ping.message || undefined,
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(membersChannel);
      supabase.removeChannel(actionsChannel);
      supabase.removeChannel(pingsChannel);
    };
  }, [party.partyId, user]);

  const createParty = useCallback(async (characterName: string, status: PartyMember['character_status']): Promise<string | null> => {
    if (!user) return null;
    setParty(prev => ({ ...prev, isLoading: true }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('party-link', {
        body: { action: 'create', characterName, characterStatus: status },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Failed to create party');
        setParty(prev => ({ ...prev, isLoading: false }));
        return null;
      }

      const partyData = res.data.party;
      setParty({
        partyId: partyData.id,
        linkCode: partyData.link_code,
        isCreator: true,
        members: [{
          id: crypto.randomUUID(),
          party_id: partyData.id,
          user_id: user.id,
          character_name: characterName,
          character_status: status,
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }],
        isLoading: false,
      });

      return partyData.link_code;
    } catch (err) {
      toast.error('Failed to create party');
      setParty(prev => ({ ...prev, isLoading: false }));
      return null;
    }
  }, [user]);

  const joinParty = useCallback(async (linkCode: string, characterName: string, status: PartyMember['character_status']): Promise<boolean> => {
    if (!user) return false;
    setParty(prev => ({ ...prev, isLoading: true }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('party-link', {
        body: { action: 'join', linkCode, characterName, characterStatus: status },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Failed to join party');
        setParty(prev => ({ ...prev, isLoading: false }));
        return false;
      }

      const partyData = res.data.party;

      // Load members
      const { data: members } = await supabase
        .from('party_members')
        .select('*')
        .eq('party_id', partyData.id) as { data: PartyMember[] | null };

      setParty({
        partyId: partyData.id,
        linkCode: partyData.link_code,
        isCreator: partyData.created_by === user.id,
        members: members || [],
        isLoading: false,
      });

      toast.success('Joined party!');
      return true;
    } catch (err) {
      toast.error('Failed to join party');
      setParty(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user]);

  const leaveParty = useCallback(async () => {
    if (!user || !party.partyId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.functions.invoke('party-link', {
        body: { action: 'leave', partyId: party.partyId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      setParty({ partyId: null, linkCode: null, isCreator: false, members: [], isLoading: false });
      toast.info('Left the party');
    } catch {
      toast.error('Failed to leave party');
    }
  }, [user, party.partyId]);

  const disbandParty = useCallback(async () => {
    if (!user || !party.partyId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.functions.invoke('party-link', {
        body: { action: 'disband', partyId: party.partyId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      setParty({ partyId: null, linkCode: null, isCreator: false, members: [], isLoading: false });
      toast.info('Party disbanded');
    } catch {
      toast.error('Failed to disband party');
    }
  }, [user, party.partyId]);

  const broadcastStatus = useCallback((status: PartyMember['character_status']) => {
    if (!user || !party.partyId) return;

    const statusStr = JSON.stringify(status);
    if (statusStr === lastStatusRef.current) return;
    lastStatusRef.current = statusStr;

    // Debounce: write at most every 2 seconds
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(async () => {
      await supabase
        .from('party_members')
        .update({ character_status: status as unknown as Record<string, never> })
        .eq('party_id', party.partyId!)
        .eq('user_id', user.id);
    }, 2000);
  }, [user, party.partyId]);

  const sendHealAction = useCallback(async (targetUserId: string, actionData: PartyAction['action_data']) => {
    if (!user || !party.partyId) return;

    await (supabase.from('party_actions') as any).insert({
      party_id: party.partyId,
      sender_user_id: user.id,
      target_user_id: targetUserId,
      action_type: actionData.spellName ? 'heal_spell' : 'heal_potion',
      action_data: actionData,
    });
  }, [user, party.partyId]);

  const sendPing = useCallback(async (pingType: string, senderName: string) => {
    if (!user || !party.partyId) return;

    await (supabase.from('party_pings') as any).insert({
      party_id: party.partyId,
      sender_user_id: user.id,
      sender_name: senderName,
      ping_type: pingType,
    });
  }, [user, party.partyId]);

  return {
    party,
    createParty,
    joinParty,
    leaveParty,
    disbandParty,
    broadcastStatus,
    sendHealAction,
    sendPing,
    onIncomingHeal,
  };
}
