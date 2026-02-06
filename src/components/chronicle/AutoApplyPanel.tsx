// Chronicle Auto-Apply Panel
// Configuration and execution of smart auto-application

import { useState, useCallback, useMemo } from 'react';
import { 
  Zap, Coins, Heart, AlertCircle, Moon, Skull,
  Check, X, ChevronDown, Settings2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  AutoApplyConfig, 
  AutoApplyResult,
  CHRONICLE_AUTO_APPLY_KEY,
} from '@/lib/chronicleSync/enhancedTypes';
import { ChronicleParseResult, ParsedGoldChange, ParsedHPChange, ParsedCondition } from '@/lib/chronicleSync/types';
import { ParsedRestEvent, ParsedDeathSave } from '@/lib/chronicleSync/enhancedTypes';

interface DeathSavesState {
  successes: number;
  failures: number;
}

interface AutoApplyPanelProps {
  parseResult: ChronicleParseResult;
  enhancedResults?: {
    restEvents: ParsedRestEvent[];
    deathSaves: ParsedDeathSave[];
  };
  currentGold: number;
  currentHP: number;
  maxHP: number;
  activeConditions: string[];
  deathSaves?: DeathSavesState;
  onApplyGold: (netChange: number) => void;
  onApplyHP: (change: number, type: 'damage' | 'healing') => void;
  onApplyConditions: (toAdd: string[], toRemove: string[]) => void;
  onApplyRest: (type: 'short' | 'long') => void;
  onApplyDeathSaves?: (saves: DeathSavesState) => void;
  onRegainHP?: (amount: number) => void;
}

// Load/save config from localStorage
function loadConfig(): AutoApplyConfig {
  try {
    const stored = localStorage.getItem(CHRONICLE_AUTO_APPLY_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { gold: true, hp: true, conditions: true, restRecovery: true, deathSaves: true };
}

function saveConfig(config: AutoApplyConfig) {
  try {
    localStorage.setItem(CHRONICLE_AUTO_APPLY_KEY, JSON.stringify(config));
  } catch {}
}

export function AutoApplyPanel({
  parseResult,
  enhancedResults,
  currentGold,
  currentHP,
  maxHP,
  activeConditions,
  deathSaves,
  onApplyGold,
  onApplyHP,
  onApplyConditions,
  onApplyRest,
  onApplyDeathSaves,
  onRegainHP,
}: AutoApplyPanelProps) {
  const [config, setConfig] = useState<AutoApplyConfig>(loadConfig);
  const [isOpen, setIsOpen] = useState(true);
  const [applied, setApplied] = useState<Partial<Record<keyof AutoApplyConfig, boolean>>>({});

  // Calculate pending changes
  const pendingChanges = useMemo(() => {
    const goldGained = parseResult.goldChanges
      .filter(g => g.action === 'gained')
      .reduce((sum, g) => sum + g.amount, 0);
    const goldSpent = parseResult.goldChanges
      .filter(g => g.action === 'spent')
      .reduce((sum, g) => sum + g.amount, 0);
    const netGold = goldGained - goldSpent;

    const damage = parseResult.hpChanges
      .filter(h => h.type === 'damage')
      .reduce((sum, h) => sum + Math.abs(h.amount), 0);
    const healing = parseResult.hpChanges
      .filter(h => h.type === 'healing')
      .reduce((sum, h) => sum + h.amount, 0);
    const netHP = healing - damage;

    const conditionsToAdd = parseResult.conditions
      .filter(c => c.action === 'applied')
      .map(c => c.name.toLowerCase())
      .filter(c => !activeConditions.includes(c));
    const conditionsToRemove = parseResult.conditions
      .filter(c => c.action === 'removed')
      .map(c => c.name.toLowerCase())
      .filter(c => activeConditions.includes(c));

    const rests = enhancedResults?.restEvents || [];
    const shortRests = rests.filter(r => r.type === 'short_rest').length;
    const longRests = rests.filter(r => r.type === 'long_rest').length;

    // Death saves from enhanced patterns
    const detectedDeathSaves = enhancedResults?.deathSaves || [];
    const deathSaveSuccesses = detectedDeathSaves.filter(
      ds => ds.type === 'success' || ds.type === 'critical_success'
    ).length;
    const deathSaveFailures = detectedDeathSaves.filter(
      ds => ds.type === 'failure'
    ).length;
    // Critical failures count as 2
    const criticalFailures = detectedDeathSaves.filter(
      ds => ds.type === 'critical_failure'
    ).length;
    const totalFailures = deathSaveFailures + (criticalFailures * 2);
    
    // Check for nat 20 (regain 1 HP)
    const hasNat20 = detectedDeathSaves.some(ds => ds.type === 'critical_success');

    return {
      netGold,
      goldGained,
      goldSpent,
      damage,
      healing,
      netHP,
      conditionsToAdd,
      conditionsToRemove,
      shortRests,
      longRests,
      deathSaveSuccesses,
      deathSaveFailures: totalFailures,
      hasNat20,
      detectedDeathSaves,
      hasAnyChanges: netGold !== 0 || damage > 0 || healing > 0 || 
        conditionsToAdd.length > 0 || conditionsToRemove.length > 0 ||
        shortRests > 0 || longRests > 0 || detectedDeathSaves.length > 0,
    };
  }, [parseResult, enhancedResults, activeConditions]);

  // Update config
  const updateConfig = useCallback((key: keyof AutoApplyConfig, value: boolean) => {
    setConfig(prev => {
      const updated = { ...prev, [key]: value };
      saveConfig(updated);
      return updated;
    });
  }, []);

  // Apply handlers
  const handleApplyGold = useCallback(() => {
    if (pendingChanges.netGold !== 0) {
      onApplyGold(pendingChanges.netGold);
      setApplied(prev => ({ ...prev, gold: true }));
    }
  }, [pendingChanges.netGold, onApplyGold]);

  const handleApplyHP = useCallback(() => {
    if (pendingChanges.damage > 0) {
      onApplyHP(-pendingChanges.damage, 'damage');
    }
    if (pendingChanges.healing > 0) {
      onApplyHP(pendingChanges.healing, 'healing');
    }
    setApplied(prev => ({ ...prev, hp: true }));
  }, [pendingChanges.damage, pendingChanges.healing, onApplyHP]);

  const handleApplyConditions = useCallback(() => {
    onApplyConditions(pendingChanges.conditionsToAdd, pendingChanges.conditionsToRemove);
    setApplied(prev => ({ ...prev, conditions: true }));
  }, [pendingChanges.conditionsToAdd, pendingChanges.conditionsToRemove, onApplyConditions]);

  const handleApplyRest = useCallback(() => {
    // Apply the most beneficial rest detected
    if (pendingChanges.longRests > 0) {
      onApplyRest('long');
    } else if (pendingChanges.shortRests > 0) {
      onApplyRest('short');
    }
    setApplied(prev => ({ ...prev, restRecovery: true }));
  }, [pendingChanges.longRests, pendingChanges.shortRests, onApplyRest]);

  const handleApplyDeathSaves = useCallback(() => {
    if (!onApplyDeathSaves) return;
    
    // Calculate new death save state by adding detected saves
    const currentSuccesses = deathSaves?.successes ?? 0;
    const currentFailures = deathSaves?.failures ?? 0;
    
    const newSuccesses = Math.min(3, currentSuccesses + pendingChanges.deathSaveSuccesses);
    const newFailures = Math.min(3, currentFailures + pendingChanges.deathSaveFailures);
    
    // If nat 20 was rolled, regain 1 HP and reset saves
    if (pendingChanges.hasNat20 && onRegainHP) {
      onRegainHP(1);
      onApplyDeathSaves({ successes: 0, failures: 0 });
    } else {
      onApplyDeathSaves({ successes: newSuccesses, failures: newFailures });
    }
    
    setApplied(prev => ({ ...prev, deathSaves: true }));
  }, [pendingChanges, deathSaves, onApplyDeathSaves, onRegainHP]);

  // Apply all enabled
  const handleApplyAll = useCallback(() => {
    if (config.gold && pendingChanges.netGold !== 0 && !applied.gold) {
      handleApplyGold();
    }
    if (config.hp && (pendingChanges.damage > 0 || pendingChanges.healing > 0) && !applied.hp) {
      handleApplyHP();
    }
    if (config.conditions && (pendingChanges.conditionsToAdd.length > 0 || pendingChanges.conditionsToRemove.length > 0) && !applied.conditions) {
      handleApplyConditions();
    }
    if (config.restRecovery && (pendingChanges.shortRests > 0 || pendingChanges.longRests > 0) && !applied.restRecovery) {
      handleApplyRest();
    }
    // Death saves are always enabled when detected
    if (pendingChanges.detectedDeathSaves.length > 0 && !applied.deathSaves && onApplyDeathSaves) {
      handleApplyDeathSaves();
    }
  }, [config, pendingChanges, applied, handleApplyGold, handleApplyHP, handleApplyConditions, handleApplyRest, handleApplyDeathSaves, onApplyDeathSaves]);

  if (!pendingChanges.hasAnyChanges) {
    return null;
  }

  return (
    <Card className="border-cyan-900/30 bg-cyan-500/5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-cyan-400">
                <Zap className="w-4 h-4" />
                Smart Auto-Apply
              </CardTitle>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Gold Changes */}
            {pendingChanges.netGold !== 0 && (
              <AutoApplyRow
                icon={<Coins className="w-4 h-4 text-amber-400" />}
                label="Gold"
                description={
                  pendingChanges.netGold > 0 
                    ? `+${pendingChanges.netGold} GP gained` 
                    : `${pendingChanges.netGold} GP spent`
                }
                preview={`${currentGold} → ${currentGold + pendingChanges.netGold}`}
                enabled={config.gold}
                onToggle={(v) => updateConfig('gold', v)}
                applied={applied.gold}
                onApply={handleApplyGold}
                color="amber"
              />
            )}

            {/* HP Changes */}
            {(pendingChanges.damage > 0 || pendingChanges.healing > 0) && (
              <AutoApplyRow
                icon={<Heart className="w-4 h-4 text-rose-400" />}
                label="HP"
                description={
                  pendingChanges.damage > 0 && pendingChanges.healing > 0
                    ? `${pendingChanges.damage} damage, ${pendingChanges.healing} healing`
                    : pendingChanges.damage > 0
                    ? `${pendingChanges.damage} damage taken`
                    : `${pendingChanges.healing} HP healed`
                }
                preview={`${currentHP}/${maxHP} → ${Math.max(0, Math.min(maxHP, currentHP + pendingChanges.netHP))}/${maxHP}`}
                enabled={config.hp}
                onToggle={(v) => updateConfig('hp', v)}
                applied={applied.hp}
                onApply={handleApplyHP}
                color="rose"
              />
            )}

            {/* Conditions */}
            {(pendingChanges.conditionsToAdd.length > 0 || pendingChanges.conditionsToRemove.length > 0) && (
              <AutoApplyRow
                icon={<AlertCircle className="w-4 h-4 text-purple-400" />}
                label="Conditions"
                description={
                  <>
                    {pendingChanges.conditionsToAdd.length > 0 && (
                      <span className="text-rose-400">+{pendingChanges.conditionsToAdd.join(', ')}</span>
                    )}
                    {pendingChanges.conditionsToAdd.length > 0 && pendingChanges.conditionsToRemove.length > 0 && ', '}
                    {pendingChanges.conditionsToRemove.length > 0 && (
                      <span className="text-emerald-400">-{pendingChanges.conditionsToRemove.join(', ')}</span>
                    )}
                  </>
                }
                enabled={config.conditions}
                onToggle={(v) => updateConfig('conditions', v)}
                applied={applied.conditions}
                onApply={handleApplyConditions}
                color="purple"
              />
            )}

            {/* Rest Recovery */}
            {(pendingChanges.shortRests > 0 || pendingChanges.longRests > 0) && (
              <AutoApplyRow
                icon={<Moon className="w-4 h-4 text-indigo-400" />}
                label="Rest"
                description={
                  pendingChanges.longRests > 0
                    ? `Long rest detected (full recovery)`
                    : `Short rest detected (25% HP recovery)`
                }
                enabled={config.restRecovery}
                onToggle={(v) => updateConfig('restRecovery', v)}
                applied={applied.restRecovery}
                onApply={handleApplyRest}
                color="indigo"
              />
            )}

            {/* Death Saves */}
            {pendingChanges.detectedDeathSaves.length > 0 && onApplyDeathSaves && (
              <AutoApplyRow
                icon={<Skull className="w-4 h-4 text-rose-400" />}
                label="Death Saves"
                description={
                  pendingChanges.hasNat20
                    ? `🎉 Natural 20! Regain 1 HP and reset saves`
                    : `${pendingChanges.deathSaveSuccesses} success${pendingChanges.deathSaveSuccesses !== 1 ? 'es' : ''}, ${pendingChanges.deathSaveFailures} failure${pendingChanges.deathSaveFailures !== 1 ? 's' : ''}`
                }
                preview={
                  pendingChanges.hasNat20
                    ? 'Saves reset, +1 HP'
                    : `${deathSaves?.successes ?? 0}/${deathSaves?.failures ?? 0} → ${Math.min(3, (deathSaves?.successes ?? 0) + pendingChanges.deathSaveSuccesses)}/${Math.min(3, (deathSaves?.failures ?? 0) + pendingChanges.deathSaveFailures)}`
                }
                enabled={config.deathSaves}
                onToggle={(v) => updateConfig('deathSaves', v)}
                applied={applied.deathSaves}
                onApply={handleApplyDeathSaves}
                color="rose"
              />
            )}

            {/* Apply All Button */}
            <Button
              onClick={handleApplyAll}
              className="w-full gap-2 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600"
              disabled={Object.keys(applied).length > 0}
            >
              <Zap className="w-4 h-4" />
              Apply All Enabled Changes
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// Individual auto-apply row
function AutoApplyRow({
  icon,
  label,
  description,
  preview,
  enabled,
  onToggle,
  applied,
  onApply,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  description: React.ReactNode;
  preview?: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  applied?: boolean;
  onApply: () => void;
  color: string;
}) {
  return (
    <div className={`flex items-center gap-3 p-2 rounded-lg bg-${color}-500/5 border border-${color}-500/20`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{label}</span>
            {applied && (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                <Check className="w-3 h-3 mr-1" />
                Applied
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">{description}</div>
          {preview && (
            <div className="text-xs text-foreground/70 mt-0.5">{preview}</div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          disabled={applied}
          className="scale-75"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={onApply}
          disabled={!enabled || applied}
          className="h-7 px-2"
        >
          {applied ? <Check className="w-4 h-4 text-emerald-400" /> : 'Apply'}
        </Button>
      </div>
    </div>
  );
}
