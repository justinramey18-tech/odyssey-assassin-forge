import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Wand2, Loader2, ScrollText, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorldBuilder, WorldBuilderState } from '@/hooks/use-worldbuilder';
import ReactMarkdown from 'react-markdown';

// ── Data ──────────────────────────────────────────────────────────────────────

const GENRES = ['Dark Fantasy', 'High Fantasy', 'Gritty Noir', 'Cosmic Horror', 'Sword & Sorcery', 'Custom'];
const TONES = ['Heroic', 'Grimdark', 'Mystery', 'Political Intrigue', 'Survival', 'Custom'];

const SETTINGS = [
  { id: 'City Underbelly', icon: '🌆', label: 'City Underbelly', desc: 'Thieves, guilds & narrow streets' },
  { id: 'Cursed Wilderness', icon: '🌲', label: 'Cursed Wilderness', desc: 'Haunted lands, dangerous travel' },
  { id: 'Ancient Dungeon', icon: '🏛️', label: 'Ancient Dungeon', desc: 'Ruins, traps, forgotten gods' },
  { id: 'Frontier Town', icon: '🏜️', label: 'Frontier Town', desc: 'Lawless, frontier justice' },
  { id: 'Noble Court', icon: '👑', label: 'Noble Court', desc: 'Intrigue, politics, masks' },
  { id: 'Open Seas', icon: '⚓', label: 'Open Seas', desc: 'Pirates, island exploration' },
];

const FACTIONS_BY_SETTING: Record<string, string[]> = {
  'City Underbelly': ["Thieves' Guild", 'City Watch', 'Merchant Consortium', 'Church Inquisitors', 'Shadow Brotherhood'],
  'Cursed Wilderness': ['Druid Circle', 'Monster Hunters', 'Cursed Cultists', 'Wandering Tribes', 'Royal Expedition'],
  'Ancient Dungeon': ['Treasure Seekers', 'Undead Guardians', 'Rival Delvers', 'Arcane Scholars', 'Death Cult'],
  'Frontier Town': ['Cattle Barons', 'Outlaw Gang', 'Settlers Guild', 'Indigenous Tribe', 'Marshal Office'],
  'Noble Court': ['Royal House', 'Shadow Council', 'Foreign Diplomats', "Assassin's Guild", 'Church Authority'],
  'Open Seas': ['Pirate Fleet', 'Merchant Navy', 'Sea Monsters', 'Island Nation', 'Navy Hunters'],
};

const CONFLICT_SUGGESTIONS: Record<string, string> = {
  'Dark Fantasy': 'A corruption spreads from an ancient source, twisting both land and minds',
  'High Fantasy': 'A prophesied relic has surfaced, and every faction wants it for different reasons',
  'Gritty Noir': 'A powerful figure was murdered and everyone in power wants the truth buried',
  'Cosmic Horror': 'Something ancient has awakened beneath the earth and its influence grows daily',
  'Sword & Sorcery': 'A legendary warrior-king died without an heir and war brews between claimants',
  'Custom': 'Define your own conflict',
};

const HOOK_STARTERS = [
  "I'm a hired blade with no allegiance — until now.",
  "I'm searching for someone who disappeared without a trace.",
  "I owe a debt I can never repay, and it's time to make things right.",
];

// ── Sub-components ────────────────────────────────────────────────────────────

function PillButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-2 rounded-xl text-sm font-cinzel border transition-all',
        selected
          ? 'bg-amber-900/60 border-amber-400/60 text-amber-200'
          : 'bg-white/5 border-white/10 text-white/60 hover:border-amber-500/30 hover:text-white/80',
      )}
    >
      {children}
    </button>
  );
}

// ── Step Components ───────────────────────────────────────────────────────────

function StepGenreTone({ state, update }: { state: WorldBuilderState; update: (u: Partial<WorldBuilderState>) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-cinzel uppercase tracking-widest text-amber-400/70 mb-3">Genre</h3>
        <div className="flex flex-wrap gap-2">
          {GENRES.map(g => (
            <PillButton key={g} selected={state.genre === g} onClick={() => update({ genre: g })}>
              {g}
            </PillButton>
          ))}
        </div>
        {state.genre === 'Custom' && (
          <input
            className="mt-2 w-full bg-white/5 border border-amber-900/40 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40"
            placeholder="Describe your genre…"
            onChange={e => update({ genre: e.target.value || 'Custom' })}
          />
        )}
      </div>
      <div>
        <h3 className="text-xs font-cinzel uppercase tracking-widest text-amber-400/70 mb-3">Tone</h3>
        <div className="flex flex-wrap gap-2">
          {TONES.map(t => (
            <PillButton key={t} selected={state.tone === t} onClick={() => update({ tone: t })}>
              {t}
            </PillButton>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepSetting({ state, update }: { state: WorldBuilderState; update: (u: Partial<WorldBuilderState>) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {SETTINGS.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => update({ setting: s.id, selectedFactions: [] })}
            className={cn(
              'flex flex-col items-start p-3 rounded-xl border text-left transition-all',
              state.setting === s.id
                ? 'bg-amber-900/50 border-amber-400/50'
                : 'bg-white/5 border-white/10 hover:border-amber-500/30',
            )}
          >
            <span className="text-xl mb-1">{s.icon}</span>
            <span className={cn('text-sm font-cinzel', state.setting === s.id ? 'text-amber-200' : 'text-white/80')}>{s.label}</span>
            <span className="text-[11px] text-white/40 mt-0.5">{s.desc}</span>
          </button>
        ))}
      </div>
      <div>
        <label className="text-xs font-cinzel uppercase tracking-widest text-amber-400/70 mb-2 block">
          Setting Notes <span className="text-white/30">(optional)</span>
        </label>
        <textarea
          value={state.settingNotes}
          onChange={e => update({ settingNotes: e.target.value })}
          placeholder="Add custom flavour, details, or lore for your setting…"
          rows={2}
          className="w-full bg-white/5 border border-amber-900/40 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 resize-none"
        />
      </div>
    </div>
  );
}

function StepFactions({ state, update }: { state: WorldBuilderState; update: (u: Partial<WorldBuilderState>) => void }) {
  const factions = FACTIONS_BY_SETTING[state.setting] ?? ['Ruling Power', 'Rebels', 'Neutral Guild', 'Foreign Influence', 'Secret Society'];
  const conflictHint = CONFLICT_SUGGESTIONS[state.genre] || '';

  const toggleFaction = (f: string) => {
    const current = state.selectedFactions;
    if (current.includes(f)) {
      update({ selectedFactions: current.filter(x => x !== f) });
    } else if (current.length < 3) {
      update({ selectedFactions: [...current, f] });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xs font-cinzel uppercase tracking-widest text-amber-400/70 mb-1">
          Factions <span className="text-white/30">— pick up to 3</span>
        </h3>
        <div className="flex flex-wrap gap-2 mt-2">
          {factions.map(f => {
            const sel = state.selectedFactions.includes(f);
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggleFaction(f)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-all',
                  sel
                    ? 'bg-amber-900/50 border-amber-400/50 text-amber-200'
                    : 'bg-white/5 border-white/10 text-white/60 hover:border-amber-500/30 hover:text-white/80',
                  !sel && state.selectedFactions.length >= 3 && 'opacity-40 cursor-not-allowed',
                )}
              >
                {sel && <Check className="w-3 h-3 text-amber-400" />}
                {f}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-xs font-cinzel uppercase tracking-widest text-amber-400/70 mb-2 block">
          Core Conflict
        </label>
        {conflictHint && !state.conflict && (
          <button
            type="button"
            onClick={() => update({ conflict: conflictHint })}
            className="w-full text-left text-xs text-white/40 italic bg-white/5 border border-dashed border-white/10 rounded-xl px-3 py-2 hover:border-amber-500/30 hover:text-white/60 transition-all mb-2"
          >
            💡 {conflictHint}
          </button>
        )}
        <textarea
          value={state.conflict}
          onChange={e => update({ conflict: e.target.value })}
          placeholder="What is the central conflict? Who wants what, and why does it matter?"
          rows={2}
          className="w-full bg-white/5 border border-amber-900/40 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 resize-none"
        />
      </div>
    </div>
  );
}

function StepHook({ state, update }: { state: WorldBuilderState; update: (u: Partial<WorldBuilderState>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-cinzel uppercase tracking-widest text-amber-400/70 mb-3">
          Quick Starters
        </h3>
        <div className="space-y-2">
          {HOOK_STARTERS.map(h => (
            <button
              key={h}
              type="button"
              onClick={() => update({ characterHook: h })}
              className={cn(
                'w-full text-left text-sm px-3 py-2.5 rounded-xl border transition-all',
                state.characterHook === h
                  ? 'bg-amber-900/50 border-amber-400/50 text-amber-200'
                  : 'bg-white/5 border-white/10 text-white/60 hover:border-amber-500/30 italic',
              )}
            >
              "{h}"
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-cinzel uppercase tracking-widest text-amber-400/70 mb-2 block">
          Your Hook <span className="text-white/30">(edit or write your own)</span>
        </label>
        <textarea
          value={state.characterHook}
          onChange={e => update({ characterHook: e.target.value })}
          placeholder="How does your character fit into this world? What's their connection, goal, or burden?"
          rows={4}
          className="w-full bg-white/5 border border-amber-900/40 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 resize-none"
        />
      </div>
    </div>
  );
}

function StepGenerate({
  state,
  isGenerating,
  generatedBible,
  generatedWorldName,
  onGenerate,
}: {
  state: WorldBuilderState;
  isGenerating: boolean;
  generatedBible: string | null;
  generatedWorldName: string | null;
  onGenerate: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      {!generatedBible && (
        <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl p-4 space-y-2.5">
          <h3 className="text-xs font-cinzel uppercase tracking-widest text-amber-400/70">Your Choices</h3>
          <div className="space-y-1 text-sm">
            <SummaryRow label="Genre" value={state.genre || '—'} />
            <SummaryRow label="Tone" value={state.tone || '—'} />
            <SummaryRow label="Setting" value={state.setting || '—'} />
            {state.settingNotes && <SummaryRow label="Notes" value={state.settingNotes} />}
            {state.selectedFactions.length > 0 && <SummaryRow label="Factions" value={state.selectedFactions.join(', ')} />}
            {state.conflict && <SummaryRow label="Conflict" value={state.conflict} />}
            {state.characterHook && <SummaryRow label="Your Hook" value={state.characterHook} />}
          </div>
        </div>
      )}

      {/* Generated bible preview */}
      {generatedBible && (
        <div className="overflow-y-auto max-h-[280px] bg-amber-950/20 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ScrollText className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-cinzel uppercase tracking-widest text-amber-400/70">
              {generatedWorldName || 'Campaign World'} — Generated
            </span>
          </div>
          <div className="text-sm prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-base font-cinzel text-amber-300 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-cinzel text-amber-300/80 mb-1.5 mt-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-xs font-cinzel text-amber-300/60 mb-1 mt-2">{children}</h3>,
                p: ({ children }) => <p className="text-white/70 mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="text-amber-200">{children}</strong>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 text-white/60">{children}</ul>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
              }}
            >
              {generatedBible}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Generate button */}
      {!generatedBible && (
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-700/40 border border-amber-500/40 text-amber-200 font-cinzel hover:bg-amber-700/60 transition-all disabled:opacity-60"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              The gods are weaving your fate…
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Generate World
            </>
          )}
        </button>
      )}

      {generatedBible && (
        <p className="text-xs text-center text-white/40">
          Tap <span className="text-amber-400">Begin Adventure</span> below to save this world and start your campaign.
        </p>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-white/30 w-16 shrink-0">{label}:</span>
      <span className="text-white/70 flex-1 truncate">{value}</span>
    </div>
  );
}

// ── Main Wizard ────────────────────────────────────────────────────────────────

const STEPS = ['Genre & Tone', 'Setting', 'Factions & Conflict', 'Your Hook', 'Preview & Generate'];

interface WorldBuilderWizardProps {
  characterName: string;
  characterLevel: number;
  onComplete: (bible: string, worldName: string) => void;
  onSkip: () => void;
}

export function WorldBuilderWizard({ characterName, characterLevel, onComplete, onSkip }: WorldBuilderWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const {
    worldBuilderState,
    updateState,
    resetState,
    isGenerating,
    generatedBible,
    generatedWorldName,
    generateWorld,
  } = useWorldBuilder({ characterName, characterLevel });

  const isLastStep = currentStep === STEPS.length - 1;
  const isFirstStep = currentStep === 0;
  const canComplete = isLastStep && !!generatedBible;

  const handleNext = useCallback(() => {
    if (!isLastStep) setCurrentStep(s => s + 1);
  }, [isLastStep]);

  const handleBack = useCallback(() => {
    if (!isFirstStep) setCurrentStep(s => s - 1);
  }, [isFirstStep]);

  const handleSkip = useCallback(() => {
    resetState();
    onSkip();
  }, [resetState, onSkip]);

  const handleComplete = useCallback(() => {
    if (generatedBible) {
      onComplete(generatedBible, generatedWorldName || 'Campaign World');
    }
  }, [generatedBible, generatedWorldName, onComplete]);

  const handleGenerate = useCallback(async () => {
    await generateWorld();
  }, [generateWorld]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-gradient-to-b from-[#14080a] via-[#0d0d12] to-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-900/30 bg-black/40 shrink-0">
        <div className="flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-amber-400" />
          <span className="font-cinzel text-amber-200 text-sm">World Builder</span>
        </div>
        <button
          type="button"
          onClick={handleSkip}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/60 hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Start Blank
        </button>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 border-b border-amber-900/20 bg-black/20 shrink-0">
        {/* Step dots */}
        <div className="flex items-center gap-1.5 mb-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 rounded-full flex-1 transition-all duration-300',
                i < currentStep ? 'bg-amber-400' : i === currentStep ? 'bg-amber-500/80' : 'bg-white/10',
              )}
            />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-white/40 font-cinzel uppercase tracking-wider">
            Step {currentStep + 1} of {STEPS.length}
          </p>
          <p className="text-sm font-cinzel font-semibold text-amber-200">{STEPS[currentStep]}</p>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {currentStep === 0 && <StepGenreTone state={worldBuilderState} update={updateState} />}
            {currentStep === 1 && <StepSetting state={worldBuilderState} update={updateState} />}
            {currentStep === 2 && <StepFactions state={worldBuilderState} update={updateState} />}
            {currentStep === 3 && <StepHook state={worldBuilderState} update={updateState} />}
            {currentStep === 4 && (
              <StepGenerate
                state={worldBuilderState}
                isGenerating={isGenerating}
                generatedBible={generatedBible}
                generatedWorldName={generatedWorldName}
                onGenerate={handleGenerate}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer navigation */}
      <div className="px-4 py-3 border-t border-amber-900/30 bg-black/40 flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={handleBack}
          disabled={isFirstStep}
          className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        {canComplete ? (
          <button
            type="button"
            onClick={handleComplete}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-700/60 border border-amber-500/50 text-amber-100 font-cinzel hover:bg-amber-700/80 transition-all"
          >
            <Wand2 className="w-4 h-4" />
            Begin Adventure
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={isLastStep && isGenerating}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl border font-cinzel transition-all',
              isLastStep
                ? 'bg-amber-900/40 border-amber-500/30 text-amber-200 hover:bg-amber-900/60'
                : 'bg-amber-900/40 border-amber-500/30 text-amber-200 hover:bg-amber-900/60',
            )}
          >
            {isLastStep ? 'Generate' : 'Next'}
            {!isLastStep && <ChevronRight className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
