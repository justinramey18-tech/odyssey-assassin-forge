// Cleric Domain Panel
// Displays Divine Domain selection and domain-specific features

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Heart,
  Sun,
  Swords,
  BookOpen,
  Leaf,
  CloudLightning,
  Drama,
  Skull,
  ChevronRight,
  Sparkles,
  Check,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ClericDomain,
  ALL_DOMAINS,
  getDomainById,
  getDomainBonusSpells,
  getDomainChannelDivinity,
  getDomainFeaturesForLevel,
} from '@/lib/classes/clericDomains';

// Icon mapping
const DOMAIN_ICONS: Record<ClericDomain, React.ComponentType<{ className?: string }>> = {
  life: Heart,
  light: Sun,
  war: Swords,
  knowledge: BookOpen,
  nature: Leaf,
  tempest: CloudLightning,
  trickery: Drama,
  death: Skull,
};

// Theme colors
const DOMAIN_COLORS: Record<ClericDomain, string> = {
  life: 'green',
  light: 'yellow',
  war: 'red',
  knowledge: 'blue',
  nature: 'emerald',
  tempest: 'sky',
  trickery: 'purple',
  death: 'slate',
};

interface ClericDomainPanelProps {
  clericLevel: number;
  selectedDomain: ClericDomain | null;
  onSelectDomain: (domain: ClericDomain) => void;
  compact?: boolean;
}

export function ClericDomainPanel({
  clericLevel,
  selectedDomain,
  onSelectDomain,
  compact = false,
}: ClericDomainPanelProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const domainConfig = selectedDomain ? getDomainById(selectedDomain) : null;
  const bonusSpells = selectedDomain ? getDomainBonusSpells(selectedDomain, clericLevel) : [];
  const channelDivinity = selectedDomain ? getDomainChannelDivinity(selectedDomain, clericLevel) : [];
  const features = selectedDomain ? getDomainFeaturesForLevel(selectedDomain, clericLevel) : [];

  const DomainIcon = selectedDomain ? DOMAIN_ICONS[selectedDomain] : Sparkles;
  const themeColor = selectedDomain ? DOMAIN_COLORS[selectedDomain] : 'primary';

  if (compact) {
    return (
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <button className="flex items-center gap-2 p-2 rounded-lg bg-background/30 hover:bg-background/50 transition-colors w-full text-left">
            <DomainIcon className={cn('w-4 h-4', selectedDomain ? `text-${themeColor}-400` : 'text-muted-foreground')} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {domainConfig?.name ?? 'Choose Domain'}
              </p>
              {domainConfig && (
                <p className="text-[10px] text-muted-foreground">{domainConfig.subtitle}</p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh] bg-background/95">
          <SheetHeader>
            <SheetTitle>Divine Domain</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-full mt-4 pr-4">
            <DomainSelectionContent
              clericLevel={clericLevel}
              selectedDomain={selectedDomain}
              onSelectDomain={(d) => {
                onSelectDomain(d);
                setIsSheetOpen(false);
              }}
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Card className="bg-background/40 border-yellow-900/30">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              selectedDomain ? `bg-${themeColor}-500/20 border border-${themeColor}-500/50` : 'bg-muted/30 border border-muted/50'
            )}>
              <DomainIcon className={cn('w-4 h-4', selectedDomain ? `text-${themeColor}-400` : 'text-muted-foreground')} />
            </div>
            <div>
              <h3 className="font-cinzel text-sm text-foreground">
                {domainConfig?.name ?? 'Divine Domain'}
              </h3>
              {domainConfig && (
                <p className="text-[10px] text-muted-foreground">{domainConfig.subtitle}</p>
              )}
            </div>
          </div>

          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs">
                {selectedDomain ? 'Change' : 'Choose'}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] bg-background/95">
              <SheetHeader>
                <SheetTitle>Choose Divine Domain</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-full mt-4 pr-4">
                <DomainSelectionContent
                  clericLevel={clericLevel}
                  selectedDomain={selectedDomain}
                  onSelectDomain={(d) => {
                    onSelectDomain(d);
                    setIsSheetOpen(false);
                  }}
                />
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>

        {/* Domain Description */}
        {domainConfig && (
          <p className="text-xs text-muted-foreground">{domainConfig.description}</p>
        )}

        {/* Bonus Proficiencies */}
        {domainConfig?.bonusProficiencies && domainConfig.bonusProficiencies.length > 0 && (
          <div className="p-2 rounded bg-muted/20">
            <p className="text-[10px] text-muted-foreground uppercase mb-1">Bonus Proficiencies</p>
            <div className="flex flex-wrap gap-1">
              {domainConfig.bonusProficiencies.map(prof => (
                <Badge key={prof} variant="outline" className="text-[10px]">{prof}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Domain Spells */}
        {bonusSpells.length > 0 && (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-[10px] text-muted-foreground uppercase mb-2">Domain Spells (Always Prepared)</p>
            <div className="flex flex-wrap gap-1">
              {bonusSpells.map(spell => (
                <Badge key={spell.spellId} variant="secondary" className="text-[10px] bg-yellow-500/20 text-yellow-300">
                  {spell.spellName}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Channel Divinity Options */}
        {channelDivinity.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase">Channel Divinity Options</p>
            {channelDivinity.map(cd => (
              <div key={cd.id} className="p-2 rounded bg-yellow-500/5 border border-yellow-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-3 h-3 text-yellow-400" />
                  <span className="text-xs font-medium text-yellow-400">{cd.name}</span>
                </div>
                <p className="text-[10px] text-muted-foreground line-clamp-2">{cd.description}</p>
                {cd.mechanicalEffect && (
                  <p className="text-[10px] text-yellow-400/70 mt-1 italic">{cd.mechanicalEffect}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Domain Features */}
        {features.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase">Domain Features</p>
            {features.map(feature => (
              <div key={feature.id} className="p-2 rounded bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{feature.name}</span>
                  <Badge variant="outline" className="text-[10px]">Lv {feature.level}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// DOMAIN SELECTION CONTENT
// ============================================

interface DomainSelectionContentProps {
  clericLevel: number;
  selectedDomain: ClericDomain | null;
  onSelectDomain: (domain: ClericDomain) => void;
}

function DomainSelectionContent({
  clericLevel,
  selectedDomain,
  onSelectDomain,
}: DomainSelectionContentProps) {
  return (
    <div className="space-y-6 pb-8">
      {/* Domain Options */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground uppercase">Choose Your Divine Domain</h4>
        <div className="grid gap-3">
          {ALL_DOMAINS.map(domain => {
            const Icon = DOMAIN_ICONS[domain.id];
            const color = DOMAIN_COLORS[domain.id];
            const channelDivinity = getDomainChannelDivinity(domain.id, clericLevel);

            return (
              <button
                key={domain.id}
                onClick={() => onSelectDomain(domain.id)}
                className={cn(
                  "w-full p-4 rounded-lg border-2 text-left transition-all",
                  selectedDomain === domain.id
                    ? `border-${color}-500 bg-${color}-500/10`
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    `bg-${color}-500/20`
                  )}>
                    <Icon className={cn("w-5 h-5", `text-${color}-400`)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h5 className="font-medium text-foreground">{domain.name}</h5>
                      {selectedDomain === domain.id && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{domain.subtitle}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{domain.description}</p>

                    {/* Channel Divinity Preview */}
                    {channelDivinity.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {channelDivinity.map(cd => (
                          <Badge key={cd.id} variant="outline" className="text-[10px]">
                            <Zap className="w-2 h-2 mr-1" />
                            {cd.name}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Bonus Proficiencies */}
                    {domain.bonusProficiencies && domain.bonusProficiencies.length > 0 && (
                      <div className="mt-1 flex gap-1">
                        {domain.bonusProficiencies.map(prof => (
                          <Badge key={prof} variant="secondary" className="text-[10px]">
                            {prof}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Domain Features Preview */}
      {selectedDomain && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase">Domain Features</h4>
          {getDomainById(selectedDomain)?.features.map(feature => (
            <div
              key={feature.id}
              className={cn(
                "p-3 rounded-lg border",
                clericLevel >= feature.level
                  ? "border-primary/30 bg-primary/5"
                  : "border-muted/30 bg-muted/10 opacity-60"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-foreground">{feature.name}</span>
                <Badge
                  variant={clericLevel >= feature.level ? "default" : "outline"}
                  className="text-[10px]"
                >
                  Level {feature.level}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
