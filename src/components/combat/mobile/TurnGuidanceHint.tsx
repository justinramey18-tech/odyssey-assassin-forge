import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lightbulb, 
  X,
  Zap,
  Shield,
  Sword,
  Footprints,
} from 'lucide-react';
import { ActionEconomy } from '@/lib/combat/combatTypes';
import { Ability } from '@/lib/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface TurnGuidanceHintProps {
  economy: ActionEconomy;
  unlockedAbilities: (Ability & { tier: 1 | 2 | 3 })[];
  isHidden: boolean;
  hasAdvantage: boolean;
  nearAlly: boolean;
  cooldownStateMap: Map<string, { isOnCooldown: boolean; remaining: number; total: number }>;
  onNavigateToTab?: (tab: string) => void;
  disabled?: boolean;
}

interface Suggestion {
  id: string;
  type: 'action' | 'bonus' | 'reaction' | 'movement' | 'tactical';
  icon: React.ReactNode;
  title: string;
  description: string;
  priority: number; // Higher = more important
  tabTarget?: string;
}

export function TurnGuidanceHint({
  economy,
  unlockedAbilities,
  isHidden,
  hasAdvantage,
  nearAlly,
  cooldownStateMap,
  onNavigateToTab,
  disabled = false,
}: TurnGuidanceHintProps) {
  const [showSheet, setShowSheet] = useState(false);

  // Generate suggestions based on current state
  const suggestions = useMemo((): Suggestion[] => {
    const result: Suggestion[] = [];

    // Check for unused bonus action opportunities
    if (!economy.bonusActionUsed) {
      // Cunning Action: Hide
      if (!isHidden) {
        result.push({
          id: 'cunning-hide',
          type: 'bonus',
          icon: <Zap className="w-4 h-4 text-amber-400" />,
          title: 'Use Cunning Action: Hide',
          description: 'You can use your Bonus Action to Hide. Being hidden grants advantage on your next attack and enables Sneak Attack.',
          priority: isHidden ? 5 : 8, // Higher priority if not hidden
          tabTarget: 'stealth',
        });
      }

      // Check for bonus action abilities off cooldown
      const bonusAbilities = unlockedAbilities.filter(a => 
        a.actionType === 'bonus_action' && 
        !cooldownStateMap.get(a.id)?.isOnCooldown
      );
      
      bonusAbilities.forEach(ability => {
        result.push({
          id: `ability-${ability.id}`,
          type: 'bonus',
          icon: <Zap className="w-4 h-4 text-amber-400" />,
          title: `Use ${ability.name}`,
          description: `Your ${ability.name} ability is ready and costs a Bonus Action.`,
          priority: 6,
          tabTarget: 'abilities',
        });
      });
    }

    // Check for unused reaction
    if (!economy.reactionUsed) {
      const reactionAbilities = unlockedAbilities.filter(a => 
        a.actionType === 'reaction' && 
        !cooldownStateMap.get(a.id)?.isOnCooldown
      );
      
      if (reactionAbilities.length > 0) {
        result.push({
          id: 'reaction-ready',
          type: 'reaction',
          icon: <Shield className="w-4 h-4 text-cyan-400" />,
          title: 'Reaction Available',
          description: `You have ${reactionAbilities.length} reaction${reactionAbilities.length > 1 ? 's' : ''} ready. Consider Uncanny Dodge or an Attack of Opportunity.`,
          priority: 4,
          tabTarget: 'reactions',
        });
      }
    }

    // Unused main action
    if (!economy.actionUsed) {
      // Sneak attack opportunity
      if ((hasAdvantage || nearAlly) && !isHidden) {
        result.push({
          id: 'sneak-attack',
          type: 'action',
          icon: <Sword className="w-4 h-4 text-red-400" />,
          title: 'Sneak Attack Ready!',
          description: hasAdvantage 
            ? 'You have advantage - Sneak Attack damage applies!' 
            : 'An ally is near your target - Sneak Attack applies!',
          priority: 9,
          tabTarget: 'attacks',
        });
      }

      // Assassinate if hidden
      if (isHidden) {
        result.push({
          id: 'assassinate',
          type: 'action',
          icon: <Sword className="w-4 h-4 text-red-500" />,
          title: 'Assassinate Available!',
          description: 'You are hidden! Attack now for automatic critical hit + Sneak Attack.',
          priority: 10,
          tabTarget: 'attacks',
        });
      }
    }

    // Movement reminder
    if (economy.movementUsed === 0 && economy.maxMovement > 0) {
      result.push({
        id: 'movement',
        type: 'movement',
        icon: <Footprints className="w-4 h-4 text-green-400" />,
        title: 'Full Movement Available',
        description: `You have ${economy.maxMovement}ft of movement remaining.`,
        priority: 2,
      });
    }

    // Sort by priority (highest first)
    return result.sort((a, b) => b.priority - a.priority);
  }, [economy, unlockedAbilities, isHidden, hasAdvantage, nearAlly, cooldownStateMap]);

  const topSuggestion = suggestions[0];

  if (disabled || suggestions.length === 0) {
    return null;
  }

  return (
    <>
      {/* Floating hint indicator */}
      <AnimatePresence>
        {topSuggestion && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setShowSheet(true)}
            className={cn(
              "fixed bottom-[140px] right-3 z-50",
              "w-10 h-10 rounded-full",
              "bg-amber-500/20 border border-amber-500/50",
              "flex items-center justify-center",
              "shadow-[0_0_15px_hsl(40_100%_50%/0.3)]",
              "active:scale-95 transition-transform"
            )}
          >
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [1, 0.7, 1]
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Lightbulb className="w-5 h-5 text-amber-400" />
            </motion.div>
            {suggestions.length > 1 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[10px] text-background font-bold flex items-center justify-center">
                {suggestions.length}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Suggestions Sheet */}
      <Sheet open={showSheet} onOpenChange={setShowSheet}>
        <SheetContent side="bottom" className="max-h-[60vh] rounded-t-2xl pb-safe">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <SheetHeader>
            <SheetTitle className="font-cinzel text-amber-400 flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Turn Suggestions
            </SheetTitle>
            <SheetDescription className="sr-only">Suggested actions for your turn</SheetDescription>
          </SheetHeader>
          
          <div className="space-y-3 mt-4 max-h-[40vh] overflow-y-auto overscroll-contain">
            {suggestions.map((suggestion, index) => (
              <motion.div
                key={suggestion.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (suggestion.tabTarget && onNavigateToTab) {
                      onNavigateToTab(suggestion.tabTarget);
                    }
                    setShowSheet(false);
                  }}
                  className={cn(
                    "w-full h-auto py-3 px-4 justify-start text-left",
                    "bg-muted/10 hover:bg-muted/20 border border-muted/20",
                    index === 0 && "border-amber-500/30 bg-amber-500/10"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{suggestion.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{suggestion.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 whitespace-normal">
                        {suggestion.description}
                      </div>
                    </div>
                    {suggestion.tabTarget && (
                      <span className="text-[10px] text-muted-foreground uppercase">
                        → {suggestion.tabTarget}
                      </span>
                    )}
                  </div>
                </Button>
              </motion.div>
            ))}
          </div>

          <Button
            variant="ghost"
            onClick={() => setShowSheet(false)}
            className="w-full mt-4 text-muted-foreground"
          >
            <X className="w-4 h-4 mr-2" />
            Dismiss
          </Button>
        </SheetContent>
      </Sheet>
    </>
  );
}
