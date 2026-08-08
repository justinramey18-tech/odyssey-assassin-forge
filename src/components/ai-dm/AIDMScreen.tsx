import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { firePendingNat20Fanfare } from '@/lib/critSound';
import { useWeather } from '@/hooks/use-weather';
import { getCachedWeather, buildWeatherPrompt, loadWeatherEnabled } from '@/lib/weather';
import { resolveResponseModePrompt } from '@/lib/dm-response-modes';
import { useResponseMode } from '@/hooks/use-response-mode';
import { useNPCAutocomplete } from '@/hooks/use-npc-autocomplete';
import { SoloDMInput, type SoloDMInputHandle } from './SoloDMInput';
import { NpcSocialCheckToolbar } from './NpcSocialCheckToolbar';
import type { SocialCheckResult } from '@/lib/npcSocialChecks';
import { isMomoEasterEgg } from '@/lib/easter-eggs';
import { GeraltGameplayWidget } from './GeraltGameplayWidget';
import { loadSelectedModel, saveSelectedModel, getModelLabel } from '@/lib/dm-models';
import { formatUsage, formatCostShort } from '@/lib/token-usage';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Square, Trash2, RotateCcw, Crown, Heart, Shield, ChevronDown, ChevronUp, BookOpen, ScrollText, FolderOpen, Loader2, Zap, Map, Film, Image as ImageIcon, Copy, Check, Pencil, RefreshCw, X, MoreVertical, Globe, Settings, Volume2, VolumeX, Bird, Maximize2, Minimize2, PawPrint, MessageCircle, UserCog } from 'lucide-react';
import { loadState as loadGeraltState, saveState as saveGeraltState } from '@/components/companion/geralt-data';
import { NarrationSpeedPopover } from './NarrationSpeedPopover';
import { DMToolsDrawer } from './DMToolsDrawer';
import { DMSpotifyControls } from '@/components/spotify/DMSpotifyControls';
import { useSpotify } from '@/hooks/use-spotify';
import { InfinityStoneDMDrawer } from './InfinityStoneDMDrawer';
import { DiceRollOverlay } from '@/components/ai-dm/DiceRollOverlay';
import { DMBottomNav, DMNavTab } from './DMBottomNav';
import { PartyDMQuickActions } from './PartyDMQuickActions';
import { useHealingItemAction } from '@/hooks/use-healing-item';
import { ResponseModeSelector } from './ResponseModeSelector';
import { CampaignDropdown } from './CampaignDropdown';
import { cn } from '@/lib/utils';
import { useAIDM } from '@/hooks/use-ai-dm';
import { useGMGuides } from '@/hooks/use-gm-guides';
import { DEFAULT_SOLO_GUIDE_ID, DEFAULT_SOLO_GUIDE_NAME, DEFAULT_SOLO_GUIDE_CONTENT, isDefaultSoloGuideDeleted, markDefaultSoloGuideDeleted, clearDefaultSoloGuideDeleted } from '@/lib/defaultSoloGuide';
import { useCampaignSessions, CampaignSession } from '@/hooks/use-campaign-sessions';
import { useAutoCampaign } from '@/hooks/use-auto-campaign';
import { CharacterContext, Message } from '@/components/oracle/types';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { DMQuickActions } from './DMQuickActions';
import { DMDiceRoller } from './DMDiceRoller';
import { GMGuidesManager } from './GMGuidesManager';
import { CampaignSessionsManager } from './CampaignSessionsManager';
import { WorldStatePanel } from './WorldStatePanel';
import { useDMGameState, buildMemoryAnchorsPrompt } from '@/hooks/use-dm-game-state';
import { usePromptDrawers } from '@/components/drawers/PromptDrawerProvider';
import { useDmMemoryExtraction } from '@/hooks/use-dm-memory-extraction';
import CampaignBuilderChat from './CampaignBuilderChat';
import type { CampaignBuildData } from '@/hooks/use-ai-campaign-chat';
import { WhisperTray } from './WhisperTray';
import { OracleWhisperFeed } from './OracleWhisperFeed';
import { AutoSyncBanner } from './AutoSyncBanner';
import { useLinkedUniverse } from '@/hooks/use-linked-universe';
import { LinkedUniverseSection } from '@/components/empyrean/LinkedUniverseSection';

import { useDmAutoSync } from '@/hooks/use-dm-auto-sync';
import { Quest, RawQuestOffer, normalizeQuestMap, questFromOffer, questTitle, applyQuestProgress, toStored, withQuestEvent, rewardSummary, WORLD_STATE_KEY, WorldStateEntry, normalizeWorldState, mergeWorldState, toStoredWorldState, worldEntryFromQuest, worldStateContextLines } from '@/lib/quests';
import { SoloCharacterSheet, type SheetTab } from '@/components/ai-dm/SoloCharacterSheet';
import { getSheetReturn, clearSheetReturn } from '@/lib/sheetReturn';
import { CharacterSheetStrip } from '@/components/ai-dm/CharacterSheetStrip';
import { addPendingDmItems, loadPendingDmItems, PENDING_DM_ITEMS_EVENT } from '@/lib/pendingDmItems';
import { useXPProgression } from '@/hooks/use-xp-progression';
import { getXPForLevel } from '@/lib/xpSystem';
import { useXPSnapshot } from '@/hooks/use-xp-snapshot';

import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { useNarrator } from '@/hooks/use-narrator';
import { useDMChatTheme } from '@/hooks/use-dm-chat-theme';
import { useWhisperTrayEnabled } from '@/hooks/use-whisper-tray-enabled';
import type { DMChatTheme } from '@/lib/dm-chat-themes';


import type { UseWildShapeReturn } from '@/hooks/use-wild-shape';
import { WildShapeSection } from '@/components/drawers/QuickActionsDrawer';

interface AIDMScreenProps {
  onBack: () => void;
  characterContext: CharacterContext;
  userId?: string;
  characterName?: string;
  dmPersonaPrompt?: string;
  dmPersonaName?: string;
  onRetakePersonalityTest?: () => Promise<void>;
  autoSyncCallbacks?: {
    onHPChange: (change: number, type: 'damage' | 'healing') => void;
    onHPSet?: (hp: number) => void;
    onUseConsumableByName?: (name: string, quantity?: number) => boolean;
    onAddXP: (amount: number, source: string) => void;
    onGoldChange: (netChange: number) => void;
    onConditionChange: (toAdd: string[], toRemove: string[]) => void;
    onRestOccurred: (type: 'short' | 'long') => void;
    getCurrentHP: () => number;
    getCurrentGold: () => number;
  };

  /** Total accumulated XP (for the character sheet XP bar) */
  currentXP?: number;
  /** Manual level advance (milestone play / catch-up) */
  onManualLevelUp?: () => void;
  /** Accept an item the DM awarded into the loot inventory */
  onAcceptItem?: (name: string, quantity: number, details?: { goldValue?: number; description?: string; rarity?: string; category?: string; effect?: string; dice?: string }) => void;
  /** Open the per-campaign character picker for solo mode */
  onOpenCharacterPicker?: () => void;
  /** Wild Shape hook instance (for Momo Moon Druid) */
  wildShape?: UseWildShapeReturn;
  /** Whether this character is a Momo Moon Druid (shows wild shape tab) */
  isMomoMoonDruid?: boolean;
}

const VIDEO_REGEX = /^\s*\[video:(https?:\/\/.+)\]\s*$/;
const IMAGE_REGEX = /^\s*\[image:(https?:\/\/.+)\]\s*$/;

interface DMMessageBubbleProps {
  message: Message;
  onEdit?: (id: string, content: string) => void;
  onDelete?: (id: string) => void;
  onRegenerate?: (id: string) => void;
  isLoading?: boolean;
  ttsSelectMode?: boolean;
  ttsSelected?: boolean;
  onTtsToggle?: (id: string) => void;
  theme?: DMChatTheme;
  whisperTrayEnabled?: boolean;
}

const DMMessageBubble = memo(function DMMessageBubble({ message, onEdit, onDelete, onRegenerate, isLoading, ttsSelectMode, ttsSelected, onTtsToggle, theme, whisperTrayEnabled = true }: DMMessageBubbleProps) {
  const isUser = message.role === 'user';
  const videoMatch = message.content.match(VIDEO_REGEX);
  const imageMatch = !videoMatch ? message.content.match(IMAGE_REGEX) : null;
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [message.content]);

  const handleEdit = useCallback(() => {
    setEditContent(message.content);
    setIsEditing(true);
    setShowActions(false);
  }, [message.content]);

  const handleSaveEdit = useCallback(() => {
    if (editContent.trim() && onEdit) {
      onEdit(message.id, editContent.trim());
    }
    setIsEditing(false);
  }, [editContent, message.id, onEdit]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditContent(message.content);
  }, [message.content]);

  const handleDelete = useCallback(() => {
    onDelete?.(message.id);
    setShowActions(false);
  }, [message.id, onDelete]);

  const handleRegenerate = useCallback(() => {
    onRegenerate?.(message.id);
    setShowActions(false);
  }, [message.id, onRegenerate]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-1.5 min-w-0', isUser ? 'justify-end' : 'justify-start')}
    >
      {/* TTS Select Checkbox */}
      {ttsSelectMode && !isUser && (
        <button
          onClick={() => onTtsToggle?.(message.id)}
          className="flex items-center justify-center w-6 h-6 shrink-0 self-center"
          style={{ touchAction: 'manipulation' }}
        >
          <div className={cn(
            "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
            ttsSelected
              ? "bg-amber-500 border-amber-400"
              : "border-white/30 hover:border-amber-400/60"
          )}>
            {ttsSelected && <Check className="w-3.5 h-3.5 text-black" />}
          </div>
        </button>
      )}
      {/* DM Avatar */}
      {!isUser && (
        <div className={cn("w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0", theme?.dmAvatar || "bg-amber-900/60 border border-amber-500/40")}>
          {message.senderName && message.senderName !== 'DM' ? (
            <MessageCircle className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", "text-amber-500")} />
          ) : (
            <Crown className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", theme?.dmAvatarIconColor || "text-amber-400")} />
          )}
        </div>
      )}

      {/* Message bubble */}
      <div className="relative group flex-1 min-w-0 max-w-[85%]">
        <div
          className={cn(
            'rounded-2xl px-2.5 py-1.5 sm:px-4 sm:py-2.5 overflow-hidden',
            isUser
              ? (theme?.userBubble || 'bg-white/10 text-white rounded-br-sm border border-white/10')
              : (theme?.dmBubble || 'bg-amber-950/50 border border-amber-500/20 rounded-bl-sm')
          )}
        >
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-black/30 border border-amber-500/30 rounded-lg px-3 py-2 text-sm text-white resize-none min-h-[60px] focus:outline-none focus:border-amber-400/50"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleCancelEdit}
                  className="px-2.5 py-1 rounded-lg text-xs text-white/60 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-2.5 py-1 rounded-lg text-xs bg-amber-600/60 text-amber-100 hover:bg-amber-600/80 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          ) : videoMatch ? (
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <Film className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] text-amber-300/70 font-cinzel">Video</span>
              </div>
              <div className="rounded-xl overflow-hidden border border-amber-500/20 bg-black/40 max-w-[300px]">
                <video
                  src={videoMatch[1]}
                  controls
                  playsInline
                  className="w-full rounded-xl"
                />
              </div>
            </div>
          ) : imageMatch ? (
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <ImageIcon className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] text-amber-300/70 font-cinzel">Photo</span>
              </div>
              <div className="rounded-xl overflow-hidden border border-amber-500/20 bg-black/40 max-w-[300px]">
                <img
                  src={imageMatch[1]}
                  alt="Chat photo"
                  className="w-full rounded-xl"
                  loading="lazy"
                />
              </div>
            </div>
          ) : isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <>
              {message.senderName && message.senderName !== 'DM' && (
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-[11px] font-semibold text-amber-300">{message.senderName}</p>
                  <span className="text-[9px] italic text-amber-400/50">NPC</span>
                </div>
              )}
              <div className="text-sm prose prose-invert prose-sm max-w-none break-words overflow-wrap-anywhere">
                <ReactMarkdown
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className={theme?.accentColor || 'text-amber-300'}>{children}</strong>,
                    em: ({ children }) => <em className={theme?.emColor || 'text-white/70'}>{children}</em>,
                    ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    code: ({ children }) => <code className={cn("px-1 rounded text-xs", theme?.codeBg || "bg-black/30")}>{children}</code>,
                    h1: ({ children }) => <h1 className={cn("text-lg font-cinzel mb-2", theme?.headingColor || "text-amber-300")}>{children}</h1>,
                    h2: ({ children }) => <h2 className={cn("text-base font-cinzel mb-2", theme?.headingColor || "text-amber-300")}>{children}</h2>,
                    h3: ({ children }) => <h3 className={cn("text-sm font-cinzel mb-1", theme?.headingColor || "text-amber-300")}>{children}</h3>,
                    blockquote: ({ children }) => (
                      <blockquote className={cn("border-l-2 pl-3 italic text-white/60 my-2", theme?.blockquoteBorder || "border-amber-500/40")}>{children}</blockquote>
                    ),
                    hr: () => <hr className={cn("my-3", theme?.hrColor || "border-amber-500/20")} />,
                  }}
                >
                  {message.content || '...'}
                </ReactMarkdown>
              </div>
            </>
          )}
        </div>

        {/* Whisper tray for AI messages with whispers */}
        {whisperTrayEnabled && !isUser && message.whispers && message.whispers.length > 0 && (
          <WhisperTray whispers={message.whispers} />
        )}
        {/* Action buttons for assistant messages (desktop) */}
        {!isUser && message.content && !isEditing && (
          <div className="flex items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={handleCopy} className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors" title="Copy">
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button onClick={handleEdit} className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors" title="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleRegenerate} disabled={isLoading} className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors disabled:opacity-30" title="Regenerate">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleDelete} className="p-1.5 rounded-md hover:bg-red-900/30 text-white/40 hover:text-red-400 transition-colors" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Action buttons for user messages (desktop) */}
        {isUser && message.content && !isEditing && (
          <div className="flex items-center gap-0.5 mt-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={handleEdit} className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors" title="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleDelete} className="p-1.5 rounded-md hover:bg-red-900/30 text-white/40 hover:text-red-400 transition-colors" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Mobile: tap to show actions */}
        {message.content && !isEditing && (
          <button
            onClick={() => setShowActions(prev => !prev)}
            className={cn(
              "absolute top-1 p-1 rounded-md sm:hidden text-white/30 hover:text-white/60",
              isUser ? "left-1" : "right-1"
            )}
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Mobile action menu */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "absolute top-0 z-20 border rounded-xl shadow-xl p-1 flex flex-col gap-0.5 sm:hidden",
                theme?.actionMenuBg || "bg-[#1a1520]",
                theme?.actionMenuBorder || "border-amber-500/30",
                isUser ? "left-0" : "right-0"
              )}
            >
              {!isUser && (
                <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/10 rounded-lg">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />} Copy
                </button>
              )}
              <button onClick={handleEdit} className="flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/10 rounded-lg">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              {!isUser && (
                <button onClick={handleRegenerate} disabled={isLoading} className="flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/10 rounded-lg disabled:opacity-30">
                  <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                </button>
              )}
              <button onClick={handleDelete} className="flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-900/20 rounded-lg">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className={cn("w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0", theme?.userAvatar || "bg-white/10")}>
          <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/70" />
        </div>
      )}
    </motion.div>
  );
});

// Stable no-op fallbacks (defined outside component to avoid re-creation)
const NOOP = () => {};
const NOOP_TWO_ARG = () => {};
const NOOP_RETURN_ZERO = () => 0;

function parseNpcTags(text: string, knownNames: string[]): { npcNames: string[]; message: string } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('@')) return null;

  const sortedNames = [...knownNames].sort((a, b) => b.length - a.length);
  let remaining = trimmed;
  const tagged: string[] = [];

  while (remaining.startsWith('@')) {
    const afterAt = remaining.slice(1);
    const found = sortedNames.find((name) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('^' + escaped + '(\\s|$)', 'i');
      return re.test(afterAt);
    });
    if (!found) break;
    tagged.push(found);
    remaining = afterAt.slice(found.length).trimStart();
  }

  if (tagged.length > 0) {
    const message = remaining.trim();
    if (!message) return null;
    return { npcNames: tagged, message };
  }

  const fallback = trimmed.match(/^@(\S+)\s+([\s\S]+)$/);
  if (fallback) {
    return { npcNames: [fallback[1]], message: fallback[2].trim() };
  }

  return null;
}


export function AIDMScreen({ onBack, characterContext, userId, characterName = 'Adventurer', autoSyncCallbacks, dmPersonaPrompt, dmPersonaName, onRetakePersonalityTest, wildShape, isMomoMoonDruid, currentXP = 0, onManualLevelUp, onAcceptItem, onOpenCharacterPicker }: AIDMScreenProps) {
  const [showCharacterSheet, setShowCharacterSheet] = useState(false);
  const [restoreSheetTab, setRestoreSheetTab] = useState<SheetTab | undefined>(undefined);

  // If the player left the sheet for an app tab and tapped "Back to character sheet",
  // this screen has just been remounted. Reopen the sheet on the tab they left.
  useEffect(() => {
    const pendingReturn = getSheetReturn();
    if (!pendingReturn) return;
    setRestoreSheetTab(pendingReturn.sheetTab as SheetTab);
    setShowCharacterSheet(true);
    clearSheetReturn();
  }, []);
  const [pendingItemCount, setPendingItemCount] = useState(() => loadPendingDmItems().length);
  const { multiplier: xpMultiplier } = useXPProgression();
  // Single source of truth for XP totals (shared with the AI DM briefing)
  const xpSnapshot = useXPSnapshot(characterContext.level, currentXP);
  useEffect(() => {
    const refresh = () => setPendingItemCount(loadPendingDmItems().length);
    window.addEventListener(PENDING_DM_ITEMS_EVENT, refresh);
    window.addEventListener('odyssey-character-loaded', refresh);
    return () => {
      window.removeEventListener(PENDING_DM_ITEMS_EVENT, refresh);
      window.removeEventListener('odyssey-character-loaded', refresh);
    };
  }, []);
  const isMomo = useMemo(() => isMomoEasterEgg(characterName), [characterName]);
  const geraltCharacterId = useMemo(() => characterName?.toLowerCase().trim() || 'unknown', [characterName]);
  const [showToolsDrawer, setShowToolsDrawer] = useState(false);
  const [showWorldBuilder, setShowWorldBuilder] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() => loadSelectedModel());
  const [showWorldState, setShowWorldState] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const gmGuides = useGMGuides(undefined, 'solo');
  const gmGuidesRef = useRef(gmGuides);
  gmGuidesRef.current = gmGuides;
  // Seed the Core Rulebook default guide once on mount
  useEffect(() => {
    const g = gmGuidesRef.current;
    const exists = g.guides.some((x) => x.id === DEFAULT_SOLO_GUIDE_ID);
    if (!exists && !isDefaultSoloGuideDeleted()) {
      g.addGuide(DEFAULT_SOLO_GUIDE_NAME, DEFAULT_SOLO_GUIDE_CONTENT, DEFAULT_SOLO_GUIDE_ID);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const defaultGuidePresent = gmGuides.guides.some((g) => g.id === DEFAULT_SOLO_GUIDE_ID);
  const { toast } = useToast();
  const narrator = useNarrator();
  const { themeId: chatThemeId, theme: chatTheme, setTheme: setChatTheme } = useDMChatTheme();
  const { whisperTrayEnabled, setWhisperTrayEnabled } = useWhisperTrayEnabled();
  const spotify = useSpotify();
  const { weather } = useWeather();
  const [ttsSelectMode, setTtsSelectMode] = useState(false);
  const [ttsSelectedIds, setTtsSelectedIds] = useState<Set<string>>(new Set());

  const handleTtsToggle = useCallback((id: string) => {
    setTtsSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Bottom nav state
  const [activeNavTab, setActiveNavTab] = useState<DMNavTab | null>(null);
  const [navExpanded, setNavExpanded] = useState(false);
  const { responseMode, setResponseMode } = useResponseMode();
  const [showStoneDrawer, setShowStoneDrawer] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Geralt companion auto-sync callbacks (momo only)
  const handleCompanionHPChange = useCallback((change: number, type: 'damage' | 'healing') => {
    if (!isMomo) return;
    const charId = geraltCharacterId;
    const gs = loadGeraltState(charId);
    const newHP = Math.max(0, Math.min(gs.maxHP, gs.currentHP + change));
    saveGeraltState(charId, { ...gs, currentHP: newHP });
    setGeraltHp({ current: newHP, max: gs.maxHP });
    window.dispatchEvent(new CustomEvent('geralt-hp-changed', { detail: { characterId: charId, currentHP: newHP, maxHP: gs.maxHP } }));
  }, [isMomo, geraltCharacterId]);

  const handleCompanionHPSet = useCallback((hp: number) => {
    if (!isMomo) return;
    const charId = geraltCharacterId;
    const gs = loadGeraltState(charId);
    const newHP = Math.max(0, Math.min(gs.maxHP, Math.round(hp)));
    saveGeraltState(charId, { ...gs, currentHP: newHP });
    setGeraltHp({ current: newHP, max: gs.maxHP });
    window.dispatchEvent(new CustomEvent('geralt-hp-changed', { detail: { characterId: charId, currentHP: newHP, maxHP: gs.maxHP } }));
  }, [isMomo, geraltCharacterId]);

  const handleCompanionConditionChange = useCallback((toAdd: string[], toRemove: string[]) => {
    if (!isMomo) return;
    const charId = geraltCharacterId;
    const gs = loadGeraltState(charId);
    let conditions = gs.conditions.filter(c => !toRemove.map(r => r.toLowerCase()).includes(c.toLowerCase()));
    for (const c of toAdd) {
      if (!conditions.map(x => x.toLowerCase()).includes(c.toLowerCase())) conditions.push(c);
    }
    saveGeraltState(charId, { ...gs, conditions });
  }, [isMomo, geraltCharacterId]);

  // Quest board bridge. The auto-sync hook is created before the game state hook,
  // so both directions go through refs that are filled in further down.
  const questsRef = useRef<Quest[]>([]);
  const questUpdateRef = useRef<((offers: RawQuestOffer[], progress: any[]) => void) | null>(null);
  const worldStateUpdateRef = useRef<((changes: any[]) => void) | null>(null);

  // Auto-sync hook
  const autoSync = useDmAutoSync({
    onHPChange: autoSyncCallbacks?.onHPChange ?? NOOP_TWO_ARG,
    onHPSet: autoSyncCallbacks?.onHPSet,
    onUseConsumableByName: autoSyncCallbacks?.onUseConsumableByName,
    onAddXP: autoSyncCallbacks?.onAddXP ?? NOOP_TWO_ARG,
    onGoldChange: autoSyncCallbacks?.onGoldChange ?? NOOP,
    onConditionChange: autoSyncCallbacks?.onConditionChange ?? NOOP_TWO_ARG,
    onRestOccurred: autoSyncCallbacks?.onRestOccurred ?? NOOP,
    onMapUpdate: useCallback(() => {}, []),
    onCompanionHPChange: isMomo ? handleCompanionHPChange : undefined,
    onCompanionHPSet: isMomo ? handleCompanionHPSet : undefined,
    onCompanionConditionChange: isMomo ? handleCompanionConditionChange : undefined,
    getCurrentHP: autoSyncCallbacks?.getCurrentHP ?? NOOP_RETURN_ZERO,
    getCurrentGold: autoSyncCallbacks?.getCurrentGold ?? NOOP_RETURN_ZERO,
    getCurrentMarkers: useCallback(() => [], []),

    getGridSize: useCallback(() => 25 as any, []),
    getActiveQuests: useCallback(() => questsRef.current, []),
    onQuestUpdate: useCallback((offers: RawQuestOffer[], progress: any[]) => {
      questUpdateRef.current?.(offers, progress);
    }, []),
    onWorldStateUpdate: useCallback((changes: any[]) => {
      worldStateUpdateRef.current?.(changes);
    }, []),
  } as Parameters<typeof useDmAutoSync>[0]);


  // Refs for memory extraction — lets handleMessageComplete (defined before hooks) access late-initialized values
  const extractMemoryRef = useRef<((msg: string, anchors: any[], ctx: any) => void) | null>(null);
  const memoryAnchorsRef = useRef<any[]>([]);

  const handleMessageComplete = useCallback((content: string) => {
    if (autoSync.autoSyncEnabled) {
      autoSync.extractAndApply(content, characterContext).then(result => {
        if (result?.items_acquired?.length) {
          addPendingDmItems(result.items_acquired);
        }
      }).catch(() => {});
    }
    // Always run memory extraction in the background via ref — avoids hook ordering issues
    extractMemoryRef.current?.(content, memoryAnchorsRef.current, characterContext);
    // Auto-mood: detect narrative mood and switch Spotify preset
    spotify.playMoodForText(content);
  }, [autoSync.autoSyncEnabled, autoSync.extractAndApply, characterContext, spotify.playMoodForText]);

  const handleCampaignSwitch = useCallback((guideIds: string[] | null) => {
    gmGuides.setActiveGuideIds(guideIds);
  }, [gmGuides.setActiveGuideIds]);

  // Campaign sessions (needed before useAIDM to get activeCampaignId dependency)
  const campaignSessions = useCampaignSessions('solo');

  // Temporary activeCampaignId state placeholder — will be replaced below after useAIDM
  // We need activeCampaignId before the hook to initialize game state.
  // Solution: track it in a ref that game state can read once AIDM sets it.
  const activeCampaignIdForGameState = useRef<string | null>(null);
  const [gameStateCampaignId, setGameStateCampaignId] = useState<string | null>(null);

  // Game state hook — persists HP, gold, quests, memory anchors per campaign
  const {
    gameState,
    addMemoryAnchor,
    removeMemoryAnchor,
    setQuestFlag,
    upsertQuest,
    removeQuest,
    updateVitals,
    updateGold,
    resetForNewCampaign,
  } = useDMGameState(gameStateCampaignId, 'solo');

  // Memory extraction hook — silently extracts NPCs, locations, consequences from DM responses
  const { extractMemory } = useDmMemoryExtraction({ addMemoryAnchor });

  // Keep refs in sync so handleMessageComplete always has fresh values
  useEffect(() => { extractMemoryRef.current = extractMemory; }, [extractMemory]);
  useEffect(() => { memoryAnchorsRef.current = gameState.memory_anchors; }, [gameState.memory_anchors]);

  // Register Oracle quest callback so OracleDrawer can save quests to game state
  const drawerContext = usePromptDrawers();
  useEffect(() => {
    drawerContext?.registerOracleQuestCallback?.((quests) => {
      for (const q of quests) {
        setQuestFlag(q.key, q.status, q.notes);
      }
    });
    return () => { drawerContext?.registerOracleQuestCallback?.(null); };
  }, [setQuestFlag]);

  // ─── Quest board ────────────────────────────────────────────────────────────
  const quests = useMemo(() => normalizeQuestMap(gameState.quest_flags), [gameState.quest_flags]);
  const worldState = useMemo(() => normalizeWorldState(gameState.quest_flags), [gameState.quest_flags]);
  const worldStateRef = useRef<WorldStateEntry[]>([]);
  useEffect(() => { worldStateRef.current = worldState; }, [worldState]);

  /** Record permanent outcomes on the board's world-state tracker, skipping repeats. */
  const recordWorldState = useCallback((raw: any[]) => {
    const incoming = (raw ?? []).map((c: any) => ({
      title: c?.title,
      consequence: c?.consequence,
      scope: c?.scope,
      impact: c?.impact,
      questKey: c?.quest_key ?? c?.questKey ?? undefined,
    }));
    const { entries, added } = mergeWorldState(worldStateRef.current, incoming);
    if (added.length === 0) return;
    worldStateRef.current = entries;
    upsertQuest(WORLD_STATE_KEY, toStoredWorldState(entries) as any);
    sonnerToast.info(added.length === 1 ? 'The world has changed' : `${added.length} things changed the world`, {
      description: added.map(e => e.title).join(' · '),
    });
  }, [upsertQuest]);

  useEffect(() => {
    worldStateUpdateRef.current = recordWorldState;
    return () => { worldStateUpdateRef.current = null; };
  }, [recordWorldState]);
  useEffect(() => { questsRef.current = quests; }, [quests]);

  /** Pay out XP, gold and promised items once, the moment a quest is finished. */
  const payQuestRewards = useCallback((quest: Quest) => {
    if (quest.rewardsPaid) return;
    const xp = Number(quest.xpReward);
    if (Number.isFinite(xp) && xp > 0) {
      autoSyncCallbacks?.onAddXP?.(Math.floor(xp), `Quest: ${questTitle(quest)}`);
    }
    const gp = Number(quest.goldReward);
    if (Number.isFinite(gp) && gp > 0) {
      autoSyncCallbacks?.onGoldChange?.(Math.floor(gp));
    }
    for (const item of quest.itemRewards ?? []) {
      const name = String(item?.name ?? '').trim();
      if (!name) continue;
      const rawQty = Number(item?.quantity);
      const qty = Number.isFinite(rawQty) && rawQty > 0 ? Math.min(99, Math.floor(rawQty)) : 1;
      onAcceptItem?.(name, qty, {
        goldValue: Number.isFinite(Number(item?.gold_value)) ? Number(item.gold_value) : undefined,
        description: item?.description,
        rarity: item?.rarity,
        category: item?.category,
      });
    }
    const parts = [
      Number.isFinite(xp) && xp > 0 ? `${Math.floor(xp)} XP` : '',
      Number.isFinite(gp) && gp > 0 ? `${Math.floor(gp)} gold` : '',
      (quest.itemRewards ?? []).length ? `${quest.itemRewards!.length} item${quest.itemRewards!.length === 1 ? '' : 's'}` : '',
    ].filter(Boolean);
    sonnerToast.success(`Quest complete: ${questTitle(quest)}`, {
      description: parts.length ? `Rewards: ${parts.join(', ')}` : undefined,
    });
  }, [autoSyncCallbacks, onAcceptItem]);

  // Apply what the extractor found: new offers land on the board, progress ticks stages.
  useEffect(() => {
    questUpdateRef.current = (offers, progress) => {
      const current = questsRef.current;
      for (const offer of offers ?? []) {
        const quest = questFromOffer(offer);
        if (!quest) continue;
        if (current.some(q => q.key === quest.key)) continue; // never re-offer
        upsertQuest(quest.key, toStored(quest) as any);
        sonnerToast.info(`New quest offered: ${questTitle(quest)}`, { description: 'Open your character sheet to accept it.' });
      }
      for (const update of progress ?? []) {
        const key = String(update?.key ?? '');
        const existing = current.find(q => q.key === key);
        if (!existing || existing.status !== 'active') continue;
        let next = applyQuestProgress(existing, update);
        if (next.status === 'completed' && !existing.rewardsPaid) {
          payQuestRewards(next);
          next.rewardsPaid = true;
          next = withQuestEvent(next, 'rewards', `Rewards paid out: ${rewardSummary(next)}.`);
        }
        if (next.status !== existing.status && (next.status === 'completed' || next.status === 'failed')) {
          recordWorldStateRef.current?.([worldEntryFromQuest(next)]);
        }
        upsertQuest(key, toStored(next) as any);
      }
    };
    return () => { questUpdateRef.current = null; };
  }, [upsertQuest, payQuestRewards]);

  // recordWorldState is defined after this effect, so it is reached through a ref.
  const recordWorldStateRef = useRef<((changes: any[]) => void) | null>(null);
  useEffect(() => { recordWorldStateRef.current = recordWorldState; }, [recordWorldState]);

  const handleAcceptQuest = useCallback((key: string) => {
    const quest = questsRef.current.find(q => q.key === key);
    if (!quest) return;
    const accepted = withQuestEvent({ ...quest, status: 'active' }, 'accepted', 'Quest accepted — the DM is now tracking it.');
    upsertQuest(key, { status: 'active', events: accepted.events } as any);
    sonnerToast.success(`Accepted: ${questTitle(quest)}`);
    // Kick the quest off immediately: the DM narrates the opening beat toward the next objective.
    sendMessage(buildQuestKickoffPrompt(accepted));
  }, [upsertQuest]);


  const handleDeclineQuest = useCallback((key: string) => {
    removeQuest(key);
  }, [removeQuest]);



  // Build world state prompt to inject into AI system prompt
  const worldStatePrompt = useMemo(() => {
    let prompt = buildMemoryAnchorsPrompt(gameState);
    if (loadWeatherEnabled()) {
      const block = buildWeatherPrompt(weather || getCachedWeather());
      if (block) prompt += '\n\n' + block;
    }
    // Established outcomes are facts. The DM must never contradict them.
    const wsLines = worldStateContextLines(normalizeWorldState(gameState.quest_flags));
    if (wsLines.length > 0) {
      prompt += '\n\nWORLD STATE (established, irreversible — never contradict):\n' + wsLines.map(l => `- ${l}`).join('\n');
    }

    return prompt;
  }, [gameState, weather]);

  // Linked Universe — uses gameStateCampaignId (synced from activeCampaignId) to avoid ordering cycle with useAIDM
  const linkedUniverse = useLinkedUniverse({ campaignId: gameStateCampaignId });
  const combinedGuidesContent = useMemo(
    () => [gmGuides.enabledContent, linkedUniverse.universeContext, linkedUniverse.pendingCrossoverPrompt, linkedUniverse.liveBeatContext].filter(Boolean).join('\n\n'),
    [gmGuides.enabledContent, linkedUniverse.universeContext, linkedUniverse.pendingCrossoverPrompt, linkedUniverse.liveBeatContext]
  );

  // Auto-update Linked Universe story digest whenever the campaign summary changes


  const { messages, isLoading, isSummarizing, campaignSummary, updateCampaignSummary, loadCampaign, sendMessage, voiceNPC, addMediaMessage, cancelRequest, clearMessages, newGame, activeCampaignId, setActiveCampaignId, editMessage, deleteMessage, regenerateMessage, lastUsage, sessionUsage } = useAIDM({
    characterContext,
    customGuidesContent: combinedGuidesContent,
    worldStatePrompt,
    dmPersonaPrompt,
    responseModePrompt: resolveResponseModePrompt(responseMode) || undefined,
    onMessageComplete: handleMessageComplete,
    onQuestExtracted: (quests) => {
      for (const q of quests) {
        setQuestFlag(q.key, q.status, q.notes);
      }
    },
    activeGuideIds: gmGuides.activeGuideIds,
    onCampaignSwitch: handleCampaignSwitch,
    selectedModel,
    activeCampaignIdKey: 'solo-active-campaign-id',
    coreRulesInGuides: defaultGuidePresent || isDefaultSoloGuideDeleted(),
  });

  // Auto-update Linked Universe story digest whenever the campaign summary changes
  useEffect(() => {
    if (campaignSummary && campaignSummary.trim()) {
      linkedUniverse.generateDigestFromSummary(campaignSummary, characterName || 'Adventurer');
    }
  }, [campaignSummary, characterName, linkedUniverse]);

  // Auto-create + restore a persistent campaign so linking is always available
  useAutoCampaign({
    mode: 'solo',
    isSignedIn: campaignSessions.isSignedIn,
    activeCampaignId,
    setActiveCampaignId,
    messages,
    campaignSummary,
    characterName,
    sessions: campaignSessions.sessions,
    sessionsLoading: campaignSessions.isLoading,
    saveSession: campaignSessions.saveSession,
    loadCampaign,
    memoryAnchors: gameState.memory_anchors,
  });



  // Keep game state in sync with activeCampaignId changes.
  // Never overwrite a good id with a transient null — explicit New Game / campaign
  // switches reset game state through their own paths.
  useEffect(() => {
    if (activeCampaignId && activeCampaignId !== gameStateCampaignId) {
      setGameStateCampaignId(activeCampaignId);
    }
  }, [activeCampaignId, gameStateCampaignId]);

  // Sync character vitals into game state whenever they change
  useEffect(() => {
    if (characterContext.currentHP !== gameState.current_hp || characterContext.maxHP !== gameState.max_hp) {
      updateVitals(characterContext.currentHP, characterContext.maxHP);
    }
  }, [characterContext.currentHP, characterContext.maxHP]);


  const handleCampaignSummaryChange = useCallback((summary: string) => {
    updateCampaignSummary(summary);
  }, [updateCampaignSummary]);

  const soloDMInputRef = useRef<SoloDMInputHandle>(null);
  const [showContext, setShowContext] = useState(false);
  const [showGuides, setShowGuides] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  /** Manual pull: re-read the DM's latest response and lift any quests out of it. */
  const handleScanQuests = useCallback(() => {
    const last = [...messages].reverse().find(m => m.role === 'assistant' && m.content?.trim());
    if (!last) {
      sonnerToast.info('No DM response to read yet.');
      return;
    }
    sonnerToast.info('Reading the DM\'s last response for quests…');
    autoSync.extractAndApply(last.content, characterContext)
      .then(result => {
        if (!result?.quests_offered?.length && !result?.quest_progress?.length) {
          sonnerToast.info('No quests found in that response.', {
            description: 'Ask the DM to lay out the jobs on offer, then try again.',
          });
        }
      })
      .catch(() => {});
  }, [messages, characterContext, autoSync.extractAndApply]);

  const npcNames = useNPCAutocomplete(messages);

  const [liveInputText, setLiveInputText] = useState('');
  const liveInputDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSocialNpcRef = useRef<{ npcName: string; message: string } | null>(null);
  const [socialToolbarLocked, setSocialToolbarLocked] = useState(false);

  const socialParse = useMemo(() => parseNpcTags(liveInputText, npcNames), [liveInputText, npcNames]);
  const socialToolbarVisible = liveInputText.trim().startsWith('@');
  const socialToolbarNpcName = socialParse ? socialParse.npcNames[0] : null;
  const socialToolbarReady = !!socialParse && socialParse.npcNames.length === 1;

  const handleLiveInputChange = useCallback((text: string) => {
    if (liveInputDebounceRef.current) clearTimeout(liveInputDebounceRef.current);
    liveInputDebounceRef.current = setTimeout(() => setLiveInputText(text), 120);
  }, []);

  useEffect(() => {
    return () => {
      if (liveInputDebounceRef.current) clearTimeout(liveInputDebounceRef.current);
    };
  }, []);

  const handleSocialSkillTap = useCallback(() => {
    if (socialParse && socialParse.npcNames.length === 1) {
      pendingSocialNpcRef.current = { npcName: socialParse.npcNames[0], message: socialParse.message };
      setSocialToolbarLocked(true);
    }
  }, [socialParse]);

  const handleSocialResolved = useCallback((result: SocialCheckResult) => {
    const pending = pendingSocialNpcRef.current;
    pendingSocialNpcRef.current = null;
    setSocialToolbarLocked(false);
    if (liveInputDebounceRef.current) clearTimeout(liveInputDebounceRef.current);
    if (!pending) return;
    voiceNPC(pending.npcName, pending.message, {
      skill: result.skill,
      opposingSkillLabel: result.opposingSkillLabel,
      playerTotal: result.playerRoll.total,
      npcTotal: result.npcRoll.total,
      outcome: result.outcome,
      rollBlockText: result.rollBlockText,
    });
    soloDMInputRef.current?.setText('');
    setLiveInputText('');
  }, [voiceNPC]);

  const handleLoadCampaign = useCallback((session: CampaignSession) => {
    loadCampaign(session.messages, session.campaign_summary, session.id, session.gm_guide_ids);
    // Restore memory anchors from the saved campaign
    resetForNewCampaign(session.id);
    if (session.memory_anchors?.length) {
      // Allow game state to initialize first, then restore anchors
      setTimeout(() => {
        for (const anchor of session.memory_anchors) {
          addMemoryAnchor(anchor);
        }
      }, 100);
    }
    setShowSessions(false);
  }, [loadCampaign, resetForNewCampaign, addMemoryAnchor]);

  const handleSaveCampaign = useCallback(async (name: string, msgs: Message[], summary: string | null, existingId?: string) => {
    const id = await campaignSessions.saveSession(name, msgs, summary, existingId, gameState.memory_anchors);
    if (id) setActiveCampaignId(id);
    return id;
  }, [campaignSessions, gameState.memory_anchors]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 120;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  }, []);

  useEffect(() => {
    if (scrollRef.current && isNearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-save crossover narration when the DM responds after a "Play this scene" activation
  const crossoverCaptureRef = useRef<{ id: string; side: 'a' | 'b'; lastMsgIdBefore: string | null } | null>(null);
  useEffect(() => {
    if (linkedUniverse.activeCrossoverId && linkedUniverse.activeCrossover) {
      if (!crossoverCaptureRef.current || crossoverCaptureRef.current.id !== linkedUniverse.activeCrossoverId) {
        const lastId = messages.length ? messages[messages.length - 1].id : null;
        crossoverCaptureRef.current = {
          id: linkedUniverse.activeCrossoverId,
          side: linkedUniverse.activeCrossover.mySide,
          lastMsgIdBefore: lastId,
        };
      }
    }
  }, [linkedUniverse.activeCrossoverId, linkedUniverse.activeCrossover, messages]);

  // Nat-20 fanfare waits until the DM has FINISHED responding to the roll
  const prevNat20LoadingRef = useRef(false);
  useEffect(() => {
    if (prevNat20LoadingRef.current && !isLoading) firePendingNat20Fanfare();
    prevNat20LoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    const capture = crossoverCaptureRef.current;
    if (!capture || isLoading || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== 'assistant' || !last.content?.trim()) return;
    if (last.id === capture.lastMsgIdBefore) return;
    // Save this narration as our side, then clear active crossover
    linkedUniverse.saveCrossoverNarration(capture.id, capture.side, last.content).finally(() => {
      crossoverCaptureRef.current = null;
      linkedUniverse.clearActiveCrossover();
    });
  }, [messages, isLoading, linkedUniverse]);

  // Live crossover beat relay: auto-push newest assistant narration to shared row
  const prevAssistantCountForBeatRef = useRef<number>(0);
  useEffect(() => {
    const assistants = messages.filter(m => m.role === 'assistant' && m.content?.trim());
    const count = assistants.length;
    if (prevAssistantCountForBeatRef.current === 0 && count > 0) {
      prevAssistantCountForBeatRef.current = count;
      return;
    }
    if (count > prevAssistantCountForBeatRef.current) {
      prevAssistantCountForBeatRef.current = count;
      const latest = assistants[assistants.length - 1]?.content;
      if (latest) {
        void linkedUniverse.pushLiveBeat(latest);
      }
    }
  }, [messages, linkedUniverse]);


  const handleQuickAction = useCallback((prompt: string) => {
    sendMessage(prompt);
  }, [sendMessage]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
          toast({ title: 'Image too large', description: 'Max 10MB', variant: 'destructive' });
          return;
        }
        setIsUploadingPhoto(true);
        try {
          const ext = file.type.includes('gif') ? 'gif' : file.type.split('/')[1] || 'png';
          const path = `chat/${activeCampaignId || 'solo'}/${crypto.randomUUID()}.${ext}`;
          const { error } = await (await import('@/integrations/supabase/client')).supabase.storage.from('party-chat-images').upload(path, file);
          if (error) throw error;
          const { data: urlData } = (await import('@/integrations/supabase/client')).supabase.storage.from('party-chat-images').getPublicUrl(path);
          addMediaMessage(`[image:${urlData.publicUrl}]`);
        } catch (err) {
          toast({ title: 'Upload failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
        } finally {
          setIsUploadingPhoto(false);
        }
        return;
      }
    }

    const text = e.clipboardData?.getData('text/plain')?.trim();
    if (text && /^https?:\/\/.+\.(gif|png|jpg|jpeg|webp)(\?.*)?$/i.test(text)) {
      e.preventDefault();
      addMediaMessage(`[image:${text}]`);
      return;
    }
  }, [activeCampaignId, addMediaMessage, toast]);

  // Geralt widget state (momo easter egg)
  const [showGeraltWidget, setShowGeraltWidget] = useState(false);

  // Bottom nav tab handler
  const handleNavTabChange = useCallback((tab: DMNavTab) => {
    if (tab === 'prompts') {
      setShowStoneDrawer(true);
      return;
    }
    if (tab === 'afk') {
      setShowGuides(true);
      return;
    }
    if (tab === 'actions') {
      setQuickActionsOpen(true);
      return;
    }
    if (tab === 'geralt') {
      setShowGeraltWidget(true);
      return;
    }
    // Dice, wildshape, oracle, settings tabs toggle full-screen content
    setActiveNavTab(prev => prev === tab ? null : tab);
  }, []);

  const handleUsePrompt = useCallback((prompt: string) => {
    soloDMInputRef.current?.appendText(prompt);
  }, []);

  const handleHealingItemUsed = useHealingItemAction({
    characterName: characterName || characterContext?.name || 'The Adventurer',
    maxHP: characterContext?.maxHP ?? 0,
    getCurrentHP: autoSyncCallbacks?.getCurrentHP ?? (() => characterContext?.currentHP ?? 0),
    onHPChange: autoSyncCallbacks?.onHPChange,
    onUseConsumableByName: autoSyncCallbacks?.onUseConsumableByName,
  });


  // A natural 20 closes the dice roller and fires the staged prompt right away,
  // so the celebration audio plays while the DM is already writing back.
  const handleDiceRollResult = useCallback((message: string) => {
    soloDMInputRef.current?.appendText(message);
    if (/Natural 20!/i.test(message)) {
      setActiveNavTab(null);
      window.setTimeout(() => soloDMInputRef.current?.submit(), 450);
    }
  }, []);

  // Names only. Enough for the prompt improver to spell abilities and spells correctly
  // without shipping the whole character sheet to another endpoint.
  const enhanceContext = useMemo(() => ({
    characterName: characterContext.name || characterName,
    abilities: characterContext.equippedAbilities,
    spells: characterContext.spellcasting?.preparedSpells,
  }), [characterContext.name, characterName, characterContext.equippedAbilities, characterContext.spellcasting?.preparedSpells]);

  const hpPercent = characterContext.maxHP > 0
    ? Math.round((characterContext.currentHP / characterContext.maxHP) * 100)
    : 100;

  // Geralt HP for sub-header (momo only) — reactive via callback
  const [geraltHp, setGeraltHp] = useState<{ current: number; max: number } | null>(null);
  useEffect(() => {
    if (isMomo) {
      const s = loadGeraltState(geraltCharacterId);
      setGeraltHp({ current: s.currentHP, max: s.maxHP });
    }
  }, [isMomo, geraltCharacterId]);
  const handleGeraltHpChange = useCallback((currentHP: number, maxHP: number) => {
    setGeraltHp({ current: currentHP, max: maxHP });
  }, []);
  const geraltHpPct = geraltHp ? Math.max(0, Math.min(100, (geraltHp.current / geraltHp.max) * 100)) : 0;

  const showDiceContent = activeNavTab === 'dice' && messages.length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]">
      {/* Row 1: Main Header */}
      {!isFullscreen && (
      <header className="flex items-center justify-between px-3 py-2.5 border-b border-amber-900/30 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <ArrowLeft className="w-5 h-5 text-white/80" />
          </button>
          <Crown className="w-6 h-6 text-amber-400" />
          <CampaignDropdown
            sessions={campaignSessions.sessions}
            activeCampaignId={activeCampaignId}
            isSignedIn={campaignSessions.isSignedIn}
            isLoading={campaignSessions.isLoading}
            onNewGame={() => setShowWorldBuilder(true)}
            onLoadCampaign={handleLoadCampaign}
            onRefresh={campaignSessions.refreshSessions}
          />
        </div>
        <div className="flex items-center gap-2">
          {sessionUsage.requests > 0 && (
            <span
              className="text-[9px] text-white/25 font-mono"
              title={`Session: ${formatUsage(sessionUsage, selectedModel)} (${sessionUsage.requests} requests)`}
            >
              {formatCostShort(sessionUsage, selectedModel)}
            </span>
          )}
          
          {onOpenCharacterPicker && (
            <button
              onClick={onOpenCharacterPicker}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-amber-500/25 hover:bg-white/10 transition-colors max-w-[120px]"
              style={{ touchAction: 'manipulation', minHeight: 40 }}
              title="Choose which character plays this campaign"
            >
              <UserCog className="w-4 h-4 text-amber-400/80 shrink-0" />
              <span className="text-[10px] text-amber-200/70 truncate">
                {characterContext.name || characterName}
              </span>
            </button>
          )}

          <button
            onClick={() => setShowToolsDrawer(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ touchAction: 'manipulation' }}
            title="Tools"
          >
            <Settings className="w-5 h-5 text-amber-400/80" />
          </button>
        </div>
      </header>
      )}

      {!isFullscreen && (
        <CharacterSheetStrip
          name={characterContext.name || characterName}
          level={characterContext.level}
          currentHP={characterContext.currentHP}
          maxHP={characterContext.maxHP}
          xpInLevel={xpSnapshot.xpIntoLevel}
          xpNeeded={xpSnapshot.xpLevelSpan}
          totalXP={xpSnapshot.totalXP}
          nextLevelXP={xpSnapshot.nextLevelXP}
          isMilestone={xpSnapshot.mode === 'milestone'}
          pendingItemCount={pendingItemCount}
          onOpen={() => setShowCharacterSheet(true)}
        />
      )}

      {!isFullscreen && (
      <>
      <button
        onClick={() => setShowContext(prev => !prev)}
        className="flex items-center gap-2 px-3 py-1.5 bg-black/30 border-b border-amber-900/20 hover:bg-black/40 transition-colors overflow-x-auto scrollbar-hide"
        style={{ touchAction: 'manipulation' }}
      >
        <span className="text-[10px] text-white/30 font-mono truncate max-w-[80px]">
          {getModelLabel(selectedModel)}
        </span>
        <span className="text-[11px] text-white/40">•</span>
        <Heart className="w-3 h-3 text-red-400 shrink-0" />
        <span className={cn(
          "text-[11px] font-mono whitespace-nowrap",
          hpPercent > 50 ? "text-emerald-400" : hpPercent > 25 ? "text-amber-400" : "text-red-400"
        )}>
          {characterContext.currentHP}/{characterContext.maxHP}
        </span>
        {isMomo && geraltHp && (
          <>
            <span className="text-[11px] text-white/40">•</span>
            <Bird className="w-3 h-3 text-pink-400 shrink-0" />
            <span className={cn(
              "text-[11px] font-mono whitespace-nowrap",
              geraltHpPct > 50 ? "text-emerald-400" : geraltHpPct > 25 ? "text-amber-400" : "text-red-400"
            )}>
              {geraltHp.current}/{geraltHp.max}
            </span>
          </>
        )}
        {wildShape?.state.isTransformed && wildShape.state.currentForm && (
          <>
            <span className="text-[11px] text-white/40">•</span>
            <PawPrint className="w-3 h-3 text-green-400 shrink-0" />
            <span className={cn(
              "text-[11px] font-mono whitespace-nowrap",
              (wildShape.state.formHP / wildShape.state.formMaxHP) > 0.5 ? "text-green-400" : (wildShape.state.formHP / wildShape.state.formMaxHP) > 0.25 ? "text-amber-400" : "text-red-400"
            )}>
              {wildShape.state.currentForm.name} {wildShape.state.formHP}/{wildShape.state.formMaxHP}
            </span>
          </>
        )}
        <span className="text-[11px] text-white/40">•</span>
        <span className="text-[11px] text-white/60 whitespace-nowrap">Lv {characterContext.level}</span>
        {characterContext.activeConditions && characterContext.activeConditions.length > 0 && (
          <>
            <span className="text-[11px] text-white/40">•</span>
            <span className="text-[11px] text-amber-400 whitespace-nowrap">
              {characterContext.activeConditions.map(c => c.name).join(', ')}
            </span>
          </>
        )}
        {campaignSummary && (
          <>
            <span className="text-[11px] text-white/40">•</span>
            <ScrollText className="w-3 h-3 text-purple-400 shrink-0" />
            <span className="text-[11px] text-purple-300/70 whitespace-nowrap">{(campaignSummary.length / 1000).toFixed(1)}k</span>
          </>
        )}
        {isSummarizing && (
          <>
            <span className="text-[11px] text-white/40">•</span>
            <span className="text-[11px] text-purple-400 animate-pulse whitespace-nowrap">Summarizing...</span>
          </>
        )}
        {showContext ? <ChevronUp className="w-3 h-3 text-white/40 shrink-0 ml-auto" /> : <ChevronDown className="w-3 h-3 text-white/40 shrink-0 ml-auto" />}
      </button>

      {/* Expanded context details */}
      <AnimatePresence>
        {showContext && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-black/30 border-b border-amber-900/20"
          >
            <div className="px-3 py-2 space-y-1 text-[11px] text-white/50">
              {characterContext.equippedAbilities.length > 0 && (
                <p><span className="text-amber-300/80">Loadout:</span> {characterContext.equippedAbilities.join(', ')}</p>
              )}
              {characterContext.spellcasting?.totalSlotsRemaining !== undefined && (
                <p><span className="text-amber-300/80">Spell Slots:</span> {characterContext.spellcasting.totalSlotsRemaining} remaining</p>
              )}
              {characterContext.spellcasting?.concentratingOn && (
                <p><span className="text-purple-400">Concentrating:</span> {characterContext.spellcasting.concentratingOn}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </>
      )}

      <NpcSocialCheckToolbar
        visible={socialToolbarVisible}
        npcName={socialToolbarNpcName}
        ready={socialToolbarReady}
        characterContext={characterContext}
        disabled={isLoading}
        onSkillTap={handleSocialSkillTap}
        onResolved={handleSocialResolved}
      />

      {/* Messages + World State Panel side-by-side */}
      <div className="flex-1 min-h-0 relative flex overflow-hidden">
        <div className={cn("flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-200", showWorldState ? "mr-80" : "")}>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className={cn("flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-[2px] py-3 sm:p-4 space-y-3 sm:space-y-4 overscroll-contain pb-[100px]", chatTheme.chatBg)}
          >

            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <Crown className="w-12 h-12 text-amber-500/60 mb-4" />
                <h2 className="text-lg font-cinzel text-amber-200 mb-2">AI Dungeon Master</h2>
                <p className="text-sm text-white/40 max-w-[280px] mb-6">
                  Your personal DM, synced to {characterContext.name}'s current state. Start an adventure or continue where you left off.
                </p>
                <DMQuickActions onSelect={handleQuickAction} isLoading={isLoading} variant="starter" />
              </div>
            ) : (
              <>
                <AnimatePresence initial={false}>
                  {messages.map((message) => (
                    <DMMessageBubble
                      key={message.id}
                      message={message}
                      onEdit={editMessage}
                      onDelete={deleteMessage}
                      onRegenerate={regenerateMessage}
                      isLoading={isLoading}
                      ttsSelectMode={ttsSelectMode}
                      ttsSelected={ttsSelectedIds.has(message.id)}
                      onTtsToggle={handleTtsToggle}
                      theme={chatTheme}
                      whisperTrayEnabled={whisperTrayEnabled}
                    />
                  ))}
                </AnimatePresence>
                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 items-center">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", chatTheme.dmAvatar)}>
                      <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }} />
                    </div>
                    <span className={cn("text-sm italic", chatTheme.loadingColor)}>
                      {chatTheme.loadingText}
                    </span>
                  </motion.div>
                )}
              </>
            )}
          </div>

          {/* TTS Select Floating Bar */}
          <AnimatePresence>
            {ttsSelectMode && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="sticky bottom-0 z-10 flex items-center justify-center gap-3 px-4 py-2.5 bg-black/80 backdrop-blur-md border-t border-amber-500/30"
              >
                <button
                  onClick={() => { setTtsSelectMode(false); setTtsSelectedIds(new Set()); }}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/60 hover:bg-white/10 transition-colors border border-white/10"
                  style={{ touchAction: 'manipulation' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const selected = messages.filter(m => ttsSelectedIds.has(m.id)).map(m => m.content);
                    if (selected.length > 0) {
                      narrator.playMessage(selected.join('\n\n'));
                    }
                    setTtsSelectMode(false);
                    setTtsSelectedIds(new Set());
                  }}
                  disabled={ttsSelectedIds.size === 0}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5",
                    ttsSelectedIds.size > 0
                      ? "bg-amber-600 hover:bg-amber-500 text-black"
                      : "bg-white/10 text-white/30"
                  )}
                  style={{ touchAction: 'manipulation' }}
                >
                  <Volume2 className="w-4 h-4" />
                  Narrate {ttsSelectedIds.size > 0 ? `(${ttsSelectedIds.size})` : ''}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Auto-Sync Banner */}
          <AutoSyncBanner
            extraction={autoSync.lastExtraction}
            onUndo={autoSync.undoLastExtraction}
            onDismiss={() => {}}
          />

          {/* Auto-Sync Extracting Indicator */}
          <AnimatePresence>
            {autoSync.isExtracting && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-center gap-2 px-3 py-1.5 bg-amber-950/40 border-t border-amber-500/20"
              >
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[11px] text-amber-300/80 font-cinzel">Auto-Sync extracting changes...</span>
                <Zap className="w-3 h-3 text-amber-400 animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>{/* end inner flex column */}

        {/* World State Panel */}
        <AnimatePresence>
          {showWorldState && (
            <WorldStatePanel
              gameState={gameState}
              onAddAnchor={addMemoryAnchor}
              onRemoveAnchor={removeMemoryAnchor}
              onSetQuestFlag={setQuestFlag}
              onClose={() => setShowWorldState(false)}
            />
          )}
        </AnimatePresence>
        {/* Fullscreen toggle - bottom-right of chat area */}
        <button
          onClick={() => {
            if (!isFullscreen) setNavExpanded(false);
            setIsFullscreen(f => !f);
          }}
          className="absolute bottom-2 right-2 z-[5] w-9 h-9 rounded-full flex items-center justify-center bg-black/40 hover:bg-black/60 transition-all"
          style={{ touchAction: 'manipulation' }}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4 text-white/70" />
          ) : (
            <Maximize2 className="w-4 h-4 text-white/40" />
          )}
        </button>
      </div>{/* end flex-1 relative flex */}

      {!isFullscreen && (
      <div className="px-2 py-2 sm:px-3 sm:py-3 border-t border-amber-900/30 bg-black/40 backdrop-blur-sm mb-[48px]">
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 50 * 1024 * 1024) {
              toast({ title: 'Video too large', description: 'Max 50MB', variant: 'destructive' });
              return;
            }
            setIsUploadingVideo(true);
            try {
              const ext = file.name.split('.').pop() || 'mp4';
              const path = `chat/${activeCampaignId || 'solo'}/${crypto.randomUUID()}.${ext}`;
              const { error } = await (await import('@/integrations/supabase/client')).supabase.storage.from('videos').upload(path, file);
              if (error) throw error;
              const { data: urlData } = (await import('@/integrations/supabase/client')).supabase.storage.from('videos').getPublicUrl(path);
              addMediaMessage(`[video:${urlData.publicUrl}]`);
            } catch (err) {
              toast({ title: 'Upload failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
            } finally {
              setIsUploadingVideo(false);
              if (videoInputRef.current) videoInputRef.current.value = '';
            }
          }}
        />
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) {
              toast({ title: 'Image too large', description: 'Max 10MB', variant: 'destructive' });
              return;
            }
            setIsUploadingPhoto(true);
            try {
              const ext = file.name.split('.').pop() || 'jpg';
              const path = `chat/${activeCampaignId || 'solo'}/${crypto.randomUUID()}.${ext}`;
              const { error } = await (await import('@/integrations/supabase/client')).supabase.storage.from('party-chat-images').upload(path, file);
              if (error) throw error;
              const { data: urlData } = (await import('@/integrations/supabase/client')).supabase.storage.from('party-chat-images').getPublicUrl(path);
              addMediaMessage(`[image:${urlData.publicUrl}]`);
            } catch (err) {
              toast({ title: 'Upload failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
            } finally {
              setIsUploadingPhoto(false);
              if (photoInputRef.current) photoInputRef.current.value = '';
            }
          }}
        />
        <div className="flex flex-col gap-2 max-w-2xl mx-auto">
            <SoloDMInput
              ref={soloDMInputRef}
              onSend={(text) => {
                const parsed = parseNpcTags(text, npcNames);
                if (parsed) {
                  voiceNPC(parsed.npcNames.length === 1 ? parsed.npcNames[0] : parsed.npcNames, parsed.message);
                } else {
                  sendMessage(text);
                }
              }}
              onCancel={cancelRequest}
              onPaste={handlePaste}
              isLoading={isLoading}
              npcNames={npcNames}
              inputClassName={cn(chatTheme.inputBg, chatTheme.inputBorder, "border focus:border-amber-500/40")}
              sendActiveClassName={chatTheme.sendBtnActive}
              onInputChange={handleLiveInputChange}
              locked={socialToolbarLocked}
              enhanceContext={enhanceContext}
            />
          <div className="flex items-center gap-1 justify-center">
            {userId && (
              <>
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isLoading || isUploadingPhoto}
                  className="p-2.5 rounded-xl border border-white/10 hover:border-amber-500/30 bg-white/5 hover:bg-amber-900/20 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                  title="Attach photo"
                >
                  {isUploadingPhoto ? (
                    <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-white/50" />
                  )}
                </button>
                <button
                  onClick={() => videoInputRef.current?.click()}
                  disabled={isLoading || isUploadingVideo}
                  className="p-2.5 rounded-xl border border-white/10 hover:border-amber-500/30 bg-white/5 hover:bg-amber-900/20 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                  title="Attach video"
                >
                  {isUploadingVideo ? (
                    <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                  ) : (
                    <Film className="w-5 h-5 text-white/50" />
                  )}
                </button>
              </>
            )}
            {narrator.hasTTSKey && (
              <>
                <button
                  onClick={() => {
                    if (narrator.isPlaying) {
                      narrator.stop();
                    } else if (narrator.isLoading) {
                      // do nothing while loading
                    } else {
                      setTtsSelectMode(prev => !prev);
                      if (ttsSelectMode) setTtsSelectedIds(new Set());
                    }
                  }}
                  disabled={narrator.isLoading}
                  className={cn(
                    "p-2.5 rounded-xl border shrink-0 transition-colors",
                    narrator.isPlaying || ttsSelectMode
                      ? "bg-amber-900/40 border-amber-500/30 hover:bg-amber-900/60"
                      : "bg-white/5 border-white/10 hover:border-amber-500/30 hover:bg-amber-900/20"
                  )}
                  style={{ touchAction: 'manipulation' }}
                  title={narrator.isPlaying ? "Stop narration" : ttsSelectMode ? "Cancel selection" : "Select messages to narrate"}
                >
                  {narrator.isLoading ? (
                    <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                  ) : narrator.isPlaying ? (
                    <VolumeX className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-white/50" />
                  )}
                </button>
                <NarrationSpeedPopover iconSize="w-5 h-5" />
              </>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Bottom Navigation Drawer */}
      {!isFullscreen && (
        <DMBottomNav
          activeTab={activeNavTab}
          onTabChange={handleNavTabChange}
          isExpanded={navExpanded}
          onExpandedChange={setNavExpanded}
          disabled={isLoading}
          showGeralt={isMomo}
          showWildShape={isMomoMoonDruid}
          afkLabel="GUIDES"
          afkIcon={BookOpen}
          afkColor="text-amber-400"
          afkActiveBg="bg-amber-500/10"
          isWildShapeActive={wildShape?.state.isTransformed}
          diceContent={showDiceContent ? (
            <DMDiceRoller
              characterContext={characterContext}
              onRollResult={handleDiceRollResult}
              disabled={isLoading}
            />
          ) : undefined}
          settingsContent={activeNavTab === 'settings' ? (
            <div className="px-3 py-3 space-y-2.5 max-h-[50vh] overflow-y-auto overscroll-contain">
              <DMSpotifyControls />
              <ResponseModeSelector
                selectedMode={responseMode}
                onModeChange={(modeId) => setResponseMode(modeId ?? undefined)}
              />
            </div>
          ) : undefined}
          oracleContent={activeNavTab === 'oracle' ? (
            <OracleWhisperFeed messages={messages} />
          ) : undefined}
          wildshapeContent={activeNavTab === 'wildshape' && wildShape && wildShape.config ? (
            <div className="px-3 py-3">
              <WildShapeSection wildShape={wildShape} characterName={characterName} />
            </div>
          ) : undefined}
          oracleCount={messages.reduce((count, m) => count + (m.whispers?.length ?? 0), 0)}
        />
      )}



      {/* Geralt Gameplay Widget (momo only) */}
      {isMomo && (
        <GeraltGameplayWidget
          open={showGeraltWidget}
          onClose={() => setShowGeraltWidget(false)}
          characterId={geraltCharacterId}
          onHpChange={handleGeraltHpChange}
          onUsePrompt={handleUsePrompt}
        />
      )}

      {/* Tools Drawer */}
      <DMToolsDrawer
        open={showToolsDrawer}
        onOpenChange={setShowToolsDrawer}
        onNewCampaign={() => setShowWorldBuilder(true)}
        
        onSaves={() => setShowSessions(true)}
        onGuides={() => setShowGuides(true)}
        onWorldState={() => setShowWorldState(prev => !prev)}
        onClearChat={clearMessages}
        autoSyncEnabled={autoSync.autoSyncEnabled}
        onToggleAutoSync={(enabled) => autoSync.toggleAutoSync(enabled)}
        isExtracting={autoSync.isExtracting}
        showAutoSync={!!autoSyncCallbacks}
        guidesCount={gmGuides.guides.filter(g => g.enabled).length}
        anchorsCount={gameState.memory_anchors.length}
        onRetakePersonalityTest={onRetakePersonalityTest}
        dmPersonaName={dmPersonaName}
        selectedModel={selectedModel}
        onModelChange={(id) => { setSelectedModel(id); saveSelectedModel(id); }}
        chatThemeId={chatThemeId}
        onChatThemeChange={setChatTheme}
        whisperTrayEnabled={whisperTrayEnabled}
        onWhisperTrayEnabledChange={setWhisperTrayEnabled}
        linkedUniverseSection={
          <LinkedUniverseSection
            campaignId={activeCampaignId}
            characterName={characterName || 'Adventurer'}
            controller={linkedUniverse}
          />
        }
      />

      {/* GM Guides Overlay */}
      {showGuides && (
        <GMGuidesManager
          onBack={() => setShowGuides(false)}
          guides={gmGuides.guides}
          totalChars={gmGuides.totalChars}
          campaignSummary={campaignSummary}
          onCampaignSummaryChange={handleCampaignSummaryChange}
          onAdd={gmGuides.addGuide}
          onUpdate={gmGuides.updateGuide}
          onDelete={(id) => { if (id === DEFAULT_SOLO_GUIDE_ID) markDefaultSoloGuideDeleted(); gmGuides.deleteGuide(id); }}
          onToggle={gmGuides.toggleGuide}
          chatMessages={messages.slice(-20).map(m => ({ role: m.role, content: m.content }))}
          defaultGuideMissing={!defaultGuidePresent}
          onRestoreDefault={() => { clearDefaultSoloGuideDeleted(); gmGuides.addGuide(DEFAULT_SOLO_GUIDE_NAME, DEFAULT_SOLO_GUIDE_CONTENT, DEFAULT_SOLO_GUIDE_ID); }}
        />
      )}
      {/* Campaign Sessions Overlay */}
      {showSessions && (
        <CampaignSessionsManager
          onBack={() => setShowSessions(false)}
          sessions={campaignSessions.sessions}
          isLoading={campaignSessions.isLoading}
          isSignedIn={campaignSessions.isSignedIn}
          currentMessages={messages}
          currentSummary={campaignSummary}
          activeCampaignId={activeCampaignId}
          onSave={handleSaveCampaign}
          onLoad={handleLoadCampaign}
          onDelete={campaignSessions.deleteSession}
          onRename={campaignSessions.renameSession}
        />
      )}
      <DiceRollOverlay />
      {/* Infinity Stone DM Drawer */}
      <InfinityStoneDMDrawer
        open={showStoneDrawer}
        onOpenChange={setShowStoneDrawer}
        characterName={characterName}
        onUsePrompt={handleUsePrompt}
      />
      {/* Quick Actions Drawer */}
      <PartyDMQuickActions
        open={quickActionsOpen}
        onOpenChange={setQuickActionsOpen}
        characterContext={characterContext}
        characterName={characterName}
        onUsePrompt={handleUsePrompt}
        onHealingItemUsed={handleHealingItemUsed}
        onSendPrompt={sendMessage}
      />


      {/* Campaign Builder Chat */}
      <AnimatePresence>
        {showWorldBuilder && (
          <CampaignBuilderChat
            characterName={characterContext.name || characterName}
            characterLevel={characterContext.level || 1}
            characterIdentity={{
              race: characterContext.race || undefined,
              gender: characterContext.gender || undefined,
              class: characterContext.characterClass || undefined,
              backstory: characterContext.backstory || undefined,
            }}
            existingGuidesContent={gmGuides.enabledContent}
            onComplete={async (data: CampaignBuildData) => {
              setShowWorldBuilder(false);
              await newGame();
              resetForNewCampaign(null);
              setTimeout(() => {
                updateCampaignSummary(data.campaignSummary);
                gmGuides.addGuide(`📖 ${data.campaignName}`, data.gmGuide);
                for (const anchor of data.memoryAnchors) {
                  addMemoryAnchor({ category: anchor.category, key: anchor.key, value: anchor.value });
                }
                setTimeout(() => {
                  sendMessage('Begin the adventure. Here is the opening scene to set the stage:\n\n' + data.openingScene);
                }, 200);
              }, 100);
            }}
            onSkip={() => {
              setShowWorldBuilder(false);
              newGame();
              resetForNewCampaign(null);
            }}
          />
        )}
      </AnimatePresence>

      <SoloCharacterSheet
        open={showCharacterSheet}
        initialTab={restoreSheetTab}
        onClose={() => { setShowCharacterSheet(false); setRestoreSheetTab(undefined); }}
        ctx={characterContext}
        currentXP={currentXP}
        gold={autoSyncCallbacks?.getCurrentGold?.() ?? 0}
        onUseConsumableByName={
          autoSyncCallbacks?.onUseConsumableByName
            ? (name: string) => { autoSyncCallbacks.onUseConsumableByName!(name, 1); }
            : undefined
        }
        onUseLootItem={(text) => soloDMInputRef.current?.appendText(text)}
        quests={quests}
        onAcceptQuest={handleAcceptQuest}
        onDeclineQuest={handleDeclineQuest}
        worldState={worldState}
        onScanQuests={handleScanQuests}
        scanningQuests={autoSync.isExtracting}
        onAdjustHP={(change, type) => autoSyncCallbacks?.onHPChange?.(change, type)}
        onAddXP={(amount, source) => autoSyncCallbacks?.onAddXP?.(amount, source)}
        onManualLevelUp={onManualLevelUp}
        onConditionChange={(add, remove) => autoSyncCallbacks?.onConditionChange?.(add, remove)}
        onRest={(type) => autoSyncCallbacks?.onRestOccurred?.(type)}
        onRestPrompt={(text) => sendMessage(text)}
        onAcceptItem={onAcceptItem}
      />

    </div>
  );
}
