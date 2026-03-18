import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { parseWhispers } from '@/lib/whisper-parser';
import { WhisperTray } from '@/components/ai-dm/WhisperTray';
import { ArrowLeft, Settings, Send, BookOpen, Loader2, RotateCcw, X, Shuffle, Flame, MoreVertical, Pencil, Trash2, Copy, Check, RefreshCw, FolderOpen } from 'lucide-react';
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
import { useGMGuides } from '@/hooks/use-gm-guides';
import {
  loadEmpyreanDMConfig,
  buildEmpyreanDMPersona,
  EmpyreanDMConfig,
} from '@/lib/empyreanDMPersona';
import { empyreanPrompts } from '@/lib/empyreanPrompts';
import { EMPYREAN_SESSION_GUIDES } from '@/lib/empyreanGMGuides';
import { DM_MODELS, DMAIModel } from '@/lib/dm-models';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EmpyreanDMScreenProps {
  open: boolean;
  onClose: () => void;
  characterContext: CharacterContext;
  characterName: string;
  initialMessage?: string | null;
  autoSyncCallbacks?: {
    onGoldChange?: (gold: number) => void;
    onHPChange?: (current: number, max: number) => void;
    onXPGain?: (xp: number) => void;
  };
}

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
  return content.replace(/<!--BURNOUT:\d-->/g, '').trim();
}

const BURNOUT_LABELS = [
  'Fresh — no strain',
  'Mild strain',
  'Moderate strain',
  'Heavy strain',
  'Critical strain',
  'Overload',
];

function BurnoutIndicator({ level }: { level: number }) {
  const color = level <= 1 ? 'text-emerald-400' : level <= 3 ? 'text-amber-400' : 'text-red-400';
  const emptyColor = level <= 1 ? 'text-emerald-400/20' : level <= 3 ? 'text-amber-400/20' : 'text-red-400/20';
  return (
    <div className="flex items-center gap-0.5" title={`Signet Strain: ${BURNOUT_LABELS[level]}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Flame key={i} className={cn('w-3 h-3', i < level ? color : emptyColor)} />
      ))}
    </div>
  );
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
  const [showSettings, setShowSettings] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showSaves, setShowSaves] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [burnoutLevel, setBurnoutLevel] = useState(0);
  const [initialSent, setInitialSent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reload config when screen opens
  useEffect(() => {
    if (open) {
      setConfig(loadEmpyreanDMConfig());
    }
  }, [open]);

  const { enabledContent, activeGuideIds } = useGMGuides();

  const dmPersonaPrompt = useMemo(() => {
    if (!config) return undefined;
    return buildEmpyreanDMPersona(
      config.selectedLoreGuides,
      config.selectedToneGuides,
      config.selectedSessionTemplate,
      config.characterName || characterName,
      config.dragonName,
      config.signetType,
      config.yearAtBasgiath,
      config.campaignFocus,
    );
  }, [config, characterName]);

  const {
    messages,
    isLoading,
    isSummarizing,
    campaignSummary,
    sendMessage,
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
    customGuidesContent: enabledContent,
    dmPersonaPrompt,
    selectedModel,
    sessionStorageKey: EMPYREAN_SESSION_KEY,
    summarizeStorageKey: EMPYREAN_SUMMARY_KEY,
    onMessageComplete: autoSyncCallbacks ? (content) => {
      // Could parse for gold/HP/XP changes
    } : undefined,
  });

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
    setShowSettings(false);
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
      const match = lastMsg.content.match(/<!--BURNOUT:(\d)-->/);
      if (match) {
        const level = Math.min(5, Math.max(0, parseInt(match[1], 10)));
        setBurnoutLevel(level);
      }
    }
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isLoading) return;
    sendMessage(inputValue.trim());
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [inputValue, isLoading, sendMessage]);

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

  const handleNewCampaign = useCallback(() => {
    newGame();
    setActiveTemplate(null);
    setBurnoutLevel(0);
    setShowSettings(false);
  }, [newGame]);

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

  // Auto-resize textarea
  const handleTextareaInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  }, []);

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
                onNewGame={handleNewCampaign}
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
              {config.signetType && <BurnoutIndicator level={burnoutLevel} />}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <Settings className="w-5 h-5 text-purple-400" />
        </button>
      </div>

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
                    const cleanNarrative = stripBurnoutTags(parsed.narrative);
                    return (
                      <>
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
                        {parsed.whispers.length > 0 && (
                          <WhisperTray whispers={parsed.whispers} />
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

      {/* Input bar */}
      <div className="shrink-0 border-t border-purple-500/20 bg-background/90 backdrop-blur-sm px-3 py-2.5">
        <div className="flex items-end gap-2">
          <button
            onClick={() => setShowPrompts(true)}
            className="p-2.5 rounded-lg hover:bg-purple-500/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
          >
            <BookOpen className="w-5 h-5 text-purple-400" />
          </button>

          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleTextareaInput}
            placeholder="What does your rider do..."
            rows={1}
            className="flex-1 bg-card/30 border border-purple-500/20 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-purple-400 max-h-[120px] min-h-[44px]"
            onKeyDown={e => {
              // Enter inserts newline, no send shortcut
            }}
          />

          {isLoading ? (
            <button
              onClick={cancelRequest}
              className="p-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
            >
              <X className="w-5 h-5 text-red-400" />
            </button>
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

      {/* Settings Sheet */}
      <Sheet open={showSettings} onOpenChange={setShowSettings}>
        <SheetContent side="bottom" className="z-[65] border-purple-500/20 bg-background max-h-[70vh]">
          <SheetHeader>
            <SheetTitle className="font-cinzel text-purple-300">Empyrean DM Settings</SheetTitle>
          </SheetHeader>
          <div className="space-y-5 py-4">
            {/* Model selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">AI Model</label>
              <Select value={selectedModel} onValueChange={handleModelChange}>
                <SelectTrigger className="bg-card/30 border-purple-500/30 z-[70]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[70] max-h-[300px]">
                  {DM_MODELS.map(m => (
                    <SelectItem key={m.id} value={m.id} className="text-xs text-white/80">
                      <div>
                        <span className="font-medium">{m.label}</span>
                        <span className="text-white/40 ml-1.5">— {m.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Campaign info */}
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-1">
              <p className="text-xs text-muted-foreground">
                <span className="text-purple-300">Focus:</span> {config.campaignFocus}
              </p>
              {config.dragonName && (
                <p className="text-xs text-muted-foreground">
                  <span className="text-purple-300">Dragon:</span> {config.dragonName}
                </p>
              )}
              {config.signetType && (
                <p className="text-xs text-muted-foreground">
                  <span className="text-purple-300">Signet:</span> {config.signetType}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                <span className="text-purple-300">Messages:</span> {messages.length}
              </p>
            </div>

            {/* New Campaign */}
            <Button
              variant="outline"
              onClick={handleNewCampaign}
              className="w-full gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <RotateCcw className="w-4 h-4" />
              New Campaign Session
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Quick Prompts Sheet */}
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
    </div>
  );
}
