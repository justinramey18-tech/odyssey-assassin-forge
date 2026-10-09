// Human DM Assistant: the draft and its small edits.
// The draft is the post the host will apply: story paragraphs (¶1, ¶2…) plus
// roll requests, tips and whispers (W1, W2…). The assistant changes it with
// small numbered [[EDIT]] commands; this file reads and applies them.
// Pure functions only (no network, no React) so it can be unit tested.

import { parseWhispers, type Whisper } from '@/lib/whisper-parser';

export interface AssistantDraft {
  narrative: string;
  whispers: Whisper[];
}

export const EMPTY_DRAFT: AssistantDraft = { narrative: '', whispers: [] };

/** Remove a code fence the model sometimes wraps around a block. */
export function stripFences(text: string): string {
  return text
    .replace(/^\s*```[a-z]*\s*\n?/i, '')
    .replace(/\n?\s*```\s*$/i, '')
    .trim();
}

/** One small change to the draft. Numbers are 1-based and refer to the draft as it was sent. */
export interface DraftEdit {
  op: 'replace' | 'insert' | 'delete' | 'add';
  target: 'paragraph' | 'whisper';
  /** Paragraph or whisper number. For insert, 0 means "at the very start". Null for add. */
  index: number | null;
  body: string;
  /** The command line as written, e.g. "REPLACE ¶3". */
  label: string;
}

const EDIT_HEADER_RE = /^(REPLACE|INSERT\s+AFTER|INSERT|DELETE|REMOVE|ADD)\s*(¶|PARAGRAPH|PARA|P|W(?:HISPER)?)?\s*#?\s*(\d+)?\s*:?\s*$/i;

/** Read one [[EDIT]] block. Returns null when the command line can't be understood. */
export function parseEditBlock(raw: string): DraftEdit | null {
  const text = stripFences(raw);
  const nl = text.indexOf('\n');
  const header = (nl === -1 ? text : text.slice(0, nl)).trim().replace(/^[*_`]+|[*_`]+$/g, '');
  const body = (nl === -1 ? '' : text.slice(nl + 1)).trim();
  const m = EDIT_HEADER_RE.exec(header);
  if (!m) return null;
  const verb = m[1].toUpperCase().replace(/\s+/g, ' ');
  const kind = (m[2] || '').toUpperCase();
  const target: DraftEdit['target'] = kind.startsWith('W') ? 'whisper' : 'paragraph';
  const index = m[3] !== undefined ? parseInt(m[3], 10) : null;
  let op: DraftEdit['op'];
  if (verb === 'REPLACE') op = 'replace';
  else if (verb === 'DELETE' || verb === 'REMOVE') op = 'delete';
  else if (verb === 'ADD') op = 'add';
  else op = 'insert';
  if (op === 'add' && target === 'paragraph') { op = 'insert'; }
  if ((op === 'replace' || op === 'delete') && (index === null || index < 1)) return null;
  if (op === 'insert' && target === 'paragraph' && index === null) return null;
  if ((op === 'replace' || op === 'insert' || op === 'add') && !body) return null;
  return { op, target, index, body, label: header };
}

// ─── Numbered draft and small edits ──────────────────────────────────────────

/** Paragraphs are separated by a blank line. */
export function splitParagraphs(narrative: string): string[] {
  return (narrative || '').split(/\n[ \t]*\n/).map(p => p.trim()).filter(Boolean);
}

export function joinParagraphs(paragraphs: string[]): string {
  return paragraphs.map(p => p.trim()).filter(Boolean).join('\n\n');
}

function whisperToTag(w: Whisper): string {
  if (w.type === 'action') return `<!--ACTION-->${w.content.trim()}<!--/ACTION-->`;
  if (w.type === 'tactics') return `<!--TACTICS-->${w.content.trim()}<!--/TACTICS-->`;
  const target = w.target?.trim() || 'Unknown';
  return `<!--WHISPER:${target}-->${w.content.trim()}<!--/WHISPER:${target}-->`;
}

/** The draft as the assistant sees it: ¶1, ¶2… for story paragraphs and W1, W2… for rolls, tips and whispers. */
export function draftToNumberedText(draft: AssistantDraft): string {
  const paras = splitParagraphs(draft.narrative).map((p, i) => `¶${i + 1} ${p}`);
  const tags = draft.whispers.filter(w => w.content.trim()).map((w, i) => `W${i + 1} ${whisperToTag(w)}`);
  return [...paras, ...tags].join('\n\n');
}

/** Plain description of an edit for the chat, e.g. "¶3", "removed W1", "added a paragraph after ¶2". */
export function describeEdit(e: DraftEdit): string {
  const ref = `${e.target === 'paragraph' ? '¶' : 'W'}${e.index ?? ''}`;
  if (e.op === 'replace') return ref;
  if (e.op === 'delete') return `removed ${ref}`;
  if (e.target === 'paragraph') return e.index === 0 ? 'added an opening paragraph' : `added a paragraph after ${ref}`;
  return 'added a roll or whisper';
}

export interface AppliedEdits {
  draft: AssistantDraft;
  /** 0-based positions in the NEW draft that were added or changed, to highlight. */
  changedParagraphs: number[];
  changedWhispers: number[];
  /** Edits that could not be applied (bad number), described in plain words. */
  skipped: string[];
  /** Edits that were applied, described in plain words. */
  applied: string[];
}

/** Rebuild a list from per-position replacements and insertions (all 1-based on the original list). */
function rebuild<T>(
  original: T[],
  replace: Map<number, T[] | null>,
  insertAfter: Map<number, T[]>,
): { items: T[]; changed: number[] } {
  const items: T[] = [];
  const changed: number[] = [];
  for (let i = 0; i <= original.length; i++) {
    if (i > 0) {
      const r = replace.get(i);
      if (r === undefined) items.push(original[i - 1]);
      else if (r !== null) for (const x of r) { changed.push(items.length); items.push(x); }
    }
    for (const x of insertAfter.get(i) || []) { changed.push(items.length); items.push(x); }
  }
  return { items, changed };
}

/**
 * Apply small edits to the draft. Every number refers to the draft as it was
 * sent, so several edits in one reply never shift each other's targets.
 */
export function applyDraftEdits(draft: AssistantDraft, edits: DraftEdit[]): AppliedEdits {
  const paras = splitParagraphs(draft.narrative);
  const whispers = draft.whispers.filter(w => w.content.trim());
  const pReplace = new Map<number, string[] | null>();
  const pInsert = new Map<number, string[]>();
  const wReplace = new Map<number, Whisper[] | null>();
  const wInsert = new Map<number, Whisper[]>();
  const skipped: string[] = [];
  const applied: string[] = [];
  const push = <T,>(map: Map<number, T[]>, key: number, items: T[]) => map.set(key, [...(map.get(key) || []), ...items]);

  for (const e of edits) {
    if (e.target === 'paragraph') {
      if (e.op === 'delete') {
        if (e.index! > paras.length) { skipped.push(describeEdit(e)); continue; }
        pReplace.set(e.index!, null);
      } else {
        // A paragraph body may carry roll or whisper tags; those become whisper cards.
        const parsed = parseWhispers(e.body);
        const newParas = splitParagraphs(parsed.narrative);
        if (e.op === 'replace') {
          if (e.index! > paras.length) { skipped.push(describeEdit(e)); continue; }
          pReplace.set(e.index!, newParas);
        } else {
          if (e.index! > paras.length) { skipped.push(describeEdit(e)); continue; }
          if (!newParas.length && !parsed.whispers.length) { skipped.push(describeEdit(e)); continue; }
          push(pInsert, e.index!, newParas);
        }
        if (parsed.whispers.length) push(wInsert, whispers.length, parsed.whispers);
      }
    } else {
      if (e.op === 'delete') {
        if (e.index! > whispers.length) { skipped.push(describeEdit(e)); continue; }
        wReplace.set(e.index!, null);
      } else {
        const found = parseWhispers(e.body).whispers;
        if (!found.length) { skipped.push(describeEdit(e)); continue; }
        if (e.op === 'replace') {
          if (e.index! > whispers.length) { skipped.push(describeEdit(e)); continue; }
          wReplace.set(e.index!, found);
        } else {
          const after = e.op === 'insert' && e.index !== null ? e.index : whispers.length;
          if (after > whispers.length) { skipped.push(describeEdit(e)); continue; }
          push(wInsert, after, found);
        }
      }
    }
    applied.push(describeEdit(e));
  }

  const p = rebuild(paras, pReplace, pInsert);
  const w = rebuild(whispers, wReplace, wInsert);
  return {
    draft: { narrative: joinParagraphs(p.items), whispers: w.items },
    changedParagraphs: p.changed,
    changedWhispers: w.changed,
    skipped,
    applied,
  };
}

/** Turn draft text into the editor's story + whisper cards (same parser the table uses). */
export function draftFromText(text: string): AssistantDraft {
  const { narrative, whispers } = parseWhispers(text || '');
  return { narrative, whispers };
}

/** Draft as the assistant should see it (the same format it writes). */
export function draftToText(draft: AssistantDraft): string {
  const blocks = draft.whispers
    .filter(w => w.content.trim())
    .map(whisperToTag);
  return [draft.narrative.trim(), ...blocks].filter(Boolean).join('\n\n');
}

export function draftIsEmpty(draft: AssistantDraft): boolean {
  return !draft.narrative.trim();
}

export function draftCounts(draft: AssistantDraft): { rolls: number; whispers: number; tactics: number } {
  return {
    rolls: draft.whispers.filter(w => w.type === 'action' && w.content.trim()).length,
    whispers: draft.whispers.filter(w => w.type === 'whisper' && w.content.trim()).length,
    tactics: draft.whispers.filter(w => w.type === 'tactics' && w.content.trim()).length,
  };
}
