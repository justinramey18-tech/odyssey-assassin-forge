export interface RollTableTag { label: string; tone: 'minus' | 'plus' }
export interface RollTableRow { roll: number; text: string; tags: RollTableTag[] }
export interface RollTable { title: string; preamble: string; rows: RollTableRow[] }

const ROW_RE = /^\s*(\d{1,3})\s*[:.)]\s+(.+)$/;
const HEADER_RE = /^\s*([A-Z][A-Z0-9 '’-]{2,40}):\s*(.*)$/;
const TAG_RE = /\s*\[([+\-−])\s?(\d+)\s+([^\],]+?)(?:,\s*([^\]]+))?\]/g;

function splitTags(raw: string): { text: string; tags: RollTableTag[] } {
  const tags: RollTableTag[] = [];
  const text = raw.replace(TAG_RE, (_m, sign: string, num: string, word: string, extra?: string) => {
    const minus = sign !== '+';
    tags.push({ tone: minus ? 'minus' : 'plus', label: `${minus ? '−' : '+'}${num} ${word.trim()}${extra ? ` · ${extra.trim()}` : ''}` });
    return '';
  }).trim();
  return { text, tags };
}

/**
 * Splits spell rules text into the normal paragraph (intro) and an optional
 * numbered roll table written as lines like "1: result", "2: result", ...
 * A table needs at least 3 numbered lines. The line right before the first
 * numbered line becomes the title if it looks like "TITLE: explanation".
 */
export function parseRollTable(text?: string | null): { intro: string; table: RollTable | null } {
  if (!text) return { intro: '', table: null };
  const lines = text.split(/\r?\n/);

  const first = lines.findIndex(l => ROW_RE.test(l));
  if (first === -1) return { intro: text.trim(), table: null };

  const rows: RollTableRow[] = [];
  for (let i = first; i < lines.length; i++) {
    const m = ROW_RE.exec(lines[i]);
    if (!m) continue;
    const { text: rowText, tags } = splitTags(m[2]);
    rows.push({ roll: Number(m[1]), text: rowText, tags });
  }
  if (rows.length < 3) return { intro: text.trim(), table: null };

  let headerIdx = first - 1;
  while (headerIdx >= 0 && !lines[headerIdx].trim()) headerIdx--;

  let title = 'Roll Table';
  let preamble = '';
  let introEnd = first;
  if (headerIdx >= 0) {
    const hm = HEADER_RE.exec(lines[headerIdx]);
    if (hm) { title = hm[1].trim(); preamble = hm[2].trim(); introEnd = headerIdx; }
  }

  return { intro: lines.slice(0, introEnd).join('\n').trim(), table: { title, preamble, rows } };
}
