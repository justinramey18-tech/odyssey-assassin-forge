import { useMemo, useState } from 'react';
import { Sparkles, Zap, Shield, Dices, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  castSpellByName,
  describeSlotSpend,
  getCastOptions,
  getMagicResources,
  type CastOption,
} from '@/lib/magic/castBus';
import { SPELL_REGISTRY } from '@/lib/magic/spells';
import type { SpellDefinition } from '@/lib/magic/types';
import {
  resolveCast,
  buildCastReceipt,
  summariseCast,
  parseDiceFormula,
  scaleForUpcast,
  formatDiceFormula,
  type CastSpellDefinition,
  type ResolvedCast,
} from '@/lib/magic/castResolver';

export interface CastCardProps {
  spell: CastSpellDefinition | null;
  onClose: () => void;
  /** Receives the factual receipt to stage in the DM composer. */
  onResolved: (receipt: string, resolved: ResolvedCast) => void;
}

/**
 * The cast card. The app is the referee: pick the slot, the app rolls, spends
 * the resource, and hands the DM a receipt of what already happened.
 */
export function CastCard({ spell: rawSpell, onClose, onResolved }: CastCardProps) {
  // Rows that only know a spell's name (the plain prepared-spell list) get
  // filled in from the registry so the cast card still knows its level and dice.
  const spell = useMemo<CastSpellDefinition | null>(() => {
    if (!rawSpell) return null;
    if (Number.isFinite(rawSpell.level)) return rawSpell;
    const wanted = rawSpell.name.trim().toLowerCase();
    const match = (Object.values(SPELL_REGISTRY) as SpellDefinition[]).find(s => s.name.trim().toLowerCase() === wanted);
    if (!match) return rawSpell;
    return {
      ...rawSpell,
      level: match.level,
      school: rawSpell.school ?? match.school,
      description: rawSpell.description ?? match.description,
      attackType: rawSpell.attackType ?? match.attackType,
      saveStat: rawSpell.saveStat ?? match.saveStat,
      damageType: rawSpell.damageType ?? match.damageType,
      damageFormula: rawSpell.damageFormula ?? (match as { damageFormula?: string }).damageFormula,
      healingFormula: rawSpell.healingFormula ?? (match as { healingFormula?: string }).healingFormula,
      concentration: rawSpell.concentration ?? match.concentration,
      duration: rawSpell.duration ?? match.duration,
    };
  }, [rawSpell]);

  const baseLevel = Number.isFinite(spell?.level) ? Number(spell!.level) : 0;
  const resources = useMemo(() => getMagicResources(), [spell]);



  const options = useMemo<CastOption[]>(() => (spell ? getCastOptions(baseLevel) : []), [spell, baseLevel]);

  const [chosen, setChosen] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  if (!spell) return null;

  const isCantrip = baseLevel === 0;
  const option = options[chosen] ?? options[0];
  const castLevel = isCantrip ? 0 : option?.slotLevel ?? baseLevel;

  const previewDamage = (() => {
    const f = parseDiceFormula(spell.damageFormula);
    if (!f) return null;
    return formatDiceFormula(scaleForUpcast(f, baseLevel, castLevel));
  })();
  const previewHealing = (() => {
    const f = parseDiceFormula(spell.healingFormula);
    if (!f) return null;
    return formatDiceFormula(scaleForUpcast(f, baseLevel, castLevel));
  })();

  const canCast = isCantrip || !!option;

  const handleCast = () => {
    if (busy || !canCast) return;
    setBusy(true);

    const outcome = castSpellByName({
      name: spell.name,
      level: baseLevel,
      slotLevel: isCantrip ? undefined : option?.slotLevel,
      usePact: option?.usePact,
    });

    if (!outcome.ok) {
      setBusy(false);
      if (outcome.reason === 'no-slots') toast.error(`No spell slot left for ${spell.name}.`);
      else toast.error(`${spell.name} could not be tracked — cast it from the Arcana tab.`);
      return;
    }

    const resolved = resolveCast(spell, {
      spellAttackBonus: resources?.spellAttackBonus ?? 0,
      spellSaveDC: resources?.spellSaveDC ?? 10,
      castLevel,
    });
    resolved.slotNote = describeSlotSpend(outcome) ?? undefined;

    toast.success(`${spell.name} cast`, { description: summariseCast(resolved) });
    onResolved(buildCastReceipt(resolved, spell), resolved);
    setBusy(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[86] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl border-t border-x border-indigo-400/25 bg-[#0b0a12] p-4 pb-8 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-cinzel text-base text-indigo-200 truncate">{spell.name}</h3>
            <p className="text-[11px] text-white/45">
              {isCantrip ? 'Cantrip' : `Level ${baseLevel}`}
              {spell.school ? ` · ${spell.school}` : ''}
              {spell.isHomebrew ? ' · Homebrew' : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 -m-2 text-white/40" style={{ touchAction: 'manipulation' }} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isCantrip && (
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
                        ? 'border-indigo-400/60 bg-indigo-500/15 text-indigo-100'
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

        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-1.5 text-xs text-white/65">
          {previewDamage && (
            <p className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-orange-300/80" />
              {previewDamage}{spell.damageType ? ` ${spell.damageType}` : ''} damage
            </p>
          )}
          {previewHealing && (
            <p className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-emerald-300/80" />
              {previewHealing} healing
            </p>
          )}
          {spell.saveStat && (
            <p className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-sky-300/80" />
              {String(spell.saveStat).toUpperCase()} save vs DC {resources?.spellSaveDC ?? '—'}
            </p>
          )}
          {(spell.attackType === 'melee' || spell.attackType === 'ranged') && (
            <p className="flex items-center gap-2"><Dices className="w-3.5 h-3.5 text-amber-300/80" />
              Spell attack {(resources?.spellAttackBonus ?? 0) >= 0 ? '+' : ''}{resources?.spellAttackBonus ?? 0}
            </p>
          )}
          {spell.concentration && (
            <p className="text-purple-300/80">
              Concentration
              {resources?.concentratingOn && resources.concentratingOn !== spell.name
                ? ` — this will end ${resources.concentratingOn}`
                : ''}
            </p>
          )}
          {!previewDamage && !previewHealing && !spell.saveStat && (
            <p className="text-white/40">No roll needed — the DM narrates the effect.</p>
          )}
        </div>

        <Button
          className="w-full min-h-[48px]"
          disabled={!canCast || busy}
          onClick={handleCast}
          style={{ touchAction: 'manipulation' }}
        >
          {canCast ? `Cast${!isCantrip && option?.isUpcast ? ` at level ${castLevel}` : ''}` : 'No slot available'}
        </Button>
      </div>
    </div>
  );
}
