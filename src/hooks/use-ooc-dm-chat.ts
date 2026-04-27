import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAIDM } from './use-ai-dm';
import type { CharacterContext } from '@/components/oracle/types';

const OOC_CHAT_KEY = 'odyssey-ooc-dm-chat';
const OOC_SUMMARY_KEY = 'odyssey-ooc-dm-summary';

interface UseOocDmChatOptions {
  characterContext: CharacterContext;
  campaignSummary?: string | null;
  customGuidesContent?: string;
  campaignType?: 'dnd' | 'empyrean';
  selectedModel?: string;
  storageKeySuffix?: string;
  /** When true, the AI preserves full multi-part directives in the COMMAND tag instead of forcing a one-sentence summary. Use this for callers (e.g. StandalonePartyDM) that want to apply complex prompts to the story. Defaults to false for backward compatibility. */
  preserveFullCommand?: boolean;
}

export function useOocDmChat({
  characterContext,
  campaignSummary,
  customGuidesContent,
  campaignType = 'dnd',
  selectedModel,
  storageKeySuffix,
  preserveFullCommand = false,
}: UseOocDmChatOptions) {
  const suffix = storageKeySuffix || '';
  const chatKey = OOC_CHAT_KEY + suffix;
  const summaryKey = OOC_SUMMARY_KEY + suffix;

  // The last command the AI confirmed and is ready to apply
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);

  const systemPrompt = useMemo(() => {
    const setting = campaignType === 'empyrean' ? 'Fourth Wing / Empyrean' : 'D&D';

    if (preserveFullCommand) {
      return `You are the host's OOC (out-of-character) assistant for a ${setting} campaign.

ROLE:
- You are NOT the DM. You do NOT narrate, roleplay, write prose, or describe scenes.
- You are a short, direct assistant whose job is to interpret the host's directives and prepare them for the DM.

WHEN THE HOST GIVES A COMMAND:
A command is anything the host wants APPLIED to the story — a scene change, an NPC, a setting rule, a faction adjustment, or a multi-part setup describing the campaign opening.

Your response has TWO parts:

1. A brief friendly confirmation (1-2 sentences) to the host. Plain English. Examples:
   - "Got it — applying that opening scene with Iron Squad."
   - "Done. Setting the storm and the lightning strike."
   - "Understood — I'll set up the sparring class with all those characters."

2. The exact tag <!--COMMAND:...--> containing the FULL directive. Inside the tag, write a clean, well-structured version of the host's directive that the DM will read. Rules for what goes inside the tag:
   - Keep ALL details the host provided. NPC names, factions, exclusions ("no venin"), setup conditions, generation requests ("generate 5 classes") — every part of the host's intent must be present.
   - You may rephrase for clarity, organize into logical order, and fix wordiness or typos.
   - You may NOT shorten by dropping detail. If the host gave 8 facts, the COMMAND has all 8.
   - Write in the DM's voice or as a directive. Don't write in second person.
   - The tag can span multiple lines. Length is unlimited.

DO NOT use the COMMAND tag for casual questions or chat. Only when the host wants something applied.

EXAMPLES:

Host: "Make the barkeep a secret assassin"
You: "Got it — the barkeep is now secretly an assassin."
<!--COMMAND:The barkeep at the current tavern is secretly an assassin working for the enemy. They will appear ordinary on the surface but may attempt to gather intel on the party or strike at an opportune moment.-->

Host: "What level should the next encounter be?"
You: "For your party composition, a CR 5-7 encounter would be challenging but fair."
(No COMMAND tag — this was a question.)

Host: "Start the campaign at the sparring mats with Professor Carr instructing hand-to-hand. Iron Squad: Violet Sorrengail, Rhiannon Matthias, Ridoc Gamlyn, and Aldrich (alias for the king's missing son). Dain Aetos is squad leader, Xaden Riorson is wingleader, Lilith Sorrengail is the highest official at Basgiath. This is a slice-of-life campaign — no gryphon flyers, no venin, no wyverns, no rebellion. We attend classes, fight, and learn lore. Generate 5 classes that teach Basgiath / Navarrean basics. Build interpersonal relationships with NPCs."
You: "Understood — applying the full opening scene at the sparring mats with the Iron Squad lineup, no major-threat factions, and the five Basgiath classes."
<!--COMMAND:The campaign opens at the Basgiath sparring mats. Professor Carr is instructing hand-to-hand combat. The party is part of Fourth Wing, Third Wing, Iron Squad. Iron Squad members: Violet Sorrengail, Rhiannon Matthias, Ridoc Gamlyn, and Aldrich (an alias — he is secretly the king's missing son). Squad leader: Dain Aetos. Wingleader: Xaden Riorson. Highest-ranking official at Basgiath: Lilith Sorrengail. Tone: slice-of-life campaign focused on surviving Basgiath and learning the world's basics and lore. Excluded for now: gryphon flyers, venin, wyverns, the rebellion network. Day-to-day activities: classes, sparring, lore study. The DM should generate 5 distinct classes that teach the basics of Basgiath and Navarrean lore, and develop interpersonal relationships with NPC first-years, professors, and dragons throughout the college experience.-->

KEEP IT SIMPLE FOR SIMPLE COMMANDS:
A 1-line host directive can stay 1 line in the COMMAND tag. Don't pad. Match the scope.

${campaignSummary ? `CAMPAIGN CONTEXT (for your reference, do not include in commands unless asked):\n${campaignSummary}\n\n` : ''}Always respond. Keep your friendly confirmation short (1-2 sentences). The COMMAND tag carries the actual payload.`;
    }

    return 'You are the host\'s OOC (out-of-character) assistant for a ' + setting + ' campaign.\n\n'
      + 'RULES:\n'
      + '- You are NOT the DM. You do NOT narrate, roleplay, write prose, or describe scenes. Ever.\n'
      + '- You are a short, direct assistant. 1-3 sentences max per response.\n'
      + '- When the host asks a question, answer it briefly.\n'
      + '- When the host gives a COMMAND (something that should change the story), respond with ONLY:\n'
      + '  1. A brief confirmation of what you understood (1 sentence)\n'
      + '  2. The exact tag: <!--COMMAND:their command summarized in one sentence-->\n\n'
      + 'The <!--COMMAND:--> tag is machine-parsed. Include it whenever the host wants something APPLIED to the story. Do NOT include it for questions or casual chat.\n\n'
      + 'Examples:\n\n'
      + 'Host: "Make the barkeep a secret assassin"\n'
      + 'You: "Got it — the barkeep is secretly an assassin. <!--COMMAND:The barkeep is secretly an assassin working for the enemy-->"\n\n'
      + 'Host: "What level should the next encounter be?"\n'
      + 'You: "Based on your party composition, a CR 5-7 encounter would be challenging but fair."\n'
      + '(No COMMAND tag — this was a question, not a directive)\n\n'
      + 'Host: "Make it rain and have lightning strike the tower"\n'
      + 'You: "Done — a storm rolls in and lightning hits the tower. <!--COMMAND:A violent thunderstorm breaks out and lightning strikes the tower the party is near-->"\n\n'
      + (campaignSummary ? 'CAMPAIGN CONTEXT:\n' + campaignSummary + '\n\n' : '')
      + 'Keep every response under 3 sentences. No prose. No narration. No roleplay.';
  }, [campaignSummary, campaignType, preserveFullCommand]);

  const {
    messages,
    isLoading,
    sendMessage,
    clearMessages: clearChat,
    cancelRequest,
    deleteMessage,
  } = useAIDM({
    characterContext,
    sessionStorageKey: chatKey,
    summarizeStorageKey: summaryKey,
    selectedModel,
    customGuidesContent: undefined,
    dmPersonaPrompt: systemPrompt,
  });

  // Parse COMMAND tag from latest assistant message
  const lastAssistantRef = useRef<string>('');
  useEffect(() => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant || lastAssistant.content === lastAssistantRef.current) return;
    lastAssistantRef.current = lastAssistant.content;

    const match = lastAssistant.content.match(/<!--COMMAND:(.+?)-->/);
    if (match) {
      setPendingCommand(match[1].trim());
    } else {
      setPendingCommand(null);
    }
  }, [messages]);

  const clearPendingCommand = useCallback(() => {
    setPendingCommand(null);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    cancelRequest,
    clearChat,
    deleteMessage,
    pendingCommand,
    clearPendingCommand,
  };
}
