import { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  Gem, Plus, Minus, Trash2, Package, Wand2, 
  Sparkles, AlertTriangle, Check 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';

// ============================================
// TYPES
// ============================================

export interface MaterialComponent {
  id: string;
  name: string;
  cost: number; // in gold pieces (0 = no cost)
  quantity: number;
  consumedOnUse: boolean;
  description?: string;
}

// ============================================
// COMMON COMPONENTS FOR D&D 5e
// ============================================

export const COMMON_COMPONENTS: Omit<MaterialComponent, 'quantity'>[] = [
  { id: 'pearl_100gp', name: 'Pearl (100gp)', cost: 100, consumedOnUse: false, description: 'Used for Identify' },
  { id: 'diamond_dust_50gp', name: 'Diamond Dust (50gp)', cost: 50, consumedOnUse: true, description: 'Consumed by Greater Restoration' },
  { id: 'diamond_300gp', name: 'Diamond (300gp)', cost: 300, consumedOnUse: true, description: 'Consumed by Revivify' },
  { id: 'incense_25gp', name: 'Incense (25gp)', cost: 25, consumedOnUse: true, description: 'Consumed by Find Familiar ritual' },
  { id: 'charcoal', name: 'Charcoal, Incense, & Herbs', cost: 0, consumedOnUse: true, description: 'Consumed by Find Familiar' },
  { id: 'bat_guano', name: 'Bat Guano & Sulfur', cost: 0, consumedOnUse: false, description: 'Used for Fireball' },
  { id: 'phosphorescent_moss', name: 'Phosphorescent Moss', cost: 0, consumedOnUse: false, description: 'Used for Light' },
  { id: 'fleece', name: 'A Bit of Fleece', cost: 0, consumedOnUse: false, description: 'Used for Minor Illusion' },
  { id: 'lodestone', name: 'Lodestone', cost: 0, consumedOnUse: false, description: 'Used for Mending' },
  { id: 'ruby_dust_50gp', name: 'Ruby Dust (50gp)', cost: 50, consumedOnUse: true, description: 'Consumed by Continual Flame' },
  { id: 'forked_twig', name: 'Forked Metal Rod', cost: 0, consumedOnUse: false, description: 'Used for Plane Shift (attuned to plane)' },
  { id: 'holy_water', name: 'Holy Water (25gp)', cost: 25, consumedOnUse: true, description: 'Consumed by Protection from Evil' },
];

// ============================================
// COMPONENT INVENTORY PANEL
// ============================================

interface MaterialComponentsPanelProps {
  components: Record<string, number>;
  focusEquipped: boolean;
  onAddComponent: (componentId: string, quantity: number) => void;
  onUseComponent: (componentId: string, quantity: number) => boolean;
  onToggleFocus: () => void;
  onRemoveComponent?: (componentId: string) => void;
}

export function MaterialComponentsPanel({
  components,
  focusEquipped,
  onAddComponent,
  onUseComponent,
  onToggleFocus,
  onRemoveComponent,
}: MaterialComponentsPanelProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCost, setCustomCost] = useState('');
  const [customConsumed, setCustomConsumed] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // Get component details (from presets or custom)
  const getComponentDetails = (id: string): MaterialComponent | null => {
    const preset = COMMON_COMPONENTS.find(c => c.id === id);
    if (preset) {
      return { ...preset, quantity: components[id] || 0 };
    }
    // Custom component - parse from ID
    if (id.startsWith('custom_')) {
      return {
        id,
        name: id.replace('custom_', '').replace(/_/g, ' '),
        cost: 0,
        quantity: components[id] || 0,
        consumedOnUse: false,
      };
    }
    return null;
  };

  // Get all components with quantities
  const inventoryItems = Object.entries(components)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({
      id,
      quantity: qty,
      details: getComponentDetails(id),
    }))
    .filter(item => item.details !== null);

  const handleAddPreset = (presetId: string) => {
    onAddComponent(presetId, 1);
    setSelectedPreset(null);
  };

  const handleAddCustom = () => {
    if (!customName.trim()) return;
    
    const customId = `custom_${customName.trim().toLowerCase().replace(/\s+/g, '_')}`;
    onAddComponent(customId, 1);
    
    setCustomName('');
    setCustomCost('');
    setCustomConsumed(false);
    setIsAddDialogOpen(false);
  };

  const handleRemove = (componentId: string) => {
    if (onRemoveComponent) {
      onRemoveComponent(componentId);
    } else {
      // Use all remaining quantity
      const qty = components[componentId] || 0;
      if (qty > 0) {
        onUseComponent(componentId, qty);
      }
    }
  };

  return (
    <Card className="bg-background/40 border-white/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-400" />
            Material Components
          </CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 text-xs">
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Material Component</DialogTitle>
              </DialogHeader>
              
              {/* Presets */}
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground">Common Components</Label>
                <ScrollArea className="h-48">
                  <div className="grid gap-2 pr-4">
                    {COMMON_COMPONENTS.map((comp) => (
                      <button
                        key={comp.id}
                        onClick={() => handleAddPreset(comp.id)}
                        className={cn(
                          "p-2 rounded-lg border text-left transition-all",
                          "hover:border-amber-500/50 hover:bg-amber-500/10",
                          components[comp.id] > 0 
                            ? "border-amber-500/30 bg-amber-500/5"
                            : "border-white/10 bg-muted/20"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{comp.name}</span>
                          {components[comp.id] > 0 && (
                            <Badge variant="outline" className="text-amber-400 border-amber-500/50">
                              ×{components[comp.id]}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {comp.consumedOnUse && (
                            <span className="text-[10px] text-rose-400">Consumed</span>
                          )}
                          <span className="text-[10px] text-muted-foreground">{comp.description}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>

                {/* Custom Component */}
                <div className="border-t border-white/10 pt-3">
                  <Label className="text-xs text-muted-foreground">Custom Component</Label>
                  <div className="mt-2 space-y-2">
                    <Input
                      placeholder="Component name..."
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Cost (gp)"
                        value={customCost}
                        onChange={(e) => setCustomCost(e.target.value)}
                        className="w-24"
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <Switch
                          id="consumed"
                          checked={customConsumed}
                          onCheckedChange={setCustomConsumed}
                        />
                        <Label htmlFor="consumed" className="text-xs">Consumed on use</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCustom} disabled={!customName.trim()}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Custom
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Focus Toggle */}
        <div className={cn(
          "flex items-center justify-between p-3 rounded-lg border transition-all",
          focusEquipped 
            ? "border-indigo-500/50 bg-indigo-500/20"
            : "border-white/10 bg-muted/20"
        )}>
          <div className="flex items-center gap-2">
            <Wand2 className={cn(
              "w-5 h-5",
              focusEquipped ? "text-indigo-400" : "text-muted-foreground"
            )} />
            <div>
              <div className="text-sm font-medium">Spellcasting Focus</div>
              <div className="text-[10px] text-muted-foreground">
                Bypasses non-costly material components
              </div>
            </div>
          </div>
          <Switch
            checked={focusEquipped}
            onCheckedChange={onToggleFocus}
          />
        </div>

        {/* Component Inventory */}
        {inventoryItems.length > 0 ? (
          <div className="space-y-2">
            {inventoryItems.map(({ id, quantity, details }) => (
              <div
                key={id}
                className="flex items-center justify-between p-2 rounded-lg border border-white/10 bg-muted/20"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Gem className={cn(
                    "w-4 h-4 flex-shrink-0",
                    details?.cost && details.cost > 0 ? "text-amber-400" : "text-muted-foreground"
                  )} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{details?.name || id}</div>
                    {details?.consumedOnUse && (
                      <span className="text-[10px] text-rose-400">Consumed on use</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => onUseComponent(id, 1)}
                    disabled={quantity <= 0}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-6 text-center font-mono text-sm">{quantity}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => onAddComponent(id, 1)}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20"
                    onClick={() => handleRemove(id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No components in inventory</p>
            <p className="text-xs mt-1">
              {focusEquipped 
                ? "Your focus bypasses non-costly components"
                : "Add components or equip a focus"
              }
            </p>
          </div>
        )}

        {/* Focus Bypass Indicator */}
        {focusEquipped && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
            <Check className="w-4 h-4" />
            <span className="text-xs">
              Non-costly components are automatically satisfied by your focus
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// COMPONENT CHECK HELPER
// ============================================

export interface ComponentCheckResult {
  canCast: boolean;
  missingComponents: string[];
  componentsThatWillBeConsumed: string[];
  reason?: string;
}

export function checkSpellComponents(
  spellComponents: {
    verbal: boolean;
    somatic: boolean;
    material?: string;
    materialConsumed?: boolean;
    materialCost?: number;
  },
  inventory: Record<string, number>,
  focusEquipped: boolean
): ComponentCheckResult {
  const result: ComponentCheckResult = {
    canCast: true,
    missingComponents: [],
    componentsThatWillBeConsumed: [],
  };

  // If no material component required, can cast
  if (!spellComponents.material) {
    return result;
  }

  const hasCost = spellComponents.materialCost && spellComponents.materialCost > 0;
  const isConsumed = spellComponents.materialConsumed;

  // Focus bypasses non-costly materials
  if (focusEquipped && !hasCost) {
    return result;
  }

  // Need to check inventory for costly materials
  if (hasCost) {
    // Try to find a matching component in inventory
    const matchingComponent = Object.entries(inventory).find(([id, qty]) => {
      if (qty <= 0) return false;
      const comp = COMMON_COMPONENTS.find(c => c.id === id);
      return comp && comp.cost >= (spellComponents.materialCost || 0);
    });

    if (!matchingComponent) {
      result.canCast = false;
      result.missingComponents.push(spellComponents.material);
      result.reason = `Requires ${spellComponents.material} (${spellComponents.materialCost}gp)`;
    } else if (isConsumed) {
      result.componentsThatWillBeConsumed.push(matchingComponent[0]);
    }
  }

  return result;
}
