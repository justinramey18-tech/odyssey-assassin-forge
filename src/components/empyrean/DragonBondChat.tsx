import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { ArrowLeft, Send, Link2, Trash2, Pencil, Check, Loader2, X, Brain, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { toast } from 'sonner';
import { useAIDM } from '@/hooks/use-ai-dm';
import {
  DRAGON_CHAT_KEY,
  DRAGON_CHAT_SUMMARY_KEY,
  loadBondState,
  saveBondState,
  buildDragonChatPrompt,
  computeMoodPressure,
  buildConstrainedMoodOptions,
  getMoodDescriptor,
  getBondDescriptor,
  getTrustDescriptor,
  addMemory,
  removeMemory,
  addTrust,
  reduceTrust,
  detectTrustBreak,
  detectRiderDeclaration,
  classifyRiderEmotion,
  type DragonBondState,
  type DragonMood,
} from '@/lib/dragonBondState';
import type { CharacterContext } from '@/components/oracle/types';

interface DragonBondChatProps {
  open: boolean;
  onClose: () => void;
  characterName: string;
  dragonName: string;
  dragonNotes: string;
  dragonColor?: string;
  characterContext: CharacterContext;
  recentNarrative?: string[];
  burnoutLevel?: number;
  onRequestOpinion?: () => Promise<string | null>;
  unreadDragonMessages?: string[];
  currentSituation?: string;
  onDragonNotesChange?: (notes: string) => void;
}

const BOND_SENSE_RE = /<!--BOND_SENSE:(.+?)-->/g;

function extractBondSense(content: string): string | null {
  const match = content.match(/<!--BOND_SENSE:(.+?)-->/);
  return match ? match[1] : null;
}

function stripDragonTags(content: string): string {
  return content
    .replace(/<!--DRAGON_MOOD:\w+-->/g, '')
    .replace(/<!--DRAGON_MEMORY:.+?-->/g, '')
    .replace(/<!--DRAGON_HABIT:.+?-->/g, '')
    .replace(BOND_SENSE_RE, '')
    .trim();
}

/** Render vision blocks with special styling */
function renderVisionBlocks(text: string): string {
  return text.replace(
    /\*\[vision:\s*(.+?)\]\*/gi,
    '<div class="my-2 rounded-lg bg-purple-950/30 px-3 py-2.5 text-purple-200/70 text-xs italic leading-relaxed">$1</div>',
  );
}

export default function DragonBondChat({
  open,
  onClose,
  characterName,
  dragonName,
  dragonNotes,
  dragonColor,
  characterContext,
  recentNarrative,
  burnoutLevel,
  onRequestOpinion,
  unreadDragonMessages,
  currentSituation,
  onDragonNotesChange,
}: DragonBondChatProps) {
  const [bondState, setBondState] = useState<DragonBondState>(() => loadBondState());
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragonOpening, setDragonOpening] = useState<string | null>(null);
  const [showPersonality, setShowPersonality] = useState(false);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newMemorySource, setNewMemorySource] = useState<'rider-said' | 'campaign' | 'bond-chat'>('rider-said');
  const [confirmClearMemories, setConfirmClearMemories] = useState(false);
  const [editingNotes, setEditingNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const moodDurationRef = useRef<number>(0);
  const validTransitionsRef = useRef<DragonMood[]>([bondState.mood]);
  const recommendedMoodRef = useRef<DragonMood>(bondState.mood);
  // Snapshot of unread dragon messages captured at the moment the chat opens.
  // The parent's markChatOpened() clears the live array immediately on open,
  // so we hold onto this snapshot for display.
  const [unreadSnapshot, setUnreadSnapshot] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setUnreadSnapshot(unreadDragonMessages ?? []);
    } else {
      setUnreadSnapshot([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Recompute system prompt with mood pressure engine
  const dragonSystemPrompt = useMemo(() => {
    const moodResult = computeMoodPressure(
      bondState.mood,
      bondState.trust,
      bondState.riderEmotionalLog || [],
      [...(recentNarrative || []), ...(currentSituation ? [`[current scene: ${currentSituation}]`] : [])],
      burnoutLevel ?? 0,
      moodDurationRef.current,
    );
    validTransitionsRef.current = moodResult.validTransitions;
    recommendedMoodRef.current = moodResult.recommendedMood;

    let prompt = buildDragonChatPrompt(
      dragonName,
      characterName,
      bondState.trust,
      moodResult.recommendedMood,
      bondState.memories,
      dragonNotes,
      bondState.speechHabits,
      recentNarrative,
      bondState.bond,
      bondState.riderEmotionalLog,
    );

    // Replace default mood tag instruction with constrained options
    const moodTagPattern = /After each response, include exactly one mood tag indicating your current emotional state:\s*\n<!--DRAGON_MOOD:calm-->.*?<!--DRAGON_MOOD:playful-->/s;
    const constrainedText = buildConstrainedMoodOptions(moodResult.recommendedMood, moodResult.validTransitions);
    prompt = prompt.replace(moodTagPattern, constrainedText);

    return prompt;
  }, [dragonName, characterName, bondState.trust, bondState.mood, bondState.memories, dragonNotes, bondState.speechHabits, recentNarrative, bondState.bond, bondState.riderEmotionalLog]);

  // Parse tags from new assistant messages
  const handleMessageComplete = useCallback(
    (content: string) => {
      let updated = { ...bondState };

      // Parse mood tag — validate against allowed transitions
      const moodMatch = content.match(/<!--DRAGON_MOOD:(\w+)-->/);
      let finalMood: DragonMood = recommendedMoodRef.current;
      if (moodMatch) {
        const parsedMood = moodMatch[1] as DragonMood;
        const validMoods: DragonMood[] = ['calm', 'alert', 'protective', 'distant', 'ancestral', 'playful'];
        if (validMoods.includes(parsedMood) && validTransitionsRef.current.includes(parsedMood)) {
          finalMood = parsedMood;
        }
      }
      // Track mood duration + notify on change
      if (finalMood === updated.mood) {
        moodDurationRef.current += 1;
      } else {
        moodDurationRef.current = 0;
        const newMoodInfo = getMoodDescriptor(finalMood);
        toast(`${dragonName} feels ${newMoodInfo.label.toLowerCase()} ${newMoodInfo.emoji}`, { duration: 3000 });
      }
      updated = { ...updated, mood: finalMood };

      // Parse memory tags
      const memoryMatches = [...content.matchAll(/<!--DRAGON_MEMORY:(.+?)-->/g)];
      for (const match of memoryMatches) {
        updated = addMemory(updated, match[1], 'bond-chat');
      }

      // Parse habit tags
      const habitMatches = [...content.matchAll(/<!--DRAGON_HABIT:(.+?)-->/g)];
      if (habitMatches.length > 0) {
        const currentHabits = [...(updated.speechHabits || [])];
        for (const match of habitMatches) {
          currentHabits.push(match[1]);
        }
        updated = { ...updated, speechHabits: currentHabits.slice(-5) };
      }

      // Increment chat counts
      updated = {
        ...updated,
        totalChatExchanges: updated.totalChatExchanges + 1,
        sessionChatCount: updated.sessionChatCount + 1,
        lastContactTimestamp: new Date().toISOString(),
      };

      setBondState(updated);
      saveBondState(updated);
    },
    [bondState],
  );

  const handleDeleteMemory = useCallback((memoryId: string) => {
    setBondState(prev => {
      const updated = removeMemory(prev, memoryId);
      saveBondState(updated);
      return updated;
    });
    toast('Memory removed', { duration: 2000 });
  }, []);

  const handleAddMemory = useCallback(() => {
    const text = newMemoryText.trim();
    if (!text) return;
    if (bondState.memories.length >= 30) {
      toast.error('Memory limit reached (30/30)', { duration: 2000 });
      return;
    }
    setBondState(prev => {
      const updated = addMemory(prev, text, newMemorySource);
      saveBondState(updated);
      return updated;
    });
    setNewMemoryText('');
    toast('Memory added', { duration: 2000 });
  }, [newMemoryText, newMemorySource, bondState.memories.length]);

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
  } = useAIDM({
    characterContext,
    customGuidesContent: '',
    worldStatePrompt: '',
    dmPersonaPrompt: dragonSystemPrompt,
    onMessageComplete: handleMessageComplete,
    activeGuideIds: [],
    sessionStorageKey: DRAGON_CHAT_KEY,
    summarizeStorageKey: DRAGON_CHAT_SUMMARY_KEY,
  });

  // Reload bond state when opened
  const opinionFiredRef = useRef(false);
  useEffect(() => {
    if (open) {
      setBondState(loadBondState());
      opinionFiredRef.current = false;
      setDragonOpening(null);
    }
  }, [open]);

  // Request dragon opinion on open when narrative exists
  useEffect(() => {
    if (!open || opinionFiredRef.current || !onRequestOpinion) return;
    if (!recentNarrative || recentNarrative.length === 0) return;
    
    opinionFiredRef.current = true;
    onRequestOpinion().then(opinion => {
      if (opinion) {
        setDragonOpening(opinion);
      }
    }).catch(() => {});
  }, [open, onRequestOpinion, recentNarrative]);

  // Sync personality editor state
  useEffect(() => {
    if (showPersonality) {
      setEditingNotes(dragonNotes || '');
      setTimeout(() => notesTextareaRef.current?.focus(), 100);
    }
  }, [showPersonality, dragonNotes]);


  // Preserve scroll position across streaming re-renders
  const savedScrollRef = useRef<number | null>(null);
  // Before React commits DOM changes, save scroll position
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (savedScrollRef.current !== null) {
      el.scrollTop = savedScrollRef.current;
      savedScrollRef.current = null;
    }
  }, [messages, isLoading]);
  // Save scroll position before each render via a passive capture
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const save = () => { savedScrollRef.current = el.scrollTop; };
    el.addEventListener('scroll', save, { passive: true });
    return () => el.removeEventListener('scroll', save);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isLoading) return;
    const text = inputValue.trim();

    // ── Trust scoring (mirrors use-dragon-bond processExchange) ──
    setBondState(prev => {
      let state = { ...prev };

      const QUESTION_PATTERNS = [
        'how do you feel', 'what do you think', 'are you okay',
        'tell me about', 'what do you remember', 'do you want', 'how are you',
      ];
      const GRATITUDE_PATTERNS = [
        'i trust you', 'thank you', "i'm glad", 'i appreciate',
        'you were right', "i'm sorry",
      ];
      const VULNERABILITY_PATTERNS = [
        "i'm afraid", "i'm scared", "i don't know",
        'i need help', 'i failed', "i'm worried",
      ];
      const AUTONOMY_PATTERNS = [
        'what would you prefer', 'your choice',
        "i won't force you", 'you decide',
      ];

      const lower = text.toLowerCase();
      const matchesAny = (patterns: string[]) => patterns.some(p => lower.includes(p));

      const questionMatch = matchesAny(QUESTION_PATTERNS);
      const gratitudeMatch = matchesAny(GRATITUDE_PATTERNS);
      const vulnerabilityMatch = matchesAny(VULNERABILITY_PATTERNS);
      const autonomyMatch = matchesAny(AUTONOMY_PATTERNS);

      const bondLevel = state.bond ?? 15;
      const effectiveChatCap = bondLevel >= 76 ? 12 : bondLevel >= 51 ? 9 : bondLevel >= 26 ? 7 : 5;
      let trustDelta = state.sessionChatCount <= effectiveChatCap ? 1 : 0;
      let reason = 'conversation';

      if (questionMatch) { trustDelta += 1; reason = 'genuine curiosity'; }
      if (gratitudeMatch) { trustDelta += 1; reason = 'trust and gratitude'; }
      if (vulnerabilityMatch) { trustDelta += 2; reason = 'shared vulnerability'; }
      if (autonomyMatch) { trustDelta += 1; reason = 'respecting autonomy'; }

      const trustBreak = detectTrustBreak(text);
      if (trustBreak.broken) {
        trustDelta = -trustBreak.severity;
        reason = trustBreak.reason;
        state = { ...state, mood: 'distant' as DragonMood };
      } else {
        trustDelta = Math.min(trustDelta, 4);
      }

      if (trustDelta > 0) {
        state = addTrust(state, trustDelta);
      } else if (trustDelta < 0) {
        state = reduceTrust(state, Math.abs(trustDelta));
      }

      // Classify and log rider emotion
      const emotionTag = classifyRiderEmotion(
        text,
        trustBreak,
        { question: questionMatch, gratitude: gratitudeMatch, vulnerability: vulnerabilityMatch, autonomy: autonomyMatch },
      );
      const emotionalLog = [...(state.riderEmotionalLog || []), { tag: emotionTag, timestamp: new Date().toISOString() }].slice(-15);
      state = { ...state, riderEmotionalLog: emotionalLog };

      // Detect rider declarations
      const declaration = detectRiderDeclaration(text);
      if (declaration) {
        state = addMemory(state, declaration, 'rider-said');
      }

      saveBondState(state);
      return state;
    });

    sendMessage(text);
    setInputValue('');
  }, [inputValue, isLoading, sendMessage]);

  const handleKeyDown = useCallback(
    (_e: React.KeyboardEvent) => {
      // intentionally no-op: Enter naturally inserts a newline in textarea
    },
    [handleSend],
  );

  const handleCopyMessage = useCallback((text: string, messageId: string) => {
    const stripped = text
      .replace(/<!--.*?-->/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/<[^>]*>/g, '')
      .trim();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(stripped).then(() => {
        setCopiedId(messageId);
        setTimeout(() => setCopiedId(null), 1500);
      }).catch(() => {});
    } else {
      const ta = document.createElement('textarea');
      ta.value = stripped;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopiedId(messageId); setTimeout(() => setCopiedId(null), 1500); } catch {}
      document.body.removeChild(ta);
    }
  }, []);

  const handlePointerDown = useCallback((text: string, messageId: string) => {
    longPressTimerRef.current = setTimeout(() => {
      handleCopyMessage(text, messageId);
    }, 500);
  }, [handleCopyMessage]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  if (!open) return null;

  const moodInfo = getMoodDescriptor(bondState.mood);
  const bondDesc = getBondDescriptor(bondState.bond);
  const trustDesc = getTrustDescriptor(bondState.trust);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-[#0a0a1a] via-[#0d0815] to-[#0a0612]">
      {/* ── HEADER ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-cyan-500/10">
        <button onClick={onClose} className="p-1.5 -ml-1 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-cyan-300/60" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className={cn('font-cinzel text-base truncate', moodInfo.color)}>
            {dragonName || 'Your Dragon'}
          </h1>
        </div>
        <button
          onClick={() => {
            setShowMemoryPanel(prev => !prev);
            if (showPersonality) setShowPersonality(false);
          }}
          className={cn(
            "p-2 rounded-lg transition-colors",
            showMemoryPanel
              ? "bg-purple-500/20 text-purple-400"
              : "text-white/30 hover:text-white/50 hover:bg-white/5"
          )}
          style={{ touchAction: 'manipulation' }}
          title="Manage dragon memories"
        >
          <Brain className="w-4 h-4" />
        </button>
        {onDragonNotesChange && (
          <button
            onClick={() => { setShowPersonality(prev => !prev); if (showMemoryPanel) setShowMemoryPanel(false); }}
            className={cn(
              "p-2 rounded-lg transition-colors",
              showPersonality
                ? "bg-amber-500/20 text-amber-400"
                : "text-white/30 hover:text-white/50 hover:bg-white/5"
            )}
            style={{ touchAction: 'manipulation' }}
            title="Edit dragon personality"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
        <span className="text-xs flex items-center gap-1 text-white/40">
          <span>{moodInfo.emoji}</span>
          <span>{moodInfo.label}</span>
        </span>
        <button
          onClick={() => setShowClearConfirm(true)}
          className="p-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          style={{ touchAction: 'manipulation' }}
          title="Clear chat"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* ── CLEAR CONFIRM ── */}
      {showClearConfirm && (
        <div className="shrink-0 flex items-center justify-center gap-3 px-4 py-3 bg-red-950/30 border-b border-red-500/20">
          <p className="text-xs text-red-200/70">Clear entire dragon chat history?</p>
          <button
            onClick={() => setShowClearConfirm(false)}
            className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:bg-white/5 border border-white/10"
            style={{ touchAction: 'manipulation' }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              clearMessages();
              setShowClearConfirm(false);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white"
            style={{ touchAction: 'manipulation' }}
          >
            Clear
          </button>
        </div>
      )}

      {/* ── BOND / TRUST INDICATOR ── */}
      <button
        onClick={() => setStatsExpanded(prev => !prev)}
        className="shrink-0 px-4 py-2 border-b border-cyan-500/5 text-left hover:bg-white/[0.02] transition-colors"
      >
        {statsExpanded ? (
          <div className="space-y-2">
            {/* Bond bar */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-medium text-cyan-300/60">Bond</span>
                <span className="text-[10px] text-cyan-300/40">{bondState.bond}/100</span>
              </div>
              <div className="h-1 rounded-full bg-cyan-950/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-cyan-500/60 transition-all duration-500"
                  style={{ width: `${bondState.bond}%` }}
                />
              </div>
              <p className="text-[9px] text-cyan-200/30 mt-0.5">{bondDesc}</p>
            </div>
            {/* Trust bar */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-medium text-purple-300/60">Trust</span>
                <span className="text-[10px] text-purple-300/40">{bondState.trust}/100</span>
              </div>
              <div className="h-1 rounded-full bg-purple-950/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-500/60 transition-all duration-500"
                  style={{ width: `${bondState.trust}%` }}
                />
              </div>
              <p className="text-[9px] text-purple-200/30 mt-0.5">{trustDesc}</p>
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-white/30 truncate">
            Bond: <span className="text-cyan-300/50">{bondDesc.split('—')[0].trim()}</span>
            <span className="mx-1.5">·</span>
            Trust: <span className="text-purple-300/50">{trustDesc.split('—')[0].trim()}</span>
          </p>
        )}
      </button>

      {/* ── PERSONALITY EDITOR ── */}
      {showPersonality && (
        <div className="shrink-0 border-b border-amber-500/20 bg-gradient-to-b from-amber-950/20 to-transparent max-h-[60vh] flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-amber-500/10">
            <div className="flex items-center gap-2">
              <Pencil className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-cinzel font-semibold text-amber-300">Dragon Personality Profile</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/30">
                {editingNotes.length.toLocaleString()}/20,000
              </span>
              <button
                onClick={() => setShowPersonality(false)}
                className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/60 transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <textarea
              ref={notesTextareaRef}
              value={editingNotes}
              onChange={e => setEditingNotes(e.target.value.slice(0, 20000))}
              placeholder="Define your dragon's complete personality — voice, temperament, speech patterns, opinions, history, quirks. This is the single source of truth for who your dragon is."
              className="w-full bg-black/30 border border-amber-500/20 rounded-xl px-3.5 py-3 text-sm text-white/80 placeholder:text-white/20 resize-y focus:outline-none focus:border-amber-500/40 transition-colors"
              style={{ minHeight: '200px', maxHeight: '40vh', touchAction: 'manipulation' }}
            />
          </div>
          <div className="shrink-0 px-4 py-2.5 border-t border-amber-500/10 flex items-center gap-2">
            <button
              onClick={() => setShowPersonality(false)}
              className="flex-1 px-3 py-2.5 rounded-xl text-xs text-white/50 hover:text-white/70 hover:bg-white/5 transition-colors border border-white/10"
              style={{ touchAction: 'manipulation' }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!onDragonNotesChange) return;
                setIsSavingNotes(true);
                try {
                  onDragonNotesChange(editingNotes.trim());
                } finally {
                  setIsSavingNotes(false);
                  setShowPersonality(false);
                }
              }}
              disabled={isSavingNotes}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-50"
              style={{ touchAction: 'manipulation' }}
            >
              {isSavingNotes ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Save Profile
            </button>
          </div>
        </div>
      )}

      {showMemoryPanel && (
        <div className="shrink-0 border-b border-purple-500/20 bg-gradient-to-b from-purple-950/20 to-transparent max-h-[60vh] flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-purple-500/10">
            <div className="flex items-center gap-2">
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-cinzel font-semibold text-purple-300">Dragon Memories</span>
              <span className="text-[10px] text-white/30">({bondState.memories.length}/30)</span>
            </div>
            <div className="flex items-center gap-1">
              {bondState.memories.length > 0 && (
                confirmClearMemories ? (
                  <div className="flex items-center gap-1 mr-1">
                    <button
                      onClick={() => {
                        setBondState(prev => {
                          const updated = { ...prev, memories: [] };
                          saveBondState(updated);
                          return updated;
                        });
                        setConfirmClearMemories(false);
                        toast('All memories cleared', { duration: 2000 });
                      }}
                      className="px-2 py-1 rounded text-[10px] font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                      style={{ touchAction: 'manipulation' }}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmClearMemories(false)}
                      className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/60 transition-colors"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClearMemories(true)}
                    className="px-2 py-1 rounded text-[10px] text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors mr-1"
                    style={{ touchAction: 'manipulation' }}
                    title="Clear all memories"
                  >
                    Clear all
                  </button>
                )
              )}
              <button
                onClick={() => setShowMemoryPanel(false)}
                className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/60 transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {bondState.memories.length === 0 ? (
              <p className="text-xs text-white/20 italic text-center py-6">No memories yet. Your dragon will form memories through conversation and campaign events.</p>
            ) : (
              [...bondState.memories].reverse().map(memory => (
                <div key={memory.id} className="group flex items-start gap-2 rounded-lg bg-black/20 border border-purple-500/10 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/70 leading-relaxed">{memory.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded-full",
                        memory.source === 'campaign' ? "bg-amber-500/10 text-amber-400/60" :
                        memory.source === 'rider-said' ? "bg-cyan-500/10 text-cyan-400/60" :
                        "bg-purple-500/10 text-purple-400/60"
                      )}>
                        {memory.source === 'campaign' ? 'campaign' : memory.source === 'rider-said' ? 'rider said' : 'bond chat'}
                      </span>
                      <span className="text-[9px] text-white/20">{new Date(memory.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteMemory(memory.id)}
                    className="shrink-0 p-1.5 rounded-lg text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    style={{ touchAction: 'manipulation', opacity: 1 }}
                    title="Delete memory"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="shrink-0 px-4 py-2.5 border-t border-purple-500/10">
            <div className="flex items-center gap-2">
              <select
                value={newMemorySource}
                onChange={e => setNewMemorySource(e.target.value as 'rider-said' | 'campaign' | 'bond-chat')}
                className="shrink-0 bg-black/30 border border-purple-500/20 rounded-lg px-2 py-2 text-[10px] text-white/70 focus:outline-none focus:border-purple-500/40 transition-colors appearance-none cursor-pointer"
                style={{ touchAction: 'manipulation' }}
              >
                <option value="rider-said">rider said</option>
                <option value="campaign">campaign</option>
                <option value="bond-chat">bond chat</option>
              </select>
              <input
                type="text"
                value={newMemoryText}
                onChange={e => setNewMemoryText(e.target.value.slice(0, 200))}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddMemory(); } }}
                placeholder="Add a memory manually..."
                className="flex-1 bg-black/30 border border-purple-500/20 rounded-lg px-3 py-2 text-xs text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors"
              />
              <button
                onClick={handleAddMemory}
                disabled={!newMemoryText.trim() || bondState.memories.length >= 30}
                className="shrink-0 p-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ touchAction: 'manipulation' }}
                title="Add memory"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[9px] text-white/20 mt-1">{newMemoryText.length}/200</p>
          </div>
        </div>
      )}

      {/* ── MESSAGES AREA ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6" style={{ overflowAnchor: 'none' }}>
        {messages.length === 0 && !dragonOpening && !isLoading ? (
          /* ── EMPTY STATE ── */
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <p className="text-sm italic text-cyan-200/40 leading-relaxed">
              The bond hums quietly. {dragonName || 'Your dragon'} is aware of you.
            </p>
            <button
              onClick={() => inputRef.current?.focus()}
              className="mt-4 text-xs text-cyan-400/50 border border-cyan-500/20 rounded-lg px-4 py-2 hover:bg-cyan-500/5 transition-colors"
            >
              Reach out
            </button>
          </div>
        ) : (
          <div className="space-y-0">
            {/* Dragon opening opinion */}
            {dragonOpening && (
              <div className="mb-6 pr-12">
                <div className="border-l-2 border-cyan-500/30 pl-3">
                  <div className="text-cyan-200/80 italic text-sm leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1 prose-strong:text-cyan-100/90">
                    <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                      {renderVisionBlocks(stripDragonTags(dragonOpening))}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
            {unreadSnapshot.length > 0 && (
              <>
                {unreadSnapshot.map((msg, i) => (
                  <div key={`unread-${i}`} className="mb-6 pr-12">
                    <div className="border-l-2 border-cyan-500/30 pl-3">
                      <span className="text-[9px] font-mono text-cyan-400/40 block mb-0.5">from the narrative</span>
                      <div className="text-cyan-200/80 italic text-sm leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1 prose-strong:text-cyan-100/90">
                        <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                          {renderVisionBlocks(stripDragonTags(msg))}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
            {messages.map(msg => {
              const isDragon = msg.role === 'assistant';
              const bondSense = isDragon ? extractBondSense(msg.content) : null;
              const cleaned = stripDragonTags(msg.content);
              if (!cleaned) return null;

              return (
                <div key={msg.id}>
                  <div
                    className={cn(
                      isDragon ? 'mb-6' : 'mb-5',
                      isDragon ? 'pr-12' : 'pl-12',
                    )}
                  >
                    <div
                      className={cn(
                        isDragon
                          ? 'pl-3'
                          : 'border-r-2 border-white/[0.12] pr-3 text-right',
                        'relative select-none',
                      )}
                      style={isDragon ? { borderLeft: `2px solid ${dragonColor || '#22d3ee'}80` } : undefined}
                      onPointerDown={() => handlePointerDown(msg.content, msg.id)}
                      onPointerUp={handlePointerUp}
                      onPointerLeave={handlePointerUp}
                      onContextMenu={(e) => { e.preventDefault(); handleCopyMessage(msg.content, msg.id); }}
                    >
                      {copiedId === msg.id && (
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full pointer-events-none animate-pulse z-10">
                          Copied
                        </span>
                      )}
                      {isDragon ? (
                        <div
                          className="italic text-sm leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1"
                          style={{ color: `${dragonColor || '#22d3ee'}cc` }}
                        >
                          <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                            {renderVisionBlocks(cleaned)}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-white/70 font-medium text-sm leading-relaxed whitespace-pre-wrap">
                          {cleaned}
                        </p>
                      )}
                    </div>
                  </div>
                  {bondSense && (
                    <div
                      className="text-center text-[11px] italic py-2 px-4 mb-4"
                      style={{ color: `${dragonColor || '#22d3ee'}66` }}
                    >
                      {bondSense}
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="mb-6 pr-12">
                <div className="pl-3" style={{ borderLeft: `2px solid ${dragonColor || '#22d3ee'}33` }}>
                  <p className="italic text-xs animate-pulse" style={{ color: `${dragonColor || '#22d3ee'}4d` }}>
                    ...a thought stirs through the bond...
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── INPUT AREA ── */}
      <div className="shrink-0 px-3 pb-3 pt-2 border-t border-cyan-500/10">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Think to ${dragonName || 'your dragon'}...`}
            rows={1}
            className="flex-1 bg-cyan-950/20 border border-cyan-500/15 rounded-xl px-3.5 py-2.5 text-sm text-white/80 placeholder:text-cyan-300/25 resize-none focus:outline-none focus:border-cyan-500/30 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className={cn(
              'shrink-0 p-2.5 rounded-xl border transition-all',
              inputValue.trim() && !isLoading
                ? 'bg-cyan-900/40 border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/60'
                : 'bg-white/[0.02] border-white/5 text-white/15',
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
