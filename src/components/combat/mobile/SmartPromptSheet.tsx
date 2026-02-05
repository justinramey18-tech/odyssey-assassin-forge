import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CombatLogEntry } from '@/hooks/use-combat-log';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  Zap,
  BookOpen,
  Skull,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

type SynthesisMode = 'simplified' | 'high-rp' | 'deadpool';

interface SmartPromptSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: CombatLogEntry[];
  characterName: string;
}

const STORAGE_KEY_MODE = 'odyssey-combat-synthesis-mode';
const STORAGE_KEY_CHAOS = 'odyssey-combat-chaos-level';

const MODE_CONFIG = {
  simplified: {
    icon: Zap,
    label: 'Simplified',
    description: 'Quick tactical summary',
    color: 'text-slate-400 bg-slate-500/20 border-slate-500/40',
    activeColor: 'text-slate-200 bg-slate-500/40 border-slate-400',
  },
  'high-rp': {
    icon: BookOpen,
    label: 'High Granularity RP',
    description: 'Cinematic narrative prose',
    color: 'text-amber-400 bg-amber-500/20 border-amber-500/40',
    activeColor: 'text-amber-200 bg-amber-500/40 border-amber-400',
  },
  deadpool: {
    icon: Skull,
    label: 'Deadpool',
    description: 'Fourth-wall chaos',
    color: 'text-red-400 bg-red-500/20 border-red-500/40',
    activeColor: 'text-red-200 bg-red-500/40 border-red-400',
  },
} as const;

const CHAOS_LABELS: Record<number, string> = {
  1: 'Mild Quips',
  2: 'Light Meta',
  3: 'Regular Chaos',
  4: 'Getting Spicy',
  5: 'Standard Deadpool',
  6: 'Elevated Chaos',
  7: 'High Chaos',
  8: 'Maximum Effort',
  9: 'UNHINGED',
  10: 'CHIMICHANGA MODE',
};

export function SmartPromptSheet({
  open,
  onOpenChange,
  entries,
  characterName,
}: SmartPromptSheetProps) {
  const { toast } = useToast();
  
  // Load saved preferences
  const [mode, setMode] = useState<SynthesisMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MODE);
      return (saved as SynthesisMode) || 'simplified';
    } catch {
      return 'simplified';
    }
  });
  
  const [chaosLevel, setChaosLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CHAOS);
      return saved ? parseInt(saved, 10) : 5;
    } catch {
      return 5;
    }
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Save preferences when they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MODE, mode);
    } catch {}
  }, [mode]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CHAOS, String(chaosLevel));
    } catch {}
  }, [chaosLevel]);

  // Reset state when sheet opens
  useEffect(() => {
    if (open) {
      setSynthesis(null);
      setError(null);
    }
  }, [open]);

  const handleGenerate = useCallback(async () => {
    if (entries.length === 0) return;
    
    setIsGenerating(true);
    setError(null);
    setSynthesis(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/combat-log-synthesize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            entries: entries.map(e => ({
              actionType: e.actionType,
              actionName: e.actionName,
              prompt: e.prompt,
              roll: e.roll,
              damage: e.damage,
            })),
            mode,
            characterName,
            chaosLevel: mode === 'deadpool' ? chaosLevel : undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate synthesis');
      }

      setSynthesis(data.synthesis);
      
      toast({
        title: 'Synthesis Complete',
        description: `Generated ${mode === 'deadpool' ? 'chaotic' : mode === 'high-rp' ? 'epic' : 'tactical'} narrative!`,
        className: 'border-primary bg-primary/10',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      toast({
        title: 'Generation Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [entries, mode, characterName, chaosLevel, toast]);

  const handleCopy = useCallback(async () => {
    if (!synthesis) return;
    await navigator.clipboard.writeText(synthesis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied!',
      description: 'Synthesis copied to clipboard',
    });
  }, [synthesis, toast]);

  const handleModeChange = (newMode: SynthesisMode) => {
    setMode(newMode);
    setSynthesis(null);
    setError(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
        <SheetHeader className="p-4 pb-2 border-b border-white/10">
          <SheetTitle className="flex items-center gap-2 text-primary">
            <Sparkles className="w-5 h-5" />
            AI Smart Prompt
            <span className="text-xs text-muted-foreground font-normal ml-2">
              {entries.length} action{entries.length !== 1 ? 's' : ''} logged
            </span>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 h-[calc(85vh-120px)]">
          <div className="p-4 space-y-6">
            {/* Mode Selection */}
            <div className="space-y-3">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                Synthesis Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(MODE_CONFIG) as SynthesisMode[]).map((modeKey) => {
                  const config = MODE_CONFIG[modeKey];
                  const Icon = config.icon;
                  const isActive = mode === modeKey;
                  
                  return (
                    <button
                      key={modeKey}
                      onClick={() => handleModeChange(modeKey)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all",
                        isActive ? config.activeColor : config.color,
                        isActive && "ring-2 ring-white/20"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-semibold">{config.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {MODE_CONFIG[mode].description}
              </p>
            </div>

            {/* Chaos Slider (Deadpool only) */}
            {mode === 'deadpool' && (
              <div className="space-y-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-red-400 uppercase tracking-wider">
                    Chaos Intensity
                  </label>
                  <span className="text-sm font-bold text-red-300">
                    {chaosLevel}/10
                  </span>
                </div>
                <Slider
                  value={[chaosLevel]}
                  onValueChange={([val]) => setChaosLevel(val)}
                  min={1}
                  max={10}
                  step={1}
                  className="[&_[role=slider]]:bg-red-500 [&_[role=slider]]:border-red-400"
                />
                <p className="text-xs text-red-300/80 text-center font-medium">
                  {CHAOS_LABELS[chaosLevel]}
                </p>
              </div>
            )}

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || entries.length === 0}
              className={cn(
                "w-full h-14 text-base font-bold rounded-xl",
                mode === 'deadpool' 
                  ? "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
                  : mode === 'high-rp'
                    ? "bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400"
                    : "bg-gradient-to-r from-slate-600 to-slate-500 hover:from-slate-500 hover:to-slate-400"
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Synthesizing...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate {mode === 'deadpool' ? 'Chaos' : mode === 'high-rp' ? 'Epic Narrative' : 'Summary'}
                </>
              )}
            </Button>

            {/* Error Display */}
            {error && (
              <div className="p-4 rounded-xl bg-destructive/20 border border-destructive/40 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Generation Failed</p>
                  <p className="text-xs text-destructive/80 mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Synthesis Result */}
            {synthesis && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                    Result
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="h-8 text-xs"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5 mr-1", isGenerating && "animate-spin")} />
                      Regenerate
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopy}
                      className={cn("h-8 text-xs", copied && "text-green-400")}
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className={cn(
                  "p-4 rounded-xl border bg-black/40",
                  mode === 'deadpool' 
                    ? "border-red-500/30"
                    : mode === 'high-rp'
                      ? "border-amber-500/30"
                      : "border-slate-500/30"
                )}>
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown>{synthesis}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State Hint */}
            {entries.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm">
                  Log some combat actions first, then return here to synthesize them!
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
