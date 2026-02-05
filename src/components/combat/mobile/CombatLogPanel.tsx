import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CombatLogEntry } from '@/hooks/use-combat-log';
import {
  Copy,
  Trash2,
  Check,
  Sword,
  Sparkles,
  Wand2,
  Backpack,
  Zap,
  Clock,
  ChevronDown,
  ChevronUp,
  ScrollText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CombatLogPanelProps {
  entries: CombatLogEntry[];
  onClearLog: () => void;
  onRemoveEntry: (id: string) => void;
}

export function CombatLogPanel({
  entries,
  onClearLog,
  onRemoveEntry,
}: CombatLogPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [copiedAll, setCopiedAll] = useState(false);

  const copyPrompt = async (entry: CombatLogEntry) => {
    await navigator.clipboard.writeText(entry.prompt);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyAllPrompts = async () => {
    if (entries.length === 0) return;
    
    // Build narrative sequence from oldest to newest
    const narrative = [...entries]
      .reverse()
      .map((entry, index) => {
        const header = `## ${index + 1}. ${entry.actionName.toUpperCase()}`;
        const meta = `*${entry.actionType} action${entry.roll ? ` • Roll: ${entry.roll.total}${entry.roll.isCrit ? ' (CRITICAL!)' : ''}${entry.roll.isFumble ? ' (FUMBLE!)' : ''}` : ''}${entry.damage ? ` • ${entry.damage}` : ''}*`;
        return `${header}\n${meta}\n\n${entry.prompt}`;
      })
      .join('\n\n---\n\n');

    const fullText = `# COMBAT LOG NARRATIVE\n*${entries.length} actions recorded*\n\n---\n\n${narrative}`;
    
    await navigator.clipboard.writeText(fullText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const getActionIcon = (type: CombatLogEntry['actionType']) => {
    switch (type) {
      case 'weapon': return Sword;
      case 'ability': return Sparkles;
      case 'spell': return Wand2;
      case 'item': return Backpack;
      case 'reaction': return Zap;
      default: return ScrollText;
    }
  };

  const getActionColor = (type: CombatLogEntry['actionType']) => {
    switch (type) {
      case 'weapon': return 'text-red-400 bg-red-500/20 border-red-500/40';
      case 'ability': return 'text-amber-400 bg-amber-500/20 border-amber-500/40';
      case 'spell': return 'text-indigo-400 bg-indigo-500/20 border-indigo-500/40';
      case 'item': return 'text-green-400 bg-green-500/20 border-green-500/40';
      case 'reaction': return 'text-cyan-400 bg-cyan-500/20 border-cyan-500/40';
      default: return 'text-muted-foreground bg-muted/20 border-muted/40';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return formatTime(date);
  };

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-primary" />
          <span className="text-sm font-mono text-primary">COMBAT LOG</span>
          <span className="text-xs text-muted-foreground">({entries.length})</span>
        </div>
        {entries.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={copyAllPrompts}
              className={cn(
                "h-8 text-primary hover:bg-primary/10",
                copiedAll && "text-green-400"
              )}
            >
              {copiedAll ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy All
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearLog}
              className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Log Entries */}
      {entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-4">
            <ScrollText className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No combat actions logged</p>
          <p className="text-[11px] text-primary/70 italic mt-2">
            "Attack, cast, or use abilities to populate the log"
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1 -mx-4 px-4">
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {entries.map((entry) => {
                const Icon = getActionIcon(entry.actionType);
                const colorClass = getActionColor(entry.actionType);
                const isExpanded = expandedId === entry.id;
                const isCopied = copiedId === entry.id;

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    className={cn(
                      "rounded-xl border overflow-hidden transition-all",
                      colorClass.split(' ').slice(1).join(' ')
                    )}
                  >
                    {/* Header Row */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors"
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        colorClass.split(' ').slice(0, 2).join(' ')
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate">
                            {entry.actionName}
                          </span>
                          {entry.roll?.isCrit && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500 text-black rounded font-bold">
                              CRIT!
                            </span>
                          )}
                          {entry.roll?.isFumble && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-destructive text-white rounded font-bold">
                              FUMBLE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{formatRelativeTime(entry.timestamp)}</span>
                          {entry.roll && (
                            <>
                              <span>•</span>
                              <span className="font-mono">Roll: {entry.roll.total}</span>
                            </>
                          )}
                          {entry.damage && (
                            <>
                              <span>•</span>
                              <span className="font-mono">{entry.damage}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>

                    {/* Expanded Content */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="px-3 pb-3 space-y-3">
                            {/* Full Prompt */}
                            <div className="p-3 bg-black/40 rounded-lg border border-white/10">
                              <div className="text-[10px] text-muted-foreground font-mono mb-2 uppercase">
                                AI DM Prompt
                              </div>
                              <pre className="text-xs text-foreground/90 whitespace-pre-wrap font-mono leading-relaxed max-h-[300px] overflow-y-auto">
                                {entry.prompt}
                              </pre>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              <Button
                                onClick={() => copyPrompt(entry)}
                                size="sm"
                                className="flex-1 h-10 bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-4 h-4 mr-2" />
                                    Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy Prompt
                                  </>
                                )}
                              </Button>
                              <Button
                                onClick={() => onRemoveEntry(entry.id)}
                                size="sm"
                                variant="ghost"
                                className="h-10 px-3 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
