import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { PendingHealAction } from '@/components/party/IncomingHealNotification';
import type { PendingTradeAction } from '@/components/party/IncomingTradeNotification';

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
  image?: string;
  isHomebrew?: boolean;
}

export interface QuickActionSpell {
  name: string;
  level: number;
  school: string;
  concentration: boolean;
  isHomebrew?: boolean;
}

export interface QuickActionCantrip {
  name: string;
  school: string;
  isHomebrew?: boolean;
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
    timezone?: string;
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
  category?: 'buff' | 'concentration' | 'debuff';
  targetUserId: string;
}

export interface PartyMessage {
  id: string;
  party_id: string;
  user_id: string;
  sender_name: string;
  message: string;
  created_at: string;
  updated_at?: string | null;
  reply_to_id?: string | null;
  image_url?: string | null;
  is_pinned?: boolean;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  party_id: string;
  user_id: string;
  sender_name: string;
  emoji: string;
  created_at: string;
}

export interface VoteVoter {
  userId: string;
  name: string;
}

export interface VoteOption {
  label: string;
  voters: VoteVoter[];
}

export interface ActiveVote {
  question: string;
  options: VoteOption[];
  creatorUserId: string;
  creatorName: string;
  closed: boolean;
  myVote?: string;
}

export interface MapMarker {
  x: number;
  y: number;
  name: string;
  color: string;
  isEnemy: boolean;
  ownerUserId: string;
}

export interface CombatLogEntry {
  id: string;
  party_id: string;
  user_id: string;
  character_name: string;
  action_type: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UsePartySyncReturn {
  party: PartyState;
  pendingHeals: PendingHealAction[];
  pendingTrades: PendingTradeAction[];
  // Existing
  createParty: (characterName: string, status: PartyMember['character_status']) => Promise<string | null>;
  joinParty: (linkCode: string, characterName: string, status: PartyMember['character_status']) => Promise<boolean>;
  leaveParty: () => Promise<void>;
  disconnectLocally: () => void;
  reconnectToParty: (partyId: string) => Promise<boolean>;
  disbandParty: () => Promise<void>;
  broadcastStatus: (status: PartyMember['character_status']) => void;
  sendHealAction: (targetUserId: string, actionData: PartyAction['action_data']) => Promise<void>;
  sendPing: (pingType: string, senderName: string) => Promise<void>;
  acceptHeal: (actionId: string) => Promise<void>;
  rejectHeal: (actionId: string) => Promise<void>;
  onIncomingHeal: React.MutableRefObject<((hpHealed: number, senderName: string, source: string) => void) | null>;
  // Trading
  sendTradeAction: (targetUserId: string, tradeType: PendingTradeAction['tradeType'], tradeData: Record<string, unknown>, senderName: string) => Promise<void>;
  acceptTrade: (actionId: string) => Promise<void>;
  rejectTrade: (actionId: string) => Promise<void>;
  onIncomingTrade: React.MutableRefObject<((tradeType: string, tradeData: Record<string, unknown>, senderName: string) => void) | null>;
  onTradeRejected: React.MutableRefObject<((tradeType: string, tradeData: Record<string, unknown>) => void) | null>;
  // Shared dice rolls
  shareRoll: (label: string, expression: string, result: number, details: unknown, rollerName: string) => Promise<void>;
  partyRolls: PartyDiceRoll[];
  // Focus target
  broadcastFocusTarget: (target: FocusTarget) => Promise<void>;
  clearFocusTarget: () => Promise<void>;
  focusTarget: FocusTarget | null;
  // Shared initiative
  broadcastInitiative: (order: PartyInitiativeEntry[], round: number, broadcasterName: string) => Promise<void>;
  clearInitiative: () => Promise<void>;
  partyInitiatives: PartyInitiativeState[];
  // Buff/debuff sharing
  shareBuff: (buff: SharedBuff) => Promise<void>;
  incomingBuffs: SharedBuff[];
  clearIncomingBuff: (index: number) => void;
  // Party loot queue
  shareLoot: (item: Omit<PartyLootItem, 'id' | 'party_id' | 'added_by_user_id' | 'claimed_by_user_id' | 'claimed_by_name' | 'claimed_at' | 'created_at'>) => Promise<void>;
  claimLoot: (lootId: string, claimerName: string) => Promise<void>;
  partyLoot: PartyLootItem[];
  // Party Chat
  sendMessage: (message: string, senderName: string, options?: { replyToId?: string; imageUrl?: string }) => Promise<void>;
  editMessage: (messageId: string, newText: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  bulkDeleteMessages: (messageIds: string[]) => Promise<void>;
  clearAllMessages: () => Promise<void>;
  pinMessage: (messageId: string) => Promise<void>;
  unpinMessage: (messageId: string) => Promise<void>;
  uploadChatImage: (file: File) => Promise<string | null>;
  partyMessages: PartyMessage[];
  // Reactions
  messageReactions: MessageReaction[];
  addReaction: (messageId: string, emoji: string, senderName: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  // Party Voting
  startVote: (question: string, options: string[], creatorName: string) => Promise<void>;
  castVote: (optionLabel: string, voterName: string) => Promise<void>;
  closeVote: () => Promise<void>;
  activeVote: ActiveVote | null;
  // Battle Map
  updateMapMarkers: (markers: MapMarker[]) => Promise<void>;
  mapMarkers: MapMarker[];
  mapBackgroundUrl: string | undefined;
  updateMapBackground: (url: string | undefined) => Promise<void>;
  mapTierBackgrounds: { tierId: string; imageUrl: string }[];
  mapBackgroundOpacity: number;
  mapCustomTiers: { id: string; distancePerSquare: number; distanceUnit: string }[] | undefined;
  updateMapTierBackgrounds: (tierBackgrounds: { tierId: string; imageUrl: string }[]) => Promise<void>;
  updateMapBackgroundOpacity: (opacity: number) => Promise<void>;
  updateMapCustomTiers: (customTiers: { id: string; distancePerSquare: number; distanceUnit: string }[]) => Promise<void>;
  // Combat Log
  logCombatEvent: (characterName: string, actionType: string, description: string, metadata?: Record<string, unknown>) => Promise<void>;
  combatLog: CombatLogEntry[];
  // Typing indicators
  typingUsers: { userId: string; name: string }[];
  broadcastTyping: (senderName: string) => void;
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
  
  // Trade state
  const [pendingTrades, setPendingTrades] = useState<PendingTradeAction[]>([]);
  const onIncomingTrade = useRef<((tradeType: string, tradeData: Record<string, unknown>, senderName: string) => void) | null>(null);
  const onTradeRejected = useRef<((tradeType: string, tradeData: Record<string, unknown>) => void) | null>(null);
  
  const statusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<string>('');

  // New state
  const [partyRolls, setPartyRolls] = useState<PartyDiceRoll[]>([]);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const [partyInitiatives, setPartyInitiatives] = useState<PartyInitiativeState[]>([]);
  const [incomingBuffs, setIncomingBuffs] = useState<SharedBuff[]>([]);
  const [partyLoot, setPartyLoot] = useState<PartyLootItem[]>([]);
  const [partyMessages, setPartyMessages] = useState<PartyMessage[]>([]);
  const [activeVote, setActiveVote] = useState<ActiveVote | null>(null);
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);
  const [mapBackgroundUrl, setMapBackgroundUrl] = useState<string | undefined>();
  const [mapTierBackgrounds, setMapTierBackgrounds] = useState<{ tierId: string; imageUrl: string }[]>([]);
  const [mapBackgroundOpacity, setMapBackgroundOpacity] = useState<number>(1);
  const [mapCustomTiers, setMapCustomTiers] = useState<{ id: string; distancePerSquare: number; distanceUnit: string }[] | undefined>(undefined);
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([]);
  const [typingUsers, setTypingUsers] = useState<{ userId: string; name: string }[]>([]);
  const [messageReactions, setMessageReactions] = useState<MessageReaction[]>([]);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // On mount, check if user is already in a party
  // Respects the 'odyssey-active-party-id' localStorage flag set during character switching.
  // If the flag exists, only reconnect to that specific party (or none if flag is empty/removed).
  // If no flag exists (fresh page load, not a character switch), auto-detect from DB.
  useEffect(() => {
    if (!user) return;

    const checkExisting = async () => {
      // Check if a character switch set a specific party expectation
      const activePartyId = localStorage.getItem('odyssey-active-party-id');
      const hasPartyFlag = activePartyId !== null;
      
      // Clean up the flag — it's a one-shot signal from the character switch
      if (hasPartyFlag) {
        localStorage.removeItem('odyssey-active-party-id');
      }

      // If the flag was set but empty/null, the loaded character has no party — skip reconnect
      if (hasPartyFlag && !activePartyId) {
        console.log('[PartySync] Active party flag was cleared — no party for this character');
        return;
      }

      // Determine which party to look for
      let targetPartyId: string | null = activePartyId;

      if (!targetPartyId) {
        // No flag set (fresh load) — check DB for any existing membership
        const { data: membership } = await supabase
          .from('party_members')
          .select('party_id')
          .eq('user_id', user.id)
          .limit(1) as { data: Array<{ party_id: string }> | null };

        if (membership && membership.length > 0) {
          targetPartyId = membership[0].party_id;
        }
      }

      if (!targetPartyId) return;

      const { data: partyData } = await supabase
        .from('parties')
        .select('*')
        .eq('id', targetPartyId)
        .eq('is_active', true)
        .maybeSingle() as { data: { id: string; link_code: string; created_by: string; is_active: boolean } | null };

      if (partyData) {
        const { data: members } = await supabase
          .from('party_members')
          .select('*')
          .eq('party_id', targetPartyId) as { data: PartyMember[] | null };

        setParty({
          partyId: targetPartyId,
          linkCode: partyData.link_code,
          isCreator: partyData.created_by === user.id,
          members: members || [],
          isLoading: false,
        });
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

      // Load recent messages (last 50)
      const { data: msgs } = await supabase
        .from('party_messages')
        .select('*')
        .eq('party_id', party.partyId!)
        .order('created_at', { ascending: false })
        .limit(50) as { data: PartyMessage[] | null };
      if (msgs) setPartyMessages(msgs.reverse());

      // Load reactions for loaded messages
      if (msgs && msgs.length > 0) {
        const msgIds = msgs.map(m => m.id);
        const { data: reactions } = await supabase
          .from('party_message_reactions')
          .select('*')
          .eq('party_id', party.partyId!)
          .in('message_id', msgIds) as { data: MessageReaction[] | null };
        if (reactions) setMessageReactions(reactions);
      }

      // Load recent combat log (last 30)
      const { data: combatEntries } = await supabase
        .from('party_combat_log')
        .select('*')
        .eq('party_id', party.partyId!)
        .order('created_at', { ascending: false })
        .limit(30) as { data: CombatLogEntry[] | null };
      if (combatEntries) setCombatLog(combatEntries.reverse());

      // Load shared state (focus targets, initiative, buffs, votes, map markers)
      // Order by updated_at so the latest entry wins when multiple exist for same state_type
      const { data: sharedState } = await supabase
        .from('party_shared_state')
        .select('*')
        .eq('party_id', party.partyId!)
        .order('updated_at', { ascending: true }) as { data: Array<{ user_id: string; state_type: string; state_data: unknown }> | null };

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
          if (s.state_type === 'vote' && data) {
            const vote = data as unknown as ActiveVote;
            const myVote = vote.options.find(o => o.voters.some(v => v.userId === user.id))?.label;
            setActiveVote({ ...vote, myVote });
          }
          if (s.state_type === 'map_markers' && data) {
            const mapData = data as { markers?: MapMarker[]; backgroundUrl?: string; tierBackgrounds?: { tierId: string; imageUrl: string }[]; backgroundOpacity?: number; customTiers?: { id: string; distancePerSquare: number; distanceUnit: string }[] };
            if (mapData.markers) setMapMarkers(mapData.markers);
            setMapBackgroundUrl(mapData.backgroundUrl || undefined);
            if (mapData.tierBackgrounds) setMapTierBackgrounds(mapData.tierBackgrounds);
            if (mapData.backgroundOpacity !== undefined) setMapBackgroundOpacity(mapData.backgroundOpacity);
            if (mapData.customTiers) setMapCustomTiers(mapData.customTiers);
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
            // Deduplicate by user_id (not id) to handle the case where createParty
            // sets a client-generated id that differs from the DB-generated one
            setParty(prev => ({
              ...prev,
              members: [...prev.members.filter(m => m.user_id !== newMember.user_id), newMember],
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

          // Handle trade actions
          const tradeTypes = ['send_gold', 'send_consumable', 'send_gear', 'send_loot'];
          if (tradeTypes.includes(action.action_type)) {
            const data = action.action_data as Record<string, unknown>;
            const senderName = (data.senderName as string) || 'A party member';
            const itemName = (data.itemName as string) || 'item';
            const amount = (data.amount as number) || undefined;
            setPendingTrades(prev => [...prev, {
              id: action.id,
              senderName,
              tradeType: action.action_type as PendingTradeAction['tradeType'],
              itemName,
              amount,
              rarity: data.rarity as string | undefined,
            }]);
            return;
          }

          // Handle heal actions
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

          // Handle trade action responses
          const tradeTypes = ['send_gold', 'send_consumable', 'send_gear', 'send_loot'];
          if (tradeTypes.includes(action.action_type)) {
            const data = action.action_data as Record<string, unknown>;
            const itemName = (data.itemName as string) || 'item';
            if (action.status === 'accepted') {
              toast.success(`${targetName} accepted your ${itemName}!`, { duration: 4000 });
            } else if (action.status === 'rejected') {
              toast(`${targetName} declined your ${itemName}.`, { duration: 4000 });
              // Return item to sender
              if (onTradeRejected.current) {
                onTradeRejected.current(action.action_type, data);
              }
            }
            return;
          }

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
            if (old.state_type === 'vote') {
              setActiveVote(null);
            }
            if (old.state_type === 'map_markers') {
              setMapMarkers([]);
              setMapBackgroundUrl(undefined);
              setMapTierBackgrounds([]);
              setMapBackgroundOpacity(1);
              setMapCustomTiers(undefined);
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

          if (row.state_type === 'vote') {
            const vote = data as unknown as ActiveVote;
            const myVote = vote.options.find(o => o.voters.some(v => v.userId === user.id))?.label;
            setActiveVote({ ...vote, myVote });
          }

          if (row.state_type === 'map_markers') {
            const mapData = data as { markers?: MapMarker[]; backgroundUrl?: string; tierBackgrounds?: { tierId: string; imageUrl: string }[]; backgroundOpacity?: number; customTiers?: { id: string; distancePerSquare: number; distanceUnit: string }[] };
            setMapMarkers(mapData.markers || []);
            setMapBackgroundUrl(mapData.backgroundUrl || undefined);
            if (mapData.tierBackgrounds) setMapTierBackgrounds(mapData.tierBackgrounds);
            if (mapData.backgroundOpacity !== undefined) setMapBackgroundOpacity(mapData.backgroundOpacity);
            if (mapData.customTiers) setMapCustomTiers(mapData.customTiers);
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

    // Subscribe to party messages (INSERT, UPDATE, DELETE)
    const messagesChannel = supabase
      .channel(`party-messages-${party.partyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'party_messages',
          filter: `party_id=eq.${party.partyId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const msg = payload.new as PartyMessage;
            setPartyMessages(prev => [...prev.slice(-49), msg]);
          } else if (payload.eventType === 'UPDATE') {
            const msg = payload.new as PartyMessage;
            setPartyMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string };
            setPartyMessages(prev => prev.filter(m => m.id !== old.id));
          }
        }
      )
      .subscribe();

    // Subscribe to combat log
    const combatLogChannel = supabase
      .channel(`party-combat-log-${party.partyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'party_combat_log',
          filter: `party_id=eq.${party.partyId}`,
        },
        (payload) => {
          const entry = payload.new as CombatLogEntry;
          setCombatLog(prev => [...prev.slice(-29), entry]);
        }
      )
      .subscribe();

    // Typing presence channel
    const typingChannel = supabase
      .channel(`party-typing-${party.partyId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = typingChannel.presenceState();
        const typers: { userId: string; name: string }[] = [];
        for (const key of Object.keys(state)) {
          const presences = state[key] as unknown as Array<{ userId: string; name: string }>;
          for (const p of presences) {
            if (p.userId !== user?.id) {
              typers.push({ userId: p.userId, name: p.name });
            }
          }
        }
        setTypingUsers(typers);
      })
      .subscribe();
    typingChannelRef.current = typingChannel;

    // Reactions realtime
    const reactionsChannel = supabase
      .channel(`party-reactions-${party.partyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'party_message_reactions', filter: `party_id=eq.${party.partyId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const r = payload.new as MessageReaction;
            setMessageReactions(prev => [...prev, r]);
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string };
            setMessageReactions(prev => prev.filter(r => r.id !== old.id));
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
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(combatLogChannel);
      supabase.removeChannel(typingChannel);
      supabase.removeChannel(reactionsChannel);
      typingChannelRef.current = null;
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
      setPartyMessages([]);
      setActiveVote(null);
      setMapMarkers([]);
      setMapBackgroundUrl(undefined);
      setMapTierBackgrounds([]);
      setMapBackgroundOpacity(1);
      setMapCustomTiers(undefined);
      setCombatLog([]);
      toast.info('Left the party');
    } catch {
      toast.error('Failed to leave party');
    }
  }, [user, party.partyId]);

  // Local-only disconnect: resets all party state without touching the database.
  // Used during character switching to preserve server-side party membership.
  const disconnectLocally = useCallback(() => {
    setParty({ partyId: null, linkCode: null, isCreator: false, members: [], isLoading: false });
    setPartyRolls([]);
    setPartyLoot([]);
    setFocusTarget(null);
    setPartyInitiatives([]);
    setIncomingBuffs([]);
    setPartyMessages([]);
    setActiveVote(null);
    setMapMarkers([]);
    setMapBackgroundUrl(undefined);
    setMapTierBackgrounds([]);
    setMapBackgroundOpacity(1);
    setMapCustomTiers(undefined);
    setCombatLog([]);
  }, []);

  // Reconnect to an existing party by ID (user is already a member on the server)
  const reconnectToParty = useCallback(async (partyId: string): Promise<boolean> => {
    if (!user) return false;
    setParty(prev => ({ ...prev, isLoading: true }));

    try {
      // Fetch party info
      const { data: partyData, error: partyError } = await supabase
        .from('parties')
        .select('*')
        .eq('id', partyId)
        .eq('is_active', true)
        .maybeSingle();

      if (partyError || !partyData) {
        console.warn('[PartySync] Party not found or inactive:', partyId);
        setParty({ partyId: null, linkCode: null, isCreator: false, members: [], isLoading: false });
        return false;
      }

      // Verify user is still a member
      const { data: members } = await supabase
        .from('party_members')
        .select('*')
        .eq('party_id', partyId) as { data: PartyMember[] | null };

      const isMember = members?.some(m => m.user_id === user.id);
      if (!isMember) {
        console.warn('[PartySync] User is no longer a member of party:', partyId);
        setParty({ partyId: null, linkCode: null, isCreator: false, members: [], isLoading: false });
        return false;
      }

      setParty({
        partyId: partyData.id,
        linkCode: partyData.link_code,
        isCreator: partyData.created_by === user.id,
        members: members || [],
        isLoading: false,
      });

      console.log('[PartySync] Reconnected to party:', partyData.link_code);
      return true;
    } catch (err) {
      console.error('[PartySync] Failed to reconnect:', err);
      setParty({ partyId: null, linkCode: null, isCreator: false, members: [], isLoading: false });
      return false;
    }
  }, [user]);

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
      setPartyMessages([]);
      setActiveVote(null);
      setMapMarkers([]);
      setMapBackgroundUrl(undefined);
      setMapTierBackgrounds([]);
      setMapBackgroundOpacity(1);
      setMapCustomTiers(undefined);
      setCombatLog([]);
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

  // --- New feature functions ---

  const sendMessage = useCallback(async (message: string, senderName: string, options?: { replyToId?: string; imageUrl?: string }) => {
    if (!user || !party.partyId) return;

    const insertData: Record<string, unknown> = {
      party_id: party.partyId,
      user_id: user.id,
      sender_name: senderName,
      message: message.slice(0, 500),
    };
    if (options?.replyToId) insertData.reply_to_id = options.replyToId;
    if (options?.imageUrl) insertData.image_url = options.imageUrl;

    await (supabase.from('party_messages') as any).insert(insertData);
  }, [user, party.partyId]);

  const editMessage = useCallback(async (messageId: string, newText: string) => {
    if (!user || !party.partyId) return;

    await (supabase.from('party_messages') as any)
      .update({ message: newText.slice(0, 200), updated_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('user_id', user.id);
  }, [user, party.partyId]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!user || !party.partyId) return;

    await (supabase.from('party_messages') as any)
      .delete()
      .eq('id', messageId);
  }, [user, party.partyId]);

  const bulkDeleteMessages = useCallback(async (messageIds: string[]) => {
    if (!user || !party.partyId || messageIds.length === 0) return;

    await (supabase.from('party_messages') as any)
      .delete()
      .in('id', messageIds);
  }, [user, party.partyId]);

  const clearAllMessages = useCallback(async () => {
    if (!user || !party.partyId) return;

    await (supabase.from('party_messages') as any)
      .delete()
      .eq('party_id', party.partyId);
  }, [user, party.partyId]);

  const pinMessage = useCallback(async (messageId: string) => {
    if (!user || !party.partyId) return;
    // Check if already at 3 pins
    const pinned = partyMessages.filter(m => m.is_pinned);
    if (pinned.length >= 3) {
      toast.error('Maximum 3 pinned messages allowed');
      return;
    }
    await (supabase.from('party_messages') as any)
      .update({ is_pinned: true })
      .eq('id', messageId);
  }, [user, party.partyId, partyMessages]);

  const unpinMessage = useCallback(async (messageId: string) => {
    if (!user || !party.partyId) return;
    await (supabase.from('party_messages') as any)
      .update({ is_pinned: false })
      .eq('id', messageId);
  }, [user, party.partyId]);

  const uploadChatImage = useCallback(async (file: File): Promise<string | null> => {
    if (!user || !party.partyId) return null;
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${party.partyId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('party-chat-images')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) {
      toast.error('Failed to upload image');
      return null;
    }
    const { data: urlData } = supabase.storage
      .from('party-chat-images')
      .getPublicUrl(path);
    return urlData.publicUrl;
  }, [user, party.partyId]);

  const startVote = useCallback(async (question: string, options: string[], creatorName: string) => {
    if (!user || !party.partyId) return;

    // Clean up any existing vote rows from any creator before starting a new one
    await (supabase.from('party_shared_state') as any)
      .delete()
      .eq('party_id', party.partyId)
      .eq('state_type', 'vote');

    const voteData: ActiveVote = {
      question,
      options: options.map(label => ({ label, voters: [] })),
      creatorUserId: user.id,
      creatorName,
      closed: false,
    };

    await (supabase.from('party_shared_state') as any).insert({
      party_id: party.partyId,
      user_id: user.id,
      state_type: 'vote',
      state_data: voteData,
    });
  }, [user, party.partyId]);

  const castVote = useCallback(async (optionLabel: string, voterName: string) => {
    if (!user || !party.partyId || !activeVote) return;

    // Prevent double-voting
    const alreadyVoted = activeVote.options.some(o => o.voters.some(v => v.userId === user.id));
    if (alreadyVoted) return;

    const updatedOptions = activeVote.options.map(o => ({
      ...o,
      voters: o.label === optionLabel ? [...o.voters, { userId: user.id, name: voterName }] : o.voters,
    }));

    const updatedVote = { ...activeVote, options: updatedOptions };
    delete (updatedVote as any).myVote;

    // Check if all members voted
    const totalVotes = updatedOptions.reduce((sum, o) => sum + o.voters.length, 0);
    if (totalVotes >= party.members.length) {
      updatedVote.closed = true;
    }

    // Use .update() instead of .upsert() — non-creators can't insert with another user's id (RLS),
    // but the new "Members can update vote shared state" policy allows any member to update vote rows.
    await (supabase.from('party_shared_state') as any)
      .update({ state_data: updatedVote })
      .eq('party_id', party.partyId)
      .eq('user_id', updatedVote.creatorUserId)
      .eq('state_type', 'vote');
  }, [user, party.partyId, activeVote, party.members.length]);

  const closeVote = useCallback(async () => {
    if (!user || !party.partyId || !activeVote) return;

    const updatedVote = { ...activeVote, closed: true };
    delete (updatedVote as any).myVote;

    // Use .update() for consistency — only the creator calls this, targeting their own row
    await (supabase.from('party_shared_state') as any)
      .update({ state_data: updatedVote })
      .eq('party_id', party.partyId)
      .eq('user_id', updatedVote.creatorUserId)
      .eq('state_type', 'vote');
  }, [user, party.partyId, activeVote]);

  const buildMapStateData = useCallback(() => ({
    markers: mapMarkers,
    backgroundUrl: mapBackgroundUrl,
    tierBackgrounds: mapTierBackgrounds,
    backgroundOpacity: mapBackgroundOpacity,
    customTiers: mapCustomTiers,
  }), [mapMarkers, mapBackgroundUrl, mapTierBackgrounds, mapBackgroundOpacity, mapCustomTiers]);

  const upsertMapState = useCallback(async (stateData: Record<string, unknown>) => {
    if (!user || !party.partyId) return;
    const { count } = await (supabase.from('party_shared_state') as any)
      .update({ state_data: stateData, updated_at: new Date().toISOString() })
      .eq('party_id', party.partyId)
      .eq('state_type', 'map_markers')
      .select('id', { count: 'exact', head: true });
    if (!count || count === 0) {
      await (supabase.from('party_shared_state') as any).insert({
        party_id: party.partyId,
        user_id: user.id,
        state_type: 'map_markers',
        state_data: stateData,
      });
    }
  }, [user, party.partyId]);

  const updateMapMarkers = useCallback(async (markers: MapMarker[]) => {
    if (!user || !party.partyId) return;
    const stateData = { ...buildMapStateData(), markers };
    await upsertMapState(stateData);
  }, [user, party.partyId, buildMapStateData, upsertMapState]);

  const updateMapBackground = useCallback(async (url: string | undefined) => {
    if (!user || !party.partyId) return;
    setMapBackgroundUrl(url);
    const stateData = { ...buildMapStateData(), backgroundUrl: url };
    await upsertMapState(stateData);
  }, [user, party.partyId, buildMapStateData, upsertMapState]);

  const updateMapTierBackgrounds = useCallback(async (tierBackgrounds: { tierId: string; imageUrl: string }[]) => {
    if (!user || !party.partyId) return;
    setMapTierBackgrounds(tierBackgrounds);
    const stateData = { ...buildMapStateData(), tierBackgrounds };
    await upsertMapState(stateData);
  }, [user, party.partyId, buildMapStateData, upsertMapState]);

  const updateMapBackgroundOpacity = useCallback(async (opacity: number) => {
    if (!user || !party.partyId) return;
    setMapBackgroundOpacity(opacity);
    const stateData = { ...buildMapStateData(), backgroundOpacity: opacity };
    await upsertMapState(stateData);
  }, [user, party.partyId, buildMapStateData, upsertMapState]);

  const updateMapCustomTiers = useCallback(async (customTiers: { id: string; distancePerSquare: number; distanceUnit: string }[]) => {
    if (!user || !party.partyId) return;
    setMapCustomTiers(customTiers);
    const stateData = { ...buildMapStateData(), customTiers };
    await upsertMapState(stateData);
  }, [user, party.partyId, buildMapStateData, upsertMapState]);
  const logCombatEvent = useCallback(async (characterName: string, actionType: string, description: string, metadata: Record<string, unknown> = {}) => {
    if (!user || !party.partyId) return;

    await (supabase.from('party_combat_log') as any).insert({
      party_id: party.partyId,
      user_id: user.id,
      character_name: characterName,
      action_type: actionType,
      description,
      metadata,
    });
  }, [user, party.partyId]);

  const broadcastTyping = useCallback((senderName: string) => {
    if (!typingChannelRef.current || !user) return;
    typingChannelRef.current.track({ userId: user.id, name: senderName });
    // Auto-untrack after 3 seconds of inactivity
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingChannelRef.current?.untrack();
    }, 3000);
  }, [user]);

  const addReaction = useCallback(async (messageId: string, emoji: string, senderName: string) => {
    if (!user || !party.partyId) return;
    await (supabase.from('party_message_reactions') as any).upsert({
      message_id: messageId,
      party_id: party.partyId,
      user_id: user.id,
      sender_name: senderName,
      emoji,
    }, { onConflict: 'message_id,user_id,emoji' });
  }, [user, party.partyId]);

  const removeReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user || !party.partyId) return;
    await (supabase.from('party_message_reactions') as any)
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji);
  }, [user, party.partyId]);

  // --- Trade functions ---

  const sendTradeAction = useCallback(async (
    targetUserId: string,
    tradeType: PendingTradeAction['tradeType'],
    tradeData: Record<string, unknown>,
    senderName: string,
  ) => {
    if (!user || !party.partyId) return;

    await (supabase.from('party_actions') as any).insert({
      party_id: party.partyId,
      sender_user_id: user.id,
      target_user_id: targetUserId,
      action_type: tradeType,
      action_data: { ...tradeData, senderName },
    });
  }, [user, party.partyId]);

  const acceptTrade = useCallback(async (actionId: string) => {
    const trade = pendingTrades.find(t => t.id === actionId);
    if (!trade) return;

    // Fetch the full action data from the DB to get the complete item
    const { data: actionRow } = await supabase
      .from('party_actions')
      .select('action_data, action_type')
      .eq('id', actionId)
      .maybeSingle();

    if (actionRow && onIncomingTrade.current) {
      onIncomingTrade.current(
        actionRow.action_type,
        actionRow.action_data as Record<string, unknown>,
        trade.senderName,
      );
    }

    await supabase
      .from('party_actions')
      .update({ applied: true, status: 'accepted' } as Record<string, unknown>)
      .eq('id', actionId);

    setPendingTrades(prev => prev.filter(t => t.id !== actionId));
    toast.success(`Accepted ${trade.tradeType === 'send_gold' ? `${trade.amount} gold` : trade.itemName} from ${trade.senderName}!`);
  }, [pendingTrades]);

  const rejectTrade = useCallback(async (actionId: string) => {
    const trade = pendingTrades.find(t => t.id === actionId);

    await supabase
      .from('party_actions')
      .update({ applied: false, status: 'rejected' } as Record<string, unknown>)
      .eq('id', actionId);

    setPendingTrades(prev => prev.filter(t => t.id !== actionId));
    toast('Trade declined', { description: trade ? `From ${trade.senderName}` : undefined });
  }, [pendingTrades]);

  return {
    party,
    pendingHeals,
    pendingTrades,
    createParty,
    joinParty,
    leaveParty,
    disconnectLocally,
    reconnectToParty,
    disbandParty,
    broadcastStatus,
    sendHealAction,
    sendPing,
    acceptHeal,
    rejectHeal,
    onIncomingHeal,
    sendTradeAction,
    acceptTrade,
    rejectTrade,
    onIncomingTrade,
    onTradeRejected,
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
    sendMessage,
    editMessage,
    deleteMessage,
    bulkDeleteMessages,
    clearAllMessages,
    pinMessage,
    unpinMessage,
    uploadChatImage,
    partyMessages,
    messageReactions,
    addReaction,
    removeReaction,
    startVote,
    castVote,
    closeVote,
    activeVote,
    updateMapMarkers,
    mapMarkers,
    mapBackgroundUrl,
    updateMapBackground,
    mapTierBackgrounds,
    mapBackgroundOpacity,
    mapCustomTiers,
    updateMapTierBackgrounds,
    updateMapBackgroundOpacity,
    updateMapCustomTiers,
    logCombatEvent,
    combatLog,
    typingUsers,
    broadcastTyping,
  };
}
