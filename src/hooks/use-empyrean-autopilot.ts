import { useState, useCallback, useEffect, useRef } from 'react';
import {
  loadAutopilotGuide,
  loadAutopilotBiases,
  type AutopilotBiases,
} from '@/lib/empyreanDMPersona';

// ── Types ──────────────────────────────────────────────────────────────

export interface AutopilotChoice {
  id: string;
  label: string;
  prompt: string;
  biasAlignment: number; // -1 to 1
}

interface UseEmpyreanAutopilotOptions {
  enabled: boolean;
  characterName: string;
  dragonName: string;
  delaySeconds?: number;
  onSendAction: (action: string) => void;
  lastAssistantMessage: string | null;
  isLoading: boolean;
}

type Situation = 'combat' | 'social' | 'exploration' | 'general';

// ── Keyword detection ──────────────────────────────────────────────────

const COMBAT_KEYWORDS = ['attack', 'combat', 'initiative', 'sword', 'damage', 'enemy', 'strike', 'weapon', 'blade', 'arrows'];
const SOCIAL_KEYWORDS = ['says', 'asks', 'whispers', 'conversation', 'nods', 'speaks', 'replies', 'greets', 'smiles'];
const EXPLORATION_KEYWORDS = ['path', 'door', 'passage', 'forest', 'cave', 'explore', 'corridor', 'tunnel', 'trail', 'ruins'];
const ROLL_PATTERNS = /\b(roll a|make a|roll an)\b/i;

function detectSituation(text: string): Situation {
  const lower = text.toLowerCase();
  const scores = {
    combat: COMBAT_KEYWORDS.reduce((n, k) => n + (lower.includes(k) ? 1 : 0), 0),
    social: SOCIAL_KEYWORDS.reduce((n, k) => n + (lower.includes(k) ? 1 : 0), 0),
    exploration: EXPLORATION_KEYWORDS.reduce((n, k) => n + (lower.includes(k) ? 1 : 0), 0),
  };
  const max = Math.max(scores.combat, scores.social, scores.exploration);
  if (max === 0) return 'general';
  if (scores.combat === max) return 'combat';
  if (scores.social === max) return 'social';
  return 'exploration';
}

// ── Choice banks (templates) ───────────────────────────────────────────

type ChoiceTemplate = {
  label: string;
  prompt: (char: string, dragon: string) => string;
  biasKey: keyof AutopilotBiases | null;
  biasSign: number; // +1 means high value = high alignment
};

const BANKS: Record<Situation, ChoiceTemplate[]> = {
  combat: [
    {
      label: '⚔️ Aggressive Strike',
      prompt: (c) => `${c} charges forward, attacking the nearest enemy head-on.`,
      biasKey: 'violence', biasSign: 1,
    },
    {
      label: '🛡️ Defensive Hold',
      prompt: (c) => `${c} holds position and assesses the battlefield before committing.`,
      biasKey: 'caution', biasSign: 1,
    },
    {
      label: '🐉 Dragon Lead',
      prompt: (c, d) => `${c} directs ${d || 'their dragon'} to take the lead, trusting the dragon's instincts.`,
      biasKey: 'dragonFirst', biasSign: 1,
    },
    {
      label: '🎯 Creative Angle',
      prompt: (c) => `${c} looks for an environmental advantage or unexpected angle of attack.`,
      biasKey: null, biasSign: 0,
    },
  ],
  social: [
    {
      label: '🤝 Diplomatic',
      prompt: (c) => `${c} responds diplomatically, seeking common ground and keeping the conversation open.`,
      biasKey: 'trust', biasSign: 1,
    },
    {
      label: '🔍 Suspicious',
      prompt: (c) => `${c} probes carefully, looking for inconsistencies and hidden motives before committing.`,
      biasKey: 'trust', biasSign: -1,
    },
    {
      label: '📋 By the Book',
      prompt: (c) => `${c} defers to protocol and the chain of command, keeping the exchange formal.`,
      biasKey: 'obedience', biasSign: 1,
    },
    {
      label: '💬 Candid',
      prompt: (c) => `${c} speaks honestly and directly, even if it risks offending someone important.`,
      biasKey: 'obedience', biasSign: -1,
    },
  ],
  exploration: [
    {
      label: '🔦 Cautious Scout',
      prompt: (c) => `${c} moves carefully, checking for traps and threats before proceeding.`,
      biasKey: 'caution', biasSign: 1,
    },
    {
      label: '🏃 Bold Push',
      prompt: (c) => `${c} pushes forward quickly, trusting instinct over caution.`,
      biasKey: 'caution', biasSign: -1,
    },
    {
      label: '🐉 Dragon Recon',
      prompt: (c, d) => `${c} sends ${d || 'their dragon'} ahead to scout from the air before committing.`,
      biasKey: 'dragonFirst', biasSign: 1,
    },
    {
      label: '🧭 Investigate',
      prompt: (c) => `${c} stops to examine the surroundings closely, searching for clues or hidden details.`,
      biasKey: null, biasSign: 0,
    },
  ],
  general: [
    {
      label: '⏳ Wait & Observe',
      prompt: (c) => `${c} pauses, observing the situation carefully before deciding on a course of action.`,
      biasKey: 'caution', biasSign: 1,
    },
    {
      label: '💬 Speak Up',
      prompt: (c) => `${c} takes the initiative and speaks up, addressing the situation directly.`,
      biasKey: 'obedience', biasSign: -1,
    },
    {
      label: '🐉 Consult Dragon',
      prompt: (c, d) => `${c} reaches through the bond to ${d || 'their dragon'}, seeking guidance.`,
      biasKey: 'dragonFirst', biasSign: 1,
    },
    {
      label: '🎲 Act on Instinct',
      prompt: (c) => `${c} trusts their gut and acts immediately on whatever feels right.`,
      biasKey: null, biasSign: 0,
    },
  ],
};

// ── Alignment scoring ──────────────────────────────────────────────────

function scoreAlignment(template: ChoiceTemplate, biases: AutopilotBiases): number {
  if (!template.biasKey) return 0;
  // bias value is -2..+2, normalise to -1..+1 then multiply by sign
  return (biases[template.biasKey] / 2) * template.biasSign;
}

function buildChoices(
  situation: Situation,
  charName: string,
  dragonName: string,
  biases: AutopilotBiases,
): AutopilotChoice[] {
  return BANKS[situation].map((t, i) => ({
    id: `${situation}-${i}`,
    label: t.label,
    prompt: t.prompt(charName, dragonName),
    biasAlignment: Math.max(-1, Math.min(1, scoreAlignment(t, biases))),
  }));
}

// ── Hook ───────────────────────────────────────────────────────────────

export function useEmpyreanAutopilot({
  enabled,
  characterName,
  dragonName,
  delaySeconds = 8,
  onSendAction,
  lastAssistantMessage,
  isLoading,
}: UseEmpyreanAutopilotOptions) {
  const [isAutopilotActive, setIsAutopilotActive] = useState(false);
  const [currentChoices, setCurrentChoices] = useState<AutopilotChoice[]>([]);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const awaitingRollRef = useRef(false);
  const biasesRef = useRef<AutopilotBiases>(loadAutopilotBiases());
  const lastProcessedRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Toggle ───────────────────────────────────────────────────────────
  const toggleAutopilot = useCallback(() => {
    setIsAutopilotActive(prev => {
      const next = !prev;
      if (next) {
        biasesRef.current = loadAutopilotBiases();
      } else {
        // turning off — clear everything
        setCurrentChoices([]);
        setSelectedChoiceId(null);
        setCountdown(0);
        setIsPaused(false);
        lastProcessedRef.current = null;
      }
      return next;
    });
  }, []);

  const takeControl = useCallback(() => {
    setIsAutopilotActive(false);
    setCurrentChoices([]);
    setSelectedChoiceId(null);
    setCountdown(0);
    setIsPaused(false);
    lastProcessedRef.current = null;
  }, []);

  const selectChoice = useCallback((id: string) => {
    setSelectedChoiceId(id);
    setCountdown(delaySeconds);
    setIsPaused(false);
  }, [delaySeconds]);

  const pauseAutopilot = useCallback(() => setIsPaused(true), []);
  const resumeAutopilot = useCallback(() => setIsPaused(false), []);

  // ── Generate choices when a new assistant message arrives ────────────
  useEffect(() => {
    if (!isAutopilotActive || !enabled) return;
    if (isLoading) return;
    if (!lastAssistantMessage) return;
    if (lastAssistantMessage === lastProcessedRef.current) return;

    lastProcessedRef.current = lastAssistantMessage;

    // Check for roll requests
    if (ROLL_PATTERNS.test(lastAssistantMessage)) {
      awaitingRollRef.current = true;
      setCurrentChoices([]);
      setSelectedChoiceId(null);
      setCountdown(0);
      return;
    }
    awaitingRollRef.current = false;

    const situation = detectSituation(lastAssistantMessage);
    const choices = buildChoices(situation, characterName, dragonName, biasesRef.current);

    setCurrentChoices(choices);

    // Auto-select best aligned
    const best = [...choices].sort((a, b) => b.biasAlignment - a.biasAlignment)[0];
    setSelectedChoiceId(best?.id ?? null);
    setCountdown(delaySeconds);
    setIsPaused(false);
  }, [isAutopilotActive, enabled, lastAssistantMessage, isLoading, characterName, dragonName, delaySeconds]);

  // ── Countdown timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isAutopilotActive || countdown <= 0 || isPaused || !selectedChoiceId) return;

    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Fire!
          const choice = currentChoices.find(c => c.id === selectedChoiceId);
          if (choice) {
            onSendAction(choice.prompt);
          }
          setCurrentChoices([]);
          setSelectedChoiceId(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAutopilotActive, countdown, isPaused, selectedChoiceId, currentChoices, onSendAction]);

  // ── Cleanup on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    isAutopilotActive,
    currentChoices,
    selectedChoiceId,
    countdown,
    isPaused,
    toggleAutopilot,
    selectChoice,
    pauseAutopilot,
    resumeAutopilot,
    takeControl,
  };
}
