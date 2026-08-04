import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Heart, Activity, Shield, Coins, Zap, Backpack, BookOpen, Sparkles,
  Plus, Minus, ChevronUp, ExternalLink, Moon, Sun, Trash2, PackageCheck, PackageX, Scroll,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CharacterContext } from '@/components/oracle/types';
import { useXPProgression } from '@/hooks/use-xp-progression';
import { useXPSnapshot } from '@/hooks/use-xp-snapshot';
import { useCharacterIdentity } from '@/hooks/use-character-identity';
import {
  PendingDmItem, loadPendingDmItems, removePendingDmItem, PENDING_DM_ITEMS_EVENT,
} from '@/lib/pendingDmItems';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export type SheetTab = 'vitals' | 'stats' | 'abilities' | 'items' | 'story';

const TABS: Array<{ id: SheetTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'vitals', label: 'Vitals', icon: Heart },
  { id: 'stats', label: 'Stats', icon: Activity },
  { id: 'abilities', label: 'Abilities', icon: Zap },
  { id: 'items', label: 'Items', icon: Backpack },
  { id: 'story', label: 'Story', icon: BookOpen },
];

export interface SoloCharacterSheetProps {
  open: boolean;
  onClose: () => void;
  ctx: CharacterContext;
  currentXP: number;
  gold: number;
  quests?: Array<{ key: string; status: string; notes?: string }>;
  onAdjustHP?: (change: number, type: 'damage' | 'healing') => void;
  onAddXP?: (amount: number, source: string) => void;
  onManualLevelUp?: () => void;
  onConditionChange?: (toAdd: string[], toRemove: string[]) => void;
  onRest?: (type: 'short' | 'long') => void;
  onAcceptItem?: (name: string, quantity: number) => void;
  onUseConsumableByName?: (name: string) => void;
}

function navigateToTab(tab: string) {
  window.dispatchEvent(new CustomEvent('odyssey-navigate-tab', { detail: tab }));
}

function Section({ title, icon: Icon, children, action }: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.03]">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-amber-400/80 shrink-0" />}
          <span className="text-xs font-cinzel tracking-wide text-foreground truncate">{title}</span>
        </div>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

export function SoloCharacterSheet({
  open, onClose, ctx, currentXP, gold, quests = [],
  onAdjustHP, onAddXP, onManualLevelUp, onConditionChange, onRest, onAcceptItem, onUseConsumableByName,
}: SoloCharacterSheetProps) {
  const [tab, setTab] = useState<SheetTab>('vitals');
  const [hpDelta, setHpDelta] = useState('');
  const [xpDelta, setXpDelta] = useState('');
  const [pending, setPending] = useState<PendingDmItem[]>([]);
  const { multiplier } = useXPProgression();
  const identity = useCharacterIdentity();
  const [newRelName, setNewRelName] = useState('');
  const [newRelDisp, setNewRelDisp] = useState('');

  useEffect(() => {
    const refresh = () => setPending(loadPendingDmItems());
    refresh();
    window.addEventListener(PENDING_DM_ITEMS_EVENT, refresh);
    window.addEventListener('odyssey-character-loaded', refresh);
    return () => {
      window.removeEventListener(PENDING_DM_ITEMS_EVENT, refresh);
      window.removeEventListener('odyssey-character-loaded', refresh);
    };
  }, []);

  const isMilestone = multiplier === 0;
  const hpPct = ctx.maxHP > 0 ? Math.max(0, Math.min(100, (ctx.currentHP / ctx.maxHP) * 100)) : 0;

  const xpSnapshot = useXPSnapshot(ctx.level, currentXP);
  const xpInfo = useMemo(() => {
    if (isMilestone) return null;
    return {
      floor: xpSnapshot.levelFloor,
      ceil: xpSnapshot.nextLevelXP,
      belowFloor: xpSnapshot.belowFloor,
      inLevel: xpSnapshot.xpIntoLevel,
      needed: xpSnapshot.xpLevelSpan,
      progress: xpSnapshot.progressPct,
      toNext: xpSnapshot.xpRemaining,
    };
  }, [xpSnapshot, isMilestone]);

  const applyHP = useCallback((type: 'damage' | 'healing') => {
    const amount = parseInt(hpDelta, 10);
    if (!Number.isFinite(amount) || amount <= 0) return;
    onAdjustHP?.(type === 'damage' ? -amount : amount, type);
    setHpDelta('');
  }, [hpDelta, onAdjustHP]);

  const applyXP = useCallback(() => {
    const amount = parseInt(xpDelta, 10);
    if (!Number.isFinite(amount) || amount <= 0) return;
    onAddXP?.(amount, 'Character sheet adjustment');
    setXpDelta('');
  }, [xpDelta, onAddXP]);

  const acceptItem = useCallback((item: PendingDmItem) => {
    onAcceptItem?.(item.name, item.quantity);
    setPending(removePendingDmItem(item.id));
    toast.success(`${item.name} added to your loot`);
  }, [onAcceptItem]);

  const discardItem = useCallback((item: PendingDmItem) => {
    setPending(removePendingDmItem(item.id));
  }, []);

  if (!open) return null;

  const scores = ctx.abilityScores;

  const body = (
    <div className="fixed inset-0 z-[80] flex flex-col bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-amber-900/30 bg-black/50 backdrop-blur-sm">
        <div className="min-w-0">
          <p className="text-sm font-cinzel text-foreground truncate">{ctx.name || 'Adventurer'}</p>
          <p className="text-[11px] text-white/50 truncate">
            Level {ctx.level}
            {ctx.characterClass ? ` ${ctx.characterClass}` : ''}
            {ctx.subclass ? ` · ${ctx.subclass}` : ''}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close character sheet"
          className="p-2 rounded-lg hover:bg-white/10 min-w-[48px] min-h-[48px] flex items-center justify-center"
          style={{ touchAction: 'manipulation' }}
        >
          <X className="w-5 h-5 text-white/80" />
        </button>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex overflow-x-auto scrollbar-hide border-b border-white/10 bg-black/30">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          const badge = t.id === 'items' && pending.length > 0 ? pending.length : 0;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'relative flex-1 min-w-[72px] min-h-[48px] flex flex-col items-center justify-center gap-0.5 px-2 transition-colors',
                active ? 'text-amber-300 bg-amber-500/10' : 'text-white/50 hover:text-white/80'
              )}
              style={{ touchAction: 'manipulation' }}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-body">{t.label}</span>
              {badge > 0 && (
                <span className="absolute top-1 right-2 text-[9px] px-1 rounded-full bg-amber-500 text-black font-bold">{badge}</span>
              )}
              {active && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-amber-400 rounded-full" />}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-3 pb-24">
        {tab === 'vitals' && (
          <>
            <Section title="Hit Points" icon={Heart}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-2xl font-display font-bold text-foreground">{ctx.currentHP}</span>
                <span className="text-xs text-white/50">/ {ctx.maxHP} max</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden mb-3">
                <div
                  className={cn('h-full rounded-full transition-all', hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-500' : 'bg-red-500')}
                  style={{ width: `${hpPct}%` }}
                />
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="Amount"
                  value={hpDelta}
                  onChange={e => setHpDelta(e.target.value)}
                  className="flex-1 min-h-[48px]"
                />
                <Button variant="outline" className="min-h-[48px] gap-1" onClick={() => applyHP('damage')}>
                  <Minus className="w-4 h-4" /> Damage
                </Button>
                <Button variant="outline" className="min-h-[48px] gap-1" onClick={() => applyHP('healing')}>
                  <Plus className="w-4 h-4" /> Heal
                </Button>
              </div>
            </Section>

            <Section
              title="Purse & Standing"
              icon={Shield}
              action={
                <button onClick={() => { onClose(); navigateToTab('shop'); }} className="text-[10px] text-amber-300 flex items-center gap-1 min-h-[44px] px-1" style={{ touchAction: 'manipulation' }}>
                  Inventory tab <ExternalLink className="w-3 h-3" />
                </button>
              }
            >

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-white/40 flex items-center gap-1">
                    <Coins className="w-3 h-3" /> Gold
                  </p>
                  <p className="text-xl font-display font-bold text-amber-300">{gold.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-white/40">Level</p>
                  <p className="text-xl font-display font-bold text-foreground">{ctx.level}</p>
                </div>
              </div>
            </Section>

            <Section title="Conditions" icon={Activity}>
              {(!ctx.activeConditions || ctx.activeConditions.length === 0) ? (
                <p className="text-xs text-white/40 text-center py-2">No active conditions.</p>
              ) : (
                <div className="space-y-2">
                  {ctx.activeConditions.map(c => (
                    <div key={c.name} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs text-foreground truncate">{c.name}</p>
                        <p className="text-[10px] text-white/40">
                          {c.remainingRounds > 0 ? `${c.remainingRounds} rounds left` : 'Until removed'}
                          {c.source ? ` · ${c.source}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => onConditionChange?.([], [c.name])}
                        className="p-2 rounded-lg hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        aria-label={`Remove ${c.name}`}
                        style={{ touchAction: 'manipulation' }}
                      >
                        <Trash2 className="w-4 h-4 text-red-400/80" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {ctx.activeBuffs && ctx.activeBuffs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {ctx.activeBuffs.map(b => (
                    <Badge key={b.name} variant="outline" className="text-[10px]">
                      {b.name}{b.concentration ? ' (conc.)' : ''}
                    </Badge>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Rest" icon={Moon}>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 min-h-[48px] gap-1.5" onClick={() => onRest?.('short')}>
                  <Sun className="w-4 h-4" /> Short Rest
                </Button>
                <Button variant="outline" className="flex-1 min-h-[48px] gap-1.5" onClick={() => onRest?.('long')}>
                  <Moon className="w-4 h-4" /> Long Rest
                </Button>
              </div>
            </Section>
          </>
        )}

        {tab === 'stats' && (
          <>
            <Section title="Progression" icon={Activity}>
              {isMilestone ? (
                <p className="text-xs text-white/50 mb-3">Milestone progression — the story decides when you advance.</p>
              ) : xpInfo && (
                <>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/50">Experience</span>
                    <span className="font-display">
                      <span className="text-amber-300">{xpInfo.inLevel.toLocaleString()}</span>
                      <span className="text-white/40"> / {xpInfo.needed.toLocaleString()}</span>
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${xpInfo.progress}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-white/40 mt-1">
                    <span>Total {currentXP.toLocaleString()} XP</span>
                    <span>{xpInfo.toNext.toLocaleString()} XP to next</span>
                  </div>
                  {xpInfo.belowFloor && (
                    <p className="mt-2 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1.5">
                      Level set manually — your total XP is below level {ctx.level}'s threshold of {xpInfo.floor.toLocaleString()} XP, so this bar stays empty until you catch up.
                    </p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      placeholder="Add XP"
                      value={xpDelta}
                      onChange={e => setXpDelta(e.target.value)}
                      className="flex-1 min-h-[48px]"
                    />
                    <Button variant="outline" className="min-h-[48px]" onClick={applyXP}>Award</Button>
                  </div>
                </>
              )}
              {onManualLevelUp && (
                <Button variant="outline" className="w-full mt-3 min-h-[48px] gap-1.5 border-primary/30" onClick={onManualLevelUp}>
                  <ChevronUp className="w-4 h-4 text-primary" /> Advance a Level
                </Button>
              )}
            </Section>

            <Section title="Ability Scores" icon={Sparkles}>
              {!scores ? (
                <p className="text-xs text-white/40 text-center py-2">No ability scores recorded.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(scores) as Array<[string, { base: number; modifier: number; final: number }]>).map(([name, s]) => (
                    <div key={name} className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-center">
                      <p className="text-[9px] uppercase tracking-wider text-white/40">{name.slice(0, 3)}</p>
                      <p className="text-lg font-display font-bold text-foreground leading-none">{s.final}</p>
                      <p className="text-[10px] text-amber-300/80">{s.modifier >= 0 ? '+' : ''}{s.modifier}</p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {ctx.multiclassBreakdown && Object.keys(ctx.multiclassBreakdown).length > 0 && (
              <Section title="Classes" icon={BookOpen}>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(ctx.multiclassBreakdown).map(([cls, lvl]) => (
                    <Badge key={cls} variant="outline" className="text-[10px] capitalize">{cls} {lvl}</Badge>
                  ))}
                </div>
              </Section>
            )}

            {ctx.prestigeLevel > 0 && (
              <Section title="Prestige" icon={Sparkles}>
                <p className="text-xs text-white/60">Prestige Level {ctx.prestigeLevel}</p>
                {ctx.prestigeAbilities?.length > 0 && (
                  <p className="text-[11px] text-white/40 mt-1">{ctx.prestigeAbilities.join(', ')}</p>
                )}
              </Section>
            )}
          </>
        )}

        {tab === 'abilities' && (
          <>
            <Section
              title="Equipped Loadout"
              icon={Zap}
              action={
                <button onClick={() => { onClose(); navigateToTab('abilities'); }} className="text-[10px] text-amber-300 flex items-center gap-1 min-h-[44px] px-1" style={{ touchAction: 'manipulation' }}>
                  Abilities tab <ExternalLink className="w-3 h-3" />
                </button>
              }
            >
              {ctx.equippedAbilities.length === 0 ? (
                <p className="text-xs text-white/40 text-center py-2">Nothing equipped yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {ctx.equippedAbilities.map(a => (
                    <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Unlocked Abilities" icon={Sparkles}>
              {ctx.abilities.length === 0 ? (
                <p className="text-xs text-white/40 text-center py-2">No abilities unlocked.</p>
              ) : (
                <div className="space-y-1.5">
                  {ctx.abilities.map(a => (
                    <div key={`${a.tree}-${a.name}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <span className="text-xs text-foreground truncate">{a.name}</span>
                      <span className="text-[10px] text-white/40 shrink-0 capitalize">{a.tree} · Tier {a.tier}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {ctx.spellcasting?.path && (
              <Section
                title="Magic"
                icon={Sparkles}
                action={
                  <button onClick={() => { onClose(); navigateToTab('arcana'); }} className="text-[10px] text-amber-300 flex items-center gap-1 min-h-[44px] px-1" style={{ touchAction: 'manipulation' }}>
                    Arcana tab <ExternalLink className="w-3 h-3" />
                  </button>
                }
              >
                <div className="space-y-1 text-xs text-white/60">
                  <p>Spell attack {ctx.spellcasting.spellAttackBonus >= 0 ? '+' : ''}{ctx.spellcasting.spellAttackBonus} · Save DC {ctx.spellcasting.spellSaveDC}</p>
                  <p>{ctx.spellcasting.totalSlotsRemaining} slots remaining</p>
                  {ctx.spellcasting.concentratingOn && <p className="text-purple-300">Concentrating on {ctx.spellcasting.concentratingOn}</p>}
                  {ctx.spellcasting.preparedSpells?.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {ctx.spellcasting.preparedSpells.map(s => (
                        <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            )}

            <Section title="Cooldowns" icon={Activity}>
              {ctx.cooldowns.active.length === 0 ? (
                <p className="text-xs text-white/40 text-center py-2">Everything is ready.</p>
              ) : (
                <div className="space-y-1.5">
                  {ctx.cooldowns.active.map(c => (
                    <div key={c.name} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <span className="text-xs text-foreground truncate">{c.name}</span>
                      <span className="text-[10px] text-amber-300">{Math.ceil(c.remainingSeconds / 60)}m left</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}

        {tab === 'items' && (
          <>
            {pending.length > 0 && (
              <Section title={`Awarded by the DM (${pending.length})`} icon={PackageCheck}>
                <div className="space-y-2">
                  {pending.map(item => (
                    <div key={item.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                      <p className="text-xs text-foreground">{item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}</p>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline" className="flex-1 min-h-[44px] gap-1" onClick={() => acceptItem(item)}>
                          <PackageCheck className="w-3.5 h-3.5" /> Accept
                        </Button>
                        <Button size="sm" variant="ghost" className="flex-1 min-h-[44px] gap-1" onClick={() => discardItem(item)}>
                          <PackageX className="w-3.5 h-3.5" /> Discard
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section
              title="Equipment"
              icon={Shield}
              action={
                <button onClick={() => { onClose(); navigateToTab('gear'); }} className="text-[10px] text-amber-300 flex items-center gap-1 min-h-[44px] px-1" style={{ touchAction: 'manipulation' }}>
                  Gear tab <ExternalLink className="w-3 h-3" />
                </button>
              }
            >
              {ctx.equipment.length === 0 ? (
                <p className="text-xs text-white/40 text-center py-2">Nothing equipped.</p>
              ) : (
                <div className="space-y-1.5">
                  {ctx.equipment.map(e => (
                    <div key={`${e.slot}-${e.name}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <span className="text-xs text-foreground truncate">{e.name}</span>
                      <span className="text-[10px] text-white/40 capitalize shrink-0">{e.slot} · {e.rarity}</span>
                    </div>
                  ))}
                </div>
              )}
              {ctx.activeSetBonuses?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {ctx.activeSetBonuses.map(b => <Badge key={b} variant="outline" className="text-[10px]">{b}</Badge>)}
                </div>
              )}
            </Section>

            <Section
              title="Consumables"
              icon={Backpack}
              action={
                <button onClick={() => { onClose(); navigateToTab('consumables'); }} className="text-[10px] text-amber-300 flex items-center gap-1 min-h-[44px] px-1" style={{ touchAction: 'manipulation' }}>
                  Items tab <ExternalLink className="w-3 h-3" />
                </button>
              }
            >
              {ctx.consumables.length === 0 ? (
                <p className="text-xs text-white/40 text-center py-2">No consumables carried.</p>
              ) : (
                <div className="space-y-1.5">
                  {ctx.consumables.map(c => (
                    <div key={c.name} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs text-foreground truncate">{c.name}</p>
                        <p className="text-[10px] text-white/40 capitalize">{c.type} · ×{c.quantity}</p>
                      </div>
                      {onUseConsumableByName && (
                        <Button size="sm" variant="outline" className="min-h-[44px]" onClick={() => onUseConsumableByName(c.name)}>Use</Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Loot" icon={Coins}>
              {!ctx.loot || ctx.loot.items.length === 0 ? (
                <p className="text-xs text-white/40 text-center py-2">No loot recovered yet.</p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    {ctx.loot.items.map(i => (
                      <div key={i.name} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                        <span className="text-xs text-foreground truncate">{i.name}</span>
                        <span className="text-[10px] text-white/40 capitalize shrink-0">{i.rarity} · {i.goldValue}g</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/40 mt-2">Total value {ctx.loot.totalValue.toLocaleString()} gold</p>
                </>
              )}
            </Section>
          </>
        )}

        {tab === 'story' && (
          <>
            <Section title="Backstory" icon={BookOpen}>
              <Textarea
                value={identity.backstory}
                onChange={e => identity.setBackstory(e.target.value.slice(0, 4000))}
                placeholder="Who is your character, and what brought them here? The DM reads this."
                className="w-full min-h-[140px] text-xs"
              />
              <p className="text-[10px] text-white/40 mt-1 text-right">{identity.backstory.length}/4000</p>
            </Section>

            <Section title="Relationships" icon={Sparkles}>
              {identity.relationships.length === 0 ? (
                <p className="text-xs text-white/40 text-center py-2">No relationships recorded.</p>
              ) : (
                <div className="space-y-2">
                  {identity.relationships.map(r => (
                    <div key={r.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-foreground truncate">{r.name}</p>
                        <button
                          onClick={() => identity.removeRelationship(r.id)}
                          aria-label={`Remove ${r.name}`}
                          className="p-2 rounded-lg hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
                          style={{ touchAction: 'manipulation' }}
                        >
                          <Trash2 className="w-4 h-4 text-red-400/80" />
                        </button>
                      </div>
                      <Input
                        value={r.disposition}
                        onChange={e => identity.updateRelationship(r.id, { disposition: e.target.value })}
                        placeholder="Disposition (ally, rival, lover...)"
                        className="mt-1 min-h-[44px] text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 space-y-2">
                <Input value={newRelName} onChange={e => setNewRelName(e.target.value)} placeholder="Name" className="min-h-[48px] text-xs" />
                <Input value={newRelDisp} onChange={e => setNewRelDisp(e.target.value)} placeholder="Disposition" className="min-h-[48px] text-xs" />
                <Button
                  variant="outline"
                  className="w-full min-h-[48px]"
                  disabled={!newRelName.trim()}
                  onClick={() => {
                    const ok = identity.addRelationship(newRelName.trim(), newRelDisp.trim() || 'neutral');
                    if (!ok) toast.error('Relationship limit reached');
                    setNewRelName('');
                    setNewRelDisp('');
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Relationship
                </Button>
              </div>
            </Section>

            <Section title="Quests" icon={Scroll}>
              {quests.length === 0 ? (
                <p className="text-xs text-white/40 text-center py-2">No quests tracked yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {quests.map(q => (
                    <div key={q.key} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-foreground truncate">{q.key}</span>
                        <Badge variant="outline" className="text-[10px] capitalize shrink-0">{q.status}</Badge>
                      </div>
                      {q.notes && <p className="text-[10px] text-white/40 mt-1">{q.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Identity" icon={BookOpen}>
              <div className="space-y-2">
                <Input value={identity.gender} onChange={e => identity.setGender(e.target.value)} placeholder="Gender" className="min-h-[48px] text-xs" />
                <Input value={identity.race} onChange={e => identity.setRace(e.target.value)} placeholder="Race / ancestry" className="min-h-[48px] text-xs" />
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
