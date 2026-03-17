import { useState } from 'react';
import { 
  Beaker, 
  Skull, 
  ScrollText, 
  Copy, 
  Check, 
  Minus, 
  Plus,
  ChevronDown,
  ChevronUp,
  Package,
  Sparkles,
  Coins
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  Consumable, 
  InventoryItem, 
  rarityConfig, 
  typeConfig 
} from '@/lib/consumables/types';
import { generateConsumablePrompt } from '@/lib/consumables/prompts';
import { getIconByName } from '@/lib/iconUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ConsumableCardProps {
  item: InventoryItem;
  characterName: string;
  onUse: (id: string) => void;
  onAdjustQuantity: (id: string, delta: number) => void;
  onSell?: (consumableId: string, quantity: number) => void;
  compact?: boolean;
}

function ConsumableCard({ 
  item, 
  characterName, 
  onUse, 
  onAdjustQuantity,
  onSell,
  compact = false 
}: ConsumableCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  
  const { consumable, quantity } = item;
  const rarity = rarityConfig[consumable.rarity];
  const ItemIcon = getIconByName(consumable.icon);
  
  const handleCopyPrompt = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const prompt = generateConsumablePrompt(consumable, characterName);
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast.success('AI prompt copied!');
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleUse = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUse(consumable.id);
    toast.success(`Used ${consumable.name}`);
  };

  const TypeIcon = consumable.type === 'potion' ? Beaker 
    : consumable.type === 'poison' ? Skull 
    : ScrollText;

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 p-2 rounded-lg border transition-all',
          'bg-card/50 hover:bg-card',
          rarity.borderColor,
          rarity.glowColor,
          'shadow-sm hover:shadow-md'
        )}
      >
        {/* Icon */}
        <div className={cn(
          'w-8 h-8 rounded-md flex items-center justify-center shrink-0',
          rarity.bgColor
        )}>
          <ItemIcon className={cn('w-4 h-4', rarity.color)} />
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={cn('text-xs font-medium truncate', rarity.color)}>
            {consumable.name}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {consumable.effect}
          </p>
        </div>
        
        {/* Quantity Badge */}
        <Badge 
          variant="outline" 
          className={cn('shrink-0 text-xs px-1.5', rarity.color, rarity.borderColor)}
        >
          ×{quantity}
        </Badge>
        
        {/* Quick Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={handleCopyPrompt}
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-400" />
            ) : (
              <Copy className="w-3 h-3 text-muted-foreground" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20"
            onClick={handleUse}
            disabled={quantity <= 0}
          >
            <Sparkles className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div
        className={cn(
          'rounded-lg border transition-all overflow-hidden',
          'bg-gradient-to-br from-card/80 to-card/40',
          rarity.borderColor,
          rarity.glowColor,
          'shadow-md hover:shadow-lg'
        )}
      >
        {/* Header */}
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5 transition-colors">
            {/* Icon with glow effect */}
            <div className={cn(
              'relative w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
              rarity.bgColor,
              'ring-1',
              rarity.borderColor
            )}>
              <ItemIcon className={cn('w-5 h-5', rarity.color)} />
              <div className={cn(
                'absolute inset-0 rounded-lg opacity-50 blur-sm',
                rarity.bgColor
              )} />
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <p className={cn('font-semibold text-sm', rarity.color)}>
                  {consumable.name}
                </p>
                <TypeIcon className={cn('w-3 h-3', typeConfig[consumable.type].color)} />
              </div>
              <p className="text-xs text-muted-foreground">
                {rarity.label} • {consumable.duration}
              </p>
            </div>
            
            {/* Quantity */}
            <Badge 
              variant="outline" 
              className={cn('shrink-0', rarity.color, rarity.borderColor)}
            >
              ×{quantity}
            </Badge>
            
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
          </div>
        </CollapsibleTrigger>
        
        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 space-y-3 border-t border-border/50">
            {/* Effect */}
            <div className="pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Effect</p>
              <p className="text-sm text-foreground">{consumable.effect}</p>
            </div>
            
            {/* Description */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
              <p className="text-xs text-muted-foreground italic">{consumable.description}</p>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              {/* Quantity Adjuster */}
              <div className="flex items-center gap-1 bg-background/50 rounded-md p-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdjustQuantity(consumable.id, -1);
                  }}
                  disabled={quantity <= 1}
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="w-6 text-center text-sm font-medium">{quantity}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdjustQuantity(consumable.id, 1);
                  }}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              
              {/* Copy Prompt */}
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={handleCopyPrompt}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy AI Prompt
                  </>
                )}
              </Button>
              
              {/* Use Button */}
              <Button
                size="sm"
                className={cn(
                  'gap-1.5',
                  rarity.bgColor,
                  rarity.color,
                  'border',
                  rarity.borderColor,
                  'hover:opacity-80'
                )}
                onClick={handleUse}
                disabled={quantity <= 0}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Use
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface ConsumablesInventoryWidgetProps {
  inventory: InventoryItem[];
  characterName: string;
  onUseItem: (id: string) => void;
  onAdjustQuantity: (id: string, delta: number) => void;
  compact?: boolean;
}

export function ConsumablesInventoryWidget({
  inventory,
  characterName,
  onUseItem,
  onAdjustQuantity,
  compact = false,
}: ConsumablesInventoryWidgetProps) {
  const [expandedType, setExpandedType] = useState<string | null>('potion');
  
  const potions = inventory.filter(i => i.consumable.type === 'potion');
  const poisons = inventory.filter(i => i.consumable.type === 'poison');
  const scrolls = inventory.filter(i => i.consumable.type === 'scroll');
  
  const totalItems = inventory.reduce((sum, i) => sum + i.quantity, 0);
  
  if (inventory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
        <Package className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-xs">No consumables in inventory</p>
        <p className="text-[10px] opacity-75">Add items from the full inventory</p>
      </div>
    );
  }

  const categories = [
    { type: 'potion' as const, items: potions, icon: Beaker, ...typeConfig.potion },
    { type: 'poison' as const, items: poisons, icon: Skull, ...typeConfig.poison },
    { type: 'scroll' as const, items: scrolls, icon: ScrollText, ...typeConfig.scroll },
  ].filter(c => c.items.length > 0);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Consumables
        </p>
        <Badge variant="outline" className="text-xs">
          {totalItems} items
        </Badge>
      </div>
      
      {/* Categories */}
      <div className="space-y-2">
        {categories.map(category => {
          const Icon = category.icon;
          const isExpanded = expandedType === category.type;
          const itemCount = category.items.reduce((sum, i) => sum + i.quantity, 0);
          
          return (
            <Collapsible 
              key={category.type}
              open={isExpanded}
              onOpenChange={() => setExpandedType(isExpanded ? null : category.type)}
            >
              <CollapsibleTrigger className="w-full">
                <div className={cn(
                  'flex items-center gap-2 p-2 rounded-lg transition-all',
                  'bg-card/30 hover:bg-card/50 border border-border/30',
                  isExpanded && 'bg-card/50 border-border/50'
                )}>
                  <div className={cn(
                    'w-6 h-6 rounded flex items-center justify-center',
                    category.bgColor
                  )}>
                    <Icon className={cn('w-3.5 h-3.5', category.color)} />
                  </div>
                  <span className="text-sm font-medium flex-1 text-left">
                    {category.label}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {itemCount}
                  </Badge>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="pt-2 space-y-2 pl-2">
                  {category.items.map(item => (
                    <ConsumableCard
                      key={item.consumable.id}
                      item={item}
                      characterName={characterName}
                      onUse={onUseItem}
                      onAdjustQuantity={onAdjustQuantity}
                      compact={compact}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
