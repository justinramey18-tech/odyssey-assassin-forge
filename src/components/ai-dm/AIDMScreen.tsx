import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Square, Trash2, RotateCcw, Crown, Heart, Shield, ChevronDown, ChevronUp, BookOpen, ScrollText, FolderOpen, Cloud, CloudOff, Loader2, Users, Zap, Map } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIDM } from '@/hooks/use-ai-dm';
import { useGMGuides } from '@/hooks/use-gm-guides';
import { useCampaignSessions, CampaignSession } from '@/hooks/use-campaign-sessions';
import { CharacterContext, Message } from '@/components/oracle/types';
import { DMQuickActions } from './DMQuickActions';
import { DMDiceRoller } from './DMDiceRoller';
import { GMGuidesManager } from './GMGuidesManager';
import { CampaignSessionsManager } from './CampaignSessionsManager';
import { PartyDMScreen } from './PartyDMScreen';
import { AutoSyncBanner } from './AutoSyncBanner';
import { usePartyDm } from '@/hooks/use-party-dm';
import { useDmAutoSync } from '@/hooks/use-dm-auto-sync';
import { StandaloneBattleMap } from '@/components/home/StandaloneBattleMap';
import ReactMarkdown from 'react-markdown';
import type { PartyMember } from '@/hooks/use-party-sync';
import type { MapMarker } from '@/components/party/battlemap/types';

interface AIDMScreenProps {
  onBack: () => void;
  characterContext: CharacterContext;
  partyId?: string | null;
  isPartyCreator?: boolean;
  partyMembers?: PartyMember[];
  userId?: string;
  characterName?: string;
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

function DMMessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-2', isUser ? 'justify-end' : 'justify-start')}
    >
      {/* DM Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-amber-900/60 border border-amber-500/40">
          <Crown className="w-4 h-4 text-amber-400" />
        </div>
      )}

      {/* Message bubble */}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5',
          isUser
            ? 'bg-white/10 text-white rounded-br-sm border border-white/10'
            : 'bg-amber-950/50 border border-amber-500/20 rounded-bl-sm'
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-invert prose-sm max-w-none">
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

      {/* User Avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-white/70" />
        </div>
      )}
    </motion.div>
  );
}

export function AIDMScreen({ onBack, characterContext, partyId, isPartyCreator = false, partyMembers = [], userId, characterName = 'Adventurer', autoSyncCallbacks }: AIDMScreenProps) {
  const [showPartyDM, setShowPartyDM] = useState(false);
  const [showBattleMap, setShowBattleMap] = useState(false);
  const [pendingMapAdds, setPendingMapAdds] = useState<MapMarker[]>([]);
  const [pendingMapRemovals, setPendingMapRemovals] = useState<string[]>([]);
  const battleMapMarkersRef = useRef<MapMarker[]>([]);
  const battleMapGridSizeRef = useRef<number>(25);
  const gmGuides = useGMGuides();

  // Auto-sync hook
  const autoSync = useDmAutoSync({
    onHPChange: autoSyncCallbacks?.onHPChange ?? (() => {}),
    onAddXP: autoSyncCallbacks?.onAddXP ?? (() => {}),
    onGoldChange: autoSyncCallbacks?.onGoldChange ?? (() => {}),
    onConditionChange: autoSyncCallbacks?.onConditionChange ?? (() => {}),
    onRestOccurred: autoSyncCallbacks?.onRestOccurred ?? (() => {}),
    onMapUpdate: useCallback((markersToAdd: MapMarker[], namesToRemove: string[]) => {
      if (markersToAdd.length > 0) setPendingMapAdds(markersToAdd);
      if (namesToRemove.length > 0) setPendingMapRemovals(namesToRemove);
    }, []),
    getCurrentHP: autoSyncCallbacks?.getCurrentHP ?? (() => 0),
    getCurrentGold: autoSyncCallbacks?.getCurrentGold ?? (() => 0),
    getCurrentMarkers: useCallback(() => battleMapMarkersRef.current, []),
    getGridSize: useCallback(() => battleMapGridSizeRef.current as any, []),
  });

  // Callback for when DM finishes streaming
  const handleMessageComplete = useCallback((content: string) => {
    if (autoSync.autoSyncEnabled && autoSyncCallbacks) {
      autoSync.extractAndApply(content, characterContext);
    }
  }, [autoSync.autoSyncEnabled, autoSyncCallbacks, autoSync.extractAndApply, characterContext]);

  const { messages, isLoading, isSummarizing, campaignSummary, updateCampaignSummary, loadCampaign, sendMessage, cancelRequest, clearMessages, newGame, activeCampaignId, setActiveCampaignId, lastCloudSyncTime, isCloudSyncing } = useAIDM({ characterContext, customGuidesContent: gmGuides.enabledContent, onMessageComplete: handleMessageComplete });
  const campaignSessions = useCampaignSessions();

  const partyDm = usePartyDm({
    partyId: partyId || null,
    isCreator: isPartyCreator,
    memberCount: partyMembers.length,
    characterName,
    characterContext,
    partyMembers: partyMembers.map(m => ({
      character_name: m.character_name,
      character_status: m.character_status as Record<string, unknown>,
      user_id: m.user_id,
    })),
    customGuidesContent: gmGuides.enabledContent,
  });

  const inParty = !!partyId && partyMembers.length > 0;

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
    loadCampaign(session.messages, session.campaign_summary, session.id);
    setShowSessions(false);
  }, [loadCampaign]);

  const handleSaveCampaign = useCallback(async (name: string, msgs: Message[], summary: string | null, existingId?: string) => {
    const id = await campaignSessions.saveSession(name, msgs, summary, existingId);
    if (id) setActiveCampaignId(id);
    return id;
  }, [campaignSessions]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
    // Reset textarea height
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

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }, []);

  const hpPercent = characterContext.maxHP > 0
    ? Math.round((characterContext.currentHP / characterContext.maxHP) * 100)
    : 100;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-[#1a0e05] via-[#0d0d12] to-[#0a0a0f]">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-amber-900/30 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <ArrowLeft className="w-5 h-5 text-white/80" />
          </button>
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <h1 className="text-base font-cinzel text-amber-200 tracking-wide">Dungeon Master</h1>
          </div>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-shrink min-w-0">
          {inParty && (
            <button
              onClick={() => {
                if (partyDm.isActive) {
                  setShowPartyDM(true);
                } else if (isPartyCreator) {
                  partyDm.startSession('shared');
                  setShowPartyDM(true);
                }
              }}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-cinzel transition-colors flex items-center gap-1",
                partyDm.isActive
                  ? "text-emerald-300 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-500/30"
                  : isPartyCreator
                    ? "text-amber-300 hover:bg-amber-900/20"
                    : "text-white/30 cursor-not-allowed"
              )}
              style={{ touchAction: 'manipulation' }}
              title={partyDm.isActive ? 'Join Party DM' : isPartyCreator ? 'Start Party DM' : 'Waiting for host to start Party DM'}
              disabled={!partyDm.isActive && !isPartyCreator}
            >
              <Users className="w-3.5 h-3.5" />
              {partyDm.isActive ? (
                <>
                  Join Party
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </>
              ) : isPartyCreator ? (
                'Start Party'
              ) : (
                'Waiting for Host'
              )}
            </button>
          )}
          {/* Auto-Sync Toggle */}
          {autoSyncCallbacks && (
            <button
              onClick={() => autoSync.toggleAutoSync(!autoSync.autoSyncEnabled)}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-cinzel transition-colors",
                autoSync.autoSyncEnabled ? "text-amber-300 bg-amber-900/30" : "text-white/50 hover:bg-white/10"
              )}
              style={{ touchAction: 'manipulation' }}
              title={autoSync.autoSyncEnabled ? 'Auto-Sync enabled' : 'Enable Auto-Sync'}
            >
              <Zap className={cn("w-3.5 h-3.5 inline mr-1", autoSync.isExtracting && "animate-pulse")} />
              Sync
            </button>
          )}
          {/* Battle Map */}
          <button
            onClick={() => setShowBattleMap(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-cinzel text-white/50 hover:bg-white/10 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <Map className="w-3.5 h-3.5 inline mr-1" />
            Map
          </button>
          <button
            onClick={() => setShowSessions(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-cinzel text-white/50 hover:bg-white/10 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <FolderOpen className="w-3.5 h-3.5 inline mr-1" />
            Saves
          </button>
          <button
            onClick={() => setShowGuides(true)}
            className={cn(
              "px-2.5 py-1.5 rounded-lg text-xs font-cinzel transition-colors relative",
              gmGuides.guides.some(g => g.enabled) ? "text-amber-300/80 hover:bg-amber-900/30" : "text-white/50 hover:bg-white/10"
            )}
            style={{ touchAction: 'manipulation' }}
          >
            <BookOpen className="w-3.5 h-3.5 inline mr-1" />
            Guides
            {gmGuides.guides.filter(g => g.enabled).length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-600 text-[8px] flex items-center justify-center text-white">
                {gmGuides.guides.filter(g => g.enabled).length}
              </span>
            )}
          </button>
          <button
            onClick={() => { newGame(); }}
            className="px-2.5 py-1.5 rounded-lg text-xs font-cinzel text-amber-300/80 hover:bg-amber-900/30 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
            New
          </button>
          <button
            onClick={clearMessages}
            className="px-2.5 py-1.5 rounded-lg text-xs text-white/50 hover:bg-white/10 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Context Banner */}
      <button
        onClick={() => setShowContext(prev => !prev)}
        className="flex items-center justify-center gap-2 px-3 py-1.5 bg-black/30 border-b border-amber-900/20 hover:bg-black/40 transition-colors"
        style={{ touchAction: 'manipulation' }}
      >
        <Heart className="w-3 h-3 text-red-400" />
        <span className={cn(
          "text-[11px] font-mono",
          hpPercent > 50 ? "text-emerald-400" : hpPercent > 25 ? "text-amber-400" : "text-red-400"
        )}>
          {characterContext.currentHP}/{characterContext.maxHP} HP
        </span>
        <span className="text-[11px] text-white/40">•</span>
        <span className="text-[11px] text-white/60">Lv {characterContext.level}</span>
        {characterContext.activeConditions && characterContext.activeConditions.length > 0 && (
          <>
            <span className="text-[11px] text-white/40">•</span>
            <span className="text-[11px] text-amber-400">
              {characterContext.activeConditions.map(c => c.name).join(', ')}
            </span>
          </>
        )}
        {campaignSummary && (
          <>
            <span className="text-[11px] text-white/40">•</span>
            <ScrollText className="w-3 h-3 text-purple-400" />
            <span className="text-[11px] text-purple-300/70">{(campaignSummary.length / 1000).toFixed(1)}k</span>
          </>
        )}
        {campaignSessions.isSignedIn && (
          <>
            <span className="text-[11px] text-white/40">•</span>
            {isCloudSyncing ? (
              <Loader2 className="w-3 h-3 text-sky-400 animate-spin" />
            ) : lastCloudSyncTime ? (
              <>
                <Cloud className="w-3 h-3 text-sky-400" />
                <span className="text-[11px] text-sky-300/70">
                  {Math.round((Date.now() - lastCloudSyncTime.getTime()) / 60000)}m
                </span>
              </>
            ) : (
              <CloudOff className="w-3 h-3 text-white/30" />
            )}
          </>
        )}
        {isSummarizing && (
          <>
            <span className="text-[11px] text-white/40">•</span>
            <span className="text-[11px] text-purple-400 animate-pulse">Summarizing...</span>
          </>
        )}
        {showContext ? <ChevronUp className="w-3 h-3 text-white/40" /> : <ChevronDown className="w-3 h-3 text-white/40" />}
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

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain"
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
                <DMMessageBubble key={message.id} message={message} />
              ))}
            </AnimatePresence>

            {/* Loading indicator */}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-2 items-center"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-amber-900/60 border border-amber-500/40">
                  <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
                <span className="text-sm text-amber-400/60 italic">The DM weaves the tale...</span>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Quick Actions (when in conversation) */}
      {messages.length > 0 && !isLoading && (
        <div className="px-3 py-1 border-t border-amber-900/20 bg-black/20">
          <DMQuickActions onSelect={handleQuickAction} isLoading={isLoading} variant="inline" />
        </div>
      )}

      {/* Auto-Sync Banner */}
      <AutoSyncBanner
        extraction={autoSync.lastExtraction}
        onUndo={autoSync.undoLastExtraction}
        onDismiss={() => {}}
      />

      {/* Inline Dice Roller */}
      {messages.length > 0 && (
        <DMDiceRoller
          characterContext={characterContext}
          onRollResult={handleQuickAction}
          disabled={isLoading}
        />
      )}

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

      {/* Input Area */}
      <div className="px-3 py-3 border-t border-amber-900/30 bg-black/40 backdrop-blur-sm">
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="What do you do?"
            rows={1}
            className="flex-1 bg-white/5 border border-amber-900/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 resize-none min-h-[42px] max-h-[120px]"
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
        </div>
      </div>
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
      {/* Party DM Overlay */}
      {showPartyDM && partyDm.isActive && (
        <PartyDMScreen
          onBack={() => setShowPartyDM(false)}
          partyDm={partyDm}
          isCreator={isPartyCreator}
          currentUserId={userId}
          memberCount={partyMembers.length}
          members={partyMembers.map(m => ({ user_id: m.user_id, character_name: m.character_name }))}
        />
      )}
      {/* Battle Map Overlay */}
      <StandaloneBattleMap
        open={showBattleMap}
        onClose={() => setShowBattleMap(false)}
        characterName={characterName}
        pendingMarkerAdds={pendingMapAdds}
        pendingMarkerRemovals={pendingMapRemovals}
        onPendingProcessed={() => { setPendingMapAdds([]); setPendingMapRemovals([]); }}
        onMarkersChange={(markers) => { battleMapMarkersRef.current = markers; }}
        onGridSizeChange={(size) => { battleMapGridSizeRef.current = size; }}
      />
    </div>
  );
}
