// Small display pieces for the Human DM Assistant chat: a dice result card,
// a swipeable set of alternate versions, and one rehearsed NPC line.

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { ART, Medal, npcFrameStyle } from './DMAssistantArt';
import { describeRoll, type DiceRoll } from '@/lib/dm-dice';
import type { AssistantTakes } from '@/lib/dm-assistant';

/** Reading view only: hide narration speaker tags. */
const forReading = (text: string) => text.replace(/\[VOICE:[^\]]*\]|\[\/VOICE\]/gi, '');

export function DiceCard({ roll }: { roll: DiceRoll }) {
  return (
    <div className="flex justify-center">
      <div className={cn(
        'w-full max-w-[300px] rounded-xl border px-3 py-2 flex items-center gap-3',
        roll.crit === 'nat20' ? 'border-amber-300/60 bg-amber-900/30'
          : roll.crit === 'nat1' ? 'border-red-400/50 bg-red-950/40'
          : 'border-white/15 bg-white/5',
      )}>
        <Medal src={ART.medalDice} className="w-8 h-8" />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-white/80 truncate">{roll.label}</div>
          <div className="text-[11px] text-white/45 truncate">{roll.expr} · {describeRoll(roll)}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-cinzel text-[20px] leading-none text-amber-100">{roll.total}</div>
          {roll.crit && (
            <div className={cn('text-[9px] uppercase tracking-wider', roll.crit === 'nat20' ? 'text-amber-300' : 'text-red-300')}>
              {roll.crit === 'nat20' ? 'Nat 20' : 'Nat 1'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TakesCard({
  takes,
  onKeep,
  disabled,
}: {
  takes: AssistantTakes;
  onKeep: (index: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-white/40 px-1 flex items-center gap-1.5">
        <Medal src={ART.medalVersions} className="w-4 h-4" />
        Versions of ¶{takes.paragraph}{takes.options.length > 1 ? ' · swipe to compare' : ''}
      </div>
      <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1 -mx-1 px-1">
        {takes.options.map((option, i) => {
          const kept = takes.kept === i;
          return (
            <div
              key={i}
              className={cn(
                'snap-start shrink-0 w-[85%] rounded-xl border p-3 flex flex-col gap-2',
                kept ? 'border-emerald-400/50 bg-emerald-950/40' : 'border-white/10 bg-white/[0.04]',
              )}
            >
              <div className="text-[11px] uppercase tracking-wider text-amber-300/70">
                Version {i + 1} of {takes.options.length}
              </div>
              <p className="text-[13.5px] leading-relaxed text-white/90 whitespace-pre-wrap break-words flex-1">
                {forReading(option)}
              </p>
              <button
                onClick={() => onKeep(i)}
                disabled={disabled || kept}
                style={{ touchAction: 'manipulation' }}
                className={cn(
                  'min-h-[38px] rounded-lg border text-[13px] flex items-center justify-center gap-1.5',
                  kept ? 'border-emerald-400/40 text-emerald-200' : 'border-amber-400/40 bg-amber-900/30 text-amber-100 disabled:opacity-40',
                )}
              >
                <Check className="w-4 h-4" /> {kept ? 'In the draft' : 'Keep this'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Renders *action beats* in italics and the rest as speech. */
function SpokenLine({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => (p.startsWith('*') && p.endsWith('*')
        ? <em key={i} className="text-amber-100/60">{p.slice(1, -1)}</em>
        : <span key={i}>{p}</span>))}
    </>
  );
}

export function NpcLine({
  npc,
  text,
  picked,
  onTogglePick,
}: {
  npc: string;
  text: string;
  picked: boolean;
  onTogglePick: () => void;
}) {
  return (
    <div className="flex justify-start">
      <div
        className={cn('max-w-[88%] px-1.5 py-0.5', picked ? 'bg-[#2a2016]' : 'bg-[#16130f] opacity-70')}
        style={{ ...npcFrameStyle, backgroundClip: 'padding-box' }}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-cinzel text-amber-300/90 mb-0.5">
          <Medal src={ART.medalNpc} className="w-5 h-5" /> {npc}
        </div>
        <div className="text-[13.5px] leading-relaxed text-amber-50/90 whitespace-pre-wrap break-words">
          <SpokenLine text={text} />
        </div>
        <button
          onClick={onTogglePick}
          aria-pressed={picked}
          style={{ touchAction: 'manipulation' }}
          className={cn(
            'mt-1.5 flex items-center gap-1 text-[11px]',
            picked ? 'text-emerald-300/85' : 'text-white/45',
          )}
        >
          <span className={cn(
            'w-3.5 h-3.5 rounded border flex items-center justify-center',
            picked ? 'border-emerald-400/70 bg-emerald-600/40' : 'border-white/30',
          )}>
            {picked && <Check className="w-2.5 h-2.5" />}
          </span>
          {picked ? 'Goes in the draft' : 'Left out'}
        </button>
      </div>
    </div>
  );
}
