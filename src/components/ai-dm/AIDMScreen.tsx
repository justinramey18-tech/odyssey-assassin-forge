import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { isMomoEasterEgg } from '@/lib/easter-eggs';
import { GeraltGameplayWidget } from './GeraltGameplayWidget';
import { loadSelectedModel, saveSelectedModel, getModelLabel } from '@/lib/dm-models';
import { formatUsage, formatCostShort } from '@/lib/token-usage';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Square, Trash2, RotateCcw, Crown, Heart, Shield, ChevronDown, ChevronUp, BookOpen, ScrollText, FolderOpen, Cloud, CloudOff, Loader2, Zap, Map, Film, Image as ImageIcon, Copy, Check, Pencil, RefreshCw, X, MoreVertical, Globe, Settings, Volume2, VolumeX, Bird } from 'lucide-react';
import { loadState as loadGeraltState } from '@/components/companion/geralt-data';
import { NarrationSpeedPopover } from './NarrationSpeedPopover';
import { DMToolsDrawer } from './DMToolsDrawer';
import { InfinityStoneDMDrawer } from './InfinityStoneDMDrawer';
import { DMBottomNav, DMNavTab } from './DMBottomNav';
import { PartyDMQuickActions } from './PartyDMQuickActions';
import { CampaignDropdown } from './CampaignDropdown';
import { cn } from '@/lib/utils';
import { useAIDM } from '@/hooks/use-ai-dm';
import { useGMGuides } from '@/hooks/use-gm-guides';
import { useCampaignSessions, CampaignSession } from '@/hooks/use-campaign-sessions';
import { CharacterContext, Message } from '@/components/oracle/types';
import { useToast } from '@/hooks/use-toast';
import { DMQuickActions } from './DMQuickActions';
import { DMDiceRoller } from './DMDiceRoller';
import { GMGuidesManager } from './GMGuidesManager';
import { CampaignSessionsManager } from './CampaignSessionsManager';
import { WorldStatePanel } from './WorldStatePanel';
import { useDMGameState, buildMemoryAnchorsPrompt } from '@/hooks/use-dm-game-state';
import { useDmMemoryExtraction } from '@/hooks/use-dm-memory-extraction';
import { WorldBuilderWizard } from './WorldBuilderWizard';

import { AutoSyncBanner } from './AutoSyncBanner';

import { useDmAutoSync } from '@/hooks/use-dm-auto-sync';
import { InlineBattleMap } from './InlineBattleMap';
import ReactMarkdown from 'react-markdown';
import { useNarrator } from '@/hooks/use-narrator';

import type { MapMarker } from '@/components/party/battlemap/types';


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
    onAddXP: (amount: number, source: string) => void;
    onGoldChange: (netChange: number) => void;
    onConditionChange: (toAdd: string[], toRemove: string[]) => void;
    onRestOccurred: (type: 'short' | 'long') => void;
    getCurrentHP: () => number;
    getCurrentGold: () => number;
  };
}

const VIDEO_REGEX = /^\s*\[video:(https?:\/\/.+)\]\s*$/;
const IMAGE_REGEX = /^\s*\[image:(https?:\/\/.+)\]\s*$/;

interface DMMessageBubbleProps {
  message: Message;
  onEdit?: (id: string, content: string) => void;
  onDelete?: (id: string) => void;
  onRegenerate?: (id: string) => void;
  isLoading?: boolean;
}

function DMMessageBubble({ message, onEdit, onDelete, onRegenerate, isLoading }: DMMessageBubbleProps) {
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
      {/* DM Avatar */}
      {!isUser && (
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 bg-amber-900/60 border border-amber-500/40">
          <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
        </div>
      )}

      {/* Message bubble */}
      <div className="relative group flex-1 min-w-0 max-w-[85%]">
        <div
          className={cn(
            'rounded-2xl px-2.5 py-1.5 sm:px-4 sm:py-2.5 overflow-hidden',
            isUser
              ? 'bg-white/10 text-white rounded-br-sm border border-white/10'
              : 'bg-amber-950/50 border border-amber-500/20 rounded-bl-sm'
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
            <div className="text-sm prose prose-invert prose-sm max-w-none break-words overflow-wrap-anywhere">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  strong: ({ children }) => <strong className="text-amber-300">{children}</strong>,
                  em: ({ children }) => <em className="text-white/70">{children}</em>,
                  ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  code: ({ children }) => <code className="bg-black/30 px-1 rounded text-xs">{children}</code>,
                  h1: ({ children }) => <h1 className="text-lg font-cinzel text-amber-300 mb-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base font-cinzel text-amber-300 mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-cinzel text-amber-300 mb-1">{children}</h3>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-amber-500/40 pl-3 italic text-white/60 my-2">{children}</blockquote>
                  ),
                  hr: () => <hr className="border-amber-500/20 my-3" />,
                }}
              >
                {message.content || '...'}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Action buttons for assistant messages */}
        {!isUser && message.content && !isEditing && (
          <div className="flex items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
              title="Copy"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleEdit}
              className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRegenerate}
              disabled={isLoading}
              className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors disabled:opacity-30"
              title="Regenerate"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-md hover:bg-red-900/30 text-white/40 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Mobile: tap to show actions for assistant messages */}
        {!isUser && message.content && !isEditing && (
          <button
            onClick={() => setShowActions(prev => !prev)}
            className="absolute top-1 right-1 p-1 rounded-md sm:hidden text-white/30 hover:text-white/60"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Mobile action menu */}
        <AnimatePresence>
          {showActions && !isUser && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute top-0 right-0 z-20 bg-[#1a1520] border border-amber-500/30 rounded-xl shadow-xl p-1 flex flex-col gap-0.5 sm:hidden"
            >
              <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/10 rounded-lg">
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />} Copy
              </button>
              <button onClick={handleEdit} className="flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/10 rounded-lg">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              <button onClick={handleRegenerate} disabled={isLoading} className="flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/10 rounded-lg disabled:opacity-30">
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate
              </button>
              <button onClick={handleDelete} className="flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-900/20 rounded-lg">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
          <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/70" />
        </div>
      )}
    </motion.div>
  );
}

// Stable no-op fallbacks (defined outside component to avoid re-creation)
const NOOP = () => {};
const NOOP_TWO_ARG = () => {};
const NOOP_RETURN_ZERO = () => 0;

export function AIDMScreen({ onBack, characterContext, userId, characterName = 'Adventurer', autoSyncCallbacks, dmPersonaPrompt, dmPersonaName, onRetakePersonalityTest }: AIDMScreenProps) {
  const [showToolsDrawer, setShowToolsDrawer] = useState(false);
  const [showWorldBuilder, setShowWorldBuilder] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() => loadSelectedModel());
  const [showBattleMap, setShowBattleMap] = useState(false);
  const [showWorldState, setShowWorldState] = useState(false);
  const [pendingMapAdds, setPendingMapAdds] = useState<MapMarker[]>([]);
  const [pendingMapRemovals, setPendingMapRemovals] = useState<string[]>([]);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const battleMapMarkersRef = useRef<MapMarker[]>([]);
  const battleMapGridSizeRef = useRef<number>(25);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const gmGuides = useGMGuides();
  const { toast } = useToast();
  const narrator = useNarrator();

  // Bottom nav state
  const [activeNavTab, setActiveNavTab] = useState<DMNavTab | null>(null);
  const [navExpanded, setNavExpanded] = useState(false);
  const [showStoneDrawer, setShowStoneDrawer] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  // Auto-sync hook
  const autoSync = useDmAutoSync({
    onHPChange: autoSyncCallbacks?.onHPChange ?? NOOP_TWO_ARG,
    onAddXP: autoSyncCallbacks?.onAddXP ?? NOOP_TWO_ARG,
    onGoldChange: autoSyncCallbacks?.onGoldChange ?? NOOP,
    onConditionChange: autoSyncCallbacks?.onConditionChange ?? NOOP_TWO_ARG,
    onRestOccurred: autoSyncCallbacks?.onRestOccurred ?? NOOP,
    onMapUpdate: useCallback((markersToAdd: MapMarker[], namesToRemove: string[]) => {
      if (markersToAdd.length > 0) setPendingMapAdds(markersToAdd);
      if (namesToRemove.length > 0) setPendingMapRemovals(namesToRemove);
    }, []),
    getCurrentHP: autoSyncCallbacks?.getCurrentHP ?? NOOP_RETURN_ZERO,
    getCurrentGold: autoSyncCallbacks?.getCurrentGold ?? NOOP_RETURN_ZERO,
    getCurrentMarkers: useCallback(() => battleMapMarkersRef.current, []),
    getGridSize: useCallback(() => battleMapGridSizeRef.current as any, []),
  });

  // Refs for memory extraction — lets handleMessageComplete (defined before hooks) access late-initialized values
  const extractMemoryRef = useRef<((msg: string, anchors: any[], ctx: any) => void) | null>(null);
  const memoryAnchorsRef = useRef<any[]>([]);

  const handleMessageComplete = useCallback((content: string) => {
    if (autoSync.autoSyncEnabled && autoSyncCallbacks) {
      autoSync.extractAndApply(content, characterContext);
    }
    // Always run memory extraction in the background via ref — avoids hook ordering issues
    extractMemoryRef.current?.(content, memoryAnchorsRef.current, characterContext);
  }, [autoSync.autoSyncEnabled, autoSyncCallbacks, autoSync.extractAndApply, characterContext]);

  const handleCampaignSwitch = useCallback((guideIds: string[] | null) => {
    gmGuides.setActiveGuideIds(guideIds);
  }, [gmGuides.setActiveGuideIds]);

  // Campaign sessions (needed before useAIDM to get activeCampaignId dependency)
  const campaignSessions = useCampaignSessions();

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
    updateVitals,
    updateGold,
    resetForNewCampaign,
  } = useDMGameState(gameStateCampaignId);

  // Memory extraction hook — silently extracts NPCs, locations, consequences from DM responses
  const { extractMemory } = useDmMemoryExtraction({ addMemoryAnchor });

  // Keep refs in sync so handleMessageComplete always has fresh values
  useEffect(() => { extractMemoryRef.current = extractMemory; }, [extractMemory]);
  useEffect(() => { memoryAnchorsRef.current = gameState.memory_anchors; }, [gameState.memory_anchors]);

  // Build world state prompt to inject into AI system prompt
  const worldStatePrompt = useMemo(() => buildMemoryAnchorsPrompt(gameState), [gameState]);

  const { messages, isLoading, isSummarizing, campaignSummary, updateCampaignSummary, loadCampaign, sendMessage, addMediaMessage, cancelRequest, clearMessages, newGame, activeCampaignId, setActiveCampaignId, lastCloudSyncTime, isCloudSyncing, saveToCloudNow, editMessage, deleteMessage, regenerateMessage, lastUsage, sessionUsage } = useAIDM({
    characterContext,
    customGuidesContent: gmGuides.enabledContent,
    worldStatePrompt,
    dmPersonaPrompt,
    onMessageComplete: handleMessageComplete,
    activeGuideIds: gmGuides.activeGuideIds,
    onCampaignSwitch: handleCampaignSwitch,
    selectedModel,
  });

  // Keep game state in sync with activeCampaignId changes
  useEffect(() => {
    if (activeCampaignId !== gameStateCampaignId) {
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

  const [input, setInput] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [showGuides, setShowGuides] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleLoadCampaign = useCallback((session: CampaignSession) => {
    if (messages.length > 0) {
      saveToCloudNow();
    }
    loadCampaign(session.messages, session.campaign_summary, session.id, session.gm_guide_ids);
    setShowSessions(false);
  }, [loadCampaign, messages.length, saveToCloudNow]);

  const handleSaveCampaign = useCallback(async (name: string, msgs: Message[], summary: string | null, existingId?: string) => {
    const id = await campaignSessions.saveSession(name, msgs, summary, existingId);
    if (id) setActiveCampaignId(id);
    return id;
  }, [campaignSessions]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleQuickAction = useCallback((prompt: string) => {
    sendMessage(prompt);
  }, [sendMessage]);

  const handleCloseBattleMap = useCallback(() => setShowBattleMap(false), []);
  const handlePendingProcessed = useCallback(() => { setPendingMapAdds([]); setPendingMapRemovals([]); }, []);
  const handleMarkersChange = useCallback((markers: MapMarker[]) => { battleMapMarkersRef.current = markers; }, []);
  const handleGridSizeChange = useCallback((size: any) => { battleMapGridSizeRef.current = size; }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }, []);

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
  const isMomo = useMemo(() => isMomoEasterEgg(characterName), [characterName]);

  // Bottom nav tab handler
  const handleNavTabChange = useCallback((tab: DMNavTab) => {
    if (tab === 'prompts') {
      setShowStoneDrawer(true);
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
    // Dice tab toggles
    setActiveNavTab(prev => prev === tab ? null : tab);
  }, []);

  const handleUsePrompt = useCallback((prompt: string) => {
    setInput(prev => prev ? `${prev}\n${prompt}` : prompt);
  }, []);

  const hpPercent = characterContext.maxHP > 0
    ? Math.round((characterContext.currentHP / characterContext.maxHP) * 100)
    : 100;

  // Geralt HP for sub-header (momo only)
  const geraltState = useMemo(() => isMomo ? loadGeraltState(userId || 'default') : null, [isMomo, userId, showGeraltWidget]);
  const geraltHpPct = geraltState ? Math.max(0, Math.min(100, (geraltState.currentHP / geraltState.maxHP) * 100)) : 0;

  const showDiceContent = activeNavTab === 'dice' && messages.length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]">
      {/* Row 1: Main Header */}
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

      {/* Row 2: Sub-Header Strip */}
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
        {isMomo && geraltState && (
          <>
            <span className="text-[11px] text-white/40">•</span>
            <Bird className="w-3 h-3 text-pink-400 shrink-0" />
            <span className={cn(
              "text-[11px] font-mono whitespace-nowrap",
              geraltHpPct > 50 ? "text-emerald-400" : geraltHpPct > 25 ? "text-amber-400" : "text-red-400"
            )}>
              {geraltState.currentHP}/{geraltState.maxHP}
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
        {campaignSessions.isSignedIn && (
          <>
            <span className="text-[11px] text-white/40">•</span>
            {isCloudSyncing ? (
              <Loader2 className="w-3 h-3 text-sky-400 animate-spin shrink-0" />
            ) : lastCloudSyncTime ? (
              <>
                <Cloud className="w-3 h-3 text-sky-400 shrink-0" />
                <span className="text-[11px] text-sky-300/70 whitespace-nowrap">
                  {Math.round((Date.now() - lastCloudSyncTime.getTime()) / 60000)}m
                </span>
              </>
            ) : (
              <CloudOff className="w-3 h-3 text-white/30 shrink-0" />
            )}
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

      {/* Messages / Battle Map + World State Panel side-by-side */}
      <div className="flex-1 min-h-0 relative flex overflow-hidden">
        <div className={cn("flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-200", showWorldState ? "mr-80" : "")}>
      {showBattleMap ? (
        <InlineBattleMap
          characterName={characterName}
          pendingMarkerAdds={pendingMapAdds}
          pendingMarkerRemovals={pendingMapRemovals}
          onPendingProcessed={handlePendingProcessed}
          onMarkersChange={handleMarkersChange}
          onGridSizeChange={handleGridSizeChange}
          onClose={handleCloseBattleMap}
        />
      ) : (
        <>
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-[2px] py-3 sm:p-4 space-y-3 sm:space-y-4 overscroll-contain pb-[100px]"
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
                    />
                  ))}
                </AnimatePresence>
                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 items-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-amber-900/60 border border-amber-500/40">
                      <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <span className="text-sm text-amber-400/60 italic">The DM weaves the tale...</span>
                  </motion.div>
                )}
              </>
            )}
          </div>

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
        </>
      )}
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
      </div>{/* end flex-1 relative flex */}

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
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          {/* Attach buttons */}
          {userId && (
            <div className="flex gap-1 shrink-0">
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
            </div>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="What do you do?"
            rows={1}
            className="flex-1 bg-white/5 border border-amber-900/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 resize-none min-h-[42px] max-h-[200px]"
            disabled={isLoading}
          />
          {isLoading ? (
            <button
              onClick={cancelRequest}
              className="p-2.5 rounded-xl bg-red-900/40 border border-red-500/30 hover:bg-red-900/60 transition-colors shrink-0"
              style={{ touchAction: 'manipulation' }}
            >
              <Square className="w-5 h-5 text-red-400" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={cn(
                "p-2.5 rounded-xl border shrink-0 transition-colors",
                input.trim()
                  ? "bg-amber-900/40 border-amber-500/30 hover:bg-amber-900/60"
                  : "bg-white/5 border-white/10 opacity-40"
              )}
              style={{ touchAction: 'manipulation' }}
            >
              <Send className="w-5 h-5 text-amber-400" />
            </button>
          )}
          {/* Narrator speaker button */}
          {narrator.hasElevenLabsKey && (
            <button
              onClick={() => {
                if (narrator.isPlaying) {
                  narrator.stop();
                } else {
                  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
                  if (lastAssistant) {
                    narrator.playMessage(lastAssistant.content);
                  }
                }
              }}
              disabled={narrator.isLoading}
              className={cn(
                "p-2.5 rounded-xl border shrink-0 transition-colors",
                narrator.isPlaying
                  ? "bg-amber-900/40 border-amber-500/30 hover:bg-amber-900/60"
                  : "bg-white/5 border-white/10 hover:border-amber-500/30 hover:bg-amber-900/20"
              )}
              style={{ touchAction: 'manipulation' }}
              title={narrator.isPlaying ? "Stop narration" : "Narrate last message"}
            >
              {narrator.isLoading ? (
                <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
              ) : narrator.isPlaying ? (
                <VolumeX className="w-5 h-5 text-amber-400" />
              ) : (
                <Volume2 className="w-5 h-5 text-white/50" />
              )}
            </button>
          )}
          {narrator.hasElevenLabsKey && (
            <NarrationSpeedPopover iconSize="w-5 h-5" />
          )}
        </div>
      </div>

      {/* Bottom Navigation Drawer */}
      <DMBottomNav
        activeTab={activeNavTab}
        onTabChange={handleNavTabChange}
        isExpanded={navExpanded}
        onExpandedChange={setNavExpanded}
        disabled={isLoading}
        showGeralt={isMomo}
        diceContent={showDiceContent ? (
          <DMDiceRoller
            characterContext={characterContext}
            onRollResult={handleUsePrompt}
            disabled={isLoading}
          />
        ) : undefined}
      />

      {/* Geralt Gameplay Widget (momo only) */}
      {isMomo && (
        <GeraltGameplayWidget
          open={showGeraltWidget}
          onClose={() => setShowGeraltWidget(false)}
          characterId={userId || 'default'}
        />
      )}

      {/* Tools Drawer */}
      <DMToolsDrawer
        open={showToolsDrawer}
        onOpenChange={setShowToolsDrawer}
        onNewCampaign={() => setShowWorldBuilder(true)}
        onBattleMap={() => setShowBattleMap(true)}
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
          onDelete={gmGuides.deleteGuide}
          onToggle={gmGuides.toggleGuide}
          chatMessages={messages.slice(-20).map(m => ({ role: m.role, content: m.content }))}
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
      />

      {/* World Builder Wizard */}
      <AnimatePresence>
        {showWorldBuilder && (
          <WorldBuilderWizard
            characterName={characterContext.name || characterName}
            characterLevel={characterContext.level || 1}
            onComplete={async (bible, worldName) => {
              setShowWorldBuilder(false);
              await newGame();
              resetForNewCampaign(null);
              // Small delay to let newGame flush before adding guide
              setTimeout(() => {
                gmGuides.addGuide(`📖 ${worldName}`, bible);
                setTimeout(() => {
                  sendMessage('Begin the adventure. Use the Campaign World guide to open with an immersive first scene based on our world.');
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
    </div>
  );
}
