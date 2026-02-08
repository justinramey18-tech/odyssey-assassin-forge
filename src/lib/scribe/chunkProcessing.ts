// Chunked text processing for AI Command on large stories

const MAX_CHUNK_SIZE = 45000; // Leave buffer under 50K limit
const MIN_CHUNK_SIZE = 5000;  // Don't create tiny chunks

interface ChunkResult {
  chunks: string[];
  chunkBoundaries: number[]; // Original positions for reassembly
}

/**
 * Split text into chunks at natural boundaries (paragraphs, then sentences)
 * Preserves narrative flow by avoiding mid-sentence splits
 */
export function splitTextIntoChunks(text: string): ChunkResult {
  if (text.length <= MAX_CHUNK_SIZE) {
    return { chunks: [text], chunkBoundaries: [0] };
  }

  const chunks: string[] = [];
  const chunkBoundaries: number[] = [];
  let currentPosition = 0;

  while (currentPosition < text.length) {
    const remainingText = text.slice(currentPosition);
    
    if (remainingText.length <= MAX_CHUNK_SIZE) {
      // Last chunk - take the rest
      chunks.push(remainingText);
      chunkBoundaries.push(currentPosition);
      break;
    }

    // Find the best split point within MAX_CHUNK_SIZE
    const searchWindow = remainingText.slice(0, MAX_CHUNK_SIZE);
    let splitPoint = findBestSplitPoint(searchWindow);

    // If no good split found, force split at max size
    if (splitPoint < MIN_CHUNK_SIZE) {
      splitPoint = MAX_CHUNK_SIZE;
    }

    chunks.push(remainingText.slice(0, splitPoint).trim());
    chunkBoundaries.push(currentPosition);
    currentPosition += splitPoint;

    // Skip any leading whitespace for next chunk
    while (currentPosition < text.length && /\s/.test(text[currentPosition])) {
      currentPosition++;
    }
  }

  return { chunks, chunkBoundaries };
}

/**
 * Find the best natural split point in text
 * Priority: Chapter/Scene breaks > Double newlines > Single newlines > Sentence ends
 */
function findBestSplitPoint(text: string): number {
  // Look for chapter/scene breaks (--- or ### or ***) near the end
  const sceneBreakMatch = text.match(/\n\s*(---|\*\*\*|###|Chapter \d+|CHAPTER \d+)[^\n]*\n/g);
  if (sceneBreakMatch) {
    const lastBreak = text.lastIndexOf(sceneBreakMatch[sceneBreakMatch.length - 1]);
    if (lastBreak > MIN_CHUNK_SIZE) {
      return lastBreak;
    }
  }

  // Look for double newlines (paragraph breaks) in the last 30% of the chunk
  const searchStart = Math.floor(text.length * 0.7);
  const searchArea = text.slice(searchStart);
  
  // Find last paragraph break
  const lastParagraphBreak = searchArea.lastIndexOf('\n\n');
  if (lastParagraphBreak !== -1) {
    return searchStart + lastParagraphBreak + 2; // Include the newlines
  }

  // Find last single newline
  const lastNewline = searchArea.lastIndexOf('\n');
  if (lastNewline !== -1) {
    return searchStart + lastNewline + 1;
  }

  // Find last sentence end (. ! ?)
  const sentenceEndMatch = searchArea.match(/[.!?]["']?\s+(?=[A-Z])/g);
  if (sentenceEndMatch) {
    const lastSentenceEnd = searchArea.lastIndexOf(sentenceEndMatch[sentenceEndMatch.length - 1]);
    if (lastSentenceEnd !== -1) {
      return searchStart + lastSentenceEnd + sentenceEndMatch[sentenceEndMatch.length - 1].length;
    }
  }

  // Fallback: find last space
  const lastSpace = text.lastIndexOf(' ');
  if (lastSpace > MIN_CHUNK_SIZE) {
    return lastSpace + 1;
  }

  // No good split found
  return 0;
}

/**
 * Reassemble processed chunks into a single text
 * Handles potential overlap or gap issues at chunk boundaries
 */
export function reassembleChunks(processedChunks: string[]): string {
  if (processedChunks.length === 0) return '';
  if (processedChunks.length === 1) return processedChunks[0];

  // Join with double newlines to ensure clean separation
  // The AI should maintain paragraph structure within chunks
  return processedChunks
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0)
    .join('\n\n');
}

/**
 * Estimate processing time based on chunk count
 */
export function estimateChunkedProcessingTime(chunkCount: number): string {
  const timePerChunk = 20; // ~20 seconds per chunk
  const totalSeconds = chunkCount * timePerChunk;
  
  if (totalSeconds < 60) {
    return `~${totalSeconds} seconds`;
  } else {
    const minutes = Math.ceil(totalSeconds / 60);
    return `~${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}

/**
 * Create context prefix for chunks to maintain continuity
 */
export function createChunkContext(
  chunkIndex: number, 
  totalChunks: number,
  instruction: string
): string {
  if (totalChunks === 1) return instruction;
  
  const positionContext = chunkIndex === 0 
    ? 'This is the BEGINNING of the story.' 
    : chunkIndex === totalChunks - 1 
      ? 'This is the END of the story.'
      : `This is section ${chunkIndex + 1} of ${totalChunks} (middle of story).`;
  
  return `${instruction}

IMPORTANT CONTEXT: ${positionContext} Apply the instruction consistently, maintaining narrative flow. Do not add introductions, conclusions, or summaries - just transform the text as instructed.`;
}
