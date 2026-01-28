import { Character, getActiveSlotsByLevel } from '@/lib/types';
import { allAbilities } from '@/lib/abilities';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X, Plus, HelpCircle, Target, Crosshair, Eye, Sparkles, CloudRain, Award, Radar, Undo2, Flame, ShieldOff, Megaphone, Zap, Swords, Sword, Shield, Heart, Skull, Footprints, Droplets, EyeOff, Ghost, Moon, FlaskConical, Brain } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Target, Crosshair, Eye, Sparkles, CloudRain, Award, Radar, Undo2,
  Flame, ShieldOff, Megaphone, Zap, Swords, Sword, Shield, Heart,
  Skull, Footprints, Droplets, EyeOff, Ghost, Moon, FlaskConical, Brain,
  HelpCircle,
};

interface EquippedLoadoutProps {
  character: Character;
  onEquip: (slotIndex: number, abilityId: string) => void;
  onUnequip: (slotIndex: number) => void;
}

export function EquippedLoadout({ character, onEquip, onUnequip }: EquippedLoadoutProps) {
  const totalSlots = getActiveSlotsByLevel(character.level);
  
  // Get available active abilities (unlocked, not passive, not already equipped)
  const availableAbilities = character.abilities
    .filter(ca => {
      if (ca.currentTier === 0) return false;
      const ability = allAbilities.find(a => a.id === ca.abilityId);
      if (!ability || ability.type === 'passive') return false;
      if (character.equippedAbilities.includes(ca.abilityId)) return false;
      return true;
    })
    .map(ca => allAbilities.find(a => a.id === ca.abilityId)!)
    .filter(Boolean);

  const treeStyles = {
    hunter: 'border-hunter/50 bg-hunter-dim/20 text-hunter-glow',
    warrior: 'border-warrior/50 bg-warrior-dim/20 text-warrior-glow',
    assassin: 'border-assassin/50 bg-assassin-dim/20 text-assassin-glow',
  };

  return (
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
          const equippedAbility = equippedId ? allAbilities.find(a => a.id === equippedId) : null;
          const IconComponent = equippedAbility ? (iconMap[equippedAbility.icon] || HelpCircle) : Plus;

          if (equippedAbility) {
            return (
              <div
                key={index}
                className={cn(
                  'relative group flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
                  treeStyles[equippedAbility.tree]
                )}
              >
                <IconComponent className="w-4 h-4" />
                <span className="text-xs font-body font-medium text-foreground">
                  {equippedAbility.name}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 opacity-50 hover:opacity-100 hover:bg-destructive/20 hover:text-destructive"
                  onClick={() => onUnequip(index)}
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
                    return (
                      <DropdownMenuItem
                        key={ability.id}
                        onClick={() => onEquip(index, ability.id)}
                        className="flex items-center gap-2"
                      >
                        <AbilityIcon className={cn('w-4 h-4', treeStyles[ability.tree].split(' ')[2])} />
                        <span>{ability.name}</span>
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
        Equip unlocked active abilities to your loadout. Slots increase at levels 5, 11, and 17.
      </p>
    </div>
  );
}
