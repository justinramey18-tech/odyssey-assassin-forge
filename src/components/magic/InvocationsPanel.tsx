// Warlock Invocations Panel
// UI for selecting and managing Eldritch Invocations

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { 
  Zap, Wand2, Shield, Gem, Check, Lock,
  ChevronDown, ChevronUp, Sparkles, Copy, Eye
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { UseInvocationsReturn, PactBoon } from '@/hooks/use-invocations';
import {
  EldritchInvocation,
  InvocationCategory,
  INVOCATION_CATEGORY_CONFIG,
} from '@/lib/classes/invocations';

interface InvocationsPanelProps {
  invocations: UseInvocationsReturn;
  warlockLevel: number;
  characterName?: string;
}

const CATEGORY_ICONS: Record<InvocationCategory, typeof Zap> = {
  eldritch_blast: Zap,
  at_will_spell: Wand2,
  passive: Shield,
  pact_boon: Gem,
};

const PACT_BOONS: { id: PactBoon; name: string; icon: string; description: string }[] = [
  { id: 'blade', name: 'Pact of the Blade', icon: '⚔️', description: 'Create a pact weapon' },
  { id: 'chain', name: 'Pact of the Chain', icon: '🔗', description: 'Enhanced familiar' },
  { id: 'tome', name: 'Pact of the Tome', icon: '📖', description: 'Book of Shadows with cantrips' },
];

export function InvocationsPanel({ invocations, warlockLevel, characterName }: InvocationsPanelProps) {
  const { toast } = useToast();
  const [expandedCategory, setExpandedCategory] = useState<InvocationCategory | null>(null);
  const [showAll, setShowAll] = useState(false);

  const {
    selectedInvocations,
    availableInvocations,
    maxInvocations,
    slotsRemaining,
    pactBoon,
    canSelect,
    isSelected,
    toggleInvocation,
    setPactBoon,
    eldritchBlastMods,
    atWillSpells,
    passiveBenefits,
  } = invocations;

  // Group available invocations by category
  const groupedInvocations = useMemo(() => {
    const source = showAll ? availableInvocations : selectedInvocations;
    const grouped: Record<InvocationCategory, EldritchInvocation[]> = {
      eldritch_blast: [],
      at_will_spell: [],
      passive: [],
      pact_boon: [],
    };
    source.forEach(inv => {
      grouped[inv.category].push(inv);
    });
    return grouped;
  }, [showAll, availableInvocations, selectedInvocations]);

  // Copy EB modifications summary
  const copyEBSummary = () => {
    if (eldritchBlastMods.length === 0) {
      toast({ title: 'No EB Modifications', description: 'Select Eldritch Blast invocations first.', variant: 'destructive' });
      return;
    }
    const lines = [
      `## Eldritch Blast Modifications (${characterName || 'Warlock'})`,
      '',
      ...eldritchBlastMods.map(mod => `- **${mod.name}:** ${mod.mechanicalEffect}`),
      '',
      `*Active invocations: ${selectedInvocations.length}/${maxInvocations}*`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    toast({ title: 'EB Mods Copied!', description: `${eldritchBlastMods.length} modifications copied`, className: 'border-purple-500 bg-purple-500/10' });
  };

  if (warlockLevel < 2) {
    return (
      <Card className="bg-background/40 border-white/10">
        <CardContent className="p-4 text-center">
          <Lock className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Eldritch Invocations unlock at Level 2</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with counter */}
      <Card className="bg-purple-950/40 border-purple-500/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h3 className="font-cinzel text-sm uppercase tracking-wider text-purple-300">
                Eldritch Invocations
              </h3>
            </div>
            <Badge 
              variant="outline" 
              className={cn(
                'font-mono',
                slotsRemaining > 0 ? 'border-purple-500/50 text-purple-400' : 'border-amber-500/50 text-amber-400'
              )}
            >
              {selectedInvocations.length}/{maxInvocations}
            </Badge>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2 mb-3">
            <Button
              variant={showAll ? 'ghost' : 'secondary'}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setShowAll(false)}
            >
              <Eye className="w-3 h-3 mr-1" />
              Active ({selectedInvocations.length})
            </Button>
            <Button
              variant={showAll ? 'secondary' : 'ghost'}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setShowAll(true)}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              All Available ({availableInvocations.length})
            </Button>
          </div>

          {/* Pact Boon Selector (Level 3+) */}
          {warlockLevel >= 3 && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-2">Pact Boon:</p>
              <div className="flex gap-2">
                {PACT_BOONS.map(boon => (
                  <button
                    key={boon.id}
                    onClick={() => setPactBoon(pactBoon === boon.id ? null : boon.id)}
                    className={cn(
                      'flex-1 p-2 rounded-lg border text-xs text-center transition-all',
                      pactBoon === boon.id
                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                        : 'border-white/10 bg-background/20 text-muted-foreground hover:border-white/20'
                    )}
                  >
                    <span className="block text-base mb-0.5">{boon.icon}</span>
                    <span className="block font-medium">{boon.name.replace('Pact of the ', '')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* EB Mods Quick Summary */}
          {eldritchBlastMods.length > 0 && !showAll && (
            <button
              onClick={copyEBSummary}
              className="w-full p-2 rounded-lg bg-purple-600/20 border border-purple-500/30 text-left hover:bg-purple-600/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-medium text-purple-300">Eldritch Blast Mods</span>
                <Copy className="w-3 h-3 text-purple-400/60 ml-auto" />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {eldritchBlastMods.map(m => m.name).join(' • ')}
              </p>
            </button>
          )}

          {/* At-Will Spells Summary */}
          {atWillSpells.length > 0 && !showAll && (
            <div className="mt-2 p-2 rounded-lg bg-blue-600/20 border border-blue-500/30">
              <div className="flex items-center gap-2 mb-1">
                <Wand2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-medium text-blue-300">At-Will Spells</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {atWillSpells.map(spell => (
                  <Badge key={spell.id} variant="outline" className="text-[10px] border-blue-500/30 text-blue-300">
                    {spell.grantsSpell}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invocations by Category */}
      {(Object.entries(groupedInvocations) as [InvocationCategory, EldritchInvocation[]][])
        .filter(([, invs]) => invs.length > 0)
        .map(([category, categoryInvocations]) => {
          const config = INVOCATION_CATEGORY_CONFIG[category];
          const CategoryIcon = CATEGORY_ICONS[category];
          const isExpanded = expandedCategory === category;

          return (
            <Collapsible
              key={category}
              open={isExpanded}
              onOpenChange={() => setExpandedCategory(isExpanded ? null : category)}
            >
              <CollapsibleTrigger className="w-full">
                <Card className="bg-background/40 border-white/10 hover:border-white/20 transition-colors">
                  <CardContent className="p-3 flex items-center gap-3">
                    <CategoryIcon className={cn('w-4 h-4', config.color)} />
                    <span className={cn('text-sm font-medium flex-1 text-left', config.color)}>
                      {config.label}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {categoryInvocations.filter(i => isSelected(i.id)).length}/{categoryInvocations.length}
                    </Badge>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1 mt-1">
                  {categoryInvocations.map(inv => {
                    const selected = isSelected(inv.id);
                    const canPick = canSelect(inv);
                    const locked = !canPick && !selected;

                    return (
                      <button
                        key={inv.id}
                        onClick={() => {
                          if (locked) {
                            toast({
                              title: 'Cannot Select',
                              description: inv.prerequisite
                                ? `Requires: ${inv.prerequisite}`
                                : `Requires warlock level ${inv.levelRequirement}`,
                              variant: 'destructive',
                            });
                            return;
                          }
                          toggleInvocation(inv.id);
                        }}
                        className={cn(
                          'w-full p-3 rounded-lg border text-left transition-all',
                          selected
                            ? 'border-purple-500/50 bg-purple-500/15'
                            : locked
                              ? 'border-white/5 bg-background/20 opacity-50'
                              : 'border-white/10 bg-background/30 hover:border-white/20'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className={cn(
                            'w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5',
                            selected
                              ? 'border-purple-500 bg-purple-500'
                              : locked
                                ? 'border-white/20'
                                : 'border-white/30'
                          )}>
                            {selected && <Check className="w-3 h-3 text-white" />}
                            {locked && <Lock className="w-2.5 h-2.5 text-muted-foreground/50" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'text-sm font-medium',
                                selected ? 'text-purple-300' : 'text-foreground/80'
                              )}>
                                {inv.name}
                              </span>
                              {inv.levelRequirement > 2 && (
                                <Badge variant="outline" className="text-[9px] py-0">
                                  Lv{inv.levelRequirement}+
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                              {inv.mechanicalEffect}
                            </p>
                            {inv.prerequisite && (
                              <p className="text-[10px] text-amber-400/70 mt-0.5 italic">
                                Requires: {inv.prerequisite}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
    </div>
  );
}
