import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TurnAction, formatTurnSummary } from '@/lib/combat/combatTypes';
import {
  Copy,
  Trash2,
  Share2,
  Check,
  X,
  Sword,
  Zap,
  Shield,
  Footprints,
  FileText,
} from 'lucide-react';

interface TurnSummaryPanelProps {
  turnActions: TurnAction[];
  movementUsed: number;
  maxMovement: number;
  onRemoveAction: (index: number) => void;
  onClearTurn: () => void;
  onSetMovement: (description: string) => void;
}

export function TurnSummaryPanel({
  turnActions,
  movementUsed,
  maxMovement,
  onRemoveAction,
  onClearTurn,
  onSetMovement,
}: TurnSummaryPanelProps) {
  const [copied, setCopied] = useState(false);

  // Combine turn actions with movement if used
  const allActions = [...turnActions];
  if (movementUsed > 0 && !allActions.find(a => a.type === 'movement')) {
    allActions.push({
      type: 'movement',
      description: `${movementUsed}ft used`,
    });
  }

  const turnSummary = formatTurnSummary(allActions);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(turnSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Combat Turn Summary',
          text: turnSummary,
        });
      } catch (e) {
        // User cancelled or error
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  const getActionIcon = (type: TurnAction['type']) => {
    switch (type) {
      case 'action': return Sword;
      case 'bonus': return Zap;
      case 'reaction': return Shield;
      case 'movement': return Footprints;
    }
  };

  const getActionColor = (type: TurnAction['type']) => {
    switch (type) {
      case 'action': return 'text-red-400 bg-red-500/20';
      case 'bonus': return 'text-amber-400 bg-amber-500/20';
      case 'reaction': return 'text-cyan-400 bg-cyan-500/20';
      case 'movement': return 'text-green-400 bg-green-500/20';
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-green-400" />
          <span className="text-sm font-mono text-green-400">YOUR TURN PLAN</span>
        </div>
        {allActions.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearTurn}
            className="h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Turn Actions List */}
      {allActions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No actions planned yet</p>
          <p className="text-[11px] text-red-400 italic mt-2">
            "Select abilities from other tabs to build your turn"
          </p>
        </div>
      ) : (
        <div className="flex-1 space-y-3 overflow-auto">
          {/* Action */}
          <TurnActionCard
            type="action"
            action={allActions.find(a => a.type === 'action')}
            onRemove={() => {
              const idx = turnActions.findIndex(a => a.type === 'action');
              if (idx >= 0) onRemoveAction(idx);
            }}
          />

          {/* Bonus Action */}
          <TurnActionCard
            type="bonus"
            action={allActions.find(a => a.type === 'bonus')}
            onRemove={() => {
              const idx = turnActions.findIndex(a => a.type === 'bonus');
              if (idx >= 0) onRemoveAction(idx);
            }}
          />

          {/* Movement */}
          <TurnActionCard
            type="movement"
            action={allActions.find(a => a.type === 'movement')}
            placeholder={`${maxMovement}ft available`}
            onEdit={() => onSetMovement(`${movementUsed}ft toward target`)}
          />

          {/* Reaction */}
          <TurnActionCard
            type="reaction"
            action={allActions.find(a => a.type === 'reaction')}
            placeholder="Set trigger..."
            onRemove={() => {
              const idx = turnActions.findIndex(a => a.type === 'reaction');
              if (idx >= 0) onRemoveAction(idx);
            }}
          />
        </div>
      )}

      {/* Output Section */}
      {allActions.length > 0 && (
        <div className="mt-4 space-y-3">
          {/* Formatted Output Preview */}
          <div className="p-3 bg-black/40 border border-cyan-500/30 rounded-lg">
            <div className="text-[10px] text-muted-foreground font-mono mb-2">
              FORMATTED OUTPUT
            </div>
            <pre className="text-xs text-foreground whitespace-pre-wrap font-mono">
              {turnSummary}
            </pre>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={copyToClipboard}
              className="flex-1 h-14 text-base bg-cyan-600/20 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-600/30"
            >
              {copied ? (
                <Check className="w-5 h-5 mr-2" />
              ) : (
                <Copy className="w-5 h-5 mr-2" />
              )}
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </Button>
            <Button
              onClick={shareNative}
              variant="outline"
              className="h-14 px-4 border-muted/40"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TurnActionCard({
  type,
  action,
  placeholder,
  onRemove,
  onEdit,
}: {
  type: TurnAction['type'];
  action?: TurnAction;
  placeholder?: string;
  onRemove?: () => void;
  onEdit?: () => void;
}) {
  const Icon = action ? (
    type === 'action' ? Sword :
    type === 'bonus' ? Zap :
    type === 'reaction' ? Shield :
    Footprints
  ) : (
    type === 'action' ? Sword :
    type === 'bonus' ? Zap :
    type === 'reaction' ? Shield :
    Footprints
  );

  const colorClass = action 
    ? (type === 'action' ? 'border-red-500/50 bg-red-500/10' :
       type === 'bonus' ? 'border-amber-500/50 bg-amber-500/10' :
       type === 'reaction' ? 'border-cyan-500/50 bg-cyan-500/10' :
       'border-green-500/50 bg-green-500/10')
    : 'border-muted/30 bg-muted/5';

  const iconColor = 
    type === 'action' ? 'text-red-400' :
    type === 'bonus' ? 'text-amber-400' :
    type === 'reaction' ? 'text-cyan-400' :
    'text-green-400';

  const typeLabel = 
    type === 'action' ? 'ACTION' :
    type === 'bonus' ? 'BONUS ACTION' :
    type === 'reaction' ? 'REACTION' :
    'MOVEMENT';

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border transition-all",
      colorClass
    )}>
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center",
        action ? 'bg-background/50' : 'bg-muted/20'
      )}>
        <Icon className={cn("w-5 h-5", action ? iconColor : 'text-muted-foreground')} />
      </div>
      
      <div className="flex-1">
        <div className="text-[10px] font-mono text-muted-foreground">
          {typeLabel}
        </div>
        <div className={cn(
          "text-sm",
          action ? 'text-foreground' : 'text-muted-foreground italic'
        )}>
          {action?.description || placeholder || '(Available)'}
        </div>
        {action?.roll && (
          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
            Roll: {action.roll}
          </div>
        )}
      </div>

      {action && onRemove && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-8 w-8 text-red-400 hover:bg-red-500/20"
        >
          <X className="w-4 h-4" />
        </Button>
      )}

      {!action && onEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-8 text-xs border border-muted/30"
        >
          Edit
        </Button>
      )}
    </div>
  );
}
