import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Heart, Shield, Plus, Minus, X, Zap, Skull,
  Swords, Star, Dices, Gem, Play, Copy, Check, Shuffle,
} from 'lucide-react';
import { rollDice } from '@/lib/diceRoller';
import { cn } from '@/lib/utils';
import {
  GeraltState, DEFAULT_STATE, ATTACKS, CONDITIONS, MOODS, MOOD_CONFIG,
  loadState, saveState, formatMod,
  AttackRollResult,
} from '@/components/companion/geralt-data';
import { GERALT_CATEGORIES, GERALT_PROMPTS, GeraltPrompt } from '@/lib/geralt-prompts';
import { applyTimePrefix } from '@/lib/fourthWallTime';
import { toast } from 'sonner';

import geraltHappy from '@/assets/geralt-happy.jpg';
import geraltAngry from '@/assets/geralt-angry.jpg';
import geraltInjured from '@/assets/geralt-injured.jpg';

interface GeraltGameplayWidgetProps {
  open: boolean;
  onClose: () => void;
  characterId: string;
  onHpChange?: (currentHP: number, maxHP: number) => void;
  onUsePrompt?: (prompt: string) => void;
}

// ── Attack prompt generator ──
function buildAttackPrompt(attackName: string, roll: AttackRollResult | null, state: GeraltState): string {
  const moodLabel = MOOD_CONFIG[state.mood].label.toLowerCase();
  const hpPct = state.maxHP > 0 ? Math.round((state.currentHP / state.maxHP) * 100) : 0;
  const healthStatus = hpPct > 75 ? 'healthy' : hpPct > 40 ? 'bloodied' : hpPct > 0 ? 'badly wounded' : 'unconscious';
  const conditions = state.conditions.length > 0 ? state.conditions.join(', ') : 'none';

  let rollContext = '';
  if (roll) {
    if (roll.type === 'hit') {
      rollContext = `\n**Roll:** To Hit = ${roll.roll.total} [${roll.roll.rolls.join(', ')}]${roll.roll.modifier !== 0 ? ` ${roll.roll.modifier > 0 ? '+' : ''}${roll.roll.modifier}` : ''}`;
      if (roll.isNat20) rollContext += ' ⚔️ **NATURAL 20 — CRITICAL HIT!**';
      if (roll.isNat1) rollContext += ' 💀 **NATURAL 1 — CRITICAL MISS!**';
    } else {
      rollContext = `\n**Roll:** Damage = ${roll.roll.total} [${roll.roll.rolls.join(', ')}]${roll.roll.modifier !== 0 ? ` ${roll.roll.modifier > 0 ? '+' : ''}${roll.roll.modifier}` : ''}`;
    }
  }

  const prompt = `## 🐻 Geralt's Attack: ${attackName}

**Companion:** Geralt the Owlbear (Level ${state.level})
**HP:** ${state.currentHP}/${state.maxHP} (${healthStatus}) | **Mood:** ${moodLabel} | **Conditions:** ${conditions}
**Attack:** ${attackName}${rollContext}

Narrate Geralt the owlbear companion using **${attackName}**. He's a ${moodLabel}, cat-like narcissistic owlbear — describe his predatory grace, his smug satisfaction, or his dramatic flair as he strikes. Factor in his current condition (${healthStatus}).`;

  return applyTimePrefix(prompt);
}

export function GeraltGameplayWidget({ open, onClose, characterId, onHpChange, onUsePrompt }: GeraltGameplayWidgetProps) {
  const [state, setState] = useState<GeraltState>(() => loadState(characterId));
  const [hpDelta, setHpDelta] = useState('');
  const [lastRoll, setLastRoll] = useState<AttackRollResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => { setState(loadState(characterId)); }, [characterId]);

  // Listen for external HP changes (from companion screen or AI DM)
  const isLocalUpdate = useRef(false);
  useEffect(() => {
    const handler = (e: Event) => {
      if (isLocalUpdate.current) return;
      const detail = (e as CustomEvent).detail;
      if (detail?.characterId === characterId || !detail?.characterId) {
        setState(loadState(characterId));
      }
    };
    window.addEventListener('geralt-hp-changed', handler);
    return () => window.removeEventListener('geralt-hp-changed', handler);
  }, [characterId]);

  // Auto-save on state change & notify listeners
  useEffect(() => {
    if (open) {
      isLocalUpdate.current = true;
      saveState(characterId, state);
      onHpChange?.(state.currentHP, state.maxHP);
      window.dispatchEvent(new CustomEvent('geralt-hp-changed', { detail: { characterId, currentHP: state.currentHP, maxHP: state.maxHP } }));
      isLocalUpdate.current = false;
    }
  }, [state, characterId, open, onHpChange]);

  const update = useCallback((patch: Partial<GeraltState>) => {
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  const hpPct = Math.max(0, Math.min(100, (state.currentHP / state.maxHP) * 100));
  const hpColor = hpPct > 80 ? 'text-emerald-400' : hpPct > 30 ? 'text-amber-400' : 'text-rose-400';
  const barColor = hpPct > 80 ? 'bg-emerald-500' : hpPct > 30 ? 'bg-amber-500' : 'bg-rose-500';
  const isDown = state.currentHP === 0;

  const backgroundImage = useMemo(() => {
    if (hpPct > 80) return geraltHappy;
    if (hpPct > 30) return geraltAngry;
    return geraltInjured;
  }, [hpPct]);

  const applyDamage = (amount: number) => {
    let remaining = amount;
    let newTemp = state.tempHP;
    if (newTemp > 0) {
      if (remaining >= newTemp) { remaining -= newTemp; newTemp = 0; }
      else { newTemp -= remaining; remaining = 0; }
    }
    update({ currentHP: Math.max(0, state.currentHP - remaining), tempHP: newTemp });
  };

  const applyHeal = (amount: number) => {
    update({ currentHP: Math.min(state.maxHP, state.currentHP + amount) });
  };

  const toggleCondition = (c: string) => {
    const has = state.conditions.includes(c);
    update({ conditions: has ? state.conditions.filter(x => x !== c) : [...state.conditions, c] });
  };

  const rollHit = useCallback((atk: typeof ATTACKS[0]) => {
    if (!atk.hitMod) return;
    const roll = rollDice('d20', 1, atk.hitMod);
    const nat = roll.rolls[0];
    setLastRoll({ attackName: atk.name, type: 'hit', roll, isNat20: nat === 20, isNat1: nat === 1 });
  }, []);

  const rollDamage = useCallback((atk: typeof ATTACKS[0]) => {
    if (!atk.damageDie || !atk.damageCount) return;
    const roll = rollDice(atk.damageDie, atk.damageCount, atk.damageMod ?? 0);
    setLastRoll({ attackName: atk.name, type: 'damage', roll, isNat20: false, isNat1: false });
  }, []);

  // ── Prompt handlers ──
  const handleUseAttackPrompt = useCallback((atkName: string) => {
    const prompt = buildAttackPrompt(atkName, lastRoll?.attackName === atkName ? lastRoll : null, state);
    if (onUsePrompt) {
      onUsePrompt(prompt);
      onClose();
      toast.success(`⚔️ ${atkName}`, { description: 'Added to DM input' });
    }
  }, [lastRoll, state, onUsePrompt, onClose]);

  const handleCopyAttackPrompt = useCallback(async (atkName: string) => {
    const prompt = buildAttackPrompt(atkName, lastRoll?.attackName === atkName ? lastRoll : null, state);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedId(`atk-${atkName}`);
      toast.success(`⚔️ ${atkName}`, { description: 'Prompt copied!' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch { toast.error('Copy failed'); }
  }, [lastRoll, state]);

  const handleUseRPPrompt = useCallback((prompt: GeraltPrompt) => {
    const processed = applyTimePrefix(prompt.prompt);
    if (onUsePrompt) {
      onUsePrompt(processed);
      onClose();
      toast.success(`${prompt.icon} ${prompt.title}`, { description: 'Added to DM input' });
    }
  }, [onUsePrompt, onClose]);

  const handleCopyRPPrompt = useCallback(async (prompt: GeraltPrompt) => {
    try {
      await navigator.clipboard.writeText(applyTimePrefix(prompt.prompt));
      setCopiedId(prompt.id);
      toast.success(`${prompt.icon} ${prompt.title}`, { description: 'Prompt copied!' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch { toast.error('Copy failed'); }
  }, []);

  const pickRandomRP = useCallback(() => {
    const prompt = GERALT_PROMPTS[Math.floor(Math.random() * GERALT_PROMPTS.length)];
    handleUseRPPrompt(prompt);
  }, [handleUseRPPrompt]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background">
      {/* Dynamic background */}
      <div className="absolute inset-0 z-0 transition-opacity duration-700">
        <img src={backgroundImage} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/80" />
      </div>

        <div className="relative z-10 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div>
              <h1 className="text-xl font-cinzel font-bold text-amber-300 tracking-wide">Geralt</h1>
              <p className="text-[10px] text-amber-400/70 font-cinzel uppercase tracking-widest">Gameplay Widget</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Close">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="stats" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-4 bg-black/30 border border-amber-800/30">
              <TabsTrigger value="stats" className="flex-1 text-xs font-cinzel data-[state=active]:bg-amber-900/40 data-[state=active]:text-amber-300">Stats</TabsTrigger>
              <TabsTrigger value="actions" className="flex-1 text-xs font-cinzel data-[state=active]:bg-rose-900/40 data-[state=active]:text-rose-300">Actions</TabsTrigger>
              <TabsTrigger value="rp" className="flex-1 text-xs font-cinzel data-[state=active]:bg-purple-900/40 data-[state=active]:text-purple-300">RP Prompts</TabsTrigger>
            </TabsList>

            {/* ── Stats Tab ── */}
            <TabsContent value="stats" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  {/* HP Widget */}
                  <div className="rounded-xl border border-amber-800/30 bg-black/15 backdrop-blur-[2px] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isDown ? <Skull className="w-5 h-5 text-rose-400" /> : <Heart className={cn("w-5 h-5", hpColor)} />}
                        <span className="font-cinzel text-sm text-muted-foreground uppercase tracking-wider">Hit Points</span>
                      </div>
                      {state.tempHP > 0 && (
                        <div className="flex items-center gap-1 text-sky-400 text-xs">
                          <Shield className="w-3 h-3" />+{state.tempHP}
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <span className={cn("text-3xl font-bold", hpColor)}>{state.currentHP}</span>
                      <span className="text-xl text-muted-foreground"> / {state.maxHP}</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full transition-all", barColor)} style={{ width: `${hpPct}%` }} />
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {[1, 5].map(n => (
                        <Button key={`d${n}`} variant="ghost" size="sm" className="text-xs h-8 text-rose-400 hover:bg-rose-500/10" onClick={() => applyDamage(n)}>-{n}</Button>
                      ))}
                      {[1, 5].map(n => (
                        <Button key={`h${n}`} variant="ghost" size="sm" className="text-xs h-8 text-emerald-400 hover:bg-emerald-500/10" onClick={() => applyHeal(n)}>+{n}</Button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input type="number" placeholder="Amount..." value={hpDelta} onChange={e => setHpDelta(e.target.value)} className="text-center flex-1" />
                      <Button variant="outline" size="sm" className="text-rose-400 border-rose-500/30" onClick={() => { applyDamage(parseInt(hpDelta) || 1); setHpDelta(''); }} disabled={!hpDelta}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <Button variant="outline" size="sm" className="text-emerald-400 border-emerald-500/30" onClick={() => { applyHeal(parseInt(hpDelta) || 1); setHpDelta(''); }} disabled={!hpDelta}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <Button variant="outline" size="sm" className="w-full text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                      onClick={() => update({ currentHP: state.maxHP })}>
                      <Zap className="w-4 h-4 mr-2" />Full Heal
                    </Button>
                    <div className="flex items-center justify-between pt-1 border-t border-border/30">
                      <span className="text-xs text-muted-foreground">Max HP</span>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => update({ maxHP: Math.max(1, state.maxHP - 1), currentHP: Math.min(state.currentHP, state.maxHP - 1) })}><Minus className="w-3 h-3" /></Button>
                        <span className="font-mono text-sm w-8 text-center">{state.maxHP}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => update({ maxHP: state.maxHP + 1 })}><Plus className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  </div>

                  {/* Level / XP */}
                  <div className="rounded-xl border border-amber-800/30 bg-black/15 backdrop-blur-[2px] p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Star className="w-5 h-5 text-amber-400" />
                      <span className="font-cinzel text-sm text-muted-foreground uppercase tracking-wider">Level & Experience</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl font-bold text-amber-300">{state.level}</span>
                        <div className="flex flex-col">
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => update({ level: Math.min(20, state.level + 1) })}><Plus className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => update({ level: Math.max(1, state.level - 1) })}><Minus className="w-3 h-3" /></Button>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <Input type="number" className="w-20 h-7 text-xs text-center" value={state.xp} onChange={e => update({ xp: Math.max(0, parseInt(e.target.value) || 0) })} />
                          <span className="text-xs text-muted-foreground">XP</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ability Scores */}
                  <div className="rounded-xl border border-amber-800/30 bg-black/15 backdrop-blur-[2px] p-4 space-y-3">
                    <span className="font-cinzel text-sm text-muted-foreground uppercase tracking-wider">Ability Scores</span>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.entries(state.abilities) as [keyof GeraltState['abilities'], number][]).map(([key, val]) => (
                        <div key={key} className="flex flex-col items-center p-2 rounded-lg border border-amber-800/30 bg-amber-950/20">
                          <span className="text-[10px] text-amber-400/70 uppercase font-cinzel tracking-wider">{key}</span>
                          <span className="text-lg font-bold text-foreground">{val}</span>
                          <span className="text-xs text-muted-foreground">{formatMod(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Conditions */}
                  <div className="rounded-xl border border-amber-800/30 bg-black/15 backdrop-blur-[2px] p-4 space-y-3">
                    <span className="font-cinzel text-sm text-muted-foreground uppercase tracking-wider">Conditions</span>
                    <div className="flex flex-wrap gap-2">
                      {CONDITIONS.map(c => {
                        const active = state.conditions.includes(c);
                        return (
                          <button key={c} onClick={() => toggleCondition(c)}
                            className={cn(
                              "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                              active ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-muted/20 text-muted-foreground border-border/30 hover:bg-muted/40"
                            )}>
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mood & Loyalty */}
                  <div className="rounded-xl border border-amber-800/30 bg-black/15 backdrop-blur-[2px] p-4 space-y-3">
                    <span className="font-cinzel text-sm text-muted-foreground uppercase tracking-wider">Mood & Loyalty</span>
                    <div className="flex gap-2">
                      {MOODS.map(m => {
                        const cfg = MOOD_CONFIG[m];
                        const Icon = cfg.icon;
                        const active = state.mood === m;
                        return (
                          <button key={m} onClick={() => update({ mood: m })}
                            className={cn(
                              "flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors",
                              active ? cfg.color + ' bg-black/30' : 'border-border/30 text-muted-foreground hover:bg-muted/20'
                            )}>
                            <Icon className="w-4 h-4" />
                            <span className="text-[10px]">{cfg.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Loyalty</span>
                        <span className="text-xs text-amber-400">{state.loyalty}%</span>
                      </div>
                      <Progress value={state.loyalty} className="h-2" />
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => update({ loyalty: Math.max(0, state.loyalty - 5) })}>-5</Button>
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => update({ loyalty: Math.min(100, state.loyalty + 5) })}>+5</Button>
                      </div>
                    </div>
                  </div>

                  <div className="h-4" />
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ── Actions Tab ── */}
            <TabsContent value="actions" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  <div className="rounded-xl border border-amber-800/30 bg-black/15 backdrop-blur-[2px] p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Swords className="w-5 h-5 text-rose-400" />
                      <span className="font-cinzel text-sm text-muted-foreground uppercase tracking-wider">Attacks</span>
                    </div>

                    {/* Roll result banner */}
                    <AnimatePresence mode="wait">
                      {lastRoll && (
                        <motion.div
                          key={`${lastRoll.attackName}-${lastRoll.type}-${lastRoll.roll.total}`}
                          initial={{ opacity: 0, scale: 0.9, y: -8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: -8 }}
                          transition={{ duration: 0.3 }}
                          className={cn(
                            "rounded-lg p-3 text-center border",
                            lastRoll.isNat20 ? "bg-amber-500/20 border-amber-400/50"
                              : lastRoll.isNat1 ? "bg-rose-500/20 border-rose-400/50"
                              : "bg-black/20 border-border/30"
                          )}
                        >
                          {lastRoll.isNat20 && <p className="text-[10px] font-cinzel uppercase tracking-widest text-amber-300 mb-1">⚔️ Natural 20!</p>}
                          {lastRoll.isNat1 && <p className="text-[10px] font-cinzel uppercase tracking-widest text-rose-300 mb-1">💀 Natural 1!</p>}
                          <p className="text-xs text-muted-foreground">{lastRoll.attackName} — {lastRoll.type === 'hit' ? 'To Hit' : 'Damage'}</p>
                          <p className={cn("text-2xl font-bold font-cinzel", lastRoll.isNat20 ? "text-amber-300" : lastRoll.isNat1 ? "text-rose-400" : "text-foreground")}>
                            {lastRoll.roll.total}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            [{lastRoll.roll.rolls.join(', ')}]{lastRoll.roll.modifier !== 0 ? ` ${lastRoll.roll.modifier > 0 ? '+' : ''}${lastRoll.roll.modifier}` : ''}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {ATTACKS.map(atk => (
                      <div key={atk.name} className="rounded-lg border border-border/20 bg-black/10 p-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{atk.name}</p>
                            <p className="text-[10px] text-muted-foreground">{atk.desc}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-amber-400">{atk.bonus} to hit</p>
                            <p className="text-xs text-rose-400">{atk.damage}</p>
                          </div>
                        </div>
                        {atk.hitMod !== undefined && (
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs text-amber-300 border-amber-700/40 hover:bg-amber-500/10" onClick={() => rollHit(atk)}>
                              <Dices className="w-3 h-3 mr-1.5" />Hit
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs text-rose-400 border-rose-700/40 hover:bg-rose-500/10" onClick={() => rollDamage(atk)}>
                              <Dices className="w-3 h-3 mr-1.5" />Dmg
                            </Button>
                          </div>
                        )}
                        {/* Use / Copy prompt buttons */}
                        <div className="flex gap-2">
                          {onUsePrompt && (
                            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs text-emerald-300 border-emerald-700/40 hover:bg-emerald-500/10" onClick={() => handleUseAttackPrompt(atk.name)}>
                              <Play className="w-3 h-3 mr-1.5" />Use
                            </Button>
                          )}
                          <Button variant="outline" size="sm" className={cn("flex-1 h-8 text-xs border-border/30 hover:bg-white/5", copiedId === `atk-${atk.name}` ? "text-green-400 border-green-500/40" : "text-muted-foreground")} onClick={() => handleCopyAttackPrompt(atk.name)}>
                            {copiedId === `atk-${atk.name}` ? <Check className="w-3 h-3 mr-1.5" /> : <Copy className="w-3 h-3 mr-1.5" />}
                            {copiedId === `atk-${atk.name}` ? 'Copied' : 'Copy'}
                          </Button>
                        </div>
                      </div>
                    ))}

                    {/* Traits */}
                    <div className="pt-2 border-t border-border/30 space-y-1">
                      <p className="text-xs text-muted-foreground"><span className="text-amber-300 font-semibold">Keen Sight & Smell.</span> Advantage on Perception checks relying on sight or smell.</p>
                      <p className="text-xs text-muted-foreground"><span className="text-amber-300 font-semibold">Darkvision.</span> 60 ft.</p>
                    </div>
                  </div>
                  <div className="h-4" />
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ── RP Prompts Tab ── */}
            <TabsContent value="rp" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-3">
                  {/* Random button */}
                  {onUsePrompt && (
                    <button
                      onClick={pickRandomRP}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all"
                    >
                      <Shuffle className="w-4 h-4" />
                      Random Prompt
                    </button>
                  )}

                  {/* Category Accordions */}
                  <Accordion type="single" collapsible className="w-full space-y-2">
                    {GERALT_CATEGORIES.map(cat => {
                      const prompts = GERALT_PROMPTS.filter(p => p.category === cat.id);
                      if (prompts.length === 0) return null;

                      return (
                        <AccordionItem key={cat.id} value={cat.id} className="border-0">
                          <AccordionTrigger
                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:no-underline transition-all duration-200 backdrop-blur-sm"
                            style={{
                              backgroundColor: `${cat.color}25`,
                              border: `1px solid ${cat.color}50`,
                            }}
                          >
                            <span
                              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base"
                              style={{ backgroundColor: `${cat.color}30` }}
                            >
                              {cat.icon}
                            </span>
                            <div className="flex-1 text-left">
                              <p className="font-medium text-sm" style={{ color: cat.color }}>{cat.name}</p>
                              <p className="text-[10px] text-white/40">{cat.description}</p>
                            </div>
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: `${cat.color}30`, color: cat.color }}
                            >
                              {prompts.length}
                            </span>
                          </AccordionTrigger>

                          <AccordionContent className="rounded-b-lg border border-t-0 p-2 space-y-1 bg-black/40 backdrop-blur-sm" style={{ borderColor: `${cat.color}40` }}>
                            {prompts.map(prompt => (
                              <div key={prompt.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-black/30 hover:bg-black/40 transition-all group">
                                <div className="flex-1 min-w-0 py-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base shrink-0">{prompt.icon}</span>
                                    <span className="text-sm text-white/90 font-medium">{prompt.title}</span>
                                  </div>
                                  {prompt.description && (
                                    <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{prompt.description}</p>
                                  )}
                                </div>

                                <div className="flex gap-1 shrink-0">
                                  {onUsePrompt && (
                                    <button
                                      onClick={() => handleUseRPPrompt(prompt)}
                                      className="flex items-center gap-1 px-3 min-h-[44px] rounded-lg bg-emerald-900/40 border border-emerald-500/30 hover:bg-emerald-900/60 text-emerald-300 text-xs font-medium transition-colors"
                                    >
                                      <Play className="w-3.5 h-3.5" />
                                      Use
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleCopyRPPrompt(prompt)}
                                    className={cn(
                                      "flex items-center gap-1 px-2 min-h-[44px] rounded-lg border text-xs font-medium transition-colors",
                                      copiedId === prompt.id
                                        ? "bg-green-900/40 border-green-500/30 text-green-300"
                                        : "bg-white/5 border-border/30 text-muted-foreground hover:bg-white/10"
                                    )}
                                  >
                                    {copiedId === prompt.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>

                  <div className="h-4" />
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
    </div>
  );
}
