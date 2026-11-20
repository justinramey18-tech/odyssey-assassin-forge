// Solo Empyrean: splits a DM reply into pieces the screen can style differently, so a reply is not
// one wall of text. Narration stays narration; spoken lines get their own line; a paragraph that asks
// for a check, one about the rider's dragon, and a scene break each get their own look.
// Pure functions only. Hidden tags are stripped before this runs; nothing here changes the story's words.

export type StoryPieceKind = 'narration' | 'dialogue' | 'check' | 'dragon' | 'scene' | 'raw';
export interface StoryPiece { kind: StoryPieceKind; text: string }

const SCENE_BREAK = /^(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/;
/** Markdown that must be left whole: headings, quotes, lists, tables, code fences. */
const RAW_START = /^(?:#{1,6}\s|>|[-*+]\s|\d+[.)]\s|```|\|)/;
const CHECK = /\bDC\s*\d+/;
const QUOTE = /[“"][^“”"]+[”"]/g;
const SENTENCE_END = /[.!?…]["”')\]]*\s/g;

/** A quoted span is speech when it reads like a sentence: three or more words, or closing punctuation inside the quote. */
function isSpeech(quote: string): boolean {
  const inner = quote.slice(1, -1).trim();
  if (!inner) return false;
  return /[.,!?…—-]$/.test(inner) || inner.split(/\s+/).length >= 3;
}

/** Where the last full sentence in `text` ends (0 when there is none). */
function lastSentenceEnd(text: string): number {
  let end = 0;
  SENTENCE_END.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SENTENCE_END.exec(text)) !== null) end = m.index + m[0].length;
  return end;
}

/** Where the first sentence in `text` ends (-1 when it has no sentence end). */
function firstSentenceEnd(text: string): number {
  const m = /[.!?…]["”')\]]*(?:\s|$)/.exec(text);
  return m ? m.index + m[0].length : -1;
}

function splitParagraph(block: string): StoryPiece[] {
  const quotes: Array<{ start: number; end: number }> = [];
  QUOTE.lastIndex = 0;
  let q: RegExpExecArray | null;
  while ((q = QUOTE.exec(block)) !== null) {
    if (isSpeech(q[0])) quotes.push({ start: q.index, end: q.index + q[0].length });
  }
  if (!quotes.length) return [{ kind: /^[“"]/.test(block) ? 'dialogue' : 'narration', text: block }];

  const out: StoryPiece[] = [];
  const push = (kind: StoryPieceKind, text: string) => { const t = text.trim(); if (t) out.push({ kind, text: t }); };
  let pos = 0;
  let i = 0;
  while (i < quotes.length) {
    const before = block.slice(pos, quotes[i].start);
    // A lead-in such as: Dain said, "..." stays with the spoken line.
    const cut = lastSentenceEnd(before);
    const tail = before.slice(cut);
    const leadIn = /[,:—-]\s*$/.test(tail) ? tail : '';
    push('narration', leadIn ? before.slice(0, cut) : before);
    const lineStart = leadIn ? pos + cut : quotes[i].start;
    let lineEnd = quotes[i].end;
    // Keep the attribution, and a second half of the same speech, on the same line.
    for (;;) {
      const nextStart = i + 1 < quotes.length ? quotes[i + 1].start : block.length;
      const after = block.slice(lineEnd, nextStart);
      const quoteText = block.slice(quotes[i].start, quotes[i].end);
      const attributed = /,["”]$/.test(quoteText) || /^\s*[a-z,]/.test(after);
      if (!attributed) break;
      const stop = firstSentenceEnd(after);
      if (stop === -1 && i + 1 < quotes.length && after.length <= 80) {
        i += 1;
        lineEnd = quotes[i].end;
        continue;
      }
      lineEnd += stop === -1 ? after.length : stop;
      break;
    }
    push('dialogue', block.slice(lineStart, lineEnd));
    pos = lineEnd;
    i += 1;
    while (i < quotes.length && quotes[i].start < pos) i += 1;
  }
  push('narration', block.slice(pos));
  return out;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The pieces of a DM reply, in order. `dragonName` marks narration that names the rider's dragon. */
export function formatStory(text: string | null | undefined, dragonName?: string | null): StoryPiece[] {
  const source = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  if (!source) return [];
  const name = (dragonName ?? '').trim();
  const dragon = name.length >= 2 ? new RegExp(`(^|[^A-Za-z])${escapeRegExp(name)}(?![A-Za-z])`, 'i') : null;
  const pieces: StoryPiece[] = [];
  for (const rawBlock of source.split(/\n{2,}/)) {
    const block = rawBlock.trim();
    if (!block) continue;
    if (SCENE_BREAK.test(block)) { pieces.push({ kind: 'scene', text: '' }); continue; }
    if (RAW_START.test(block) || block.includes('<')) { pieces.push({ kind: 'raw', text: block }); continue; }
    for (const piece of splitParagraph(block)) {
      if (piece.kind !== 'narration') { pieces.push(piece); continue; }
      if (CHECK.test(piece.text)) pieces.push({ kind: 'check', text: piece.text });
      else if (dragon && dragon.test(piece.text)) pieces.push({ kind: 'dragon', text: piece.text });
      else pieces.push(piece);
    }
  }
  return pieces;
}
