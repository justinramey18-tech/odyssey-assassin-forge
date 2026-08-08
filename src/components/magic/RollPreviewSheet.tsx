import { useMemo, useState } from 'react';
import { Dices, Zap, Shield, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getCastOptions, getMagicResources, type CastOption } from '@/lib/magic/castBus';
import { parseDiceFormula, scaleForUpcast, formatDiceFormula } from '@/lib/magic/castResolver';

export interface RollPreviewTarget {
  name: string;
  kind: 'attack' | 'spell';
  /** Base spell level (0 = cantrip). Undefined for weapons. */
  spellLevel?: number;
  damageFormula?: string;
  damageType?: string;
  saveStat?: string;
  attackType?: string;
  /** To-hit bonus for weapon attacks. */
  attackBonus?: number;
  /** Rules text so the player can check the maths against the spell. */
  rulesText?: string;
}

export interface RollPreviewChoice {
  slotLevel?: number;
  usePact?: boolean;
}

interface RollPreviewSheetProps {
  target: RollPreviewTarget | null;
  onCancel: () => void;
  onConfirm: (choice: RollPreviewChoice) => void;
}

/**
 * Shown before any dice are thrown: the exact to-hit maths and the exact damage
 * dice (after slot scaling), so the player can confirm it matches the spell.
 */
export function RollPreviewSheet({ target, onCancel, onConfirm }: RollPreviewSheetProps) {
  const resources = useMemo(() => (target ? getMagicResources() : null), [target]);
  const baseLevel = Number.isFinite(target?.spellLevel) ? Number(target!.spellLevel) : 0;
  const isSpell = target?.kind === 'spell';
  const isCantrip = isSpell && baseLevel === 0;

  const options = useMemo<CastOption[]>(
    () => (isSpell && !isCantrip ? getCastOptions(baseLevel) : []),
    [isSpell, isCantrip, baseLevel],
  );
  const [chosen, setChosen] = useState(0);

  if (!target) return null;

  const option = options[chosen] ?? options[0];
  const castLevel = isSpell && !isCantrip ? option?.slotLevel ?? baseLevel : baseLevel;

  const attackBonus = isSpell ? resources?.spellAttackBonus ?? 0 : target.attackBonus ?? 0;

  const parsedDamage = parseDiceFormula(target.damageFormula);
  const scaledDamage = parsedDamage && isSpell && baseLevel > 0
    ? scaleForUpcast(parsedDamage, baseLevel, castLevel)
    : parsedDamage;
  const damageLabel = scaledDamage ? formatDiceFormula(scaledDamage) : '1d8 (default — no dice on this entry)';
  const upcastExtra = parsedDamage && scaledDamage ? scaledDamage.count - parsedDamage.count : 0;

  const blocked = isSpell && !isCantrip && options.length === 0;

  return (
    <div className="fixed inset-0 z-[86] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full max-w-lg rounded-t-2xl border-t border-x border-amber-400/25 bg-[#0b0a12] p-4 pb-8 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-cinzel text-base text-amber-200 truncate">{target.name}</h3>
            <p className="text-[11px] text-white/45">
              Check the numbers before you roll
            </p>
          </div>
          <button onClick={onCancel} className="p-2 -m-2 text-white/40" style={{ touchAction: 'manipulation' }} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSpell && !isCantrip && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wide text-white/35">Cast using</p>
            {options.length === 0 ? (
              <p className="text-xs text-red-300/80">No slot of level {baseLevel} or higher remains.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {options.map((o, i) => (
                  <button
                    key={`${o.slotLevel}-${o.usePact ? 'pact' : 'std'}`}
                    onClick={() => setChosen(i)}
                    style={{ touchAction: 'manipulation' }}
                    className={cn(
                      'min-h-[48px] px-3 rounded-lg border text-xs transition-colors',
                      i === chosen
                        ? 'border-amber-400/60 bg-amber-500/15 text-amber-100'
                        : 'border-white/10 bg-white/[0.03] text-white/60',
                    )}
                  >
                    <span className="block">
                      {o.usePact ? `Pact Lv ${o.slotLevel}` : `Level ${o.slotLevel}`}
                      {o.isUpcast && <span className="ml-1 text-amber-300/80">upcast</span>}
                    </span>
                    <span className="block text-[10px] text-white/40">{o.remaining} left</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2 text-xs text-white/70">
          <p className="flex items-start gap-2">
            <Dices className="w-3.5 h-3.5 mt-0.5 text-amber-300/80 shrink-0" />
            <span>
              <span className="text-white/45">To hit: </span>
              1d20 {attackBonus >= 0 ? '+' : '−'} {Math.abs(attackBonus)}
              <span className="text-white/40">
                {' '}({isSpell ? 'spell attack bonus' : 'attack bonus'} from your sheet), compared to the target's AC
              </span>
            </span>
          </p>

          <p className="flex items-start gap-2">
            <Zap className="w-3.5 h-3.5 mt-0.5 text-orange-300/80 shrink-0" />
            <span>
              <span className="text-white/45">Damage: </span>
              {damageLabel}{target.damageType ? ` ${target.damageType}` : ''}
              {upcastExtra > 0 && (
                <span className="text-amber-300/80">
                  {' '}(base {formatDiceFormula(parsedDamage!)} + {upcastExtra} die for casting at level {castLevel})
                </span>
              )}
            </span>
          </p>

          {target.saveStat && (
            <p className="flex items-start gap-2">
              <Shield className="w-3.5 h-3.5 mt-0.5 text-sky-300/80 shrink-0" />
              <span>
                <span className="text-white/45">Save: </span>
                {String(target.saveStat).toUpperCase()} save vs DC {resources?.spellSaveDC ?? '—'}
              </span>
            </p>
          )}
        </div>

        {target.rulesText && (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-wide text-white/35 mb-1">Rules text</p>
            <p className="text-[11px] leading-relaxed text-white/55">{target.rulesText}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 min-h-[48px]" onClick={onCancel} style={{ touchAction: 'manipulation' }}>
            Cancel
          </Button>
          <Button
            className="flex-1 min-h-[48px]"
            disabled={blocked}
            onClick={() => onConfirm({ slotLevel: isSpell && !isCantrip ? option?.slotLevel : undefined, usePact: option?.usePact })}
            style={{ touchAction: 'manipulation' }}
          >
            {blocked ? 'No slot available' : 'Roll it'}
          </Button>
        </div>
      </div>
    </div>
  );
}
