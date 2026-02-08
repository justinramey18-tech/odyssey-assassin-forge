// ═══════════════════════════════════════════════════════════════════════════
// SESSION DETECTION - Identifies session boundaries in campaign text
// ═══════════════════════════════════════════════════════════════════════════

export interface DetectedSession {
  id: string;
  title: string;
  startIndex: number;
  endIndex: number;
  preview: string;
  wordCount: number;
  charCount: number;
  sourceFile?: string;        // Originating filename for multi-file uploads
  sourceFileIndex?: number;   // File order position for sorting
}

interface SessionMarkerMatch {
  index: number;
  title: string;
  pattern: string;
}

// Session marker patterns in order of priority
const SESSION_PATTERNS: Array<{ pattern: RegExp; titleExtractor: (match: RegExpMatchArray) => string }> = [
  // "--- Session 1 ---" or "=== Session 1 ==="
  { 
    pattern: /^[-=]{3,}\s*Session\s+(\d+)[:\s-]*([^\n-=]*?)[-=]*$/gim,
    titleExtractor: (m) => m[2]?.trim() ? `Session ${m[1]}: ${m[2].trim()}` : `Session ${m[1]}`
  },
  // "# Session 1: The Beginning" or "## Session 1"
  { 
    pattern: /^#{1,3}\s*Session\s+(\d+)[:\s-]*(.+)?$/gim,
    titleExtractor: (m) => m[2]?.trim() ? `Session ${m[1]}: ${m[2].trim()}` : `Session ${m[1]}`
  },
  // "Session 1 - The Dark Forest" or "Session 1:"
  { 
    pattern: /^Session\s+(\d+)[:\s-]+(.+)?$/gim,
    titleExtractor: (m) => m[2]?.trim() ? `Session ${m[1]}: ${m[2].trim()}` : `Session ${m[1]}`
  },
  // "[Session 1]" or "[Session 1: Title]"
  { 
    pattern: /^\[Session\s+(\d+)[:\s-]*([^\]]*)\]/gim,
    titleExtractor: (m) => m[2]?.trim() ? `Session ${m[1]}: ${m[2].trim()}` : `Session ${m[1]}`
  },
  // "CHAPTER 1" or "Chapter 1: Title"
  { 
    pattern: /^(?:CHAPTER|Chapter)\s+(\d+)[:\s-]*(.+)?$/gim,
    titleExtractor: (m) => m[2]?.trim() ? `Chapter ${m[1]}: ${m[2].trim()}` : `Chapter ${m[1]}`
  },
  // "DAY 1" or "Day 1: Title"
  { 
    pattern: /^(?:DAY|Day)\s+(\d+)[:\s-]*(.+)?$/gim,
    titleExtractor: (m) => m[2]?.trim() ? `Day ${m[1]}: ${m[2].trim()}` : `Day ${m[1]}`
  },
  // "Part 1" or "Part I"
  { 
    pattern: /^(?:PART|Part)\s+(\d+|[IVX]+)[:\s-]*(.+)?$/gim,
    titleExtractor: (m) => m[2]?.trim() ? `Part ${m[1]}: ${m[2].trim()}` : `Part ${m[1]}`
  },
];

// Fallback separator patterns (less specific)
const SEPARATOR_PATTERNS: RegExp[] = [
  /^={5,}$/gm,                          // "=====" separators (5+ chars)
  /^-{5,}$/gm,                          // "-----" separators (5+ chars)
  /^\*{5,}$/gm,                         // "*****" separators
  /^~{5,}$/gm,                          // "~~~~~" separators
  /^---\s*(?:Three|Two|One|Several|Many|A few)\s+(?:days?|weeks?|hours?|months?)\s+later\s*---$/gim, // Time jumps
];

/**
 * Detect session boundaries in campaign text using pattern matching
 */
export function detectSessions(text: string): DetectedSession[] {
  const markers: SessionMarkerMatch[] = [];
  
  // Try each session pattern
  for (const { pattern, titleExtractor } of SESSION_PATTERNS) {
    // Reset regex lastIndex
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    
    while ((match = pattern.exec(text)) !== null) {
      markers.push({
        index: match.index,
        title: titleExtractor(match),
        pattern: 'session',
      });
    }
  }
  
  // If no session markers found, try separator patterns
  if (markers.length === 0) {
    for (const pattern of SEPARATOR_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      let separatorCount = 0;
      
      while ((match = pattern.exec(text)) !== null) {
        separatorCount++;
        markers.push({
          index: match.index,
          title: `Section ${separatorCount}`,
          pattern: 'separator',
        });
      }
    }
  }
  
  // Sort markers by position
  markers.sort((a, b) => a.index - b.index);
  
  // Remove duplicate markers at similar positions (within 50 chars)
  const uniqueMarkers = markers.filter((marker, i) => {
    if (i === 0) return true;
    return marker.index - markers[i - 1].index > 50;
  });
  
  // If still no markers, return empty (will use chunk-based splitting)
  if (uniqueMarkers.length === 0) {
    return [];
  }
  
  // Convert markers to sessions
  const sessions: DetectedSession[] = [];
  
  for (let i = 0; i < uniqueMarkers.length; i++) {
    const marker = uniqueMarkers[i];
    const nextMarker = uniqueMarkers[i + 1];
    
    const startIndex = marker.index;
    const endIndex = nextMarker ? nextMarker.index : text.length;
    const content = text.slice(startIndex, endIndex).trim();
    
    // Skip empty sessions
    if (content.length < 50) continue;
    
    sessions.push({
      id: `session-${i + 1}`,
      title: marker.title,
      startIndex,
      endIndex,
      preview: content.slice(0, 150).replace(/\n/g, ' ').trim() + (content.length > 150 ? '...' : ''),
      wordCount: countWords(content),
      charCount: content.length,
    });
  }
  
  // If we only found one "session" at the start, treat as no sessions detected
  if (sessions.length === 1 && sessions[0].startIndex === 0) {
    return [];
  }
  
  return sessions;
}

/**
 * Split text into chunks by character size, respecting paragraph boundaries
 */
export function splitByChunkSize(text: string, chunkSize: number = 10000): DetectedSession[] {
  const paragraphs = text.split(/\n\n+/);
  const sessions: DetectedSession[] = [];
  
  let currentChunk = '';
  let currentStartIndex = 0;
  let chunkNumber = 1;
  let charOffset = 0;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const paragraphWithBreak = (currentChunk ? '\n\n' : '') + paragraph;
    
    // If adding this paragraph would exceed chunk size, save current chunk
    if (currentChunk && (currentChunk.length + paragraphWithBreak.length > chunkSize)) {
      sessions.push(createSessionFromChunk(
        currentChunk.trim(),
        chunkNumber,
        currentStartIndex,
        charOffset
      ));
      
      chunkNumber++;
      currentChunk = paragraph;
      currentStartIndex = charOffset;
    } else {
      currentChunk += paragraphWithBreak;
    }
    
    // Track character offset (including the paragraph breaks we consumed)
    charOffset += paragraph.length + (i < paragraphs.length - 1 ? 2 : 0);
  }
  
  // Don't forget the last chunk
  if (currentChunk.trim()) {
    sessions.push(createSessionFromChunk(
      currentChunk.trim(),
      chunkNumber,
      currentStartIndex,
      text.length
    ));
  }
  
  return sessions;
}

function createSessionFromChunk(
  content: string,
  chunkNumber: number,
  startIndex: number,
  endIndex: number
): DetectedSession {
  return {
    id: `chunk-${chunkNumber}`,
    title: `Part ${chunkNumber}`,
    startIndex,
    endIndex,
    preview: content.slice(0, 150).replace(/\n/g, ' ').trim() + (content.length > 150 ? '...' : ''),
    wordCount: countWords(content),
    charCount: content.length,
  };
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Get session content from original text
 */
export function getSessionContent(text: string, session: DetectedSession): string {
  return text.slice(session.startIndex, session.endIndex).trim();
}

/**
 * Estimate processing time based on character count and mode
 */
export function estimateProcessingTime(sessions: DetectedSession[], mode: 'ai' | 'offline'): string {
  const totalChars = sessions.reduce((sum, s) => sum + s.charCount, 0);
  
  if (mode === 'offline') {
    return 'a few seconds';
  }
  
  // AI mode: roughly 2-5 seconds per 5000 chars, plus delay between sessions
  const baseTime = Math.ceil(totalChars / 5000) * 3;
  const delayTime = (sessions.length - 1) * 2; // 2 second delay between sessions
  const totalSeconds = baseTime + delayTime;
  
  if (totalSeconds < 60) {
    return `about ${totalSeconds} seconds`;
  } else {
    const minutes = Math.ceil(totalSeconds / 60);
    return `about ${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}

/**
 * Parse JSON campaign file if it has a structured format
 */
export function parseJsonCampaign(jsonContent: string): { text: string; sessions: DetectedSession[] } | null {
  try {
    const data = JSON.parse(jsonContent);
    
    // Handle array of sessions
    if (Array.isArray(data)) {
      const sessions: DetectedSession[] = [];
      let fullText = '';
      let charOffset = 0;
      
      data.forEach((item, index) => {
        const content = typeof item === 'string' 
          ? item 
          : item.content || item.text || item.body || JSON.stringify(item);
        const title = item.title || item.name || item.session || `Session ${index + 1}`;
        
        const startIndex = charOffset;
        fullText += (fullText ? '\n\n---\n\n' : '') + content;
        charOffset = fullText.length;
        
        sessions.push({
          id: `json-session-${index + 1}`,
          title: String(title),
          startIndex,
          endIndex: charOffset,
          preview: content.slice(0, 150).replace(/\n/g, ' ').trim() + '...',
          wordCount: countWords(content),
          charCount: content.length,
        });
      });
      
      return { text: fullText, sessions };
    }
    
    // Handle object with content/sessions field
    if (data.sessions && Array.isArray(data.sessions)) {
      return parseJsonCampaign(JSON.stringify(data.sessions));
    }
    
    // Handle single content object
    if (data.content || data.text) {
      const text = data.content || data.text;
      return { text, sessions: detectSessions(text) };
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Combine sessions from multiple files with source tracking
 * Returns sessions with updated indices for the combined content
 */
export interface MultiFileContent {
  fileName: string;
  content: string;
  sessions: DetectedSession[];
}

export function combineMultiFileSessions(files: MultiFileContent[]): {
  combinedContent: string;
  combinedSessions: DetectedSession[];
} {
  let combinedContent = '';
  const combinedSessions: DetectedSession[] = [];
  let globalSessionIndex = 0;
  
  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const file = files[fileIndex];
    const startOffset = combinedContent.length;
    
    // Add separator between files
    if (combinedContent.length > 0) {
      combinedContent += '\n\n---\n\n';
    }
    
    const contentStartOffset = combinedContent.length;
    combinedContent += file.content;
    
    // If file has no sessions, create one for the whole file
    if (file.sessions.length === 0) {
      globalSessionIndex++;
      combinedSessions.push({
        id: `multi-session-${globalSessionIndex}`,
        title: file.fileName.replace(/\.[^/.]+$/, ''),
        startIndex: contentStartOffset,
        endIndex: combinedContent.length,
        preview: file.content.slice(0, 150).replace(/\n/g, ' ').trim() + '...',
        wordCount: countWords(file.content),
        charCount: file.content.length,
        sourceFile: file.fileName,
        sourceFileIndex: fileIndex,
      });
    } else {
      // Add sessions with updated indices and source tracking
      for (const session of file.sessions) {
        globalSessionIndex++;
        combinedSessions.push({
          ...session,
          id: `multi-session-${globalSessionIndex}`,
          startIndex: contentStartOffset + session.startIndex,
          endIndex: contentStartOffset + session.endIndex,
          sourceFile: file.fileName,
          sourceFileIndex: fileIndex,
        });
      }
    }
  }
  
  return { combinedContent, combinedSessions };
}
