import { describe, expect, it } from 'vitest';
import { STORY_TIME_MAX_MINUTES, readTimeTag, stripTimeTags } from '@/lib/empyrean-story-time';

describe('the DM\'s TIME tag', () => {
  it('reads minutes, hours and both', () => {
    expect(readTimeTag('You cross the quad.\n<!--TIME:+20m-->')).toBe(20);
    expect(readTimeTag('<!--TIME:+2h-->')).toBe(120);
    expect(readTimeTag('<!--TIME:+1h30m-->')).toBe(90);
    expect(readTimeTag('<!-- time : 1h 30m -->')).toBe(90);
    expect(readTimeTag('<!--TIME:+90-->')).toBe(90);
    expect(readTimeTag('<!--TIME:+45 minutes-->')).toBe(45);
    expect(readTimeTag('<!--TIME:+1.5 hours-->')).toBe(90);
  });
  it('caps a reply at four hours, days included', () => {
    expect(STORY_TIME_MAX_MINUTES).toBe(240);
    expect(readTimeTag('<!--TIME:+9h-->')).toBe(240);
    expect(readTimeTag('<!--TIME:+2d-->')).toBe(240);
  });
  it('gives nothing without a usable tag', () => {
    expect(readTimeTag('No tag here.')).toBeNull();
    expect(readTimeTag('<!--TIME:+0m-->')).toBeNull();
    expect(readTimeTag('<!--TIME:later-->')).toBeNull();
    expect(readTimeTag('<!--TIME:-->')).toBeNull();
    expect(readTimeTag('<!--QUEST_STEP:q:2-->')).toBeNull();
    expect(readTimeTag('<!--TIME:+2h')).toBeNull();
  });
  it('takes the last tag when a reply has two', () => {
    expect(readTimeTag('<!--TIME:+10m--> then later <!--TIME:+1h-->')).toBe(60);
  });
  it('hides tags, a half-typed one at the end too, and leaves other tags alone', () => {
    expect(stripTimeTags('The bell rings.\n<!--TIME:+2h-->')).toBe('The bell rings.\n');
    expect(stripTimeTags('The bell rings.\n<!--TIME:+2')).toBe('The bell rings.\n');
    expect(stripTimeTags('The bell rings.\n<!--TIME')).toBe('The bell rings.\n');
    expect(stripTimeTags('Keep <!--BOND_GROWTH:2--> and <!--QUEST_STEP:q:1--> this')).toBe('Keep <!--BOND_GROWTH:2--> and <!--QUEST_STEP:q:1--> this');
    expect(stripTimeTags('Sometimes it takes time.')).toBe('Sometimes it takes time.');
  });
});
