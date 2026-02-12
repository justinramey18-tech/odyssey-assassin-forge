import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Square, Trash2, RotateCcw, Crown, Heart, Shield, ChevronDown, ChevronUp, BookOpen, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIDM } from '@/hooks/use-ai-dm';
import { useGMGuides } from '@/hooks/use-gm-guides';
import { CharacterContext, Message } from '@/components/oracle/types';
import { DMQuickActions } from './DMQuickActions';
import { GMGuidesManager } from './GMGuidesManager';
import ReactMarkdown from 'react-markdown';

interface AIDMScreenProps {
  onBack: () => void;
  characterContext: CharacterContext;
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

export function AIDMScreen({ onBack, characterContext }: AIDMScreenProps) {
  const gmGuides = useGMGuides();
  const { messages, isLoading, isSummarizing, campaignSummary, updateCampaignSummary, sendMessage, cancelRequest, clearMessages, newGame } = useAIDM({ characterContext, customGuidesContent: gmGuides.enabledContent });

  const handleCampaignSummaryChange = useCallback((summary: string) => {
    updateCampaignSummary(summary);
  }, [updateCampaignSummary]);
  const [input, setInput] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [showGuides, setShowGuides] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
        <div className="flex items-center gap-1">
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
            onClick={newGame}
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
    </div>
  );
}
