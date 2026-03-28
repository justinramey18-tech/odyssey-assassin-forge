import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseWhispers } from '@/lib/whisper-parser';
import { sendTelegramNotification } from '@/lib/telegram-notify';
import { WhisperTray } from '@/components/ai-dm/WhisperTray';
import { ArrowLeft, Send, BookOpen, Loader2, X, Shuffle, Flame, MoreVertical, Pencil, Trash2, Copy, Check, RefreshCw, Volume2, VolumeX, Zap, ChevronDown, MessageCircle, Megaphone } from 'lucide-react';
import { useOocDmChat } from '@/hooks/use-ooc-dm-chat';
import { OocDmChat } from '@/components/ai-dm/OocDmChat';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { CharacterContext } from '@/components/oracle/types';
import { useAIDM } from '@/hooks/use-ai-dm';
import { useCampaignSessions, CampaignSession } from '@/hooks/use-campaign-sessions';
import { CampaignDropdown } from '@/components/ai-dm/CampaignDropdown';
import { CampaignSessionsManager } from '@/components/ai-dm/CampaignSessionsManager';
import { DMToolsDrawer } from '@/components/ai-dm/DMToolsDrawer';
import { DMBottomNav, DMNavTab } from '@/components/ai-dm/DMBottomNav';
import { DMDiceRoller } from '@/components/ai-dm/DMDiceRoller';
import { GMGuidesManager } from '@/components/ai-dm/GMGuidesManager';
import { WorldStatePanel } from '@/components/ai-dm/WorldStatePanel';
import { PartyDMQuickActions } from '@/components/ai-dm/PartyDMQuickActions';
import EmpyreanContextualActions from '@/components/empyrean/EmpyreanContextualActions';
import DragonBondChat from '@/components/empyrean/DragonBondChat';
import { useGMGuides } from '@/hooks/use-gm-guides';
import { useDMGameState, buildMemoryAnchorsPrompt } from '@/hooks/use-dm-game-state';
import { useNPCMentionState } from '@/hooks/use-npc-mention-state';
import { NPCAutocomplete } from '@/components/ai-dm/NPCAutocomplete';
import { usePromptDrawers } from '@/components/drawers/PromptDrawerProvider';
import { useDMChatTheme } from '@/hooks/use-dm-chat-theme';
import { useWhisperTrayEnabled } from '@/hooks/use-whisper-tray-enabled';
import { useDmAutoSync } from '@/hooks/use-dm-auto-sync';
import { AutoSyncBanner } from '@/components/ai-dm/AutoSyncBanner';
import { useNarrator } from '@/hooks/use-narrator';
import { NarrationSpeedPopover } from '@/components/ai-dm/NarrationSpeedPopover';
import {
  loadEmpyreanDMConfig,
  buildEmpyreanDMPersona,
  EmpyreanDMConfig,
  loadDragonNotes,
  saveDragonNotes,
} from '@/lib/empyreanDMPersona';
import { useDragonBond } from '@/hooks/use-dragon-bond';
import { getBondDescriptor, getTrustDescriptor, buildDragonChatPrompt, DRAGON_CHAT_SUMMARY_KEY, DRAGON_CHAT_KEY } from '@/lib/dragonBondState';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';
import { getAuthToken } from '@/lib/auth-token';
import { empyreanPrompts } from '@/lib/empyreanPrompts';
import { EMPYREAN_SESSION_GUIDES } from '@/lib/empyreanGMGuides';
import { DM_MODELS } from '@/lib/dm-models';
import { useSpotify } from '@/hooks/use-spotify';
import { resolveResponseModePrompt } from '@/lib/dm-response-modes';
import { useResponseMode } from '@/hooks/use-response-mode';
import { EmpyreanAutopilotGuide } from '@/components/empyrean/EmpyreanAutopilotGuide';
import CampaignBuilderChat from '@/components/ai-dm/CampaignBuilderChat';
import type { CampaignBuildData } from '@/hooks/use-ai-campaign-chat';
import { useEmpyreanAutopilot } from '@/hooks/use-empyrean-autopilot';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EmpyreanDMScreenProps {
  open: boolean;
  onClose: () => void;
  characterContext: CharacterContext;
  characterName: string;
  initialMessage?: string | null;
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

const NOOP = () => {};
const NOOP_TWO_ARG = () => {};
const NOOP_RETURN_ZERO = () => 0;

const EMPYREAN_SESSION_KEY = 'empyrean-dm-session';
const EMPYREAN_SUMMARY_KEY = 'empyrean-dm-campaign-summary';
const EMPYREAN_MODEL_KEY = 'empyrean-dm-model';
const DEFAULT_EMPYREAN_MODEL = 'google/gemini-3-pro-preview';

function loadEmpyreanModel(): string {
  try {
    const saved = localStorage.getItem(EMPYREAN_MODEL_KEY);
    if (saved && DM_MODELS.some(m => m.id === saved)) return saved;
  } catch { /* ignore */ }
  return DEFAULT_EMPYREAN_MODEL;
}

function saveEmpyreanModel(modelId: string): void {
  try { localStorage.setItem(EMPYREAN_MODEL_KEY, modelId); } catch { /* ignore */ }
}

// Group prompts by category
function groupPromptsByCategory(prompts: typeof empyreanPrompts) {
  const groups: Record<string, typeof empyreanPrompts> = {};
  for (const p of prompts) {
    if (!groups[p.category]) groups[p.category] = [];
    groups[p.category].push(p);
  }
  return groups;
}

// Strip burnout tags from displayed content
function stripBurnoutTags(content: string): string {
  return content.replace(/<!--BURNOUT:\d+-->/g, '').replace(/<!--BURNOUT_TICK:.+?-->/g, '').trim();
}

function stripSituationTags(content: string): string {
  return content.replace(/<!--SITUATION:\w+-->/g, '').trim();
}

function stripBondStrainTags(content: string): string {
  return content.replace(/<!--BOND_STRAIN:.+?-->/g, '').trim();
}

const BURNOUT_LABELS = [
  'No strain',
  'Relic warmth — bone-deep heat',
  'Heat spreading — nosebleed, unsteady',
  'Bones burning — collapse risk',
  'Skin burning — dragon alarmed',
  'Body at limit — dragon buffering',
  'Dragon absorbing overflow — bond straining',
  'Rider and dragon both near limit',
  'Critical co-overload',
  'Maximum capacity — sever or die',
];

function BurnoutIndicator({ level, maxBurnout }: { level: number; maxBurnout: number }) {
  const ratio = maxBurnout > 0 ? level / maxBurnout : 0;
  const color = ratio < 0.35 ? 'text-emerald-400' : ratio < 0.65 ? 'text-amber-400' : ratio < 0.85 ? 'text-orange-500' : 'text-red-500';
  const emptyColor = ratio < 0.35 ? 'text-emerald-400/20' : ratio < 0.65 ? 'text-amber-400/20' : ratio < 0.85 ? 'text-orange-500/20' : 'text-red-500/20';
  return (
    <div className="flex items-center gap-0.5" title={`Signet Strain (${level}/${maxBurnout}): ${BURNOUT_LABELS[level] ?? BURNOUT_LABELS[BURNOUT_LABELS.length - 1]}`}>
      {Array.from({ length: maxBurnout }, (_, i) => (
        <Flame key={i} className={cn('w-3 h-3', i < level ? color : emptyColor)} />
      ))}
    </div>
  );
}

function stripAllMetaTags(content: string): string {
  return content
    .replace(/<!--BURNOUT:\d+-->/g, '')
    .replace(/<!--BURNOUT_TICK:.+?-->/g, '')
    .replace(/<!--SITUATION:\w+-->/g, '')
    .replace(/<!--BOND_STRAIN:.+?-->/g, '')
    .replace(/<!--DRAGON_MEMORY:.+?-->/g, '')
    .replace(/<!--BOND_GROWTH:.+?-->/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function EmpyreanDMScreen({
  open,
  onClose,
  characterContext,
  characterName,
  initialMessage,
  autoSyncCallbacks,
}: EmpyreanDMScreenProps) {
  const [config, setConfig] = useState<EmpyreanDMConfig | null>(() => loadEmpyreanDMConfig());
  const [selectedModel, setSelectedModel] = useState(loadEmpyreanModel);
  const [showToolsDrawer, setShowToolsDrawer] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showCharacterActions, setShowCharacterActions] = useState(false);
  const [showSaves, setShowSaves] = useState(false);
  const [showGuides, setShowGuides] = useState(false);
  const [showWorldState, setShowWorldState] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showOocChat, setShowOocChat] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [burnoutLevel, setBurnoutLevel] = useState(0);
  const burnoutLevelRef = useRef(burnoutLevel);
  useEffect(() => { burnoutLevelRef.current = burnoutLevel; }, [burnoutLevel]);
  const [currentSituation, setCurrentSituation] = useState<string>('exploration');
  const [dragonNotes, setDragonNotes] = useState(() => loadDragonNotes());
  const [initialSent, setInitialSent] = useState(false);
  const [activeNavTab, setActiveNavTab] = useState<DMNavTab | null>(null);
  const [navExpanded, setNavExpanded] = useState(false);
  const [showAutopilotGuide, setShowAutopilotGuide] = useState(false);
  const [recapExpanded, setRecapExpanded] = useState(false);
  const [showCampaignBuilder, setShowCampaignBuilder] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reload config when screen opens
  const [showDragonChat, setShowDragonChat] = useState(false);

  useEffect(() => {
    if (open) {
      setConfig(loadEmpyreanDMConfig());
      dragonBond.checkDecay();
    }
  }, [open]);

  const gmGuides = useGMGuides();
  const { enabledContent, activeGuideIds } = gmGuides;
  const { themeId: chatThemeId, setTheme: setChatTheme } = useDMChatTheme();
  const { whisperTrayEnabled, setWhisperTrayEnabled } = useWhisperTrayEnabled();
  const narrator = useNarrator();
  const spotify = useSpotify();
  const { responseMode, setResponseMode } = useResponseMode();

  // Auto-sync hook
  const autoSync = useDmAutoSync({
    onHPChange: autoSyncCallbacks?.onHPChange ?? NOOP_TWO_ARG,
    onAddXP: autoSyncCallbacks?.onAddXP ?? NOOP_TWO_ARG,
    onGoldChange: autoSyncCallbacks?.onGoldChange ?? NOOP,
    onConditionChange: autoSyncCallbacks?.onConditionChange ?? NOOP_TWO_ARG,
    onRestOccurred: autoSyncCallbacks?.onRestOccurred ?? NOOP,
    onMapUpdate: NOOP_TWO_ARG,
    getCurrentHP: autoSyncCallbacks?.getCurrentHP ?? NOOP_RETURN_ZERO,
    getCurrentGold: autoSyncCallbacks?.getCurrentGold ?? NOOP_RETURN_ZERO,
    getCurrentMarkers: useCallback(() => [], []),
    getGridSize: useCallback(() => ({ cols: 10, rows: 10 } as any), []),
  });

  const dragonBond = useDragonBond({
    dragonName: config?.dragonName || '',
    characterName,
  });

  const bondValue = dragonBond.bondState.bond;
  const maxBurnout = bondValue >= 76 ? 9 : bondValue >= 51 ? 7 : bondValue >= 26 ? 5 : 4;

  const dmPersonaPrompt = useMemo(() => {
    if (!config) return undefined;
    const bs = dragonBond.bondState;
    const recentDragonChatSummaryRaw = getScopedItem(DRAGON_CHAT_SUMMARY_KEY);
    let persona = buildEmpyreanDMPersona(
      config.selectedLoreGuides,
      config.selectedToneGuides,
      config.selectedSessionTemplate,
      config.characterName || characterName,
      config.dragonName,
      config.signetType,
      config.yearAtBasgiath,
      config.campaignFocus,
      dragonNotes,
      bs.bond,
      getBondDescriptor(bs.bond),
      getTrustDescriptor(bs.trust),
      bs.mood,
      recentDragonChatSummaryRaw?.trim() ? recentDragonChatSummaryRaw : undefined,
      bs.memories.map(m => m.text),
    );
    return persona;
  }, [config, characterName, dragonNotes, dragonBond.bondState, dragonBond.bondState.totalChatExchanges]);

  const [trackingCampaignId, setTrackingCampaignId] = useState<string | null>(null);
  const gameState = useDMGameState(trackingCampaignId);
  const worldStatePrompt = useMemo(() => buildMemoryAnchorsPrompt(gameState.gameState), [gameState.gameState]);


  const oocDmChat = useOocDmChat({
    characterContext,
    campaignSummary: null,
    customGuidesContent: enabledContent,
    campaignType: 'empyrean',
    selectedModel,
    storageKeySuffix: '-empyrean',
  });

  const {
    messages,
    isLoading,
    isSummarizing,
    campaignSummary,
    updateCampaignSummary,
    sendMessage,
    voiceNPC,
    startNpcScene,
    stopNpcScene,
    submitNpcInterjection,
    npcSceneConfig,
    clearMessages,
    cancelRequest,
    editMessage,
    deleteMessage,
    regenerateMessage,
    loadCampaign,
    activeCampaignId,
    setActiveCampaignId,
    newGame,
  } = useAIDM({
    characterContext,
    customGuidesContent: (enabledContent || '') + oocDmChat.activeDirectives,
    dmPersonaPrompt,
    responseModePrompt: resolveResponseModePrompt(responseMode),
    selectedModel,
    worldStatePrompt,
    sessionStorageKey: EMPYREAN_SESSION_KEY,
    summarizeStorageKey: EMPYREAN_SUMMARY_KEY,
    onMessageComplete: (content: string) => {
      if (autoSync.autoSyncEnabled) {
        autoSync.extractAndApply(content, characterContext);
      }
      spotify.playMoodForText(content);

      // Extract bond strain events
      const strainMatch = content.match(/<!--BOND_STRAIN:(.+?)-->/);
      if (strainMatch) {
        dragonBond.processBondStrain(strainMatch[1]);
        toast('Dragon bond strained: ' + strainMatch[1], { icon: '💔' });
      }

      // Extract dragon memory events
      const memoryMatch = content.match(/<!--DRAGON_MEMORY:(.+?)-->/);
      if (memoryMatch) {
        dragonBond.addNarrativeMemory(memoryMatch[1]);
        toast('Dragon remembers: ' + memoryMatch[1], { icon: '🐉' });
      }

      // Extract bond growth events
      const bondGrowthMatch = content.match(/<!--BOND_GROWTH:(.+?)-->/);
      if (bondGrowthMatch) {
        dragonBond.processBondGrowth(bondGrowthMatch[1]);
        toast('Bond deepens: ' + bondGrowthMatch[1], { icon: '🐉' });
      }

      // Extract burnout tick events
      const burnoutTickMatch = content.match(/<!--BURNOUT_TICK:(.+?)-->/);
      if (burnoutTickMatch) {
        const nextBurnout = Math.min((burnoutLevelRef.current ?? 0) + 1, maxBurnout);
        setBurnoutLevel(nextBurnout);
        toast('Signet strain: ' + burnoutTickMatch[1], { icon: '🔥' });
      }

      // Extract dragon whispers from parsed whispers
      const parsed = parseWhispers(content);
      const dragonNameNormalized = config?.dragonName?.toLowerCase().trim();
      const dragonWhispers = parsed.whispers
        .filter(w => w.type === 'whisper' && dragonNameNormalized && w.target?.toLowerCase().trim() === dragonNameNormalized);

      dragonWhispers.forEach(w => {
        dragonBond.addDragonMessage(w.content);

        // Send dragon bond Telegram notification (non-blocking)
        sendTelegramNotification({
          type: 'dragon_message',
          title: `${config?.dragonName} whispers...`,
          body: w.content.length > 200
            ? w.content.substring(0, 200) + '…'
            : w.content,
          dragonName: config?.dragonName || 'Dragon',
          mode: 'empyrean',
        });
      });

      // Track combat for bond building + send Telegram combat alert
      if (content.toLowerCase().includes('initiative') || content.toLowerCase().includes('combat begins') || content.match(/<!--SITUATION:combat-->/)) {
        dragonBond.processCombatBond();

        // Send combat Telegram notification (non-blocking)
        sendTelegramNotification({
          type: 'combat_start',
          title: '🗡️ Combat Has Begun!',
          body: 'Your DM has initiated combat. Roll for initiative!',
          mode: 'empyrean',
  });

      }
    },
    onQuestExtracted: (quests) => {
      for (const q of quests) {
        gameState.setQuestFlag(q.key, q.status, q.notes);
      }
    },
  });

  const npcSceneSessionConfig = useMemo(() => ({
    active: true,
    mode: 'shared' as const,
    currentRoundId: '',
    campaignSummary: campaignSummary,
    isGenerating: false,
    campaignType: 'empyrean' as const,
  }), [campaignSummary]);

  // Register Oracle quest callback so OracleDrawer can save quests to game state
  const drawerContext = usePromptDrawers();
  useEffect(() => {
    drawerContext?.registerOracleQuestCallback?.((quests) => {
      for (const q of quests) {
        gameState.setQuestFlag(q.key, q.status, q.notes);
      }
    });
    return () => { drawerContext?.registerOracleQuestCallback?.(null); };
  }, [gameState.setQuestFlag]);

  // Sync tracking campaign id with active campaign id from useAIDM
  useEffect(() => {
    setTrackingCampaignId(activeCampaignId);
  }, [activeCampaignId]);

  // Dragon narrative reaction: auto-trigger dragon chat response after each DM message
  const lastDragonReactionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!config?.dragonName || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'assistant') return;
    const msgId = lastMsg.content.substring(0, 50);
    if (msgId === lastDragonReactionIdRef.current) return;
    lastDragonReactionIdRef.current = msgId;

    const bs = dragonBond.bondState;
    const dragonPrompt = buildDragonChatPrompt(
      config.dragonName,
      characterName,
      bs.trust,
      bs.mood as any,
      bs.memories || [],
      dragonNotes,
      bs.speechHabits,
      [lastMsg.content],
      bs.bond,
      bs.riderEmotionalLog,
    );

    const reactionPrompt = dragonPrompt + `\n\n## NARRATIVE REACTION MODE\nThe DM just narrated new events. You experienced this through the bond — you felt your rider's emotions, sensed the danger or calm, witnessed what happened through shared perception.\n\nReact naturally as the dragon would. This might be:\n- A warning about something you noticed\n- An emotional reaction to what happened\n- A comment on an NPC\n- Tactical input about a threat\n- A feeling shared through the bond\n- Or silence, if nothing warrants a response (respond with exactly "SILENCE" and nothing else)\n\nDo NOT summarize the narrative. React to it. Keep your response consistent with your current trust level and mood. Use your personality profile as the sole guide for your voice and temperament.`;

    const timer = setTimeout(async () => {
      try {
        const token = await getAuthToken();
        const chatRaw = getScopedItem(DRAGON_CHAT_KEY);
        let chatMessages: Array<{ role: string; content: string }> = [];
        try {
          if (chatRaw) {
            const parsed = JSON.parse(chatRaw);
            chatMessages = Array.isArray(parsed) ? parsed : (parsed.messages || []);
          }
        } catch { /* ignore */ }

        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: [
              ...chatMessages.slice(-20).map((m: any) => ({ role: m.role, content: m.content })),
              { role: 'user', content: '[The bond flares with new sensation — events unfold in the world around you.]' },
            ],
            systemPromptOverride: reactionPrompt,
            model: 'google/gemini-2.5-flash',
            maxTokens: 500,
          }),
        });

        if (!resp.ok || !resp.body) return;

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = '';
        let assistantContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });
          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) assistantContent += delta;
            } catch { /* skip */ }
          }
        }

        if (!assistantContent.trim() || assistantContent.trim().toUpperCase() === 'SILENCE') return;

        const dragonMsg = { role: 'assistant', content: assistantContent.trim() };
        const updatedChat = [...chatMessages, dragonMsg];
        setScopedItem(DRAGON_CHAT_KEY, JSON.stringify({ messages: updatedChat }));

        const moodMatch = assistantContent.match(/<!--DRAGON_MOOD:(\w+)-->/);
        if (moodMatch && ['calm', 'alert', 'protective', 'distant', 'ancestral', 'playful'].includes(moodMatch[1])) {
          // Update mood in bond state
        }

        const memoryMatches = [...assistantContent.matchAll(/<!--DRAGON_MEMORY:(.+?)-->/g)];
        for (const match of memoryMatches) {
          dragonBond.addNarrativeMemory(match[1]);
        }

        dragonBond.addDragonMessage(assistantContent.trim());
      } catch (err) {
        console.warn('[EmpyreanDM] Dragon narrative reaction failed:', err);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [messages, config?.dragonName, characterName, dragonNotes, dragonBond.bondState]);

  // Campaign sessions — uses 'empyrean' mode to namespace separately from regular DM saves
  const {
    sessions: campaignSessions,
    isLoading: sessionsLoading,
    isSignedIn,
    saveSession: saveCampaignSession,
    deleteSession: deleteCampaignSession,
    renameSession: renameCampaignSession,
    refreshSessions,
  } = useCampaignSessions('empyrean' as any);

  const handleLoadCampaign = useCallback((session: CampaignSession) => {
    loadCampaign(session.messages, session.campaign_summary, session.id, session.gm_guide_ids);
    setShowSaves(false);
    setShowToolsDrawer(false);
    toast.success(`Loaded: ${session.name}`);
  }, [loadCampaign]);

  const handleSaveCampaign = useCallback(async (
    name: string,
    msgs: import('@/components/oracle/types').Message[],
    summary: string | null,
    existingId?: string,
  ) => {
    return saveCampaignSession(name, msgs, summary, existingId);
  }, [saveCampaignSession]);

  // Message action states
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  const handleStartEdit = useCallback((id: string, content: string) => {
    setEditingId(id);
    setEditContent(content);
    setActiveActionId(null);
  }, []);

  const handleSaveEdit = useCallback((id: string) => {
    if (editContent.trim()) {
      editMessage(id, editContent.trim());
    }
    setEditingId(null);
    setEditContent('');
  }, [editContent, editMessage]);

  const handleDelete = useCallback((id: string) => {
    deleteMessage(id);
    setActiveActionId(null);
  }, [deleteMessage]);

  const handleRegenerate = useCallback((id: string) => {
    regenerateMessage(id);
    setActiveActionId(null);
  }, [regenerateMessage]);

  // Auto-send initial message from prompt library
  useEffect(() => {
    if (open && initialMessage && !initialSent && messages.length === 0) {
      const timer = setTimeout(() => {
        sendMessage(initialMessage);
        setInitialSent(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, initialMessage, initialSent, messages.length, sendMessage]);

  // Reset initialSent when screen closes
  useEffect(() => {
    if (!open) setInitialSent(false);
  }, [open]);

  // Parse burnout tags from assistant messages
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant' && lastMsg.content) {
      const match = lastMsg.content.match(/<!--BURNOUT:(\d+)-->/);
      if (match) {
        const level = Math.min(maxBurnout, Math.max(0, parseInt(match[1], 10)));
        setBurnoutLevel(level);
      }
      const situationMatch = lastMsg.content.match(/<!--SITUATION:(\w+)-->/);
      if (situationMatch) {
        setCurrentSituation(situationMatch[1]);
      }
    }
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isLoading) return;
    // Support multiple @NPC tags: @NPC1 @NPC2 message
    const multiNpcMatch = inputValue.trim().match(/^((?:@\S+\s+)+)(.+)$/s);
    if (multiNpcMatch && voiceNPC) {
      const npcNames = [...multiNpcMatch[1].matchAll(/@(\S+)/g)].map(m => m[1]);
      const message = multiNpcMatch[2];
      if (npcNames.length > 0 && message.trim()) {
        voiceNPC(npcNames.length === 1 ? npcNames[0] : npcNames, message);
      } else {
        sendMessage(inputValue.trim());
      }
    } else {
      sendMessage(inputValue.trim());
    }
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [inputValue, isLoading, sendMessage, voiceNPC]);

  const handlePromptSelect = useCallback((prompt: string) => {
    const filled = prompt.replace(/\[Character Name\]/g, characterName);
    setInputValue(filled);
    setShowPrompts(false);
    textareaRef.current?.focus();
  }, [characterName]);

  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    saveEmpyreanModel(modelId);
    toast.success(`Model: ${DM_MODELS.find(m => m.id === modelId)?.label ?? modelId}`);
  }, []);

  const handleNavTabChange = useCallback((tab: DMNavTab) => {
    if (tab === 'oracle') {
      dragonBond.markChatOpened();
      setShowDragonChat(true);
      return;
    }
    if (tab === 'prompts') {
      setShowPrompts(true);
      return;
    }
    if (tab === 'actions') {
      setShowCharacterActions(true);
      return;
    }
    if (tab === 'settings') {
      setShowToolsDrawer(true);
      return;
    }
    if (tab === 'afk') {
      setShowAutopilotGuide(true);
      return;
    }
    // Dice and other tabs toggle the full-screen content panel
    setActiveNavTab(prev => prev === tab ? null : tab);
  }, [dragonBond]);

  const handleDragonNotesChange = useCallback((notes: string) => {
    setDragonNotes(notes);
    saveDragonNotes(notes);
  }, []);

  const handleUsePrompt = useCallback((prompt: string) => {
    if (!isLoading) {
      sendMessage(prompt);
      setActiveNavTab(null);
      setNavExpanded(false);
    }
  }, [isLoading, sendMessage]);

  const lastAssistantMsg = useMemo(() => {
    const last = [...messages].reverse().find(m => m.role === 'assistant');
    return last?.content ?? null;
  }, [messages]);

  const autopilot = useEmpyreanAutopilot({
    enabled: true,
    characterName,
    dragonName: config?.dragonName || '',
    delaySeconds: 8,
    onSendAction: handleUsePrompt,
    lastAssistantMessage: lastAssistantMsg,
    isLoading,
  });

  const handleNewCampaign = useCallback(() => {
    newGame();
    setActiveTemplate(null);
    setBurnoutLevel(0);
    setCurrentSituation('exploration');
    setShowToolsDrawer(false);
    if (autopilot.isAutopilotActive) autopilot.takeControl();
    setRecapExpanded(false);
  }, [newGame, autopilot]);

  const handleCampaignBuilderComplete = useCallback(async (data: CampaignBuildData) => {
    setShowCampaignBuilder(false);
    handleNewCampaign();
    setTimeout(() => {
      updateCampaignSummary(data.campaignSummary);
      gmGuides.addGuide(`📖 ${data.campaignName}`, data.gmGuide);
      for (const anchor of data.memoryAnchors) {
        gameState.addMemoryAnchor({ category: anchor.category, key: anchor.key, value: anchor.value });
      }
      setTimeout(() => {
        sendMessage('Begin the adventure. Here is the opening scene to set the stage:\n\n' + data.openingScene);
      }, 200);
    }, 100);
  }, [handleNewCampaign, updateCampaignSummary, gmGuides, gameState, sendMessage]);

  const handleCampaignSummaryChange = useCallback((summary: string) => {
    updateCampaignSummary(summary);
  }, [updateCampaignSummary]);

  const handleSessionTemplate = useCallback((template: typeof EMPYREAN_SESSION_GUIDES[0]) => {
    const msg = `Start a new session using this structure: ${template.name}. My character is ${characterName}. Set the scene and begin.`;
    sendMessage(msg);
    setActiveTemplate(template.name);
    setShowPrompts(false);
  }, [characterName, sendMessage]);

  const handleRandomPrompt = useCallback(() => {
    const randomPrompt = empyreanPrompts[Math.floor(Math.random() * empyreanPrompts.length)];
    const filled = randomPrompt.prompt.replace(/\[Character Name\]/g, characterName);
    sendMessage(filled);
    setShowPrompts(false);
  }, [characterName, sendMessage]);
  const npcMention = useNPCMentionState(messages, textareaRef, setInputValue, inputValue);

  // Auto-resize textarea
  const handleTextareaInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    npcMention.trackCursor();
  }, [npcMention.trackCursor]);

  const groupedPrompts = useMemo(() => groupPromptsByCategory(empyreanPrompts), []);

  if (!open) return null;

  // No config — show placeholder
  if (!config) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-gradient-to-b from-[#1a0a2e] via-background to-background gap-4 px-6">
        <span className="text-5xl">🐉</span>
        <h2 className="text-xl font-cinzel font-bold text-purple-300 text-center">
          No Empyrean Campaign Configured
        </h2>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Run the Campaign Setup wizard first to configure your rider, lore guides, and campaign focus.
        </p>
        <Button
          variant="outline"
          onClick={onClose}
          className="mt-4 border-purple-500/30 text-purple-300"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-[#1a0a2e] via-background to-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-purple-500/20 bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-purple-300" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-cinzel font-bold text-purple-300">🐉</h2>
              <CampaignDropdown
                sessions={campaignSessions}
                activeCampaignId={activeCampaignId}
                isSignedIn={isSignedIn}
                isLoading={sessionsLoading}
                onNewGame={() => setShowCampaignBuilder(true)}
                onLoadCampaign={handleLoadCampaign}
                onRefresh={refreshSessions}
              />
              {activeTemplate && (
                <span className="text-[10px] font-sans font-medium px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300">
                  {activeTemplate.includes('Heist') ? '🎭' : activeTemplate.includes('Trial') ? '⚖️' : '🏕️'} {activeTemplate}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-2">
              <span className="truncate max-w-[140px]">{characterName}{config.dragonName ? ` & ${config.dragonName}` : ''}</span>
              {config.signetType && <BurnoutIndicator level={burnoutLevel} maxBurnout={maxBurnout} />}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Narrator controls */}
          {narrator.hasTTSKey && (
            <>
              <button
                onClick={() => {
                  if (narrator.isPlaying) {
                    narrator.stop();
                  }
                }}
                className={cn(
                  "p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center",
                  narrator.isPlaying
                    ? "bg-purple-900/40 hover:bg-purple-900/60"
                    : "hover:bg-muted/50"
                )}
                title={narrator.isPlaying ? "Stop narration" : "Narrator available"}
              >
                {narrator.isLoading ? (
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                ) : narrator.isPlaying ? (
                  <VolumeX className="w-5 h-5 text-purple-400" />
                ) : (
                  <Volume2 className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
              <NarrationSpeedPopover iconSize="w-5 h-5" />
            </>
          )}
          <button
            onClick={() => setShowToolsDrawer(true)}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <BookOpen className="w-5 h-5 text-purple-400" />
          </button>
        </div>
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
            className="flex items-center justify-center gap-2 px-3 py-1.5 bg-purple-950/40 border-t border-purple-500/20"
          >
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-[11px] text-purple-300/80 font-cinzel">Auto-Sync extracting changes...</span>
            <Zap className="w-3 h-3 text-purple-400 animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summarizing indicator */}
      {isSummarizing && (
        <div className="px-4 py-1.5 bg-purple-500/10 border-b border-purple-500/20 flex items-center gap-2 text-xs text-purple-300">
          <Loader2 className="w-3 h-3 animate-spin" />
          Updating campaign summary...
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-60">
            <span className="text-4xl">⚔️</span>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Your Empyrean campaign awaits. Send a message or pick a prompt to begin.
            </p>
          </div>
        )}

        {messages.length > 0 && campaignSummary && (
          <div className="mb-4">
            <button
              onClick={() => setRecapExpanded(prev => !prev)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-950/40 border border-purple-500/15 hover:border-purple-500/30 transition-all"
            >
              <span className="text-sm">📜</span>
              <span className="text-xs font-cinzel text-purple-300/80 flex-1 text-left">Previously in your campaign...</span>
              <ChevronDown className={cn(
                "w-3.5 h-3.5 text-purple-400/50 transition-transform duration-200",
                recapExpanded && "rotate-180"
              )} />
            </button>
            {recapExpanded && (
              <div className="mt-1.5 px-3 py-3 rounded-xl bg-purple-950/20 border border-purple-500/10">
                <div className="text-xs text-purple-200/70 leading-relaxed whitespace-pre-wrap">
                  {campaignSummary}
                </div>
              </div>
            )}
          </div>
        )}

        {messages.map(message => {
          const isUser = message.role === 'user';
          const isAssistant = message.role === 'assistant';
          const showActions = activeActionId === message.id;
          const isEditing = editingId === message.id;

          return (
            <div
              key={message.id}
              className={cn(
                'mb-3 flex',
                isUser ? 'justify-end' : 'justify-start',
              )}
            >
              <div className="max-w-[85%] group relative">
                {/* Action toggle */}
                {!isEditing && !isLoading && (
                  <button
                    onClick={() => setActiveActionId(showActions ? null : message.id)}
                    className={cn(
                      'absolute top-1.5 z-10 w-6 h-6 rounded-full flex items-center justify-center',
                      'bg-purple-500/20 hover:bg-purple-500/40 text-purple-300/60 hover:text-purple-300 transition-all',
                      'opacity-0 group-hover:opacity-100',
                      showActions && 'opacity-100',
                      isUser ? 'left-1.5' : 'right-1.5',
                    )}
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Action bar */}
                {showActions && (
                  <div className={cn(
                    'flex items-center gap-1 mb-1',
                    isUser ? 'justify-end' : 'justify-start',
                  )}>
                    {isUser && (
                      <>
                        <button
                          onClick={() => handleStartEdit(message.id, message.content)}
                          className="px-2 py-1 rounded-lg text-xs flex items-center gap-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 transition-colors"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(message.id)}
                          className="px-2 py-1 rounded-lg text-xs flex items-center gap-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </>
                    )}
                    {isAssistant && (
                      <>
                        <button
                          onClick={() => handleCopy(message.id, message.content)}
                          className="px-2 py-1 rounded-lg text-xs flex items-center gap-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 transition-colors"
                        >
                          {copiedId === message.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedId === message.id ? 'Copied' : 'Copy'}
                        </button>
                        <button
                          onClick={() => handleRegenerate(message.id)}
                          className="px-2 py-1 rounded-lg text-xs flex items-center gap-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" /> Regen
                        </button>
                        <button
                          onClick={() => handleDelete(message.id)}
                          className="px-2 py-1 rounded-lg text-xs flex items-center gap-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={cn(
                    'rounded-2xl px-3.5 py-2.5',
                    isUser
                      ? 'bg-purple-600/30 border border-purple-500/30 text-foreground'
                      : 'bg-card/60 border border-border/30 text-foreground',
                  )}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        className="w-full bg-background/50 border border-purple-500/30 rounded-lg p-2 text-sm text-foreground resize-none min-h-[60px]"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setEditingId(null); setEditContent(''); }}
                          className="h-7 text-xs text-muted-foreground"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(message.id)}
                          className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : isAssistant ? (() => {
                    const parsed = parseWhispers(message.content || '...');
                    const whispers = message.whispers || parsed.whispers;
                    const cleanNarrative = stripAllMetaTags(parsed.narrative);
                    return (
                      <>
                        {message.senderName && message.senderName !== 'DM' && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <MessageCircle className="w-3 h-3 text-amber-500" />
                            <p className="text-[11px] font-semibold text-amber-300">{message.senderName}</p>
                            <span className="text-[9px] italic text-amber-400/50">NPC</span>
                          </div>
                        )}
                        <div className="text-sm prose prose-invert prose-sm max-w-none break-words overflow-wrap-anywhere">
                          <ReactMarkdown
                            rehypePlugins={[rehypeRaw]}
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              strong: ({ children }) => <strong className="text-purple-300 font-semibold">{children}</strong>,
                              em: ({ children }) => <em className="text-amber-300/90">{children}</em>,
                              ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-2 border-purple-500/40 pl-3 italic text-muted-foreground my-2">
                                  {children}
                                </blockquote>
                              ),
                            }}
                          >
                            {cleanNarrative}
                          </ReactMarkdown>
                        </div>
                        {whisperTrayEnabled && whispers.length > 0 && (
                          <WhisperTray whispers={whispers} />
                        )}
                      </>
                    );
                  })() : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Streaming indicator */}
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="mb-3 flex justify-start">
            <div className="bg-card/60 border border-border/30 rounded-2xl px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Navigation */}
      <DMBottomNav
        activeTab={activeNavTab}
        onTabChange={handleNavTabChange}
        isExpanded={navExpanded}
        onExpandedChange={setNavExpanded}
        disabled={isLoading}
        oracleLabel={config?.dragonName ? config.dragonName.toUpperCase() : 'DRAGON'}
        oracleColor={(() => {
          const mood = dragonBond.bondState.mood;
          if (mood === 'alert') return 'text-amber-400';
          if (mood === 'protective') return 'text-blue-400';
          if (mood === 'distant') return 'text-slate-500';
          if (mood === 'ancestral') return 'text-purple-400';
          if (mood === 'playful') return 'text-emerald-400';
          return 'text-cyan-400';
        })()}
        oracleActiveBg={(() => {
          const mood = dragonBond.bondState.mood;
          if (mood === 'alert') return 'bg-amber-500/10';
          if (mood === 'protective') return 'bg-blue-500/10';
          if (mood === 'distant') return 'bg-slate-500/10';
          if (mood === 'ancestral') return 'bg-purple-500/10';
          if (mood === 'playful') return 'bg-emerald-500/10';
          return 'bg-cyan-500/10';
        })()}
        oracleCount={dragonBond.bondState.unreadDragonMessages.length}
        diceContent={activeNavTab === 'dice' ? (
          <DMDiceRoller
            characterContext={characterContext}
            onRollResult={handleUsePrompt}
            disabled={isLoading}
          />
        ) : undefined}
      />

      {/* Autopilot decision cards */}
      {autopilot.isAutopilotActive && autopilot.currentChoices.length > 0 && (
        <div className="shrink-0 px-3 py-2.5 bg-purple-950/40 border-t border-purple-500/15">
          <p className="text-[10px] text-purple-300/50 font-cinzel mb-1.5">Your rider would...</p>
          <div className="space-y-1.5">
            {autopilot.currentChoices.map(choice => (
              <button
                key={choice.id}
                onClick={() => autopilot.selectChoice(choice.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-xs transition-all border',
                  autopilot.selectedChoiceId === choice.id
                    ? 'border-purple-400/50 bg-purple-500/20 text-purple-200'
                    : 'border-purple-500/10 bg-purple-500/5 text-purple-300/70 hover:border-purple-500/30',
                )}
              >
                <span className="line-clamp-2">{choice.label}</span>
                {autopilot.selectedChoiceId === choice.id && (
                  <span className="text-[9px] text-purple-400/60 mt-0.5 block">← Auto-selected</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Autopilot control bar */}
      {autopilot.isAutopilotActive && (
        <div className="shrink-0 px-3 py-2 bg-purple-950/60 border-t border-purple-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-xs font-cinzel text-purple-300">Autopilot</span>
            {autopilot.countdown > 0 && !autopilot.isPaused && (
              <span className="text-xs text-purple-300/60">Acting in {autopilot.countdown}s</span>
            )}
            {autopilot.isPaused && (
              <span className="text-xs text-amber-300/60">Paused</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={autopilot.isPaused ? autopilot.resumeAutopilot : autopilot.pauseAutopilot}
              className="text-[11px] px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors"
            >
              {autopilot.isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={autopilot.takeControl}
              className="text-[11px] px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
            >
              Take Control
            </button>
          </div>
        </div>
      )}

      {/* Contextual Actions — always visible when messages exist */}
      {messages.length > 0 && config && (
        <EmpyreanContextualActions
          situation={currentSituation}
          characterName={config?.characterName || characterName}
          dragonName={config?.dragonName || ''}
          signetType={config?.signetType || ''}
          onAction={(prompt) => {
            if (!isLoading) {
              sendMessage(prompt);
              setActiveNavTab(null);
            }
          }}
          disabled={isLoading}
        />
      )}

        {npcSceneConfig?.active && (
          <div className="flex items-center justify-center gap-2 py-1.5 bg-cyan-950/30 border-t border-cyan-500/20">
            <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
            <span className="text-xs text-cyan-400/70">
              NPC scene ({npcSceneConfig.messageCount}/{npcSceneConfig.maxMessages})
            </span>
            <button
              onClick={stopNpcScene}
              className="ml-2 px-2 py-0.5 rounded-md border border-red-500/30 bg-red-900/20 hover:bg-red-900/40 text-red-300 text-[11px] transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              Stop
            </button>
          </div>
        )}

      {/* Input bar — sits above the fixed DMBottomNav (~54px collapsed height) */}
      <div className="shrink-0 border-t border-purple-500/20 bg-background/90 backdrop-blur-sm px-3 pt-2.5 pb-[60px]">
        <div className="relative flex items-end gap-2">
          {npcMention.showAutocomplete && (
            <NPCAutocomplete
              names={npcMention.suggestions}
              onSelect={npcMention.selectNPC}
              activeIndex={npcMention.activeIndex}
            />
          )}
          <button
            onClick={() => setShowPrompts(true)}
            className="p-2.5 rounded-lg hover:bg-purple-500/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
          >
            <BookOpen className="w-5 h-5 text-purple-400" />
          </button>

          <textarea
            ref={npcSceneConfig?.active ? undefined : textareaRef}
            value={npcSceneConfig?.active ? npcInterjectionText : inputValue}
            onChange={npcSceneConfig?.active ? (e) => setNpcInterjectionText(e.target.value) : handleTextareaInput}
            onSelect={npcSceneConfig?.active ? undefined : npcMention.trackCursor}
            placeholder={npcSceneConfig?.active ? "Speak up — the NPCs will react to you..." : "What does your rider do... (@NPC to talk to an NPC)"}
            rows={1}
            className="flex-1 bg-card/30 border border-purple-500/20 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-purple-400 max-h-[120px] min-h-[44px]"
            onKeyDown={e => {
              if (!npcSceneConfig?.active && npcMention.handleAutocompleteKeyDown(e)) return;
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (npcSceneConfig?.active) {
                  if (npcInterjectionText.trim()) {
                    submitNpcInterjection(npcInterjectionText.trim());
                    setNpcInterjectionText('');
                  }
                } else {
                  handleSend();
                }
              }
            }}
          />

          {isLoading ? (
            npcSceneConfig?.active ? (
              <button
                onClick={() => {
                  if (npcInterjectionText.trim()) {
                    submitNpcInterjection(npcInterjectionText.trim());
                    setNpcInterjectionText('');
                  }
                }}
                disabled={!npcInterjectionText.trim()}
                className="p-2.5 rounded-xl bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
                style={{ touchAction: 'manipulation' }}
              >
                <Send className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={cancelRequest}
                className="p-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
              >
                <X className="w-5 h-5 text-red-400" />
              </button>
            )
          ) : (
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className={cn(
                'p-2.5 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0',
                inputValue.trim()
                  ? 'bg-purple-600 hover:bg-purple-500 text-white'
                  : 'bg-muted/30 text-muted-foreground',
              )}
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* DMToolsDrawer */}
      <DMToolsDrawer
        open={showToolsDrawer}
        onOpenChange={setShowToolsDrawer}
        onNewCampaign={handleNewCampaign}
        
        onSaves={() => setShowSaves(true)}
        onGuides={() => setShowGuides(true)}
        onWorldState={() => setShowWorldState(prev => !prev)}
        onClearChat={clearMessages}
        autoSyncEnabled={autoSync.autoSyncEnabled}
        onToggleAutoSync={autoSync.toggleAutoSync}
        isExtracting={autoSync.isExtracting}
        showAutoSync={!!autoSyncCallbacks}
        guidesCount={gmGuides.guides.filter(g => g.enabled).length}
        anchorsCount={gameState.gameState.memory_anchors.length}
        onEmpyreanPrompts={() => setShowPrompts(true)}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        chatThemeId={chatThemeId}
        onChatThemeChange={setChatTheme}
        whisperTrayEnabled={whisperTrayEnabled}
        onWhisperTrayEnabledChange={setWhisperTrayEnabled}
        empyreanConfig={config ? { campaignFocus: config.campaignFocus, dragonName: config.dragonName, signetType: config.signetType, yearAtBasgiath: config.yearAtBasgiath } : null}
        dragonNotes={dragonNotes}
        onDragonNotesChange={handleDragonNotesChange}
        onReconfigureEmpyrean={onClose}
        onResetBurnout={() => { setBurnoutLevel(0); toast.success('Signet burnout reset.'); }}
        onNpcScene={() => setShowNpcScene(true)}
        onOocChat={() => setShowOocChat(true)}
        oocDirectiveCount={oocDmChat.directiveCount}
      />

      {/* Campaign Sessions Manager */}
      {showSaves && (
        <div className="fixed inset-0 z-[66] bg-background flex flex-col">
          <CampaignSessionsManager
            onBack={() => setShowSaves(false)}
            sessions={campaignSessions}
            isLoading={sessionsLoading}
            isSignedIn={isSignedIn}
            currentMessages={messages}
            currentSummary={campaignSummary}
            activeCampaignId={activeCampaignId}
            onSave={handleSaveCampaign}
            onLoad={handleLoadCampaign}
            onDelete={deleteCampaignSession}
            onRename={renameCampaignSession}
          />
        </div>
      )}

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

      {/* World State Overlay */}
      {showWorldState && (
        <div className="fixed inset-0 z-[66] bg-background flex flex-col">
          <WorldStatePanel
            gameState={gameState.gameState}
            onAddAnchor={gameState.addMemoryAnchor}
            onRemoveAnchor={gameState.removeMemoryAnchor}
            onSetQuestFlag={gameState.setQuestFlag}
            onClose={() => setShowWorldState(false)}
          />
        </div>
      )}

      <PartyDMQuickActions
        open={showCharacterActions}
        onOpenChange={setShowCharacterActions}
        characterContext={characterContext}
        characterName={characterName}
        onUsePrompt={handleUsePrompt}
      />

      <EmpyreanAutopilotGuide
        open={showAutopilotGuide}
        onOpenChange={setShowAutopilotGuide}
        characterName={characterName}
        dragonName={config?.dragonName || ''}
        onEnableAutopilot={() => {
          autopilot.toggleAutopilot();
          setShowAutopilotGuide(false);
          toast.success('Autopilot enabled! Watch your rider act.');
        }}
      />

      <Sheet open={showPrompts} onOpenChange={setShowPrompts}>
        <SheetContent side="bottom" className="z-[65] border-purple-500/20 bg-background max-h-[75vh]">
          <SheetHeader>
            <SheetTitle className="font-cinzel text-purple-300">Empyrean Prompts</SheetTitle>
          </SheetHeader>
           <ScrollArea className="h-[55vh] mt-3">
            <div className="space-y-5 pr-2 pb-4">
              {/* Session Templates */}
              <div className="space-y-2">
                <h3 className="text-xs font-cinzel font-semibold text-amber-400 uppercase tracking-wider">
                  Session Templates
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {EMPYREAN_SESSION_GUIDES.map(t => {
                    const emoji = t.name.includes('Heist') ? '🎭' : t.name.includes('Trial') ? '⚖️' : '🏕️';
                    return (
                      <button
                        key={t.id}
                        onClick={() => handleSessionTemplate(t)}
                        className="w-full text-left p-3 rounded-xl border border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10 transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl shrink-0">{emoji}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-cinzel font-semibold text-foreground">{t.name}</p>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">{t.description}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Random Scene */}
              <button
                onClick={handleRandomPrompt}
                className="w-full flex items-center gap-2.5 p-3 rounded-xl border border-purple-500/25 bg-purple-500/5 hover:bg-purple-500/10 transition-all"
              >
                <Shuffle className="w-5 h-5 text-purple-400 shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">Random Empyrean Scene</p>
                  <p className="text-[11px] text-muted-foreground">Pick a random prompt and start immediately</p>
                </div>
              </button>

              {/* Existing category prompts */}
              {Object.entries(groupedPrompts).map(([category, prompts]) => (
                <div key={category} className="space-y-2">
                  <h3 className="text-xs font-cinzel font-semibold text-purple-400 uppercase tracking-wider">
                    {category}
                  </h3>
                  <div className="space-y-1.5">
                    {prompts.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handlePromptSelect(p.prompt)}
                        className="w-full text-left p-2.5 rounded-lg border border-border/30 bg-card/30 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-base shrink-0 mt-0.5">{p.icon}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{p.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{p.description}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <OocDmChat
        open={showOocChat}
        onClose={() => setShowOocChat(false)}
        messages={oocDmChat.messages}
        isLoading={oocDmChat.isLoading}
        onSendMessage={oocDmChat.sendMessage}
        onCancelRequest={oocDmChat.cancelRequest}
        onClearChat={oocDmChat.clearChat}
        pinnedDirectives={oocDmChat.pinnedDirectives}
        onAddPinned={oocDmChat.addPinnedDirective}
        onRemovePinned={oocDmChat.removePinnedDirective}
        onTogglePinned={oocDmChat.togglePinnedDirective}
        onEditPinned={oocDmChat.editPinnedDirective}
        chatDirectives={oocDmChat.chatDirectives}
        directiveCount={oocDmChat.directiveCount}
        onClearAllDirectives={oocDmChat.clearAllDirectives}
        campaignType="empyrean"
      />

      <DragonBondChat
        open={showDragonChat}
        onClose={() => { setShowDragonChat(false); dragonBond.reload(); }}
        characterName={characterName}
        dragonName={config?.dragonName || 'Dragon'}
        dragonNotes={dragonNotes}
        characterContext={characterContext}
        burnoutLevel={burnoutLevel}
        unreadDragonMessages={dragonBond.bondState.unreadDragonMessages}
        currentSituation={currentSituation}
        onDragonNotesChange={handleDragonNotesChange}
        recentNarrative={messages
          .filter(m => m.role === 'assistant')
          .slice(-5)
          .map(m => m.content.length > 500 ? m.content.slice(0, 500) + '…' : m.content)}
        onRequestOpinion={async () => {
          const recentAssistant = messages
            .filter(m => m.role === 'assistant')
            .slice(-3)
            .map(m => m.content.length > 500 ? m.content.slice(0, 500) + '…' : m.content);
          if (recentAssistant.length === 0) return null;
          try {
            const dragon = config?.dragonName || 'Dragon';
            const bs = dragonBond.bondState;
            const opinionPrompt = buildDragonChatPrompt(
              dragon,
              characterName,
              bs.trust,
              bs.mood,
              bs.memories,
              dragonNotes,
              bs.speechHabits,
              recentAssistant,
              bs.bond,
              bs.riderEmotionalLog,
            ) + '\n\nBased on recent events, share ONE unsolicited thought — a warning, an opinion, or a feeling. Under 2 sentences. Do not ask a question.';
            const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`;
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const resp = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({
                messages: [{ role: 'user', content: 'What is on your mind right now?' }],
                systemPromptOverride: opinionPrompt,
                model: 'google/gemini-2.5-flash',
              }),
            });
            if (!resp.ok) return null;
            const data = await resp.json();
            return data?.response || data?.content || null;
          } catch {
            return null;
          }
        }}
      />

      <NpcSceneDialog
        open={showNpcScene}
        onClose={() => setShowNpcScene(false)}
        onStart={(npcs, prompt, max) => { startNpcScene(npcs, prompt, max); }}
        sessionConfig={npcSceneSessionConfig}
        messages={messages as any}
      />

      <AnimatePresence>
        {showCampaignBuilder && (
          <CampaignBuilderChat
            characterName={characterName}
            characterLevel={characterContext.level || 1}
            characterIdentity={{
              race: characterContext.race || undefined,
              gender: characterContext.gender || undefined,
              class: characterContext.characterClass || undefined,
              backstory: characterContext.backstory || undefined,
            }}
            existingGuidesContent={enabledContent}
            onComplete={handleCampaignBuilderComplete}
            onSkip={() => {
              setShowCampaignBuilder(false);
              handleNewCampaign();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
