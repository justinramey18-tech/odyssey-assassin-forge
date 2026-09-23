import { useMemo, useState } from 'react';
import { Shield, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCastOptions, getMagicResources, type CastOption } from '@/lib/magic/castBus';
import { parseDiceFormula, scaleForUpcast, formatDiceFormula } from '@/lib/magic/castResolver';
import { RIBBON, PILL } from '@/components/ai-dm/chatPlaques';
import arcaneRibbonAsset from '@/assets/rolls/arcane-ribbon.png.asset.json';
const arcaneRibbon = arcaneRibbonAsset.url;
import glyphTargetAsset from '@/assets/rolls/glyph-target.png.asset.json';
const glyphTarget = glyphTargetAsset.url;
import glyphBoltAsset from '@/assets/rolls/glyph-bolt.png.asset.json';
const glyphBolt = glyphBoltAsset.url;
import glyphHourglassAsset from '@/assets/rolls/glyph-hourglass.png.asset.json';
const glyphHourglass = glyphHourglassAsset.url;
import btnCancelAsset from '@/assets/rolls/btn-cancel.png.asset.json';
const btnCancel = btnCancelAsset.url;
import btnRollAsset from '@/assets/rolls/btn-roll.png.asset.json';
const btnRoll = btnRollAsset.url;
import homePillPlaque from '@/assets/home/home-pill-plaque.png.asset.json';
import bagPanelFrame from '@/assets/bag-stats/bag-panel-frame.png';

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

/** Info/rules box framed with the bag panel artwork. */
const PANEL_FRAME = {
  borderStyle: 'solid',
  borderWidth: '12px',
  borderImage: `url(${bagPanelFrame}) 90 fill / 30px stretch`,
} as const;

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
        className="relative w-full max-w-lg rounded-t-2xl border-t border-x border-violet-400/30 bg-[#0b0a12] p-4 pb-8 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          className="absolute top-2 right-2 z-10 p-2 text-white/40"
          style={{ touchAction: 'manipulation' }}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <div
            style={{ ...RIBBON(arcaneRibbon), height: 40, borderWidth: '0 40px', borderImage: `url(${arcaneRibbon}) 0 150 0 150 fill / 0 40px stretch` }}
            className="flex items-center justify-center px-1 font-cinzel text-base tracking-[0.08em] text-violet-50 truncate"
          >
            {target.name}
          </div>
          <p className="mt-1 text-center text-[11px] text-white/45">
            Check the numbers before you roll
          </p>
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
                    style={{
                      ...PILL(homePillPlaque.url),
                      height: 40,
                      borderWidth: '0 20px',
                      borderImage: `url(${homePillPlaque.url}) 0 134 0 134 fill / 0 20px stretch`,
                      touchAction: 'manipulation',
                    }}
                    className={cn(
                      'flex flex-col items-center justify-center px-1 min-h-[48px] text-xs text-amber-50 leading-tight transition-opacity',
                      i === chosen ? 'drop-shadow-[0_0_10px_rgba(251,191,36,0.55)]' : 'opacity-55',
                    )}
                  >
                    <span className="block">
                      {o.usePact ? `Pact Lv ${o.slotLevel}` : `Level ${o.slotLevel}`}
                      {o.isUpcast && <span className="ml-1 text-amber-300/80">upcast</span>}
                    </span>
                    <span className="block text-[10px] text-white/40">
                      <img src={glyphHourglass} alt="" className="inline w-2.5 h-2.5 mr-0.5 -mt-px" />
                      {o.remaining} left
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={PANEL_FRAME} className="px-2.5 py-1.5 space-y-2 text-xs text-white/70">
          <p className="flex items-start gap-2">
            <img src={glyphTarget} alt="" className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              <span className="text-white/45">To hit: </span>
              1d20 {attackBonus >= 0 ? '+' : '−'} {Math.abs(attackBonus)}
              <span className="text-white/40">
                {' '}({isSpell ? 'spell attack bonus' : 'attack bonus'} from your sheet), compared to the target's AC
              </span>
            </span>
          </p>

          <p className="flex items-start gap-2">
            <img src={glyphBolt} alt="" className="w-4 h-4 mt-0.5 shrink-0" />
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
          <div style={PANEL_FRAME} className="px-2.5 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-white/35 mb-1">Rules text</p>
            <p className="font-story text-[13px] leading-relaxed text-white/70">{target.rulesText}</p>
          </div>
        )}

        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              aria-label="Cancel"
              className="flex-1 min-h-[48px] flex items-center justify-center active:scale-95 transition-transform"
              style={{ touchAction: 'manipulation' }}
            >
              <img src={btnCancel} alt="" draggable={false} className="h-12 w-auto" />
            </button>
            <button
              disabled={blocked}
              onClick={() => onConfirm({ slotLevel: isSpell && !isCantrip ? option?.slotLevel : undefined, usePact: option?.usePact })}
              aria-label="Roll it"
              className="flex-1 min-h-[48px] flex items-center justify-center active:scale-95 transition-transform"
              style={{ touchAction: 'manipulation' }}
            >
              <img src={btnRoll} alt="" draggable={false} className={cn('h-[68px] -my-2.5 w-auto', blocked && 'grayscale opacity-40')} />
            </button>
          </div>
          {blocked && <p className="text-center text-[11px] text-red-300/80">No slot available</p>}
        </div>
      </div>
    </div>
  );
}
