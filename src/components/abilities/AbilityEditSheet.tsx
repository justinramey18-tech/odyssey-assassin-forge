import { useState, useEffect } from 'react';
import { Ability, ActionType, UsageType, TierEffect } from '@/lib/types';
import { AbilityOverride, DICE_OPTIONS, SUGGESTED_ICONS, DieType } from '@/lib/abilityCustomization/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Pencil,
  Wand2,
  Dices,
  Timer,
  RotateCcw,
  Save,
  Trash2,
  Sparkles,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface AbilityEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ability: Ability;
  currentOverride?: AbilityOverride;
  onSave: (override: Partial<Omit<AbilityOverride, 'abilityId' | 'createdAt' | 'updatedAt'>>) => void;
  onReset: () => void;
}

const ACTION_TYPE_OPTIONS: { value: ActionType; label: string }[] = [
  { value: 'action', label: 'Action' },
  { value: 'bonus_action', label: 'Bonus Action' },
  { value: 'reaction', label: 'Reaction' },
  { value: 'passive', label: 'Passive' },
];

const USAGE_TYPE_OPTIONS: { value: UsageType; label: string }[] = [
  { value: 'at_will', label: 'At Will' },
  { value: 'short_rest', label: 'Short Rest' },
  { value: 'long_rest', label: 'Long Rest' },
];

export function AbilityEditSheet({
  open,
  onOpenChange,
  ability,
  currentOverride,
  onSave,
  onReset,
}: AbilityEditSheetProps) {
  // Local form state
  const [customName, setCustomName] = useState('');
  const [customIcon, setCustomIcon] = useState('');
  const [customActionType, setCustomActionType] = useState<ActionType | ''>('');
  const [customUsageType, setCustomUsageType] = useState<UsageType | ''>('');
  const [tier1Desc, setTier1Desc] = useState('');
  const [tier2Desc, setTier2Desc] = useState('');
  const [tier3Desc, setTier3Desc] = useState('');
  const [tier1DiceCount, setTier1DiceCount] = useState<number | ''>('');
  const [tier1Die, setTier1Die] = useState<DieType | ''>('');
  const [tier2DiceCount, setTier2DiceCount] = useState<number | ''>('');
  const [tier2Die, setTier2Die] = useState<DieType | ''>('');
  const [tier3DiceCount, setTier3DiceCount] = useState<number | ''>('');
  const [tier3Die, setTier3Die] = useState<DieType | ''>('');
  const [cooldownMinutes, setCooldownMinutes] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Reset form when ability changes or sheet opens
  useEffect(() => {
    if (open) {
      setCustomName(currentOverride?.customName || '');
      setCustomIcon(currentOverride?.customIcon || '');
      setCustomActionType(currentOverride?.customActionType || '');
      setCustomUsageType(currentOverride?.customUsageType || '');
      
      const tier1 = currentOverride?.customTierEffects?.find(t => t.tier === 1);
      const tier2 = currentOverride?.customTierEffects?.find(t => t.tier === 2);
      const tier3 = currentOverride?.customTierEffects?.find(t => t.tier === 3);
      setTier1Desc(tier1?.description || '');
      setTier2Desc(tier2?.description || '');
      setTier3Desc(tier3?.description || '');
      
      setTier1DiceCount(currentOverride?.customDice?.tier1?.count || '');
      setTier1Die(currentOverride?.customDice?.tier1?.die as DieType || '');
      setTier2DiceCount(currentOverride?.customDice?.tier2?.count || '');
      setTier2Die(currentOverride?.customDice?.tier2?.die as DieType || '');
      setTier3DiceCount(currentOverride?.customDice?.tier3?.count || '');
      setTier3Die(currentOverride?.customDice?.tier3?.die as DieType || '');
      
      setCooldownMinutes(currentOverride?.customCooldownMinutes ?? '');
      setNotes(currentOverride?.notes || '');
    }
  }, [open, ability.id, currentOverride]);

  const handleSave = () => {
    const tierEffects: { tier: 1 | 2 | 3; description: string }[] = [];
    if (tier1Desc.trim()) tierEffects.push({ tier: 1, description: tier1Desc.trim() });
    if (tier2Desc.trim()) tierEffects.push({ tier: 2, description: tier2Desc.trim() });
    if (tier3Desc.trim()) tierEffects.push({ tier: 3, description: tier3Desc.trim() });

    const customDice: AbilityOverride['customDice'] = {};
    if (tier1DiceCount && tier1Die) customDice.tier1 = { count: Number(tier1DiceCount), die: Number(tier1Die) };
    if (tier2DiceCount && tier2Die) customDice.tier2 = { count: Number(tier2DiceCount), die: Number(tier2Die) };
    if (tier3DiceCount && tier3Die) customDice.tier3 = { count: Number(tier3DiceCount), die: Number(tier3Die) };

    onSave({
      customName: customName.trim() || undefined,
      customIcon: customIcon || undefined,
      customActionType: customActionType || undefined,
      customUsageType: customUsageType || undefined,
      customTierEffects: tierEffects.length > 0 ? tierEffects : undefined,
      customDice: Object.keys(customDice).length > 0 ? customDice : undefined,
      customCooldownMinutes: cooldownMinutes !== '' ? Number(cooldownMinutes) : undefined,
      notes: notes.trim() || undefined,
    });
    onOpenChange(false);
  };

  const handleReset = () => {
    onReset();
    onOpenChange(false);
  };

  // Get the icon component dynamically
  const getIconComponent = (iconName: string) => {
    const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
    return icons[iconName] || LucideIcons.Sparkles;
  };
  const IconComponent = getIconComponent(customIcon || ability.icon);

  const hasChanges = customName || customIcon || customActionType || customUsageType ||
    tier1Desc || tier2Desc || tier3Desc ||
    tier1DiceCount || tier2DiceCount || tier3DiceCount ||
    cooldownMinutes !== '' || notes;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[85vh] rounded-t-2xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-2" />
        
        <SheetHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              ability.tree === 'hunter' && 'bg-hunter/20 text-hunter',
              ability.tree === 'warrior' && 'bg-warrior/20 text-warrior',
              ability.tree === 'assassin' && 'bg-assassin/20 text-assassin',
            )}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <SheetTitle className="font-cinzel flex items-center gap-2">
                {customName || ability.name}
                {currentOverride && (
                  <Badge variant="secondary" className="text-xs">
                    <Pencil className="w-3 h-3 mr-1" />
                    Customized
                  </Badge>
                )}
              </SheetTitle>
              <SheetDescription className="text-xs">
                Customize this ability for your homebrew build
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="basics" className="flex-1 flex flex-col h-[calc(100%-80px)]">
          <TabsList className="grid grid-cols-3 mb-2">
            <TabsTrigger value="basics" className="text-xs">
              <Wand2 className="w-3 h-3 mr-1" />
              Basics
            </TabsTrigger>
            <TabsTrigger value="effects" className="text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              Effects
            </TabsTrigger>
            <TabsTrigger value="mechanics" className="text-xs">
              <Dices className="w-3 h-3 mr-1" />
              Mechanics
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 pr-4">
            {/* BASICS TAB */}
            <TabsContent value="basics" className="space-y-4 mt-0">
              {/* Custom Name */}
              <div className="space-y-2">
                <Label htmlFor="customName">Custom Name</Label>
                <Input
                  id="customName"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={ability.name}
                  className="bg-muted/30"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to use the original name
                </p>
              </div>

              {/* Icon Selector */}
              <div className="space-y-2">
                <Label>Icon</Label>
                <div className="grid grid-cols-7 gap-1.5">
                  {SUGGESTED_ICONS.map((iconName) => {
                    const Icon = getIconComponent(iconName);
                    if (!Icon) return null;
                    return (
                      <button
                        key={iconName}
                        onClick={() => setCustomIcon(iconName === ability.icon ? '' : iconName)}
                        className={cn(
                          'w-9 h-9 rounded-md flex items-center justify-center transition-all',
                          'border hover:bg-muted/50',
                          (customIcon === iconName || (!customIcon && iconName === ability.icon))
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-muted/50 text-muted-foreground'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Personal Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this ability..."
                  className="bg-muted/30 min-h-[80px]"
                />
              </div>
            </TabsContent>

            {/* EFFECTS TAB */}
            <TabsContent value="effects" className="space-y-4 mt-0">
              <p className="text-xs text-muted-foreground mb-4">
                Customize the tier effect descriptions. Leave blank to use originals.
              </p>

              {ability.tierEffects.map((te, idx) => (
                <div key={te.tier} className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <span className={cn(
                      'w-5 h-5 rounded text-xs font-bold flex items-center justify-center',
                      te.tier === 1 && 'bg-amber-500/20 text-amber-400',
                      te.tier === 2 && 'bg-blue-500/20 text-blue-400',
                      te.tier === 3 && 'bg-purple-500/20 text-purple-400',
                    )}>
                      {te.tier}
                    </span>
                    Tier {te.tier} Effect
                  </Label>
                  <Textarea
                    value={idx === 0 ? tier1Desc : idx === 1 ? tier2Desc : tier3Desc}
                    onChange={(e) => {
                      if (idx === 0) setTier1Desc(e.target.value);
                      else if (idx === 1) setTier2Desc(e.target.value);
                      else setTier3Desc(e.target.value);
                    }}
                    placeholder={te.description}
                    className="bg-muted/30 min-h-[70px] text-sm"
                  />
                </div>
              ))}
            </TabsContent>

            {/* MECHANICS TAB */}
            <TabsContent value="mechanics" className="space-y-4 mt-0">
              {/* Action Type */}
              <div className="space-y-2">
                <Label>Action Type</Label>
                <Select
                  value={customActionType}
                  onValueChange={(v) => setCustomActionType(v as ActionType)}
                >
                  <SelectTrigger className="bg-muted/30">
                    <SelectValue placeholder={ACTION_TYPE_OPTIONS.find(o => o.value === ability.actionType)?.label || 'Select...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Usage Type */}
              <div className="space-y-2">
                <Label>Recovery</Label>
                <Select
                  value={customUsageType}
                  onValueChange={(v) => setCustomUsageType(v as UsageType)}
                >
                  <SelectTrigger className="bg-muted/30">
                    <SelectValue placeholder={USAGE_TYPE_OPTIONS.find(o => o.value === ability.usageType)?.label || 'Select...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {USAGE_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cooldown Override */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Timer className="w-4 h-4" />
                  Cooldown (minutes)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={cooldownMinutes}
                  onChange={(e) => setCooldownMinutes(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Use default"
                  className="bg-muted/30"
                />
                <p className="text-xs text-muted-foreground">
                  Set to 0 for no cooldown, or leave blank for default
                </p>
              </div>

              {/* Custom Dice */}
              {ability.type === 'active' && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Dices className="w-4 h-4" />
                    Custom Dice by Tier
                  </Label>
                  
                  {[1, 2, 3].map((tier) => (
                    <div key={tier} className="flex items-center gap-2">
                      <span className={cn(
                        'w-6 h-6 rounded text-xs font-bold flex items-center justify-center shrink-0',
                        tier === 1 && 'bg-amber-500/20 text-amber-400',
                        tier === 2 && 'bg-blue-500/20 text-blue-400',
                        tier === 3 && 'bg-purple-500/20 text-purple-400',
                      )}>
                        T{tier}
                      </span>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={tier === 1 ? tier1DiceCount : tier === 2 ? tier2DiceCount : tier3DiceCount}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : '';
                          if (tier === 1) setTier1DiceCount(val);
                          else if (tier === 2) setTier2DiceCount(val);
                          else setTier3DiceCount(val);
                        }}
                        placeholder="#"
                        className="w-14 bg-muted/30 text-center"
                      />
                      <span className="text-muted-foreground">d</span>
                      <Select
                        value={String(tier === 1 ? tier1Die : tier === 2 ? tier2Die : tier3Die) || ''}
                        onValueChange={(v) => {
                          const val = v ? Number(v) as DieType : '';
                          if (tier === 1) setTier1Die(val);
                          else if (tier === 2) setTier2Die(val);
                          else setTier3Die(val);
                        }}
                      >
                        <SelectTrigger className="w-20 bg-muted/30">
                          <SelectValue placeholder="die" />
                        </SelectTrigger>
                        <SelectContent>
                          {DICE_OPTIONS.map((die) => (
                            <SelectItem key={die} value={String(die)}>
                              d{die}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </ScrollArea>

          {/* Footer Actions */}
          <div className="flex gap-2 pt-4 border-t mt-2">
            {currentOverride && (
              <Button
                variant="ghost"
                onClick={handleReset}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Reset
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges && !currentOverride}>
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
