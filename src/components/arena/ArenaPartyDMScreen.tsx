// Arena: the real Party DM screen, running on local practice runtimes.
// Adapter only — it renders PartyDMScreen itself, with no party behind it.
import { useEffect, useMemo, useRef, type ComponentProps } from 'react';
import { PartyDMScreen } from '@/components/ai-dm/PartyDMScreen';
import type { StandalonePartyDMScreen } from '@/components/ai-dm/StandalonePartyDMScreen';
import type { PartyMember } from '@/hooks/use-party-sync';
import type { CharacterContext } from '@/components/oracle/types';
import { useArenaRoundChat } from '@/hooks/use-arena-round-chat';
import { useArenaPartyDm } from '@/hooks/use-arena-party-dm';
import { useArenaNpcPractice, type ArenaDrillKind } from '@/hooks/use-arena-npc-practice';
import { gauntletFoe, type Foe, type ArenaStats } from './ArenaPractice';
import type { SparringNet } from '@/lib/arena/sparringNet';

/** What the local practice table runs. */
export type ArenaPracticeConfig =
  | { mode: 'solo'; foe: Foe & { persona?: string }; drillKind: ArenaDrillKind }
  | { mode: 'gauntlet' };

type AutoSyncCallbacks = ComponentProps<typeof StandalonePartyDMScreen>['autoSyncCallbacks'];

const LOCAL_ARENA_USER = 'arena-player';

interface Props {
  characterContext: CharacterContext;
  /** Solo drill or Endless Gauntlet. Without it, the legacy foe/foes props run a standard fight. */
  practice?: ArenaPracticeConfig;
  /** Practice scorecard updates. */
  onStatsChange?: (stats: ArenaStats) => void;
  foe?: Foe & { persona?: string };
  /** Several opponents at once (Party Sparring). */
  foes?: Array<Foe & { persona?: string }>;
  onBack: () => void;
  currentUserId?: string | null;
  /** The player's real party row for the same user, when there is one. */
  member?: PartyMember | null;
  autoSyncCallbacks?: AutoSyncCallbacks;
  currentXP?: number;
  onManualLevelUp?: () => void;
  /** Opponent's real AI voice (default on). */
  aiVoice?: boolean;
  /** Party Sparring link (host or member), when fighting together. */
  net?: SparringNet | null;
}

export function ArenaPartyDMScreen({ characterContext, practice, onStatsChange, foe, foes, onBack, currentUserId, member, autoSyncCallbacks, currentXP, onManualLevelUp, aiVoice = true, net = null }: Props) {
  const userId = currentUserId || LOCAL_ARENA_USER;
  const name = member?.character_name || characterContext.name || 'Player';

  // The one practice player: the real shared-sheet row when we have it, otherwise the minimum from the character.
  const members = useMemo(() => [member && member.user_id === userId
    ? { user_id: member.user_id, character_name: member.character_name, character_status: member.character_status as unknown as Record<string, unknown>, updated_at: member.updated_at }
    : { user_id: userId, character_name: name, character_status: { hp: characterContext.currentHP, maxHp: characterContext.maxHP, level: characterContext.level } }], [member, userId, name, characterContext.currentHP, characterContext.maxHP, characterContext.level]);

  const partyDm = useArenaPartyDm({ characterName: name, characterContext, userId });
  const roundId = partyDm.sessionConfig?.currentRoundId || 'arena-round';
  const localChat = useArenaRoundChat(userId, name, roundId);
  // Fighting together: everyone's typed lines reach every phone.
  const { appendLine } = localChat;
  useEffect(() => {
    if (!net) return;
    return net.on('chat', (p) => {
      if (typeof p.content !== 'string' || typeof p.userId !== 'string') return;
      appendLine({ content: p.content.slice(0, 2000), characterName: String(p.characterName ?? 'Adventurer').slice(0, 60), inCharacter: p.inCharacter !== false, userId: p.userId });
    });
  }, [net, appendLine]);
  const roundChat = useMemo(() => {
    if (!net) return localChat;
    const share = (content: string, inCharacter: boolean) => net.send('chat', { content, inCharacter, userId, characterName: name });
    return {
      ...localChat,
      postLine: async (...a: Parameters<typeof localChat.postLine>) => { const id = await localChat.postLine(...a); if (id && !a[2]) share(a[0], a[1]); return id; },
      sendMessage: async (...a: Parameters<typeof localChat.sendMessage>) => { const ok = await localChat.sendMessage(...a); if (ok) share(a[0], a[1]); return ok; },
    };
  }, [localChat, net, userId, name]);
  const { combat, roster } = useArenaNpcPractice({
    ctx: characterContext,
    enabled: true,
    mode: practice?.mode === 'gauntlet' ? 'gauntlet' : 'single',
    drillKind: practice?.mode === 'solo' ? practice.drillKind : 'standard',
    foe: practice?.mode === 'solo' ? practice.foe : practice?.mode === 'gauntlet' ? gauntletFoe(1) : foe,
    foes: practice ? undefined : foes,
    onStatsChange,
    currentUserId: userId, appendLine, aiVoice: aiVoice && net?.role !== 'member', net });

  // Everyone in the ring shows up as a table member.
  const ringMembers = useMemo(() => {
    const others = combat.fighters.filter((f) => f.kind === 'player' && f.user_id && f.user_id !== userId)
      .map((f) => ({ user_id: f.user_id as string, character_name: f.name, character_status: { hp: f.hp, maxHp: f.max_hp }, updated_at: f.updated_at }));
    return [...members, ...others];
  }, [combat.fighters, members, userId]);

  // Keep the session in fight mode so the real fight bar is there from the start.
  const forced = useRef(false);
  useEffect(() => {
    if (forced.current || partyDm.sessionConfig?.combatMode) { forced.current = true; return; }
    forced.current = true;
    void partyDm.updateSessionConfig({ combatMode: true });
  }, [partyDm]);

  const runtimeOverrides = useMemo(() => ({ practiceMode: true, roundChat, npcCombat: combat, npcCombatRoster: roster }), [roundChat, combat, roster]);

  return (
    <PartyDMScreen
      initialLiveTableOpen
      onBack={onBack}
      partyId={null}
      partyDm={partyDm}
      isCreator={net?.role !== 'member'}
      isOriginalCreator={net?.role !== 'member'}
      currentUserId={userId}
      memberCount={ringMembers.length}
      members={ringMembers}
      characterContext={characterContext}
      currentXP={currentXP}
      onManualLevelUp={onManualLevelUp}
      onHPChange={autoSyncCallbacks?.onHPChange}
      onRestOccurred={autoSyncCallbacks?.onRestOccurred}
      onUseConsumableByName={autoSyncCallbacks?.onUseConsumableByName}
      runtimeOverrides={runtimeOverrides}
    />
  );
}
