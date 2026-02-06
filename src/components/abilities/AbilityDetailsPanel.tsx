import { useState, useRef } from 'react';
import { Ability, AbilityTree, getActiveSlotsByLevel } from '@/lib/types';
import { TREE_VISUAL_CONFIG } from '@/lib/abilityTrees/colors';
import { allAbilities, getAbilityById } from '@/lib/abilities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';
import { Lock, Zap, Clock, RotateCcw, Shield, Sparkles, AlertTriangle, ImagePlus, Trash2, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Extended ability type that might have homebrew flag
type AbilityWithFlags = Ability & {
  isHomebrew?: boolean;
  isCustomized?: boolean;
  customDice?: {
    tier1?: { count: number; die: number };
    tier2?: { count: number; die: number };
    tier3?: { count: number; die: number };
  };
  customCooldownMinutes?: number;
};

interface AbilityDetailsPanelProps {
  ability: AbilityWithFlags | null;
  currentTier: 0 | 1 | 2 | 3;
  characterLevel: number;
  prestigePoints?: number;
  availablePoints: number;
  prerequisiteMet: boolean;
  equippedSlots: string[];
  customImage?: string | null;
  isCustomized?: boolean;
  onImageUpload?: (file: File) => Promise<void>;
  onImageClear?: () => void;
  onEdit?: () => void;
  onUpgrade: () => void;
  onDowngrade: () => void;
  onEquip: (slot: number) => void;
  onClose: () => void;
  isMobile: boolean;
}

// Action type display helper
const getActionTypeInfo = (actionType: string) => {
  switch (actionType) {
    case 'action':
      return { label: 'Action', icon: Zap, color: 'text-red-400' };
    case 'bonus_action':
      return { label: 'Bonus Action', icon: Clock, color: 'text-yellow-400' };
    case 'reaction':
      return { label: 'Reaction', icon: RotateCcw, color: 'text-blue-400' };
    case 'passive':
      return { label: 'Passive', icon: Shield, color: 'text-green-400' };
    default:
      return { label: actionType, icon: Zap, color: 'text-muted-foreground' };
  }
};

// Usage type display helper
const getUsageTypeLabel = (usageType: string) => {
  switch (usageType) {
    case 'at_will':
      return 'At Will';
    case 'short_rest':
      return 'Short Rest';
    case 'long_rest':
      return 'Long Rest';
    default:
      return usageType;
  }
};

export function AbilityDetailsPanel({
  ability,
  currentTier,
  characterLevel,
  prestigePoints = 0,
  availablePoints,
  prerequisiteMet,
  equippedSlots,
  customImage,
  isCustomized,
  onImageUpload,
  onImageClear,
  onEdit,
  onUpgrade,
  onDowngrade,
  onEquip,
  onClose,
  isMobile,
}: AbilityDetailsPanelProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  if (!ability) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
        <Sparkles className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">Select an Ability</p>
        <p className="text-sm mt-2">
          Tap on any ability node to view its details and upgrade options.
        </p>
      </div>
    );
  }

  const treeConfig = TREE_VISUAL_CONFIG[ability.tree];
  const actionTypeInfo = getActionTypeInfo(ability.actionType);
  const ActionIcon = actionTypeInfo.icon;

  // Get icon component
  const IconComponent = (() => {
    if (ability.type === 'passive') return Shield;
    const iconName = ability.icon as keyof typeof LucideIcons;
    return (LucideIcons[iconName] as React.ComponentType<{ className?: string }>) || Zap;
  })();

  // Check upgrade eligibility
  const canUpgrade = currentTier < 3 && availablePoints > 0 && prerequisiteMet;
  const canDowngrade = currentTier > 0;
  const isMaxed = currentTier === 3;

  // Level requirement check
  const meetsLevelRequirement = !ability.minLevel || characterLevel >= ability.minLevel;

  // Get prerequisite ability info
  const prerequisiteAbility = ability.prerequisite 
    ? getAbilityById(ability.prerequisite.abilityId) 
    : null;

  // Get synergy abilities
  const synergyAbilities = ability.synergies
    ?.map(id => getAbilityById(id))
    .filter(Boolean) as Ability[] | undefined;

  // Calculate available equip slots
  const maxSlots = getActiveSlotsByLevel(characterLevel, prestigePoints);
  const availableSlots = Array.from({ length: maxSlots }, (_, i) => i)
    .filter(slot => !equippedSlots[slot] || equippedSlots[slot] === ability.id);

  const handleUpgradeClick = () => {
    if (isMobile && availablePoints <= 2) {
      setShowConfirm(true);
    } else {
      onUpgrade();
    }
  };

  const handleImageClick = () => {
    if (customImage) {
      // Show clear option when image exists
      onImageClear?.();
    } else {
      // Open file picker when no image
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImageUpload) return;
    
    try {
      await onImageUpload(file);
      toast({
        title: "Image uploaded",
        description: `Custom image set for ${ability.name}`,
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
    }
    
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={cn(
      'flex flex-col gap-4',
      isMobile ? 'p-4' : 'p-6'
    )}>
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={handleImageClick}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          className={cn(
            'rounded-full flex items-center justify-center shrink-0 relative overflow-hidden cursor-pointer transition-all',
            `bg-${treeConfig.primary}/20`,
            isMobile ? 'w-14 h-14' : 'w-16 h-16',
            'hover:ring-2 hover:ring-primary/50'
          )}
        >
          {customImage ? (
            <>
              <img
                src={customImage}
                alt={ability.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
              {isHovering && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
              )}
            </>
          ) : (
            <>
              <IconComponent className={cn(
                'text-current',
                `text-${treeConfig.primary}`,
                isMobile ? 'w-7 h-7' : 'w-8 h-8',
                isHovering && 'opacity-30'
              )} />
              {isHovering && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImagePlus className={cn('w-5 h-5', `text-${treeConfig.primary}`)} />
                </div>
              )}
            </>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className={cn(
              'font-bold truncate flex-1',
              isMobile ? 'text-xl' : 'text-2xl'
            )}>
              {ability.name}
            </h2>
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className="shrink-0 h-8 px-2"
              >
                <Pencil className="w-4 h-4" />
                {!isMobile && <span className="ml-1">Edit</span>}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            <Badge variant="outline" className={cn(`border-${treeConfig.primary} text-${treeConfig.primary}`)}>
              {treeConfig.name}
            </Badge>
            <Badge variant="outline">
              {ability.type === 'active' ? 'Active' : 'Passive'}
            </Badge>
            {ability.isHomebrew ? (
              <Badge className="text-xs bg-gradient-to-r from-primary to-primary/70 text-primary-foreground border-0">
                <Sparkles className="w-3 h-3 mr-1" />
                Homebrew
              </Badge>
            ) : isCustomized ? (
              <Badge variant="secondary" className="text-xs">
                <Pencil className="w-3 h-3 mr-1" />
                Customized
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {/* Action & Usage Info */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <ActionIcon className={cn('w-4 h-4', actionTypeInfo.color)} />
          <span>{actionTypeInfo.label}</span>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <span className="text-muted-foreground">
          {getUsageTypeLabel(ability.usageType)}
        </span>
      </div>

      <Separator />

      {/* Tier Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Progress</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3].map(tier => (
              <div
                key={tier}
                className={cn(
                  'w-4 h-4 rounded-full border-2 transition-all',
                  tier <= currentTier
                    ? tier === 3 
                      ? 'bg-yellow-400 border-yellow-400'
                      : `bg-${treeConfig.primary} border-${treeConfig.primary}`
                    : 'border-muted-foreground/30'
                )}
              />
            ))}
            <span className="ml-2 text-sm font-medium">
              {isMaxed ? 'Mastered' : `Tier ${currentTier}/3`}
            </span>
          </div>
        </div>
      </div>

      {/* Current Tier Description */}
      <div className="bg-muted/30 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-2">
          {currentTier === 0 ? 'Tier I Effect:' : `Current Effect (Tier ${['', 'I', 'II', 'III'][currentTier]}):`}
        </h4>
        <p className="text-sm text-muted-foreground">
          {ability.tierEffects[Math.max(0, currentTier - 1)]?.description || ability.tierEffects[0].description}
        </p>
      </div>

      {/* Next Tier Preview */}
      {!isMaxed && currentTier > 0 && (
        <div className="border border-dashed border-muted-foreground/30 rounded-lg p-4">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            Next Tier Benefits:
          </h4>
          <p className="text-sm text-muted-foreground">
            {ability.tierEffects[currentTier]?.description}
          </p>
        </div>
      )}

      {/* Prerequisites */}
      {prerequisiteAbility && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
          <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <p className="text-sm">
              Requires: <span className="font-medium">{prerequisiteAbility.name}</span>
              {' '}Tier {ability.prerequisite?.tier}+
            </p>
          </div>
          {!prerequisiteMet && (
            <Badge variant="destructive" className="shrink-0">Not Met</Badge>
          )}
        </div>
      )}

      {/* Level Requirement */}
      {ability.minLevel && !meetsLevelRequirement && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Level {ability.minLevel} Required</AlertTitle>
          <AlertDescription>
            You need to reach level {ability.minLevel} to unlock this ability.
          </AlertDescription>
        </Alert>
      )}

      {/* Synergies */}
      {synergyAbilities && synergyAbilities.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Synergizes With:</h4>
          <div className="flex flex-wrap gap-2">
            {synergyAbilities.map(synergy => (
              <Badge key={synergy.id} variant="outline" className="text-xs">
                {synergy.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Upgrade Confirmation (Mobile) */}
      {showConfirm && (
        <Alert className="border-yellow-500 bg-yellow-500/10">
          <AlertTitle>Confirm Upgrade</AlertTitle>
          <AlertDescription>
            You have {availablePoints} points remaining. Upgrade {ability.name} to Tier {currentTier + 1}?
          </AlertDescription>
          <div className="flex gap-2 mt-3">
            <Button 
              size="sm" 
              onClick={() => { onUpgrade(); setShowConfirm(false); }}
            >
              Confirm
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setShowConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-2">
        {/* Upgrade/Mastered Button */}
        {isMaxed ? (
          <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            <span className="font-bold text-yellow-400">Mastered</span>
          </div>
        ) : (
          <Button
            onClick={handleUpgradeClick}
            disabled={!canUpgrade || !meetsLevelRequirement}
            className={cn(
              'w-full',
              canUpgrade && meetsLevelRequirement && `bg-${treeConfig.primary} hover:bg-${treeConfig.primary}/90`
            )}
          >
            {currentTier === 0 ? 'Unlock Tier I' : `Upgrade to Tier ${['', 'II', 'III'][currentTier]}`}
            <span className="ml-2 text-xs opacity-80">(1 pt)</span>
          </Button>
        )}

        {/* Downgrade Button */}
        {canDowngrade && (
          <Button
            variant="outline"
            onClick={onDowngrade}
            className="w-full"
          >
            Refund Tier {['', 'I', 'II', 'III'][currentTier]}
          </Button>
        )}

        {/* Equip Buttons (Active abilities only) */}
        {ability.type === 'active' && currentTier > 0 && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-2">Equip to Loadout:</p>
            <div className="flex gap-2">
              {availableSlots.map(slot => (
                <Button
                  key={slot}
                  variant={equippedSlots[slot] === ability.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onEquip(slot)}
                  className="flex-1"
                >
                  Slot {slot + 1}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
