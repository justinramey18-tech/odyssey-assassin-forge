export interface Slide {
  text: string;
  displayType: 'firstLine' | 'pullQuote' | 'dialogue' | 'normal';
  speaker?: string;
  sfx: string[];
  ambience: string | null;
  vfx: string[];
  mood: string | null;
  music: string | null;
}

const TAG_REGEX = /<!--(SFX|AMBIENCE|VFX|MOOD|MUSIC):(.+?)-->/g;

function classifyParagraph(text: string, isFirst: boolean): Slide['displayType'] {
  if (isFirst) return 'firstLine';

  // Dialogue detection: text starts with a smart or straight quote
  const normalized = text.replace(/\u201C|\u201D/g, '"');
  if (/^"/.test(normalized)) {
    // Check for attribution after the closing quote
    if (/"\s*[,.]?\s*[A-Z][a-z]/.test(normalized) || /said|says|whispered|called|shouted|murmured|hissed|replied|asked|breathed|growled|snapped/i.test(normalized)) {
      return 'dialogue';
    }
  }

  // Pull quote: short, punchy, no dialogue markers
  if (text.length < 70 && !text.includes('"') && !text.includes('\u201C') && !text.includes('\u201D')) {
    return 'pullQuote';
  }

  return 'normal';
}

function extractSpeaker(text: string): string | undefined {
  // Pattern: "dialogue," Speaker said/verbed
  const m1 = text.match(/[\u201D"]\s*[,.]?\s*(\w+)(?:'s)?\s+(?:voice|said|says|whispered|called|shouted|murmured|hissed|replied|asked|breathed|growled|snapped)/i);
  if (m1) return m1[1].toUpperCase();

  // Pattern: Speaker's voice comes/came/rings/cuts
  const m2 = text.match(/(\w+)(?:'s)?\s+voice\s+(?:comes?|came|rings?|rang|echoes?|cuts?)/i);
  if (m2) return m2[1].toUpperCase();

  return undefined;
}

export function stripCinematicTags(content: string): string {
  return content
    .replace(/<!--(?:SFX|AMBIENCE|VFX|MOOD|MUSIC):.+?-->/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseResponseIntoSlides(rawContent: string): Slide[] {
  const blocks = rawContent.split('\n\n').map(b => b.trim()).filter(Boolean);
  const slides: Slide[] = [];
  let pendingTags: Array<{ type: string; value: string }> = [];

  for (const block of blocks) {
    // Extract all tags from this block
    const tags: Array<{ type: string; value: string }> = [];
    let match: RegExpExecArray | null;
    const regex = new RegExp(TAG_REGEX.source, 'g');
    while ((match = regex.exec(block)) !== null) {
      tags.push({ type: match[1], value: match[2] });
    }

    // Strip tags from display text
    const cleanText = block.replace(/<!--(?:SFX|AMBIENCE|VFX|MOOD|MUSIC):.+?-->/g, '').trim();

    // If block was ONLY tags (no text after stripping), carry tags to next paragraph
    if (!cleanText) {
      pendingTags.push(...tags);
      continue;
    }

    // Combine pending tags with this block's tags
    const allTags = [...pendingTags, ...tags];
    pendingTags = [];

    slides.push({
      text: cleanText,
      displayType: classifyParagraph(cleanText, slides.length === 0),
      speaker: extractSpeaker(cleanText),
      sfx: allTags.filter(t => t.type === 'SFX').map(t => t.value),
      ambience: allTags.find(t => t.type === 'AMBIENCE')?.value ?? null,
      vfx: allTags
        .filter(t => t.type === 'VFX')
        .map(t => t.value)
        .flatMap(v => v.split('+')),
      mood: allTags.find(t => t.type === 'MOOD')?.value ?? null,
      music: allTags.find(t => t.type === 'MUSIC')?.value ?? null,
    });
  }

  return slides;
}
