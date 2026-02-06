import { useState, useCallback } from 'react';
import { AbilityTree, ActionType, UsageType, TierEffect } from '@/lib/types';
import { HomebrewAbility, DICE_OPTIONS, SUGGESTED_ICONS, DieType } from '@/lib/abilityCustomization/types';
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
  Wand2,
  Dices,
  Timer,
  Save,
  Sparkles,
  Plus,
  Crosshair,
  Sword,
  Skull,
  Bot,
  Lightbulb,
  RefreshCw,
  Zap,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useHomebrewAssistant } from '@/hooks/use-homebrew-assistant';

interface HomebrewCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTree?: AbilityTree;
  onSave: (homebrew: Omit<HomebrewAbility, 'id' | 'createdAt' | 'updatedAt'>) => void;
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

const TREE_OPTIONS: { value: AbilityTree; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'hunter', label: 'Hunter', icon: Crosshair },
  { value: 'warrior', label: 'Warrior', icon: Sword },
  { value: 'assassin', label: 'Assassin', icon: Skull },
];

type AbilityType = 'active' | 'passive';

export function HomebrewCreateSheet({
  open,
  onOpenChange,
  defaultTree = 'hunter',
  onSave,
}: HomebrewCreateSheetProps) {
  const { toast } = useToast();
  const assistant = useHomebrewAssistant();
  
  // Form state
  const [name, setName] = useState('');
  const [tree, setTree] = useState<AbilityTree>(defaultTree);
  const [icon, setIcon] = useState('Sparkles');
  const [type, setType] = useState<AbilityType>('active');
  const [actionType, setActionType] = useState<ActionType>('action');
  const [usageType, setUsageType] = useState<UsageType>('at_will');
  const [tier1Desc, setTier1Desc] = useState('');
  const [tier2Desc, setTier2Desc] = useState('');
  const [tier3Desc, setTier3Desc] = useState('');
  const [tier1DiceCount, setTier1DiceCount] = useState<number | ''>('');
  const [tier1Die, setTier1Die] = useState<DieType | ''>('');
  const [tier2DiceCount, setTier2DiceCount] = useState<number | ''>('');
  const [tier2Die, setTier2Die] = useState<DieType | ''>('');
  const [tier3DiceCount, setTier3DiceCount] = useState<number | ''>('');
  const [tier3Die, setTier3Die] = useState<DieType | ''>('');
  const [cooldownMinutes, setCooldownMinutes] = useState<number | ''>(0);
  const [notes, setNotes] = useState('');
  const [minLevel, setMinLevel] = useState<number | ''>(1);
  
  // AI assistant state
  const [suggestedNames, setSuggestedNames] = useState<string[]>([]);
  const [balanceFeedback, setBalanceFeedback] = useState<string | null>(null);

  // Reset form when sheet opens with new tree
  const resetForm = useCallback(() => {
    setName('');
    setTree(defaultTree);
    setIcon('Sparkles');
    setType('active');
    setActionType('action');
    setUsageType('at_will');
    setTier1Desc('');
    setTier2Desc('');
    setTier3Desc('');
    setTier1DiceCount('');
    setTier1Die('');
    setTier2DiceCount('');
    setTier2Die('');
    setTier3DiceCount('');
    setTier3Die('');
    setCooldownMinutes(0);
    setNotes('');
    setMinLevel(1);
    setSuggestedNames([]);
    setBalanceFeedback(null);
  }, [defaultTree]);

  // AI Assistant handlers
  const handleSuggestNames = async () => {
    const names = await assistant.suggestNames({ tree, type });
    if (names.length > 0) {
      setSuggestedNames(names);
    }
  };

  const handleGenerateFull = async () => {
    const suggestion = await assistant.suggestFullAbility({ tree, type });
    if (suggestion) {
      setName(suggestion.name || '');
      setTier1Desc(suggestion.tier1 || '');
      setTier2Desc(suggestion.tier2 || '');
      setTier3Desc(suggestion.tier3 || '');
      if (suggestion.actionType) {
        setActionType(suggestion.actionType as ActionType);
      }
      if (suggestion.usageType) {
        setUsageType(suggestion.usageType as UsageType);
      }
      if (suggestion.cooldown !== undefined) {
        setCooldownMinutes(suggestion.cooldown);
      }
      if (suggestion.notes) {
        setNotes(suggestion.notes);
      }
      // Parse dice if provided
      if (suggestion.dice) {
        const parseDice = (diceStr?: string): { count: number | ''; die: DieType | '' } => {
          if (!diceStr) return { count: '', die: '' };
          const match = diceStr.match(/(\d+)d(\d+)/);
          if (match) {
            const dieVal = parseInt(match[2]);
            const validDice: DieType[] = [4, 6, 8, 10, 12, 20];
            if (validDice.includes(dieVal as DieType)) {
              return { count: parseInt(match[1]), die: dieVal as DieType };
            }
          }
          return { count: '', die: '' };
        };
        const t1 = parseDice(suggestion.dice.tier1);
        const t2 = parseDice(suggestion.dice.tier2);
        const t3 = parseDice(suggestion.dice.tier3);
        if (t1.count !== '') setTier1DiceCount(t1.count);
        if (t1.die !== '') setTier1Die(t1.die);
        if (t2.count !== '') setTier2DiceCount(t2.count);
        if (t2.die !== '') setTier2Die(t2.die);
        if (t3.count !== '') setTier3DiceCount(t3.count);
        if (t3.die !== '') setTier3Die(t3.die);
      }
      toast({
        title: 'AI Generated!',
        description: `Created "${suggestion.name}" - review and customize it.`,
        className: 'border-primary bg-primary/10',
      });
    }
  };

  const handleSuggestDescriptions = async () => {
    if (!name.trim()) {
      toast({
        title: 'Name Required',
        description: 'Enter an ability name first so the AI can generate matching descriptions.',
        variant: 'destructive',
      });
      return;
    }
    const descriptions = await assistant.suggestDescriptions({ 
      tree, 
      type, 
      currentName: name 
    });
    if (descriptions) {
      setTier1Desc(descriptions.tier1);
      setTier2Desc(descriptions.tier2);
      setTier3Desc(descriptions.tier3);
      toast({
        title: 'Descriptions Generated!',
        description: 'AI created tier effects based on your ability name.',
        className: 'border-primary bg-primary/10',
      });
    }
  };

  const handleGetBalanceFeedback = async () => {
    if (!name.trim() || !tier1Desc.trim()) {
      toast({
        title: 'More Info Needed',
        description: 'Add a name and at least Tier 1 description for balance review.',
        variant: 'destructive',
      });
      return;
    }
    const feedback = await assistant.getBalanceFeedback({ 
      tree, 
      type, 
      currentName: name,
      currentDescription: `Tier 1: ${tier1Desc}. Tier 2: ${tier2Desc}. Tier 3: ${tier3Desc}`
    });
    if (feedback) {
      setBalanceFeedback(feedback);
    }
  };

  const handleEnhanceDescriptions = async () => {
    if (!tier1Desc.trim()) {
      toast({
        title: 'Descriptions Required',
        description: 'Add at least a Tier 1 description to enhance.',
        variant: 'destructive',
      });
      return;
    }
    const enhanced = await assistant.enhanceDescriptions({ 
      tree, 
      type, 
      currentName: name,
      currentDescription: `Tier 1: ${tier1Desc}. Tier 2: ${tier2Desc}. Tier 3: ${tier3Desc}`
    });
    if (enhanced) {
      setTier1Desc(enhanced.tier1);
      setTier2Desc(enhanced.tier2);
      setTier3Desc(enhanced.tier3);
      toast({
        title: 'Descriptions Enhanced!',
        description: 'AI polished your tier effects.',
        className: 'border-primary bg-primary/10',
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSave = () => {
    // Validation
    if (!name.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a name for your homebrew ability.',
        variant: 'destructive',
      });
      return;
    }

    if (!tier1Desc.trim()) {
      toast({
        title: 'Tier 1 Effect Required',
        description: 'Please describe at least the Tier 1 effect.',
        variant: 'destructive',
      });
      return;
    }

    // Build tier effects
    const tierEffects: TierEffect[] = [
      { tier: 1, description: tier1Desc.trim() },
    ];
    if (tier2Desc.trim()) tierEffects.push({ tier: 2, description: tier2Desc.trim() });
    if (tier3Desc.trim()) tierEffects.push({ tier: 3, description: tier3Desc.trim() });

    // Build dice config if active
    const dice: HomebrewAbility['dice'] = {};
    if (type === 'active') {
      if (tier1DiceCount && tier1Die) dice.tier1 = { count: Number(tier1DiceCount), die: Number(tier1Die) };
      if (tier2DiceCount && tier2Die) dice.tier2 = { count: Number(tier2DiceCount), die: Number(tier2Die) };
      if (tier3DiceCount && tier3Die) dice.tier3 = { count: Number(tier3DiceCount), die: Number(tier3Die) };
    }

    const homebrew: Omit<HomebrewAbility, 'id' | 'createdAt' | 'updatedAt'> = {
      name: name.trim(),
      tree,
      icon,
      type,
      actionType: type === 'passive' ? 'passive' : actionType,
      usageType,
      tierEffects,
      dice: Object.keys(dice).length > 0 ? dice : undefined,
      cooldownMinutes: typeof cooldownMinutes === 'number' ? cooldownMinutes : 0,
      minLevel: typeof minLevel === 'number' && minLevel > 1 ? minLevel : undefined,
      notes: notes.trim() || undefined,
    };

    onSave(homebrew);
    toast({
      title: 'Homebrew Created!',
      description: `"${name.trim()}" has been added to your ${tree} tree.`,
      className: 'border-primary bg-primary/10',
    });
    handleOpenChange(false);
  };

  // Get the icon component dynamically
  const getIconComponent = (iconName: string) => {
    const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
    return icons[iconName] || LucideIcons.Sparkles;
  };
  const IconComponent = getIconComponent(icon);

  const isValid = name.trim() && tier1Desc.trim();

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[90vh] rounded-t-2xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-2" />
        
        <SheetHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              tree === 'hunter' && 'bg-hunter/20 text-hunter',
              tree === 'warrior' && 'bg-warrior/20 text-warrior',
              tree === 'assassin' && 'bg-assassin/20 text-assassin',
            )}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <SheetTitle className="font-cinzel flex items-center gap-2">
                {name || 'New Homebrew Ability'}
                <Badge variant="outline" className="text-xs border-primary/50">
                  <Plus className="w-3 h-3 mr-1" />
                  Creating
                </Badge>
              </SheetTitle>
              <SheetDescription className="text-xs">
                Create a custom ability from scratch
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
              {/* AI ASSISTANT PANEL */}
              <div className="rounded-lg border border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">AI Homebrew Assistant</span>
                  {assistant.isLoading && (
                    <RefreshCw className="w-3 h-3 animate-spin text-primary/70 ml-auto" />
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateFull}
                    disabled={assistant.isLoading}
                    className="text-xs h-7 border-primary/40 hover:bg-primary/10"
                  >
                    <Zap className="w-3 h-3 mr-1" />
                    Generate Full Ability
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSuggestNames}
                    disabled={assistant.isLoading}
                    className="text-xs h-7 border-primary/40 hover:bg-primary/10"
                  >
                    <Lightbulb className="w-3 h-3 mr-1" />
                    Suggest Names
                  </Button>
                </div>
                
                {/* Name suggestions */}
                {suggestedNames.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Tap to use:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedNames.map((suggestedName, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setName(suggestedName);
                            setSuggestedNames([]);
                          }}
                          className="px-2 py-1 text-xs rounded-md bg-primary/20 hover:bg-primary/30 text-primary-foreground transition-colors"
                        >
                          {suggestedName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Ability Name */}
              <div className="space-y-2">
                <Label htmlFor="homebrewName">Ability Name *</Label>
                <Input
                  id="homebrewName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter ability name..."
                  className="bg-muted/30"
                  autoFocus={false}
                />
              </div>

              {/* Tree Selector */}
              <div className="space-y-2">
                <Label>Skill Tree</Label>
                <div className="grid grid-cols-3 gap-2">
                  {TREE_OPTIONS.map((opt) => {
                    const TreeIcon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setTree(opt.value)}
                        className={cn(
                          'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
                          tree === opt.value
                            ? cn(
                                'border-2',
                                opt.value === 'hunter' && 'border-hunter bg-hunter/10',
                                opt.value === 'warrior' && 'border-warrior bg-warrior/10',
                                opt.value === 'assassin' && 'border-assassin bg-assassin/10',
                              )
                            : 'border-muted/50 hover:bg-muted/30'
                        )}
                      >
                        <TreeIcon className={cn(
                          'w-5 h-5',
                          opt.value === 'hunter' && 'text-hunter',
                          opt.value === 'warrior' && 'text-warrior',
                          opt.value === 'assassin' && 'text-assassin',
                        )} />
                        <span className="text-xs font-medium">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ability Type */}
              <div className="space-y-2">
                <Label>Ability Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setType('active')}
                    className={cn(
                      'flex items-center justify-center gap-2 p-3 rounded-lg border transition-all',
                      type === 'active'
                        ? 'border-2 border-primary bg-primary/10'
                        : 'border-muted/50 hover:bg-muted/30'
                    )}
                  >
                    <Dices className="w-4 h-4" />
                    <span className="text-sm font-medium">Active</span>
                  </button>
                  <button
                    onClick={() => setType('passive')}
                    className={cn(
                      'flex items-center justify-center gap-2 p-3 rounded-lg border transition-all',
                      type === 'passive'
                        ? 'border-2 border-primary bg-primary/10'
                        : 'border-muted/50 hover:bg-muted/30'
                    )}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm font-medium">Passive</span>
                  </button>
                </div>
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
                        onClick={() => setIcon(iconName)}
                        className={cn(
                          'w-9 h-9 rounded-md flex items-center justify-center transition-all',
                          'border hover:bg-muted/50',
                          icon === iconName
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
                <Label htmlFor="homebrewNotes">Personal Notes</Label>
                <Textarea
                  id="homebrewNotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this ability..."
                  className="bg-muted/30 min-h-[60px]"
                />
              </div>
            </TabsContent>

            {/* EFFECTS TAB */}
            <TabsContent value="effects" className="space-y-4 mt-0">
              {/* AI Assist for Effects */}
              <div className="flex flex-wrap gap-2 pb-2 border-b border-muted/30">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSuggestDescriptions}
                  disabled={assistant.isLoading || !name.trim()}
                  className="text-xs h-7 border-primary/40 hover:bg-primary/10"
                >
                  <Bot className="w-3 h-3 mr-1" />
                  AI Generate Descriptions
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEnhanceDescriptions}
                  disabled={assistant.isLoading || !tier1Desc.trim()}
                  className="text-xs h-7 border-primary/40 hover:bg-primary/10"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Enhance
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGetBalanceFeedback}
                  disabled={assistant.isLoading || !name.trim() || !tier1Desc.trim()}
                  className="text-xs h-7 border-primary/40 hover:bg-primary/10"
                >
                  <MessageSquare className="w-3 h-3 mr-1" />
                  Balance Check
                </Button>
                {assistant.isLoading && (
                  <RefreshCw className="w-4 h-4 animate-spin text-primary/70 ml-auto self-center" />
                )}
              </div>

              {/* Balance Feedback */}
              {balanceFeedback && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span className="text-xs font-semibold text-primary">Balance Feedback</span>
                    </div>
                    <button
                      onClick={() => setBalanceFeedback(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Dismiss
                    </button>
                  </div>
                  <p className="text-sm text-foreground/90">{balanceFeedback}</p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Describe what your ability does at each tier. At least Tier 1 is required.
              </p>

              {[1, 2, 3].map((tier) => (
                <div key={tier} className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <span className={cn(
                      'w-5 h-5 rounded text-xs font-bold flex items-center justify-center',
                      tier === 1 && 'bg-amber-500/20 text-amber-400',
                      tier === 2 && 'bg-blue-500/20 text-blue-400',
                      tier === 3 && 'bg-purple-500/20 text-purple-400',
                    )}>
                      {tier}
                    </span>
                    Tier {tier} Effect {tier === 1 && '*'}
                  </Label>
                  <Textarea
                    value={tier === 1 ? tier1Desc : tier === 2 ? tier2Desc : tier3Desc}
                    onChange={(e) => {
                      if (tier === 1) setTier1Desc(e.target.value);
                      else if (tier === 2) setTier2Desc(e.target.value);
                      else setTier3Desc(e.target.value);
                    }}
                    placeholder={
                      tier === 1
                        ? 'Base effect (required)...'
                        : tier === 2
                        ? 'Enhanced effect (optional)...'
                        : 'Mastered effect (optional)...'
                    }
                    className="bg-muted/30 min-h-[70px] text-sm"
                  />
                </div>
              ))}
            </TabsContent>

            {/* MECHANICS TAB */}
            <TabsContent value="mechanics" className="space-y-4 mt-0">
              {/* Action Type (only for active) */}
              {type === 'active' && (
                <div className="space-y-2">
                  <Label>Action Type</Label>
                  <Select
                    value={actionType}
                    onValueChange={(v) => setActionType(v as ActionType)}
                  >
                    <SelectTrigger className="bg-muted/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPE_OPTIONS.filter(o => o.value !== 'passive').map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Usage Type */}
              <div className="space-y-2">
                <Label>Recovery</Label>
                <Select
                  value={usageType}
                  onValueChange={(v) => setUsageType(v as UsageType)}
                >
                  <SelectTrigger className="bg-muted/30">
                    <SelectValue />
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

              {/* Minimum Level */}
              <div className="space-y-2">
                <Label>Minimum Level</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={minLevel}
                  onChange={(e) => setMinLevel(e.target.value ? Number(e.target.value) : '')}
                  placeholder="1"
                  className="bg-muted/30"
                />
                <p className="text-xs text-muted-foreground">
                  Level required to unlock this ability (1-20)
                </p>
              </div>

              {/* Cooldown */}
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
                  placeholder="0 (no cooldown)"
                  className="bg-muted/30"
                />
              </div>

              {/* Custom Dice (only for active) */}
              {type === 'active' && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Dices className="w-4 h-4" />
                    Damage/Effect Dice by Tier
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
                  <p className="text-xs text-muted-foreground">
                    Optional: Define dice for active abilities
                  </p>
                </div>
              )}
            </TabsContent>
          </ScrollArea>

          {/* Footer Actions */}
          <div className="flex gap-2 pt-4 border-t mt-2">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isValid}
              className="flex-1"
            >
              <Save className="w-4 h-4 mr-1" />
              Create Ability
            </Button>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
