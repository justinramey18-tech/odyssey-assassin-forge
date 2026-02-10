import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { PendingHealAction } from '@/components/party/IncomingHealNotification';

export interface QuickActionWeapon {
  name: string;
  damage: string;
  damageType: string;
}

export interface QuickActionAbility {
  name: string;
  tree: string;
  tier: number;
  actionType: string;
}

export interface QuickActionSpell {
  name: string;
  level: number;
  school: string;
  concentration: boolean;
}

export interface QuickActionCantrip {
  name: string;
  school: string;
}

export interface QuickActionConsumable {
  name: string;
  quantity: number;
  effect: string;
}

export interface QuickActions {
  weapons: QuickActionWeapon[];
  abilities: QuickActionAbility[];
  spells: QuickActionSpell[];
  cantrips: QuickActionCantrip[];
  consumables: QuickActionConsumable[];
}

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
    quickActions?: QuickActions;
    profileImage?: string | null;
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

// --- New types for party expansion ---

export interface PartyDiceRoll {
  id: string;
  party_id: string;
  user_id: string;
  roller_name: string;
  roll_label: string;
  roll_expression: string;
  roll_result: number;
  roll_details: unknown;
  created_at: string;
}

export interface PartyLootItem {
  id: string;
  party_id: string;
  added_by_user_id: string;
  added_by_name: string;
  item_name: string;
  item_description: string | null;
  rarity: string;
  gold_value: number;
  claimed_by_user_id: string | null;
  claimed_by_name: string | null;
  claimed_at: string | null;
  created_at: string;
}

export interface FocusTarget {
  name: string;
  ac: number;
  hpPercent: number;
  resistances?: string[];
  vulnerabilities?: string[];
  immunities?: string[];
  markedBy: string;
}

export interface PartyInitiativeEntry {
  name: string;
  initiative: number;
  isCurrentTurn: boolean;
}

export interface PartyInitiativeState {
  order: PartyInitiativeEntry[];
  round: number;
  broadcasterId: string;
  broadcasterName: string;
}

export interface SharedBuff {
  conditionName: string;
  duration: number;
  durationType: string;
  source: string;
  casterName: string;
  spellLevel?: number;
  targetUserId: string;
}

export interface UsePartySyncReturn {
  party: PartyState;
  pendingHeals: PendingHealAction[];
  // Existing
  createParty: (characterName: string, status: PartyMember['character_status']) => Promise<string | null>;
  joinParty: (linkCode: string, characterName: string, status: PartyMember['character_status']) => Promise<boolean>;
  leaveParty: () => Promise<void>;
  disbandParty: () => Promise<void>;
  broadcastStatus: (status: PartyMember['character_status']) => void;
  sendHealAction: (targetUserId: string, actionData: PartyAction['action_data']) => Promise<void>;
  sendPing: (pingType: string, senderName: string) => Promise<void>;
  acceptHeal: (actionId: string) => Promise<void>;
  rejectHeal: (actionId: string) => Promise<void>;
  onIncomingHeal: React.MutableRefObject<((hpHealed: number, senderName: string, source: string) => void) | null>;
  // New: Shared dice rolls
  shareRoll: (label: string, expression: string, result: number, details: unknown, rollerName: string) => Promise<void>;
  partyRolls: PartyDiceRoll[];
  // New: Focus target
  broadcastFocusTarget: (target: FocusTarget) => Promise<void>;
  clearFocusTarget: () => Promise<void>;
  focusTarget: FocusTarget | null;
  // New: Shared initiative
  broadcastInitiative: (order: PartyInitiativeEntry[], round: number, broadcasterName: string) => Promise<void>;
  clearInitiative: () => Promise<void>;
  partyInitiatives: PartyInitiativeState[];
  // New: Buff/debuff sharing
  shareBuff: (buff: SharedBuff) => Promise<void>;
  incomingBuffs: SharedBuff[];
  clearIncomingBuff: (index: number) => void;
  // New: Party loot queue
  shareLoot: (item: Omit<PartyLootItem, 'id' | 'party_id' | 'added_by_user_id' | 'claimed_by_user_id' | 'claimed_by_name' | 'claimed_at' | 'created_at'>) => Promise<void>;
  claimLoot: (lootId: string, claimerName: string) => Promise<void>;
  partyLoot: PartyLootItem[];
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

  const [pendingHeals, setPendingHeals] = useState<PendingHealAction[]>([]);
  const onIncomingHeal = useRef<((hpHealed: number, senderName: string, source: string) => void) | null>(null);
  const statusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<string>('');

  // New state
  const [partyRolls, setPartyRolls] = useState<PartyDiceRoll[]>([]);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const [partyInitiatives, setPartyInitiatives] = useState<PartyInitiativeState[]>([]);
  const [incomingBuffs, setIncomingBuffs] = useState<SharedBuff[]>([]);
  const [partyLoot, setPartyLoot] = useState<PartyLootItem[]>([]);

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
        const { data: partyData } = await supabase
          .from('parties')
          .select('*')
          .eq('id', partyId)
          .eq('is_active', true)
          .maybeSingle() as { data: { id: string; link_code: string; created_by: string; is_active: boolean } | null };

        if (partyData) {
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

  // Load existing data when joining a party
  useEffect(() => {
    if (!party.partyId || !user) return;

    const loadExistingData = async () => {
      // Load recent dice rolls (last 20)
      const { data: rolls } = await supabase
        .from('party_dice_rolls')
        .select('*')
        .eq('party_id', party.partyId!)
        .order('created_at', { ascending: false })
        .limit(20) as { data: PartyDiceRoll[] | null };
      if (rolls) setPartyRolls(rolls.reverse());

      // Load loot queue
      const { data: loot } = await supabase
        .from('party_loot_queue')
        .select('*')
        .eq('party_id', party.partyId!)
        .order('created_at', { ascending: false }) as { data: PartyLootItem[] | null };
      if (loot) setPartyLoot(loot);

      // Load shared state (focus targets, initiative, buffs)
      const { data: sharedState } = await supabase
        .from('party_shared_state')
        .select('*')
        .eq('party_id', party.partyId!) as { data: Array<{ user_id: string; state_type: string; state_data: unknown }> | null };

      if (sharedState) {
        sharedState.forEach((s) => {
          const data = s.state_data as Record<string, unknown>;
          if (s.state_type === 'focus_target' && data) {
            setFocusTarget(data as unknown as FocusTarget);
          }
          if (s.state_type === 'initiative' && data) {
            const initState = data as unknown as Omit<PartyInitiativeState, 'broadcasterId' | 'broadcasterName'>;
            setPartyInitiatives(prev => {
              const filtered = prev.filter(p => p.broadcasterId !== s.user_id);
              return [...filtered, { ...initState, broadcasterId: s.user_id, broadcasterName: (data as Record<string, string>).broadcasterName || 'Unknown' } as PartyInitiativeState];
            });
          }
          if (s.state_type === 'buff_share' && data) {
            const buffs = (data as { buffs?: SharedBuff[] }).buffs;
            if (buffs) {
              const myBuffs = buffs.filter(b => b.targetUserId === user.id);
              if (myBuffs.length > 0) {
                setIncomingBuffs(prev => [...prev, ...myBuffs]);
              }
            }
          }
        });
      }
    };

    loadExistingData();
  }, [party.partyId, user]);

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
            const old = payload.old as { id: string; user_id?: string };
            setParty(prev => ({
              ...prev,
              members: prev.members.filter(m => m.id !== old.id),
            }));
            if (old.user_id === user.id) {
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
        (payload) => {
          const action = payload.new as PartyAction & { status?: string };
          if (action.status && action.status !== 'pending') return;

          const hpHealed = action.action_data.hpHealed || 0;
          const senderName = action.action_data.senderName || 'A party member';
          const source = action.action_data.spellName || action.action_data.itemName || 'unknown';

          if (hpHealed > 0) {
            setPendingHeals(prev => [...prev, { id: action.id, senderName, source, hpHealed }]);
          }
        }
      )
      .subscribe();

    // Subscribe to responses on sent actions
    const sentActionsChannel = supabase
      .channel(`party-sent-actions-${party.partyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'party_actions',
          filter: `sender_user_id=eq.${user.id}`,
        },
        (payload) => {
          const action = payload.new as PartyAction & { status?: string };
          const targetMember = party.members.find(m => m.user_id === action.target_user_id);
          const targetName = targetMember?.character_name || 'A party member';
          const source = action.action_data.spellName || action.action_data.itemName || 'heal';

          if (action.status === 'accepted') {
            toast.success(`${targetName} accepted your ${source}! (+${action.action_data.hpHealed} HP)`, { duration: 4000 });
          } else if (action.status === 'rejected') {
            toast(`${targetName} declined your ${source}.`, { duration: 4000 });
          }
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
          if (ping.sender_user_id === user.id) return;

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

    // Subscribe to dice rolls
    const rollsChannel = supabase
      .channel(`party-rolls-${party.partyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'party_dice_rolls',
          filter: `party_id=eq.${party.partyId}`,
        },
        (payload) => {
          const roll = payload.new as PartyDiceRoll;
          setPartyRolls(prev => [...prev.slice(-19), roll]);

          if (roll.user_id !== user.id) {
            toast(`🎲 ${roll.roller_name} rolled ${roll.roll_label}: ${roll.roll_result}`, {
              description: roll.roll_expression,
              duration: 4000,
            });
          }
        }
      )
      .subscribe();

    // Subscribe to shared state changes (focus target, initiative, buffs)
    const sharedStateChannel = supabase
      .channel(`party-shared-state-${party.partyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'party_shared_state',
          filter: `party_id=eq.${party.partyId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as { state_type?: string; user_id?: string };
            if (old.state_type === 'focus_target') {
              setFocusTarget(null);
            }
            if (old.state_type === 'initiative' && old.user_id) {
              setPartyInitiatives(prev => prev.filter(p => p.broadcasterId !== old.user_id));
            }
            return;
          }

          const row = payload.new as { user_id: string; state_type: string; state_data: unknown };
          const data = row.state_data as Record<string, unknown>;

          if (row.state_type === 'focus_target') {
            const ft = data as unknown as FocusTarget;
            setFocusTarget(ft);
            if (row.user_id !== user.id) {
              toast(`🎯 ${ft.markedBy} marked target: ${ft.name}`, { duration: 4000 });
            }
          }

          if (row.state_type === 'initiative') {
            const initState = data as unknown as PartyInitiativeState;
            setPartyInitiatives(prev => {
              const filtered = prev.filter(p => p.broadcasterId !== row.user_id);
              return [...filtered, { ...initState, broadcasterId: row.user_id }];
            });
          }

          if (row.state_type === 'buff_share') {
            const buffs = (data as { buffs?: SharedBuff[] }).buffs;
            if (buffs && row.user_id !== user.id) {
              const myBuffs = buffs.filter(b => b.targetUserId === user.id);
              myBuffs.forEach(buff => {
                toast(`✨ ${buff.casterName} cast ${buff.source} on you!`, {
                  description: `${buff.conditionName} (${buff.duration} ${buff.durationType})`,
                  duration: 6000,
                });
              });
              if (myBuffs.length > 0) {
                setIncomingBuffs(prev => [...prev, ...myBuffs]);
              }
            }
          }
        }
      )
      .subscribe();

    // Subscribe to loot queue changes
    const lootChannel = supabase
      .channel(`party-loot-${party.partyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'party_loot_queue',
          filter: `party_id=eq.${party.partyId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const item = payload.new as PartyLootItem;
            setPartyLoot(prev => [item, ...prev]);
            if (item.added_by_user_id !== user.id) {
              toast(`💰 ${item.added_by_name} shared loot: ${item.item_name}`, { duration: 4000 });
            }
          } else if (payload.eventType === 'UPDATE') {
            const item = payload.new as PartyLootItem;
            setPartyLoot(prev => prev.map(l => l.id === item.id ? item : l));
            if (item.claimed_by_user_id && item.claimed_by_user_id !== user.id) {
              toast(`${item.claimed_by_name} claimed ${item.item_name}`, { duration: 3000 });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(membersChannel);
      supabase.removeChannel(actionsChannel);
      supabase.removeChannel(sentActionsChannel);
      supabase.removeChannel(pingsChannel);
      supabase.removeChannel(rollsChannel);
      supabase.removeChannel(sharedStateChannel);
      supabase.removeChannel(lootChannel);
    };
  }, [party.partyId, user]);

  // --- Existing functions ---

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
      setPartyRolls([]);
      setPartyLoot([]);
      setFocusTarget(null);
      setPartyInitiatives([]);
      setIncomingBuffs([]);
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
      setPartyRolls([]);
      setPartyLoot([]);
      setFocusTarget(null);
      setPartyInitiatives([]);
      setIncomingBuffs([]);
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

  const acceptHeal = useCallback(async (actionId: string) => {
    const heal = pendingHeals.find(h => h.id === actionId);
    if (!heal) return;

    if (onIncomingHeal.current) {
      onIncomingHeal.current(heal.hpHealed, heal.senderName, heal.source);
    }

    await supabase
      .from('party_actions')
      .update({ applied: true, status: 'accepted' } as Record<string, unknown>)
      .eq('id', actionId);

    setPendingHeals(prev => prev.filter(h => h.id !== actionId));
    toast.success(`Accepted heal from ${heal.senderName}! +${heal.hpHealed} HP`);
  }, [pendingHeals]);

  const rejectHeal = useCallback(async (actionId: string) => {
    const heal = pendingHeals.find(h => h.id === actionId);

    await supabase
      .from('party_actions')
      .update({ applied: false, status: 'rejected' } as Record<string, unknown>)
      .eq('id', actionId);

    setPendingHeals(prev => prev.filter(h => h.id !== actionId));
    toast('Heal declined', { description: heal ? `From ${heal.senderName}` : undefined });
  }, [pendingHeals]);

  // --- New feature functions ---

  const shareRoll = useCallback(async (label: string, expression: string, result: number, details: unknown, rollerName: string) => {
    if (!user || !party.partyId) return;

    await (supabase.from('party_dice_rolls') as any).insert({
      party_id: party.partyId,
      user_id: user.id,
      roller_name: rollerName,
      roll_label: label,
      roll_expression: expression,
      roll_result: result,
      roll_details: details,
    });
  }, [user, party.partyId]);

  const broadcastFocusTarget = useCallback(async (target: FocusTarget) => {
    if (!user || !party.partyId) return;

    await (supabase.from('party_shared_state') as any).upsert({
      party_id: party.partyId,
      user_id: user.id,
      state_type: 'focus_target',
      state_data: target,
    }, { onConflict: 'party_id,user_id,state_type' });
  }, [user, party.partyId]);

  const clearFocusTarget = useCallback(async () => {
    if (!user || !party.partyId) return;

    await (supabase.from('party_shared_state') as any)
      .delete()
      .eq('party_id', party.partyId)
      .eq('user_id', user.id)
      .eq('state_type', 'focus_target');
  }, [user, party.partyId]);

  const broadcastInitiative = useCallback(async (order: PartyInitiativeEntry[], round: number, broadcasterName: string) => {
    if (!user || !party.partyId) return;

    await (supabase.from('party_shared_state') as any).upsert({
      party_id: party.partyId,
      user_id: user.id,
      state_type: 'initiative',
      state_data: { order, round, broadcasterName },
    }, { onConflict: 'party_id,user_id,state_type' });
  }, [user, party.partyId]);

  const clearInitiative = useCallback(async () => {
    if (!user || !party.partyId) return;

    await (supabase.from('party_shared_state') as any)
      .delete()
      .eq('party_id', party.partyId)
      .eq('user_id', user.id)
      .eq('state_type', 'initiative');
  }, [user, party.partyId]);

  const shareBuff = useCallback(async (buff: SharedBuff) => {
    if (!user || !party.partyId) return;

    await (supabase.from('party_shared_state') as any).upsert({
      party_id: party.partyId,
      user_id: user.id,
      state_type: 'buff_share',
      state_data: { buffs: [buff] },
    }, { onConflict: 'party_id,user_id,state_type' });
  }, [user, party.partyId]);

  const clearIncomingBuff = useCallback((index: number) => {
    setIncomingBuffs(prev => prev.filter((_, i) => i !== index));
  }, []);

  const shareLoot = useCallback(async (item: Omit<PartyLootItem, 'id' | 'party_id' | 'added_by_user_id' | 'claimed_by_user_id' | 'claimed_by_name' | 'claimed_at' | 'created_at'>) => {
    if (!user || !party.partyId) return;

    await (supabase.from('party_loot_queue') as any).insert({
      party_id: party.partyId,
      added_by_user_id: user.id,
      added_by_name: item.added_by_name,
      item_name: item.item_name,
      item_description: item.item_description,
      rarity: item.rarity,
      gold_value: item.gold_value,
    });

    toast.success(`Shared ${item.item_name} with party!`);
  }, [user, party.partyId]);

  const claimLoot = useCallback(async (lootId: string, claimerName: string) => {
    if (!user || !party.partyId) return;

    const { error } = await (supabase.from('party_loot_queue') as any)
      .update({
        claimed_by_user_id: user.id,
        claimed_by_name: claimerName,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', lootId)
      .is('claimed_by_user_id', null);

    if (error) {
      toast.error('Failed to claim loot — someone else may have grabbed it!');
    } else {
      toast.success('Loot claimed!');
    }
  }, [user, party.partyId]);

  return {
    party,
    pendingHeals,
    createParty,
    joinParty,
    leaveParty,
    disbandParty,
    broadcastStatus,
    sendHealAction,
    sendPing,
    acceptHeal,
    rejectHeal,
    onIncomingHeal,
    // New
    shareRoll,
    partyRolls,
    broadcastFocusTarget,
    clearFocusTarget,
    focusTarget,
    broadcastInitiative,
    clearInitiative,
    partyInitiatives,
    shareBuff,
    incomingBuffs,
    clearIncomingBuff,
    shareLoot,
    claimLoot,
    partyLoot,
  };
}
