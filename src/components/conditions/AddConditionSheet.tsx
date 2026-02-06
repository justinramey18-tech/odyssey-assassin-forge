import { useState, useCallback, useMemo } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { getIconByName } from '@/lib/iconUtils';
import {
  ConditionConfig,
  NewConditionInput,
  DurationType,
  SaveType,
  STANDARD_CONDITIONS,
  BUFF_CONDITIONS,
  DURATION_PRESETS,
  SEVERITY_COLORS,
} from '@/lib/conditions';
import { Search, Plus } from 'lucide-react';

interface AddConditionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: NewConditionInput) => boolean;
}

export function AddConditionSheet({
  open,
  onOpenChange,
  onAdd,
}: AddConditionSheetProps) {
  const [search, setSearch] = useState('');
  const [selectedCondition, setSelectedCondition] = useState<ConditionConfig | null>(null);
  const [durationType, setDurationType] = useState<DurationType>('rounds');
  const [durationValue, setDurationValue] = useState(1);
  const [source, setSource] = useState('');
  const [saveType, setSaveType] = useState<SaveType | undefined>(undefined);
  const [saveDC, setSaveDC] = useState<number | undefined>(undefined);
  const [spellLevel, setSpellLevel] = useState<number | undefined>(undefined);

  // Filter conditions by search
  const filteredDebuffs = useMemo(
    () =>
      STANDARD_CONDITIONS.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  );

  const filteredBuffs = useMemo(
    () =>
      BUFF_CONDITIONS.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  );

  // Reset form when closing
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setSelectedCondition(null);
        setSearch('');
        setSource('');
        setSaveType(undefined);
        setSaveDC(undefined);
        setSpellLevel(undefined);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  // Select a condition and populate defaults
  const handleSelectCondition = useCallback((config: ConditionConfig) => {
    setSelectedCondition(config);
    setDurationType(config.defaultDuration);
    setDurationValue(config.defaultValue);
    if (config.suggestedSave) {
      setSaveType(config.suggestedSave);
    }
  }, []);

  // Apply the condition
  const handleApply = useCallback(() => {
    if (!selectedCondition) return;

    const input: NewConditionInput = {
      conditionId: selectedCondition.id,
      name: selectedCondition.name,
      category: selectedCondition.category,
      severity: selectedCondition.severity,
      durationType,
      durationValue,
      source: source || undefined,
      saveType,
      saveDC,
      spellLevel: selectedCondition.category === 'concentration' ? spellLevel : undefined,
    };

    const success = onAdd(input);
    if (success) {
      handleOpenChange(false);
    }
  }, [
    selectedCondition,
    durationType,
    durationValue,
    source,
    saveType,
    saveDC,
    spellLevel,
    onAdd,
    handleOpenChange,
  ]);

  const ConditionButton = ({ config }: { config: ConditionConfig }) => {
    const Icon = getIconByName(config.icon);
    const colors = SEVERITY_COLORS[config.severity];
    const isSelected = selectedCondition?.id === config.id;

    return (
      <button
        onClick={() => handleSelectCondition(config)}
        className={cn(
          'flex items-center gap-2 p-2.5 rounded-lg border w-full text-left',
          'transition-all touch-manipulation min-h-[48px]',
          isSelected
            ? 'ring-2 ring-primary border-primary bg-primary/10'
            : cn(colors.bg, colors.border, 'hover:opacity-80')
        )}
      >
        <div
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-full',
            colors.bg,
            'border',
            colors.border
          )}
        >
          <Icon className={cn('w-4 h-4', colors.icon)} />
        </div>
        <div className="flex-1 min-w-0">
          <span className={cn('font-medium text-sm block', colors.text)}>
            {config.name}
          </span>
          <span className="text-xs text-muted-foreground truncate block">
            {config.mechanical}
          </span>
        </div>
      </button>
    );
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-2">
          <SheetTitle>Add Condition</SheetTitle>
          <SheetDescription>
            {selectedCondition
              ? `Configure ${selectedCondition.name}`
              : 'Select a condition to apply'}
          </SheetDescription>
        </SheetHeader>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conditions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {!selectedCondition ? (
          // Condition selection view
          <Tabs defaultValue="debuffs" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-4 grid w-[calc(100%-2rem)] grid-cols-2">
              <TabsTrigger value="debuffs">Debuffs ({filteredDebuffs.length})</TabsTrigger>
              <TabsTrigger value="buffs">Buffs ({filteredBuffs.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="debuffs" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-full px-4">
                <div className="grid gap-2 pb-4">
                  {filteredDebuffs.map(config => (
                    <ConditionButton key={config.id} config={config} />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="buffs" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-full px-4">
                <div className="grid gap-2 pb-4">
                  {filteredBuffs.map(config => (
                    <ConditionButton key={config.id} config={config} />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : (
          // Configuration view
          <ScrollArea className="flex-1 px-4">
            <div className="space-y-4 pb-4">
              {/* Selected condition summary */}
              <div
                className={cn(
                  'p-3 rounded-lg border',
                  SEVERITY_COLORS[selectedCondition.severity].bg,
                  SEVERITY_COLORS[selectedCondition.severity].border
                )}
              >
                <p className="text-sm font-medium">{selectedCondition.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedCondition.mechanical}
                </p>
              </div>

              {/* Duration presets */}
              <div className="space-y-2">
                <Label>Duration</Label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map(preset => (
                    <Button
                      key={preset.label}
                      variant={
                        durationType === preset.durationType &&
                        durationValue === preset.value
                          ? 'default'
                          : 'outline'
                      }
                      size="sm"
                      onClick={() => {
                        setDurationType(preset.durationType);
                        setDurationValue(preset.value);
                      }}
                      className="text-xs h-8"
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom duration input for rounds/minutes/hours */}
              {(durationType === 'rounds' ||
                durationType === 'minutes' ||
                durationType === 'hours') && (
                <div className="space-y-2">
                  <Label>
                    Custom {durationType.charAt(0).toUpperCase() + durationType.slice(1)}
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={durationType === 'hours' ? 24 : durationType === 'minutes' ? 60 : 100}
                    value={durationValue}
                    onChange={e => setDurationValue(parseInt(e.target.value) || 1)}
                  />
                </div>
              )}

              {/* Source */}
              <div className="space-y-2">
                <Label>Source (optional)</Label>
                <Input
                  placeholder="e.g., Poison Spray from Goblin"
                  value={source}
                  onChange={e => setSource(e.target.value)}
                />
              </div>

              {/* Spell Level - only for concentration spells */}
              {selectedCondition.category === 'concentration' && (
                <div className="space-y-2">
                  <Label>Spell Slot Level (optional)</Label>
                  <select
                    value={spellLevel || ''}
                    onChange={e =>
                      setSpellLevel(parseInt(e.target.value) || undefined)
                    }
                    className="w-full h-10 px-3 rounded-md border bg-background"
                  >
                    <option value="">Not specified</option>
                    <option value="1">1st Level</option>
                    <option value="2">2nd Level</option>
                    <option value="3">3rd Level</option>
                    <option value="4">4th Level</option>
                    <option value="5">5th Level</option>
                    <option value="6">6th Level</option>
                    <option value="7">7th Level</option>
                    <option value="8">8th Level</option>
                    <option value="9">9th Level</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Shows in round summary when this spell ticks down
                  </p>
                </div>
              )}

              {/* Save DC */}
              {selectedCondition.suggestedSave && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Save Type</Label>
                    <select
                      value={saveType || ''}
                      onChange={e =>
                        setSaveType((e.target.value as SaveType) || undefined)
                      }
                      className="w-full h-10 px-3 rounded-md border bg-background"
                    >
                      <option value="">None</option>
                      <option value="STR">STR</option>
                      <option value="DEX">DEX</option>
                      <option value="CON">CON</option>
                      <option value="INT">INT</option>
                      <option value="WIS">WIS</option>
                      <option value="CHA">CHA</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Save DC</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      placeholder="e.g., 15"
                      value={saveDC || ''}
                      onChange={e =>
                        setSaveDC(parseInt(e.target.value) || undefined)
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        <div className="p-4 border-t flex gap-2">
          {selectedCondition && (
            <Button
              variant="outline"
              onClick={() => setSelectedCondition(null)}
              className="flex-1"
            >
              Back
            </Button>
          )}
          <Button
            onClick={handleApply}
            disabled={!selectedCondition}
            className="flex-1"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Apply Condition
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
