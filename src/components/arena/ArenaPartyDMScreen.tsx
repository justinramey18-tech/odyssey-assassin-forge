// Arena: the real Party DM screen, running on local practice runtimes.
// Adapter only — it renders PartyDMScreen itself, with no party behind it.
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Trophy, X } from 'lucide-react';
import { PartyDMScreen } from '@/components/ai-dm/PartyDMScreen';
import type { StandalonePartyDMScreen } from '@/components/ai-dm/StandalonePartyDMScreen';
import type { PartyMember } from '@/hooks/use-party-sync';
import type { CharacterContext } from '@/components/oracle/types';
import { useArenaRoundChat } from '@/hooks/use-arena-round-chat';
import { useArenaPartyDm } from '@/hooks/use-arena-party-dm';
import { useArenaNpcPractice, type ArenaDrillKind } from '@/hooks/use-arena-npc-practice';
import { gauntletFoe, type Foe, type ArenaStats } from './ArenaPractice';
import type { SparringNet } from '@/lib/arena/sparringNet';
import { useArenaPartyPractice } from '@/hooks/use-arena-party-practice';
import { ARENA_BOSSES } from '@/lib/arena/arenaRoom';

/** What the local practice table runs. */
export type ArenaPracticeConfig =
  | { mode: 'solo'; foe: Foe & { persona?: string }; drillKind: ArenaDrillKind }
  | { mode: 'gauntlet' }
  /** Shared boss in arena_rooms. partyId is used ONLY to open that practice room. */
  | { mode: 'party'; partyId: string };

type AutoSyncCallbacks = ComponentProps<typeof StandalonePartyDMScreen>['autoSyncCallbacks'];

const LOCAL_ARENA_USER = 'arena-player';
const GAUNTLET_START = gauntletFoe(1);

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
  const isParty = practice?.mode === 'party';
  // Quick Build's "use the scene": recent Arena-local lines only, never campaign history.
  const chatRef = useRef(localChat.messages); chatRef.current = localChat.messages;
  const getPracticeScene = useCallback(() => chatRef.current.slice(-12).map((m) => `${m.character_name}: ${m.content}`).join('\n').slice(0, 2000), []);
  // Both runtimes always run (Rules of Hooks); only the selected one is enabled.
  const local = useArenaNpcPractice({
    ctx: characterContext,
    enabled: !isParty,
    mode: practice?.mode === 'gauntlet' ? 'gauntlet' : 'single',
    drillKind: practice?.mode === 'solo' ? practice.drillKind : 'standard',
    foe: practice?.mode === 'solo' ? practice.foe : practice?.mode === 'gauntlet' ? GAUNTLET_START : foe,
    foes: practice ? undefined : foes,
    onStatsChange,
    getPracticeScene,
    currentUserId: userId, appendLine, aiVoice: aiVoice && net?.role !== 'member', net: isParty ? null : net });
  const shared = useArenaPartyPractice({
    enabled: isParty,
    partyId: practice?.mode === 'party' ? practice.partyId : null,
    currentUserId: currentUserId ?? null,
    characterName: name,
    ctx: characterContext,
    appendLine,
  });
  const combat = isParty ? shared.combat : local.combat;
  const roster = isParty ? shared.roster : local.roster;
  const [arenaOpen, setArenaOpen] = useState(false);

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

  const table = (
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
  if (!isParty) return table;

  return (
    <>
      {table}
      {/* Small practice-only Arena control; sits beside, never replaces, the table. */}
      <button
        type="button"
        onClick={() => setArenaOpen((o) => !o)}
        aria-label="Party Arena scores"
        style={{ touchAction: 'manipulation' }}
        className="fixed left-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+4rem)] z-[55] flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card/90 text-primary shadow-md active:scale-95"
      >
        <Trophy className="h-5 w-5" />
      </button>
      {arenaOpen && (
        <div className="fixed inset-x-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+7.5rem)] z-[55] max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-cinzel text-sm font-bold uppercase tracking-wider text-primary">Party Arena</span>
            <button type="button" onClick={() => setArenaOpen(false)} aria-label="Close" style={{ touchAction: 'manipulation' }} className="flex h-12 w-12 items-center justify-center text-muted-foreground"><X className="h-4 w-4" /></button>
          </div>
          {shared.status === 'opening' && <p className="text-sm text-muted-foreground">Opening the arena…</p>}
          {shared.status === 'error' && <p className="text-sm text-muted-foreground">The arena could not be opened. Try again in a moment.</p>}
          {shared.status === 'closed' && <p className="text-sm text-muted-foreground">The host closed this arena. Leave and reopen Party Arena to start a new one.</p>}
          {shared.room && (
            <>
              <p className="mb-2 text-xs text-muted-foreground">{shared.room.state.boss.name} · {shared.room.state.boss.hp}/{shared.room.state.boss.maxHp} HP</p>
              {shared.scores.length === 0 ? <p className="text-sm text-muted-foreground">No hits yet.</p> : shared.scores.map((m) => (
                <div key={m.userId} className="flex justify-between border-b border-border/50 py-2 text-sm last:border-0">
                  <span className="text-foreground">{m.name}</span>
                  <span className="text-muted-foreground">{m.damage} dmg · {m.hits} hits</span>
                </div>
              ))}
              {shared.isHost && (
                <div className="mt-3 flex flex-col gap-2">
                  {ARENA_BOSSES.map((b) => (
                    <button key={b.name} type="button" onClick={() => void shared.resetBoss(b)} style={{ touchAction: 'manipulation' }} className="min-h-[48px] rounded-lg border border-border bg-background px-3 text-left text-sm text-foreground active:scale-[0.98]">
                      Reset to {b.name} ({b.maxHp} HP · AC {b.ac})
                    </button>
                  ))}
                  <button type="button" onClick={() => void shared.closeRoom()} style={{ touchAction: 'manipulation' }} className="min-h-[48px] rounded-lg border border-destructive/60 px-3 text-sm text-destructive active:scale-[0.98]">
                    Close the arena for everyone
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
