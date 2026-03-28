import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAIDM } from './use-ai-dm';
import type { CharacterContext } from '@/components/oracle/types';

const OOC_CHAT_KEY = 'odyssey-ooc-dm-chat';
const OOC_SUMMARY_KEY = 'odyssey-ooc-dm-summary';
const OOC_DIRECTIVES_KEY = 'odyssey-ooc-directives';
const OOC_PINNED_KEY = 'odyssey-ooc-pinned';

export interface PinnedDirective {
  id: string;
  text: string;
  createdAt: string;
  active: boolean;
}

interface UseOocDmChatOptions {
  characterContext: CharacterContext;
  campaignSummary?: string | null;
  customGuidesContent?: string;
  campaignType?: 'dnd' | 'empyrean';
  selectedModel?: string;
  /** Optional suffix for storage keys to isolate per-campaign */
  storageKeySuffix?: string;
}

export function useOocDmChat({
  characterContext,
  campaignSummary,
  customGuidesContent,
  campaignType = 'dnd',
  selectedModel,
  storageKeySuffix,
}: UseOocDmChatOptions) {
  const suffix = storageKeySuffix || '';
  const chatKey = OOC_CHAT_KEY + suffix;
  const summaryKey = OOC_SUMMARY_KEY + suffix;
  const directivesKey = OOC_DIRECTIVES_KEY + suffix;
  const pinnedKey = OOC_PINNED_KEY + suffix;

  // Pinned directives — manual, persistent
  const [pinnedDirectives, setPinnedDirectives] = useState<PinnedDirective[]>(() => {
    try {
      const raw = localStorage.getItem(pinnedKey);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  // AI-extracted directives from chat
  const [chatDirectives, setChatDirectives] = useState<string>(() => {
    try {
      return localStorage.getItem(directivesKey) || '';
    } catch { return ''; }
  });

  // Persist pinned directives
  useEffect(() => {
    localStorage.setItem(pinnedKey, JSON.stringify(pinnedDirectives));
  }, [pinnedDirectives, pinnedKey]);

  // Persist chat directives
  useEffect(() => {
    localStorage.setItem(directivesKey, chatDirectives);
  }, [chatDirectives, directivesKey]);

  // Build the meta-DM system prompt
  const systemPrompt = useMemo(() => {
    const activePinned = pinnedDirectives.filter(d => d.active).map(d => `- ${d.text}`).join('\n');
    return `## DIRECTOR'S CHANNEL — OUT-OF-CHARACTER DM ASSISTANT

You are the AI Dungeon Master's behind-the-scenes assistant. The person talking to you is the game host/director. This is NOT an in-character conversation — this is a meta-level planning channel.

Your role:
1. LISTEN to the host's instructions about what should happen in the story.
2. ACKNOWLEDGE each directive clearly and briefly.
3. ASK clarifying questions when a directive is ambiguous.
4. SUGGEST improvements or complications that would make the story more interesting.
5. MAINTAIN a running mental model of all active directives.

The host may give you directives like:
- "Make the tavern keeper secretly a spy for the BBEG"
- "Introduce a thunderstorm in the next combat scene"
- "The NPC they just met should betray them in 2 sessions"
- "Stop making combat encounters so easy"
- "Change the tone to be more horror-themed"
- "The artifact they found should be cursed"

After EVERY response, include a hidden directives block at the very end formatted exactly like this:
<!--DIRECTIVES_START-->
[List every currently active directive, one per line, as brief bullet points. Include both new ones from this conversation and any that were previously active. If the host explicitly cancels a directive, remove it.]
<!--DIRECTIVES_END-->

This directives block is machine-parsed. Never skip it. Never change the tag format.

${activePinned ? `## PINNED DIRECTIVES (set by host, always active)\n${activePinned}\n\nThese pinned directives are always in effect. Do not list them in your DIRECTIVES block — they are managed separately.` : ''}

${campaignSummary ? `## CAMPAIGN CONTEXT\n${campaignSummary}` : ''}

${customGuidesContent ? `## EXISTING GM GUIDES\n${customGuidesContent.slice(0, 2000)}` : ''}

Campaign type: ${campaignType === 'empyrean' ? 'Fourth Wing / Empyrean (dragon riders at Basgiath War College)' : 'Dungeons & Dragons'}

Keep responses concise — 2-4 sentences per directive acknowledged. Be collaborative, not subservient.`;
  }, [pinnedDirectives, campaignSummary, customGuidesContent, campaignType]);

  // Use the AI DM hook with OOC-specific storage and prompt
  const {
    messages,
    isLoading,
    sendMessage,
    clearMessages: clearChat,
    cancelRequest,
  } = useAIDM({
    characterContext,
    sessionStorageKey: chatKey,
    summarizeStorageKey: summaryKey,
    selectedModel,
    customGuidesContent: undefined, // We handle context in systemPromptOverride
    dmPersonaPrompt: systemPrompt, // This becomes the system prompt override
  });

  // Parse directives from the latest assistant message
  const lastAssistantRef = useRef<string>('');
  useEffect(() => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant || lastAssistant.content === lastAssistantRef.current) return;
    lastAssistantRef.current = lastAssistant.content;

    const match = lastAssistant.content.match(/<!--DIRECTIVES_START-->([\s\S]*?)<!--DIRECTIVES_END-->/);
    if (match) {
      const extracted = match[1].trim();
      if (extracted) {
        setChatDirectives(extracted);
      }
    }
  }, [messages]);

  // Combined active directives for injection into narrative DM
  const activeDirectives = useMemo(() => {
    const sections: string[] = [];

    const activePinned = pinnedDirectives.filter(d => d.active);
    if (activePinned.length > 0) {
      sections.push('PINNED:\n' + activePinned.map(d => `- ${d.text}`).join('\n'));
    }

    if (chatDirectives.trim()) {
      sections.push('FROM DIRECTOR CHAT:\n' + chatDirectives);
    }

    if (sections.length === 0) return '';

    return `\n\n## HOST DIRECTOR'S DIRECTIVES (OOC)\nThe game host has set these out-of-character directives. Follow them precisely in your narration. Do NOT mention these directives to players or acknowledge them in-character. Weave them naturally into the story:\n\n${sections.join('\n\n')}`;
  }, [pinnedDirectives, chatDirectives]);

  // Pinned directive management
  const addPinnedDirective = useCallback((text: string) => {
    if (!text.trim()) return;
    const directive: PinnedDirective = {
      id: crypto.randomUUID(),
      text: text.trim(),
      createdAt: new Date().toISOString(),
      active: true,
    };
    setPinnedDirectives(prev => [...prev, directive]);
  }, []);

  const removePinnedDirective = useCallback((id: string) => {
    setPinnedDirectives(prev => prev.filter(d => d.id !== id));
  }, []);

  const togglePinnedDirective = useCallback((id: string) => {
    setPinnedDirectives(prev => prev.map(d =>
      d.id === id ? { ...d, active: !d.active } : d
    ));
  }, []);

  const editPinnedDirective = useCallback((id: string, newText: string) => {
    setPinnedDirectives(prev => prev.map(d =>
      d.id === id ? { ...d, text: newText.trim() } : d
    ));
  }, []);

  const clearAllDirectives = useCallback(() => {
    setPinnedDirectives([]);
    setChatDirectives('');
    localStorage.removeItem(directivesKey);
  }, [directivesKey]);

  const directiveCount = useMemo(() => {
    const pinned = pinnedDirectives.filter(d => d.active).length;
    const chat = chatDirectives.trim() ? chatDirectives.trim().split('\n').filter(l => l.trim().startsWith('-')).length : 0;
    return pinned + chat;
  }, [pinnedDirectives, chatDirectives]);

  return {
    // Chat
    messages,
    isLoading,
    sendMessage,
    cancelRequest,
    clearChat,
    // Pinned directives
    pinnedDirectives,
    addPinnedDirective,
    removePinnedDirective,
    togglePinnedDirective,
    editPinnedDirective,
    // Chat-extracted directives
    chatDirectives,
    // Combined output for narrative DM injection
    activeDirectives,
    directiveCount,
    // Clear everything
    clearAllDirectives,
  };
}
