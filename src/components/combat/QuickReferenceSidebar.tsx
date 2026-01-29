import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronRight,
  Skull,
  Zap,
  Shield,
  Info,
  Eye,
  ChevronLeft,
  HelpCircle,
} from 'lucide-react';
import '../combat/CombatHUDStyles.css';

interface QuickReferenceSidebarProps {
  conditions: string[];
}

export function QuickReferenceSidebar({ conditions }: QuickReferenceSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [assassinOpen, setAssassinOpen] = useState(true);
  const [advantageOpen, setAdvantageOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [conditionsOpen, setConditionsOpen] = useState(false);

  // Check assassination requirements
  const hasSurprise = conditions.includes('targetSurprised');
  const hasAdvantage = conditions.includes('advantage') || conditions.includes('hidden');
  const assassinReady = hasSurprise && hasAdvantage;

  if (collapsed) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(false)}
          className="h-8 w-8 p-0 border border-red-900/40"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 p-0 border",
            assassinReady 
              ? "border-red-500/50 bg-red-500/20 text-red-400" 
              : "border-muted/30"
          )}
        >
          <Skull className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 border border-muted/30"
        >
          <Zap className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 border border-muted/30"
        >
          <HelpCircle className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="hud-panel hud-panel-secondary w-56 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-muted-foreground">QUICK REF</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(true)}
          className="h-6 w-6 p-0"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Assassination Requirements */}
      <Collapsible open={assassinOpen} onOpenChange={setAssassinOpen}>
        <CollapsibleTrigger asChild>
          <button className={cn(
            "w-full flex items-center justify-between p-2 rounded border transition-all",
            assassinReady 
              ? "bg-red-500/20 border-red-500/50 text-red-300" 
              : "bg-black/30 border-muted/30"
          )}>
            <div className="flex items-center gap-2">
              <Skull className="w-4 h-4" />
              <span className="text-xs font-semibold">Assassination</span>
            </div>
            <ChevronRight className={cn(
              "w-4 h-4 transition-transform",
              assassinOpen && "rotate-90"
            )} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 space-y-1">
          <div className={cn(
            "flex items-center gap-2 px-2 py-1 rounded text-[10px]",
            hasSurprise ? "bg-green-500/10 text-green-400" : "text-muted-foreground"
          )}>
            <span>{hasSurprise ? '✓' : '○'}</span>
            <span>Surprise Round Active</span>
          </div>
          <div className={cn(
            "flex items-center gap-2 px-2 py-1 rounded text-[10px]",
            hasAdvantage ? "bg-green-500/10 text-green-400" : "text-muted-foreground"
          )}>
            <span>{hasAdvantage ? '✓' : '○'}</span>
            <span>Have Advantage</span>
          </div>
          {assassinReady && (
            <div className="p-2 bg-red-500/10 rounded text-[10px] text-red-300 mt-2">
              <strong>= AUTO-CRIT!</strong> All damage dice doubled.
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Advantage/Disadvantage Sources */}
      <Collapsible open={advantageOpen} onOpenChange={setAdvantageOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-2 bg-black/30 border border-muted/30 rounded">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-400" />
              <span className="text-xs font-semibold">Adv/Disadv Sources</span>
            </div>
            <ChevronRight className={cn(
              "w-4 h-4 transition-transform",
              advantageOpen && "rotate-90"
            )} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="space-y-1 text-[10px]">
            <div className="text-green-400 font-mono">ADVANTAGE:</div>
            <ul className="space-y-0.5 text-muted-foreground pl-2">
              <li>• Hidden/Invisible</li>
              <li>• Flanking (optional rule)</li>
              <li>• Prone target (melee)</li>
              <li>• Restrained/Paralyzed target</li>
              <li>• Blinded target</li>
              <li>• Help action granted</li>
            </ul>
            <div className="text-red-400 font-mono mt-2">DISADVANTAGE:</div>
            <ul className="space-y-0.5 text-muted-foreground pl-2">
              <li>• You are blinded</li>
              <li>• Prone target (ranged)</li>
              <li>• Poisoned condition</li>
              <li>• Restrained</li>
              <li>• Long range attack</li>
            </ul>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Action Types */}
      <Collapsible open={actionsOpen} onOpenChange={setActionsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-2 bg-black/30 border border-muted/30 rounded">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold">Action Types</span>
            </div>
            <ChevronRight className={cn(
              "w-4 h-4 transition-transform",
              actionsOpen && "rotate-90"
            )} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="space-y-2 text-[10px]">
            <div>
              <span className="text-red-400 font-mono">ACTION:</span>
              <p className="text-muted-foreground">Attack, Cast Spell, Dash, Disengage, Dodge, Help, Hide, Ready, Search, Use Object</p>
            </div>
            <div>
              <span className="text-amber-400 font-mono">BONUS ACTION:</span>
              <p className="text-muted-foreground">Cunning Action, Off-hand attack, certain spells/abilities</p>
            </div>
            <div>
              <span className="text-cyan-400 font-mono">REACTION:</span>
              <p className="text-muted-foreground">Opportunity Attack, Uncanny Dodge, Evasion trigger</p>
            </div>
            <div>
              <span className="text-green-400 font-mono">FREE ACTION:</span>
              <p className="text-muted-foreground">Drop prone, drop item, brief communication</p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Common Conditions */}
      <Collapsible open={conditionsOpen} onOpenChange={setConditionsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-2 bg-black/30 border border-muted/30 rounded">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold">Conditions</span>
            </div>
            <ChevronRight className={cn(
              "w-4 h-4 transition-transform",
              conditionsOpen && "rotate-90"
            )} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="space-y-2 text-[10px]">
            <ConditionRef
              name="Invisible"
              effects="Heavily obscured. Advantage on attacks. Attacks against have disadvantage."
            />
            <ConditionRef
              name="Hidden"
              effects="Location unknown. Advantage on first attack. Reveal on attack/noise."
            />
            <ConditionRef
              name="Prone"
              effects="Disadvantage on attacks. Melee attacks against have advantage. Ranged have disadvantage."
            />
            <ConditionRef
              name="Restrained"
              effects="Speed 0. Attacks have disadvantage. Attacks against have advantage. Dex saves disadvantage."
            />
            <ConditionRef
              name="Stunned"
              effects="Incapacitated, can't move, speak stutteringly. Auto-fail Str/Dex saves. Attacks against have advantage."
            />
            <ConditionRef
              name="Poisoned"
              effects="Disadvantage on attack rolls and ability checks."
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function ConditionRef({ name, effects }: { name: string; effects: string }) {
  return (
    <div className="p-1.5 bg-black/20 rounded">
      <span className="text-purple-300 font-mono">{name}</span>
      <p className="text-muted-foreground mt-0.5">{effects}</p>
    </div>
  );
}
