import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type PartyDragonConfig } from '@/hooks/use-party-dm';
import { getAuthToken } from '@/lib/auth-token';
import { buildDragonChatPrompt, addMemory, detectTrustBreak, detectRiderDeclaration, classifyRiderEmotion, type DragonMood, type DragonMemory } from '@/lib/dragonBondState';
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

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

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
  }, [fetchAll]);

  // Realtime subscription
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
          if (row.state_type === 'dragon_network_message' && row.user_id === userId) {
            const incoming = row.state_data as unknown as DragonNetworkMessage;
            setDragonNetworkMessages(prev => {
              if (prev.some(m => m.id === incoming.id)) return prev;
              return [...prev, incoming];
            });
            return;
          }
          if (row.state_type !== 'dragon_bond') return;
          fetchAll();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [partyId, fetchAll]);

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

  // Load dragon network messages + realtime subscription
  useEffect(() => {
    if (!partyId || !userId) return;

    // Initial fetch
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

    // Realtime subscription for new/updated dragon network messages targeting this user
    const channel = supabase
      .channel(`dragon-network-${partyId}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'party_shared_state',
          filter: `party_id=eq.${partyId}`,
        },
        (payload) => {
          const row = payload.new as { state_type: string; user_id: string; state_data: unknown };
          if (row.state_type !== 'dragon_network_message' || row.user_id !== userId) return;
          const msg = row.state_data as unknown as DragonNetworkMessage;
          if (!msg?.id) return;
          setDragonNetworkMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'party_shared_state',
          filter: `party_id=eq.${partyId}`,
        },
        (payload) => {
          const row = payload.new as { state_type: string; user_id: string; state_data: unknown };
          if (row.state_type !== 'dragon_network_message' || row.user_id !== userId) return;
          const msg = row.state_data as unknown as DragonNetworkMessage;
          if (!msg?.id) return;
          setDragonNetworkMessages(prev =>
            prev.map(m => m.id === msg.id ? msg : m)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

      const systemPrompt = buildDragonChatPrompt(
        myDragon.dragonName,
        characterName,
        myDragon.trust,
        myDragon.mood as DragonMood,
        (myDragon.memories || []) as DragonMemory[],
        myDragon.dragonNotes || '',
        myDragon.speechHabits,
        recentNarrative,
        myDragon.bond,
        myDragon.riderEmotionalLog,
        partyContext,
      );

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

      // Parse mood tag
      const moodMatch = assistantContent.match(/<!--DRAGON_MOOD:(\w+)-->/);
      if (moodMatch) {
        const validMoods: DragonMood[] = ['calm', 'alert', 'protective', 'distant', 'ancestral', 'playful'];
        if (validMoods.includes(moodMatch[1] as DragonMood)) {
          updatedDragon = { ...updatedDragon, mood: moodMatch[1] as DragonMood };
        }
      }

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

      const systemPrompt = `You are ${myDragon.dragonName}, a dragon. Your rider ${myCharacterName} has asked you to use the dragon network to reach ${targetDragonName}. The request: "${riderMessage}"\n\nRespond with a JSON object ONLY (no markdown, no backticks):\n{\n  "dragonToDragon": "what you say to ${targetDragonName} dragon-to-dragon (1-2 sentences, ancient proud tone)",\n  "targetDragonReply": "how ${targetDragonName} replies to you dragon-to-dragon (1-2 sentences, their own personality)",\n  "riderDelivery": "if the message is meant for ${targetCharacterName}, what ${targetDragonName} says to ${targetCharacterName} through their bond — phrased as if ${targetDragonName} thought of it unprompted, zero mention of ${myCharacterName} or ${myDragon.dragonName}. Empty string if this is purely dragon-to-dragon."\n}${narrativeCtx}`;

      const resp = await fetch(AI_DM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: riderMessage }],
          systemPromptOverride: systemPrompt,
          model: loadSelectedModel(),
        }),
      });

      if (!resp.ok) throw new Error('Dragon network request failed');
      const data = await resp.json();
      const raw: string = data?.response || data?.content || '';

      let parsed: { dragonToDragon: string; targetDragonReply: string; riderDelivery: string };
      try {
        parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      } catch {
        parsed = {
          dragonToDragon: `${myDragon.dragonName} sends a thought through the network.`,
          targetDragonReply: `${targetDragonName} acknowledges.`,
          riderDelivery: '',
        };
      }

      const finalMsg: DragonNetworkMessage = {
        id: `net-${Date.now()}`,
        fromDragon: myDragon.dragonName,
        fromUserId: userId,
        toDragon: targetDragonName,
        toUserId: targetUserId,
        riderMessage,
        dragonExchange: `*${myDragon.dragonName} → ${targetDragonName}:* ${parsed.dragonToDragon}\n\n*${targetDragonName} → ${myDragon.dragonName}:* ${parsed.targetDragonReply}`,
        toRiderDelivery: parsed.riderDelivery?.trim() || undefined,
        timestamp: new Date().toISOString(),
      };

      setDragonNetworkMessages(prev => prev.map(m => m.id === pendingId ? finalMsg : m));

      await supabase.from('party_shared_state').insert([{
        party_id: partyId,
        user_id: userId,
        state_type: 'dragon_network_message',
        state_data: finalMsg as any,
      }]);

      if (finalMsg.toRiderDelivery) {
        await supabase.from('party_shared_state').insert([{
          party_id: partyId,
          user_id: targetUserId,
          state_type: 'dragon_network_message',
          state_data: { ...finalMsg, id: `net-recv-${Date.now()}` } as any,
        }]);
      }

    } catch (err) {
      console.error('[DragonNetwork] Error:', err);
      setDragonNetworkMessages(prev => prev.filter(m => m.id !== pendingId));
    } finally {
      if (mountedRef.current) setIsSending(false);
    }
  }, [partyId, userId, myDragon, isSending]);

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
    // Dragon network
    dragonNetworkMessages,
    sendDragonNetworkMessage,
  }), [myDragon, isSetup, allDragonConfigs, saveMyDragon, updateMyDragon, updateBurnout, updateBondAndTrust, dragonChatMessages, isSending, sendDragonMessage, loadDragonChat, generateDragonOpinion, dragonNetworkMessages, sendDragonNetworkMessage]);
}
