import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Eye, Shield, AlertTriangle, X, Dices, Check, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { getConcentrationCheckDC } from '@/lib/magic/calculations';
import { useToast } from '@/hooks/use-toast';

interface ConcentrationCheckPanelProps {
  /** The spell currently being concentrated on */
  concentratingSpellName: string | null;
  /** CON modifier for the save */
  conModifier: number;
  /** Proficiency bonus if proficient in CON saves */
  proficiencyBonus?: number;
  /** Whether character is proficient in CON saves */
  isProficientInConSaves?: boolean;
  /** Callback when concentration breaks */
  onBreakConcentration: () => void;
  /** Optional: callback when damage is taken (for HP tracking integration) */
  onDamageTaken?: (damage: number) => void;
}

export function ConcentrationCheckPanel({
  concentratingSpellName,
  conModifier,
  proficiencyBonus = 0,
  isProficientInConSaves = false,
  onBreakConcentration,
  onDamageTaken,
}: ConcentrationCheckPanelProps) {
  const [isCheckDialogOpen, setIsCheckDialogOpen] = useState(false);
  const [damageInput, setDamageInput] = useState('');
  const [checkResult, setCheckResult] = useState<'success' | 'fail' | null>(null);
  const [lastRoll, setLastRoll] = useState<{ roll: number; total: number; dc: number } | null>(null);
  const { toast } = useToast();

  if (!concentratingSpellName) return null;

  const saveBonus = conModifier + (isProficientInConSaves ? proficiencyBonus : 0);

  const handleOpenCheck = (presetDamage?: number) => {
    if (presetDamage) {
      setDamageInput(presetDamage.toString());
    }
    setCheckResult(null);
    setLastRoll(null);
    setIsCheckDialogOpen(true);
  };

  const handleRollCheck = () => {
    const damage = parseInt(damageInput) || 0;
    if (damage <= 0) return;

    const dc = getConcentrationCheckDC(damage);
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + saveBonus;
    const success = total >= dc || roll === 20;
    const critFail = roll === 1;

    setLastRoll({ roll, total, dc });
    setCheckResult(critFail ? 'fail' : success ? 'success' : 'fail');

    // Notify HP tracker if callback provided
    if (onDamageTaken) {
      onDamageTaken(damage);
    }
  };

  const handleConfirmResult = () => {
    if (checkResult === 'fail') {
      onBreakConcentration();
      toast({
        title: '💔 Concentration Broken',
        description: `${concentratingSpellName} has ended.`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: '✨ Concentration Maintained!',
        description: `You're still concentrating on ${concentratingSpellName}.`,
        className: 'border-emerald-500 bg-emerald-500/10',
      });
    }
    setIsCheckDialogOpen(false);
    setDamageInput('');
    setCheckResult(null);
    setLastRoll(null);
  };

  return (
    <>
      {/* Concentration Indicator with Check Button */}
      <Card className="bg-amber-500/20 border-amber-500/40">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-amber-400 animate-pulse" />
              <div>
                <div className="text-sm font-medium text-amber-200">
                  Concentrating: {concentratingSpellName}
                </div>
                <div className="text-[10px] text-amber-300/70">
                  CON Save: +{saveBonus}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20"
                onClick={() => handleOpenCheck()}
              >
                <Shield className="w-4 h-4 mr-1" />
                <span className="text-xs">Check</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-400 hover:text-rose-400 hover:bg-rose-500/20"
                onClick={onBreakConcentration}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Quick Damage Buttons */}
          <div className="flex gap-1 mt-2">
            {[5, 10, 15, 20].map((dmg) => (
              <Button
                key={dmg}
                variant="ghost"
                size="sm"
                className="flex-1 h-7 text-xs text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/20"
                onClick={() => handleOpenCheck(dmg)}
              >
                {dmg} dmg
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Concentration Check Dialog */}
      <Dialog open={isCheckDialogOpen} onOpenChange={setIsCheckDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              Concentration Check
            </DialogTitle>
            <DialogDescription>
              Make a Constitution saving throw to maintain {concentratingSpellName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Damage Input */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Damage Taken</label>
              <Input
                type="number"
                placeholder="Enter damage amount..."
                value={damageInput}
                onChange={(e) => setDamageInput(e.target.value)}
                className="text-center text-lg"
              />
              {damageInput && parseInt(damageInput) > 0 && (
                <div className="text-center">
                  <Badge variant="outline" className="text-amber-400 border-amber-500/50">
                    DC {getConcentrationCheckDC(parseInt(damageInput) || 0)}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-2">
                    (10 or half damage, whichever is higher)
                  </span>
                </div>
              )}
            </div>

            {/* Roll Result */}
            {lastRoll && (
              <div className={cn(
                "p-4 rounded-lg border text-center",
                checkResult === 'success' 
                  ? "bg-emerald-500/20 border-emerald-500/40"
                  : "bg-rose-500/20 border-rose-500/40"
              )}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  {checkResult === 'success' ? (
                    <Check className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <XCircle className="w-6 h-6 text-rose-400" />
                  )}
                  <span className={cn(
                    "text-2xl font-bold",
                    checkResult === 'success' ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {checkResult === 'success' ? 'SUCCESS!' : 'FAILED!'}
                  </span>
                </div>
                
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="text-muted-foreground">Roll: </span>
                    <span className={cn(
                      "font-mono font-bold",
                      lastRoll.roll === 20 ? "text-amber-400" : lastRoll.roll === 1 ? "text-rose-400" : ""
                    )}>
                      {lastRoll.roll}
                      {lastRoll.roll === 20 && " (Natural 20!)"}
                      {lastRoll.roll === 1 && " (Critical Fail!)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total: </span>
                    <span className="font-mono">{lastRoll.roll} + {saveBonus} = {lastRoll.total}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">DC: </span>
                    <span className="font-mono">{lastRoll.dc}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Save Bonus Display */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-white/10">
              <span className="text-sm text-muted-foreground">Your CON Save</span>
              <span className="font-mono font-bold text-amber-400">+{saveBonus}</span>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            {!lastRoll ? (
              <>
                <Button variant="outline" onClick={() => setIsCheckDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleRollCheck}
                  disabled={!damageInput || parseInt(damageInput) <= 0}
                  className="bg-amber-600 hover:bg-amber-500"
                >
                  <Dices className="w-4 h-4 mr-2" />
                  Roll CON Save
                </Button>
              </>
            ) : (
              <Button 
                onClick={handleConfirmResult}
                className={cn(
                  "w-full",
                  checkResult === 'success' 
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-rose-600 hover:bg-rose-500"
                )}
              >
                {checkResult === 'success' ? 'Continue Concentrating' : 'End Concentration'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================
// COMPACT INLINE VERSION FOR HP WIDGET
// ============================================

interface ConcentrationCheckInlineProps {
  concentratingSpellName: string | null;
  conModifier: number;
  proficiencyBonus?: number;
  isProficientInConSaves?: boolean;
  onBreakConcentration: () => void;
  /** The damage amount that was just taken */
  damageTaken: number;
  /** Callback when check is resolved */
  onCheckResolved: (maintained: boolean) => void;
}

export function ConcentrationCheckInline({
  concentratingSpellName,
  conModifier,
  proficiencyBonus = 0,
  isProficientInConSaves = false,
  onBreakConcentration,
  damageTaken,
  onCheckResolved,
}: ConcentrationCheckInlineProps) {
  const [checkResult, setCheckResult] = useState<'success' | 'fail' | null>(null);
  const [lastRoll, setLastRoll] = useState<{ roll: number; total: number; dc: number } | null>(null);
  const { toast } = useToast();

  if (!concentratingSpellName || damageTaken <= 0) return null;

  const dc = getConcentrationCheckDC(damageTaken);
  const saveBonus = conModifier + (isProficientInConSaves ? proficiencyBonus : 0);

  const handleRoll = () => {
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + saveBonus;
    const success = total >= dc || roll === 20;
    const critFail = roll === 1;
    const result = critFail ? 'fail' : success ? 'success' : 'fail';

    setLastRoll({ roll, total, dc });
    setCheckResult(result);

    // Auto-resolve after a moment
    setTimeout(() => {
      if (result === 'fail') {
        onBreakConcentration();
        toast({
          title: '💔 Concentration Broken',
          description: `${concentratingSpellName} has ended.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: '✨ Concentration Maintained!',
          description: `Still concentrating on ${concentratingSpellName}.`,
          className: 'border-emerald-500 bg-emerald-500/10',
        });
      }
      onCheckResolved(result === 'success');
    }, 1500);
  };

  if (lastRoll) {
    return (
      <div className={cn(
        "p-3 rounded-lg border animate-pulse",
        checkResult === 'success' 
          ? "bg-emerald-500/20 border-emerald-500/40"
          : "bg-rose-500/20 border-rose-500/40"
      )}>
        <div className="flex items-center justify-center gap-2">
          {checkResult === 'success' ? (
            <Check className="w-5 h-5 text-emerald-400" />
          ) : (
            <XCircle className="w-5 h-5 text-rose-400" />
          )}
          <span className={cn(
            "font-bold",
            checkResult === 'success' ? "text-emerald-400" : "text-rose-400"
          )}>
            {lastRoll.roll}{lastRoll.roll === 20 ? '!' : ''} + {saveBonus} = {lastRoll.total} vs DC {dc}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg bg-amber-500/20 border border-amber-500/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <div>
            <div className="text-xs text-amber-200">Concentration Check!</div>
            <div className="text-[10px] text-amber-300/70">
              DC {dc} • +{saveBonus} CON Save
            </div>
          </div>
        </div>
        <Button
          size="sm"
          className="h-7 bg-amber-600 hover:bg-amber-500"
          onClick={handleRoll}
        >
          <Dices className="w-3 h-3 mr-1" />
          Roll
        </Button>
      </div>
    </div>
  );
}
