// Chronicle Sync Display-Only Alerts
// Shows HP, gold, and conditions that require manual application

import { useState } from 'react';
import { Heart, Coins, Shield, Copy, Check, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ParsedHPChange, ParsedGoldChange, ParsedCondition } from '@/lib/chronicleSync/types';

interface DisplayOnlyAlertsProps {
  hpChanges: ParsedHPChange[];
  goldChanges: ParsedGoldChange[];
  conditions: ParsedCondition[];
}

export function DisplayOnlyAlerts({ hpChanges, goldChanges, conditions }: DisplayOnlyAlertsProps) {
  const hasAny = hpChanges.length > 0 || goldChanges.length > 0 || conditions.length > 0;
  
  if (!hasAny) return null;
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <span>The following require manual application:</span>
      </div>
      
      {hpChanges.length > 0 && <HPChangeAlert changes={hpChanges} />}
      {goldChanges.length > 0 && <GoldChangeAlert changes={goldChanges} />}
      {conditions.length > 0 && <ConditionsAlert conditions={conditions} />}
    </div>
  );
}

function HPChangeAlert({ changes }: { changes: ParsedHPChange[] }) {
  const totalDamage = changes
    .filter(c => c.type === 'damage')
    .reduce((sum, c) => sum + Math.abs(c.amount), 0);
  const totalHealing = changes
    .filter(c => c.type === 'healing')
    .reduce((sum, c) => sum + c.amount, 0);
  
  return (
    <Alert className="border-rose-500/30 bg-rose-500/5">
      <Heart className="h-4 w-4 text-rose-400" />
      <AlertTitle className="text-rose-400">HP Changes Detected</AlertTitle>
      <AlertDescription className="text-sm">
        <ul className="mt-2 space-y-1">
          {changes.map((hp, i) => (
            <li key={i} className="flex items-center gap-2">
              {hp.type === 'damage' ? (
                <span className="text-rose-400">❤️ Damage: {Math.abs(hp.amount)}</span>
              ) : (
                <span className="text-emerald-400">💚 Healing: {hp.amount}</span>
              )}
              {hp.source && (
                <span className="text-muted-foreground text-xs">({hp.source.slice(0, 30)})</span>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 pt-2 border-t border-border/30 text-xs text-muted-foreground">
          Net: {totalHealing - totalDamage > 0 ? '+' : ''}{totalHealing - totalDamage} HP
          <span className="ml-2">• Apply these in the Stats drawer</span>
        </div>
      </AlertDescription>
    </Alert>
  );
}

function GoldChangeAlert({ changes }: { changes: ParsedGoldChange[] }) {
  const totalGained = changes
    .filter(c => c.action === 'gained')
    .reduce((sum, c) => sum + c.amount, 0);
  const totalSpent = changes
    .filter(c => c.action === 'spent')
    .reduce((sum, c) => sum + c.amount, 0);
  const net = totalGained - totalSpent;
  
  return (
    <Alert className="border-amber-500/30 bg-amber-500/5">
      <Coins className="h-4 w-4 text-amber-400" />
      <AlertTitle className="text-amber-400">Gold Changes Detected</AlertTitle>
      <AlertDescription className="text-sm">
        <ul className="mt-2 space-y-1">
          {changes.map((gold, i) => (
            <li key={i} className="flex items-center gap-2">
              {gold.action === 'gained' ? (
                <span className="text-amber-400">+{gold.amount} GP gained</span>
              ) : (
                <span className="text-red-400">-{gold.amount} GP spent</span>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 pt-2 border-t border-border/30 text-xs text-muted-foreground">
          Net: {net >= 0 ? '+' : ''}{net} GP
          <span className="ml-2">• Track this manually (no gold system in MVP)</span>
        </div>
      </AlertDescription>
    </Alert>
  );
}

function ConditionsAlert({ conditions }: { conditions: ParsedCondition[] }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    const text = conditions
      .map(c => `${c.action === 'applied' ? 'Applied' : 'Removed'}: ${c.name}`)
      .join('\n');
    
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copied!", description: "Conditions copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };
  
  return (
    <Alert className="border-purple-500/30 bg-purple-500/5">
      <Shield className="h-4 w-4 text-purple-400" />
      <AlertTitle className="text-purple-400 flex items-center justify-between">
        <span>Conditions Detected</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </AlertTitle>
      <AlertDescription className="text-sm">
        <div className="flex flex-wrap gap-2 mt-2">
          {conditions.map((cond, i) => (
            <Badge
              key={i}
              variant="outline"
              className={cond.action === 'applied' 
                ? 'border-red-500/30 text-red-400 bg-red-500/10' 
                : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
              }
            >
              {cond.action === 'applied' ? '+' : '-'} {cond.name}
            </Badge>
          ))}
        </div>
        <div className="mt-3 pt-2 border-t border-border/30 text-xs text-muted-foreground">
          Track conditions manually in your character sheet
        </div>
      </AlertDescription>
    </Alert>
  );
}
