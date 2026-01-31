import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus,
  Skull,
  Sparkles,
  Clock,
  Search,
} from 'lucide-react';
import { 
  CONDITION_DEFINITIONS,
  getDebuffs,
  getBuffs,
  SEVERITY_COLORS,
} from '@/lib/conditions/config';
import { DurationType, ConditionDefinition } from '@/lib/conditions/types';

interface AddConditionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (params: {
    conditionId: string;
    name?: string;
    source?: string;
    durationType: DurationType;
    durationValue: number;
    isConcentration?: boolean;
    notes?: string;
  }) => void;
}

const DURATION_PRESETS = [
  { label: '1 round', type: 'rounds' as DurationType, value: 1 },
  { label: '3 rounds', type: 'rounds' as DurationType, value: 3 },
  { label: '1 minute', type: 'minutes' as DurationType, value: 1 },
  { label: '10 minutes', type: 'minutes' as DurationType, value: 10 },
  { label: '1 hour', type: 'hours' as DurationType, value: 1 },
  { label: 'Save ends', type: 'save_ends' as DurationType, value: 0 },
  { label: 'Indefinite', type: 'indefinite' as DurationType, value: 0 },
];

export function AddConditionSheet({
  open,
  onOpenChange,
  onAdd,
}: AddConditionSheetProps) {
  const [selectedCondition, setSelectedCondition] = useState<ConditionDefinition | null>(null);
  const [customName, setCustomName] = useState('');
  const [source, setSource] = useState('');
  const [durationType, setDurationType] = useState<DurationType>('rounds');
  const [durationValue, setDurationValue] = useState(1);
  const [isConcentration, setIsConcentration] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'debuff' | 'buff' | 'custom'>('debuff');
  
  const debuffs = useMemo(() => getDebuffs(), []);
  const buffs = useMemo(() => getBuffs(), []);
  
  // Filter conditions by search
  const filteredDebuffs = useMemo(() => 
    debuffs.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.mechanicalEffect.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  [debuffs, searchQuery]);
  
  const filteredBuffs = useMemo(() => 
    buffs.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.mechanicalEffect.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  [buffs, searchQuery]);
  
  const handleSelectCondition = (condition: ConditionDefinition) => {
    setSelectedCondition(condition);
    setCustomName('');
  };
  
  const handlePresetClick = (preset: typeof DURATION_PRESETS[0]) => {
    setDurationType(preset.type);
    setDurationValue(preset.value);
  };
  
  const handleSubmit = () => {
    if (activeTab === 'custom' && !customName.trim()) return;
    if (activeTab !== 'custom' && !selectedCondition) return;
    
    onAdd({
      conditionId: activeTab === 'custom' ? 'custom' : selectedCondition!.id,
      name: activeTab === 'custom' ? customName : undefined,
      source: source.trim() || undefined,
      durationType,
      durationValue,
      isConcentration,
    });
    
    // Reset form
    setSelectedCondition(null);
    setCustomName('');
    setSource('');
    setDurationType('rounds');
    setDurationValue(1);
    setIsConcentration(false);
    onOpenChange(false);
  };
  
  const renderConditionGrid = (conditions: ConditionDefinition[]) => (
    <div className="grid grid-cols-2 gap-2">
      {conditions.map(condition => {
        const isSelected = selectedCondition?.id === condition.id;
        const color = condition.color || SEVERITY_COLORS[condition.severity];
        
        return (
          <button
            key={condition.id}
            onClick={() => handleSelectCondition(condition)}
            className={cn(
              "p-3 rounded-lg border text-left transition-all active:scale-[0.98]",
              isSelected
                ? "border-primary bg-primary/10"
                : "border-muted/30 hover:border-muted/50"
            )}
            style={{
              borderColor: isSelected ? color : undefined,
              backgroundColor: isSelected ? `${color}20` : undefined,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm font-medium">{condition.name}</span>
            </div>
            <p className="text-[10px] text-muted-foreground line-clamp-2">
              {condition.mechanicalEffect}
            </p>
          </button>
        );
      })}
    </div>
  );
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
        
        <SheetHeader className="text-left">
          <SheetTitle className="font-cinzel text-amber-400 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Condition
          </SheetTitle>
          <SheetDescription>
            Apply a condition, buff, or custom effect
          </SheetDescription>
        </SheetHeader>
        
        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conditions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="debuff" className="gap-1">
              <Skull className="w-3 h-3" />
              Debuffs
            </TabsTrigger>
            <TabsTrigger value="buff" className="gap-1">
              <Sparkles className="w-3 h-3" />
              Buffs
            </TabsTrigger>
            <TabsTrigger value="custom" className="gap-1">
              <Plus className="w-3 h-3" />
              Custom
            </TabsTrigger>
          </TabsList>
          
          <ScrollArea className="h-[200px] mt-4">
            <TabsContent value="debuff" className="mt-0">
              {renderConditionGrid(filteredDebuffs)}
            </TabsContent>
            
            <TabsContent value="buff" className="mt-0">
              {renderConditionGrid(filteredBuffs)}
            </TabsContent>
            
            <TabsContent value="custom" className="mt-0">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="custom-name">Condition Name</Label>
                  <Input
                    id="custom-name"
                    placeholder="e.g., Slowed, Cursed, Blessed..."
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
        
        {/* Duration & Source */}
        <div className="space-y-4 mt-4 pt-4 border-t border-muted/20">
          {/* Source */}
          <div>
            <Label htmlFor="source">Source (optional)</Label>
            <Input
              id="source"
              placeholder="e.g., Giant Spider, Poison Trap..."
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="mt-1"
            />
          </div>
          
          {/* Duration Presets */}
          <div>
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Duration
            </Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {DURATION_PRESETS.map(preset => {
                const isSelected = durationType === preset.type && durationValue === preset.value;
                return (
                  <button
                    key={preset.label}
                    onClick={() => handlePresetClick(preset)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs border transition-all",
                      isSelected
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-muted/30 hover:border-muted/50"
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            
            {/* Custom duration input */}
            {(durationType === 'rounds' || durationType === 'minutes' || durationType === 'hours') && (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={durationValue}
                  onChange={(e) => setDurationValue(parseInt(e.target.value) || 1)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">
                  {durationType === 'rounds' ? 'round(s)' : durationType}
                </span>
              </div>
            )}
          </div>
          
          {/* Concentration Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="concentration" className="cursor-pointer">
              Concentration Effect
            </Label>
            <Switch
              id="concentration"
              checked={isConcentration}
              onCheckedChange={setIsConcentration}
            />
          </div>
        </div>
        
        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={(activeTab !== 'custom' && !selectedCondition) || (activeTab === 'custom' && !customName.trim())}
          className="w-full mt-6 h-12"
        >
          <Plus className="w-4 h-4 mr-2" />
          Apply {activeTab === 'custom' ? customName || 'Condition' : selectedCondition?.name || 'Condition'}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
