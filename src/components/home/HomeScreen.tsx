import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Character, getAbilityPointsForLevel, getTotalPointsSpent } from '@/lib/types';
import { CharacterEquipment } from '@/lib/inventory';
import { Achievement } from '@/lib/achievements';
import { XPPreset, getXPForLevel, XP_PRESETS } from '@/lib/xpSystem';
import { ShopItem } from '@/lib/shop/types';
import { useEquipmentStats } from '@/hooks/use-equipment-stats';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePromptDrawers } from '@/components/drawers/PromptDrawerProvider';
import { SaveData } from '@/hooks/use-auto-save';
import { 
  Settings, Coffee, Moon, TrendingUp,
  MessageCircle, Gem, Zap, PanelLeft, HelpCircle, BookOpen,
  Swords, Wand2, ListChecks, ChevronUp, Users, User, Film,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { InstallBanner } from './InstallBanner';
import { ClockWidget } from './ClockWidget';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { DiceRollerScreen } from '@/components/diceRoller';
import { CharacterSavesDrawer, CharacterSavesTrigger } from './CharacterSavesDrawer';
import { FAQDrawer } from './FAQDrawer';
import { DMDrawer } from './DMDrawer';
import { EmpyreanScreen } from '@/components/empyrean/EmpyreanScreen';
import { isMomoEasterEgg } from '@/lib/easter-eggs';
import { GeraltCompanionScreen } from '@/components/companion';
// New redesigned components
import { CharacterNamePlaque } from './CharacterNamePlaque';
import { DynamicHealthBar } from './DynamicHealthBar';
import { WildShapeOverlay } from './WildShapeOverlay';
import { EnlargedD20Section } from './EnlargedD20Section';


import { CategoryQuickNav } from './CategoryQuickNav';
import { BackgroundUploadButton } from './BackgroundUploadButton';
import { PartyPanel } from '@/components/party/PartyPanel';
import { StandaloneBattleMap } from './StandaloneBattleMap';
import { FullscreenPartyChat } from '@/components/party/FullscreenPartyChat';
import type { UsePartySyncReturn } from '@/hooks/use-party-sync';
import { useOnlineStatus, useOnlineCount } from '@/hooks/use-online-status';
import { WildShapeLightningBorder, CRScaledPulse, TransformationBurst } from './WildShapeLightningBorder';
import { DragonParticles } from './DragonParticles';
import { PrestigeData } from '@/lib/prestige';
import { ChroniclerHomeView } from './ChroniclerHomeView';
import { AlignmentDriftIndicator } from '@/components/alignment/AlignmentDriftIndicator';

import homeBackground from '@/assets/home-background-mobile.jpg';

// Navigable tab types
type NavigableTab = 
  | 'skills' 
  | 'abilities' 
  | 'arcana'
  | 'legacy'
  | 'gear' 
  | 'feats' 
  | 'stars' 
  | 'scribe' 
  | 'combat' 
  | 'consumables' 
  | 'chronicle'
  | 'shop'
  | 'loot'
  | 'cloud'
  | 'settings';

import type { AppMode } from '@/lib/app-modes';

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
  /** If custom background is a video, its URL */
  customVideoUrl?: string | null;
  
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
  onQuickSave?: () => Promise<void>;
  // Character saves drawer props
  onLoadSave?: (data: SaveData, saveId?: string) => void;
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
  // Play mode
  playMode?: 'solo' | 'party';
  onPlayModeChange?: (mode: 'solo' | 'party') => void;
  // Trade props
  tradeProps?: {
    currentGold: number;
    consumablesInventory: import('@/lib/consumables/types').InventoryItem[];
    equipment: import('@/lib/inventory/types').CharacterEquipment;
    lootItems: import('@/lib/loot/types').LootItem[];
    onSendGold: (targetUserId: string, amount: number) => void;
    onSendConsumable: (targetUserId: string, item: import('@/lib/consumables/types').InventoryItem) => void;
    onSendGear: (targetUserId: string, item: import('@/lib/inventory/types').EquipmentItem) => void;
    onSendLoot: (targetUserId: string, item: import('@/lib/loot/types').LootItem) => void;
  };
  // External trigger to open party chat (from Party DM)
  openPartyChatRequested?: boolean;
  onPartyChatOpened?: () => void;
  // App mode visibility helpers
  isHomeFeatureVisible?: (featureId: string) => boolean;
  isDMButtonVisible?: (buttonId: string) => boolean;
  isQuickAccessVisible?: (itemId: string) => boolean;
  tabFilter?: (tabId: string) => boolean;
  // Current app mode (for companion mode switcher)
  appMode?: AppMode;
  onOpenModeSelection?: () => void;
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

/** Tiny sub-badge showing online count with a green dot */
function OnlineCountBadge({ members }: { members: Array<{ user_id: string; updated_at: string }> }) {
  const onlineCount = useOnlineCount(members);
  if (onlineCount === 0) return null;
  return (
    <span className="absolute -bottom-1 -right-1 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center text-[8px] font-bold rounded-full bg-background border border-emerald-500/60 text-emerald-400 gap-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      {onlineCount}
    </span>
  );
}

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
  
  currentHP: propCurrentHP,
  maxHP: propMaxHP,
  tempHP: propTempHP = 0,
  shopItems = [],
  initiativeModifier = 0,
  customBackground,
  customVideoUrl,
  
  onCustomBackgroundUpload,
  onCustomBackgroundClear,
  wildShapeBackground,
  prestigeData,
  lastCloudSyncTime,
  isCloudSyncing = false,
  onCloudSyncClick,
  onQuickSave,
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
  playMode = 'party',
  onPlayModeChange,
  tradeProps,
  openPartyChatRequested = false,
  onPartyChatOpened,
  isHomeFeatureVisible,
  isDMButtonVisible: _isDMButtonVisible,
  isQuickAccessVisible,
  tabFilter,
  appMode,
  onOpenModeSelection,
}: HomeScreenProps) {
  // Default visibility: show everything if no filter provided
  const showFeature = isHomeFeatureVisible ?? (() => true);
  const showQuickAccess = isQuickAccessVisible
    ? (id: string) => isQuickAccessVisible(`quickAccess.${id}`)
    : (() => true);
  const isMobile = useIsMobile();
  const chatOnlineStatusMap = useOnlineStatus(partySync?.party?.members ?? []);
  const featuresNavigate = useNavigate();

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
  const [showBattleMap, setShowBattleMap] = useState(false);
  const [showCharacterSaves, setShowCharacterSaves] = useState(false);
  const [showPartyDrawer, setShowPartyDrawer] = useState(false);
  const [showPartyChatFullscreen, setShowPartyChatFullscreen] = useState(false);
  const [showFAQDrawer, setShowFAQDrawer] = useState(false);
  const [showSoloConfirm, setShowSoloConfirm] = useState(false);
  const [showEmpyreanScreen, setShowEmpyreanScreen] = useState(false);
  const [showCompanionScreen, setShowCompanionScreen] = useState(false);
  const [geraltHpPct, setGeraltHpPct] = useState<number | undefined>(undefined);
  const lastSeenMessageCount = useRef(0);

  // Track if chat was opened from Party DM (so we can return to it on close)
  const chatOpenedFromDM = useRef(false);

  // Read Geralt companion HP for breathing animation on button
  const readGeraltHp = useCallback(() => {
    if (!isMomoEasterEgg(character.name)) return;
    const charId = character.name?.toLowerCase().trim() || 'unknown';
    try {
      const raw = localStorage.getItem(`odyssey_${charId}_geralt_companion`);
      if (raw) {
        const data = JSON.parse(raw);
        const pct = Math.max(0, Math.min(100, ((data.currentHP ?? 0) / (data.maxHP ?? 1)) * 100));
        setGeraltHpPct(pct);
      }
    } catch { /* ignore */ }
  }, [character.name]);

  useEffect(() => {
    readGeraltHp();
    const handler = () => readGeraltHp();
    window.addEventListener('geralt-hp-changed', handler);
    return () => window.removeEventListener('geralt-hp-changed', handler);
  }, [readGeraltHp]);

  // Re-read Geralt HP when companion screen closes
  useEffect(() => {
    if (!showCompanionScreen) readGeraltHp();
  }, [showCompanionScreen, readGeraltHp]);

  // Open party chat when requested externally (e.g. from Party DM)
  useEffect(() => {
    if (openPartyChatRequested && partySync?.party?.partyId && playMode === 'party') {
      chatOpenedFromDM.current = true;
      setShowPartyChatFullscreen(true);
      onPartyChatOpened?.();
    }
  }, [openPartyChatRequested, partySync?.party?.partyId, playMode, onPartyChatOpened]);
  
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

  // Drawer menu options (AI DM removed — now accessed via right-edge DM drawer)
  const drawerOptions = [
    // Row 1: RP Prompts, Quick Actions, Combat
    { id: 'prompts', label: 'RP Prompts', icon: Gem, color: 'text-yellow-400', action: drawerContext?.openInfinityDrawer },
    { id: 'quick-actions', label: 'Quick Actions', icon: ListChecks, color: 'text-emerald-400', action: drawerContext?.openQuickActionsDrawer },
    { id: 'combat', label: 'Combat', icon: Swords, color: 'text-red-400', action: () => { setShowDrawersMenu(false); onNavigateToTab('combat'); } },
    // Row 2: Abilities, Arcana, (empty slot filled by grid)
    { id: 'abilities', label: 'Abilities', icon: Zap, color: 'text-purple-400', action: () => { setShowDrawersMenu(false); onNavigateToTab('abilities'); } },
    { id: 'arcana', label: 'Arcana', icon: Wand2, color: 'text-indigo-400', action: () => { setShowDrawersMenu(false); onNavigateToTab('arcana'); } },
    // Row 3 handled separately: Oracle, Features, Settings
    { id: 'features', label: 'Features', icon: BookOpen, color: 'text-cyan-400', action: () => { setShowDrawersMenu(false); featuresNavigate('/features'); } },
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
  // When custom background is a video, use default image as fallback for the image layer
  const defaultBg = (customVideoUrl ? null : customBackground) || homeBackground;

  // Mode-specific looping video backgrounds for all users
  const MAGIC_BUILD_VIDEO_URL = 'https://rkkgmonjfvncpvlzsojw.supabase.co/storage/v1/object/public/videos/magic-build-bg.mp4';
  const PARTY_VIDEO_URL = 'https://rkkgmonjfvncpvlzsojw.supabase.co/storage/v1/object/public/videos/party-bg.mp4';
  
  const modeVideoUrl = appMode === 'magicBuild' ? MAGIC_BUILD_VIDEO_URL
    : appMode === 'party' ? PARTY_VIDEO_URL
    : undefined;
  const hasModeVideo = !!modeVideoUrl && !customBackground;
  
  // Determine active video source: custom video > mode-specific video > none
  const activeVideoSrc = customVideoUrl
    ? customVideoUrl
    : hasModeVideo
      ? modeVideoUrl
      : undefined;
  // Chronicler mode: render simplified narrative home
  if (appMode === 'chronicler') {
    return (
      <ChroniclerHomeView
        characterName={character.name}
        onNavigateToTab={onNavigateToTab}
        onOpenSettings={onOpenSettings}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 relative min-h-screen w-full overflow-hidden">
      {/* Default background layer (always present) */}
      <BackgroundWrapper
        imagePath={defaultBg}
        videoSrc={activeVideoSrc}
        overlayOpacity={customBackground ? 55 : 55}
        tintColor="cyan"
        tintOpacity={10}
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
      <div className="flex flex-col h-screen overflow-hidden relative z-10">
        {/* Install Banner */}
        <InstallBanner />

        {/* Minimal Utilities Header */}
        <motion.header 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between px-3 py-1.5 border-b border-white/10"
        >
          {/* Left: Hamburger, Background Upload */}
          <div className="flex items-center gap-1">
            <CharacterSavesTrigger onClick={() => setShowCharacterSaves(true)} />
            
            {/* Custom Background Upload Button */}
            {onCustomBackgroundUpload && onCustomBackgroundClear && (
              <BackgroundUploadButton
                hasCustomBackground={!!customBackground}
                onUpload={onCustomBackgroundUpload}
                onClear={onCustomBackgroundClear}
              />
            )}
          </div>
          
          {/* Right: Clock, Help */}
          <div className="flex items-center gap-1">
            <ClockWidget />
            <button 
                onClick={() => {
                  triggerHaptic('light');
                  setShowFAQDrawer(true);
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                style={{ touchAction: 'manipulation' }}
                aria-label="Help & FAQ"
              >
                <HelpCircle className="w-4 h-4 text-white/80" />
              </button>
          </div>
        </motion.header>

        {/* Character Name Plaque - pinned under header */}
        <CharacterNamePlaque 
          name={character.name} 
          level={character.level}
          primaryClass={character.primaryClass}
        />

        {/* Alignment Drift Indicator */}
        <AlignmentDriftIndicator className="px-4 py-1" />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto flex flex-col">
          <div className="flex flex-col gap-4 pb-[2px] mt-auto">

            {/* Wild Shape Details Overlay */}
            {showFeature('home.wildShape') && isWildShape && wildShapeFormName && onDismissWildShape && (
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

            {/* Solo/Party Mode Toggle + Party Button */}
            {showFeature('home.playModeToggle') && partySync && partySync.party.partyId && (
              <div className="flex items-center justify-center gap-2 mb-[2px]">
                {/* Mode Toggle */}
                {onPlayModeChange && (
                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      if (playMode === 'party') {
                        setShowSoloConfirm(true);
                      } else {
                        onPlayModeChange('party');
                      }
                    }}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-cinzel uppercase tracking-wider transition-colors border",
                      playMode === 'party'
                        ? "border-emerald-500/40 bg-emerald-900/30 text-emerald-300"
                        : "border-muted-foreground/30 bg-muted/20 text-muted-foreground"
                    )}
                    style={{ touchAction: 'manipulation' }}
                  >
                    {playMode === 'party' ? (
                      <>
                        <Users className="w-3 h-3" />
                        <span>Party</span>
                      </>
                    ) : (
                      <>
                        <User className="w-3 h-3" />
                        <span>Solo</span>
                      </>
                    )}
                  </button>
                )}

                {/* Party Drawer Button (only in party mode) */}
                {playMode === 'party' && (
                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      setShowPartyDrawer(true);
                    }}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors relative flex items-center gap-1.5"
                    style={{ touchAction: 'manipulation' }}
                    aria-label={`Party — ${partySync.party.members.length} members`}
                  >
                    <Users className="w-5 h-5 text-emerald-400" />
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-emerald-500 text-white">
                      {partySync.party.members.length}
                    </span>
                    <OnlineCountBadge members={partySync.party.members} />
                  </button>
                )}
              </div>
            )}

            {/* Party Button - when not in a party yet (create/join) */}
            {showFeature('home.partyButton') && partySync && !partySync.party.partyId && (
              <div className="flex justify-center mb-[2px]">
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setShowPartyDrawer(true);
                  }}
                  className="rounded-lg transition-colors relative flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-emerald-900/20 border border-emerald-500/30"
                  style={{ touchAction: 'manipulation' }}
                  aria-label="Create or Join Party"
                >
                  <Users className="w-4 h-4 text-emerald-400/70" />
                  <span className="text-[10px] font-cinzel uppercase tracking-wider text-emerald-400/70">Party</span>
                </button>
              </div>
            )}

            {/* Party Chat Button - above D20 (only in party mode) */}
            {showFeature('home.partyChat') && partySync?.party?.partyId && playMode === 'party' && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => {
                  triggerHaptic('light');
                  lastSeenMessageCount.current = partySync.partyMessages.length;
                  setShowPartyChatFullscreen(true);
                }}
                className="mx-4 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-emerald-500/30 bg-emerald-900/20 hover:bg-emerald-900/30 transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-cinzel uppercase tracking-wider text-emerald-300">Party Chat</span>
                {partySync.partyMessages.length > lastSeenMessageCount.current && (
                  <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-emerald-500 text-white">
                    {partySync.partyMessages.length - lastSeenMessageCount.current}
                  </span>
                )}
              </motion.button>
            )}

            {/* Enlarged D20 Section */}
            <EnlargedD20Section 
              onClick={() => setShowDiceRoller(true)}
              onMapClick={isMomoEasterEgg(character.name) ? undefined : () => setShowBattleMap(true)}
              onCompanionClick={isMomoEasterEgg(character.name) ? () => setShowCompanionScreen(true) : undefined}
              companionHpPct={geraltHpPct}
              onMenusClick={() => {
                triggerHaptic('light');
                setShowDrawersMenu(true);
              }}
            />

            {/* Dynamic Health Bar - below D20 */}
            {showFeature('home.healthBar') && (
            <DynamicHealthBar
              currentHP={currentHP}
              maxHP={maxHP}
              tempHP={tempHP}
              onTap={() => drawerContext?.openStatsDrawer()}
              isWildShape={isWildShape}
              wildShapeFormName={wildShapeFormName}
            />
            )}

            {/* Quick Actions (moved from footer) */}
            {showFeature('home.restButtons') && (
            <div className="px-4 py-2">
              <div className="flex gap-3 max-w-md mx-auto justify-center">
                {/* Short Rest */}
                <button
                  className={cn(transparentButtonBase, "py-3 px-6 flex flex-col items-center gap-1 text-white")}
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
                    "py-3 px-6 flex flex-col items-center gap-1 text-white relative overflow-hidden"
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
              </div>
            </div>
            )}
          </div>
        </div>

        {/* Primary Navigation Cards Footer — Collapsible */}
        {showFeature('home.categoryNav') && (
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
              {/* Category Quick Nav - Fighting/Inventory/Utility with dropdowns */}
              <CategoryQuickNav
                onSubTabSelect={(_category, subTabId) => {
                  triggerHaptic('light');
                  onNavigateToTab(subTabId as NavigableTab);
                }}
                isLegacyUnlocked={!!prestigeData && prestigeData.prestigeLevel > 0}
                onOpenCloud={onCloudSyncClick}
                onOpenSettings={onOpenSettings}
                tabFilter={tabFilter}
              />

            </div>
          </motion.div>
        </motion.footer>
        )}

        {/* Companion mode: subtle Change Mode button */}
        {appMode === 'companion' && (
          <div className="px-4 pb-4 pt-2 flex justify-center">
            <button
              onClick={onOpenModeSelection}
              className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground border border-border/30 rounded-lg bg-transparent hover:bg-white/10 transition-all duration-200"
              style={{ touchAction: 'manipulation' }}
            >
              <Settings className="w-3.5 h-3.5" />
              Change Mode
            </button>
          </div>
        )}
      </div>

      {/* Drawers Quick-Access Sheet */}
      <Sheet open={showDrawersMenu} onOpenChange={setShowDrawersMenu}>
        <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-xl pb-safe">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-3" />
          <SheetTitle className="text-center font-cinzel mb-3">Quick Access</SheetTitle>
          
          {/* Rows 1 & 2: standard 3-col grid */}
          <div className="grid grid-cols-3 gap-3">
            {drawerOptions.slice(0, 5).filter(o => showQuickAccess(o.id)).map((option) => {
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

          {/* Row 3: Oracle, Features, Settings — filtered by mode */}
          {(() => {
            const row3Items = [
              { id: 'oracle', label: 'Oracle', icon: MessageCircle, color: 'text-violet-400', action: () => { setShowDrawersMenu(false); drawerContext?.openOracleDrawer(); } },
              drawerOptions.find(o => o.id === 'features')!,
              drawerOptions.find(o => o.id === 'settings')!,
            ].filter(o => showQuickAccess(o.id));
            if (row3Items.length === 0) return null;
            return (
              <div className="grid grid-cols-3 gap-3 mt-3 pb-6">
                {row3Items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleDrawerOptionClick(item.action)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-lg",
                        "border border-border/50 bg-card/50",
                        "hover:bg-card hover:border-border transition-all"
                      )}
                      style={{ touchAction: 'manipulation' }}
                    >
                      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-muted/50">
                        <Icon className={cn("w-6 h-6", item.color)} />
                      </div>
                      <span className="text-sm font-medium font-cinzel">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Standalone Battle Map */}
      <StandaloneBattleMap
        open={showBattleMap}
        onClose={() => setShowBattleMap(false)}
        characterName={character.name || 'Me'}
      />

      {/* Geralt Companion Screen (momo easter egg) */}
      <GeraltCompanionScreen
        open={showCompanionScreen}
        onClose={() => setShowCompanionScreen(false)}
        characterId={character.name?.toLowerCase().trim() || 'unknown'}
      />

      {/* Dice Roller Overlay */}
      {showDiceRoller && (
        <div className="fixed inset-0 z-[60] bg-background">
          <DiceRollerScreen
            onBack={() => setShowDiceRoller(false)}
            onShareToParty={playMode === 'party' && partySync?.party.partyId ? (label, expression, result, details) => {
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
          lastCloudSyncTime={lastCloudSyncTime}
          isCloudSyncing={isCloudSyncing}
          onQuickSave={onQuickSave}
        />
      )}

      {/* Party Drawer - Fullscreen on mobile */}
      {partySync && (
        <Sheet open={showPartyDrawer} onOpenChange={setShowPartyDrawer}>
          <SheetContent side="right" className="w-full sm:w-[380px] sm:max-w-[380px] bg-background/95 backdrop-blur-md border-l border-emerald-900/30 p-0 overflow-hidden">
            <SheetTitle className="sr-only">Party</SheetTitle>
            <div className="h-full overflow-y-auto overscroll-contain p-4 pb-8">
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
                onOpenAIDM={() => drawerContext?.openAIDMScreen()}
                currentGold={tradeProps?.currentGold}
                consumablesInventory={tradeProps?.consumablesInventory}
                equipment={tradeProps?.equipment}
                lootItems={tradeProps?.lootItems}
                onSendGold={tradeProps?.onSendGold}
                onSendConsumable={tradeProps?.onSendConsumable}
                onSendGear={tradeProps?.onSendGear}
                onSendLoot={tradeProps?.onSendLoot}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Fullscreen Party Chat Drawer */}
      {partySync?.party?.partyId && playMode === 'party' && (
        <FullscreenPartyChat
          open={showPartyChatFullscreen}
          onClose={() => {
            lastSeenMessageCount.current = partySync.partyMessages.length;
            setShowPartyChatFullscreen(false);
            if (chatOpenedFromDM.current) {
              chatOpenedFromDM.current = false;
              drawerContext?.openPartyDMScreen();
            }
          }}
          messages={partySync.partyMessages}
          currentUserId={userId}
          isPartyCreator={partySync.party.isCreator}
          onSend={(msg, opts) => partySync.sendMessage(msg, character.name, opts)}
          onEdit={partySync.editMessage}
          onDelete={partySync.deleteMessage}
          onBulkDelete={partySync.bulkDeleteMessages}
          onClearAll={partySync.clearAllMessages}
          onPin={partySync.pinMessage}
          onUnpin={partySync.unpinMessage}
          onUploadImage={partySync.uploadChatImage}
          typingUsers={partySync.typingUsers}
          onTyping={() => partySync.broadcastTyping(character.name)}
          reactions={partySync.messageReactions}
          onAddReaction={(msgId, emoji) => partySync.addReaction(msgId, emoji, character.name)}
          onRemoveReaction={(msgId, emoji) => partySync.removeReaction(msgId, emoji)}
          onlineStatusMap={chatOnlineStatusMap}
        />
      )}

      {/* DM Drawer - Right Edge Swipe Panel */}
      <DMDrawer
        onOpenSoloDM={() => drawerContext?.openAIDMScreen()}
        onOpenPartyDM={() => drawerContext?.openPartyDMScreen()}
        onOpenEmpyrean={() => setShowEmpyreanScreen(true)}
        isPartyMode={playMode === 'party'}
        isDMButtonVisible={_isDMButtonVisible}
      />

      {/* Empyrean Campaign Screen */}
      <EmpyreanScreen
        open={showEmpyreanScreen}
        onClose={() => setShowEmpyreanScreen(false)}
        characterName={character.name}
      />

      {/* FAQ Drawer */}
      <FAQDrawer open={showFAQDrawer} onOpenChange={setShowFAQDrawer} />

      {/* Solo Mode Confirmation */}
      <AlertDialog open={showSoloConfirm} onOpenChange={setShowSoloConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-cinzel">Switch to Solo Mode?</AlertDialogTitle>
            <AlertDialogDescription>
              Party sync will be paused. You won't send or receive updates from party members until you switch back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onPlayModeChange?.('solo')}>
              Switch to Solo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
