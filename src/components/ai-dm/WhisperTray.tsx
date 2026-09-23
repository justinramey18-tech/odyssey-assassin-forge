import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChevronDown, Dices } from 'lucide-react';
import type { Whisper } from '@/components/oracle/types';
import { parseRollHint } from '@/lib/whisperRollHint';
import { resolveWhisperAutoRoll } from '@/lib/whisperAutoRoll';
import { isDmBlueprintWhisper } from '@/lib/whisper-parser';
import whisperPlaque from '@/assets/whisper/whisper-plaque.png';
import whisperPanelFrame from '@/assets/whisper/whisper-panel-frame.png';
import whisperCardFrame from '@/assets/whisper/whisper-card-frame.png';
import medalMove from '@/assets/whisper/medal-move.png';
import medalTactics from '@/assets/whisper/medal-tactics.png';
import medalSecret from '@/assets/whisper/medal-secret.png';

interface WhisperTrayProps {
  whispers: Whisper[];
  /** Called when the user taps an action whisper that CAN auto-roll. Omit to disable auto-roll. */
  onAutoRoll?: (whisperContent: string) => void;
  /** Called when the user taps an action whisper that can NOT auto-roll (vague). Caller should open the full dice roller. */
  onOpenRoller?: (whisperContent: string) => void;
}

const TYPE_STYLE: Record<Whisper['type'], { medal: string; label: string; one: string; many: string; color: string }> = {
  action:  { medal: medalMove,    label: 'Your Move', one: 'Move',   many: 'Moves',   color: 'text-[#fcd9a0]' },
  tactics: { medal: medalTactics, label: 'Tactics',   one: 'Tactic', many: 'Tactics', color: 'text-emerald-200' },
  whisper: { medal: medalSecret,  label: 'Secret',    one: 'Secret', many: 'Secrets', color: 'text-violet-200' },
};

const GLOW_REST = 'drop-shadow(0 0 5px rgba(168,85,247,0.35))';
const GLOW_PEAK = 'drop-shadow(0 0 14px rgba(168,85,247,0.85))';

export function WhisperTray({ whispers, onAutoRoll, onOpenRoller }: WhisperTrayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // The DM sometimes writes its private planning blueprint inside a TACTICS tag.
  // That's for the DM, not the players, so it never shows in the tray.
  const visible = whispers.filter(w => !isDmBlueprintWhisper(w));
  if (!visible.length) return null;

  const counts = (['action', 'tactics', 'whisper'] as const)
    .map(type => ({ type, n: visible.filter(w => w.type === type).length }))
    .filter(c => c.n > 0);

  const pulsing = !hasOpened && !prefersReducedMotion;

  const toggle = () => {
    setIsOpen(o => !o);
    setHasOpened(true);
  };

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-label={`Whispers from the DM: ${counts.map(c => `${c.n} ${c.n === 1 ? TYPE_STYLE[c.type].one : TYPE_STYLE[c.type].many}`).join(', ')}. ${isOpen ? 'Hide' : 'Tap to reveal'}`}
        className="block w-full max-w-[320px] text-left transition-transform active:scale-[0.99]"
        style={{ touchAction: 'manipulation' }}
      >
        <motion.img
          src={whisperPlaque}
          alt=""
          draggable={false}
          className="block h-auto w-full"
          animate={{ filter: pulsing ? [GLOW_REST, GLOW_PEAK, GLOW_REST] : GLOW_REST }}
          transition={pulsing ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
        />
        <span className="-mt-0.5 ml-2.5 flex items-center gap-2.5 font-cinzel text-[10.5px] font-bold tracking-[0.04em]">
          {counts.map(c => (
            <span key={c.type} className={cn('inline-flex items-center gap-1', TYPE_STYLE[c.type].color)}>
              <img src={TYPE_STYLE[c.type].medal} alt="" className="h-5 w-5" />
              {c.n} {c.n === 1 ? TYPE_STYLE[c.type].one : TYPE_STYLE[c.type].many}
            </span>
          ))}
          <span className="ml-auto inline-flex items-center gap-0.5 font-body text-[10.5px] font-normal italic tracking-normal text-violet-200/60">
            {isOpen ? 'Hide' : 'Tap to reveal'}
            <ChevronDown className={cn('h-3 w-3 transition-transform duration-200', isOpen && 'rotate-180')} />
          </span>
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              className="mt-1.5"
              style={{
                borderStyle: 'solid',
                borderWidth: '14px',
                borderImage: `url(${whisperPanelFrame}) 150 fill / 36px stretch`,
                padding: '4px 2px',
              }}
            >
              <div className="space-y-2">
                {visible.map((whisper, i) => {
                  const style = TYPE_STYLE[whisper.type];
                  return (
                    <div
                      key={i}
                      className="relative"
                      style={{
                        borderStyle: 'solid',
                        borderWidth: '12px',
                        borderImage: `url(${whisperCardFrame}) 104 110 104 110 fill / 26px 27px 26px 27px stretch`,
                        padding: '0 4px 0 38px',
                      }}
                    >
                      <img
                        src={style.medal}
                        alt=""
                        aria-hidden="true"
                        className="pointer-events-none absolute h-9 w-9"
                        style={{ left: -4, top: -2 }}
                      />
                      <span className={cn('block font-cinzel text-[9.5px] font-bold uppercase tracking-[0.18em]', style.color)}>
                        {style.label}{whisper.type === 'whisper' && whisper.target ? ` → ${whisper.target}` : ''}
                      </span>
                      <p className="mt-px text-[13px] leading-[1.55] text-orange-50/90">
                        {whisper.content}
                      </p>
                      {whisper.type === 'action' && (onAutoRoll || onOpenRoller) && (() => {
                        const hint = parseRollHint(whisper.content);
                        const auto = resolveWhisperAutoRoll(hint);
                        const canAuto = auto.canAutoRoll && !!onAutoRoll;
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (canAuto && onAutoRoll) {
                                onAutoRoll(whisper.content);
                              } else if (onOpenRoller) {
                                onOpenRoller(whisper.content);
                              } else if (onAutoRoll) {
                                onAutoRoll(whisper.content);
                              }
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-gradient-to-b from-amber-500/30 to-amber-700/30 px-3 py-1 font-cinzel text-[11px] font-bold tracking-wide text-amber-100 shadow-[0_0_8px_rgba(245,158,11,0.35)] transition-colors active:from-amber-500/45 active:to-amber-700/45"
                            style={{ touchAction: 'manipulation' }}
                          >
                            <Dices className="h-3.5 w-3.5" />
                            <span>{auto.label}</span>
                          </button>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
