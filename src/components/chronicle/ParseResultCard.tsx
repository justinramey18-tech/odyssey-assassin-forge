// Chronicle Sync Parse Result Card
// Displays individual parsed change with confidence badge

import { Check, X, AlertTriangle, HelpCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ConfidenceLevel, ReviewableChange } from '@/lib/chronicleSync/types';

interface ParseResultCardProps {
  change: ReviewableChange;
  onToggleApproval: (id: string) => void;
}

export function ParseResultCard({ change, onToggleApproval }: ParseResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className={cn(
      "border rounded-lg p-3 transition-all",
      change.approved
        ? "border-emerald-500/30 bg-emerald-500/5"
        : "border-zinc-700/50 bg-zinc-800/20 opacity-60"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <CategoryIcon category={change.category} />
            <span className="text-sm font-medium truncate">{change.description}</span>
            <ConfidenceBadge confidence={change.confidence} />
          </div>
          
          {change.sourceText && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Hide source' : 'Show source'}
            </button>
          )}
          
          {expanded && change.sourceText && (
            <blockquote className="mt-2 pl-3 border-l-2 border-blue-500/40 text-xs text-muted-foreground italic">
              "{change.sourceText.slice(0, 150)}{change.sourceText.length > 150 ? '...' : ''}"
            </blockquote>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleApproval(change.id)}
          className={cn(
            "shrink-0 h-8 w-8 p-0",
            change.approved
              ? "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/30"
          )}
        >
          {change.approved ? (
            <Check className="w-5 h-5" />
          ) : (
            <X className="w-5 h-5" />
          )}
        </Button>
      </div>
    </div>
  );
}

function CategoryIcon({ category }: { category: ReviewableChange['category'] }) {
  const iconClass = "w-4 h-4";
  
  switch (category) {
    case 'xp':
      return <span className={cn(iconClass, "text-yellow-400")}>✨</span>;
    case 'achievement':
      return <span className={cn(iconClass, "text-purple-400")}>🏆</span>;
    case 'item':
      return <span className={cn(iconClass, "text-blue-400")}>📦</span>;
    case 'levelUp':
      return <span className={cn(iconClass, "text-amber-400")}>⬆️</span>;
    default:
      return null;
  }
}

export function ConfidenceBadge({ confidence }: { confidence: ConfidenceLevel }) {
  const config = {
    high: {
      icon: CheckCircle,
      label: 'High',
      className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    },
    medium: {
      icon: AlertTriangle,
      label: 'Medium',
      className: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    },
    low: {
      icon: HelpCircle,
      label: 'Low',
      className: 'bg-red-500/20 text-red-400 border-red-500/30',
    },
  };
  
  const { icon: Icon, label, className } = config[confidence];
  
  return (
    <Badge variant="outline" className={cn("gap-1 text-xs px-1.5 py-0", className)}>
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
}
