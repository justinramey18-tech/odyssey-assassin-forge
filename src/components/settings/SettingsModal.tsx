import { useState, useMemo } from 'react';
import { Settings, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { MobileSettingsTabs, SettingsTab, settingsTabs } from './MobileSettingsTabs';
import { SettingsContent } from './SettingsContent';
import { DiceOddsMode, loadDiceOddsMode, saveDiceOddsMode } from '@/lib/diceOdds';
import { GameModeSettings as GameModeSettingsType, loadGameModeSettings, saveGameModeSettings } from '@/lib/gameModes';
import { XPProgressionMode, loadXPProgressionMode, saveXPProgressionMode } from './XPProgressionWidget';
import { generateDynamicGMGuide, generateCurrentStateSummary, STATIC_GM_GUIDE, CharacterBuildData } from '@/lib/gmGuideGenerator';
import { Character, Ability } from '@/lib/types';
import { EquipmentItem, EquipmentSlotType } from '@/lib/inventory/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface SettingsModalProps {
  characterName: string;
  onEditCharacter: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  prestigeData?: {
    totalPrestigePoints: number;
    prestigeLevel: number;
  };
  onPrestigeRespec?: () => void;
  onResetComplete?: () => void;
  // New props for dynamic GM guide
  character?: Character;
  abilities?: Ability[];
  unlockedAbilities?: Map<string, number>;
  equippedGear?: Record<EquipmentSlotType, EquipmentItem | null>;
  prestigeLevel?: number;
  aggregatedStats?: CharacterBuildData['aggregatedStats'];
}

export function SettingsModal({ 
  characterName, 
  onEditCharacter, 
  open: controlledOpen, 
  onOpenChange,
  prestigeData,
  onPrestigeRespec,
  onResetComplete,
  character,
  abilities,
  unlockedAbilities,
  equippedGear,
  prestigeLevel,
  aggregatedStats,
}: SettingsModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('game');
  const [showContent, setShowContent] = useState(false);
  
  // Settings state
  const [diceOddsMode, setDiceOddsMode] = useState<DiceOddsMode>(() => loadDiceOddsMode());
  const [gameModeSettings, setGameModeSettings] = useState<GameModeSettingsType>(() => loadGameModeSettings());
  const [xpProgressionMode, setXPProgressionMode] = useState<XPProgressionMode>(() => loadXPProgressionMode());

  const isMobile = useIsMobile();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;

  // Reset to menu when modal opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setShowContent(false);
    }
    setOpen(newOpen);
  };

  // Generate dynamic guide based on current character state
  const dynamicGuide = useMemo(() => {
    if (!character || !abilities || !unlockedAbilities || !equippedGear) {
      return null;
    }
    return generateDynamicGMGuide({
      character,
      abilities,
      unlockedAbilities,
      equippedGear,
      prestigeLevel,
      aggregatedStats,
    });
  }, [character, abilities, unlockedAbilities, equippedGear, prestigeLevel, aggregatedStats]);

  // Generate compact state summary
  const stateSummary = useMemo(() => {
    if (!character || !abilities || !unlockedAbilities || !equippedGear) {
      return null;
    }
    return generateCurrentStateSummary({
      character,
      abilities,
      unlockedAbilities,
      equippedGear,
      prestigeLevel,
      aggregatedStats,
    });
  }, [character, abilities, unlockedAbilities, equippedGear, prestigeLevel, aggregatedStats]);

  // Combined guide for copying
  const fullGuide = useMemo(() => {
    if (dynamicGuide) {
      return `${dynamicGuide}\n\n${'='.repeat(60)}\n\n${STATIC_GM_GUIDE}`;
    }
    return STATIC_GM_GUIDE;
  }, [dynamicGuide]);

  const handleGameModeChange = (settings: GameModeSettingsType) => {
    setGameModeSettings(settings);
    saveGameModeSettings(settings);
  };

  const handleDiceOddsChange = (mode: DiceOddsMode) => {
    setDiceOddsMode(mode);
    saveDiceOddsMode(mode);
  };

  const handleXPProgressionChange = (mode: XPProgressionMode) => {
    setXPProgressionMode(mode);
    saveXPProgressionMode(mode);
  };

  const handleTabSelect = (tab: SettingsTab) => {
    setActiveTab(tab);
    setShowContent(true);
  };

  const handleBackToMenu = () => {
    setShowContent(false);
  };

  const activeTabConfig = settingsTabs.find(t => t.id === activeTab);

  // Mobile: Full screen drawer with back navigation
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="h-[90vh] max-h-[90vh]">
          <DrawerHeader className="border-b border-border/50 pb-3">
            {showContent ? (
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBackToMenu}
                  className="shrink-0 -ml-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <DrawerTitle className="flex items-center gap-2 font-cinzel">
                  {activeTabConfig && (
                    <activeTabConfig.icon className={cn("w-5 h-5", activeTabConfig.color)} />
                  )}
                  {activeTabConfig?.label || 'Settings'}
                </DrawerTitle>
              </div>
            ) : (
              <DrawerTitle className="flex items-center gap-2 font-cinzel">
                <Settings className="w-5 h-5 text-primary" />
                Settings
              </DrawerTitle>
            )}
          </DrawerHeader>

          <ScrollArea className="flex-1 h-[calc(90vh-80px)]">
            <div className="p-4">
              {showContent ? (
                <SettingsContent
                  activeTab={activeTab}
                  characterName={characterName}
                  onEditCharacter={onEditCharacter}
                  onClose={() => setOpen(false)}
                  prestigeData={prestigeData}
                  onResetComplete={onResetComplete}
                  gameModeSettings={gameModeSettings}
                  onGameModeChange={handleGameModeChange}
                  xpProgressionMode={xpProgressionMode}
                  onXPProgressionChange={handleXPProgressionChange}
                  diceOddsMode={diceOddsMode}
                  onDiceOddsChange={handleDiceOddsChange}
                  dynamicGuide={dynamicGuide}
                  stateSummary={stateSummary}
                  fullGuide={fullGuide}
                />
              ) : (
                <MobileSettingsTabs
                  activeTab={activeTab}
                  onTabChange={handleTabSelect}
                />
              )}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Dialog with side-by-side layout
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-3 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 font-cinzel">
            <Settings className="w-5 h-5 text-primary" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[65vh]">
          {/* Sidebar */}
          <div className="w-56 border-r border-border/30 p-3 bg-muted/10 overflow-y-auto">
            <MobileSettingsTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              <SettingsContent
                activeTab={activeTab}
                characterName={characterName}
                onEditCharacter={onEditCharacter}
                onClose={() => setOpen(false)}
                prestigeData={prestigeData}
                onResetComplete={onResetComplete}
                gameModeSettings={gameModeSettings}
                onGameModeChange={handleGameModeChange}
                xpProgressionMode={xpProgressionMode}
                onXPProgressionChange={handleXPProgressionChange}
                diceOddsMode={diceOddsMode}
                onDiceOddsChange={handleDiceOddsChange}
                dynamicGuide={dynamicGuide}
                stateSummary={stateSummary}
                fullGuide={fullGuide}
              />
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
