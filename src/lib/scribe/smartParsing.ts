// ═══════════════════════════════════════════════════════════════════════════
// SMART PARSING - Filters chat logs to extract only AI/DM content
// Mirrors the logic in the narrative-forge edge function
// ═══════════════════════════════════════════════════════════════════════════

export interface ParsedLine {
  lineNumber: number;
  content: string;
  type: 'assistant' | 'user' | 'label';
}

export interface SmartParseResult {
  originalText: string;
  filteredText: string;
  isChatFormat: boolean;
  keptLines: ParsedLine[];
  filteredLines: ParsedLine[];
  stats: {
    originalCharCount: number;
    filteredCharCount: number;
    keptLineCount: number;
    filteredLineCount: number;
    reductionPercent: number;
  };
}

/**
 * Detect if text appears to be a chat log format (has user/assistant labels)
 */
export function isChatLogFormat(text: string): boolean {
  // Check for typical chat log markers
  const hasUserLabel = /\buser\b\s*$/im.test(text) || /^\*\*user\*\*\s*$/im.test(text);
  const hasAssistantLabel = /\bassistant\b\s*$/im.test(text) || /^\*\*assistant\*\*\s*$/im.test(text);
  
  // Also check for inline patterns
  const hasInlineUser = /^(\*\*)?(user)(\*\*)?:\s*/im.test(text);
  const hasInlineAssistant = /^(\*\*)?(assistant)(\*\*)?:\s*/im.test(text);
  
  return hasUserLabel || hasAssistantLabel || hasInlineUser || hasInlineAssistant;
}

/**
 * Extract only assistant/DM content from chat logs.
 * Filters out user/player messages marked with "user" or "User" labels.
 */
export function extractAssistantContent(text: string): SmartParseResult {
  const lines = text.split('\n');
  const keptLines: ParsedLine[] = [];
  const filteredLines: ParsedLine[] = [];
  const resultLines: string[] = [];
  
  let inUserSection = false;
  let inAssistantSection = true; // Default to keeping content until we see a label
  
  const isChatFormat = isChatLogFormat(text);
  
  // If not a chat format, return the original text unchanged
  if (!isChatFormat) {
    return {
      originalText: text,
      filteredText: text,
      isChatFormat: false,
      keptLines: lines.map((content, i) => ({ lineNumber: i + 1, content, type: 'assistant' as const })),
      filteredLines: [],
      stats: {
        originalCharCount: text.length,
        filteredCharCount: text.length,
        keptLineCount: lines.length,
        filteredLineCount: 0,
        reductionPercent: 0,
      },
    };
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    
    // Detect section markers
    // Match "user" or "**user**" at start of line (case insensitive)
    if (/^(\*\*)?user(\*\*)?:?\s*$/i.test(line.trim()) || 
        /^user\s*$/i.test(line.trim())) {
      inUserSection = true;
      inAssistantSection = false;
      filteredLines.push({ lineNumber, content: line, type: 'label' });
      continue;
    }
    
    // Match "assistant" or "**assistant**" at start of line
    if (/^(\*\*)?assistant(\*\*)?:?\s*$/i.test(line.trim()) || 
        /^assistant\s*$/i.test(line.trim())) {
      inUserSection = false;
      inAssistantSection = true;
      filteredLines.push({ lineNumber, content: line, type: 'label' });
      continue;
    }
    
    // Also detect inline patterns like "User: message" or "**User**: message"
    const userInlineMatch = line.match(/^(\*\*)?(user)(\*\*)?:\s*(.*)$/i);
    if (userInlineMatch) {
      filteredLines.push({ lineNumber, content: line, type: 'user' });
      continue;
    }
    
    const assistantInlineMatch = line.match(/^(\*\*)?(assistant)(\*\*)?:\s*(.*)$/i);
    if (assistantInlineMatch) {
      // Keep the content after "assistant:"
      const contentAfterLabel = assistantInlineMatch[4];
      resultLines.push(contentAfterLabel);
      keptLines.push({ lineNumber, content: line, type: 'assistant' });
      inUserSection = false;
      inAssistantSection = true;
      continue;
    }
    
    // Keep content if we're in an assistant section (or default section before any labels)
    if (inAssistantSection && !inUserSection) {
      resultLines.push(line);
      keptLines.push({ lineNumber, content: line, type: 'assistant' });
    } else {
      filteredLines.push({ lineNumber, content: line, type: 'user' });
    }
  }
  
  // Clean up: remove excessive blank lines
  let cleaned = resultLines.join('\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  
  const originalCharCount = text.length;
  const filteredCharCount = cleaned.length;
  const reductionPercent = originalCharCount > 0 
    ? Math.round((1 - filteredCharCount / originalCharCount) * 100)
    : 0;
  
  return {
    originalText: text,
    filteredText: cleaned,
    isChatFormat: true,
    keptLines,
    filteredLines,
    stats: {
      originalCharCount,
      filteredCharCount,
      keptLineCount: keptLines.length,
      filteredLineCount: filteredLines.length,
      reductionPercent,
    },
  };
}

/**
 * Get a quick summary of what will be filtered
 */
export function getSmartParsePreview(text: string): {
  isChatFormat: boolean;
  willFilter: boolean;
  summary: string;
  stats: SmartParseResult['stats'] | null;
} {
  if (!text.trim()) {
    return {
      isChatFormat: false,
      willFilter: false,
      summary: 'No content to analyze',
      stats: null,
    };
  }
  
  const result = extractAssistantContent(text);
  
  if (!result.isChatFormat) {
    return {
      isChatFormat: false,
      willFilter: false,
      summary: 'Standard text (no chat format detected)',
      stats: null,
    };
  }
  
  return {
    isChatFormat: true,
    willFilter: result.stats.filteredLineCount > 0,
    summary: result.stats.filteredLineCount > 0
      ? `Chat format detected: ${result.stats.keptLineCount} lines kept, ${result.stats.filteredLineCount} filtered (${result.stats.reductionPercent}% reduction)`
      : 'Chat format detected, but no user content to filter',
    stats: result.stats,
  };
}
