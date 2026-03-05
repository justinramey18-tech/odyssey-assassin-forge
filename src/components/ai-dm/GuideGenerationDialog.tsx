import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Loader2, Sparkles, ScrollText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GuideGenerationDialogProps {
  open: boolean;
  streamedContent: string;
  isStreaming: boolean;
  suggestedName: string;
  onAccept: () => void;
  onReject: () => void;
}

export function GuideGenerationDialog({
  open,
  streamedContent,
  isStreaming,
  suggestedName,
  onAccept,
  onReject,
}: GuideGenerationDialogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom while streaming
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [streamedContent, isStreaming]);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex flex-col bg-black/90 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/20 bg-purple-950/40">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="text-sm font-cinzel text-purple-200 truncate">
            {isStreaming ? 'Generating...' : suggestedName || 'Guide Complete'}
          </span>
        </div>
        {isStreaming && (
          <Loader2 className="w-4 h-4 text-purple-400 animate-spin shrink-0" />
        )}
      </div>

      {/* Streaming content area */}
      <ScrollArea ref={scrollRef} className="flex-1 min-h-0">
        <div className="px-4 py-3">
          {streamedContent ? (
            <div className="prose prose-sm prose-invert max-w-none
              prose-headings:font-cinzel prose-headings:text-purple-200
              prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
              prose-p:text-white/70 prose-p:text-sm prose-p:leading-relaxed
              prose-li:text-white/70 prose-li:text-sm
              prose-strong:text-white/90
              prose-ul:my-1 prose-ol:my-1
              prose-hr:border-purple-500/20"
            >
              <ReactMarkdown>{streamedContent}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <ScrollText className="w-8 h-8 text-purple-500/40" />
              <p className="text-sm text-white/30">Preparing your guide...</p>
            </div>
          )}

          {/* Streaming cursor */}
          {isStreaming && streamedContent && (
            <span className="inline-block w-2 h-4 bg-purple-400 animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>
      </ScrollArea>

      {/* Action buttons - only show when done */}
      {!isStreaming && streamedContent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-4 border-t border-purple-500/20 bg-purple-950/40"
        >
          <p className="text-xs text-white/50 text-center mb-3 font-cinzel">Accept this guide?</p>
          <div className="flex gap-3">
            <button
              onClick={onReject}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm font-cinzel hover:bg-white/10 transition-all active:scale-95"
              style={{ touchAction: 'manipulation' }}
            >
              <X className="w-4 h-4" />
              Discard
            </button>
            <button
              onClick={onAccept}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-purple-600/60 to-amber-600/40 border border-purple-500/30 text-purple-100 text-sm font-cinzel hover:from-purple-600/80 hover:to-amber-600/60 transition-all active:scale-95"
              style={{ touchAction: 'manipulation' }}
            >
              <Check className="w-4 h-4" />
              Save Guide
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
