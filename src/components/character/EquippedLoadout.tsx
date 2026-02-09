import { useState, useMemo } from 'react';
import { Character, getActiveSlotsByLevel, Ability } from '@/lib/types';
import { allAbilities } from '@/lib/abilities';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X, Plus, HelpCircle, Target, Crosshair, Eye, Sparkles, CloudRain, Award, Radar, Undo2, Flame, ShieldOff, Megaphone, Zap, Swords, Sword, Shield, Heart, Skull, Footprints, Droplets, EyeOff, Ghost, Moon, FlaskConical, Brain, Dices, Clock, Snowflake, Star, Wind, Bird, Copy, Crown, Cat, Link, Users, Waves, Feather, Hand, CircleDot, Sun, Gem, Music, Lightbulb, Leaf, User, Timer, HeartPulse, Shuffle, Wand2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DiceRollModal } from './DiceRollModal';
import { rollDice, getAbilityDice, DiceRoll } from '@/lib/diceRoller';
import { generateRPPrompt } from '@/lib/rpPromptGenerator';
import { useGameMode } from '@/hooks/use-game-mode';
import { usePromptDrawers } from '@/components/drawers/PromptDrawerProvider';
import { CooldownBadge } from '@/components/cooldowns';
import { COOLDOWN_CONFIGS } from '@/lib/cooldowns/config';
import { toast } from 'sonner';
import { useAbilityCustomization } from '@/hooks/use-ability-customization';
import { applyOverrides, homebrewToAbility } from '@/lib/abilityCustomization/utils';
import { isLegacyAbilityId, resolveLegacyAbility, getUnlockedLegacyAbilities } from '@/lib/prestigeTree/abilityConverter';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Target, Crosshair, Eye, Sparkles, CloudRain, Award, Radar, Undo2,
  Flame, ShieldOff, Megaphone, Zap, Swords, Sword, Shield, Heart,
  Skull, Footprints, Droplets, EyeOff, Ghost, Moon, FlaskConical, Brain,
  HelpCircle, Snowflake, Star, Wind, Bird, Copy, Crown, Cat, Link,
  Users, Waves, Feather, Hand, CircleDot, Sun, Gem, Music,
  Lightbulb, Leaf, User, Timer, HeartPulse, Shuffle, Wand2, Clock,
};

interface EquippedLoadoutProps {
  character: Character;
  prestigePoints?: number;
  unlockedPrestigeAbilities?: string[];
  onEquip: (slotIndex: number, abilityId: string) => void;
  onUnequip: (slotIndex: number) => void;
}

export function EquippedLoadout({ character, prestigePoints = 0, unlockedPrestigeAbilities = [], onEquip, onUnequip }: EquippedLoadoutProps) {
  const [showDiceModal, setShowDiceModal] = useState(false);
  const [currentRoll, setCurrentRoll] = useState<DiceRoll | null>(null);
  const [currentRPPrompt, setCurrentRPPrompt] = useState('');
  const [activeAbility, setActiveAbility] = useState<Ability | null>(null);
  const [activeTier, setActiveTier] = useState<1 | 2 | 3>(1);
  const { rerollsDisabled } = useGameMode();
  
  // Ability customization for homebrew support
  const abilityCustomization = useAbilityCustomization();
  
  // Cooldown system from drawer context
  let cooldownContext: ReturnType<typeof usePromptDrawers> | null = null;
  try {
    cooldownContext = usePromptDrawers();
  } catch {
    // Not within provider, cooldowns disabled
  }

  const totalSlots = getActiveSlotsByLevel(character.level, prestigePoints);
  
  // Helper to get ability (base, homebrew, or legacy) with customizations
  const getAbilityById = (id: string): (Ability & { isHomebrew?: boolean; isLegacy?: boolean }) | null => {
    // Legacy prestige ability
    if (isLegacyAbilityId(id)) {
      const legacy = resolveLegacyAbility(id);
      return legacy ? { ...legacy, isLegacy: true } as Ability & { isLegacy: boolean } : null;
    }
    if (id.startsWith('homebrew_')) {
      const homebrew = abilityCustomization.state.homebrewAbilities.find(h => h.id === id);
      return homebrew ? homebrewToAbility(homebrew) : null;
    }
    const base = allAbilities.find(a => a.id === id);
    if (!base) return null;
    const override = abilityCustomization.getOverride(id);
    return applyOverrides(base, override);
  };
  
  // Get available active abilities (unlocked, not passive, not already equipped)
  // This includes base abilities, homebrew abilities, AND legacy prestige abilities
  const availableAbilities = useMemo(() => {
    // Base + homebrew abilities
    const baseAvailable = character.abilities
      .filter(ca => {
        if (ca.currentTier === 0) return false;
        const ability = getAbilityById(ca.abilityId);
        if (!ability || ability.type === 'passive') return false;
        if (character.equippedAbilities.includes(ca.abilityId)) return false;
        return true;
      })
      .map(ca => getAbilityById(ca.abilityId))
      .filter(Boolean) as (Ability & { isHomebrew?: boolean })[];

    // Legacy prestige abilities (unlocked and not already equipped)
    const legacyAvailable = getUnlockedLegacyAbilities(unlockedPrestigeAbilities)
      .filter(la => {
        if (la.type === 'passive') return false;
        if (character.equippedAbilities.includes(la.id)) return false;
        return true;
      })
      .map(la => ({ ...la, isLegacy: true }));

    return [...baseAvailable, ...legacyAvailable];
  }, [character.abilities, character.equippedAbilities, unlockedPrestigeAbilities, abilityCustomization.state.homebrewAbilities, abilityCustomization.state.overrides]);

  const treeStyles: Record<string, string> = {
    hunter: 'border-hunter/50 bg-hunter-dim/20 text-hunter-glow',
    warrior: 'border-warrior/50 bg-warrior-dim/20 text-warrior-glow',
    assassin: 'border-assassin/50 bg-assassin-dim/20 text-assassin-glow',
  };

  const handleUseAbility = (ability: Ability) => {
    // Check if ability has cooldown tracking and is on cooldown
    const config = COOLDOWN_CONFIGS[ability.id];
    if (config && !config.isPassive && cooldownContext) {
      if (cooldownContext.isOnCooldown(ability.id)) {
        const remaining = cooldownContext.getRemainingTime(ability.id);
        const formatted = cooldownContext.formatRemainingTime(remaining);
        toast.error(`${ability.name} on cooldown! Ready in ${formatted}`);
        return;
      }
    }
    
    // Get the current tier of this ability (legacy abilities default to tier 1)
    const isLegacy = isLegacyAbilityId(ability.id);
    const charAbility = isLegacy ? null : character.abilities.find(ca => ca.abilityId === ability.id);
    const tier = (charAbility?.currentTier || 1) as 1 | 2 | 3;
    
    const { die, count } = getAbilityDice(tier);
    const roll = rollDice(die, count);
    const prompt = generateRPPrompt(ability, tier, roll, character.name);
    
    setActiveAbility(ability);
    setActiveTier(tier);
    setCurrentRoll(roll);
    setCurrentRPPrompt(prompt);
    setShowDiceModal(true);
    
    // Trigger cooldown after successful ability use
    if (config && !config.isPassive && cooldownContext) {
      cooldownContext.triggerCooldown(ability.id);
    }
  };

  const handleReroll = () => {
    if (!activeAbility) return;
    
    const { die, count } = getAbilityDice(activeTier);
    const roll = rollDice(die, count);
    const prompt = generateRPPrompt(activeAbility, activeTier, roll, character.name);
    
    setCurrentRoll(roll);
    setCurrentRPPrompt(prompt);
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-display text-sm font-semibold text-foreground">
            Equipped Abilities
          </h4>
          <span className="text-xs text-muted-foreground font-body">
            {character.equippedAbilities.filter(Boolean).length} / {totalSlots} slots
          </span>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: totalSlots }).map((_, index) => {
            const equippedId = character.equippedAbilities[index];
            const equippedAbility = equippedId ? getAbilityById(equippedId) : null;
            const IconComponent = equippedAbility ? (iconMap[equippedAbility.icon] || HelpCircle) : Plus;
            
            // Check cooldown state
            const config = equippedAbility ? COOLDOWN_CONFIGS[equippedAbility.id] : null;
            const isOnCooldown = config && !config.isPassive && cooldownContext 
              ? cooldownContext.isOnCooldown(equippedAbility!.id) 
              : false;
            const remainingTime = isOnCooldown && cooldownContext 
              ? cooldownContext.getRemainingTime(equippedAbility!.id) 
              : 0;
            const effectiveCooldown = config && cooldownContext 
              ? cooldownContext.getRemainingTime(equippedAbility!.id) + (cooldownContext.getRemainingTime(equippedAbility!.id) > 0 ? 1 : 0)
              : 0;

            if (equippedAbility) {
              const isHomebrew = 'isHomebrew' in equippedAbility && equippedAbility.isHomebrew;
              const isLegacyEquipped = 'isLegacy' in equippedAbility && (equippedAbility as any).isLegacy;
              return (
                <div
                  key={index}
                  className={cn(
                    'relative group flex items-center gap-2 px-3 py-2 rounded-lg border transition-all cursor-pointer hover:scale-105',
                    treeStyles[equippedAbility.tree] ?? 'border-primary/50 bg-primary/10 text-primary',
                    isOnCooldown && 'opacity-60'
                  )}
                  onClick={() => handleUseAbility(equippedAbility)}
                  title={isOnCooldown 
                    ? `${equippedAbility.name} on cooldown` 
                    : `Click to use ${equippedAbility.name}${isHomebrew ? ' (Homebrew)' : ''}${isLegacyEquipped ? ' (Legacy)' : ''}`
                  }
                >
                  {isOnCooldown ? (
                    <Clock className="w-3 h-3 opacity-50 absolute -top-1 -right-1 text-amber-400" />
                  ) : (
                    <Dices className="w-3 h-3 opacity-50 absolute -top-1 -right-1" />
                  )}
                  
                  {/* Homebrew badge */}
                  {isHomebrew && !isOnCooldown && (
                    <span className="absolute -top-1 -left-1 text-[8px] text-primary font-bold">✦</span>
                  )}
                  
                  {/* Legacy badge */}
                  {isLegacyEquipped && !isOnCooldown && (
                    <span className="absolute -top-1 -left-1 text-[8px] text-amber-400 font-bold">★</span>
                  )}
                  
                  {/* Cooldown badge */}
                  {isOnCooldown && config && (
                    <CooldownBadge
                      remaining={remainingTime}
                      total={effectiveCooldown}
                      className="absolute -top-2 -right-2"
                    />
                  )}
                  
                  <IconComponent className="w-4 h-4" />
                  <span className="text-xs font-body font-medium text-foreground">
                    {equippedAbility.name}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 opacity-50 hover:opacity-100 hover:bg-destructive/20 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnequip(index);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            }

            return (
              <DropdownMenu key={index}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'flex items-center justify-center w-10 h-10 rounded-lg border-2 border-dashed',
                      'border-muted-foreground/30 text-muted-foreground/50',
                      'hover:border-primary/50 hover:text-primary/70 hover:bg-primary/5',
                      'transition-all cursor-pointer',
                      availableAbilities.length === 0 && 'opacity-50 cursor-not-allowed'
                    )}
                    disabled={availableAbilities.length === 0}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
                  {availableAbilities.length === 0 ? (
                    <DropdownMenuItem disabled>
                      <span className="text-muted-foreground text-xs">No active abilities unlocked</span>
                    </DropdownMenuItem>
                  ) : (
                    availableAbilities.map(ability => {
                      const AbilityIcon = iconMap[ability.icon] || HelpCircle;
                      const isHomebrew = 'isHomebrew' in ability && ability.isHomebrew;
                      const isLegacyItem = 'isLegacy' in ability && (ability as any).isLegacy;
                      return (
                        <DropdownMenuItem
                          key={ability.id}
                          onClick={() => onEquip(index, ability.id)}
                          className="flex items-center gap-2"
                        >
                          <AbilityIcon className={cn('w-4 h-4', (treeStyles[ability.tree] ?? 'text-primary').split(' ')[2])} />
                          <span className="flex items-center gap-1">
                            {ability.name}
                            {isHomebrew && <span className="text-[10px] text-primary">✦</span>}
                            {isLegacyItem && <span className="text-[10px] text-amber-400">★</span>}
                          </span>
                        </DropdownMenuItem>
                      );
                    })
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </div>
        
        <p className="text-[10px] text-muted-foreground font-body">
          Tap an equipped ability to roll dice and generate an RP prompt. 1 slot per level + 1 per prestige point.
        </p>
      </div>

      {currentRoll && activeAbility && (
        <DiceRollModal
          ability={activeAbility}
          tier={activeTier}
          roll={currentRoll}
          rpPrompt={currentRPPrompt}
          open={showDiceModal}
          onOpenChange={setShowDiceModal}
          onReroll={handleReroll}
          rerollDisabled={rerollsDisabled}
        />
      )}
    </>
  );
}
