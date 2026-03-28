import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type PartyDragonConfig } from '@/hooks/use-party-dm';
import { getAuthToken } from '@/lib/auth-token';
import { buildDragonChatPrompt, addMemory, detectTrustBreak, detectRiderDeclaration, classifyRiderEmotion, computeMoodPressure, buildConstrainedMoodOptions, type DragonMood, type DragonMemory } from '@/lib/dragonBondState';
import { loadSelectedModel } from '@/lib/dm-models';

const AI_DM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`;

const DEFAULT_DRAGON: PartyDragonConfig = {
  dragonName: '',
  signetType: '',
  yearAtBasgiath: '',
  dragonNotes: '',
  bond: 15,
  trust: 10,
  mood: 'calm',
  burnout: 0,
  memories: [],
};

interface DragonEntry {
  userId: string;
  config: PartyDragonConfig;
}

export interface DragonChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface DragonNetworkMessage {
  id: string;
  fromDragon: string;
  fromUserId: string;
  toDragon: string;
  toUserId: string;
  riderMessage: string;
  dragonExchange: string;
  toRiderDelivery?: string;
  senderReport?: string;
  timestamp: string;
}

// Trust-building keyword patterns (same as use-dragon-bond.ts)
const QUESTION_PATTERNS = [
  'how do you feel', 'what do you think', 'are you okay',
  'tell me about', 'what do you remember', 'do you want', 'how are you',
];
const GRATITUDE_PATTERNS = [
  'i trust you', 'thank you', "i'm glad", 'i appreciate',
  'you were right', "i'm sorry",
];
const VULNERABILITY_PATTERNS = [
  "i'm afraid", "i'm scared", "i don't know",
  'i need help', 'i failed', "i'm worried",
];
const AUTONOMY_PATTERNS = [
  'what would you prefer', 'your choice',
  "i won't force you", 'you decide',
];

function matchesAny(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase();
  return patterns.some(p => lower.includes(p));
}

const SESSION_CHAT_CAP = 5;
const MAX_TRUST_PER_EXCHANGE = 4;

const COMBAT_WORDS = ['fight', 'danger', 'battle', 'enemy', 'attack', 'die', 'kill'];

const AFFINITY_DELTAS: Record<string, number> = {
  agree: 0.05, warn: 0.03, tease: 0.02, rival: -0.03, dismiss: -0.05,
};

function getAffinityDescription(affinity: number, dragonName: string): string {
  if (affinity > 0.3) return `You have developed a grudging respect for ${dragonName}. You would not admit it openly.`;
  if (affinity >= 0.0) return `You are aware of ${dragonName} but have no strong feelings.`;
  if (affinity >= -0.3) return `You find ${dragonName} irritating and do not hide it.`;
  return `You openly disdain ${dragonName}. You consider them beneath you.`;
}

export function usePartyDragonBonds(partyId: string | null, userId: string | null, partyMembers?: Array<{ user_id: string; character_name: string }>) {
  const [myDragon, setMyDragon] = useState<PartyDragonConfig | null>(null);
  const [allDragonConfigs, setAllDragonConfigs] = useState<DragonEntry[]>([]);
  const [myRowId, setMyRowId] = useState<string | null>(null);
  const [dragonChatMessages, setDragonChatMessages] = useState<DragonChatMessage[]>([]);
  const [chatRowId, setChatRowId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sessionChatCount, setSessionChatCount] = useState(0);
  const [dragonNetworkMessages, setDragonNetworkMessages] = useState<DragonNetworkMessage[]>([]);
  const mountedRef = useRef(true);
  const reactionCooldownRef = useRef<Map<string, number>>(new Map());
  const reactingRef = useRef(false);
  // Track reaction vs chain IDs locally: 'reaction' = depth 0 reaction, 'chain' = depth 1 (terminal)
  const reactionDepthRef = useRef<Map<string, 'reaction' | 'chain'>>(new Map());
  // V3: Emergent dragon relationship tracking (persisted to party_shared_state)
  const dragonRelationshipsRef = useRef<Record<string, Record<string, { affinity: number; interactions: number }>>>({});
  const relationshipRowIdRef = useRef<string | null>(null);
  const lastRelSaveRef = useRef<number>(0);
  const moodDurationRef = useRef<number>(0);
  const lastMoodShiftRef = useRef<{ from: string; to: string; timestamp: string } | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Persist dragon relationships to party_shared_state (fire-and-forget)
  const persistDragonRelationships = useCallback(() => {
    if (!partyId || !userId) return;
    const now = Date.now();
    if (now - lastRelSaveRef.current < 5000) return;
    lastRelSaveRef.current = now;

    const stateData = dragonRelationshipsRef.current;
    if (relationshipRowIdRef.current) {
      supabase
        .from('party_shared_state')
        .update({ state_data: stateData as any, updated_at: new Date().toISOString() })
        .eq('id', relationshipRowIdRef.current)
        .then(() => {});
    } else {
      supabase
        .from('party_shared_state')
        .insert([{
          party_id: partyId,
          user_id: userId,
          state_type: 'dragon_relationships',
          state_data: stateData as any,
        }])
        .select('id')
        .single()
        .then(({ data }) => {
          if (data) relationshipRowIdRef.current = data.id;
        });
    }
  }, [partyId, userId]);

  // Load persisted dragon relationships
  const loadDragonRelationships = useCallback(async () => {
    if (!partyId || !userId) return;
    const { data } = await supabase
      .from('party_shared_state')
      .select('*')
      .eq('party_id', partyId)
      .eq('user_id', userId)
      .eq('state_type', 'dragon_relationships')
      .maybeSingle();

    if (!mountedRef.current) return;
    if (data) {
      dragonRelationshipsRef.current = data.state_data as unknown as Record<string, Record<string, { affinity: number; interactions: number }>>;
      relationshipRowIdRef.current = data.id;
    }
  }, [partyId, userId]);

  // Fetch all dragon configs for this party
  const fetchAll = useCallback(async () => {
    if (!partyId) return;
    const { data } = await supabase
      .from('party_shared_state')
      .select('*')
      .eq('party_id', partyId)
      .eq('state_type', 'dragon_bond');

    if (!mountedRef.current || !data) return;

    const entries: DragonEntry[] = data.map(row => ({
      userId: row.user_id,
      config: { ...DEFAULT_DRAGON, ...(row.state_data as unknown as PartyDragonConfig) },
    }));
    setAllDragonConfigs(entries);

    if (userId) {
      const myRow = data.find(r => r.user_id === userId);
      if (myRow) {
        setMyDragon({ ...DEFAULT_DRAGON, ...(myRow.state_data as unknown as PartyDragonConfig) });
        setMyRowId(myRow.id);
      } else {
        setMyDragon(null);
        setMyRowId(null);
      }
    }
  }, [partyId, userId]);

  // Initial fetch
  useEffect(() => {
    fetchAll();
    loadDragonRelationships();
  }, [fetchAll, loadDragonRelationships]);

  // ── Dragon cross-reaction logic ──
  const triggerDragonReaction = useCallback(async (
    incomingMsg: DragonNetworkMessage,
    mode: 'normal' | 'chain' = 'normal',
  ) => {
    if (!partyId || !userId || reactingRef.current) return;
    if (allDragonConfigs.length < 2) return;

    const senderUserId = incomingMsg.fromUserId;
    const senderDragonName = incomingMsg.fromDragon;
    const messageText = incomingMsg.dragonExchange || incomingMsg.riderMessage || '';
    const lowerMsg = messageText.toLowerCase();

    // Decrement all cooldowns by 1
    const cooldowns = reactionCooldownRef.current;
    for (const [key, val] of cooldowns.entries()) {
      if (val <= 1) cooldowns.delete(key);
      else cooldowns.set(key, val - 1);
    }

    // Find sender's config for bond comparison
    const senderEntry = allDragonConfigs.find(d => d.userId === senderUserId);
    const senderBond = senderEntry?.config.bond ?? 15;

    let winner: { entry: DragonEntry; reactionType: string } | null = null;

    if (mode === 'chain') {
      // Chain mode: only the original speaker (the dragon being reacted TO) can respond
      // incomingMsg.toUserId is the original speaker
      const originalSpeakerUserId = incomingMsg.toUserId;
      const originalEntry = allDragonConfigs.find(d => d.userId === originalSpeakerUserId);
      if (!originalEntry?.config.dragonName) return;
      if ((cooldowns.get(originalSpeakerUserId) ?? 0) > 0) return;

      const roll = Math.random();
      if (roll >= 0.35) return; // flat 35% chance

      const originalBond = originalEntry.config.bond ?? 15;
      const reactorBond = senderEntry?.config.bond ?? 15;
      const reactionType = Math.abs(originalBond - reactorBond) <= 15 ? 'rival' : 'dismiss';

      winner = { entry: originalEntry, reactionType };
    } else {
      // Normal mode: evaluate each OTHER dragon (V1 logic)
      type Candidate = { entry: DragonEntry; roll: number; reactionType: string };
      const candidates: Candidate[] = [];

      for (const entry of allDragonConfigs) {
        if (!entry.config.dragonName || entry.userId === senderUserId) continue;
        if ((cooldowns.get(entry.userId) ?? 0) > 0) continue;

        const personality = (entry.config.dragonNotes || '').toLowerCase();
        let baseRate = 0.15;
        if (/aggressive|dominant/.test(personality)) baseRate = 0.3;
        else if (/playful/.test(personality)) baseRate = 0.25;
        else if (/reserved|shy/.test(personality)) baseRate = 0.1;

        let chance = baseRate;
        if ((entry.config.bond ?? 15) >= 50) chance += 0.1;
        if (lowerMsg.includes(entry.config.dragonName.toLowerCase()) || COMBAT_WORDS.some(w => lowerMsg.includes(w))) chance += 0.2;
        chance = Math.min(chance, 0.7);

        const roll = Math.random();
        if (roll < chance) {
          const reactorBond = entry.config.bond ?? 15;
          let reactionType = 'agree';
          if (Math.abs(reactorBond - senderBond) <= 10) reactionType = 'rival';
          else if (reactorBond >= senderBond + 20) reactionType = 'dismiss';
          else if (COMBAT_WORDS.some(w => lowerMsg.includes(w))) reactionType = 'warn';
          else if (/playful/.test(personality)) reactionType = 'tease';

          candidates.push({ entry, roll, reactionType });
        }
      }

      if (candidates.length === 0) return;
      candidates.sort((a, b) => b.roll - a.roll);
      winner = candidates[0];
    }

    if (!winner) return;

    const reactor = winner.entry;

    // V3: Update relationship tracking
    const rels = dragonRelationshipsRef.current;
    if (!rels[reactor.userId]) rels[reactor.userId] = {};
    if (!rels[reactor.userId][senderUserId]) rels[reactor.userId][senderUserId] = { affinity: 0, interactions: 0 };
    const rel = rels[reactor.userId][senderUserId];
    rel.interactions += 1;
    rel.affinity = Math.max(-1, Math.min(1, rel.affinity + (AFFINITY_DELTAS[winner.reactionType] ?? 0)));

    // Persist relationships (fire-and-forget, debounced)
    try { persistDragonRelationships(); } catch { /* never block reaction */ }
    cooldowns.set(reactor.userId, 4);
    reactingRef.current = true;

    // Random delay: 2-4s for normal, 3-5s for chain
    const delayBase = mode === 'chain' ? 3000 : 2000;
    const delay = delayBase + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, delay));

    if (!mountedRef.current) { reactingRef.current = false; return; }

    try {
      const reactorCharName = partyMembers?.find(m => m.user_id === reactor.userId)?.character_name || 'Rider';
      const partyContext = allDragonConfigs
        .filter(d => d.config.dragonName && d.userId !== reactor.userId)
        .map(d => ({
          characterName: partyMembers?.find(m => m.user_id === d.userId)?.character_name || d.userId,
          dragonName: d.config.dragonName,
          signetType: d.config.signetType,
          mood: d.config.mood,
          bond: d.config.bond,
        }));

      let systemPrompt = buildDragonChatPrompt(
        reactor.config.dragonName,
        reactorCharName,
        reactor.config.trust,
        reactor.config.mood as DragonMood,
        (reactor.config.memories || []) as DragonMemory[],
        reactor.config.dragonNotes || '',
        reactor.config.speechHabits,
        undefined,
        reactor.config.bond,
        reactor.config.riderEmotionalLog,
        partyContext,
      );

      // V3: Inject relationship context if sufficient interactions
      if (rel.interactions >= 3) {
        systemPrompt += `\n\n${getAffinityDescription(rel.affinity, senderDragonName)}`;
      }

      if (mode === 'chain') {
        systemPrompt += `\n\nAnother dragon just responded to something you said: '${messageText.slice(0, 500)}'. Fire back with a brief ${winner.reactionType} retort. 1-2 sentences maximum. Stay in character.`;
      } else {
        systemPrompt += `\n\nAnother dragon just said: '${messageText.slice(0, 500)}'. React with a brief ${winner.reactionType} response. 1-2 sentences maximum. Do not repeat or paraphrase what was said. Stay fully in character.`;
      }

      const authToken = await getAuthToken();
      const resp = await fetch(AI_DM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `React to what ${senderDragonName} just said.` }],
          systemPromptOverride: systemPrompt,
          model: 'google/gemini-2.5-flash',
        }),
      });

      if (!resp.ok) { reactingRef.current = false; return; }
      if (!resp.body) { reactingRef.current = false; return; }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) assistantContent += delta;
          } catch { /* skip */ }
        }
      }

      const reactionText = assistantContent.replace(/<!--.*?-->/g, '').trim();
      if (!reactionText) { reactingRef.current = false; return; }

      const depthTag = mode === 'chain' ? 'chain' : 'react';
      const msgId = `${depthTag}-${Date.now()}`;
      const recvId = `${depthTag}-recv-${Date.now()}`;

      // Track depth locally
      const depthMap = reactionDepthRef.current;
      depthMap.set(msgId, mode === 'chain' ? 'chain' : 'reaction');
      depthMap.set(recvId, mode === 'chain' ? 'chain' : 'reaction');

      const reactionMsg: DragonNetworkMessage = {
        id: msgId,
        fromDragon: reactor.config.dragonName,
        fromUserId: reactor.userId,
        toDragon: senderDragonName,
        toUserId: senderUserId,
        riderMessage: '',
        dragonExchange: `*${reactor.config.dragonName}:* ${reactionText}`,
        timestamp: new Date().toISOString(),
      };

      // Insert for reactor's own view
      await supabase.from('party_shared_state').insert([{
        party_id: partyId,
        user_id: reactor.userId,
        state_type: 'dragon_network_message',
        state_data: reactionMsg as any,
      }]);

      // Insert for sender's view
      await supabase.from('party_shared_state').insert([{
        party_id: partyId,
        user_id: senderUserId,
        state_type: 'dragon_network_message',
        state_data: { ...reactionMsg, id: recvId } as any,
      }]);
    } catch (err) {
      console.error('[DragonReaction] Error:', err);
    } finally {
      reactingRef.current = false;
    }
  }, [partyId, userId, allDragonConfigs, partyMembers, persistDragonRelationships]);

  // Realtime subscription for dragon bond changes
  useEffect(() => {
    if (!partyId) return;

    const channel = supabase
      .channel(`dragon-bonds-${partyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'party_shared_state',
          filter: `party_id=eq.${partyId}`,
        },
        (payload) => {
          const row = (payload.new as Record<string, unknown>) || {};
          if (row.state_type === 'dragon_network_message') {
            if (row.user_id === userId) {
              const incoming = row.state_data as unknown as DragonNetworkMessage;
              setDragonNetworkMessages(prev => {
                if (prev.some(m => m.id === incoming.id)) return prev;
                return [...prev, incoming];
              });
              // If this message was sent TO this user's dragon, trigger a reaction
              if (payload.eventType === 'INSERT' && incoming.toUserId === userId && incoming.fromUserId !== userId) {
                triggerDragonReaction(incoming, 'normal');
              }
            }
            // Evaluate cross-reactions / chain reactions for INSERTs from other users
            if (payload.eventType === 'INSERT' && row.user_id !== userId) {
              const incoming = row.state_data as unknown as DragonNetworkMessage;
              if (!incoming?.fromUserId || incoming.fromUserId === userId) return;

              const msgId = incoming.id?.toString() || '';
              const depthMap = reactionDepthRef.current;

              // ── Reverse relationship tracking: how MY dragon feels about the sender ──
              if (userId) {
                if (!dragonRelationshipsRef.current[userId]) {
                  dragonRelationshipsRef.current[userId] = {};
                }
                const senderKey = incoming.fromUserId;
                if (!dragonRelationshipsRef.current[userId][senderKey]) {
                  dragonRelationshipsRef.current[userId][senderKey] = { affinity: 0, interactions: 0 };
                }
                const rel = dragonRelationshipsRef.current[userId][senderKey];
                rel.interactions += 1;

                let delta = 0;
                if (msgId.startsWith('chain-')) {
                  delta = -0.03;
                } else if (msgId.startsWith('react-')) {
                  delta = (incoming as any).toUserId === userId ? -0.02 : 0.01;
                } else {
                  delta = 0.01;
                }
                rel.affinity = Math.max(-1, Math.min(1, rel.affinity + delta));

                // Persist reverse relationship (fire-and-forget, debounced)
                try { persistDragonRelationships(); } catch { /* never block */ }
              }

              // Check if this is a chain reaction (depth 1) — terminal, no further reactions
              if (msgId.startsWith('chain-') || depthMap.get(msgId) === 'chain') return;

              // Check if this is a reaction (depth 0) — eligible for ONE chain response
              if (msgId.startsWith('react-') || depthMap.get(msgId) === 'reaction') {
                triggerDragonReaction(incoming, 'chain');
                return;
              }

              // Original message — normal reaction evaluation
              triggerDragonReaction(incoming, 'normal');
            }
            return;
          }
          // Handle dragon_relationships realtime updates from self (other tab/device)
          if (row.state_type === 'dragon_relationships' && row.user_id === userId) {
            const rowAny = row as Record<string, unknown>;
            dragonRelationshipsRef.current = rowAny.state_data as Record<string, Record<string, { affinity: number; interactions: number }>>;
            if (typeof rowAny.id === 'string') relationshipRowIdRef.current = rowAny.id;
            return;
          }
          if (row.state_type !== 'dragon_bond') return;
          fetchAll();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [partyId, fetchAll, userId, triggerDragonReaction, persistDragonRelationships]);

  // ── Dragon Chat ──
  const loadDragonChat = useCallback(async () => {
    if (!partyId || !userId) return;
    const { data } = await supabase
      .from('party_shared_state')
      .select('*')
      .eq('party_id', partyId)
      .eq('user_id', userId)
      .eq('state_type', 'dragon_chat')
      .maybeSingle();

    if (!mountedRef.current) return;
    if (data) {
      const msgs = (data.state_data as unknown as { messages: DragonChatMessage[] })?.messages || [];
      setDragonChatMessages(msgs);
      setChatRowId(data.id);
    } else {
      setDragonChatMessages([]);
      setChatRowId(null);
    }
  }, [partyId, userId]);

  // Load chat on mount
  useEffect(() => {
    loadDragonChat();
  }, [loadDragonChat]);

  // Load dragon network messages (initial fetch only — realtime handled by dragon-bonds channel above)
  useEffect(() => {
    if (!partyId || !userId) return;

    supabase
      .from('party_shared_state')
      .select('*')
      .eq('party_id', partyId)
      .eq('user_id', userId)
      .eq('state_type', 'dragon_network_message')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!mountedRef.current || !data) return;
        setDragonNetworkMessages(data.map(r => r.state_data as unknown as DragonNetworkMessage));
      });
  }, [partyId, userId]);

  const saveDragonChat = useCallback(async (messages: DragonChatMessage[]) => {
    if (!partyId || !userId) return;
    const stateData = { messages };
    if (chatRowId) {
      await supabase
        .from('party_shared_state')
        .update({ state_data: stateData as any, updated_at: new Date().toISOString() })
        .eq('id', chatRowId);
    } else {
      const { data } = await supabase
        .from('party_shared_state')
        .insert([{
          party_id: partyId,
          user_id: userId,
          state_type: 'dragon_chat',
          state_data: stateData as any,
        }])
        .select('id')
        .single();
      if (data) setChatRowId(data.id);
    }
  }, [partyId, userId, chatRowId]);

  const sendDragonMessage = useCallback(async (text: string, characterName: string, recentNarrative?: string[]) => {
    if (!partyId || !userId || !myDragon?.dragonName || isSending) return;

    setIsSending(true);
    const userMsg: DragonChatMessage = { role: 'user', content: text, timestamp: new Date().toISOString() };
    const updatedMessages = [...dragonChatMessages, userMsg];
    setDragonChatMessages(updatedMessages);

    try {
      // Compute mood pressure before LLM call
      const moodPressureResult = computeMoodPressure(
        (myDragon.mood || 'calm') as DragonMood,
        myDragon.trust || 10,
        myDragon.riderEmotionalLog || [],
        recentNarrative || [],
        myDragon.burnout || 0,
        moodDurationRef.current,
      );
      const { recommendedMood, validTransitions } = moodPressureResult;

      // Capture mood shift event if mood is changing
      const fromMood = (myDragon.mood || 'calm') as string;
      if (recommendedMood !== fromMood) {
        lastMoodShiftRef.current = { from: fromMood, to: recommendedMood, timestamp: new Date().toISOString() };
      }
      // Build system prompt
      // Build party context for other dragons
      const partyContext = allDragonConfigs
        .filter(d => d.config.dragonName && d.userId !== userId)
        .map(d => ({
          characterName: partyMembers?.find(m => m.user_id === d.userId)?.character_name || d.userId,
          dragonName: d.config.dragonName,
          signetType: d.config.signetType,
          mood: d.config.mood,
          bond: d.config.bond,
        }));

      let systemPrompt = buildDragonChatPrompt(
        myDragon.dragonName,
        characterName,
        myDragon.trust,
        recommendedMood,
        (myDragon.memories || []) as DragonMemory[],
        myDragon.dragonNotes || '',
        myDragon.speechHabits,
        recentNarrative,
        myDragon.bond,
        myDragon.riderEmotionalLog,
        partyContext,
      );

      // Replace the default mood tag instruction with constrained options
      const moodTagPattern = /After each response, include exactly one mood tag indicating your current emotional state:\s*\n<!--DRAGON_MOOD:calm-->.*?<!--DRAGON_MOOD:playful-->/s;
      const constrainedMoodText = buildConstrainedMoodOptions(recommendedMood, validTransitions);
      systemPrompt = systemPrompt.replace(moodTagPattern, constrainedMoodText);

      // V3: Inject relationship context for rider-initiated chat
      if (userId) {
        const myRels = dragonRelationshipsRef.current[userId];
        if (myRels) {
          const relLines: string[] = [];
          for (const otherEntry of allDragonConfigs) {
            if (otherEntry.userId === userId || !otherEntry.config.dragonName) continue;
            const rel = myRels[otherEntry.userId];
            if (rel && rel.interactions >= 3) {
              relLines.push(`- ${otherEntry.config.dragonName}: ${getAffinityDescription(rel.affinity, otherEntry.config.dragonName)}`);
            }
          }
          if (relLines.length > 0) {
            systemPrompt += `\n\n## YOUR FEELINGS ABOUT OTHER DRAGONS\n${relLines.join('\n')}`;
          }
        }
      }

      // Build API messages - only last 40 messages for context window
      const apiMessages = updatedMessages.slice(-40).map(m => ({ role: m.role, content: m.content }));

      const authToken = await getAuthToken();
      const response = await fetch(AI_DM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          systemPromptOverride: systemPrompt,
          model: loadSelectedModel(),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Dragon chat request failed');
      }

      if (!response.body) throw new Error('No response body');

      // Stream response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) assistantContent += delta;
          } catch { /* skip */ }
        }
      }

      if (!assistantContent.trim()) {
        setIsSending(false);
        return;
      }

      const assistantMsg: DragonChatMessage = { role: 'assistant', content: assistantContent, timestamp: new Date().toISOString() };
      const finalMessages = [...updatedMessages, assistantMsg];
      setDragonChatMessages(finalMessages);

      // Save chat to DB
      await saveDragonChat(finalMessages);

      // Process dragon response tags and trust
      let updatedDragon = { ...myDragon };

      // Parse mood tag — validate against allowed transitions
      const moodMatch = assistantContent.match(/<!--DRAGON_MOOD:(\w+)-->/);
      let finalMood: DragonMood = recommendedMood;
      if (moodMatch) {
        const parsedMood = moodMatch[1] as DragonMood;
        const validMoods: DragonMood[] = ['calm', 'alert', 'protective', 'distant', 'ancestral', 'playful'];
        if (validMoods.includes(parsedMood) && validTransitions.includes(parsedMood)) {
          finalMood = parsedMood;
        }
      }
      // Track mood duration
      if (finalMood === (myDragon.mood || 'calm')) {
        moodDurationRef.current += 1;
      } else {
        moodDurationRef.current = 0;
      }
      updatedDragon = { ...updatedDragon, mood: finalMood };

      // Parse memory tags
      const memoryMatches = [...assistantContent.matchAll(/<!--DRAGON_MEMORY:(.+?)-->/g)];
      let memories = [...(updatedDragon.memories || [])] as DragonMemory[];
      for (const match of memoryMatches) {
        const fakeState = { memories } as any;
        const updated = addMemory(fakeState, match[1], 'bond-chat');
        memories = updated.memories;
      }
      updatedDragon = { ...updatedDragon, memories: memories as any };

      // Parse habit tags
      const habitMatches = [...assistantContent.matchAll(/<!--DRAGON_HABIT:(.+?)-->/g)];
      if (habitMatches.length > 0) {
        const currentHabits = [...(updatedDragon.speechHabits || [])];
        for (const match of habitMatches) {
          currentHabits.push(match[1]);
        }
        updatedDragon = { ...updatedDragon, speechHabits: currentHabits.slice(-5) };
      }

      // Process trust from player message
      const newSessionCount = sessionChatCount + 1;
      setSessionChatCount(newSessionCount);
      const bondLevel = myDragon.bond ?? 15;
      const effectiveChatCap = bondLevel >= 76 ? 12 : bondLevel >= 51 ? 9 : bondLevel >= 26 ? 7 : 5;
      let trustDelta = newSessionCount <= effectiveChatCap ? 1 : 0;

      const questionMatch = matchesAny(text, QUESTION_PATTERNS);
      const gratitudeMatch = matchesAny(text, GRATITUDE_PATTERNS);
      const vulnerabilityMatch = matchesAny(text, VULNERABILITY_PATTERNS);
      const autonomyMatch = matchesAny(text, AUTONOMY_PATTERNS);

      if (questionMatch) trustDelta += 1;
      if (gratitudeMatch) trustDelta += 1;
      if (vulnerabilityMatch) trustDelta += 2;
      if (autonomyMatch) trustDelta += 1;
      trustDelta = Math.min(trustDelta, MAX_TRUST_PER_EXCHANGE);

      const trustBreak = detectTrustBreak(text);
      if (trustBreak.broken) {
        trustDelta = -trustBreak.severity;
        updatedDragon = { ...updatedDragon, mood: 'distant' };
      }

      if (trustDelta !== 0) {
        updatedDragon = {
          ...updatedDragon,
          trust: Math.max(0, Math.min(100, (updatedDragon.trust || 10) + trustDelta)),
        };
      }

      // Classify and log rider emotion
      const emotionTag = classifyRiderEmotion(
        text,
        trustBreak,
        { question: questionMatch, gratitude: gratitudeMatch, vulnerability: vulnerabilityMatch, autonomy: autonomyMatch },
      );
      const emotionalLog = [...(updatedDragon.riderEmotionalLog || []), { tag: emotionTag, timestamp: new Date().toISOString() }].slice(-15);
      updatedDragon = { ...updatedDragon, riderEmotionalLog: emotionalLog };

      // Detect rider declarations and save as rider-said memories
      const declaration = detectRiderDeclaration(text);
      if (declaration) {
        let memories = [...(updatedDragon.memories || [])] as DragonMemory[];
        const fakeState = { memories } as any;
        const updated = addMemory(fakeState, declaration, 'rider-said');
        memories = updated.memories;
        updatedDragon = { ...updatedDragon, memories: memories as any };
      }

      // Save updated dragon config
      if (JSON.stringify(updatedDragon) !== JSON.stringify(myDragon)) {
        setMyDragon(updatedDragon);
        const stateData = JSON.parse(JSON.stringify(updatedDragon));
        if (myRowId) {
          await supabase
            .from('party_shared_state')
            .update({ state_data: stateData, updated_at: new Date().toISOString() })
            .eq('id', myRowId);
        }
      }
    } catch (err) {
      console.error('[PartyDragonChat] Error:', err);
      // Remove failed user message
      setDragonChatMessages(dragonChatMessages);
    } finally {
      if (mountedRef.current) setIsSending(false);
    }
  }, [partyId, userId, myDragon, isSending, dragonChatMessages, sessionChatCount, saveDragonChat, myRowId, allDragonConfigs, partyMembers]);

  // Save full dragon config
  const saveMyDragon = useCallback(async (config: PartyDragonConfig) => {
    if (!partyId || !userId) return;

    setMyDragon(config);

    const stateData = JSON.parse(JSON.stringify(config));
    if (myRowId) {
      await supabase
        .from('party_shared_state')
        .update({ state_data: stateData, updated_at: new Date().toISOString() })
        .eq('id', myRowId);
    } else {
      const { data } = await supabase
        .from('party_shared_state')
        .insert([{
          party_id: partyId,
          user_id: userId,
          state_type: 'dragon_bond',
          state_data: stateData,
        }])
        .select('id')
        .single();
      if (data) setMyRowId(data.id);
    }
  }, [partyId, userId, myRowId]);

  // Partial update
  const updateMyDragon = useCallback(async (patch: Partial<PartyDragonConfig>) => {
    const current = myDragon || DEFAULT_DRAGON;
    const merged = { ...current, ...patch };
    await saveMyDragon(merged);
  }, [myDragon, saveMyDragon]);

  // Burnout shortcut
  const updateBurnout = useCallback(async (level: number) => {
    await updateMyDragon({ burnout: Math.max(0, Math.min(9, level)) });
  }, [updateMyDragon]);

  // Bond & trust delta shortcut
  const updateBondAndTrust = useCallback(async (bondDelta: number, trustDelta: number) => {
    const current = myDragon || DEFAULT_DRAGON;
    await updateMyDragon({
      bond: Math.max(0, Math.min(100, current.bond + bondDelta)),
      trust: Math.max(0, Math.min(100, current.trust + trustDelta)),
    });
  }, [myDragon, updateMyDragon]);

  // Generate a one-off dragon opinion based on recent narrative
  const generateDragonOpinion = useCallback(async (characterName: string, recentNarrative: string[]): Promise<string | null> => {
    if (!myDragon?.dragonName || recentNarrative.length === 0) return null;
    try {
      const dragon = myDragon.dragonName;
      const opinionPrompt = `You are ${dragon}. Based on recent events, share ONE unsolicited thought — a warning, an opinion about an NPC, or a feeling. Keep it under 2 sentences. Use your current mood and trust level to determine tone. Do not ask a question. Just state what is on your mind.\n\nRecent events:\n${recentNarrative.slice(-3).join('\n---\n')}`;
      const token = await getAuthToken();
      const resp = await fetch(AI_DM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'What is on your mind right now?' }],
          systemPromptOverride: opinionPrompt,
          model: 'google/gemini-2.5-flash',
        }),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data?.response || data?.content || null;
    } catch {
      return null;
    }
  }, [myDragon]);

  // Generate dragon reactions to new DM narrative — called after each DM response
  const generateNarrativeReactions = useCallback(async (narrativeContent: string) => {
    if (!partyId || !userId || !myDragon?.dragonName || !narrativeContent.trim()) return;

    const characterName = partyMembers?.find(m => m.user_id === userId)?.character_name || 'Rider';

    const partyCtx = allDragonConfigs
      .filter(d => d.config.dragonName && d.userId !== userId)
      .map(d => ({
        characterName: partyMembers?.find(m => m.user_id === d.userId)?.character_name || d.userId,
        dragonName: d.config.dragonName,
        signetType: d.config.signetType,
        mood: d.config.mood,
        bond: d.config.bond,
      }));

    const systemPrompt = buildDragonChatPrompt(
      myDragon.dragonName,
      characterName,
      myDragon.trust,
      (myDragon.mood || 'calm') as DragonMood,
      (myDragon.memories || []) as DragonMemory[],
      myDragon.dragonNotes || '',
      myDragon.speechHabits,
      [narrativeContent],
      myDragon.bond,
      myDragon.riderEmotionalLog,
      partyCtx,
    );

    const reactionPrompt = systemPrompt + `\n\n## NARRATIVE REACTION MODE\nThe DM just narrated new events. You experienced this through the bond — you felt your rider's emotions, sensed the danger or calm, witnessed what happened through shared perception.\n\nReact naturally as the dragon would. This might be:\n- A warning about something you noticed\n- An emotional reaction to what happened\n- A comment on an NPC\n- Tactical input about a threat\n- A feeling shared through the bond\n- Or silence, if nothing warrants a response (respond with exactly "SILENCE" and nothing else)\n\nDo NOT summarize the narrative. React to it. Keep your response consistent with your current trust level and mood. Use your personality profile as the sole guide for your voice and temperament.`;

    try {
      const authToken = await getAuthToken();
      const resp = await fetch(AI_DM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: [
            ...dragonChatMessages.slice(-20).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: '[The bond flares with new sensation — events unfold in the world around you.]' },
          ],
          systemPromptOverride: reactionPrompt,
          model: loadSelectedModel(),
          maxTokens: 500,
        }),
      });

      if (!resp.ok) return;
      if (!resp.body) return;

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) assistantContent += delta;
          } catch { /* skip */ }
        }
      }

      if (!assistantContent.trim() || assistantContent.trim().toUpperCase() === 'SILENCE') return;

      const dragonMsg: DragonChatMessage = {
        role: 'assistant',
        content: assistantContent.trim(),
        timestamp: new Date().toISOString(),
      };

      const updatedChat = [...dragonChatMessages, dragonMsg];
      setDragonChatMessages(updatedChat);
      await saveDragonChat(updatedChat);

      const moodMatch = assistantContent.match(/<!--DRAGON_MOOD:(\w+)-->/);
      if (moodMatch) {
        const newMood = moodMatch[1] as DragonMood;
        if (['calm', 'alert', 'protective', 'distant', 'ancestral', 'playful'].includes(newMood)) {
          await updateMyDragon({ mood: newMood });
        }
      }

      const memoryMatches = [...assistantContent.matchAll(/<!--DRAGON_MEMORY:(.+?)-->/g)];
      if (memoryMatches.length > 0) {
        let memories = [...((myDragon.memories || []) as DragonMemory[])];
        for (const match of memoryMatches) {
          const fakeState = { memories } as any;
          const updated = addMemory(fakeState, match[1], 'bond-chat');
          memories = updated.memories;
        }
        await updateMyDragon({ memories: memories.slice(-30) as any });
      }

      const habitMatches = [...assistantContent.matchAll(/<!--DRAGON_HABIT:(.+?)-->/g)];
      if (habitMatches.length > 0) {
        const currentHabits = myDragon.speechHabits || [];
        const newHabits = habitMatches.map(m => m[1].trim());
        await updateMyDragon({ speechHabits: [...currentHabits, ...newHabits].slice(-10) });
      }

    } catch (err) {
      console.warn('[DragonBonds] Narrative reaction failed:', err);
    }
  }, [partyId, userId, myDragon, dragonChatMessages, allDragonConfigs, partyMembers, saveDragonChat, updateMyDragon]);
  const sendDragonNetworkMessage = useCallback(async (
    targetDragonName: string,
    targetUserId: string,
    targetCharacterName: string,
    riderMessage: string,
    myCharacterName: string,
    recentNarrative?: string[],
  ): Promise<void> => {
    if (!partyId || !userId || !myDragon?.dragonName || isSending) return;
    setIsSending(true);

    const pendingId = `pending-${Date.now()}`;
    setDragonNetworkMessages(prev => [...prev, {
      id: pendingId,
      fromDragon: myDragon.dragonName,
      fromUserId: userId,
      toDragon: targetDragonName,
      toUserId: targetUserId,
      riderMessage,
      dragonExchange: '',
      timestamp: new Date().toISOString(),
    }]);

    try {
      const narrativeCtx = recentNarrative?.length
        ? `\n\nRecent events:\n${recentNarrative.slice(-3).join('\n---\n')}`
        : '';

      const authToken = await getAuthToken();

      // --- Helper: read SSE stream into a string ---
      const readSSE = async (resp: Response): Promise<string> => {
        if (!resp.body) throw new Error('No response body');
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = '';
        let content = '';
        let done = false;
        while (true) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
          textBuffer += decoder.decode(value, { stream: true });
          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') { done = true; break; }
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (delta) content += delta;
            } catch { /* skip */ }
          }
          if (done) break;
        }
        return content;
      };

      // --- Find target dragon config ---
      const targetEntry = allDragonConfigs.find(e => e.userId === targetUserId);
      const targetNotes = targetEntry?.config.dragonNotes || '';
      const targetMood = (targetEntry?.config.mood || 'calm') as DragonMood;
      const targetTrust = targetEntry?.config.trust ?? 10;
      const targetMemories = (targetEntry?.config.memories || []) as DragonMemory[];
      const targetBond = targetEntry?.config.bond ?? 15;
      const targetSpeechHabits = targetEntry?.config.speechHabits;
      const targetRiderEmotionalLog = targetEntry?.config.riderEmotionalLog;

      // --- AI CALL 1: Sender's dragon ---
      const senderBasePrompt = buildDragonChatPrompt(
        myDragon.dragonName, myCharacterName, myDragon.trust,
        myDragon.mood as DragonMood, myDragon.memories as DragonMemory[],
        myDragon.dragonNotes || '', myDragon.speechHabits, recentNarrative?.slice(-3),
        myDragon.bond, myDragon.riderEmotionalLog,
      );
      const senderPrompt = senderBasePrompt + `\n\nYour rider has asked you to reach ${targetDragonName} through the dragon network. The request: "${riderMessage}". Respond with a JSON object ONLY (no markdown, no backticks): { "dragonToDragon": "what you telepathically send to ${targetDragonName} in 1-3 sentences, using your voice and personality, as proud ancient dragons communicate", "reportToRider": "what you tell your rider about reaching out, 1-2 sentences, your voice" }${narrativeCtx}`;

      const resp1 = await fetch(AI_DM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: riderMessage }],
          systemPromptOverride: senderPrompt,
          model: loadSelectedModel(),
        }),
      });
      if (!resp1.ok) throw new Error('Dragon network sender call failed');

      const senderRaw = await readSSE(resp1);
      let senderParsed: { dragonToDragon: string; reportToRider: string };
      try {
        senderParsed = JSON.parse(senderRaw.replace(/```json|```/g, '').trim());
      } catch {
        senderParsed = {
          dragonToDragon: `${myDragon.dragonName} reaches through the network with a pulse of ancient thought.`,
          reportToRider: `It is done. ${targetDragonName} received my thought.`,
        };
      }

      // --- AI CALL 2: Recipient's dragon ---
      const recipientBasePrompt = buildDragonChatPrompt(
        targetDragonName, targetCharacterName, targetTrust,
        targetMood, targetMemories,
        targetNotes, targetSpeechHabits, recentNarrative?.slice(-3),
        targetBond, targetRiderEmotionalLog,
      );
      const recipientPrompt = recipientBasePrompt + `\n\nAnother dragon, ${myDragon.dragonName}, has just contacted you through the dragon network. They said: "${senderParsed.dragonToDragon}". You must now do two things. Respond with a JSON object ONLY (no markdown, no backticks): { "dragonReply": "your reply back to ${myDragon.dragonName} through the network, 1-2 sentences, in your own voice and personality", "riderDelivery": "what you tell YOUR rider ${targetCharacterName} through the bond. You MUST deliver something. Filter the message through your personality. Phrase it as your own thought or observation. Do NOT mention ${myDragon.dragonName} or ${myCharacterName} by name. Your rider must not know another rider initiated this. You may editorialize, warn, soften, or add your own opinion. 1-3 sentences in your own voice." }`;

      const resp2 = await fetch(AI_DM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: senderParsed.dragonToDragon }],
          systemPromptOverride: recipientPrompt,
          model: 'google/gemini-2.5-flash',
        }),
      });
      if (!resp2.ok) throw new Error('Dragon network recipient call failed');

      const recipientRaw = await readSSE(resp2);
      let recipientParsed: { dragonReply: string; riderDelivery: string };
      try {
        recipientParsed = JSON.parse(recipientRaw.replace(/```json|```/g, '').trim());
      } catch {
        recipientParsed = {
          dragonReply: `${targetDragonName} acknowledges with a rumble of ancient thought.`,
          riderDelivery: `${targetDragonName} stirs through the bond, pressing a wordless impression into your mind — something has their attention.`,
        };
      }

      // Ensure riderDelivery is never empty
      if (!recipientParsed.riderDelivery?.trim()) {
        recipientParsed.riderDelivery = `${targetDragonName} stirs through the bond, pressing a wordless impression into your mind — something has their attention.`;
      }

      const finalMsg: DragonNetworkMessage = {
        id: `net-${Date.now()}`,
        fromDragon: myDragon.dragonName,
        fromUserId: userId,
        toDragon: targetDragonName,
        toUserId: targetUserId,
        riderMessage,
        dragonExchange: `*${myDragon.dragonName} → ${targetDragonName}:* ${senderParsed.dragonToDragon}\n\n*${targetDragonName} → ${myDragon.dragonName}:* ${recipientParsed.dragonReply}`,
        toRiderDelivery: recipientParsed.riderDelivery.trim(),
        senderReport: senderParsed.reportToRider?.trim() || undefined,
        timestamp: new Date().toISOString(),
      };

      setDragonNetworkMessages(prev => prev.map(m => m.id === pendingId ? finalMsg : m));

      await supabase.from('party_shared_state').insert([{
        party_id: partyId,
        user_id: userId,
        state_type: 'dragon_network_message',
        state_data: finalMsg as any,
      }]);

      await supabase.from('party_shared_state').insert([{
        party_id: partyId,
        user_id: targetUserId,
        state_type: 'dragon_network_message',
        state_data: { ...finalMsg, id: `net-recv-${Date.now()}` } as any,
      }]);

    } catch (err) {
      console.error('[DragonNetwork] Error:', err);
      setDragonNetworkMessages(prev => prev.filter(m => m.id !== pendingId));
    } finally {
      if (mountedRef.current) setIsSending(false);
    }
  }, [partyId, userId, myDragon, isSending, allDragonConfigs]);

  const isSetup = Boolean(myDragon && myDragon.dragonName);

  return useMemo(() => ({
    myDragon,
    isSetup,
    allDragonConfigs,
    saveMyDragon,
    updateMyDragon,
    updateBurnout,
    updateBondAndTrust,
    // Dragon chat
    dragonChatMessages,
    isSending,
    sendDragonMessage,
    loadDragonChat,
    generateDragonOpinion,
    generateNarrativeReactions,
    clearDragonChat: async () => {
      setDragonChatMessages([]);
      await saveDragonChat([]);
    },
    deleteFromDragonChat: async (index: number) => {
      const current = [...dragonChatMessages];
      current.splice(index, 1);
      setDragonChatMessages(current);
      await saveDragonChat(current);
    },
    // Dragon network
    dragonNetworkMessages,
    sendDragonNetworkMessage,
    // Mood shift (in-memory only)
    lastMoodShift: lastMoodShiftRef.current,
  }), [myDragon, isSetup, allDragonConfigs, saveMyDragon, updateMyDragon, updateBurnout, updateBondAndTrust, dragonChatMessages, isSending, sendDragonMessage, loadDragonChat, generateDragonOpinion, generateNarrativeReactions, saveDragonChat, dragonNetworkMessages, sendDragonNetworkMessage]);
}
