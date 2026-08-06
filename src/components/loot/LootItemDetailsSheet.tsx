// Loot Item Details Sheet
// Click-to-open panel showing description, effect, and dice mechanics

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Sword,
  Shield,
  Gem,
  Coins,
  Zap,
  Package,
  X,
  Trash2,
  DollarSign,
  Copy,
  Check,
  Users,
  Scroll,
  Sparkles,
  Dices,
  Clock,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { LootItem, lootRarityConfig, lootCategoryConfig, LootCategory } from '@/lib/loot/types';

const CATEGORY_ICONS: Record<LootCategory, React.ElementType> = {
  weapon: Sword,
  armor: Shield,
  trinket: Gem,
  treasure: Coins,
  usable: Zap,
  miscellaneous: Package,
};

interface LootItemDetailsSheetProps {
  item: LootItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterName: string;
  onDelete?: (itemId: string) => void;
  onSell?: (itemId: string) => void;
  onUse?: (item: LootItem) => void;
  onCopyPrompt?: (item: LootItem) => void;
  onShareToParty?: (item: LootItem) => void;
  isSelling?: boolean;
}

export function LootItemDetailsSheet({
  item,
  open,
  onOpenChange,
  characterName,
  onDelete,
  onSell,
  onUse,
  onCopyPrompt,
  onShareToParty,
  isSelling = false,
}: LootItemDetailsSheetProps) {
  const rarityConf = useMemo(() => item ? lootRarityConfig[item.rarity] : null, [item]);
  const categoryConf = useMemo(() => item ? lootCategoryConfig[item.category] : null, [item]);
  const Icon = useMemo(() => item ? CATEGORY_ICONS[item.category] : Package, [item]);

  if (!item || !rarityConf || !categoryConf) return null;

  const mechanics = item.mechanics;
  const hasMechanics = !!mechanics && (
    mechanics.damage ||
    mechanics.ac !== undefined ||
    mechanics.effect ||
    mechanics.duration ||
    mechanics.savingThrow ||
    mechanics.diceRoll ||
    (mechanics.properties && mechanics.properties.length > 0)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] sm:h-auto sm:max-h-[85vh] rounded-t-2xl border-t border-border/50 bg-glass/95 backdrop-blur-xl flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-5 pt-6 pb-4 border-b border-border/30 text-left space-y-3">
          <div className="flex items-start gap-4">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg",
              categoryConf.bgColor,
              categoryConf.color
            )}>
              <Icon className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <SheetTitle className="text-xl font-cinzel leading-tight pr-8">
                {item.name}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={cn("text-[11px]", rarityConf.color, rarityConf.borderColor)}
                >
                  {rarityConf.label}
                </Badge>
                <Badge variant="secondary" className="text-[11px]">
                  {categoryConf.label}
                </Badge>
                {item.hasDiceMechanics && (
                  <Badge className="text-[11px] bg-cyan-500/20 text-cyan-400 border-cyan-500/50">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Dice
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Value pill */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="font-mono font-bold text-amber-400">{item.goldValue.toLocaleString()} gp</span>
            </div>
            {item.acquiredAt && (
              <span className="text-[11px] text-muted-foreground">
                Acquired {new Date(item.acquiredAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </SheetHeader>

        {/* Scrollable body */}
        <ScrollArea className="flex-1 px-5 py-4">
          <div className="space-y-5 pb-24">
            {/* Description */}
            <Section icon={Scroll} title="Description">
              <p className="text-sm text-foreground leading-relaxed">
                {item.description || 'No description available.'}
              </p>
            </Section>

            {/* Lore */}
            {item.lore && (
              <Section icon={Scroll} title="Lore" className="border-purple-500/20">
                <p className="text-sm text-purple-200/80 leading-relaxed italic">
                  {item.lore}
                </p>
              </Section>
            )}

            {/* Mechanics */}
            {hasMechanics && (
              <Section icon={Dices} title="Mechanics">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {mechanics?.damage && (
                    <MechanicTile
                      icon={Sword}
                      label="Damage"
                      value={mechanics.damage}
                      color="red"
                    />
                  )}
                  {mechanics?.ac !== undefined && (
                    <MechanicTile
                      icon={Shield}
                      label="Armor Class"
                      value={`+${mechanics.ac} AC`}
                      color="blue"
                    />
                  )}
                  {mechanics?.effect && (
                    <MechanicTile
                      icon={Zap}
                      label="Effect"
                      value={mechanics.effect}
                      color="cyan"
                      wide
                    />
                  )}
                  {mechanics?.duration && (
                    <MechanicTile
                      icon={Clock}
                      label="Duration"
                      value={mechanics.duration}
                      color="amber"
                    />
                  )}
                  {mechanics?.savingThrow && (
                    <MechanicTile
                      icon={ShieldAlert}
                      label="Save"
                      value={mechanics.savingThrow}
                      color="orange"
                    />
                  )}
                  {mechanics?.diceRoll && (
                    <MechanicTile
                      icon={Dices}
                      label="Dice Roll"
                      value={mechanics.diceRoll}
                      color="purple"
                    />
                  )}
                </div>
                {mechanics?.properties && mechanics.properties.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {mechanics.properties.map((prop, i) => (
                      <Badge key={i} variant="outline" className="text-[11px]">
                        <Wrench className="w-3 h-3 mr-1" />
                        {prop}
                      </Badge>
                    ))}
                  </div>
                )}
              </Section>
            )}

            {/* Source / Chronicle */}
            {item.sourceText && (
              <Section icon={Scroll} title="Chronicle Source" className="border-border/30">
                <p className="text-xs text-muted-foreground italic leading-relaxed border-l-2 border-border/50 pl-3">
                  "{item.sourceText}"
                </p>
              </Section>
            )}

            {/* AI generation notice */}
            {item.aiGenerated && (
              <div className="flex flex-wrap gap-2">
                {item.aiGenerated.description && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    AI description
                  </Badge>
                )}
                {item.aiGenerated.mechanics && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    AI mechanics
                  </Badge>
                )}
                {item.aiGenerated.goldValue && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    AI value
                  </Badge>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border/30 bg-glass/95 backdrop-blur-xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {item.category === 'usable' && onUse && (
              <ActionButton
                onClick={() => { onUse(item); onOpenChange(false); }}
                icon={Zap}
                label="Use"
                className="bg-cyan-600 hover:bg-cyan-500 text-white"
              />
            )}
            {onCopyPrompt && (
              <ActionButton
                onClick={() => onCopyPrompt(item)}
                icon={Copy}
                label="Copy Prompt"
              />
            )}
            {onShareToParty && (
              <ActionButton
                onClick={() => { onShareToParty(item); onOpenChange(false); }}
                icon={Users}
                label="Share"
              />
            )}
            {onSell && (
              <ActionButton
                onClick={() => { onSell(item.id); onOpenChange(false); }}
                icon={DollarSign}
                label={`Sell ${item.goldValue}g`}
                disabled={isSelling}
                className="border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
              />
            )}
            {onDelete && (
              <ActionButton
                onClick={() => { onDelete(item.id); onOpenChange(false); }}
                icon={Trash2}
                label="Delete"
                className="text-destructive hover:bg-destructive/10 border-destructive/30"
              />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface SectionProps {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  className?: string;
}

function Section({ icon: Icon, title, children, className }: SectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-4 rounded-xl border border-border/30 bg-card/40",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
      </div>
      {children}
    </motion.div>
  );
}

interface MechanicTileProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'red' | 'blue' | 'cyan' | 'amber' | 'orange' | 'purple';
  wide?: boolean;
}

const COLOR_MAP = {
  red: 'bg-red-500/10 text-red-400 border-red-500/30',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
};

function MechanicTile({ icon: Icon, label, value, color, wide }: MechanicTileProps) {
  return (
    <div className={cn(
      "p-3 rounded-lg border flex items-start gap-3",
      COLOR_MAP[color],
      wide && "sm:col-span-2"
    )}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider opacity-80 mb-0.5">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  );
}

interface ActionButtonProps {
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  disabled?: boolean;
  className?: string;
}

function ActionButton({ onClick, icon: Icon, label, disabled, className }: ActionButtonProps) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-10 text-xs font-medium w-full",
        className
      )}
    >
      <Icon className="w-3.5 h-3.5 mr-1.5" />
      {label}
    </Button>
  );
}
