import { useState } from 'react';
import { Vote, Plus, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ActiveVote } from '@/hooks/use-party-sync';

interface PartyVoteProps {
  activeVote: ActiveVote | null;
  currentUserId?: string;
  characterName: string;
  memberCount: number;
  onStartVote: (question: string, options: string[]) => Promise<void>;
  onCastVote: (optionLabel: string) => Promise<void>;
  onCloseVote: () => Promise<void>;
}

export function PartyVote({ activeVote, currentUserId, characterName, memberCount, onStartVote, onCastVote, onCloseVote }: PartyVoteProps) {
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const handleCreate = async () => {
    const validOptions = options.map(o => o.trim()).filter(Boolean);
    if (!question.trim() || validOptions.length < 2) return;
    await onStartVote(question.trim(), validOptions);
    setCreating(false);
    setQuestion('');
    setOptions(['', '']);
  };

  // No active vote — show create UI
  if (!activeVote) {
    if (!creating) {
      return (
        <div className="text-center py-3">
          <Vote className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground mb-2">No active vote</p>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => setCreating(true)}>
            <Plus className="w-3 h-3" /> Start Vote
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, 100))}
          placeholder="What should we do?"
          className="h-8 text-xs"
        />
        {options.map((opt, i) => (
          <div key={i} className="flex gap-1">
            <Input
              value={opt}
              onChange={(e) => {
                const next = [...options];
                next[i] = e.target.value.slice(0, 50);
                setOptions(next);
              }}
              placeholder={`Option ${i + 1}`}
              className="h-7 text-xs"
            />
            {options.length > 2 && (
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setOptions(options.filter((_, j) => j !== i))}>
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        ))}
        <div className="flex gap-2">
          {options.length < 4 && (
            <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={() => setOptions([...options, ''])}>
              <Plus className="w-3 h-3" /> Add Option
            </Button>
          )}
          <div className="flex gap-1 ml-auto">
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setCreating(false); setQuestion(''); setOptions(['', '']); }}>Cancel</Button>
            <Button size="sm" className="text-xs h-7" onClick={handleCreate} disabled={!question.trim() || options.filter(o => o.trim()).length < 2}>Create</Button>
          </div>
        </div>
      </div>
    );
  }

  // Active vote — show ballot
  const totalVotes = activeVote.options.reduce((sum, o) => sum + o.voters.length, 0);
  const isCreator = activeVote.creatorUserId === currentUserId;
  const hasVoted = !!activeVote.myVote;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">{activeVote.question}</p>
      <p className="text-[9px] text-muted-foreground">by {activeVote.creatorName} · {totalVotes}/{memberCount} voted</p>
      
      <div className="space-y-1.5">
        {activeVote.options.map((opt) => {
          const isMyVote = activeVote.myVote === opt.label;
          const pct = totalVotes > 0 ? Math.round((opt.voters.length / totalVotes) * 100) : 0;
          
          return (
            <button
              key={opt.label}
              onClick={() => !hasVoted && !activeVote.closed && onCastVote(opt.label)}
              disabled={hasVoted || activeVote.closed}
              className={cn(
                "w-full relative px-2 py-1.5 rounded-md border text-xs text-left transition-colors",
                isMyVote ? "border-primary/50 bg-primary/10" : "border-border/30 bg-muted/10",
                !hasVoted && !activeVote.closed && "hover:bg-muted/20 cursor-pointer"
              )}
            >
              {(hasVoted || activeVote.closed) && (
                <div className="absolute inset-0 rounded-md bg-primary/5" style={{ width: `${pct}%` }} />
              )}
              <div className="relative flex items-center justify-between">
                <span className="flex items-center gap-1">
                  {isMyVote && <Check className="w-3 h-3 text-primary" />}
                  {opt.label}
                </span>
                {(hasVoted || activeVote.closed) && (
                  <span className="text-[10px] text-muted-foreground">{opt.voters.length} ({pct}%)</span>
                )}
              </div>
              {(hasVoted || activeVote.closed) && opt.voters.length > 0 && (
                <p className="text-[9px] text-muted-foreground mt-0.5 relative">
                  {opt.voters.map(v => v.name).join(', ')}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {isCreator && !activeVote.closed && (
        <Button size="sm" variant="outline" className="text-xs h-7 w-full" onClick={onCloseVote}>
          Close Vote
        </Button>
      )}
      {activeVote.closed && (
        <p className="text-[10px] text-center text-muted-foreground">Vote closed</p>
      )}
    </div>
  );
}
