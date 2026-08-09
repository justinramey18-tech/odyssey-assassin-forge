import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Heart, Activity, Shield, Coins, Zap, Backpack, BookOpen, Sparkles, Mic2,
  Plus, Minus, ChevronUp, ExternalLink, Moon, Sun, Trash2, PackageCheck, PackageX, Scroll, Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Quest, WorldStateEntry } from '@/lib/quests';
import { QuestBoard } from './QuestBoard';
import { CharacterContext } from '@/components/oracle/types';
import { useXPProgression } from '@/hooks/use-xp-progression';
import { useXPSnapshot } from '@/hooks/use-xp-snapshot';
import { useCharacterIdentity } from '@/hooks/use-character-identity';
import {
  PendingDmItem, loadPendingDmItems, removePendingDmItem, PENDING_DM_ITEMS_EVENT,
} from '@/lib/pendingDmItems';
import { setSheetReturn, type SheetReturnOrigin } from '@/lib/sheetReturn';
import { buildLootUseText } from '@/lib/loot/prompts';
import { GearBonusBreakdown } from '@/components/character/GearBonusBreakdown';
import { VoicesTab } from '@/components/character/VoicesTab';
import type { CastSpellDefinition } from '@/lib/magic/castResolver';
import { CastCard } from '@/components/magic/CastCard';
import { RestPreviewSheet } from '@/components/magic/RestPreviewSheet';
import {
  MAX_SHORT_RESTS, SHORT_REST_EVENT, getShortRestsRemaining, spendShortRest, refillShortRests,
} from '@/lib/restTracker';



import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export type SheetTab = 'vitals' | 'stats' | 'abilities' | 'items' | 'voices' | 'story';

const TABS: Array<{ id: SheetTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'vitals', label: 'Vitals', icon: Heart },
  { id: 'stats', label: 'Stats', icon: Activity },
  { id: 'abilities', label: 'Abilities', icon: Zap },
  { id: 'items', label: 'Items', icon: Backpack },
  { id: 'voices', label: 'Voices', icon: Mic2 },
  { id: 'story', label: 'Story', icon: BookOpen },
];

export interface SoloCharacterSheetProps {
  open: boolean;
  onClose: () => void;
  ctx: CharacterContext;
  currentXP: number;
  gold: number;
  /** Quest board entries: offers from the DM plus everything already accepted. */
  quests?: Quest[];
  /** Accept an offered quest so the DM starts tracking it. */
  onAcceptQuest?: (key: string) => void;
  /** Turn down an offered quest and clear it from the board. */
  onDeclineQuest?: (key: string) => void;
  /** Re-read the DM's latest response and pull quests out of it. */
  onScanQuests?: () => void;
  scanningQuests?: boolean;
  /** Irreversible story outcomes shown on the quest board. */
  worldState?: WorldStateEntry[];

  onAdjustHP?: (change: number, type: 'damage' | 'healing') => void;
  onAddXP?: (amount: number, source: string) => void;
  onManualLevelUp?: () => void;
  onConditionChange?: (toAdd: string[], toRemove: string[]) => void;
  onRest?: (type: 'short' | 'long') => void;
  /** Send the short "I take a rest" line straight to the DM, like a consumable does. */
  onRestPrompt?: (text: string) => void;
  onAcceptItem?: (name: string, quantity: number, details?: { goldValue?: number; description?: string; rarity?: string; category?: string; effect?: string; dice?: string }) => void;
  onUseConsumableByName?: (name: string) => void;
  /** Stage a loot-use sentence into the DM composer, e.g. "I use the Ember Lantern to heal (2d8)." */
  onUseLootItem?: (text: string) => void;
  /** Open the sheet on a specific tab, used when restoring after a tab jump */
  initialTab?: SheetTab;
  /** Which DM screen this sheet is rendered in. Controls where the return button sends the player. */
  origin?: SheetReturnOrigin;
  /** Party mode only: open the read-only roster of teammates' sheets. */
  onViewPartySheets?: () => void;
  /** Number of other players whose sheets can be viewed. */
  partySheetCount?: number;
  /** NPC names spotted in the story, offered as one-tap voice-cast entries. */
  npcSuggestions?: string[];
}

function navigateToTab(appTab: string, sheetTab: SheetTab, origin: SheetReturnOrigin = 'solo') {
  // Remember which sheet tab we left from AND which DM we were in, so the
  // floating return button restores the right campaign in one tap.
  setSheetReturn(sheetTab, appTab, origin);
  window.dispatchEvent(new CustomEvent('odyssey-navigate-tab', { detail: appTab }));
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
  open, onClose, ctx, currentXP, gold, quests = [], onAcceptQuest, onDeclineQuest, onScanQuests, scanningQuests, worldState = [],
  onAdjustHP, onAddXP, onManualLevelUp, onConditionChange, onRest, onRestPrompt, onAcceptItem, onUseConsumableByName, onUseLootItem,
  initialTab,
  origin = 'solo',
  onViewPartySheets, partySheetCount = 0,
  npcSuggestions = [],
}: SoloCharacterSheetProps) {
  const [tab, setTab] = useState<SheetTab>('vitals');
  const [hpDelta, setHpDelta] = useState('');
  const [xpDelta, setXpDelta] = useState('');
  const [pending, setPending] = useState<PendingDmItem[]>([]);
  /** Which ability/spell row is expanded in the Abilities tab. Keys: "ability:<tree>-<name>" / "spell:<name>" */
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);
  /** The spell the cast card is currently open for. */
  const [castTarget, setCastTarget] = useState<CastSpellDefinition | null>(null);
  /** Which rest the player is previewing before confirming. */
  const [restPreview, setRestPreview] = useState<'short' | 'long' | null>(null);
  /** Short rests still available before a long rest is required (3 per long rest). */
  const [shortRestsLeft, setShortRestsLeft] = useState<number>(() => getShortRestsRemaining());

  // Keep the pool in step with character switches and changes made elsewhere.
  useEffect(() => {
    const sync = () => setShortRestsLeft(getShortRestsRemaining());
    sync();
    window.addEventListener(SHORT_REST_EVENT, sync);
    window.addEventListener('odyssey-character-loaded', sync);
    return () => {
      window.removeEventListener(SHORT_REST_EVENT, sync);
      window.removeEventListener('odyssey-character-loaded', sync);
    };
  }, [open]);

  const restCurrentHP = Number(ctx.currentHP);
  const restMaxHP = Number(ctx.maxHP);
  const shortRestHeal = useMemo(() => {
    if (!Number.isFinite(restCurrentHP) || !Number.isFinite(restMaxHP) || restMaxHP <= 0) return 0;
    return Math.max(0, Math.min(restMaxHP, restCurrentHP + Math.ceil(restMaxHP * 0.25)) - restCurrentHP);
  }, [restCurrentHP, restMaxHP]);
  const longRestHeal = useMemo(() => {
    if (!Number.isFinite(restCurrentHP) || !Number.isFinite(restMaxHP) || restMaxHP <= 0) return 0;
    return Math.max(0, restMaxHP - restCurrentHP);
  }, [restCurrentHP, restMaxHP]);

  /** Health + short-rest resource lines shown on top of the magic recovery preview. */
  const restExtraLines = useMemo(() => {
    if (!restPreview) return [];
    const lines: Array<{ label: string; detail: string }> = [];
    if (restPreview === 'short') {
      lines.push({ label: 'Health', detail: shortRestHeal > 0 ? `+${shortRestHeal} HP (a quarter of ${restMaxHP})` : 'Already at full health' });
      lines.push({ label: 'Refreshed', detail: 'Pact magic, channel divinity, wild shape uses, action economy' });
      lines.push({ label: 'Short rests', detail: `${shortRestsLeft} → ${Math.max(0, shortRestsLeft - 1)} of ${MAX_SHORT_RESTS} remaining` });
    } else {
      lines.push({ label: 'Health', detail: longRestHeal > 0 ? `+${longRestHeal} HP (back to full ${restMaxHP})` : 'Already at full health' });
      lines.push({ label: 'Temp HP', detail: 'Cleared' });
      lines.push({ label: 'Death saves', detail: 'Reset' });
      lines.push({ label: 'Short rests', detail: `Refilled to ${MAX_SHORT_RESTS} of ${MAX_SHORT_RESTS}` });
    }
    return lines;
  }, [restPreview, shortRestHeal, longRestHeal, restMaxHP, shortRestsLeft]);

  const handleConfirmRest = useCallback((type: 'short' | 'long') => {
    if (type === 'short' && shortRestsLeft <= 0) {
      toast.error('No short rests left — you need a long rest first.');
      return;
    }

    onRest?.(type);

    const left = type === 'short' ? spendShortRest() : refillShortRests();
    setShortRestsLeft(left);

    const who = ctx.name || 'The adventurer';
    const line = type === 'short'
      ? `${who} takes a short rest (1 hour)${shortRestHeal > 0 ? `, recovering ${shortRestHeal} HP` : ''}. ${left} short rest${left === 1 ? '' : 's'} remaining before a long rest is needed.`
      : `${who} takes a long rest (8 hours)${longRestHeal > 0 ? `, recovering ${longRestHeal} HP to full` : ' at full health'}. Spell slots and all rest resources are restored, and short rests are refilled to ${MAX_SHORT_RESTS}.`;

    if (onRestPrompt) onRestPrompt(line);
    else onUseLootItem?.(line);
  }, [shortRestsLeft, onRest, onRestPrompt, onUseLootItem, ctx.name, shortRestHeal, longRestHeal]);

  // Casting from the sheet spends a real slot. A spell is castable when the
  // character still has a slot of its level or higher (or a pact slot big enough).
  const canCastSpellLevel = useCallback((level: number) => {
    if (level === 0) return true;
    const sc = ctx.spellcasting;
    if (!sc) return false;
    const hasSlot = (sc.slots || []).some(s => s.level >= level && s.current > 0);
    const hasPact = !!sc.pactSlots && sc.pactSlots.current > 0 && sc.pactSlots.level >= level;
    return hasSlot || hasPact;
  }, [ctx.spellcasting]);

  // Tapping "Cast" opens the cast card — the app rolls and spends the resource
  // there, then stages a factual receipt for the DM to narrate.
  const handleCastSpell = useCallback((s: CastSpellDefinition) => {
    setCastTarget(s);
  }, []);




  const { multiplier } = useXPProgression();
  const identity = useCharacterIdentity();

  /** Names the voice cast can be filled from: the hero, the party, companions, and story NPCs. */
  const voiceSuggestions = useMemo(() => {
    const names: string[] = [];
    if (ctx?.name) names.push(ctx.name);
    for (const m of ctx?.partyMembers ?? []) if (m?.name) names.push(m.name);
    if (ctx?.companion?.name) names.push(ctx.companion.name);
    for (const n of npcSuggestions) if (n) names.push(n);
    return names;
  }, [ctx?.name, ctx?.partyMembers, ctx?.companion?.name, npcSuggestions]);
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

  // When the sheet is reopened via the return button, land on the tab the player left.
  useEffect(() => {
    if (open && initialTab) setTab(initialTab);
  }, [open, initialTab]);

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
    onAcceptItem?.(item.name, item.quantity, {
      goldValue: item.goldValue,
      description: item.description,
      rarity: item.rarity,
      category: item.category,
      effect: item.effect,
      dice: item.dice,
    });
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
        <div className="flex items-center gap-1 shrink-0">
          {onViewPartySheets && partySheetCount > 0 && (
            <button
              onClick={onViewPartySheets}
              aria-label="View party sheets"
              className="flex items-center gap-1.5 px-2.5 rounded-lg border border-amber-900/30 bg-black/30 hover:bg-black/50 min-h-[48px]"
              style={{ touchAction: 'manipulation' }}
            >
              <Users className="w-4 h-4 text-amber-300" />
              <span className="text-[11px] font-cinzel text-foreground/90">Party</span>
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close character sheet"
            className="p-2 rounded-lg hover:bg-white/10 min-w-[48px] min-h-[48px] flex items-center justify-center"
            style={{ touchAction: 'manipulation' }}
          >
            <X className="w-5 h-5 text-white/80" />
          </button>
        </div>
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

            {(typeof ctx.defenses?.armorClass === 'number' || (ctx.defenses?.tempHP ?? 0) > 0) && (
              <Section title="Defenses" icon={Shield}>
                <div className="grid grid-cols-3 gap-2">
                  {typeof ctx.defenses?.armorClass === 'number' && (
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-white/40">Armor Class</p>
                      <p className="text-xl font-display font-bold text-foreground">{ctx.defenses.armorClass}</p>
                    </div>
                  )}
                  {(ctx.defenses?.tempHP ?? 0) > 0 && (
                    <div className="rounded-lg border border-cyan-400/25 bg-cyan-400/[0.06] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-white/40">Temp HP</p>
                      <p className="text-xl font-display font-bold text-cyan-300">{ctx.defenses?.tempHP}</p>
                    </div>
                  )}
                  {typeof ctx.defenses?.initiativeBonus === 'number' && (
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-white/40">Initiative</p>
                      <p className="text-xl font-display font-bold text-foreground">
                        {ctx.defenses.initiativeBonus >= 0 ? '+' : ''}{ctx.defenses.initiativeBonus}
                      </p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            <Section
              title="Purse & Standing"
              icon={Shield}
              action={
                <button onClick={() => { onClose(); navigateToTab('shop', tab, origin); }} className="text-[10px] text-amber-300 flex items-center gap-1 min-h-[44px] px-1" style={{ touchAction: 'manipulation' }}>
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

            {ctx.wildShape?.isTransformed && (
              <Section title="Wild Shape" icon={Sparkles}>
                <p className="text-sm text-foreground">{ctx.wildShape.formName ?? 'Transformed'}</p>
                <p className="text-xs text-white/50 mt-1">
                  {ctx.wildShape.formHP}/{ctx.wildShape.formMaxHP} HP
                  {typeof ctx.wildShape.formAC === 'number' ? ` · AC ${ctx.wildShape.formAC}` : ''}
                  {ctx.wildShape.formCR ? ` · CR ${ctx.wildShape.formCR}` : ''}
                </p>
                <p className="text-[10px] text-white/40 mt-1">
                  {ctx.wildShape.usesRemaining}/{ctx.wildShape.maxUses} uses remaining
                </p>
              </Section>
            )}

            {ctx.companion && (
              <Section title={ctx.companion.name} icon={Heart}>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-display font-bold text-foreground">
                    {ctx.companion.currentHP}/{ctx.companion.maxHP}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-white/40">{ctx.companion.mood}</span>
                </div>
                {ctx.companion.conditions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {ctx.companion.conditions.map(c => (
                      <Badge key={c} variant="outline" className="text-[10px] capitalize">{c}</Badge>
                    ))}
                  </div>
                )}
              </Section>
            )}

            <Section title="Rest" icon={Moon}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs text-white/50">
                  Short rests remaining: <span className="text-amber-300 font-display">{shortRestsLeft}</span> of {MAX_SHORT_RESTS}
                </span>
                <div className="flex gap-1">
                  {Array.from({ length: MAX_SHORT_RESTS }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'w-2.5 h-2.5 rounded-full border',
                        i < shortRestsLeft ? 'bg-amber-400 border-amber-300' : 'bg-white/5 border-white/15',
                      )}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 min-h-[48px] gap-1.5"
                  disabled={shortRestsLeft <= 0}
                  onClick={() => setRestPreview('short')}
                  style={{ touchAction: 'manipulation' }}
                >
                  <Sun className="w-4 h-4" /> Short Rest
                </Button>
                <Button variant="outline" className="flex-1 min-h-[48px] gap-1.5" onClick={() => setRestPreview('long')} style={{ touchAction: 'manipulation' }}>
                  <Moon className="w-4 h-4" /> Long Rest
                </Button>
              </div>
              {shortRestsLeft <= 0 && (
                <p className="text-[10px] text-white/40 mt-2">No short rests left — take a long rest to recover them.</p>
              )}
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

            {ctx.gearBonuses && <GearBonusBreakdown data={ctx.gearBonuses} />}

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

            {ctx.proficiencies && (ctx.proficiencies.skills.length > 0 || ctx.proficiencies.saves.length > 0) && (
              <Section title="Proficiencies" icon={Activity}>
                {typeof ctx.proficiencies.bonus === 'number' && (
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
                    Proficiency bonus +{ctx.proficiencies.bonus}
                  </p>
                )}
                {ctx.proficiencies.saves.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Saving throws</p>
                    <div className="flex flex-wrap gap-1">
                      {ctx.proficiencies.saves.map(s => (
                        <Badge key={s} variant="outline" className="text-[10px] uppercase">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {ctx.proficiencies.skills.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Skills</p>
                    <div className="flex flex-wrap gap-1">
                      {ctx.proficiencies.skills.map(s => (
                        <Badge
                          key={s}
                          variant="outline"
                          className={cn('text-[10px] capitalize', ctx.proficiencies?.expertise.includes(s) && 'border-amber-400/60 text-amber-300')}
                        >
                          {s.replace(/_/g, ' ')}{ctx.proficiencies?.expertise.includes(s) ? ' ★' : ''}
                        </Badge>
                      ))}
                    </div>
                    {ctx.proficiencies.expertise.length > 0 && (
                      <p className="text-[10px] text-amber-300/70 mt-1.5">★ expertise — proficiency bonus doubled</p>
                    )}
                  </div>
                )}
              </Section>
            )}

            {ctx.multiclassBreakdown && Object.keys(ctx.multiclassBreakdown).length > 0 && (
              <Section title="Classes" icon={BookOpen}>
                <div className="flex flex-wrap gap-1.5">
                  {ctx.deity && <Badge variant="outline" className="text-[10px]">Deity: {ctx.deity}</Badge>}
                  {ctx.domain && <Badge variant="outline" className="text-[10px]">Domain: {ctx.domain}</Badge>}
                  {Object.entries(ctx.multiclassBreakdown).map(([cls, lvl]) => (
                    <Badge key={cls} variant="outline" className="text-[10px] capitalize">{cls} {lvl}</Badge>
                  ))}
                </div>
              </Section>
            )}

            {ctx.prestigeLevel > 0 && (
              <Section
                title="Prestige"
                icon={Sparkles}
                action={
                  <button onClick={() => { onClose(); navigateToTab('legacy', tab, origin); }} className="text-[10px] text-amber-300 flex items-center gap-1 min-h-[44px] px-1" style={{ touchAction: 'manipulation' }}>
                    Legacy tab <ExternalLink className="w-3 h-3" />
                  </button>
                }
              >

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
                <button onClick={() => { onClose(); navigateToTab('abilities', tab, origin); }} className="text-[10px] text-amber-300 flex items-center gap-1 min-h-[44px] px-1" style={{ touchAction: 'manipulation' }}>
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
                  {ctx.abilities.map(a => {
                    const key = `ability:${a.tree}-${a.name}`;
                    const meta = [
                      a.actionType ? a.actionType.replace(/_/g, ' ') : null,
                      a.usageType ? a.usageType.replace(/_/g, ' ') : null,
                      a.dice || null,
                      a.cooldownMinutes ? `${a.cooldownMinutes}m cooldown` : null,
                    ].filter(Boolean) as string[];
                    const hasDetail = Boolean(a.effect) || meta.length > 0;
                    const isOpen = expandedDetail === key;
                    return (
                      <div key={key} className="rounded-lg border border-white/10 bg-white/[0.03]">
                        <button
                          type="button"
                          disabled={!hasDetail}
                          onClick={() => setExpandedDetail(isOpen ? null : key)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left min-h-[44px]"
                          style={{ touchAction: 'manipulation' }}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs text-foreground truncate">{a.name}</span>
                            {a.isHomebrew && <Badge variant="outline" className="text-[9px] border-amber-400/50 text-amber-300 shrink-0">Homebrew</Badge>}
                            {!a.isHomebrew && a.isCustomized && <Badge variant="outline" className="text-[9px] border-sky-400/50 text-sky-300 shrink-0">Custom</Badge>}
                          </span>
                          <span className="text-[10px] text-white/40 shrink-0 capitalize">{a.tree} · Tier {a.tier}</span>
                        </button>
                        {isOpen && hasDetail && (
                          <div className="px-3 pb-2.5 space-y-1">
                            {meta.length > 0 && (
                              <p className="text-[10px] uppercase tracking-wide text-white/40 capitalize">{meta.join(' · ')}</p>
                            )}
                            {a.effect && <p className="text-[11px] leading-relaxed text-white/70">{a.effect}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {ctx.spellcasting?.path && (
              <Section
                title="Magic"
                icon={Sparkles}
                action={
                  <button onClick={() => { onClose(); navigateToTab('arcana', tab, origin); }} className="text-[10px] text-amber-300 flex items-center gap-1 min-h-[44px] px-1" style={{ touchAction: 'manipulation' }}>
                    Arcana tab <ExternalLink className="w-3 h-3" />
                  </button>
                }
              >
                <div className="space-y-1 text-xs text-white/60">
                  <p>Spell attack {ctx.spellcasting.spellAttackBonus >= 0 ? '+' : ''}{ctx.spellcasting.spellAttackBonus} · Save DC {ctx.spellcasting.spellSaveDC}</p>
                  <p>{ctx.spellcasting.totalSlotsRemaining} slots remaining</p>
                  {ctx.spellcasting.concentratingOn && <p className="text-purple-300">Concentrating on {ctx.spellcasting.concentratingOn}</p>}

                  {/* Remaining uses, level by level */}
                  {((ctx.spellcasting.slots?.length ?? 0) > 0 || ctx.spellcasting.pactSlots) && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(ctx.spellcasting.slots || []).filter(sl => sl.max > 0).map(sl => (
                        <div key={`slot-${sl.level}`} className="flex items-center gap-1">
                          <span className="text-[10px] text-white/40">Lv {sl.level}</span>
                          <div className="flex gap-0.5">
                            {Array.from({ length: sl.max }).map((_, i) => (
                              <span
                                key={i}
                                className={cn(
                                  'w-2 h-2 rounded-full',
                                  i < sl.current ? 'bg-indigo-400' : 'bg-white/10 border border-white/15',
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                      {ctx.spellcasting.pactSlots && ctx.spellcasting.pactSlots.max > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-violet-300/70">Pact Lv {ctx.spellcasting.pactSlots.level}</span>
                          <div className="flex gap-0.5">
                            {Array.from({ length: ctx.spellcasting.pactSlots.max }).map((_, i) => (
                              <span
                                key={i}
                                className={cn(
                                  'w-2 h-2 rounded-full',
                                  i < ctx.spellcasting!.pactSlots!.current ? 'bg-violet-400' : 'bg-white/10 border border-white/15',
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {(ctx.spellcasting.preparedSpellDetails?.length ?? 0) > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      {ctx.spellcasting.preparedSpellDetails!.map(s => {
                        const key = `spell:${s.name}`;
                        const isOpen = expandedDetail === key;
                        const lines = [
                          s.castingTime ? `Cast ${String(s.castingTime).replace(/_/g, ' ')}` : null,
                          s.range ? `Range ${s.range}` : null,
                          s.duration ? `Duration ${s.duration}` : null,
                          s.concentration ? 'Concentration' : null,
                          s.ritual ? 'Ritual' : null,
                          s.damageFormula ? `${s.damageFormula}${s.damageType ? ` ${s.damageType}` : ''}` : null,
                          s.healingFormula ? `Heals ${s.healingFormula}` : null,
                          s.saveStat ? `${String(s.saveStat).toUpperCase()} save` : null,
                          s.attackType ? `${String(s.attackType).replace(/_/g, ' ')} attack` : null,
                          [s.verbal ? 'V' : null, s.somatic ? 'S' : null, s.material ? 'M' : null].filter(Boolean).join('/') || null,
                        ].filter(Boolean) as string[];
                        const hasDetail = Boolean(s.description) || lines.length > 0;
                        const castable = canCastSpellLevel(s.level ?? 0);
                        return (
                          <div key={key} className="rounded-lg border border-white/10 bg-white/[0.03]">
                            <div className="flex items-stretch">
                              <button
                                type="button"
                                disabled={!hasDetail}
                                onClick={() => setExpandedDetail(isOpen ? null : key)}
                                className="flex-1 min-w-0 flex items-center justify-between gap-2 px-3 py-2 text-left min-h-[44px]"
                                style={{ touchAction: 'manipulation' }}
                              >
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-xs text-foreground truncate">{s.name}</span>
                                  {s.isHomebrew && <Badge variant="outline" className="text-[9px] border-amber-400/50 text-amber-300 shrink-0">Homebrew</Badge>}
                                </span>
                                <span className="text-[10px] text-white/40 shrink-0 capitalize">
                                  {s.level === 0 ? 'Cantrip' : `Lv ${s.level}`}{s.school ? ` · ${s.school}` : ''}
                                </span>
                              </button>
                              <button
                                type="button"
                                disabled={!castable}
                                onClick={() => handleCastSpell(s)}
                                className={cn(
                                  'shrink-0 px-3 min-h-[44px] text-[10px] font-semibold uppercase tracking-wide border-l border-white/10',
                                  castable
                                    ? 'text-indigo-300 hover:bg-indigo-500/10'
                                    : 'text-white/25',
                                )}
                                style={{ touchAction: 'manipulation' }}
                              >
                                {castable ? 'Cast' : 'No slot'}
                              </button>
                            </div>
                            {isOpen && hasDetail && (
                              <div className="px-3 pb-2.5 space-y-1">
                                {lines.length > 0 && (
                                  <p className="text-[10px] uppercase tracking-wide text-white/40 capitalize">{lines.join(' · ')}</p>
                                )}
                                {s.description && <p className="text-[11px] leading-relaxed text-white/70">{s.description}</p>}
                                {s.higherLevels && <p className="text-[11px] leading-relaxed text-white/50">At higher levels: {s.higherLevels}</p>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : ctx.spellcasting.preparedSpells?.length > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      {ctx.spellcasting.preparedSpells.map(s => (
                        <div key={s} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3">
                          <span className="text-xs text-foreground truncate py-2">{s}</span>
                          <button
                            type="button"
                            onClick={() => handleCastSpell({ name: s })}
                            className="shrink-0 px-2 min-h-[44px] text-[10px] font-semibold uppercase tracking-wide text-indigo-300"
                            style={{ touchAction: 'manipulation' }}
                          >
                            Cast
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
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
                <button onClick={() => { onClose(); navigateToTab('gear', tab, origin); }} className="text-[10px] text-amber-300 flex items-center gap-1 min-h-[44px] px-1" style={{ touchAction: 'manipulation' }}>
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
                <button onClick={() => { onClose(); navigateToTab('consumables', tab, origin); }} className="text-[10px] text-amber-300 flex items-center gap-1 min-h-[44px] px-1" style={{ touchAction: 'manipulation' }}>
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

            <Section
              title="Loot"
              icon={Coins}
              action={
                <button onClick={() => { onClose(); navigateToTab('loot', tab, origin); }} className="text-[10px] text-amber-300 flex items-center gap-1 min-h-[44px] px-1" style={{ touchAction: 'manipulation' }}>
                  Inventory tab <ExternalLink className="w-3 h-3" />
                </button>
              }
            >

              {!ctx.loot || ctx.loot.items.length === 0 ? (
                <p className="text-xs text-white/40 text-center py-2">No loot recovered yet.</p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    {ctx.loot.items.map(i => (
                      <div key={i.name} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs text-foreground">{i.name}</span>
                          <span className="text-[10px] text-white/40 capitalize shrink-0">{i.rarity} · {i.goldValue}g</span>
                        </div>
                        {i.description && (
                          <p className="text-[10px] text-white/50 mt-1 leading-relaxed">{i.description}</p>
                        )}
                        {i.effect && (
                          <p className="text-[10px] text-amber-300/70 mt-1">{i.effect}{i.dice ? ` (${i.dice})` : ''}</p>
                        )}
                        {onUseLootItem && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full mt-2 min-h-[44px]"
                            onClick={() => { onUseLootItem(buildLootUseText(i)); onClose(); }}
                          >
                            Use
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/40 mt-2">Total value {ctx.loot.totalValue.toLocaleString()} gold</p>
                </>
              )}
            </Section>
          </>
        )}

        {tab === 'voices' && (
          <VoicesTab suggestedNames={voiceSuggestions} />
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

            <Section title="Quest Board" icon={Scroll}>
              <QuestBoard
                quests={quests}
                canManage={!!onAcceptQuest || !!onDeclineQuest}
                onAccept={onAcceptQuest}
                onDecline={onDeclineQuest}
                onScan={onScanQuests}
                scanning={scanningQuests}
                worldState={worldState}
              />
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

      <CastCard
        spell={castTarget}
        onClose={() => setCastTarget(null)}
        onResolved={receipt => onUseLootItem?.(receipt)}
      />

      <RestPreviewSheet
        type={restPreview}
        onClose={() => setRestPreview(null)}
        onConfirm={handleConfirmRest}
        extraLines={restExtraLines}
      />
    </div>
  );

  return createPortal(body, document.body);

}
