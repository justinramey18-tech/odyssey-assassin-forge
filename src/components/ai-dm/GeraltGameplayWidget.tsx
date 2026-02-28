import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Heart, Shield, Plus, Minus, X, Zap, Skull,
  Swords, Star, Dices, Gem,
} from 'lucide-react';
import { rollDice } from '@/lib/diceRoller';
import { cn } from '@/lib/utils';
import {
  GeraltState, DEFAULT_STATE, ATTACKS, CONDITIONS, MOODS, MOOD_CONFIG,
  loadState, saveState, formatMod,
  AttackRollResult,
} from '@/components/companion/geralt-data';

import geraltHappy from '@/assets/geralt-happy.jpg';
import geraltAngry from '@/assets/geralt-angry.jpg';
import geraltInjured from '@/assets/geralt-injured.jpg';

interface GeraltGameplayWidgetProps {
  open: boolean;
  onClose: () => void;
  characterId: string;
  onHpChange?: (currentHP: number, maxHP: number) => void;
}

export function GeraltGameplayWidget({ open, onClose, characterId, onHpChange }: GeraltGameplayWidgetProps) {
  const [state, setState] = useState<GeraltState>(() => loadState(characterId));
  const [hpDelta, setHpDelta] = useState('');
  const [lastRoll, setLastRoll] = useState<AttackRollResult | null>(null);

  useEffect(() => { setState(loadState(characterId)); }, [characterId]);
  useEffect(() => { if (open) { saveState(characterId, state); onHpChange?.(state.currentHP, state.maxHP); } }, [state, characterId, open, onHpChange]);

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background">
      {/* Dynamic background */}
      <div className="absolute inset-0 z-0 transition-opacity duration-700">
        <img src={backgroundImage} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/15 to-black/35" />
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
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <Gem className="w-10 h-10 text-purple-400/40 mb-4" />
                <h3 className="font-cinzel text-lg text-purple-300/70 mb-2">Role-Playing Prompts</h3>
                <p className="text-sm text-muted-foreground">Coming soon — curated prompts for Geralt interactions during gameplay.</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
    </div>
  );
}
