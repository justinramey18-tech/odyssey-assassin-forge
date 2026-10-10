import { describe, it, expect } from 'vitest';
import { applyDraftEdits, editHeaderLine, parseEditBlock, splitParagraphs } from '@/lib/dm-assistant-draft';

const draft = {
  narrative: 'One.\n\nTwo.\n\nThree.\n\nFour.\n\nFive.',
  whispers: [
    { type: 'action' as const, content: 'Kaelen: roll a DC 14 Perception check' },
    { type: 'whisper' as const, target: 'Mira', content: 'You know this sigil.' },
  ],
};
const apply = (...blocks: string[]) => applyDraftEdits(draft, blocks.map(b => parseEditBlock(b)!));
const paras = (out: ReturnType<typeof apply>) => splitParagraphs(out.draft.narrative);

describe('reading edit commands', () => {
  it('still reads the simple commands', () => {
    expect(parseEditBlock('REPLACE ¶2\nNew two.')).toMatchObject({ op: 'replace', index: 2, body: 'New two.' });
    expect(parseEditBlock('insert after paragraph 0\nStart.')).toMatchObject({ op: 'insert', index: 0 });
    expect(parseEditBlock('**DELETE W1**')).toMatchObject({ op: 'delete', target: 'whisper', index: 1 });
    expect(parseEditBlock('ADD W\n<!--TACTICS-->Flank left<!--/TACTICS-->')).toMatchObject({ op: 'add', target: 'whisper', index: null });
    expect(parseEditBlock('REPLACE ¶2')).toBeNull();
    expect(parseEditBlock('MAKE IT BETTER')).toBeNull();
  });

  it('reads ranges written several ways', () => {
    for (const h of ['REPLACE ¶2-¶4', 'REPLACE ¶2–4', 'REPLACE ¶2 to ¶4', 'REPLACE paragraphs 2 through 4', 'REPLACE ¶2, ¶3 and ¶4', 'REPLACE P2-P4:']) {
      expect(parseEditBlock(`${h}\nMerged.`), h).toMatchObject({ op: 'replace', index: 2, end: 4 });
    }
    expect(parseEditBlock('DELETE ¶3-¶4')).toMatchObject({ op: 'delete', index: 3, end: 4 });
    expect(parseEditBlock('REPLACE ¶2, ¶4\nX')).toBeNull(); // not in a row
    expect(parseEditBlock('REPLACE ¶4-¶2\nX')).toBeNull(); // backwards
    expect(parseEditBlock('REPLACE ¶2-W3\nX')).toBeNull(); // mixed
  });

  it('reads INSERT BEFORE and MOVE', () => {
    expect(parseEditBlock('INSERT BEFORE ¶3\nNew.')).toMatchObject({ op: 'insert', index: 2 });
    expect(parseEditBlock('INSERT BEFORE ¶0\nNew.')).toBeNull();
    expect(parseEditBlock('MOVE ¶5 AFTER ¶2')).toMatchObject({ op: 'move', index: 5, to: 2 });
    expect(parseEditBlock('MOVE ¶4-¶5 BEFORE ¶1')).toMatchObject({ op: 'move', index: 4, end: 5, to: 0 });
    expect(parseEditBlock('MOVE ¶5 to after ¶2')).toMatchObject({ op: 'move', index: 5, to: 2 });
    expect(parseEditBlock('MOVE ¶5 TO ¶2')).toBeNull();
    expect(parseEditBlock('MOVE W1 AFTER W2')).toBeNull();
  });

  it('ignores a short note after the number, or uses same-line text as the body', () => {
    expect(parseEditBlock("INSERT AFTER ¶3 (Mira's part)\nShe smiles.")).toMatchObject({ op: 'insert', index: 3, body: 'She smiles.' });
    expect(parseEditBlock('INSERT AFTER ¶3 — Grukk\nHe roars.')).toMatchObject({ body: 'He roars.' });
    expect(parseEditBlock('REPLACE ¶2 with the following:\nNew two.')).toMatchObject({ body: 'New two.' });
    expect(parseEditBlock('REPLACE ¶2: Grukk roars.')).toMatchObject({ index: 2, body: 'Grukk roars.' });
    expect(parseEditBlock('REPLACE ¶2 (scarier)')).toBeNull();
  });

  it('gives back the command line for warnings', () => {
    expect(editHeaderLine('**REPLACE ¶4 & ¶9**\nbody')).toBe('REPLACE ¶4 & ¶9');
  });
});

describe('applying edits', () => {
  it('replaces a range with the new text and keeps everything else', () => {
    const out = apply('REPLACE ¶2-¶4\nA.\n\nB.');
    expect(paras(out)).toEqual(['One.', 'A.', 'B.', 'Five.']);
    expect(out.applied).toEqual(['¶2–¶4']);
  });

  it('deletes a range and moves paragraphs in order', () => {
    expect(paras(apply('DELETE ¶2-¶3'))).toEqual(['One.', 'Four.', 'Five.']);
    expect(paras(apply('MOVE ¶5 AFTER ¶2'))).toEqual(['One.', 'Two.', 'Five.', 'Three.', 'Four.']);
    expect(paras(apply('MOVE ¶4-¶5 BEFORE ¶1'))).toEqual(['Four.', 'Five.', 'One.', 'Two.', 'Three.']);
    expect(apply('MOVE ¶5 AFTER ¶2').applied).toEqual(['moved ¶5 after ¶2']);
  });

  it('inserts before a paragraph', () => {
    expect(paras(apply('INSERT BEFORE ¶2\nNew.'))).toEqual(['One.', 'New.', 'Two.', 'Three.', 'Four.', 'Five.']);
  });

  it('reports edits it cannot do instead of guessing', () => {
    const out = apply('REPLACE ¶4-¶9\nX', 'MOVE ¶2-¶4 AFTER ¶3', 'DELETE W1-W2');
    expect(out.skipped).toEqual(['¶4–¶9', 'moved ¶2–¶4 after ¶3']);
    expect(out.draft.whispers).toHaveLength(0);
    expect(paras(out)).toEqual(['One.', 'Two.', 'Three.', 'Four.', 'Five.']);
  });

  it('does not let two edits in one reply fight over the same paragraph', () => {
    const out = apply('REPLACE ¶2\nFirst.', 'DELETE ¶2-¶3');
    expect(out.skipped).toEqual(['removed ¶2–¶3']);
    expect(paras(out)).toEqual(['One.', 'First.', 'Three.', 'Four.', 'Five.']);
  });
});
