import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Character, getAbilityPointsForLevel, getTotalPointsSpent } from '@/lib/types';
import { CharacterEquipment } from '@/lib/inventory';
import { Achievement } from '@/lib/achievements';
import { XPPreset, getXPForLevel, XP_PRESETS } from '@/lib/xpSystem';
import { useXPSnapshot } from '@/hooks/use-xp-snapshot';
import { ShopItem } from '@/lib/shop/types';
import { useEquipmentStats } from '@/hooks/use-equipment-stats';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePromptDrawers } from '@/components/drawers/PromptDrawerProvider';
import { SaveData } from '@/hooks/use-auto-save';
import { 
  Settings, Coffee, Moon, TrendingUp,
  MessageCircle, Gem, Zap, HelpCircle, BookOpen,
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
import { AppUpdateButton } from './AppUpdateButton';

import { ClockWidget } from './ClockWidget';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';

import { CharacterSavesDrawer, CharacterSavesTrigger } from './CharacterSavesDrawer';
import { FAQDrawer } from './FAQDrawer';
import { CharacterQuickSwitcher } from '@/components/navigation/CharacterQuickSwitcher';

import { EmpyreanScreen } from '@/components/empyrean/EmpyreanScreen';
import { isMomoEasterEgg } from '@/lib/easter-eggs';
import { loadEmpyreanDMConfig } from '@/lib/empyreanDMPersona';
import { GeraltCompanionScreen } from '@/components/companion';
// New redesigned components
import { CharacterNamePlaque } from './CharacterNamePlaque';

import { WildShapeOverlay } from './WildShapeOverlay';



import { CategoryQuickNav } from './CategoryQuickNav';
import { BackgroundUploadButton } from './BackgroundUploadButton';
import { PartyPanel } from '@/components/party/PartyPanel';
import { PartyRosterBoard } from '@/components/party/PartyRosterBoard';
import { useChatAvatars } from '@/hooks/use-chat-avatars';

import { FullscreenPartyChat } from '@/components/party/FullscreenPartyChat';
import type { UsePartySyncReturn } from '@/hooks/use-party-sync';
import { useOnlineStatus, useOnlineCount } from '@/hooks/use-online-status';
import { WildShapeLightningBorder, CRScaledPulse, TransformationBurst } from './WildShapeLightningBorder';
import { DragonParticles } from './DragonParticles';
import WeatherOverlay from './WeatherOverlay';
import { useWeather } from '@/hooks/use-weather';
import { PrestigeData } from '@/lib/prestige';
import { ChroniclerHomeView } from './ChroniclerHomeView';

import { EmpyreanDualHPBars } from '@/components/empyrean/EmpyreanDualHPBars';
import { EmpyreanDMContainer } from '@/components/empyrean/EmpyreanDMContainer';
import { EmpyreanDMScreen } from '@/components/empyrean/EmpyreanDMScreen';
import { StandalonePartyDMScreen } from '@/components/ai-dm/StandalonePartyDMScreen';
import { getSoloHP, getPartyHP } from '@/lib/dragonBondState';

import homeBackground from '@/assets/home-background-mobile.jpg';
import fullAccessBackground from '@/assets/full-access-home-bg.jpg';
import soloHomeBackgroundAsset from '@/assets/solo-home-bg.jpg.asset.json';
import empyreanHomeBackgroundAsset from '@/assets/empyrean-home-bg.jpg.asset.json';
import soloDmButtonArt from '@/assets/solo-dm-button.jpg.asset.json';
import empyreanDmButtonArt from '@/assets/empyrean-dm-button.jpg.asset.json';
import enterStoryEmblem from '@/assets/enter-story-emblem.png';
const soloBackground = soloHomeBackgroundAsset.url;
const empyreanHomeBackground = empyreanHomeBackgroundAsset.url;

function preloadImages(urls: (string | undefined)[], capMs: number): Promise<void> {
  const list = urls.filter((u): u is string => !!u);
  if (list.length === 0) return Promise.resolve();
  const loads = Promise.allSettled(list.map(u => { const i = new Image(); i.src = u; return i.decode(); }));
  return Promise.race([loads.then(() => undefined), new Promise<void>(r => setTimeout(r, capMs))]);
}

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
  onAppModeChange?: (mode: AppMode) => void;
  autoOpenPartyDM?: boolean;
  onAutoOpenPartyDMHandled?: () => void;
  autoOpenSoloDM?: boolean;
  onAutoOpenSoloDMHandled?: () => void;
  autoSyncCallbacks?: {
    onHPChange: (change: number, type: 'damage' | 'healing') => void;
    onUseConsumableByName?: (name: string, quantity?: number) => boolean;
    onAddXP: (amount: number, source: string) => void;
    onGoldChange: (netChange: number) => void;
    onConditionChange: (toAdd: string[], toRemove: string[]) => void;
    onRestOccurred: (type: 'short' | 'long') => void;
    getCurrentHP: () => number;
    getCurrentGold: () => number;
  };
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
  onAppModeChange,
  autoOpenPartyDM = false,
  onAutoOpenPartyDMHandled,
  autoOpenSoloDM = false,
  onAutoOpenSoloDMHandled,
  autoSyncCallbacks,
}: HomeScreenProps) {
  // Default visibility: show everything if no filter provided
  const showFeature = isHomeFeatureVisible ?? (() => true);
  const showQuickAccess = isQuickAccessVisible
    ? (id: string) => isQuickAccessVisible(`quickAccess.${id}`)
    : (() => true);
  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();
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
  const { weather } = useWeather();
  const xpSnapshot = useXPSnapshot(character.level, currentXP);
  const multiplier = xpSnapshot.multiplier;
  const [showDrawersMenu, setShowDrawersMenu] = useState(false);
  
  
  const [showCharacterSaves, setShowCharacterSaves] = useState(false);
  const [showPartyDrawer, setShowPartyDrawer] = useState(false);
  const [showPartyChatFullscreen, setShowPartyChatFullscreen] = useState(false);
  const [showFAQDrawer, setShowFAQDrawer] = useState(false);
  const [showSoloConfirm, setShowSoloConfirm] = useState(false);
  const [showEmpyreanScreen, setShowEmpyreanScreen] = useState(false);
  const [showEmpyreanDMContainer, setShowEmpyreanDMContainer] = useState(false);
  const [empyreanScreenAutoOpen, setEmpyreanScreenAutoOpen] = useState<'manual' | null>(null);
  const [bgReady, setBgReady] = useState(false);
  const [stage, setStage] = useState(0);
  const sequenceStartedRef = useRef(false);
  const handleBackgroundLoad = useCallback(() => setBgReady(true), []);




  // Empyrean HP bars data
  const empyreanSoloHP = appMode === 'empyrean' ? getSoloHP() : { current: 0, max: 0 };
  const empyreanPartyHP = appMode === 'empyrean' ? getPartyHP() : { current: 0, max: 0 };
  const [showCompanionScreen, setShowCompanionScreen] = useState(false);
  const [geraltHpPct, setGeraltHpPct] = useState<number | undefined>(undefined);
  // Persist last-read message count per party in localStorage
  const partyIdForChat = partySync?.party?.partyId;
  // Same avatar source the Live DM Table uses, so the roster pictures match the
  // pictures on each player's chat messages.
  const rosterAvatars = useChatAvatars(partyIdForChat ?? null, userId);
  const partySettled = !partySync || !partySync.party.isLoading;
  const hasRoster = playMode === 'party' && !!partySync?.party?.partyId && (partySync?.party?.members?.length ?? 0) > 0;
  useEffect(() => {
    if (!bgReady || !partySettled || sequenceStartedRef.current) return;
    sequenceStartedRef.current = true;
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

    const runSequence = async () => {
      if (hasRoster) {
        await preloadImages([enterStoryEmblem], 1200);
        if (cancelled) return;
        setStage(1);
        await wait(250);

        const members = partySync?.party.members ?? [];
        const orderedMembers = [...members].sort((a, b) => Number(b.user_id === userId) - Number(a.user_id === userId));
        const avatarUrls = orderedMembers.flatMap(member => [
          rosterAvatars.avatars[member.user_id]?.ic,
          rosterAvatars.avatars[member.user_id]?.ooc,
        ]);
        await preloadImages(avatarUrls, 1500);
        if (cancelled) return;
        setStage(2);
        await wait(250);
      }

      await preloadImages([soloDmButtonArt.url, empyreanDmButtonArt.url], 1200);
      if (cancelled) return;
      setStage(3);
      await wait(200);
      if (cancelled) return;
      setStage(4);
      await wait(200);
      if (cancelled) return;
      setStage(5);
    };

    void runSequence();
    return () => { cancelled = true; };
  }, [bgReady, partySettled]);
  useEffect(() => {
    const safety = window.setTimeout(() => setStage(5), 4000);
    return () => window.clearTimeout(safety);
  }, []);
  const lastSeenKey = partyIdForChat ? `odyssey_chat_lastSeen_${partyIdForChat}` : null;
  const lastSeenMessageCount = useRef(0);
  useEffect(() => {
    if (!lastSeenKey) { lastSeenMessageCount.current = 0; return; }
    try { lastSeenMessageCount.current = parseInt(localStorage.getItem(lastSeenKey) || '0', 10) || 0; } catch { lastSeenMessageCount.current = 0; }
  }, [lastSeenKey]);

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
  const nextLevelXP = xpSnapshot.nextLevelXP;
  const canLevelUp = !xpSnapshot.isMaxLevel && xpSnapshot.mode === 'xp' && xpSnapshot.xpRemaining === 0;

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

  // Auto-open Party DM when selected from onboarding
  useEffect(() => {
    if (autoOpenPartyDM && drawerContext) {
      drawerContext.openPartyDMScreen();
      onAutoOpenPartyDMHandled?.();
    }
  }, [autoOpenPartyDM, drawerContext, onAutoOpenPartyDMHandled]);

  // Auto-open Solo DM when selected from onboarding
  useEffect(() => {
    if (autoOpenSoloDM && drawerContext) {
      drawerContext.openAIDMScreen();
      onAutoOpenSoloDMHandled?.();
    }
  }, [autoOpenSoloDM, drawerContext, onAutoOpenSoloDMHandled]);

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
  const defaultBg = (customVideoUrl ? null : customBackground) || (appMode === 'empyrean' ? empyreanHomeBackground : appMode === 'storyteller' ? soloBackground : appMode === 'fullAccess' ? fullAccessBackground : homeBackground);
  // True only when one of the illustrated mode backgrounds is the active
  // background (no custom image/video override)
  const isArtBackground = !customVideoUrl && !customBackground && (appMode === 'fullAccess' || appMode === 'storyteller' || appMode === 'empyrean');

  // Mode-specific looping video backgrounds for all users
  const MAGIC_BUILD_VIDEO_URL = 'https://rkkgmonjfvncpvlzsojw.supabase.co/storage/v1/object/public/videos/magic-build-bg.mp4';
  const PARTY_VIDEO_URL = 'https://rkkgmonjfvncpvlzsojw.supabase.co/storage/v1/object/public/videos/party-bg.mp4';
  const MOMO_VIDEO_URL = '/videos/momo-bg.mp4';
  
  // Momo easter egg: override party mode background with special video
  const isMomo = isMomoEasterEgg(character.name);
  
  const modeVideoUrl = isMomo && appMode === 'party' ? MOMO_VIDEO_URL
    : appMode === 'magicBuild' ? MAGIC_BUILD_VIDEO_URL
    : appMode === 'party' ? PARTY_VIDEO_URL
    : undefined;
  const hasModeVideo = !!modeVideoUrl && !customBackground;
  
  // Determine active video source: custom video > mode-specific video > none
  const activeVideoSrc = customVideoUrl
    ? customVideoUrl
    : hasModeVideo
      ? modeVideoUrl
      : undefined;
  useEffect(() => {
    if (activeVideoSrc) setBgReady(true);
    const fallback = window.setTimeout(() => setBgReady(true), 1500);
    return () => window.clearTimeout(fallback);
  }, [activeVideoSrc]);
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
      {/* Illustrated mode backgrounds get a slow ambient zoom (disabled under reduced motion) */}
      <div
        className={cn(
          "fixed inset-0 z-0",
          isArtBackground && "full-access-ambient-zoom",
        )}
      >
        <BackgroundWrapper
          imagePath={defaultBg}
          videoSrc={activeVideoSrc}
          overlayOpacity={isArtBackground ? 35 : 55}
          tintColor={isArtBackground ? undefined : 'cyan'}
          tintOpacity={isArtBackground ? 0 : 10}
          fixed={true}
          backgroundSize="cover"
          backgroundPosition={isArtBackground ? 'center 40%' : 'center center'}
          className="fixed inset-0 z-0"
          onLoad={handleBackgroundLoad}
        >
          <div />
        </BackgroundWrapper>
      </div>

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

      {weather && (
        <WeatherOverlay
          condition={weather.condition}
          windSpeed={weather.windSpeed}
          isDay={weather.isDay}
        />
      )}

      {/* Content layer */}
      <div className="flex flex-col h-screen overflow-hidden relative z-10">
        {/* Empyrean dual HP bars */}
        {appMode === 'empyrean' && (
          <EmpyreanDualHPBars
            soloHP={empyreanSoloHP}
            partyHP={empyreanPartyHP}
            onSoloTap={() => drawerContext?.openStatsDrawer()}
            onPartyTap={() => drawerContext?.openStatsDrawer()}
          />
        )}
        {/* Install Banner */}
        {appMode === 'empyrean' ? (
          <InstallBanner />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 0 }}
            animate={stage >= 5 ? { opacity: 1, y: 0 } : { opacity: 0, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <InstallBanner />
          </motion.div>
        )}

        {/* Minimal Utilities Header */}
        <motion.header 
          initial={{ opacity: 0, y: 0 }}
          animate={appMode === 'empyrean' ? { opacity: 1 } : stage >= 5 ? { opacity: 1, y: 0 } : { opacity: 0, y: 0 }}
          transition={appMode === 'empyrean' ? { duration: 0.3 } : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
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
          
          {/* Right: Character switcher, Clock, Help */}
          <div className="flex items-center gap-1">
            <CharacterQuickSwitcher
              currentCharacterName={character.name}
              currentCharacterLevel={character.level}
              onLoadSave={onLoadSave ?? (() => {})}
              onCloudClick={onCloudSyncClick ?? (() => {})}
              onBeforeSwitch={onQuickSave}
            />
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
        {appMode === 'empyrean' ? (
          <CharacterNamePlaque 
            name={character.name} 
            level={character.level}
            primaryClass={character.primaryClass}
            dragonName={loadEmpyreanDMConfig()?.dragonName}
            onOpenSettings={onOpenSettings}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 0 }}
            animate={stage >= 5 ? { opacity: 1, y: 0 } : { opacity: 0, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <CharacterNamePlaque 
              name={character.name} 
              level={character.level}
              primaryClass={character.primaryClass}
              dragonName={loadEmpyreanDMConfig()?.dragonName}
              onOpenSettings={onOpenSettings}
            />
          </motion.div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto flex flex-col">
          {appMode === 'empyrean' ? (
            <>
              {/* TOP: Party + Empyrean Awaits — right under header */}
              <div className="flex flex-col gap-3 px-4 pt-2">
                {/* Solo/Party Mode Toggle + Party Button */}
                {showFeature('home.playModeToggle') && partySync && partySync.party.partyId && (
                  <div className="flex items-center justify-center gap-2">
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

                {showFeature('home.partyButton') && partySync && !partySync.party.partyId && (
                  <div className="flex justify-center">
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

                {/* "The Empyrean Awaits" button */}
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  onClick={() => {
                    triggerHaptic('light');
                    const hasConfig = !!loadEmpyreanDMConfig();
                    const isInParty = !!partySync?.party?.partyId;
                    if (hasConfig || isInParty) {
                      setShowEmpyreanDMContainer(true);
                    } else {
                      setShowEmpyreanScreen(true);
                    }
                  }}
                  className={cn(
                    "w-full flex flex-col items-center gap-2 py-4 rounded-xl",
                    "border border-amber-500/35 bg-gradient-to-br from-amber-500/[0.08] to-amber-700/[0.04]",
                    "backdrop-blur-sm",
                    "hover:from-amber-500/[0.14] hover:to-amber-700/[0.08] hover:border-amber-500/55",
                    "active:scale-[0.97] transition-all duration-200"
                  )}
                  style={{ touchAction: 'manipulation' }}
                >
                  <span className="text-xl">🐉</span>
                  <span className="text-sm font-cinzel font-bold uppercase tracking-[0.2em] text-amber-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
                    The Empyrean Awaits
                  </span>
                </motion.button>
              </div>

              {/* SPACER — dragon art fills the middle */}
              <div className="flex-1" />

              {/* BOTTOM: Rest + Menus */}
              <div className="flex flex-col gap-3 pb-[2px]">
                {/* App update */}
                {showFeature('home.restButtons') && (
                  <div className="px-4 py-2">
                    <div className="flex gap-3 max-w-md mx-auto justify-center">
                      <AppUpdateButton className={transparentButtonBase} />
                    </div>
                  </div>
                )}


              </div>
            </>
          ) : (
            <>
              {/* Party roster — top of home screen */}
              {playMode === 'party' && partySync?.party?.partyId && (
                <motion.div
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
                  animate={stage >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  <PartyRosterBoard
                    members={partySync.party.members}
                    avatars={rosterAvatars.avatars}
                    oocNames={rosterAvatars.oocNames}
                    currentUserId={userId}
                    showEmblem={stage >= 1}
                    showFaces={stage >= 2}
                    onOpenPartyDM={() => { triggerHaptic('light'); drawerContext?.openPartyDMScreen(); }}
                  />
                </motion.div>
              )}

              <div className="flex flex-col gap-4 pb-[2px] mt-auto">

              {/* Wild Shape Details Overlay */}
              {showFeature('home.wildShape') && isWildShape && wildShapeFormName && onDismissWildShape && (
                <motion.div
                  initial={{ opacity: 0, y: 0 }}
                  animate={stage >= 5 ? { opacity: 1, y: 0 } : { opacity: 0, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
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
                </motion.div>
              )}

              {/* Solo/Party Mode Toggle + Party Button */}
              {showFeature('home.playModeToggle') && partySync && partySync.party.partyId && (
                <motion.div
                  initial={{ opacity: 0, y: 0 }}
                  animate={stage >= 5 ? { opacity: 1, y: 0 } : { opacity: 0, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center justify-center gap-2 mb-[2px]"
                >
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
                </motion.div>
              )}

              {showFeature('home.partyButton') && partySync && !partySync.party.partyId && (
                <motion.div
                  initial={{ opacity: 0, y: 0 }}
                  animate={stage >= 5 ? { opacity: 1, y: 0 } : { opacity: 0, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="flex justify-center mb-[2px]"
                >
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
                </motion.div>
              )}

              {/* DM Launch Buttons */}
              <motion.div
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
                animate={stage >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center justify-center gap-3 px-4 py-3"
              >
                {_isDMButtonVisible('dm.solo') && (
                  <motion.button
                    initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
                    animate={stage >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => { triggerHaptic('light'); onAppModeChange?.('storyteller'); drawerContext?.openAIDMScreen(); }}
                    className="flex-1 aspect-square rounded-xl overflow-hidden border border-violet-500/30 active:scale-[0.97] transition-all duration-200"
                    style={{ touchAction: 'manipulation' }}
                    aria-label="Play solo campaign"
                  >
                    <img src={soloDmButtonArt.url} alt="" className="w-full h-full object-cover" loading="eager" decoding="async" />
                  </motion.button>
                )}
                {_isDMButtonVisible('dm.empyrean') && (
                  <motion.button
                    initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
                    animate={stage >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => { triggerHaptic('light'); onAppModeChange?.('empyrean'); setShowEmpyreanScreen(true); }}
                    className="flex-1 aspect-square rounded-xl overflow-hidden border border-amber-500/30 active:scale-[0.97] transition-all duration-200"
                    style={{ touchAction: 'manipulation' }}
                    aria-label="Dragon rider campaign"
                  >
                    <img src={empyreanDmButtonArt.url} alt="" className="w-full h-full object-cover" loading="eager" decoding="async" />
                  </motion.button>
                )}
              </motion.div>

              {/* Host Campaign Architect shortcut */}
              {partySync?.party?.isCreator && playMode === 'party' && (
                <motion.div
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
                  animate={stage >= 5 ? { opacity: 1, y: 0 } : { opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="px-4"
                >
                  <button
                    onClick={() => { triggerHaptic('light'); drawerContext?.openPartyDMCampaignBuilder(); }}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-3 rounded-xl",
                      "border border-amber-500/40 bg-amber-950/25 backdrop-blur-sm",
                      "hover:bg-amber-900/35 hover:border-amber-400/60",
                      "active:scale-[0.98] transition-all duration-200"
                    )}
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Wand2 className="w-5 h-5 text-amber-400" />
                    <span className="text-sm font-cinzel uppercase tracking-wider text-amber-300">New Game / Campaign Architect</span>
                  </button>
                </motion.div>
              )}




              {/* Quick Actions */}
              {showFeature('home.restButtons') && (
                <motion.div
                  initial={{ opacity: 0, y: 0 }}
                  animate={stage >= 5 ? { opacity: 1, y: 0 } : { opacity: 0, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="px-4 py-2"
                >
                  <div className="flex gap-3 max-w-md mx-auto justify-center">
                    <AppUpdateButton className={transparentButtonBase} />
                  </div>
                </motion.div>
              )}

              </div>
            </>
          )}
        </div>

        {/* Primary Navigation Cards Footer — Collapsible */}
        {showFeature('home.categoryNav') && (
        <motion.footer 
          initial={{ opacity: 0, y: appMode === 'empyrean' ? 20 : prefersReducedMotion ? 0 : 20 }}
          animate={appMode === 'empyrean' ? { opacity: 1, y: 0 } : stage >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
          transition={appMode === 'empyrean' ? { delay: 0.9, duration: 0.3 } : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
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


      {/* Geralt Companion Screen (momo easter egg) */}
      <GeraltCompanionScreen
        open={showCompanionScreen}
        onClose={() => setShowCompanionScreen(false)}
        characterId={character.name?.toLowerCase().trim() || 'unknown'}
      />


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
            if (lastSeenKey) try { localStorage.setItem(lastSeenKey, String(partySync.partyMessages.length)); } catch {}
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


      {/* Empyrean Campaign Screen */}
      <EmpyreanScreen
        open={showEmpyreanScreen}
        onClose={() => {
          setShowEmpyreanScreen(false);
          setEmpyreanScreenAutoOpen(null);
        }}
        characterName={character.name}
        characterContext={drawerContext?.characterContext ?? { name: character.name, level: character.level, currentHP: 10, maxHP: 10, abilities: [], equippedAbilities: [], equipment: [], activeSetBonuses: [], consumables: [], cooldowns: { active: [], ready: [] }, prestigeLevel: 0, prestigeAbilities: [] } as any}
        autoSyncCallbacks={autoSyncCallbacks}
        autoOpen={empyreanScreenAutoOpen}
        onAutoOpenConsumed={() => setEmpyreanScreenAutoOpen(null)}
      />

      {/* Empyrean Swipeable DM Container */}
      <EmpyreanDMContainer
        open={showEmpyreanDMContainer}
        onClose={() => setShowEmpyreanDMContainer(false)}
        hasParty={!!partySync?.party?.partyId}
        renderSolo={(swipeHandlers) => (
          <EmpyreanDMScreen
            open={true}
            onClose={(reason) => {
              setShowEmpyreanDMContainer(false);
              if (reason === 'newCampaign') {
                setShowEmpyreanScreen(true);
              } else if (reason === 'reconfigure') {
                setEmpyreanScreenAutoOpen('manual');
                setShowEmpyreanScreen(true);
              }
            }}
            characterContext={drawerContext?.characterContext ?? { name: character.name, level: character.level, currentHP: 10, maxHP: 10, abilities: [], equippedAbilities: [], equipment: [], activeSetBonuses: [], consumables: [], cooldowns: { active: [], ready: [] }, prestigeLevel: 0, prestigeAbilities: [] } as any}
            characterName={character.name}
            autoSyncCallbacks={autoSyncCallbacks}
            embedded={true}
            swipeHandlers={swipeHandlers}
            onNavigateToTab={onNavigateToTab}
          />
        )}
        renderParty={(swipeHandlers) => (
          <StandalonePartyDMScreen
            onBack={() => setShowEmpyreanDMContainer(false)}
            characterContext={drawerContext?.characterContext ?? { name: character.name, level: character.level, currentHP: 10, maxHP: 10, abilities: [], equippedAbilities: [], equipment: [], activeSetBonuses: [], consumables: [], cooldowns: { active: [], ready: [] }, prestigeLevel: 0, prestigeAbilities: [] } as any}
            partyId={partySync?.party?.partyId ?? null}
            isPartyCreator={partySync?.party?.isCreator ?? false}
            partyMembers={partySync?.party?.members ?? []}
            userId={userId ?? ''}
            characterName={character.name}
            autoSyncCallbacks={autoSyncCallbacks}
            embedded={true}
            isSoloEmpyrean={true}
            swipeHandlers={swipeHandlers}
          />
        )}
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
