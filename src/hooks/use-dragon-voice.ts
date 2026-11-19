// The dragon's voice in solo Empyrean, wired to the screen: after each DM post it asks the rules
// (dragon-voice.ts) whether to ask the dragon, makes the one cheap AI call, and when he speaks it
// delivers the line as his own chat bubble and turns the rider to him (canon: a dragon can push
// past its rider's mental shields). It also keeps what was said between them for the DM.
// The screen supplies everything that touches the rest of the app; this hook changes no meters.
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { buildDragonChatPrompt } from '@/lib/dragonBondState';
import { loadSoloDragonState } from '@/lib/dragon-record';
import {
  addBondLine, bondNoteForDm, dragonSpeaks, dragonVoiceAsk, dragonVoiceDecision, dragonVoiceSpoke, quietEnoughToTurn, readDragonVoice,
  readVoiceMode, readVoiceState, riderIsTyping, saveVoiceState, type BondLine, type DragonVoiceMust,
} from '@/lib/dragon-voice';

/** The model the dragon's unprompted thoughts already ran on (the old opening remark). */
const VOICE_MODEL = 'google/gemini-2.5-flash';
const FLASH_MS = 1400;
const TURN_CHECK_MS = 400;
/** A turn that has waited this long for the rider to stop typing happens anyway. */
const TURN_GIVE_UP_MS = 20_000;

export interface DragonVoiceIncoming { id: string; text: string }

export interface UseDragonVoiceOptions {
  /** Bonded, and the solo screen is open. */
  enabled: boolean;
  /** Keeps the brakes per campaign. */
  campaignKey: string;
  dragonName: string;
  riderName: string;
  dragonNotes: string;
  /** The rider is looking at the dragon's chat right now. */
  facing: boolean;
  /** Read at the moment a DM post finishes. */
  getMoment: () => { strain: number; strainMax: number; hp: number; hpMax: number; fightOpen: boolean };
  /** The DM posts before the one that just finished, oldest first. */
  recentStory: () => string[];
  /** Adds an unread line (the badge on the dragon, the whispers chip). */
  addUnread: (text: string) => void;
  /** Marks the unread lines read and counts as contact (D-30). */
  clearUnread: () => void;
  /** Turns the hall to the dragon's chat (or opens it). */
  turnToDragon: () => void;
  /** The AI call. Replaced in tests. */
  ask?: (systemPrompt: string) => Promise<string | null>;
}

async function askOverNetwork(systemPrompt: string): Promise<string | null> {
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`;
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Something just happened. Answer in exactly the form you were given.' }],
        systemPromptOverride: systemPrompt,
        model: VOICE_MODEL,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.response || data?.content || null;
  } catch {
    return null;
  }
}

const clip = (text: string, max: number) => {
  const clean = text.replace(/<!--[\s\S]*?-->/g, '').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
};

const newId = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `dv-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function useDragonVoice(options: UseDragonVoiceOptions) {
  const opts = useRef(options);
  opts.current = options;

  const [incoming, setIncoming] = useState<DragonVoiceIncoming[]>([]);
  const [flash, setFlash] = useState(false);
  const bondLog = useRef<BondLine[]>([]);
  const lastInputAt = useRef(0);
  const asking = useRef(false);
  const turnTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  // When the rider last typed anywhere on the screen.
  useEffect(() => {
    alive.current = true;
    const onInput = () => { lastInputAt.current = Date.now(); };
    window.addEventListener('input', onInput, true);
    return () => {
      alive.current = false;
      window.removeEventListener('input', onInput, true);
      if (turnTimer.current) clearInterval(turnTimer.current);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  /** Moves every unread line into the chat as his bubbles, and marks them read. Call when the chat opens. */
  const takeUnread = useCallback(() => {
    const unread = loadSoloDragonState().unreadDragonMessages ?? [];
    if (unread.length > 0) setIncoming(prev => [...prev, ...unread.map(text => ({ id: newId(), text }))]);
    opts.current.clearUnread();
  }, []);

  const onIncomingShown = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setIncoming(prev => (prev.some(l => ids.includes(l.id)) ? prev.filter(l => !ids.includes(l.id)) : prev));
  }, []);

  const onBondLine = useCallback((line: BondLine) => {
    bondLog.current = addBondLine(bondLog.current, line);
  }, []);

  /** What passed between them since the last successful Send to DM. Empty when nothing did. */
  const bondNote = useCallback(() => bondNoteForDm(bondLog.current, opts.current.dragonName, opts.current.riderName), []);
  const clearBondNote = useCallback(() => { bondLog.current = []; }, []);

  const turnNow = useCallback(() => {
    const el = typeof document !== 'undefined' ? document.activeElement : null;
    if (el instanceof HTMLElement && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) el.blur();
    opts.current.turnToDragon();
  }, []);

  /** He pushes past the rider's shields: a flash in his name, then the turn (after the rider stops typing). */
  const pushIn = useCallback(() => {
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => { if (alive.current) setFlash(false); }, FLASH_MS);
    try { navigator.vibrate?.(60); } catch { /* no vibration here */ }
    toast(`${opts.current.dragonName || 'Your dragon'} pushes past your shields`, { icon: '🐉', duration: 2500 });
    if (turnTimer.current) { clearInterval(turnTimer.current); turnTimer.current = null; }
    if (!riderIsTyping(lastInputAt.current, Date.now())) { turnNow(); return; }
    const since = Date.now();
    turnTimer.current = setInterval(() => {
      const now = Date.now();
      if (!quietEnoughToTurn(lastInputAt.current, now) && now - since < TURN_GIVE_UP_MS) return;
      if (turnTimer.current) { clearInterval(turnTimer.current); turnTimer.current = null; }
      if (alive.current && !opts.current.facing) turnNow();
    }, TURN_CHECK_MS);
  }, [turnNow]);

  const deliver = useCallback((line: string) => {
    if (opts.current.facing) {
      // Already looking at him: the line simply appears.
      setIncoming(prev => [...prev, { id: newId(), text: line }]);
      return;
    }
    opts.current.addUnread(line);
    pushIn();
  }, [pushIn]);

  /** Call once for every finished DM post. */
  const onDmPost = useCallback((content: string) => {
    const o = opts.current;
    const key = `empyrean-dragon-voice:${o.campaignKey}`;
    const m = o.getMoment();
    const decision = dragonVoiceDecision(readVoiceState(key), {
      now: Date.now(), dmText: clip(content, 4000), strain: m.strain, strainMax: m.strainMax, hp: m.hp, hpMax: m.hpMax,
      mode: readVoiceMode(), bonded: o.enabled, fightOpen: m.fightOpen,
    });
    saveVoiceState(key, decision.state);
    if (!decision.ask || asking.current) return;
    asking.current = true;
    const must: DragonVoiceMust | null = decision.must;
    void (async () => {
      try {
        const bs = loadSoloDragonState();
        const story = [...o.recentStory().slice(-2).map(t => clip(t, 500)), clip(content, 900)].filter(Boolean);
        const prompt = buildDragonChatPrompt(
          o.dragonName || 'Dragon', o.riderName, bs.trust, bs.mood, bs.memories, o.dragonNotes, bs.speechHabits, story, bs.bond, bs.riderEmotionalLog,
        ) + dragonVoiceAsk(must);
        const said = readDragonVoice(await (opts.current.ask ?? askOverNetwork)(prompt));
        if (!alive.current || !dragonSpeaks(said, decision) || !said) return;
        // A fight or an unbonding that began while he was thinking: he keeps it to himself.
        const later = opts.current;
        if (!later.enabled || later.getMoment().fightOpen) return;
        saveVoiceState(key, dragonVoiceSpoke(readVoiceState(key), Date.now(), must));
        deliver(said.line);
      } finally {
        asking.current = false;
      }
    })();
  }, [deliver]);

  return { incoming, onIncomingShown, onBondLine, takeUnread, onDmPost, bondNote, clearBondNote, flash };
}
