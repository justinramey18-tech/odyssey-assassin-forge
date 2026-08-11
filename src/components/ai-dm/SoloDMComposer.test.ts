import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseNpcTags } from '@/lib/parseNpcTags';

describe('Solo DM composer isolation', () => {
  it('keeps live draft updates out of the large DM screen', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/ai-dm/AIDMScreen.tsx'), 'utf8');
    expect(source).not.toContain('onInputChange=');
    expect(source).not.toContain('liveInputText');
    expect(source).not.toContain('handleLiveInputChange');
  });

  it('still recognizes multi-word NPC tags at submission time', () => {
    expect(parseNpcTags('@Lady Blackwood Tell me the truth.', ['Lady Blackwood'])).toEqual({
      npcNames: ['Lady Blackwood'],
      message: 'Tell me the truth.',
    });
  });
});