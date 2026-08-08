// Equipment bonus breakdown — shows exactly which equipped piece gives what.
// Pure presentation: every number here is already computed by
// use-equipment-stats and use-combat-stats. Nothing is recalculated.

import { useState } from 'react';
import { ChevronDown, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CharacterEquipment, EquipmentSlotType, EquipmentItem, equipmentSlotDefinitions } from '@/lib/inventory/types';
import { AggregatedStats } from '@/hooks/use-equipment-stats';
import { CombatStats } from '@/hooks/use-combat-stats';
import { computeEncumbrance } from '@/lib/inventory/encumbrance';

/** Serializable snapshot so the in-DM sheet can render this without hooks. */
export interface GearBonusData {
  items: Array<{ slot: string; name: string; lines: string[] }>;
  ac: { base: number; gear: number; dex: number; abilities: number; total: number };
  attack: { proficiency: number; ability: number; gear: number; abilities: number; total: number };
  damage: { ability: number; abilities: number; total: number; dice?: string | null };
  scores: Array<{ label: string; value: number }>;
  other: Array<{ label: string; value: string }>;
  setBonuses: Array<{ setName: string; bonus: string; piecesActive: number; piecesTotal: number }>;
  load: { equipped: number; carried: number; total: number; capacity: number; label: string; colorClass: string };
}

const SLOT_LABELS: Record<string, string> = Object.fromEntries(
  equipmentSlotDefinitions.map(s => [s.type, s.label.toLowerCase()])
);

const STAT_LABELS: Record<string, string> = {
  ac: 'AC',
  attackBonus: 'attack',
  perception: 'Perception',
  saves: 'saves',
  movement: 'movement',
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
};

function sign(n: number) {
  return n >= 0 ? `+${n}` : `${n}`;
}

function itemLines(item: EquipmentItem): string[] {
  const lines: string[] = [];
  Object.entries(item.stats || {}).forEach(([key, raw]) => {
    if (key === 'damage') {
      if (typeof raw === 'string' && raw.trim()) lines.push(`${raw} damage`);
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value === 0) return;
    const label = STAT_LABELS[key] || key;
    lines.push(key === 'movement' ? `${sign(value)} ft. movement` : `${sign(value)} ${label}`);
  });
  return lines;
}

export function buildGearBonusData(
  equipment: CharacterEquipment | undefined,
  stats: AggregatedStats,
  combat: CombatStats,
  strengthScore: number
): GearBonusData {
  const items: GearBonusData['items'] = [];
  if (equipment?.slots) {
    (Object.entries(equipment.slots) as Array<[EquipmentSlotType, EquipmentItem | null]>).forEach(([slot, item]) => {
      if (!item) return;
      const lines = itemLines(item);
      if (lines.length === 0) return; // hide gear that changes nothing
      items.push({ slot: SLOT_LABELS[slot] || slot, name: item.name, lines });
    });
  }

  const b = combat.breakdown;
  const scores: GearBonusData['scores'] = ([
    ['STR', stats.strength], ['DEX', stats.dexterity], ['CON', stats.constitution],
    ['INT', stats.intelligence], ['WIS', stats.wisdom], ['CHA', stats.charisma],
  ] as Array<[string, number]>)
    .filter(([, v]) => Number.isFinite(v) && v !== 0)
    .map(([label, value]) => ({ label, value }));

  const other: GearBonusData['other'] = [];
  if (stats.perception) other.push({ label: 'Perception', value: sign(stats.perception) });
  if (stats.saves) other.push({ label: 'Saves', value: sign(stats.saves) });
  if (stats.movement) other.push({ label: 'Movement', value: `${sign(stats.movement)} ft.` });

  const enc = computeEncumbrance(stats.totalLoad, strengthScore);

  return {
    items,
    ac: { base: b.baseAC, gear: b.acFromGear, dex: b.dexModifier, abilities: b.acFromAbilities, total: combat.ac },
    attack: {
      proficiency: combat.proficiencyBonus,
      ability: Math.max(b.dexModifier, b.strModifier),
      gear: b.attackFromGear,
      abilities: b.attackFromAbilities,
      total: combat.attackBonus,
    },
    damage: {
      ability: Math.max(b.dexModifier, b.strModifier),
      abilities: b.damageFromAbilities,
      total: combat.damageBonus,
      dice: stats.damage,
    },
    scores,
    other,
    setBonuses: stats.activeSetBonuses.filter(s => s.bonus),
    load: {
      equipped: stats.totalWeight,
      carried: stats.carriedWeight,
      total: stats.totalLoad,
      capacity: enc.capacity,
      label: enc.label,
      colorClass: enc.colorClass,
    },
  };
}

function Part({ value, label }: { value: number; label: string }) {
  if (!value) return null;
  return (
    <span className="text-muted-foreground">
      {' '}
      {sign(value)} <span className="opacity-60">{label}</span>
    </span>
  );
}

function Row({ title, children, total }: { title: string; children: React.ReactNode; total: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px] py-1 border-b border-border/40 last:border-0">
      <div className="min-w-0">
        <span className="text-foreground/80">{title}</span>
        <span className="ml-1">{children}</span>
      </div>
      <span className="font-display text-sm text-primary shrink-0">{total}</span>
    </div>
  );
}

export function GearBonusBreakdown({ data, className }: { data: GearBonusData; className?: string }) {
  const [open, setOpen] = useState(false);

  const hasAnything =
    data.items.length > 0 || data.scores.length > 0 || data.other.length > 0 || data.setBonuses.length > 0;

  return (
    <div className={cn('rounded-xl border border-border/60 bg-card/40 overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ touchAction: 'manipulation' }}
        className="w-full min-h-[48px] px-3 flex items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary/80" />
          <span className="text-xs font-cinzel tracking-wide text-foreground">Equipment Bonuses</span>
        </span>
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          {data.items.length > 0 && <span>{data.items.length} items</span>}
          <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
        </span>
      </button>

      <div className="px-3 pb-3">
        <Row title="Armor Class" total={`${data.ac.total}`}>
          <span className="text-muted-foreground">{data.ac.base} base</span>
          <Part value={data.ac.gear} label="gear" />
          <Part value={data.ac.dex} label="DEX" />
          <Part value={data.ac.abilities} label="abilities" />
        </Row>

        <Row title="Attack" total={sign(data.attack.total)}>
          <span className="text-muted-foreground">{sign(data.attack.proficiency)} <span className="opacity-60">prof</span></span>
          <Part value={data.attack.ability} label="ability" />
          <Part value={data.attack.gear} label="gear" />
          <Part value={data.attack.abilities} label="abilities" />
        </Row>

        <Row title="Damage" total={`${data.damage.dice ? `${data.damage.dice} ` : ''}${sign(data.damage.total)}`}>
          <Part value={data.damage.ability} label="ability" />
          <Part value={data.damage.abilities} label="abilities" />
        </Row>

        {(data.scores.length > 0 || data.other.length > 0) && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {data.scores.map(s => (
              <span key={s.label} className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 bg-muted/30 text-foreground/80">
                {s.label} {sign(s.value)}
              </span>
            ))}
            {data.other.map(o => (
              <span key={o.label} className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 bg-muted/30 text-foreground/80">
                {o.label} {o.value}
              </span>
            ))}
          </div>
        )}

        {data.setBonuses.map(s => (
          <p key={s.setName} className="text-[10px] text-primary/80 pt-2">
            Set bonus: {s.setName} ({s.piecesActive}/{s.piecesTotal}) — {s.bonus}
          </p>
        ))}

        <p className="text-[10px] text-muted-foreground pt-2">
          Carried {Math.round(data.load.total)} / {data.load.capacity} lb
          <span className={cn('ml-1', data.load.colorClass)}>· {data.load.label}</span>
          <span className="opacity-60"> (worn {Math.round(data.load.equipped)}, bag {Math.round(data.load.carried)})</span>
        </p>

        {open && (
          <div className="mt-3 pt-2 border-t border-border/40 space-y-1.5">
            {data.items.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No equipped item is granting a bonus.</p>
            ) : (
              data.items.map((it, i) => (
                <div key={`${it.name}-${i}`} className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] text-foreground/90 min-w-0 truncate">
                    {it.name} <span className="text-muted-foreground opacity-70">({it.slot})</span>
                  </span>
                  <span className="text-[10px] text-primary/80 shrink-0 text-right">{it.lines.join(', ')}</span>
                </div>
              ))
            )}
          </div>
        )}

        {!hasAnything && (
          <p className="text-[10px] text-muted-foreground pt-2">Equip gear to see its contributions here.</p>
        )}
      </div>
    </div>
  );
}
