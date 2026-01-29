import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { TurnAction, formatTurnSummary } from '@/lib/combat/combatTypes';
import { DiceRoll } from '@/lib/diceRoller';
import {
  Copy,
  Trash2,
  Calculator,
  FileText,
  Check,
  Dices,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import '../combat/CombatHUDStyles.css';

interface RollBuilderPanelProps {
  currentRoll: {
    name: string;
    conditions: string[];
    rollFormula: string;
    damageFormula: string;
  } | null;
  turnActions: TurnAction[];
  onClearTurn: () => void;
  onRemoveAction: (index: number) => void;
}

export function RollBuilderPanel({
  currentRoll,
  turnActions,
  onClearTurn,
  onRemoveAction,
}: RollBuilderPanelProps) {
  const [copied, setCopied] = useState(false);
  const [showDamageCalc, setShowDamageCalc] = useState(false);

  const turnSummary = formatTurnSummary(turnActions);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyTurnSummary = () => {
    copyToClipboard(turnSummary);
  };

  const copyCurrentRoll = () => {
    if (!currentRoll) return;
    const rollText = `[${currentRoll.name}] (${currentRoll.conditions.join(', ')}): ${currentRoll.rollFormula} to hit | Damage: ${currentRoll.damageFormula}`;
    copyToClipboard(rollText);
  };

  return (
    <div className="hud-panel">
      <div className="flex gap-3">
        {/* Active Roll Display - Left 60% */}
        <div className="flex-[3] space-y-2">
          <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-2">
            <Dices className="w-3.5 h-3.5 text-red-400" />
            ACTIVE ROLL
          </div>
          
          {currentRoll ? (
            <div className="p-2 bg-black/40 border border-red-500/30 rounded">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-red-300">
                  {currentRoll.name}
                </span>
                <div className="flex gap-1">
                  {currentRoll.conditions.map(c => (
                    <span key={c} className="text-[9px] px-1 py-0.5 bg-green-500/20 text-green-300 rounded">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                <span className="text-amber-300">{currentRoll.rollFormula}</span>
                {' to hit | Damage: '}
                <span className="text-red-300">{currentRoll.damageFormula}</span>
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyCurrentRoll}
                  className="h-6 px-2 text-[10px] border border-muted/30"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  Copy
                </Button>
                <Dialog open={showDamageCalc} onOpenChange={setShowDamageCalc}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] border border-muted/30"
                    >
                      <Calculator className="w-3 h-3" />
                      Modify
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm bg-background border-red-900/50">
                    <DialogHeader>
                      <DialogTitle className="font-cinzel text-red-400">
                        Damage Calculator
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground">
                        Step-by-step damage calculation worksheet
                      </DialogDescription>
                    </DialogHeader>
                    <DamageCalculator />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-black/30 border border-muted/20 rounded text-center">
              <p className="text-xs text-muted-foreground">
                Select a weapon or ability to build a roll
              </p>
              <p className="text-[10px] text-red-400/60 mt-1 italic">
                "What are you waiting for?"
              </p>
            </div>
          )}
        </div>

        {/* Turn Summary - Right 40% */}
        <div className="flex-[2] space-y-2">
          <div className="text-[10px] font-mono text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              TURN SUMMARY
            </div>
            {turnActions.length > 0 && (
              <button
                onClick={onClearTurn}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="p-2 bg-black/40 border border-cyan-500/30 rounded min-h-[60px]">
            {turnActions.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-2">
                Actions will appear here
              </p>
            ) : (
              <div className="space-y-1">
                {turnActions.map((action, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-1 text-[10px] group"
                  >
                    <span className={cn(
                      "font-mono uppercase",
                      action.type === 'action' && "text-red-300",
                      action.type === 'bonus' && "text-amber-300",
                      action.type === 'reaction' && "text-cyan-300",
                      action.type === 'movement' && "text-green-300"
                    )}>
                      {action.type === 'bonus' ? 'BONUS:' : `${action.type.toUpperCase()}:`}
                    </span>
                    <span className="flex-1 text-foreground">{action.description}</span>
                    {action.roll && (
                      <span className="text-muted-foreground">({action.roll})</span>
                    )}
                    <button
                      onClick={() => onRemoveAction(index)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {turnActions.length > 0 && (
            <Button
              onClick={copyTurnSummary}
              className="w-full h-7 text-[10px] bg-cyan-600/20 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-600/30"
            >
              {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
              Copy Turn Summary
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Damage Calculator Modal Content
function DamageCalculator() {
  const [didHit, setDidHit] = useState(false);
  const [isCritical, setIsCritical] = useState(false);
  const [addSneakAttack, setAddSneakAttack] = useState(false);
  const [additionalDamage, setAdditionalDamage] = useState('');
  const [baseDamage, setBaseDamage] = useState('1d6+4');
  const [sneakDice, setSneakDice] = useState('3d6');

  // Calculate total (simplified display)
  let totalDisplay = baseDamage;
  if (addSneakAttack) totalDisplay += ` + ${sneakDice}`;
  if (additionalDamage) totalDisplay += ` + ${additionalDamage}`;
  if (isCritical) totalDisplay = `(${totalDisplay}) x2 dice`;

  return (
    <div className="space-y-4">
      {/* Step 1: Did attack hit? */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Step 1:</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={didHit}
            onCheckedChange={(v) => setDidHit(v as boolean)}
          />
          <span className="text-sm">Attack Hit?</span>
        </label>
      </div>

      {didHit && (
        <>
          {/* Step 2: Was it critical? */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Step 2:</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={isCritical}
                onCheckedChange={(v) => setIsCritical(v as boolean)}
              />
              <span className="text-sm">Critical Hit? (doubles dice)</span>
            </label>
          </div>

          {/* Step 3: Add sneak attack? */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Step 3:</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={addSneakAttack}
                onCheckedChange={(v) => setAddSneakAttack(v as boolean)}
              />
              <span className="text-sm">Add Sneak Attack?</span>
            </label>
            {addSneakAttack && (
              <span className="text-xs text-green-400">+{sneakDice}</span>
            )}
          </div>

          {/* Step 4: Additional damage */}
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Step 4: Additional Damage</span>
            <Input
              value={additionalDamage}
              onChange={(e) => setAdditionalDamage(e.target.value)}
              placeholder="e.g., 2d6 poison"
              className="h-8 text-sm bg-black/30"
            />
          </div>

          {/* Total */}
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
            <div className="text-[10px] text-muted-foreground mb-1">TOTAL DAMAGE</div>
            <div className="text-lg font-bold text-red-300 font-mono">
              {totalDisplay}
            </div>
          </div>
        </>
      )}

      {!didHit && (
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-sm">Attack missed</p>
          <p className="text-[10px] text-red-400 italic mt-1">
            "Maybe next time, slugger."
          </p>
        </div>
      )}
    </div>
  );
}
