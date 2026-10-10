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
  op: 'replace' | 'insert' | 'delete' | 'add' | 'move';
  target: 'paragraph' | 'whisper';
  /** First paragraph or whisper number. For insert, 0 means "at the very start". Null for add. */
  index: number | null;
  /** Last number of a range: "REPLACE ¶4-¶6" has index 4 and end 6. Missing for a single one. */
  end?: number;
  /** MOVE only: the moved paragraphs go after this paragraph (0 = the very start). */
  to?: number;
  body: string;
  /** The command line as written, e.g. "REPLACE ¶3". */
  label: string;
}

const VERB_RE = /^(REPLACE|INSERT\s+AFTER|INSERT\s+BEFORE|INSERT|DELETE|REMOVE|MOVE|ADD)\b\s*/i;
// "¶", "paragraph", "para", "P3", "whisper", "W2"; P and W only count when a number follows.
const KIND_RE = /^(¶|PARAGRAPHS?\b|PARAS?\b|P(?=\s*#?\s*\d)|WHISPERS?\b|W(?=\s*#?\s*\d)|W\b)\s*/i;
const NUM_RE = /^#?\s*(\d+)/;
const RANGE_SEP_RE = /^\s*(?:-|–|—|to\b|through\b|thru\b|until\b)\s*/i;
const RANGE_SEP_NO_TO_RE = /^\s*(?:-|–|—|through\b|thru\b|until\b)\s*/i;
const LIST_SEP_RE = /^\s*(?:,|&|and\b)\s*/i;
const PLACE_RE = /^\s*(?:to\s+)?(AFTER|BEFORE)\b\s*/i;
const LEAD_IN_RE = /^(?:with|as\s+follows|to\s+read|below|the\s+following|follows)\b\s*:?\s*/i;

interface Ref { kind: 'p' | 'w' | null; num: number | null; rest: string }

/** Read "¶4", "paragraph 4", "W2" or a bare "4" from the start of the text. */
function readRef(text: string): Ref {
  let rest = text;
  let kind: Ref['kind'] = null;
  const k = KIND_RE.exec(rest);
  if (k) {
    kind = k[1].toUpperCase().startsWith('W') ? 'w' : 'p';
    rest = rest.slice(k[0].length);
  }
  const n = NUM_RE.exec(rest);
  if (!n) return { kind, num: null, rest };
  return { kind, num: parseInt(n[1], 10), rest: rest.slice(n[0].length) };
}

/** The first line of an edit block, cleaned up: what the assistant meant as the command. */
export function editHeaderLine(raw: string): string {
  const text = stripFences(raw);
  const nl = text.indexOf('\n');
  return (nl === -1 ? text : text.slice(0, nl)).trim().replace(/^[*_`]+|[*_`]+$/g, '').trim();
}

/**
 * Read one [[EDIT]] block. Returns null when the command line can't be understood.
 * Understands single numbers ("REPLACE ¶3"), ranges ("REPLACE ¶4-¶6", "DELETE ¶2 to ¶3",
 * "¶4, ¶5"), "INSERT BEFORE ¶2", "MOVE ¶5 AFTER ¶2", and ignores a short note after
 * the number ("INSERT AFTER ¶3 (Mira's part)").
 */
export function parseEditBlock(raw: string): DraftEdit | null {
  const text = stripFences(raw);
  const nl = text.indexOf('\n');
  const header = editHeaderLine(text);
  let body = (nl === -1 ? '' : text.slice(nl + 1)).trim();

  const v = VERB_RE.exec(header.replace(/:\s*$/, ''));
  if (!v) return null;
  const verb = v[1].toUpperCase().replace(/\s+/g, ' ');
  const isMove = verb === 'MOVE';

  // The first number, then an optional range or list of numbers.
  const first = readRef(header.replace(/:\s*$/, '').slice(v[0].length));
  let kind = first.kind;
  const index = first.num;
  let end: number | undefined;
  let rest = first.rest;
  if (index !== null) {
    const sep = (isMove ? RANGE_SEP_NO_TO_RE : RANGE_SEP_RE).exec(rest);
    if (sep) {
      const next = readRef(rest.slice(sep[0].length));
      if (next.num !== null) {
        if (next.kind && kind && next.kind !== kind) return null;
        kind = kind ?? next.kind;
        end = next.num;
        rest = next.rest;
      }
    } else {
      // "¶4, ¶5 and ¶6" counts as a range only when the numbers run in order.
      const nums = [index];
      let probe = rest;
      for (let sepList = LIST_SEP_RE.exec(probe); sepList; sepList = LIST_SEP_RE.exec(probe)) {
        const next = readRef(probe.slice(sepList[0].length));
        if (next.num === null) break;
        if (next.kind && kind && next.kind !== kind) return null;
        nums.push(next.num);
        probe = next.rest;
      }
      if (nums.length > 1) {
        if (!nums.every((n, i) => i === 0 || n === nums[i - 1] + 1)) return null;
        end = nums[nums.length - 1];
        rest = probe;
      }
    }
  }
  if (end !== undefined && index !== null && end < index) return null;
  if (end === index) end = undefined;

  // MOVE needs a place: "AFTER ¶2" or "BEFORE ¶2".
  let to: number | undefined;
  if (isMove) {
    const place = PLACE_RE.exec(rest);
    if (!place) return null;
    const dest = readRef(rest.slice(place[0].length));
    if (dest.num === null || dest.kind === 'w') return null;
    to = place[1].toUpperCase() === 'BEFORE' ? dest.num - 1 : dest.num;
    rest = dest.rest;
  }

  // Whatever is left on the command line is a note, or the new text written on the same line.
  let tail = rest.trim().replace(/^[:\-–—]+\s*/, '').trim();
  for (let lead = LEAD_IN_RE.exec(tail); lead && lead[0]; lead = LEAD_IN_RE.exec(tail)) tail = tail.slice(lead[0].length).trim();
  const isNote = /^[([].*[)\]]$/.test(tail);
  if (tail && !isNote && !body) body = tail;

  const target: DraftEdit['target'] = kind === 'w' ? 'whisper' : 'paragraph';
  let op: DraftEdit['op'];
  let at = index;
  if (verb === 'REPLACE') op = 'replace';
  else if (verb === 'DELETE' || verb === 'REMOVE') op = 'delete';
  else if (verb === 'ADD') op = 'add';
  else if (isMove) op = 'move';
  else {
    op = 'insert';
    if (verb === 'INSERT BEFORE') {
      if (at === null || at < 1) return null;
      at -= 1;
    }
  }
  if (op === 'add' && target === 'paragraph') op = 'insert';
  if (end !== undefined && (op === 'insert' || op === 'add')) return null;
  if ((op === 'replace' || op === 'delete' || op === 'move') && (at === null || at < 1)) return null;
  if (op === 'move' && (target !== 'paragraph' || to === undefined || to < 0)) return null;
  if (op === 'insert' && target === 'paragraph' && at === null) return null;
  if ((op === 'replace' || op === 'insert' || op === 'add') && !body) return null;
  return {
    op,
    target,
    index: at,
    ...(end !== undefined ? { end } : {}),
    ...(to !== undefined ? { to } : {}),
    body: op === 'delete' || op === 'move' ? '' : body,
    label: header,
  };
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

/** Plain description of an edit for the chat, e.g. "¶3", "¶4–¶6", "removed W1", "moved ¶5 after ¶2". */
export function describeEdit(e: DraftEdit): string {
  const mark = e.target === 'paragraph' ? '¶' : 'W';
  const ref = `${mark}${e.index ?? ''}`;
  const span = e.end !== undefined && e.end !== e.index ? `${ref}–${mark}${e.end}` : ref;
  if (e.op === 'replace') return span;
  if (e.op === 'delete') return `removed ${span}`;
  if (e.op === 'move') return `moved ${span} ${e.to === 0 ? 'to the start' : `after ¶${e.to}`}`;
  if (e.target === 'paragraph') return e.index === 0 ? 'added an opening paragraph' : `added a paragraph after ${ref}`;
  return 'added a roll or whisper';
}

export interface AppliedEdits {
  draft: AssistantDraft;
  /** 0-based positions in the NEW draft that were added or changed, to highlight. */
  changedParagraphs: number[];
  changedWhispers: number[];
  /** Edits that could not be applied (bad number, or a part already changed in the same reply), in plain words. */
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
 * sent, so several edits in one reply never shift each other's targets. An edit
 * that points at a part that doesn't exist, or at a part another edit in the
 * same reply already changed, is skipped and reported (never dropped silently).
 */
export function applyDraftEdits(draft: AssistantDraft, edits: DraftEdit[]): AppliedEdits {
  const paras = splitParagraphs(draft.narrative);
  const whispers = draft.whispers.filter(w => w.content.trim());
  const pReplace = new Map<number, string[] | null>();
  const pInsert = new Map<number, string[]>();
  const wReplace = new Map<number, Whisper[] | null>();
  const wInsert = new Map<number, Whisper[]>();
  const pTouched = new Set<number>();
  const wTouched = new Set<number>();
  const skipped: string[] = [];
  const applied: string[] = [];
  const push = <T,>(map: Map<number, T[]>, key: number, items: T[]) => map.set(key, [...(map.get(key) || []), ...items]);
  const span = (e: DraftEdit) => {
    const out: number[] = [];
    for (let i = e.index!; i <= (e.end ?? e.index!); i++) out.push(i);
    return out;
  };
  /** True when every number exists and none was changed by an earlier edit in this reply. */
  const free = (nums: number[], size: number, touched: Set<number>) => nums.every(n => n >= 1 && n <= size && !touched.has(n));

  for (const e of edits) {
    if (e.target === 'paragraph') {
      if (e.op === 'delete') {
        const nums = span(e);
        if (!free(nums, paras.length, pTouched)) { skipped.push(describeEdit(e)); continue; }
        for (const n of nums) { pReplace.set(n, null); pTouched.add(n); }
      } else if (e.op === 'move') {
        const nums = span(e);
        const to = e.to ?? -1;
        const inside = to >= nums[0] && to < nums[nums.length - 1];
        if (!free(nums, paras.length, pTouched) || to < 0 || to > paras.length || inside) { skipped.push(describeEdit(e)); continue; }
        for (const n of nums) { pReplace.set(n, null); pTouched.add(n); }
        push(pInsert, to, nums.map(n => paras[n - 1]));
      } else {
        // A paragraph body may carry roll or whisper tags; those become whisper cards.
        const parsed = parseWhispers(e.body);
        const newParas = splitParagraphs(parsed.narrative);
        if (e.op === 'replace') {
          const nums = span(e);
          if (!free(nums, paras.length, pTouched)) { skipped.push(describeEdit(e)); continue; }
          nums.forEach((n, i) => { pReplace.set(n, i === 0 ? newParas : null); pTouched.add(n); });
        } else {
          if (e.index! > paras.length) { skipped.push(describeEdit(e)); continue; }
          if (!newParas.length && !parsed.whispers.length) { skipped.push(describeEdit(e)); continue; }
          push(pInsert, e.index!, newParas);
        }
        if (parsed.whispers.length) push(wInsert, whispers.length, parsed.whispers);
      }
    } else {
      if (e.op === 'delete') {
        const nums = span(e);
        if (!free(nums, whispers.length, wTouched)) { skipped.push(describeEdit(e)); continue; }
        for (const n of nums) { wReplace.set(n, null); wTouched.add(n); }
      } else if (e.op === 'move') {
        skipped.push(describeEdit(e));
        continue;
      } else {
        const found = parseWhispers(e.body).whispers;
        if (!found.length) { skipped.push(describeEdit(e)); continue; }
        if (e.op === 'replace') {
          const nums = span(e);
          if (!free(nums, whispers.length, wTouched)) { skipped.push(describeEdit(e)); continue; }
          nums.forEach((n, i) => { wReplace.set(n, i === 0 ? found : null); wTouched.add(n); });
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
