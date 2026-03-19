import { useState, useCallback, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  EmpyreanDMConfig,
  CampaignFocus,
  saveEmpyreanDMConfig,
} from '@/lib/empyreanDMPersona';
import {
  EMPYREAN_LORE_GUIDES,
  EMPYREAN_META_GUIDES,
  EMPYREAN_SESSION_GUIDES,
  EmpyreanGuide,
} from '@/lib/empyreanGMGuides';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EmpyreanCampaignSetupProps {
  open: boolean;
  onClose: () => void;
  characterName: string;
  addGuide: (name: string, content: string, customId?: string) => boolean;
  deleteGuide: (id: string) => void;
  onComplete: (config: EmpyreanDMConfig) => void;
  onLaunchWithScene?: (config: EmpyreanDMConfig, openingPrompt: string) => void;
}

const STEPS = ['Your Rider', 'Campaign Focus', 'World Lore', 'Campaign Tone', 'Review & Launch'] as const;

const YEAR_OPTIONS = [
  { value: 'first-year', label: 'First-Year' },
  { value: 'second-year', label: 'Second-Year' },
  { value: 'third-year', label: 'Third-Year' },
  { value: 'graduated rider', label: 'Graduated Rider' },
];

const FOCUS_OPTIONS: { value: CampaignFocus; label: string; emoji: string; desc: string }[] = [
  { value: 'combat', label: 'Combat', emoji: '⚔️', desc: 'Tactical aerial battles & ward line skirmishes' },
  { value: 'political', label: 'Political', emoji: '👑', desc: 'Council intrigue & faction loyalty tests' },
  { value: 'romance', label: 'Romance', emoji: '💜', desc: 'Bond deepening & emotional vulnerability' },
  { value: 'mystery', label: 'Mystery', emoji: '🔮', desc: 'Forbidden lore & redacted histories' },
  { value: 'survival', label: 'Survival', emoji: '🏔️', desc: 'Beyond the ward line, resource scarcity' },
  { value: 'balanced', label: 'Balanced', emoji: '⚖️', desc: 'Mix all elements in shifting proportions' },
];

// Default lore selections (first 4)
const DEFAULT_LORE_IDS = new Set(
  EMPYREAN_LORE_GUIDES.slice(0, 4).map(g => g.id),
);

// Default meta selection
const DEFAULT_META_IDS = new Set(
  EMPYREAN_META_GUIDES.filter(g => g.name === 'Academy Life').map(g => g.id),
);

function generateOpeningScenePrompt(config: EmpyreanDMConfig): string {
  const { characterName, dragonName, signetType, yearAtBasgiath, campaignFocus } = config;
  
  const focusHooks: Record<string, string> = {
    combat: "There are rumors of Venin sightings near the northern frontier. The ward line flickered twice last night.",
    political: "A closed-door Empyrean council session just ended. The Commandant's expression as she left was unreadable.",
    romance: "The morning light catches someone's face across the mess hall — a moment of stillness in the chaos of Basgiath.",
    mystery: "A page is missing from the archives. The librarian insists it was never there. But you saw it yesterday.",
    survival: "Orders have come down: a reconnaissance mission beyond the ward line. Volunteers only. No one is volunteering.",
    balanced: "It's dawn at Basgiath. The mountain air bites. Today feels different — charged, like the sky before a storm.",
  };

  const hook = focusHooks[campaignFocus] || focusHooks.balanced;
  
  let prompt = `Begin the Empyrean Campaign. Set the opening scene at Basgiath War College.\n\n`;
  prompt += `My character is ${characterName}, a ${yearAtBasgiath} at Basgiath.`;
  if (dragonName) prompt += ` My bonded dragon is ${dragonName}.`;
  if (signetType) prompt += ` My signet ability is ${signetType}.`;
  prompt += `\n\n${hook}`;
  prompt += `\n\nDescribe my character waking up or arriving at a specific location in Basgiath. Set the atmosphere — the light, the weather, the sounds. Introduce the scene with rich detail and end with a moment that demands a choice or reaction. Do not control my character's actions or dialogue.`;
  
  return prompt;
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'w-2.5 h-2.5 rounded-full transition-all duration-300',
            i === current
              ? 'bg-purple-400 scale-125 shadow-[0_0_8px_rgba(168,85,247,0.5)]'
              : i < current
                ? 'bg-amber-500/70'
                : 'bg-muted-foreground/30',
          )}
        />
      ))}
    </div>
  );
}

function GuideToggleCard({
  guide,
  selected,
  onToggle,
}: {
  guide: EmpyreanGuide;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 p-3 rounded-lg border transition-all',
        selected
          ? 'border-purple-500/50 bg-purple-500/10'
          : 'border-border/40 bg-card/30',
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{guide.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{guide.description}</p>
      </div>
      <Switch checked={selected} onCheckedChange={onToggle} />
    </div>
  );
}

export function EmpyreanCampaignSetup({
  open,
  onClose,
  characterName,
  addGuide,
  deleteGuide,
  onComplete,
}: EmpyreanCampaignSetupProps) {
  const [step, setStep] = useState(0);

  // Step 1 — Rider
  const [dragonName, setDragonName] = useState('');
  const [signetType, setSignetType] = useState('');
  const [yearAtBasgiath, setYearAtBasgiath] = useState('first-year');

  // Step 2 — Focus
  const [campaignFocus, setCampaignFocus] = useState<CampaignFocus>('balanced');

  // Step 3 — Lore
  const [selectedLore, setSelectedLore] = useState<Set<string>>(() => new Set(DEFAULT_LORE_IDS));

  // Step 4 — Tone
  const [selectedTone, setSelectedTone] = useState<Set<string>>(() => new Set(DEFAULT_META_IDS));

  const toggleLore = useCallback((id: string) => {
    setSelectedLore(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleTone = useCallback((id: string) => {
    setSelectedTone(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const loreCharCount = useMemo(() => {
    return EMPYREAN_LORE_GUIDES
      .filter(g => selectedLore.has(g.id))
      .reduce((sum, g) => sum + g.content.length, 0);
  }, [selectedLore]);

  const toneCharCount = useMemo(() => {
    return EMPYREAN_META_GUIDES
      .filter(g => selectedTone.has(g.id))
      .reduce((sum, g) => sum + g.content.length, 0);
  }, [selectedTone]);

  const handleLaunch = useCallback(() => {
    const config: EmpyreanDMConfig = {
      selectedLoreGuides: Array.from(selectedLore),
      selectedToneGuides: Array.from(selectedTone),
      selectedSessionTemplate: null,
      characterName,
      dragonName,
      signetType,
      yearAtBasgiath,
      campaignFocus,
    };

    // Save config
    saveEmpyreanDMConfig(config);

    // Install selected lore guides
    const allGuides = [...EMPYREAN_LORE_GUIDES, ...EMPYREAN_META_GUIDES, ...EMPYREAN_SESSION_GUIDES];
    const selectedIds = new Set([...selectedLore, ...selectedTone]);

    // Remove previously installed Empyrean guides to prevent duplicates on reconfigure
    const allGuideIds = allGuides.map(g => g.id);
    for (const id of allGuideIds) {
      deleteGuide(id);
    }
    for (const guide of allGuides) {
      if (selectedIds.has(guide.id)) {
        addGuide(guide.name, guide.content, guide.id);
      }
    }

    onComplete(config);
    toast.success('Empyrean Campaign configured! Enter the DM to begin.');
    onClose();
  }, [selectedLore, selectedTone, characterName, dragonName, signetType, yearAtBasgiath, campaignFocus, addGuide, onComplete, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[62] flex flex-col bg-gradient-to-b from-[#1a0a2e] via-background to-background/95">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/20 bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">🐉</span>
          <h2 className="text-lg font-cinzel font-bold text-purple-300">Campaign Setup</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} total={STEPS.length} />
      <p className="text-center text-xs text-purple-400/70 font-cinzel -mt-1 mb-2">
        {STEPS[step]}
      </p>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 py-4 space-y-5 max-w-2xl mx-auto pb-28">
          {/* ── Step 1: Your Rider ── */}
          {step === 0 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-cinzel text-purple-200">Dragon Name</Label>
                <Input
                  value={dragonName}
                  onChange={e => setDragonName(e.target.value)}
                  placeholder="Optional — e.g. Tairn, Sgaeyl, Andarna"
                  className="bg-card/30 border-purple-500/30 focus:border-purple-400"
                />
                <p className="text-xs text-muted-foreground">Leave blank if unbonded or unknown.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-cinzel text-purple-200">Signet Ability</Label>
                <Input
                  value={signetType}
                  onChange={e => setSignetType(e.target.value)}
                  placeholder="e.g. lightning manipulation, temporal perception, gravitational shields"
                  className="bg-card/30 border-purple-500/30 focus:border-purple-400"
                />
                <p className="text-xs text-muted-foreground">Optional — leave blank if not yet manifested.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-cinzel text-purple-200">Year at Basgiath</Label>
                <Select value={yearAtBasgiath} onValueChange={setYearAtBasgiath}>
                  <SelectTrigger className="bg-card/30 border-purple-500/30 z-[70]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[70]">
                    {YEAR_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* ── Step 2: Campaign Focus ── */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {FOCUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setCampaignFocus(opt.value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all min-h-[100px] text-center',
                    campaignFocus === opt.value
                      ? 'border-purple-500 bg-purple-500/15 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                      : 'border-border/40 bg-card/30 hover:border-purple-500/30',
                  )}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className={cn(
                    'text-sm font-cinzel font-semibold',
                    campaignFocus === opt.value ? 'text-purple-300' : 'text-foreground',
                  )}>
                    {opt.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-tight">{opt.desc}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── Step 3: World Lore ── */}
          {step === 2 && (
            <div className="space-y-3">
              {EMPYREAN_LORE_GUIDES.map(guide => (
                <GuideToggleCard
                  key={guide.id}
                  guide={guide}
                  selected={selectedLore.has(guide.id)}
                  onToggle={() => toggleLore(guide.id)}
                />
              ))}
              <p className="text-xs text-muted-foreground text-center pt-2">
                {selectedLore.size} guides selected · ~{(loreCharCount / 1000).toFixed(1)}k characters
              </p>
            </div>
          )}

          {/* ── Step 4: Campaign Tone ── */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs text-amber-400/80 bg-amber-500/10 rounded-lg p-2.5 border border-amber-500/20">
                Pick 1–3 tone modifiers. They stack — choosing both "Military Realism" and "Horror Elements"
                creates a military horror campaign.
              </p>
              {EMPYREAN_META_GUIDES.map(guide => (
                <GuideToggleCard
                  key={guide.id}
                  guide={guide}
                  selected={selectedTone.has(guide.id)}
                  onToggle={() => toggleTone(guide.id)}
                />
              ))}
              <p className="text-xs text-muted-foreground text-center pt-2">
                {selectedTone.size} guides selected · ~{(toneCharCount / 1000).toFixed(1)}k characters
              </p>
            </div>
          )}

          {/* ── Step 5: Review & Launch ── */}
          {step === 4 && (
            <div className="space-y-4">
              {/* Rider summary */}
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4 space-y-2">
                <h3 className="text-sm font-cinzel font-semibold text-purple-300">🐉 Your Rider</h3>
                <div className="text-sm space-y-1 text-foreground/80">
                  <p><span className="text-muted-foreground">Character:</span> {characterName}</p>
                  {dragonName && <p><span className="text-muted-foreground">Dragon:</span> {dragonName}</p>}
                  {signetType && <p><span className="text-muted-foreground">Signet:</span> {signetType}</p>}
                  <p><span className="text-muted-foreground">Year:</span> {YEAR_OPTIONS.find(y => y.value === yearAtBasgiath)?.label}</p>
                </div>
              </div>

              {/* Focus summary */}
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4 space-y-2">
                <h3 className="text-sm font-cinzel font-semibold text-purple-300">
                  {FOCUS_OPTIONS.find(f => f.value === campaignFocus)?.emoji} Campaign Focus
                </h3>
                <p className="text-sm text-foreground/80">
                  {FOCUS_OPTIONS.find(f => f.value === campaignFocus)?.label} — {FOCUS_OPTIONS.find(f => f.value === campaignFocus)?.desc}
                </p>
              </div>

              {/* Lore summary */}
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4 space-y-2">
                <h3 className="text-sm font-cinzel font-semibold text-purple-300">📚 World Lore ({selectedLore.size})</h3>
                <div className="flex flex-wrap gap-1.5">
                  {EMPYREAN_LORE_GUIDES.filter(g => selectedLore.has(g.id)).map(g => (
                    <span key={g.id} className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                      {g.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tone summary */}
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                <h3 className="text-sm font-cinzel font-semibold text-amber-300">🎭 Campaign Tone ({selectedTone.size})</h3>
                <div className="flex flex-wrap gap-1.5">
                  {EMPYREAN_META_GUIDES.filter(g => selectedTone.has(g.id)).map(g => (
                    <span key={g.id} className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                      {g.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Launch button */}
              <Button
                onClick={handleLaunch}
                className="w-full h-12 gap-2 bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white font-cinzel text-base shadow-lg shadow-purple-500/20"
              >
                <Rocket className="w-5 h-5" />
                Launch Campaign
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="absolute bottom-0 inset-x-0 px-4 py-4 bg-gradient-to-t from-background via-background to-transparent">
        <div className="flex gap-3 max-w-2xl mx-auto">
          {step > 0 && (
            <Button
              variant="outline"
              onClick={() => setStep(s => s - 1)}
              className="flex-1 h-11 gap-1.5 border-purple-500/30 text-purple-300"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          )}
          {step < STEPS.length - 1 && (
            <Button
              onClick={() => setStep(s => s + 1)}
              className="flex-1 h-11 gap-1.5 bg-purple-600 hover:bg-purple-500 text-white"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
