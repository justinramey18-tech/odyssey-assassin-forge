import { describe, it, expect } from 'vitest';
import { formatStory } from '@/lib/story-format';

const kinds = (text: string, dragon?: string) => formatStory(text, dragon).map(p => p.kind);

describe('story format', () => {
  it('returns nothing for empty text', () => {
    expect(formatStory('')).toEqual([]);
    expect(formatStory(null)).toEqual([]);
  });
  it('keeps plain narration as one piece per paragraph', () => {
    expect(kinds('The hall is loud.\n\nRain on the stone.')).toEqual(['narration', 'narration']);
  });
  it('puts a spoken line on its own, with its attribution', () => {
    const pieces = formatStory('Dain sets down his cup. "Sit down," he says, to the whole table. Nobody answers.');
    expect(pieces.map(p => p.kind)).toEqual(['narration', 'dialogue', 'narration']);
    expect(pieces[1].text).toBe('"Sit down," he says, to the whole table.');
  });
  it('keeps a lead-in and a two-part speech on one line', () => {
    expect(formatStory('Rhiannon leans in and asks, "Who holds the rope?"')[0]).toEqual({ kind: 'dialogue', text: 'Rhiannon leans in and asks, "Who holds the rope?"' });
    expect(formatStory('"Go," Dain said, "and stay gone."')[0].text).toBe('"Go," Dain said, "and stay gone."');
  });
  it('leaves a quoted word inside narration alone', () => {
    expect(kinds('Ridoc called it the so-called "help" and laughed.')).toEqual(['narration']);
  });
  it('handles curly quotes and an unclosed speech', () => {
    expect(kinds('“Narrower than I remember.” Sawyer shrugs.')).toEqual(['dialogue', 'narration']);
    expect(kinds('"A speech that keeps going')).toEqual(['dialogue']);
  });
  it('marks checks, the dragon and scene breaks', () => {
    expect(kinds('Make a Shadow Work check (DC 15).')).toEqual(['check']);
    expect(kinds('Ancalagon shifts on the wall.', 'Ancalagon')).toEqual(['dragon']);
    expect(kinds('Ancalagon shifts on the wall.')).toEqual(['narration']);
    expect(kinds('One.\n\n***\n\nTwo.')).toEqual(['narration', 'scene', 'narration']);
    expect(kinds('One.\n\n---\n\nTwo.')).toEqual(['narration', 'scene', 'narration']);
  });
  it('leaves lists and raw HTML whole', () => {
    expect(kinds('- one\n- two')).toEqual(['raw']);
    expect(kinds('<span style="color:red">"Loud."</span>')).toEqual(['raw']);
  });
  it('never loses or adds a word', () => {
    const text = 'The hall is loud. "Sit," Dain says. He leaves.\n\nAsk, "Who holds the rope?" Then wait.';
    const words = (s: string) => s.replace(/\s+/g, ' ').trim();
    expect(words(formatStory(text).map(p => p.text).join(' '))).toBe(words(text));
  });
});
