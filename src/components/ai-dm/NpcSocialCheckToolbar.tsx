import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Check, X, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CharacterContext } from '@/components/oracle/types';
import {
  SOCIAL_SKILLS,
  resolveSocialCheck,
  getPlayerSocialModifier,
  type SocialSkillId,
  type SocialCheckResult,
} from '@/lib/npcSocialChecks';
import { playDiceRattle, playDiceThud } from '@/lib/diceSounds';

export interface NpcSocialCheckToolbarProps {
  visible: boolean;
  npcName: string | null;
  ready: boolean;
  characterContext: CharacterContext;
  disabled?: boolean;
  onSkillTap?: () => void;
  onResolved: (result: SocialCheckResult) => void;
}

type Phase = 'idle' | 'player-rolling' | 'npc-rolling' | 'revealed';

const PHASE_PLAYER_MS = 550;
const PHASE_NPC_MS = 550;
const PHASE_REVEALED_MS = 700;

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function NpcSocialCheckToolbar({
  visible,
  npcName,
  ready,
  characterContext,
  disabled = false,
  onSkillTap,
  onResolved,
}: NpcSocialCheckToolbarProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [activeSkill, setActiveSkill] = useState<SocialSkillId | null>(null);
  const [pendingResult, setPendingResult] = useState<SocialCheckResult | null>(null);

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const resultRef = useRef<SocialCheckResult | null>(null);

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach((id) => clearTimeout(id));
    timeoutsRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearAllTimeouts();
  }, [clearAllTimeouts]);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  const handleSkillTap = useCallback(
    (skillId: SocialSkillId) => {
      if (disabled || phase !== 'idle') return;

      if (!ready || !npcName) {
        toast('Tag one NPC and type your line first.');
        return;
      }

      // Lock in both dice rolls synchronously, before any animation or state update.
      const result = resolveSocialCheck(characterContext, npcName, skillId);
      resultRef.current = result;

      onSkillTap?.();

      setActiveSkill(skillId);
      setPendingResult(result);
      setPhase('player-rolling');

      try {
        playDiceRattle(PHASE_PLAYER_MS);
      } catch {
        // Ignore audio errors (e.g., blocked autoplay).
      }

      schedule(() => {
        setPhase('npc-rolling');
        try {
          playDiceThud();
        } catch {
          // Ignore audio errors.
        }
      }, PHASE_PLAYER_MS);

      schedule(() => {
        setPhase('revealed');
      }, PHASE_PLAYER_MS + PHASE_NPC_MS);

      schedule(() => {
        const finalResult = resultRef.current;
        if (finalResult) {
          onResolved(finalResult);
        }
        setPhase('idle');
        setActiveSkill(null);
        setPendingResult(null);
        resultRef.current = null;
      }, PHASE_PLAYER_MS + PHASE_NPC_MS + PHASE_REVEALED_MS);
    },
    [characterContext, disabled, npcName, onSkillTap, onResolved, phase, ready, schedule]
  );

  const isResolving = phase !== 'idle';

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="overflow-hidden bg-black/90 backdrop-blur border-b border-amber-900/30"
        >
          <div className="px-3 py-3">
            {/* Header line */}
            <div className="flex items-center justify-center mb-2.5">
              <span
                className={cn(
                  'text-xs font-cinzel tracking-wide',
                  npcName ? 'text-amber-400' : 'text-amber-400/50'
                )}
              >
                {npcName ? `Talking to ${npcName}` : 'Tag an NPC to enable skill checks'}
              </span>
            </div>

            {/* Skill row */}
            <div className="flex items-center justify-center gap-2">
              {SOCIAL_SKILLS.map((skill) => {
                const isActive = activeSkill === skill.id;
                const modifier = getPlayerSocialModifier(characterContext, skill.id);

                return (
                  <button
                    key={skill.id}
                    type="button"
                    disabled={disabled || isResolving}
                    onClick={() => handleSkillTap(skill.id)}
                    className={cn(
                      'relative flex flex-col items-center justify-center rounded-xl border px-2 py-3.5 transition-all',
                      'min-w-[68px] flex-1 max-w-[92px]',
                      isActive
                        ? 'bg-amber-950/60 border-amber-500/60 ring-1 ring-amber-400/40 shadow-[0_0_12px_rgba(251,191,36,0.18)]'
                        : 'bg-zinc-950/80 border-amber-900/30 hover:bg-amber-950/30 hover:border-amber-700/40',
                      (disabled || isResolving) && !isActive && 'opacity-40 cursor-not-allowed'
                    )}
                    style={{ touchAction: 'manipulation' }}
                  >
                    {/* Icon */}
                    <span className="text-lg leading-none mb-1.5" aria-hidden="true">
                      {skill.icon}
                    </span>

                    {/* Label */}
                    <span
                      className={cn(
                        'text-[11px] font-medium leading-tight',
                        isActive ? 'text-amber-300' : 'text-amber-100/80'
                      )}
                    >
                      {skill.label}
                    </span>

                    {/* Idle: player modifier */}
                    {!isActive && (
                      <span className="text-[10px] text-amber-400/60 mt-1">
                        {formatModifier(modifier)}
                      </span>
                    )}

                    {/* Active: roll results */}
                    {isActive && pendingResult && (
                      <div className="mt-1.5 flex flex-col items-center gap-0.5 w-full">
                        {(phase === 'player-rolling' ||
                          phase === 'npc-rolling' ||
                          phase === 'revealed') && (
                          <span className="text-[10px] text-amber-200/90">
                            You: {pendingResult.playerRoll.total}
                          </span>
                        )}

                        {(phase === 'npc-rolling' || phase === 'revealed') && (
                          <span className="text-[10px] text-amber-200/70">
                            {npcName}: {pendingResult.npcRoll.total}
                          </span>
                        )}

                        {phase === 'revealed' && (
                          <OutcomeBadge outcome={pendingResult.outcome} />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OutcomeBadge({ outcome }: { outcome: SocialCheckResult['outcome'] }) {
  if (outcome === 'success') {
    return (
      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
        <Check className="w-3 h-3" />
        Success
      </span>
    );
  }

  if (outcome === 'failure') {
    return (
      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/30">
        <X className="w-3 h-3" />
        Failure
      </span>
    );
  }

  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/30">
      <Minus className="w-3 h-3" />
      Tie
    </span>
  );
}
