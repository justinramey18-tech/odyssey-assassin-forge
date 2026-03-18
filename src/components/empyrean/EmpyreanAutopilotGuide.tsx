import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  loadAutopilotGuide,
  saveAutopilotGuide,
  loadAutopilotBiases,
  saveAutopilotBiases,
  DEFAULT_BIASES,
  type AutopilotBiases,
} from '@/lib/empyreanDMPersona';

interface EmpyreanAutopilotGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterName: string;
  dragonName: string;
  onEnableAutopilot?: () => void;
}

const BIAS_CONFIG = [
  { key: 'caution' as const, label: 'Caution', left: 'Reckless', right: 'Cautious' },
  { key: 'obedience' as const, label: 'Obedience', left: 'Rebellious', right: 'Obedient' },
  { key: 'dragonFirst' as const, label: 'Priority', left: 'Mission-First', right: 'Dragon-First' },
  { key: 'trust' as const, label: 'Trust', left: 'Suspicious', right: 'Trusting' },
  { key: 'violence' as const, label: 'Violence', left: 'Pacifist', right: 'Aggressive' },
] as const;

export function EmpyreanAutopilotGuide({
  open,
  onOpenChange,
  characterName,
  dragonName,
  onEnableAutopilot,
}: EmpyreanAutopilotGuideProps) {
  const [guide, setGuide] = useState('');
  const [biases, setBiases] = useState<AutopilotBiases>(DEFAULT_BIASES);

  useEffect(() => {
    if (open) {
      setGuide(loadAutopilotGuide());
      setBiases(loadAutopilotBiases());
    }
  }, [open]);

  const presets = [
    {
      label: '🛡️ Loyal Soldier',
      text: `${characterName} follows orders, trusts the chain of command, fights defensively, and prioritizes squad safety. They defer to authority and avoid unnecessary risks.`,
    },
    {
      label: '🔥 Rebellious Rider',
      text: `${characterName} questions everything, trusts their gut over orders, fights aggressively, and will break rules to protect the people they care about. Authority is earned, not given.`,
    },
    {
      label: '🧠 Strategic Thinker',
      text: `${characterName} observes before acting, gathers information, avoids direct confrontation when possible, and always has an exit plan. They trust their dragon's judgment over their own emotions.`,
    },
  ];

  const handleSave = () => {
    saveAutopilotGuide(guide);
    saveAutopilotBiases(biases);
    toast.success('Autopilot guide saved.');
  };

  const handleEnableAutopilot = () => {
    handleSave();
    onEnableAutopilot?.();
    onOpenChange(false);
  };

  const updateBias = (key: keyof AutopilotBiases, value: number) => {
    setBiases(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto border-t border-purple-500/20">
        <SheetHeader className="text-left pb-3">
          <SheetTitle className="font-cinzel text-purple-300 text-base">🤖 Autopilot Guide</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Describe how your character behaves when autopilot takes over.
          </SheetDescription>
        </SheetHeader>

        {/* Section 1 — Personality Guide */}
        <div className="space-y-3 pb-4">
          <textarea
            value={guide}
            onChange={(e) => setGuide(e.target.value.slice(0, 5000))}
            placeholder={`Example: ${characterName} is cautious in combat but bold in social situations. They always protect their dragon first and question authority when orders seem wrong.`}
            className="w-full h-28 text-xs bg-background border border-purple-500/20 rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:border-purple-400/50"
            maxLength={5000}
          />
          <p className="text-[10px] text-muted-foreground text-right">{guide.length}/5000</p>

          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => setGuide(p.text)}
                className="text-[11px] px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 2 — Decision Biases */}
        <div className="space-y-4 pb-4">
          <h3 className="font-cinzel text-purple-300 text-sm">Decision Biases</h3>
          {BIAS_CONFIG.map(({ key, left, right }) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{left}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 h-4 ${biases[key] === 0 ? 'border-purple-400/60 text-purple-300' : 'border-border text-muted-foreground'}`}
                >
                  {biases[key] > 0 ? `+${biases[key]}` : biases[key]}
                </Badge>
                <span className="text-muted-foreground">{right}</span>
              </div>
              <Slider
                min={-2}
                max={2}
                step={1}
                value={[biases[key]]}
                onValueChange={([v]) => updateBias(key, v)}
                className="accent-purple-500 [&_[role=slider]]:border-purple-500 [&_span:first-child>span]:bg-purple-500"
              />
            </div>
          ))}
        </div>

        <SheetFooter className="flex-row gap-2 pt-2">
          <Button variant="outline" onClick={handleSave} className="flex-1 text-xs">
            Save
          </Button>
          {onEnableAutopilot && (
            <Button onClick={handleEnableAutopilot} className="flex-1 text-xs bg-purple-600 hover:bg-purple-700 text-primary-foreground">
              Enable Autopilot
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}