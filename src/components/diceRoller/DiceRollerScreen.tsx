import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Copy, Check, Dices, Sparkles, Swords, Eye, MessageCircle, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DICE_CONFIG,
  DICE_ORDER,
  SKILLS,
  ABILITY_SCORES,
  AI_DM_PROMPTS,
  formatPromptWithRoll,
  type DieSize,
  type AbilityScore,
  type AIPromptTemplate,
} from '@/lib/diceRollerConfig';
import { rollDie } from '@/lib/diceRoller';

interface DiceRollerScreenProps {
  onBack: () => void;
}

interface RollResult {
  die: DieSize;
  result: number;
  timestamp: number;
  label?: string;
}

// Haptic feedback helper
const triggerHaptic = (intensity: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = { light: 10, medium: 25, heavy: 50 };
    navigator.vibrate(patterns[intensity]);
  }
};

export function DiceRollerScreen({ onBack }: DiceRollerScreenProps) {
  const { toast } = useToast();
  const [currentRoll, setCurrentRoll] = useState<RollResult | null>(null);
  const [rollHistory, setRollHistory] = useState<RollResult[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<AIPromptTemplate | null>(null);
  const [promptSheetOpen, setPromptSheetOpen] = useState(false);

  // Roll a die with animation
  const rollDice = useCallback((die: DieSize, label?: string) => {
    setIsRolling(true);
    triggerHaptic('medium');

    // Animate through random numbers
    const sides = DICE_CONFIG[die].sides;
    let iterations = 0;
    const maxIterations = 10;
    
    const animate = setInterval(() => {
      iterations++;
      setCurrentRoll({
        die,
        result: Math.floor(Math.random() * sides) + 1,
        timestamp: Date.now(),
        label,
      });

      if (iterations >= maxIterations) {
        clearInterval(animate);
        const finalResult = rollDie(sides);
        const newRoll: RollResult = {
          die,
          result: finalResult,
          timestamp: Date.now(),
          label,
        };
        setCurrentRoll(newRoll);
        setRollHistory(prev => [newRoll, ...prev.slice(0, 19)]);
        setIsRolling(false);
        triggerHaptic('heavy');
      }
    }, 50);
  }, []);

  // Roll skill check (d20)
  const rollSkill = useCallback((skillName: string, ability: AbilityScore) => {
    rollDice('d20', `${skillName} (${ABILITY_SCORES[ability].abbr})`);
  }, [rollDice]);

  // Roll saving throw (d20)
  const rollSave = useCallback((ability: AbilityScore) => {
    rollDice('d20', `${ABILITY_SCORES[ability].name} Save`);
  }, [rollDice]);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      triggerHaptic('light');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast({
        title: 'Copy Failed',
        description: 'Unable to copy to clipboard',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Copy roll result
  const copyRollResult = useCallback(() => {
    if (!currentRoll) return;
    const text = currentRoll.label 
      ? `${currentRoll.label}: ${currentRoll.result} (${currentRoll.die})`
      : `${currentRoll.die}: ${currentRoll.result}`;
    copyToClipboard(text, 'roll-result');
  }, [currentRoll, copyToClipboard]);

  // Handle AI prompt selection
  const handlePromptSelect = (prompt: AIPromptTemplate) => {
    setSelectedPrompt(prompt);
    setPromptSheetOpen(true);
  };

  // Copy formatted prompt
  const copyPrompt = useCallback(() => {
    if (!selectedPrompt || !currentRoll) return;
    const formatted = formatPromptWithRoll(selectedPrompt.prompt, currentRoll.result);
    copyToClipboard(formatted, `prompt-${selectedPrompt.id}`);
    toast({
      title: 'Prompt Copied!',
      description: `"${selectedPrompt.name}" prompt copied with roll ${currentRoll.result}`,
      className: 'border-primary bg-primary/10',
    });
    setPromptSheetOpen(false);
  }, [selectedPrompt, currentRoll, copyToClipboard, toast]);

  // Check if roll is critical
  const isCritical = currentRoll?.die === 'd20' && currentRoll?.result === 20;
  const isFumble = currentRoll?.die === 'd20' && currentRoll?.result === 1;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-cinzel font-bold text-lg">Dice Roller</h1>
          <p className="text-xs text-muted-foreground">Roll dice & generate AI prompts</p>
        </div>
        <motion.div
          animate={isRolling ? { rotate: 360 } : { rotate: 0 }}
          transition={{ duration: 0.3, repeat: isRolling ? Infinity : 0, ease: 'linear' }}
        >
          <Dices className="w-6 h-6 text-primary" />
        </motion.div>
      </header>

      {/* Current Roll Display */}
      <div className="p-4 border-b border-border bg-gradient-to-b from-card/80 to-transparent">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentRoll?.timestamp ?? 'empty'}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="flex flex-col items-center gap-2"
          >
            {currentRoll ? (
              <>
                <motion.div
                  animate={isRolling ? { 
                    scale: [1, 1.1, 1],
                    rotate: [0, 10, -10, 0],
                  } : {}}
                  transition={{ duration: 0.1, repeat: isRolling ? Infinity : 0 }}
                  className={cn(
                    'text-6xl font-cinzel font-bold tabular-nums',
                    isCritical && 'text-tier-maxed animate-pulse',
                    isFumble && 'text-destructive',
                    !isCritical && !isFumble && DICE_CONFIG[currentRoll.die].color,
                  )}
                >
                  {currentRoll.result}
                </motion.div>
                {currentRoll.label && (
                  <Badge variant="outline" className="font-cinzel">
                    {currentRoll.label}
                  </Badge>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{currentRoll.die.toUpperCase()}</span>
                  {isCritical && <span className="text-tier-maxed font-bold">✦ CRITICAL! ✦</span>}
                  {isFumble && <span className="text-destructive font-bold">✗ FUMBLE ✗</span>}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyRollResult}
                  className="gap-2 mt-1"
                  disabled={isRolling}
                >
                  {copiedId === 'roll-result' ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Result
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Dices className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Tap a die to roll</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="dice" className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-4 mx-4 mt-4">
          <TabsTrigger value="dice" className="gap-1 text-xs">
            <Dices className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dice</span>
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-1 text-xs">
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Skills</span>
          </TabsTrigger>
          <TabsTrigger value="saves" className="gap-1 text-xs">
            <Swords className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Saves</span>
          </TabsTrigger>
          <TabsTrigger value="prompts" className="gap-1 text-xs">
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI DM</span>
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 px-4 py-4">
          {/* Dice Tab */}
          <TabsContent value="dice" className="mt-0 space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {DICE_ORDER.map((die) => {
                const config = DICE_CONFIG[die];
                return (
                  <motion.button
                    key={die}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => rollDice(die)}
                    disabled={isRolling}
                    className={cn(
                      'aspect-square rounded-xl border-2 border-border bg-card/50',
                      'flex flex-col items-center justify-center gap-1',
                      'hover:bg-card hover:border-primary/50 transition-all',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      config.color,
                    )}
                  >
                    <span className="text-2xl font-cinzel font-bold uppercase">{die}</span>
                    <span className="text-[10px] text-muted-foreground">1-{config.sides}</span>
                  </motion.button>
                );
              })}
            </div>

            {/* Roll History */}
            {rollHistory.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-cinzel text-muted-foreground uppercase tracking-wider">
                  History
                </h3>
                <div className="flex flex-wrap gap-2">
                  {rollHistory.slice(0, 10).map((roll, i) => (
                    <Badge
                      key={roll.timestamp}
                      variant="outline"
                      className={cn(
                        'font-mono',
                        roll.die === 'd20' && roll.result === 20 && 'border-tier-maxed text-tier-maxed',
                        roll.die === 'd20' && roll.result === 1 && 'border-destructive text-destructive',
                      )}
                    >
                      {roll.die}: {roll.result}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Skills Tab */}
          <TabsContent value="skills" className="mt-0 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {SKILLS.map((skill) => {
                const abilityConfig = ABILITY_SCORES[skill.ability];
                return (
                  <motion.button
                    key={skill.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => rollSkill(skill.name, skill.ability)}
                    disabled={isRolling}
                    className={cn(
                      'p-3 rounded-lg border border-border bg-card/50',
                      'flex items-center gap-2 text-left',
                      'hover:bg-card hover:border-primary/30 transition-all',
                      'disabled:opacity-50',
                    )}
                  >
                    <Badge variant="outline" className={cn('text-[10px] shrink-0', abilityConfig.color)}>
                      {abilityConfig.abbr}
                    </Badge>
                    <span className="text-sm font-medium truncate">{skill.name}</span>
                  </motion.button>
                );
              })}
            </div>
          </TabsContent>

          {/* Saves Tab */}
          <TabsContent value="saves" className="mt-0 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(ABILITY_SCORES) as AbilityScore[]).map((ability) => {
                const config = ABILITY_SCORES[ability];
                return (
                  <motion.button
                    key={ability}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => rollSave(ability)}
                    disabled={isRolling}
                    className={cn(
                      'p-4 rounded-xl border-2 border-border bg-card/50',
                      'flex flex-col items-center gap-2',
                      'hover:bg-card hover:border-primary/30 transition-all',
                      'disabled:opacity-50',
                    )}
                  >
                    <span className={cn('text-2xl font-cinzel font-bold', config.color)}>
                      {config.abbr}
                    </span>
                    <span className="text-xs text-muted-foreground">{config.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      Save
                    </Badge>
                  </motion.button>
                );
              })}
            </div>
          </TabsContent>

          {/* AI Prompts Tab */}
          <TabsContent value="prompts" className="mt-0 space-y-4">
            {!currentRoll && (
              <div className="p-4 rounded-lg bg-muted/50 border border-border text-center">
                <Sparkles className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
                <p className="text-sm text-muted-foreground">
                  Roll a die first, then select a prompt to generate AI DM text
                </p>
              </div>
            )}

            {/* Combat Prompts */}
            <div className="space-y-2">
              <h3 className="text-xs font-cinzel uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Swords className="w-3.5 h-3.5 text-red-400" />
                Combat
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {AI_DM_PROMPTS.filter(p => p.category === 'combat').map((prompt) => (
                  <PromptButton
                    key={prompt.id}
                    prompt={prompt}
                    onClick={() => handlePromptSelect(prompt)}
                    disabled={!currentRoll}
                    currentRoll={currentRoll?.result}
                  />
                ))}
              </div>
            </div>

            {/* Exploration Prompts */}
            <div className="space-y-2">
              <h3 className="text-xs font-cinzel uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                Exploration
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {AI_DM_PROMPTS.filter(p => p.category === 'exploration').map((prompt) => (
                  <PromptButton
                    key={prompt.id}
                    prompt={prompt}
                    onClick={() => handlePromptSelect(prompt)}
                    disabled={!currentRoll}
                    currentRoll={currentRoll?.result}
                  />
                ))}
              </div>
            </div>

            {/* Social Prompts */}
            <div className="space-y-2">
              <h3 className="text-xs font-cinzel uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <MessageCircle className="w-3.5 h-3.5 text-pink-400" />
                Social
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {AI_DM_PROMPTS.filter(p => p.category === 'social').map((prompt) => (
                  <PromptButton
                    key={prompt.id}
                    prompt={prompt}
                    onClick={() => handlePromptSelect(prompt)}
                    disabled={!currentRoll}
                    currentRoll={currentRoll?.result}
                  />
                ))}
              </div>
            </div>

            {/* Utility Prompts */}
            <div className="space-y-2">
              <h3 className="text-xs font-cinzel uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-slate-400" />
                Utility
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {AI_DM_PROMPTS.filter(p => p.category === 'utility').map((prompt) => (
                  <PromptButton
                    key={prompt.id}
                    prompt={prompt}
                    onClick={() => handlePromptSelect(prompt)}
                    disabled={!currentRoll}
                    currentRoll={currentRoll?.result}
                  />
                ))}
              </div>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Prompt Detail Sheet */}
      <Sheet open={promptSheetOpen} onOpenChange={setPromptSheetOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-xl">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <SheetHeader className="mb-4">
            <SheetTitle className="font-cinzel flex items-center gap-2">
              {selectedPrompt?.name}
              {currentRoll && (
                <Badge variant="outline" className="ml-2">
                  Roll: {currentRoll.result}
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          {selectedPrompt && currentRoll && (
            <div className="space-y-4">
              <ScrollArea className="h-[200px] rounded-lg border border-border bg-muted/30 p-4">
                <pre className="text-sm whitespace-pre-wrap font-body">
                  {formatPromptWithRoll(selectedPrompt.prompt, currentRoll.result)}
                </pre>
              </ScrollArea>

              <Button
                onClick={copyPrompt}
                className="w-full gap-2"
                size="lg"
              >
                {copiedId === `prompt-${selectedPrompt.id}` ? (
                  <>
                    <Check className="w-5 h-5" />
                    Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copy Prompt
                  </>
                )}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Prompt Button Component
interface PromptButtonProps {
  prompt: AIPromptTemplate;
  onClick: () => void;
  disabled?: boolean;
  currentRoll?: number;
}

function PromptButton({ prompt, onClick, disabled, currentRoll }: PromptButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-3 rounded-lg border border-border bg-card/50',
        'flex items-center gap-3 text-left',
        'hover:bg-card hover:border-primary/30 transition-all',
        'disabled:opacity-40 disabled:cursor-not-allowed',
      )}
    >
      <div className={cn('w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0', prompt.color)}>
        <Sparkles className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{prompt.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {disabled ? 'Roll a die first' : `Generate with roll ${currentRoll}`}
        </p>
      </div>
      <Copy className="w-4 h-4 text-muted-foreground shrink-0" />
    </motion.button>
  );
}
