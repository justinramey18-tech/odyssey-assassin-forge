import { useMemo } from 'react';
import { Dices, Lightbulb, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

import type { Whisper } from '@/components/oracle/types';

interface WhisperableMessage {
  role: 'user' | 'assistant' | string;
  whispers?: Whisper[];
  timestamp?: Date;
  created_at?: string;
}

interface OracleWhisperFeedProps {
  messages: WhisperableMessage[];
}

interface FeedEntry {
  whisper: Whisper;
  messageIndex: number;
  timestamp: Date;
}

const ICON_MAP: Record<Whisper['type'], { icon: typeof Dices; color: string; border: string; bg: string; label: string }> = {
  action:  { icon: Dices,     color: 'text-amber-400',   border: 'border-amber-500/30', bg: 'bg-amber-500/5',   label: 'Action' },
  tactics: { icon: Lightbulb, color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', label: 'Tactics' },
  whisper: { icon: Eye,       color: 'text-purple-400',  border: 'border-purple-500/30', bg: 'bg-purple-500/5',  label: 'Whisper' },
};

export function OracleWhisperFeed({ messages }: OracleWhisperFeedProps) {
  const entries = useMemo<FeedEntry[]>(() => {
    const result: FeedEntry[] = [];
    messages.forEach((msg, idx) => {
      if (msg.role === 'assistant' && msg.whispers) {
        const ts = msg.timestamp instanceof Date
          ? msg.timestamp
          : msg.created_at ? new Date(msg.created_at) : new Date();
        for (const w of msg.whispers) {
          result.push({ whisper: w, messageIndex: idx, timestamp: ts });
        }
      }
    });
    return result.reverse(); // newest first
  }, [messages]);

  if (entries.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <Eye className="w-8 h-8 text-amber-500/30 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground font-mono">No whispers yet</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">Dice rolls, tactics, and tips will appear here</p>
      </div>
    );
  }

  return (
    <div className="max-h-[50vh] overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]">
      <div className="px-3 py-2 space-y-1.5">
        {entries.map((entry, i) => {
          const config = ICON_MAP[entry.whisper.type];
          const Icon = config.icon;
          const timeStr = entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2.5 px-3 py-2 rounded-lg border",
                config.border,
                config.bg,
              )}
            >
              <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", config.color)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={cn("text-[10px] font-mono uppercase tracking-wider", config.color)}>
                    {config.label}
                  </span>
                  {entry.whisper.target && (
                    <span className="text-[10px] font-mono text-purple-400/70">
                      → {entry.whisper.target}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/50 ml-auto">{timeStr}</span>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {entry.whisper.content}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
