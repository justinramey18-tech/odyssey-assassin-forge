import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Character, getAbilityPointsForLevel, getTotalPointsSpent } from '@/lib/types';
import { CharacterEquipment } from '@/lib/inventory';
import { Achievement } from '@/lib/achievements';
import { XPPreset, getXPForLevel, getLevelProgress, XP_PRESETS } from '@/lib/xpSystem';
import { ShopItem } from '@/lib/shop/types';
import { useEquipmentStats } from '@/hooks/use-equipment-stats';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePromptDrawers } from '@/components/drawers/PromptDrawerProvider';
import { SaveData } from '@/hooks/use-auto-save';
import { 
  Settings, Coffee, Moon, TrendingUp,
  BookOpen, Sparkles, Timer, MessageCircle, Activity, Heart, Gem, Zap, PanelLeft, HelpCircle,
  Swords, Wand2, ListChecks, ChevronUp, Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { InstallBanner } from './InstallBanner';
import { ClockWidget } from './ClockWidget';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { DiceRollerScreen } from '@/components/diceRoller';
import { CharacterSavesDrawer, CharacterSavesTrigger } from './CharacterSavesDrawer';

// New redesigned components
import { CharacterNamePlaque } from './CharacterNamePlaque';
import { StatusIndicatorRow } from './StatusIndicatorRow';
import { DynamicHealthBar } from './DynamicHealthBar';
import { WildShapeOverlay } from './WildShapeOverlay';
import { AvailablePointsWidget } from './AvailablePointsWidget';
import { EnlargedD20Section } from './EnlargedD20Section';
import { CloudSyncStatusWidget } from './CloudSyncStatusWidget';
import { PrimaryNavigationCards } from './PrimaryNavigationCards';
import { BackgroundUploadButton } from './BackgroundUploadButton';
import { PartyPanel } from '@/components/party/PartyPanel';
import { FullscreenPartyChat } from '@/components/party/FullscreenPartyChat';
import type { UsePartySyncReturn } from '@/hooks/use-party-sync';
import { WildShapeLightningBorder, CRScaledPulse, TransformationBurst } from './WildShapeLightningBorder';
import { DragonParticles } from './DragonParticles';
import { XPProgressBar } from './XPProgressBar';
import { PrestigeData } from '@/lib/prestige';
import { PRESTIGE_CONFIG } from '@/lib/prestige/config';

import homeBackground from '@/assets/home-background-new.jpg';

// Navigable tab types
type NavigableTab = 
  | 'skills' 
  | 'abilities' 
  | 'arcana'
  | 'gear' 
  | 'feats' 
  | 'stars' 
  | 'scribe' 
  | 'combat' 
  | 'consumables' 
  | 'chronicle'
  | 'shop';

interface HomeScreenProps {
  character: Character;
  equipment: CharacterEquipment;
  achievements: Achievement[];
  currentXP: number;
  xpPreset: XPPreset;
  onBack: () => void;
  onNavigateToTab: (tab: NavigableTab) => void;
  onShortRest: () => void;
  onLongRest: () => void;
  onAddXP: (amount: number, source: string) => void;
  onXPPresetChange: (preset: XPPreset) => void;
  onManualLevelUp: () => void;
  onReturnToBuilder: () => void;
  onOpenSettings?: () => void;
  onOpenFAQ?: () => void;
  // HP props
  currentHP?: number;
  maxHP?: number;
  tempHP?: number;
  // Shop items for status indicators
  shopItems?: ShopItem[];
  // Initiative modifier (synced from ability scores)
  initiativeModifier?: number;
  // Custom background support
  customBackground?: string | null;
  onCustomBackgroundUpload?: (file: File) => Promise<void>;
  onCustomBackgroundClear?: () => void;
  // Wild Shape background (overrides custom/default when transformed)
  wildShapeBackground?: string | null;
  // Prestige data for XP bar
  prestigeData?: PrestigeData;
  // Cloud sync props
  lastCloudSyncTime?: string | null;
  isCloudSyncing?: boolean;
  onCloudSyncClick?: () => void;
  // Character saves drawer props
  onLoadSave?: (data: SaveData) => void;
  // Wild Shape props
  isWildShape?: boolean;
  wildShapeFormName?: string;
  wildShapeSpeed?: string;
  wildShapeAbilities?: string[];
  wildShapeUsesRemaining?: number;
  wildShapeMaxUses?: number;
  wildShapeTransformedAt?: number;
  wildShapeDurationMinutes?: number;
  wildShapeFormCR?: number;
  wildShapeFormHP?: number;
  wildShapeFormMaxHP?: number;
  wildShapeFormAC?: number;
  onDismissWildShape?: () => void;
  // Party props
  partySync?: UsePartySyncReturn;
  isAuthenticated?: boolean;
  userId?: string;
}

/** Map dragon form names to element-appropriate tint colors */
function getDragonTint(formName?: string): 'red' | 'amber' | 'purple' | 'cyan' | 'green' | 'indigo' {
  if (!formName) return 'green';
  const id = formName.toLowerCase().replace(/\s+/g, '-');
  const dragonTints: Record<string, 'red' | 'amber' | 'purple' | 'cyan' | 'green'> = {
    'red-dragon': 'red',
    'gold-dragon': 'amber',
    'white-dragon': 'cyan',
    'silver-dragon': 'cyan',
    'black-dragon': 'purple',
    'copper-dragon': 'amber',
  };
  return dragonTints[id] ?? 'green';
}

// Haptic feedback helper
const triggerHaptic = (intensity: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = { light: 10, medium: 20, heavy: 30 };
    navigator.vibrate(patterns[intensity]);
  }
};

// Transparent button style
const transparentButtonBase = "border border-white/30 rounded-lg bg-transparent hover:bg-white/10 hover:border-white/50 transition-all duration-300";

export function HomeScreen({ 
  character, 
  equipment, 
  achievements,
  currentXP,
  xpPreset,
  onNavigateToTab,
  onShortRest,
  onLongRest,
  onManualLevelUp,
  onReturnToBuilder,
  onOpenSettings,
  onOpenFAQ,
  currentHP: propCurrentHP,
  maxHP: propMaxHP,
  tempHP: propTempHP = 0,
  shopItems = [],
  initiativeModifier = 0,
  customBackground,
  onCustomBackgroundUpload,
  onCustomBackgroundClear,
  wildShapeBackground,
  prestigeData,
  lastCloudSyncTime,
  isCloudSyncing = false,
  onCloudSyncClick,
  onLoadSave,
  isWildShape = false,
  wildShapeFormName,
  wildShapeSpeed,
  wildShapeAbilities = [],
  wildShapeUsesRemaining = 0,
  wildShapeMaxUses = 0,
  wildShapeTransformedAt,
  wildShapeDurationMinutes,
  wildShapeFormCR,
  wildShapeFormHP,
  wildShapeFormMaxHP,
  wildShapeFormAC,
  onDismissWildShape,
  partySync,
  isAuthenticated = false,
  userId,
}: HomeScreenProps) {
  const isMobile = useIsMobile();

  // CR-scaled haptic burst on Wild Shape activation
  const wasWildShape = useRef(false);
  useEffect(() => {
    if (isWildShape && !wasWildShape.current && 'vibrate' in navigator) {
      const cr = wildShapeFormCR ?? 0;
      if (cr <= 2) {
        navigator.vibrate(15);
      } else if (cr <= 6) {
        navigator.vibrate([20, 30, 25]);
      } else if (cr <= 12) {
        navigator.vibrate([30, 20, 35, 20, 30]);
      } else {
        navigator.vibrate([40, 15, 50, 15, 40, 15, 50]);
      }
    }
    wasWildShape.current = isWildShape;
  }, [isWildShape, wildShapeFormCR]);
  const stats = useEquipmentStats(equipment);
  const multiplier = XP_PRESETS[xpPreset].multiplier;
  const [showDrawersMenu, setShowDrawersMenu] = useState(false);
  const [showDiceRoller, setShowDiceRoller] = useState(false);
  const [showCharacterSaves, setShowCharacterSaves] = useState(false);
  const [showPartyDrawer, setShowPartyDrawer] = useState(false);
  const [showPartyChatFullscreen, setShowPartyChatFullscreen] = useState(false);
  const [initiativeRollResult, setInitiativeRollResult] = useState<{ roll: number; total: number; prompt: string } | null>(null);
  const [footerCollapsed, setFooterCollapsed] = useState(() => {
    try { return localStorage.getItem('odyssey-home-footer-collapsed') === 'true'; } catch { return false; }
  });
  const toggleFooter = useCallback(() => {
    setFooterCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('odyssey-home-footer-collapsed', String(next)); } catch {}
      return next;
    });
  }, []);
  
  // Long Rest hold state
  const [longRestProgress, setLongRestProgress] = useState(0);
  const longRestTimerRef = useRef<NodeJS.Timeout | null>(null);
  const LONG_REST_HOLD_DURATION = 800; // 0.8 seconds
  
  // Get drawer context
  let drawerContext: ReturnType<typeof usePromptDrawers> | null = null;
  try {
    drawerContext = usePromptDrawers();
  } catch {
    // Not inside PromptDrawerProvider
  }

  // XP calculations
  const nextLevelXP = getXPForLevel(character.level + 1, multiplier);
  const canLevelUp = character.level < 20 && currentXP >= nextLevelXP;

  // Calculate HP values
  const defaultMaxHP = character.level * 8 + 10;
  const maxHP = propMaxHP ?? defaultMaxHP;
  const currentHP = propCurrentHP ?? maxHP;
  const tempHP = propTempHP;

  // Available ability points
  const availableAbilityPoints = useMemo(() => {
    return Math.max(0, getAbilityPointsForLevel(character.level) - getTotalPointsSpent(character.abilities));
  }, [character.level, character.abilities]);

  // Check for chronicle undo
  const hasChronicleUndo = !!localStorage.getItem('odyssey-chronicle-undo');
  
  // Check for new shop items (items added in last 10 minutes)
  const hasNewShopItems = useMemo(() => {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    return shopItems.some(item => new Date(item.detectedAt).getTime() > tenMinutesAgo);
  }, [shopItems]);

  // Get conditions data from drawer context
  const activeConditionCount = drawerContext?.conditions.activeCount ?? 0;
  const mostSevereCondition = useMemo(() => {
    if (!drawerContext) return null;
    const debuffs = drawerContext.conditions.debuffs;
    if (debuffs.length === 0) return null;
    // Get the first debuff name
    const firstDebuff = debuffs[0];
    return { name: firstDebuff?.name ?? 'Unknown', severity: 'moderate' as const };
  }, [drawerContext?.conditions.debuffs]);
  
  const hasConcentration = drawerContext?.conditions.hasConcentration ?? false;
  const concentrationSpell = drawerContext?.conditions.concentrationSpell;
  const concentrationSpellName = concentrationSpell?.name ?? null;

  // Cooldown summary
  const readyCooldownCount = drawerContext?.cooldownSummary.readyCount ?? 0;
  const coolingCooldownCount = drawerContext?.cooldownSummary.coolingCount ?? 0;

  // Initiative roll handler
  const handleInitiativeRoll = useCallback(() => {
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + initiativeModifier;
    
    // Generate AI DM prompt
    const rollQuality = roll === 20 ? 'NATURAL 20!' : roll === 1 ? 'NATURAL 1...' : roll >= 15 ? 'high' : roll <= 5 ? 'low' : 'moderate';
    const prompt = `🎲 **INITIATIVE ROLL**\n\n${character.name} rolls for initiative!\n\n**Roll:** ${roll} + ${initiativeModifier} (DEX) = **${total}**\n\n${roll === 20 ? '⚡ CRITICAL AWARENESS! ' + character.name + ' reacts with lightning reflexes, ready to strike before anyone else can blink.' : roll === 1 ? '😴 Caught completely off-guard... ' + character.name + ' is the last to realize combat has begun.' : `${character.name} enters the fray with ${rollQuality} awareness.`}\n\n*Narrate how ${character.name} enters combat with an initiative of ${total}.*`;
    
    setInitiativeRollResult({ roll, total, prompt });
    
    // Copy to clipboard
    navigator.clipboard.writeText(prompt).then(() => {
      triggerHaptic('medium');
    });
  }, [initiativeModifier, character.name]);

  const handleQuickAction = (action: 'shortRest' | 'longRest' | 'levelUp') => {
    triggerHaptic('medium');
    switch (action) {
      case 'shortRest':
        onShortRest();
        break;
      case 'longRest':
        onLongRest();
        break;
      case 'levelUp':
        onManualLevelUp();
        break;
    }
  };

  // Long Rest hold handlers
  const handleLongRestStart = useCallback(() => {
    setLongRestProgress(0);
    const startTime = Date.now();
    
    longRestTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / LONG_REST_HOLD_DURATION) * 100, 100);
      setLongRestProgress(progress);
      
      if (elapsed >= LONG_REST_HOLD_DURATION) {
        if (longRestTimerRef.current) {
          clearInterval(longRestTimerRef.current);
          longRestTimerRef.current = null;
        }
        handleQuickAction('longRest');
        setLongRestProgress(0);
      }
    }, 50);
  }, []);

  const handleLongRestEnd = useCallback(() => {
    if (longRestTimerRef.current) {
      clearInterval(longRestTimerRef.current);
      longRestTimerRef.current = null;
    }
    setLongRestProgress(0);
  }, []);

  // Drawer menu options
  const drawerOptions = [
    { id: 'quick-actions', label: 'Quick Actions', icon: ListChecks, color: 'text-emerald-400', action: drawerContext?.openQuickActionsDrawer },
    { id: 'combat', label: 'Combat', icon: Swords, color: 'text-red-400', action: () => { setShowDrawersMenu(false); onNavigateToTab('combat'); } },
    { id: 'arcana', label: 'Arcana', icon: Wand2, color: 'text-indigo-400', action: () => { setShowDrawersMenu(false); onNavigateToTab('arcana'); } },
    { id: 'abilities', label: 'Abilities', icon: Zap, color: 'text-purple-400', action: () => { setShowDrawersMenu(false); onNavigateToTab('abilities'); } },
    { id: 'prompts', label: 'RP Prompts', icon: Gem, color: 'text-yellow-400', action: drawerContext?.openInfinityDrawer },
    { id: 'settings', label: 'Settings', icon: Settings, color: 'text-slate-400', action: onOpenSettings },
  ];

  const handleDrawerOptionClick = (action?: () => void) => {
    if (action) {
      triggerHaptic('light');
      setShowDrawersMenu(false);
      action();
    }
  };

  const handleContextualCardClick = (cardId: string) => {
    triggerHaptic('light');
    if (cardId === 'shop') {
      onNavigateToTab('consumables'); // Shop is part of consumables/inventory
    } else {
      onNavigateToTab(cardId as NavigableTab);
    }
  };
  const hasWildShapeBg = isWildShape && !!wildShapeBackground;
  const defaultBg = customBackground || homeBackground;

  return (
    <div className="fixed inset-0 z-50 relative min-h-screen w-full overflow-hidden">
      {/* Default background layer (always present) */}
      <BackgroundWrapper
        imagePath={defaultBg}
        overlayOpacity={customBackground ? 55 : 45}
        tintColor="cyan"
        tintOpacity={8}
        fixed={true}
        backgroundSize="cover"
        backgroundPosition="center center"
        className="fixed inset-0 z-0"
      >
        <div />
      </BackgroundWrapper>

      {/* Wild Shape background layer (crossfades in/out) */}
      <AnimatePresence>
        {hasWildShapeBg && (
          <motion.div
            key="wild-shape-bg"
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-[1] origin-center"
          >
            <BackgroundWrapper
              imagePath={wildShapeBackground!}
              overlayOpacity={40}
              tintColor={getDragonTint(wildShapeFormName)}
              tintOpacity={15}
              fixed={true}
              backgroundSize="cover"
              backgroundPosition="center center"
              className="absolute inset-0"
            >
              <div />
            </BackgroundWrapper>
            {/* Looping green energy pulse overlay — intensity scales with CR */}
            <CRScaledPulse cr={wildShapeFormCR ?? 0} formName={wildShapeFormName} />
            {/* DBZ-style crackling lightning on all edges — scales with CR */}
            <WildShapeLightningBorder cr={wildShapeFormCR ?? 0} formName={wildShapeFormName} />
            {/* Dragon element particles — embers, snowflakes, or acid drops */}
            <DragonParticles formName={wildShapeFormName} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* One-shot transformation burst (flash + shake) for high-CR forms */}
      <AnimatePresence>
        {hasWildShapeBg && (
          <TransformationBurst key={`burst-${wildShapeFormName}`} cr={wildShapeFormCR ?? 0} formName={wildShapeFormName} />
        )}
      </AnimatePresence>

      {/* Content layer */}
      <div className="relative z-10">
      <div className="flex flex-col h-screen overflow-hidden relative z-10">
        {/* Install Banner */}
        <InstallBanner />

        {/* Minimal Utilities Header */}
        <motion.header 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between px-4 py-3 border-b border-white/10"
        >
          {/* Hamburger Menu - Character Saves */}
          <div className="flex items-center gap-2">
            <CharacterSavesTrigger onClick={() => setShowCharacterSaves(true)} />
            <ClockWidget />
          </div>
          
          <div className="flex items-center gap-1">
            {/* Custom Background Upload Button */}
            {onCustomBackgroundUpload && onCustomBackgroundClear && (
              <BackgroundUploadButton
                hasCustomBackground={!!customBackground}
                onUpload={onCustomBackgroundUpload}
                onClear={onCustomBackgroundClear}
              />
            )}
            
            {/* Party Indicator / Create+Join */}
            {partySync && (
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setShowPartyDrawer(true);
                }}
                className={cn(
                  "rounded-lg transition-colors relative flex items-center gap-1.5",
                  partySync.party.partyId
                    ? "p-2 hover:bg-white/10"
                    : "px-2.5 py-1.5 hover:bg-emerald-900/20 border border-emerald-500/30"
                )}
                style={{ touchAction: 'manipulation' }}
                aria-label={partySync.party.partyId ? `Party — ${partySync.party.members.length} members` : 'Create or Join Party'}
              >
                <Users className={cn("w-4 h-4", partySync.party.partyId ? "text-emerald-400 w-5 h-5" : "text-emerald-400/70")} />
                {partySync.party.partyId ? (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-emerald-500 text-white">
                    {partySync.party.members.length}
                  </span>
                ) : (
                  <span className="text-[10px] font-cinzel uppercase tracking-wider text-emerald-400/70">Party</span>
                )}
              </button>
            )}

            {onOpenFAQ && (
              <button 
                onClick={() => {
                  triggerHaptic('light');
                  onOpenFAQ();
                }}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                style={{ touchAction: 'manipulation' }}
                aria-label="Help & FAQ"
              >
                <HelpCircle className="w-5 h-5 text-white/80" />
              </button>
            )}
            {onOpenSettings && (
              <button 
                onClick={() => {
                  triggerHaptic('light');
                  onOpenSettings();
                }}
                className="p-2 -mr-2 rounded-lg hover:bg-white/10 transition-colors"
                style={{ touchAction: 'manipulation' }}
                aria-label="Open settings"
              >
                <Settings className="w-5 h-5 text-white/80" />
              </button>
            )}
          </div>
        </motion.header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto">
          <div className="flex flex-col gap-4 py-4">
            {/* Character Name Plaque - Full width thin bar */}
            <CharacterNamePlaque 
              name={character.name} 
              level={character.level} 
            />

            {/* Party Chat Button - only visible when in a party */}
            {partySync?.party?.partyId && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => {
                  triggerHaptic('light');
                  setShowPartyChatFullscreen(true);
                }}
                className="mx-4 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-emerald-500/30 bg-emerald-900/20 hover:bg-emerald-900/30 transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-cinzel uppercase tracking-wider text-emerald-300">Party Chat</span>
                {partySync.partyMessages.length > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-emerald-500 text-white">
                    {partySync.partyMessages.length}
                  </span>
                )}
              </motion.button>
            )}

            {/* Cloud Sync Status Widget */}
            <CloudSyncStatusWidget
              characterName={character.name}
              characterLevel={character.level}
              lastSyncTime={lastCloudSyncTime}
              isSyncing={isCloudSyncing}
              onClick={onCloudSyncClick}
            />

            {/* Dynamic Health Bar */}
            <DynamicHealthBar
              currentHP={currentHP}
              maxHP={maxHP}
              tempHP={tempHP}
              ac={stats.totalAC}
              initiative={initiativeModifier}
              onTap={() => drawerContext?.openStatsDrawer()}
              onInitiativeClick={handleInitiativeRoll}
              isWildShape={isWildShape}
              wildShapeFormName={wildShapeFormName}
            />

            {/* Wild Shape Details Overlay */}
            {isWildShape && wildShapeFormName && onDismissWildShape && (
              <WildShapeOverlay
                formName={wildShapeFormName}
                speed={wildShapeSpeed || '30 ft.'}
                specialAbilities={wildShapeAbilities}
                usesRemaining={wildShapeUsesRemaining}
                maxUses={wildShapeMaxUses}
                transformedAt={wildShapeTransformedAt}
                durationMinutes={wildShapeDurationMinutes}
                onDismiss={onDismissWildShape}
                characterName={character.name}
                formCR={wildShapeFormCR}
                formHP={wildShapeFormHP}
                formMaxHP={wildShapeFormMaxHP}
                formAC={wildShapeFormAC}
              />
            )}

            <XPProgressBar
              currentLevel={character.level}
              currentXP={currentXP}
              prestigeData={prestigeData}
              nextPrestigeXPRequired={PRESTIGE_CONFIG.XP_PER_PRESTIGE_LEVEL}
              onClick={() => onNavigateToTab('skills')}
            />

            {/* Live Status Indicator Row - Centered below AC/Init */}
            <StatusIndicatorRow
              activeConditionCount={activeConditionCount}
              mostSevereCondition={mostSevereCondition}
              hasConcentration={hasConcentration}
              concentrationSpellName={concentrationSpellName}
              readyCooldownCount={readyCooldownCount}
              coolingCooldownCount={coolingCooldownCount}
              shopItems={shopItems}
              onConditionsClick={() => drawerContext?.openConditionsDrawer()}
              onCooldownsClick={() => drawerContext?.openCooldownDrawer()}
              onShopClick={() => onNavigateToTab('consumables')}
            />

            {/* Initiative Roll Result Toast */}
            {initiativeRollResult && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mx-4 p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/40 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg",
                      initiativeRollResult.roll === 20 ? "bg-yellow-500 text-black" :
                      initiativeRollResult.roll === 1 ? "bg-red-500 text-white" :
                      "bg-yellow-500/30 text-yellow-400"
                    )}>
                      {initiativeRollResult.roll}
                    </div>
                    <div>
                      <p className="text-xs text-yellow-400/80 font-cinzel uppercase">Initiative</p>
                      <p className="font-bold text-white text-lg">
                        Total: {initiativeRollResult.total}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setInitiativeRollResult(null)}
                    className="text-white/60 hover:text-white p-1"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-yellow-400/60 mt-2">✓ Copied to clipboard for AI DM</p>
              </motion.div>
            )}

            {/* Available Points Widget (Conditional) */}
            <AvailablePointsWidget
              availablePoints={availableAbilityPoints}
              onSpendClick={() => {
                triggerHaptic('light');
                onNavigateToTab('abilities');
              }}
            />

            {/* Enlarged D20 Section */}
            <EnlargedD20Section 
              onClick={() => setShowDiceRoller(true)} 
            />

            {/* Quick Actions (moved from footer) */}
            <div className="px-4 py-2">
              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                {/* Short Rest */}
                <button
                  className={cn(transparentButtonBase, "py-3 flex flex-col items-center gap-1 text-white")}
                  onClick={() => handleQuickAction('shortRest')}
                  style={{ touchAction: 'manipulation' }}
                >
                  <Coffee className="w-5 h-5 text-amber-400" />
                  <span className="text-xs font-cinzel drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">Short Rest</span>
                </button>
                
                {/* Long Rest (Hold to activate) */}
                <button
                  className={cn(
                    transparentButtonBase, 
                    "py-3 flex flex-col items-center gap-1 text-white relative overflow-hidden"
                  )}
                  onTouchStart={handleLongRestStart}
                  onTouchEnd={handleLongRestEnd}
                  onTouchCancel={handleLongRestEnd}
                  onMouseDown={handleLongRestStart}
                  onMouseUp={handleLongRestEnd}
                  onMouseLeave={handleLongRestEnd}
                  style={{ touchAction: 'manipulation' }}
                  aria-label="Hold for Long Rest"
                >
                  {/* Progress Overlay */}
                  <div 
                    className="absolute inset-0 bg-blue-500/30 transition-all"
                    style={{ width: `${longRestProgress}%` }}
                  />
                  <Moon className="w-5 h-5 text-blue-400 relative z-10" />
                  <span className="text-xs font-cinzel drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)] relative z-10">
                    {longRestProgress > 0 ? 'Hold...' : 'Long Rest'}
                  </span>
                </button>
                
                {/* Level Up */}
                {canLevelUp ? (
                  <button
                    className={cn(
                      transparentButtonBase, 
                      "py-3 flex flex-col items-center gap-1 text-white",
                      "border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.3)] animate-pulse"
                    )}
                    onClick={() => handleQuickAction('levelUp')}
                    style={{ touchAction: 'manipulation' }}
                  >
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <span className="text-xs font-cinzel drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">Level Up</span>
                  </button>
                ) : (
                  <div
                    className={cn(transparentButtonBase, "py-3 flex flex-col items-center gap-1 opacity-40 cursor-not-allowed")}
                  >
                    <TrendingUp className="w-5 h-5 text-white/50" />
                    <span className="text-xs font-cinzel text-white/50 drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">Level Up</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Primary Navigation Cards Footer — Collapsible */}
        <motion.footer 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.3 }}
          className="border-t border-white/10"
        >
          {/* Collapse toggle tab */}
          <button
            onClick={toggleFooter}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 min-h-[48px] transition-all duration-200",
              footerCollapsed
                ? "bg-white/5 hover:bg-white/10 border-b border-white/5"
                : "hover:bg-white/5"
            )}
            style={{ touchAction: 'manipulation' }}
            aria-label={footerCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {footerCollapsed ? (
              <>
                <div className="flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/50" />
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400/50" />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400/50" />
                </div>
                <span className="text-[11px] font-cinzel uppercase tracking-widest text-white/50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  Navigation
                </span>
                <motion.div
                  animate={{ rotate: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronUp className="w-5 h-5 text-white/50" />
                </motion.div>
              </>
            ) : (
              <>
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">
                  Collapse
                </span>
                <motion.div
                  animate={{ rotate: 180 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronUp className="w-5 h-5 text-white/40" />
                </motion.div>
              </>
            )}
          </button>

          {/* Collapsible content */}
          <motion.div
            initial={false}
            animate={{ 
              height: footerCollapsed ? 0 : 'auto',
              opacity: footerCollapsed ? 0 : 1,
            }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <PrimaryNavigationCards
                onQuickMenusClick={() => {
                  triggerHaptic('light');
                  setShowDrawersMenu(true);
                }}
                onCombatClick={() => {
                  triggerHaptic('light');
                  onNavigateToTab('combat');
                }}
                onContextualClick={handleContextualCardClick}
                onChronicleClick={() => {
                  triggerHaptic('light');
                  onNavigateToTab('chronicle');
                }}
                onScribeClick={() => {
                  triggerHaptic('light');
                  onNavigateToTab('scribe');
                }}
                onOracleClick={() => {
                  triggerHaptic('light');
                  drawerContext?.openOracleDrawer?.();
                }}
                achievements={achievements}
                hasChronicleUndo={hasChronicleUndo}
                hasNewShopItems={hasNewShopItems}
              />
            </div>
          </motion.div>
        </motion.footer>
      </div>

      {/* Drawers Quick-Access Sheet */}
      <Sheet open={showDrawersMenu} onOpenChange={setShowDrawersMenu}>
        <SheetContent side="bottom" className="h-auto max-h-[60vh] rounded-t-xl">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <SheetTitle className="text-center font-cinzel mb-4">Quick Access</SheetTitle>
          
          <div className="grid grid-cols-3 gap-3 pb-6">
            {drawerOptions.map((option) => {
              const IconComponent = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => handleDrawerOptionClick(option.action)}
                  disabled={!option.action}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg",
                    "border border-border/50 bg-card/50",
                    "hover:bg-card hover:border-border transition-all",
                    "disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                  style={{ touchAction: 'manipulation' }}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    "bg-muted/50"
                  )}>
                    <IconComponent className={cn("w-6 h-6", option.color)} />
                  </div>
                  <span className="text-sm font-medium font-cinzel">{option.label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dice Roller Overlay */}
      {showDiceRoller && (
        <div className="fixed inset-0 z-[60] bg-background">
          <DiceRollerScreen
            onBack={() => setShowDiceRoller(false)}
            onShareToParty={partySync?.party.partyId ? (label, expression, result, details) => {
              partySync?.shareRoll(label, expression, result, details, character.name || 'Unknown');
            } : undefined}
          />
        </div>
      )}

      {/* Character Saves Drawer */}
      {onLoadSave && onCloudSyncClick && (
        <CharacterSavesDrawer
          isOpen={showCharacterSaves}
          onOpenChange={setShowCharacterSaves}
          currentCharacterName={character.name}
          currentCharacterLevel={character.level}
          onLoadSave={onLoadSave}
          onOpenCloudSettings={onCloudSyncClick}
        />
      )}

      {/* Party Drawer */}
      {partySync && (
        <Sheet open={showPartyDrawer} onOpenChange={setShowPartyDrawer}>
          <SheetContent side="right" className="w-[320px] bg-background/95 backdrop-blur-md border-l border-emerald-900/30 p-4">
            <SheetTitle className="sr-only">Party</SheetTitle>
            <PartyPanel
              partySync={partySync}
              characterName={character.name}
              currentStatus={{
                currentHP: currentHP,
                maxHP: maxHP,
                tempHP: tempHP,
                level: character.level,
              }}
              isAuthenticated={isAuthenticated}
              userId={userId}
            />
          </SheetContent>
        </Sheet>
      )}

      {/* Fullscreen Party Chat Drawer */}
      {partySync?.party?.partyId && (
        <FullscreenPartyChat
          open={showPartyChatFullscreen}
          onClose={() => setShowPartyChatFullscreen(false)}
          messages={partySync.partyMessages}
          currentUserId={userId}
          onSend={(msg) => partySync.sendMessage(msg, character.name)}
        />
      )}
      </div>
    </div>
  );
}
