import { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Dices, Gem, ListChecks, Bird, Ghost, Settings, Eye, X, PawPrint, ScrollText } from 'lucide-react';

export type DMNavTab = 'dice' | 'prompts' | 'actions' | 'geralt' | 'afk' | 'oracle' | 'settings' | 'wildshape' | 'character';

interface DMBottomNavProps {
  activeTab: DMNavTab | null;
  onTabChange: (tab: DMNavTab) => void;
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  disabled?: boolean;
  /** Rendered below tabs when dice tab is active */
  diceContent?: React.ReactNode;
  /** Rendered below tabs when settings tab is active */
  settingsContent?: React.ReactNode;
  /** Rendered below tabs when oracle tab is active */
  oracleContent?: React.ReactNode;
  /** Rendered below tabs when wildshape tab is active */
  wildshapeContent?: React.ReactNode;
  /** Show the Geralt tab (momo easter egg) */
  showGeralt?: boolean;
  /** Replace AFK tab with Wild Shape tab (momo moon druid) */
  showWildShape?: boolean;
  /** Badge count for oracle whispers */
  oracleCount?: number;
  /** Whether the character is currently in wild shape form */
  isWildShapeActive?: boolean;
  /** Override the Oracle tab label (e.g. dragon name) */
  oracleLabel?: string;
  /** Override the Oracle tab color class */
  oracleColor?: string;
  /** Override the Oracle tab active bg class */
  oracleActiveBg?: string;
  /** Override the AFK tab label (e.g. dragon name in party mode) */
  afkLabel?: string;
  /** Override the AFK tab color class */
  afkColor?: string;
  /** Override the AFK tab active bg class */
  afkActiveBg?: string;
  /** Override the AFK tab icon (e.g. BookOpen for the solo Guides tab). Ignored if showWildShape is true. */
  afkIcon?: React.ComponentType<{ className?: string }>;
  /** Hide the DICE tab entirely from the nav (Empyrean solo mode — dice is surfaced via whisper tray instead). */
  hideDice?: boolean;
  /** Hide the AFK tab entirely from the nav (Empyrean solo mode). Ignored if showWildShape is true. */
  hideAfk?: boolean;
  /** Hide the RP PROMPTS tab entirely from the nav (Empyrean solo mode). */
  hidePrompts?: boolean;
  /** Hide the ACTIONS tab entirely from the nav (Empyrean solo mode — actions surface as pill columns above chat instead). */
  hideActions?: boolean;
  /** Hide the SETTINGS tab entirely from the nav (Empyrean solo mode — settings now live inside the Character Sheet). */
  hideSettings?: boolean;
  /** Show the SHEET tab (Character Sheet) in the nav. */
  showCharacterSheet?: boolean;
  /** Callback fired when the SHEET tab is tapped. Required when showCharacterSheet is true. */
  onCharacterSheet?: () => void;
  /** Override the notch handle label (default: 'TOOLS'). */
  notchLabelOverride?: string;
  /** Override the notch handle icon emoji (default: '⚔'). */
  notchIconOverride?: string;
}

const BASE_TABS = [
  { id: 'dice' as DMNavTab, label: 'DICE', icon: Dices, color: 'text-amber-400', activeBg: 'bg-amber-500/10' },
  { id: 'prompts' as DMNavTab, label: 'RP PROMPTS', icon: Gem, color: 'text-yellow-400', activeBg: 'bg-yellow-500/10' },
  { id: 'actions' as DMNavTab, label: 'ACTIONS', icon: ListChecks, color: 'text-emerald-400', activeBg: 'bg-emerald-500/10' },
];

const GERALT_TAB = { id: 'geralt' as DMNavTab, label: 'GERALT', icon: Bird, color: 'text-pink-400', activeBg: 'bg-pink-500/10' };
const AFK_TAB = { id: 'afk' as DMNavTab, label: 'AFK', icon: Ghost, color: 'text-purple-400', activeBg: 'bg-purple-500/10' };
const WILDSHAPE_TAB = { id: 'wildshape' as DMNavTab, label: 'SHAPES', icon: PawPrint, color: 'text-green-400', activeBg: 'bg-green-500/10' };
const ORACLE_TAB = { id: 'oracle' as DMNavTab, label: 'ORACLE', icon: Eye, color: 'text-cyan-400', activeBg: 'bg-cyan-500/10' };
const SETTINGS_TAB = { id: 'settings' as DMNavTab, label: 'SETTINGS', icon: Settings, color: 'text-white/70', activeBg: 'bg-white/5' };
const CHARACTER_SHEET_TAB = { id: 'character' as DMNavTab, label: 'SHEET', icon: ScrollText, color: 'text-sky-400', activeBg: 'bg-sky-500/10' };

const activeIndicatorColors: Record<DMNavTab, string> = {
  dice: 'bg-amber-500',
  prompts: 'bg-yellow-500',
  actions: 'bg-emerald-500',
  geralt: 'bg-pink-500',
  afk: 'bg-purple-500',
  wildshape: 'bg-green-500',
  oracle: 'bg-cyan-500',
  settings: 'bg-white/50',
  character: 'bg-sky-500',
};

export function DMBottomNav({ activeTab, onTabChange, isExpanded, onExpandedChange, disabled, diceContent, settingsContent, oracleContent, wildshapeContent, showGeralt, showWildShape, oracleCount, isWildShapeActive, oracleLabel, oracleColor, oracleActiveBg, afkLabel, afkColor, afkActiveBg, afkIcon, hideDice, hideAfk, hidePrompts, hideActions, hideSettings, showCharacterSheet, onCharacterSheet, notchLabelOverride, notchIconOverride }: DMBottomNavProps) {
  const afkOrWildShape = showWildShape ? WILDSHAPE_TAB : AFK_TAB;
  const afkTab = {
    ...afkOrWildShape,
    label: (!showWildShape && afkLabel) ? afkLabel : afkOrWildShape.label,
    color: (!showWildShape && afkColor) ? afkColor : afkOrWildShape.color,
    activeBg: (!showWildShape && afkActiveBg) ? afkActiveBg : afkOrWildShape.activeBg,
    icon: (!showWildShape && afkIcon) ? afkIcon : afkOrWildShape.icon,
  };
  const oracleTab = {
    ...ORACLE_TAB,
    label: oracleLabel || ORACLE_TAB.label,
    color: oracleColor || ORACLE_TAB.color,
    activeBg: oracleActiveBg || ORACLE_TAB.activeBg,
  };
  let baseTabs = BASE_TABS;
  if (hideDice) baseTabs = baseTabs.filter(t => t.id !== 'dice');
  if (hidePrompts) baseTabs = baseTabs.filter(t => t.id !== 'prompts');
  if (hideActions) baseTabs = baseTabs.filter(t => t.id !== 'actions');
  const tabs = [
    ...(showCharacterSheet ? [CHARACTER_SHEET_TAB] : []),
    ...baseTabs,
    ...((hideAfk && !showWildShape) ? [] : [afkTab]),
    oracleTab,
    ...(showGeralt ? [GERALT_TAB] : []),
    ...(hideSettings ? [] : [SETTINGS_TAB]),
  ];
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    const dt = Date.now() - touchStartTime.current;
    // Swipe up: expand, swipe down: collapse
    // Require longer swipe down (150px) to prevent accidental closure while scrolling
    const velocity = Math.abs(dy) / Math.max(dt, 1);
    if (dy > 30 || (dy > 10 && velocity > 0.3)) {
      onExpandedChange(true);
    } else if (dy < -150 || (dy < -100 && velocity > 0.5)) {
      onExpandedChange(false);
    }
  }, [onExpandedChange]);

  const handleToggle = useCallback(() => {
    onExpandedChange(!isExpanded);
  }, [isExpanded, onExpandedChange]);

  const showDiceContent = isExpanded && activeTab === 'dice' && diceContent;
  const showSettingsContent = isExpanded && activeTab === 'settings' && settingsContent;
  const showOracleContent = isExpanded && activeTab === 'oracle' && oracleContent;
  const showWildShapeContent = isExpanded && activeTab === 'wildshape' && wildshapeContent;
  const hasActiveContent = showDiceContent || showSettingsContent || showOracleContent || showWildShapeContent;

  const activeContent = showDiceContent ? diceContent : showSettingsContent ? settingsContent : showOracleContent ? oracleContent : showWildShapeContent ? wildshapeContent : null;
  const activeContentTab = showDiceContent ? tabs.find(t => t.id === 'dice') : showSettingsContent ? tabs.find(t => t.id === 'settings') : showOracleContent ? tabs.find(t => t.id === 'oracle') : showWildShapeContent ? tabs.find(t => t.id === 'wildshape') : null;

  return (
    <>
      {/* Full-screen content overlay */}
      <AnimatePresence>
        {hasActiveContent && activeContentTab && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-0 z-[55] flex flex-col bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]"
          >
            {/* Full-screen header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-amber-900/30 bg-black/40 backdrop-blur-sm">
              <div className="flex items-center gap-2.5">
                <activeContentTab.icon className={cn("w-5 h-5", activeContentTab.color)} />
                <span className="text-sm font-cinzel text-white/90 tracking-wide">
                  {activeContentTab.label}
                </span>
              </div>
              <button
                onClick={() => onTabChange(activeTab!)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors active:scale-95"
                style={{ touchAction: 'manipulation' }}
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>
            {/* Full-screen scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]">
              {activeContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
        <div className="bg-background/95 backdrop-blur-sm border-t border-amber-900/30">
          {/* Notch handle + label — always visible */}
          <div
            className="flex flex-col items-center py-2.5 cursor-grab active:cursor-grabbing touch-none"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={handleToggle}
            role="button"
            aria-label={isExpanded ? 'Collapse toolbar' : 'Expand toolbar'}
          >
            <div className={cn(
              "w-14 h-1.5 rounded-full transition-all",
              isExpanded
                ? "bg-amber-500/50"
                : "bg-amber-500/30 shadow-[0_0_10px_3px_rgba(245,158,11,0.3)] animate-pulse"
            )} />
            {!isExpanded && (
              <span className="text-[11px] font-mono text-amber-400/60 mt-1 tracking-widest select-none font-semibold">
                {notchIconOverride ?? '⚔'} {notchLabelOverride ?? 'TOOLS'}
              </span>
            )}
          </div>

          {/* Expanded content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="overflow-hidden"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {/* Tab bar */}
                <div className="flex h-14 border-t border-amber-900/20">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          if (tab.id === 'character') {
                            onCharacterSheet?.();
                            return;
                          }
                          onTabChange(tab.id);
                        }}
                        disabled={disabled}
                        className={cn(
                          "flex-1 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 relative",
                          "disabled:opacity-40 disabled:cursor-not-allowed",
                          isActive ? tab.activeBg : "hover:bg-muted/10"
                        )}
                        style={{ touchAction: 'manipulation' }}
                      >
                        <div className="relative">
                          <Icon className={cn(
                            "w-5 h-5 transition-colors",
                            isActive ? tab.color : "text-muted-foreground",
                            tab.id === 'wildshape' && isWildShapeActive && !isActive && "text-green-400"
                          )} />
                          {/* Wild shape active glow */}
                          {tab.id === 'wildshape' && isWildShapeActive && (
                            <span className="absolute inset-0 -m-1 rounded-full bg-green-500/20 animate-pulse" />
                          )}
                          {tab.id === 'oracle' && oracleCount && oracleCount > 0 && !isActive && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-cyan-500 text-[9px] font-bold text-black flex items-center justify-center px-0.5">
                              {oracleCount > 9 ? '9+' : oracleCount}
                            </span>
                          )}
                        </div>
                        <span className={cn(
                          "text-[10px] font-mono tracking-tight transition-colors",
                          isActive ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {tab.id === 'oracle' && tab.label.length > 7 ? tab.label.slice(0, 6) + '…' : tab.label}
                        </span>
                        {isActive && (
                          <div className={cn(
                            "absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full",
                            activeIndicatorColors[tab.id]
                          )} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
