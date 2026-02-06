import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { WizardState } from '../types';
import { 
  EQUIPMENT_PRESETS, 
  getAvailablePresets, 
  presetToEquipment,
  EquipmentPreset,
} from '../presets/equipment-presets';
import { 
  Shield, 
  Sword, 
  Package, 
  Check,
  Lock,
  Star,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { rarityConfig } from '@/lib/inventory/types';
import wizardBackground from '@/assets/wizard-background.jpg';

interface EquipmentStepProps {
  state: WizardState;
  onUpdate: (updates: Partial<Pick<WizardState, 'equipment' | 'selectedPresetId'>>) => void;
}

export function EquipmentStep({ state, onUpdate }: EquipmentStepProps) {
  const { level, gameMode, selectedPresetId } = state;
  const isHonestMode = gameMode === 'honest';

  // Get available presets for current level
  const availablePresets = useMemo(() => 
    getAvailablePresets(level, isHonestMode),
    [level, isHonestMode]
  );

  // Get locked presets (for display with lock overlay)
  const lockedPresets = useMemo(() => 
    EQUIPMENT_PRESETS.filter(p => 
      !availablePresets.some(ap => ap.id === p.id) && p.id !== 'custom'
    ),
    [availablePresets]
  );

  const handleSelectPreset = (preset: EquipmentPreset) => {
    const equipment = presetToEquipment(preset);
    onUpdate({ 
      equipment, 
      selectedPresetId: preset.id,
    });
  };

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
        style={{ backgroundImage: `url(${wizardBackground})` }}
      />
      <div className="fixed inset-0 bg-background/70 -z-10" />

      <div className="container max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/20 border border-primary/30 mb-3">
            <Package className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground">
            Starting Equipment
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose your initial gear loadout
          </p>
        </div>

        {/* Available Presets */}
        <div className="space-y-3 mb-6">
          {availablePresets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              isSelected={selectedPresetId === preset.id}
              isLocked={false}
              onSelect={() => handleSelectPreset(preset)}
            />
          ))}
        </div>

        {/* Locked Presets (show what's coming) */}
        {lockedPresets.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px bg-muted/30" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Unlocks at Higher Levels
              </span>
              <div className="flex-1 h-px bg-muted/30" />
            </div>
            <div className="space-y-3 opacity-60">
              {lockedPresets.slice(0, 2).map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  isSelected={false}
                  isLocked={true}
                  onSelect={() => {}}
                />
              ))}
            </div>
          </>
        )}

        {/* Selected Preset Details */}
        {selectedPresetId && selectedPresetId !== 'custom' && (
          <SelectedPresetDetails 
            preset={EQUIPMENT_PRESETS.find(p => p.id === selectedPresetId)!} 
          />
        )}
      </div>
    </div>
  );
}

interface PresetCardProps {
  preset: EquipmentPreset;
  isSelected: boolean;
  isLocked: boolean;
  onSelect: () => void;
}

function PresetCard({ preset, isSelected, isLocked, onSelect }: PresetCardProps) {
  const rarityColor = rarityConfig[preset.maxRarity];
  const itemCount = Object.keys(preset.items).length;

  return (
    <motion.button
      whileTap={!isLocked ? { scale: 0.98 } : undefined}
      onClick={onSelect}
      disabled={isLocked}
      className={cn(
        "w-full p-4 rounded-lg border-2 transition-all text-left relative overflow-hidden",
        isLocked
          ? "border-muted/30 bg-muted/10 cursor-not-allowed"
          : isSelected
            ? "border-primary bg-primary/10 shadow-lg"
            : "border-border bg-card/50 hover:border-muted-foreground/50"
      )}
    >
      {/* Lock Overlay */}
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px] z-10">
          <div className="flex items-center gap-2 bg-background/80 px-3 py-1.5 rounded-full">
            <Lock className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-amber-400">
              Level {preset.minLevel}+
            </span>
          </div>
        </div>
      )}

      {/* Rarity Border Accent */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1",
        rarityColor.borderClass.replace('border-l-', 'bg-')
      )} />

      <div className="flex items-start gap-3 pl-2">
        {/* Icon */}
        <div className={cn(
          "w-12 h-12 rounded-lg flex items-center justify-center shrink-0",
          isSelected ? "bg-primary/20" : "bg-muted/30"
        )}>
          {preset.id === 'custom' ? (
            <Sparkles className="w-6 h-6" />
          ) : (
            <Shield className="w-6 h-6" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-display font-bold text-foreground">{preset.name}</p>
            {isSelected && <Check className="w-4 h-4 text-primary" />}
            <span className={cn("text-[10px] ml-auto", rarityColor.color)}>
              {rarityColor.label}
            </span>
          </div>
          
          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
            {preset.description}
          </p>

          {/* Stats Preview */}
          {preset.id !== 'custom' && (
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-muted/30">
                <Shield className="w-3 h-3" />
                AC {preset.totalAC}
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-muted/30">
                <Sword className="w-3 h-3" />
                {preset.primaryDamage}
              </span>
              <span className="px-2 py-0.5 rounded bg-muted/30">
                {itemCount} items
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

interface SelectedPresetDetailsProps {
  preset: EquipmentPreset;
}

function SelectedPresetDetails({ preset }: SelectedPresetDetailsProps) {
  const items = Object.entries(preset.items);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 p-4 rounded-lg border border-primary/30 bg-primary/5"
    >
      <h3 className="font-display text-sm font-bold text-primary mb-2">
        {preset.name} Contents
      </h3>
      <p className="text-xs text-muted-foreground italic mb-3">
        "{preset.flavor}"
      </p>
      
      <div className="grid grid-cols-2 gap-2">
        {items.map(([slot, item]) => {
          if (!item) return null;
          const rarity = rarityConfig[item.rarity];
          return (
            <div 
              key={slot}
              className="flex items-center gap-2 p-2 rounded bg-muted/20 text-xs"
            >
              <div className={cn("w-1 h-6 rounded-full", rarity.borderClass.replace('border-l-', 'bg-'))} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{item.name}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{slot.replace('_', ' ')}</p>
              </div>
              {rarity.stars > 0 && (
                <div className="flex">
                  {Array.from({ length: rarity.stars }).map((_, i) => (
                    <Star key={i} className={cn("w-3 h-3", rarity.color)} fill="currentColor" />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {preset.setId && (
        <div className="mt-3 pt-3 border-t border-muted/20">
          <p className="text-[10px] text-amber-400">
            ✨ Part of a set! Equipping more pieces unlocks bonus effects.
          </p>
        </div>
      )}
    </motion.div>
  );
}
