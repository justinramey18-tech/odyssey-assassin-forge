import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  Compass, 
  ChevronDown, 
  ChevronUp,
  Sword,
  Zap,
  Shield,
  Eye,
  Heart,
  Sparkles,
  Target,
  Moon,
} from 'lucide-react';
import { ActionEconomy } from '@/lib/combat/combatTypes';
import { Ability } from '@/lib/types';

export interface TurnSuggestion {
  id: string;
  priority: 'high' | 'medium' | 'low';
  icon: React.ReactNode;
  title: string;
  description: string;
  actionType: 'action' | 'bonus' | 'reaction' | 'free';
  onExecute?: () => void;
}

interface TurnWizardPanelProps {
  economy: ActionEconomy;
  conditions: string[];
  unlockedAbilities: (Ability & { tier: 1 | 2 | 3 })[];
  cooldownState: Map<string, { isOnCooldown: boolean; remaining: number }>;
  hasWeapons: boolean;
  currentHP?: number;
  maxHP?: number;
  sneakAttackAvailable?: boolean;
  onSuggestAttack?: () => void;
  onSuggestHide?: () => void;
  onSuggestAbility?: (ability: Ability & { tier: 1 | 2 | 3 }) => void;
}

export function TurnWizardPanel({
  economy,
  conditions,
  unlockedAbilities,
  cooldownState,
  hasWeapons,
  currentHP = 100,
  maxHP = 100,
  sneakAttackAvailable = false,
  onSuggestAttack,
  onSuggestHide,
  onSuggestAbility,
}: TurnWizardPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Generate contextual suggestions
  const suggestions = useMemo(() => {
    const result: TurnSuggestion[] = [];
    const hpPercent = (currentHP / maxHP) * 100;
    const isHidden = conditions.includes('hidden');
    const isInvisible = conditions.includes('invisible');
    const isPoisoned = conditions.includes('poisoned');
    const isFrightened = conditions.includes('frightened');

    // Get ready abilities (not on cooldown)
    const readyAbilities = unlockedAbilities.filter(a => {
      const cd = cooldownState.get(a.id);
      return !cd?.isOnCooldown && a.type !== 'passive';
    });

    const actionAbilities = readyAbilities.filter(a => a.actionType === 'action');
    const bonusAbilities = readyAbilities.filter(a => a.actionType === 'bonus_action');
    const reactionAbilities = readyAbilities.filter(a => a.actionType === 'reaction');

    // === HIGH PRIORITY SUGGESTIONS ===

    // If hidden/invisible and action available, suggest sneak attack
    if ((isHidden || isInvisible) && !economy.actionUsed && hasWeapons) {
      result.push({
        id: 'sneak-attack',
        priority: 'high',
        icon: <Target className="w-4 h-4 text-green-400" />,
        title: 'Strike from Shadows!',
        description: 'You have advantage - use Sneak Attack for massive damage',
        actionType: 'action',
        onExecute: onSuggestAttack,
      });
    }

    // Low HP warning - suggest defensive action
    if (hpPercent <= 25 && !economy.bonusActionUsed) {
      const hideAbility = bonusAbilities.find(a => 
        a.id.includes('hide') || a.id.includes('vanish') || a.id.includes('cunning')
      );
      
      result.push({
        id: 'low-hp-hide',
        priority: 'high',
        icon: <Heart className="w-4 h-4 text-red-400" />,
        title: 'Critical HP! Take Cover',
        description: hideAbility 
          ? `Use ${hideAbility.name} to disengage and hide`
          : 'Consider using Cunning Action to Hide or Disengage',
        actionType: 'bonus',
        onExecute: hideAbility ? () => onSuggestAbility?.(hideAbility) : onSuggestHide,
      });
    }

    // === MEDIUM PRIORITY - Action suggestions ===

    if (!economy.actionUsed) {
      // If not hidden and has weapons, suggest attack
      if (!isHidden && hasWeapons && result.length === 0) {
        result.push({
          id: 'basic-attack',
          priority: 'medium',
          icon: <Sword className="w-4 h-4 text-red-400" />,
          title: 'Attack',
          description: sneakAttackAvailable 
            ? 'Ally nearby - Sneak Attack available!'
            : 'Standard weapon attack',
          actionType: 'action',
          onExecute: onSuggestAttack,
        });
      }

      // Suggest a ready action ability
      if (actionAbilities.length > 0 && result.filter(r => r.actionType === 'action').length < 2) {
        const suggested = actionAbilities[0];
        result.push({
          id: `ability-${suggested.id}`,
          priority: 'medium',
          icon: <Sparkles className="w-4 h-4 text-amber-400" />,
          title: suggested.name,
          description: `${suggested.tree} ability ready (Tier ${suggested.tier})`,
          actionType: 'action',
          onExecute: () => onSuggestAbility?.(suggested),
        });
      }
    }

    // === BONUS ACTION suggestions ===

    if (!economy.bonusActionUsed) {
      // If not hidden and no action used yet, suggest hiding first
      if (!isHidden && !economy.actionUsed) {
        result.push({
          id: 'cunning-hide',
          priority: 'medium',
          icon: <Moon className="w-4 h-4 text-purple-400" />,
          title: 'Hide First',
          description: 'Cunning Action: Hide for advantage on your attack',
          actionType: 'bonus',
          onExecute: onSuggestHide,
        });
      }

      // Suggest a ready bonus action ability
      if (bonusAbilities.length > 0) {
        const suggested = bonusAbilities.find(a => 
          !a.id.includes('hide') && !a.id.includes('vanish')
        ) || bonusAbilities[0];
        
        if (suggested && !result.find(r => r.id.includes(suggested.id))) {
          result.push({
            id: `bonus-${suggested.id}`,
            priority: 'low',
            icon: <Zap className="w-4 h-4 text-amber-400" />,
            title: suggested.name,
            description: `Bonus action ability ready`,
            actionType: 'bonus',
            onExecute: () => onSuggestAbility?.(suggested),
          });
        }
      }
    }

    // === REACTION reminder ===
    
    if (!economy.reactionUsed && reactionAbilities.length > 0) {
      result.push({
        id: 'reaction-ready',
        priority: 'low',
        icon: <Shield className="w-4 h-4 text-cyan-400" />,
        title: 'Reaction Ready',
        description: `${reactionAbilities.length} reaction(s) available if triggered`,
        actionType: 'reaction',
      });
    }

    // === ALL USED - suggest end turn ===

    if (economy.actionUsed && economy.bonusActionUsed) {
      result.push({
        id: 'end-turn',
        priority: 'low',
        icon: <Compass className="w-4 h-4 text-primary" />,
        title: 'Turn Complete',
        description: 'All main actions used - consider ending your turn',
        actionType: 'free',
      });
    }

    // Sort by priority and limit to 3
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return result
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
      .slice(0, 3);
  }, [
    economy, 
    conditions, 
    unlockedAbilities, 
    cooldownState, 
    hasWeapons, 
    currentHP, 
    maxHP,
    sneakAttackAvailable,
    onSuggestAttack,
    onSuggestHide,
    onSuggestAbility,
  ]);

  if (dismissed || suggestions.length === 0) return null;

  const priorityColors = {
    high: 'border-red-500/50 bg-red-500/10',
    medium: 'border-amber-500/50 bg-amber-500/10',
    low: 'border-muted/30 bg-muted/10',
  };

  const actionBadgeColors = {
    action: 'bg-red-500/20 text-red-300',
    bonus: 'bg-amber-500/20 text-amber-300',
    reaction: 'bg-cyan-500/20 text-cyan-300',
    free: 'bg-muted/20 text-muted-foreground',
  };

  return (
    <div className="mx-4 mb-2">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-primary/10 to-transparent border border-primary/30 rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono text-primary">TURN WIZARD</span>
          <span className="text-[10px] text-muted-foreground">
            {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
            }}
            className="text-[10px] text-muted-foreground hover:text-foreground px-2"
          >
            HIDE
          </button>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Suggestions */}
      {isExpanded && (
        <div className="border border-t-0 border-primary/30 rounded-b-lg overflow-hidden divide-y divide-muted/20">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              onClick={suggestion.onExecute}
              disabled={!suggestion.onExecute}
              className={cn(
                "w-full flex items-start gap-3 p-3 text-left transition-all",
                suggestion.onExecute && "hover:bg-muted/10 active:scale-[0.99]",
                !suggestion.onExecute && "opacity-70"
              )}
            >
              <div className={cn(
                "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                priorityColors[suggestion.priority]
              )}>
                {suggestion.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{suggestion.title}</span>
                  <span className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded-full uppercase font-mono",
                    actionBadgeColors[suggestion.actionType]
                  )}>
                    {suggestion.actionType}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  {suggestion.description}
                </p>
              </div>
              {suggestion.onExecute && (
                <ChevronDown className="w-4 h-4 text-muted-foreground rotate-[-90deg] flex-shrink-0 mt-1" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
