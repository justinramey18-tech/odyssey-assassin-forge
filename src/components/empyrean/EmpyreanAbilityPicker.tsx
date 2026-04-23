import { useState, useCallback } from 'react';
import { Zap, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { allAbilities } from '@/lib/abilities';
import type { Ability } from '@/lib/types';
import { generateRPPrompt } from '@/lib/rpPromptGenerator';
import { rollDice } from '@/lib/diceRoller';
import type { NarrativeCooldownMap } from '@/lib/narrativeCooldowns';
import { getCooldownTurns, isOnNarrativeCooldown } from '@/lib/narrativeCooldowns';

interface EmpyreanAbilityPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterName: string;
  equippedAbilityIds: string[];
  abilityTiers: Map<string, number>;
  cooldowns: NarrativeCooldownMap;
  onUseAbility: (abilityId: string, generatedPrompt: string) => void;
  isLoading: boolean;
}

export function EmpyreanAbilityPicker({
  open,
  onOpenChange,
  characterName,
  equippedAbilityIds,
  abilityTiers,
  cooldowns,
  onUseAbility,
  isLoading,
}: EmpyreanAbilityPickerProps) {
  const [pending, setPending] = useState<{ ability: Ability; prompt: string } | null>(null);

  const equippedAbilities = equippedAbilityIds
    .map(id => allAbilities.find(a => a.id === id))
    .filter((a): a is Ability => !!a);

  const handlePick = useCallback((ability: Ability) => {
    const tier = (abilityTiers.get(ability.id) || 1) as 1 | 2 | 3;
    const roll = rollDice('d20', 1);
    const prompt = generateRPPrompt(ability, tier, roll, characterName || 'The Rider');
    setPending({ ability, prompt });
  }, [abilityTiers, characterName]);

  const confirmUse = useCallback(() => {
    if (!pending) return;
    onUseAbility(pending.ability.id, pending.prompt);
    setPending(null);
    onOpenChange(false);
  }, [pending, onUseAbility, onOpenChange]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] p-0 bg-background/95 backdrop-blur-lg border-t border-amber-500/30 rounded-t-2xl overflow-hidden flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-border/40">
            <SheetTitle className="text-base font-cinzel text-amber-300 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Use Ability
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3">
            {equippedAbilities.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No abilities equipped. Visit the Abilities drawer to equip some to your loadout.
              </p>
            )}
            <div className="space-y-2">
              {equippedAbilities.map(ability => {
                const onCooldown = isOnNarrativeCooldown(cooldowns, ability.id);
                const turnsLeft = getCooldownTurns(cooldowns, ability.id);
                const tier = (abilityTiers.get(ability.id) || 1) as 1 | 2 | 3;
                const tierEffect = ability.tierEffects.find(e => e.tier === tier)?.description
                  || ability.tierEffects[0]?.description
                  || '';
                return (
                  <button
                    key={ability.id}
                    onClick={() => handlePick(ability)}
                    disabled={onCooldown || isLoading}
                    className={cn(
                      'w-full text-left rounded-lg border transition-colors p-3',
                      onCooldown
                        ? 'border-slate-700/50 bg-slate-800/30 opacity-60 cursor-not-allowed'
                        : 'border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10 active:bg-amber-500/20'
                    )}
                    style={{ touchAction: 'manipulation' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={cn('text-sm font-cinzel font-semibold truncate', onCooldown ? 'text-slate-400' : 'text-amber-200')}>
                            {ability.name}
                          </p>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/70 shrink-0">
                            T{tier}
                          </span>
                        </div>
                        {tierEffect && (
                          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                            {tierEffect}
                          </p>
                        )}
                      </div>
                      {onCooldown && (
                        <div className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-700/40 border border-slate-600/40">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-[11px] text-slate-300 whitespace-nowrap">Cooling down ({turnsLeft} {turnsLeft === 1 ? 'turn' : 'turns'})</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!pending} onOpenChange={(v) => { if (!v) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Use {pending?.ability.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send the ability's narrative prompt to the DM and start a cooldown. You will not be able to use this ability again until the cooldown ends.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUse} className="bg-amber-600 hover:bg-amber-700 text-white">
              Use ability
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
