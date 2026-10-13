// Arena: the real Party DM screen, running on local practice runtimes.
// Adapter only — it renders PartyDMScreen itself, with no party behind it.
import { useEffect, useMemo, useRef, type ComponentProps } from 'react';
import { PartyDMScreen } from '@/components/ai-dm/PartyDMScreen';
import type { StandalonePartyDMScreen } from '@/components/ai-dm/StandalonePartyDMScreen';
import type { PartyMember } from '@/hooks/use-party-sync';
import type { CharacterContext } from '@/components/oracle/types';
import { useArenaRoundChat } from '@/hooks/use-arena-round-chat';
import { useArenaPartyDm } from '@/hooks/use-arena-party-dm';
import { useArenaNpcPractice } from '@/hooks/use-arena-npc-practice';
import type { Foe } from './ArenaPractice';

type AutoSyncCallbacks = ComponentProps<typeof StandalonePartyDMScreen>['autoSyncCallbacks'];

const LOCAL_ARENA_USER = 'arena-player';

interface Props {
  characterContext: CharacterContext;
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
}

export function ArenaPartyDMScreen({ characterContext, foe, foes, onBack, currentUserId, member, autoSyncCallbacks, currentXP, onManualLevelUp, aiVoice = true }: Props) {
  const userId = currentUserId || LOCAL_ARENA_USER;
  const name = member?.character_name || characterContext.name || 'Player';

  // The one practice player: the real shared-sheet row when we have it, otherwise the minimum from the character.
  const members = useMemo(() => [member && member.user_id === userId
    ? { user_id: member.user_id, character_name: member.character_name, character_status: member.character_status as unknown as Record<string, unknown>, updated_at: member.updated_at }
    : { user_id: userId, character_name: name, character_status: { hp: characterContext.currentHP, maxHp: characterContext.maxHP, level: characterContext.level } }], [member, userId, name, characterContext.currentHP, characterContext.maxHP, characterContext.level]);

  const partyDm = useArenaPartyDm({ characterName: name, characterContext, userId });
  const roundId = partyDm.sessionConfig?.currentRoundId || 'arena-round';
  const roundChat = useArenaRoundChat(userId, name, roundId);
  const { combat, roster } = useArenaNpcPractice({ ctx: characterContext, foe, foes, currentUserId: userId, appendLine: roundChat.appendLine, aiVoice });

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
      isCreator
      isOriginalCreator
      currentUserId={userId}
      memberCount={1}
      members={members}
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
