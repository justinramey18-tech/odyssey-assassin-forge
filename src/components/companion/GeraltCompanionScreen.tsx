import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Heart, Shield, Plus, Minus, X, Zap, Skull,
  Swords, Star, Smile, Frown, Meh, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import geraltHappy from '@/assets/geralt-happy.jpg';
import geraltAngry from '@/assets/geralt-angry.jpg';
import geraltInjured from '@/assets/geralt-injured.jpg';

// ── Types ──

interface GeraltState {
  currentHP: number;
  maxHP: number;
  tempHP: number;
  level: number;
  xp: number;
  abilities: { str: number; dex: number; con: number; wis: number; int: number; cha: number };
  conditions: string[];
  mood: 'happy' | 'neutral' | 'agitated' | 'enraged';
  loyalty: number; // 0-100
  notes: string;
}

const DEFAULT_STATE: GeraltState = {
  currentHP: 59,
  maxHP: 59,
  tempHP: 0,
  level: 3,
  xp: 0,
  abilities: { str: 20, dex: 12, con: 17, wis: 12, int: 3, cha: 7 },
  conditions: [],
  mood: 'happy',
  loyalty: 80,
  notes: '',
};

const CONDITIONS = ['Frightened', 'Prone', 'Charmed', 'Restrained', 'Poisoned', 'Stunned', 'Blinded'];
const MOODS: GeraltState['mood'][] = ['happy', 'neutral', 'agitated', 'enraged'];

const MOOD_CONFIG = {
  happy: { icon: Smile, label: 'Happy', color: 'text-emerald-400 border-emerald-500/40' },
  neutral: { icon: Meh, label: 'Neutral', color: 'text-amber-400 border-amber-500/40' },
  agitated: { icon: Frown, label: 'Agitated', color: 'text-orange-400 border-orange-500/40' },
  enraged: { icon: AlertTriangle, label: 'Enraged', color: 'text-rose-400 border-rose-500/40' },
};

const ATTACKS = [
  { name: 'Beak', bonus: '+7', damage: '1d10 + 5 piercing', desc: 'Melee Weapon Attack' },
  { name: 'Claws', bonus: '+7', damage: '2d8 + 5 slashing', desc: 'Melee Weapon Attack' },
  { name: 'Bear Hug', bonus: '—', damage: 'Grapple (DC 15)', desc: 'On Claws hit, target is grappled' },
];

// ── Helpers ──

function getStorageKey(characterId: string) {
  return `odyssey_${characterId}_geralt_companion`;
}

function loadState(characterId: string): GeraltState {
  try {
    const raw = localStorage.getItem(getStorageKey(characterId));
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(characterId: string, state: GeraltState) {
  try {
    localStorage.setItem(getStorageKey(characterId), JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save Geralt state:', e);
  }
}

function getModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function formatMod(score: number) {
  const mod = getModifier(score);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

// ── Component ──

interface GeraltCompanionScreenProps {
  open: boolean;
  onClose: () => void;
  characterId: string;
}

export function GeraltCompanionScreen({ open, onClose, characterId }: GeraltCompanionScreenProps) {
  const [state, setState] = useState<GeraltState>(() => loadState(characterId));
  const [hpDelta, setHpDelta] = useState('');

  // Load on characterId change
  useEffect(() => {
    setState(loadState(characterId));
  }, [characterId]);

  // Auto-save on state change
  useEffect(() => {
    if (open) saveState(characterId, state);
  }, [state, characterId, open]);

  const update = useCallback((patch: Partial<GeraltState>) => {
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  const hpPct = Math.max(0, Math.min(100, (state.currentHP / state.maxHP) * 100));
  const hpColor = hpPct > 50 ? 'text-emerald-400' : hpPct > 25 ? 'text-amber-400' : 'text-rose-400';
  const barColor = hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-500' : 'bg-rose-500';
  const isDown = state.currentHP === 0;

  // Dynamic background based on HP
  const backgroundImage = useMemo(() => {
    if (hpPct > 50) return geraltHappy;
    if (hpPct > 25) return geraltAngry;
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

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg w-full h-[100dvh] max-h-[100dvh] p-0 border-amber-900/40 bg-background sm:rounded-none overflow-hidden [&>button]:hidden">
        {/* Dynamic background image */}
        <div className="absolute inset-0 z-0 transition-opacity duration-700">
          <img src={backgroundImage} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/80 to-black/90" />
        </div>
        <ScrollArea className="h-full relative z-10">
          <div className="p-4 space-y-5">

            {/* Header */}
            <div className="flex items-start justify-between">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex-1">
                <h1 className="text-2xl font-cinzel font-bold text-amber-300 tracking-wide">Geralt</h1>
                <p className="text-xs text-amber-400/70 font-cinzel uppercase tracking-widest">Owlbear Companion</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">Level {state.level}</span>
                  <span className="text-[10px] text-amber-500/60">•</span>
                  <span className="text-xs text-muted-foreground">CR 3</span>
                  <span className="text-[10px] text-amber-500/60">•</span>
                  <span className="text-xs text-muted-foreground">Large Monstrosity</span>
                </div>
              </motion.div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Close">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>


            {/* ── HP Widget ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="rounded-xl border border-amber-800/40 bg-black/30 p-4 space-y-3">
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
              {/* Quick buttons */}
              <div className="grid grid-cols-4 gap-1">
                {[1, 5].map(n => (
                  <Button key={`d${n}`} variant="ghost" size="sm" className="text-xs h-8 text-rose-400 hover:bg-rose-500/10" onClick={() => applyDamage(n)}>-{n}</Button>
                ))}
                {[1, 5].map(n => (
                  <Button key={`h${n}`} variant="ghost" size="sm" className="text-xs h-8 text-emerald-400 hover:bg-emerald-500/10" onClick={() => applyHeal(n)}>+{n}</Button>
                ))}
              </div>
              {/* Custom amount */}
              <div className="flex gap-2">
                <Input type="number" placeholder="Amount..." value={hpDelta} onChange={e => setHpDelta(e.target.value)} className="text-center flex-1" />
                <Button variant="outline" size="sm" className="text-rose-400 border-rose-500/30" onClick={() => { applyDamage(parseInt(hpDelta) || 1); setHpDelta(''); }} disabled={!hpDelta}>
                  <Minus className="w-3 h-3" />
                </Button>
                <Button variant="outline" size="sm" className="text-emerald-400 border-emerald-500/30" onClick={() => { applyHeal(parseInt(hpDelta) || 1); setHpDelta(''); }} disabled={!hpDelta}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              {/* Full heal */}
              <Button variant="outline" size="sm" className="w-full text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                onClick={() => update({ currentHP: state.maxHP })}>
                <Zap className="w-4 h-4 mr-2" />Full Heal
              </Button>
              {/* Max HP adjust */}
              <div className="flex items-center justify-between pt-1 border-t border-border/30">
                <span className="text-xs text-muted-foreground">Max HP</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => update({ maxHP: Math.max(1, state.maxHP - 1), currentHP: Math.min(state.currentHP, state.maxHP - 1) })}><Minus className="w-3 h-3" /></Button>
                  <span className="font-mono text-sm w-8 text-center">{state.maxHP}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => update({ maxHP: state.maxHP + 1 })}><Plus className="w-3 h-3" /></Button>
                </div>
              </div>
            </motion.div>

            {/* ── Level / XP ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="rounded-xl border border-amber-800/40 bg-black/30 p-4 space-y-3">
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
            </motion.div>

            {/* ── Ability Scores ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="rounded-xl border border-amber-800/40 bg-black/30 p-4 space-y-3">
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
            </motion.div>

            {/* ── Attacks / Abilities ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="rounded-xl border border-amber-800/40 bg-black/30 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Swords className="w-5 h-5 text-rose-400" />
                <span className="font-cinzel text-sm text-muted-foreground uppercase tracking-wider">Attacks</span>
              </div>
              {ATTACKS.map(atk => (
                <div key={atk.name} className="flex items-center justify-between p-2 rounded-lg border border-border/30 bg-black/20">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{atk.name}</p>
                    <p className="text-[10px] text-muted-foreground">{atk.desc}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-amber-400">{atk.bonus} to hit</p>
                    <p className="text-xs text-rose-400">{atk.damage}</p>
                  </div>
                </div>
              ))}
              {/* Traits */}
              <div className="pt-2 border-t border-border/30 space-y-1">
                <p className="text-xs text-muted-foreground"><span className="text-amber-300 font-semibold">Keen Sight & Smell.</span> Advantage on Perception checks relying on sight or smell.</p>
                <p className="text-xs text-muted-foreground"><span className="text-amber-300 font-semibold">Darkvision.</span> 60 ft.</p>
              </div>
            </motion.div>

            {/* ── Conditions ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              className="rounded-xl border border-amber-800/40 bg-black/30 p-4 space-y-3">
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
            </motion.div>

            {/* ── Mood / Loyalty ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="rounded-xl border border-amber-800/40 bg-black/30 p-4 space-y-3">
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
            </motion.div>

            {/* ── Notes ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
              className="rounded-xl border border-amber-800/40 bg-black/30 p-4 space-y-2">
              <span className="font-cinzel text-sm text-muted-foreground uppercase tracking-wider">Notes</span>
              <Textarea
                placeholder="Jot down notes about Geralt..."
                value={state.notes}
                onChange={e => update({ notes: e.target.value })}
                className="min-h-[80px] bg-transparent border-amber-800/30 focus:border-amber-600/50"
              />
            </motion.div>

            {/* bottom spacer */}
            <div className="h-4" />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
