import { describe, expect, it } from 'vitest';
import {
  STORY_SCENE_SENDER,
  buildScenePrompt,
  cleanSceneText,
  followsStoryScene,
  isHandoffRow,
  isStorySceneRow,
  missingSpokenLines,
  rowsCoveredByScenes,
  sceneRetryNote,
  sceneScript,
  sceneSetting,
  spokenParts,
  wordsOf,
  type StorySceneLine,
} from '@/lib/story-scene';

// A real exchange from the main table (2026-10-11), trimmed.
const LINES: StorySceneLine[] = [
  { name: 'Xeyle', npc: false, text: '"You\'re the god hephaestus? Athena sent us. We are stopping him."' },
  { name: 'Hephaestus', npc: true, replyTo: 'Xeyle', text: "Athena sends rats to do a god's work. *He spits on the deck, the sizzle loud in the quiet.* If you're here to stop Ares, prove it. Where are my people?" },
  { name: 'Xeyle', npc: false, text: '"Hey, tin-head, no one calls me useless except my mom."' },
  { name: 'Hephaestus', npc: true, replyTo: 'Xeyle', text: '"Nicely?" *He barks a harsh, humorless laugh.* You think I trade the Anvil for polite words?\n\nGet your people out first.' },
  { name: 'Xeyle', npc: false, text: '"Or give us the key and we can free them." I want to persuade him into giving me the key' },
  { name: 'Hephaestus', npc: true, replyTo: 'Xeyle', text: 'You think I’m stupid? That’s not a deal, that’s a trap. (asks Xeyle for a DC 20 Persuasion check)' },
  { name: 'Xeyle', npc: false, text: 'Xeyle rolls for Hephaestus: Persuasion check, 23 against DC 20 (success).' },
];

const GOOD_SCENE = [
  'Xeyle steps into the heat.',
  '**Xeyle:** [VOICE:Xeyle]"You\'re the god Hephaestus? Athena sent us. We are stopping him."[/VOICE]',
  '**Hephaestus:** [VOICE:Hephaestus]"Athena sends rats to do a god\'s work."[/VOICE]',
  'He spits on the deck, the sizzle loud in the quiet.',
  '**Hephaestus:** [VOICE:Hephaestus]"If you\'re here to stop Ares, prove it. Where are my people?"[/VOICE]',
  '**Xeyle:** [VOICE:Xeyle]"Hey, tin-head, no one calls me useless except my mom."[/VOICE]',
  '**Hephaestus:** [VOICE:Hephaestus]"Nicely?"[/VOICE] He barks a harsh laugh. [VOICE:Hephaestus]"You think I trade the Anvil for polite words? Get your people out first."[/VOICE]',
  '**Xeyle:** [VOICE:Xeyle]"Or give us the key and we can free them."[/VOICE] Xeyle leans in, set on talking him into it.',
  '**Hephaestus:** [VOICE:Hephaestus]"You think I\'m stupid?"[/VOICE] He narrows his eyes. [VOICE:Hephaestus]"That\'s not a deal, that\'s a trap."[/VOICE] He wants a DC 20 Persuasion check from Xeyle.',
  'Xeyle\'s Persuasion lands: 23 against DC 20.',
].join('\n\n');

describe('spokenParts', () => {
  it('takes everything outside beats and notes for an NPC', () => {
    expect(spokenParts(LINES[3])).toEqual(['Nicely?', 'You think I trade the Anvil for polite words?\n\nGet your people out first.']);
    expect(spokenParts(LINES[5])).toEqual(['You think I’m stupid? That’s not a deal, that’s a trap.']);
  });
  it('takes only the quoted words for a player', () => {
    expect(spokenParts(LINES[4])).toEqual(['Or give us the key and we can free them.']);
    expect(spokenParts(LINES[6])).toEqual([]);
  });
});

describe('missingSpokenLines', () => {
  it('passes a scene that keeps every spoken sentence, with case, punctuation and curly quotes changed', () => {
    expect(missingSpokenLines(GOOD_SCENE, LINES)).toEqual([]);
  });
  it('catches a softened word', () => {
    const softened = GOOD_SCENE.replace('tin-head', 't***head');
    expect(missingSpokenLines(softened, LINES)).toEqual(['Xeyle: Hey, tin-head, no one calls me useless except my mom.']);
  });
  it('catches a dropped line and a shortened one', () => {
    const cut = GOOD_SCENE
      .replace('**Hephaestus:** [VOICE:Hephaestus]"Athena sends rats to do a god\'s work."[/VOICE]', '')
      .replace('Get your people out first.', 'Get out.');
    expect(missingSpokenLines(cut, LINES)).toEqual([
      "Hephaestus: Athena sends rats to do a god's work.",
      'Hephaestus: Get your people out first.',
    ]);
  });
  it('catches a sentence split by a dialogue tag', () => {
    const split = GOOD_SCENE.replace('Where are my people?"', 'Where," he growls, "are my people?"');
    expect(missingSpokenLines(split, LINES)).toEqual(['Hephaestus: Where are my people?']);
  });
  it('does not require a player\'s unquoted action or a roll note word for word', () => {
    expect(missingSpokenLines(GOOD_SCENE, [LINES[6]])).toEqual([]);
  });
});

describe('sceneScript', () => {
  it('keeps every line in order, one paragraph each, and always passes the check', () => {
    const script = sceneScript(LINES);
    expect(script.split('\n\n')).toHaveLength(LINES.length);
    expect(missingSpokenLines(script, LINES)).toEqual([]);
    expect(script).toContain('**Hephaestus:** [VOICE:Hephaestus]"Nicely?"[/VOICE] *He barks a harsh, humorless laugh.* [VOICE:Hephaestus]"You think I trade the Anvil for polite words? Get your people out first."[/VOICE]');
    expect(script).toContain('**Xeyle:** [VOICE:Xeyle]"Or give us the key and we can free them."[/VOICE] *I want to persuade him into giving me the key*');
    expect(script).toContain('*asks Xeyle for a DC 20 Persuasion check*');
    expect(script.indexOf('Athena sends rats')).toBeLessThanOrEqual(script.indexOf('tin-head'));
  });
});

describe('buildScenePrompt', () => {
  it('numbers the exchange in order with NPC and reply labels, and puts the setting first', () => {
    const { system, user } = buildScenePrompt(LINES.slice(0, 2), 'The welder hisses in the dark.');
    expect(user).toContain("WHERE THE STORY IS (end of the DM's latest post)\nThe welder hisses in the dark.");
    expect(user).toContain('1. Xeyle: "You\'re the god hephaestus?');
    expect(user).toContain('2. Hephaestus (NPC, to Xeyle): Athena sends rats');
    expect(system).toContain('word for word');
    expect(system).toContain('**Name:** [VOICE:Name]"the words"[/VOICE]');
  });
  it('leaves the setting out when there is no DM post yet', () => {
    expect(buildScenePrompt(LINES.slice(0, 1), '  ').user.startsWith('THE EXCHANGE')).toBe(true);
  });
  it('lists the missing words in the retry note', () => {
    expect(sceneRetryNote(['Xeyle: Hey.'])).toContain('- Xeyle: Hey.');
  });
});

describe('cleanSceneText', () => {
  it('drops thinking, comments, fences and a heading', () => {
    expect(cleanSceneText('<think>plan</think>\n```\n## Scene\nXeyle waits.\n<!--x-->\n```')).toBe('Xeyle waits.');
    expect(cleanSceneText('Xeyle waits.<think>unfinished')).toBe('Xeyle waits.');
  });
});

describe('scene rows in the story', () => {
  const rows = [
    { id: 'dm1', role: 'assistant', sender_name: 'DM', content: 'The welder hisses.' },
    { id: 'p1', role: 'user', sender_name: 'Xeyle', content: '[Xeyle]: "Hi."' },
    { id: 'n1', role: 'assistant', sender_name: 'Hephaestus', content: '**Hephaestus:** Leave.' },
    { id: 'a1', role: 'user', sender_name: 'Atlas', content: '[Atlas] (AFK): guide', is_afk_marker: true },
    { id: 's1', role: 'assistant', sender_name: STORY_SCENE_SENDER, content: 'Xeyle greets him.' },
    { id: 'dm2', role: 'assistant', sender_name: 'DM', content: 'Sparks fly.' },
    { id: 'w1', role: 'user', sender_name: 'Xeyle', content: '[Xeyle]: psst', team: 'whisper:a:b' },
    { id: 'p2', role: 'user', sender_name: 'Xeyle', content: '[Xeyle]: "Bye."' },
  ];
  it('hides only the hand-off rows right before each scene', () => {
    expect([...rowsCoveredByScenes(rows)].sort()).toEqual(['a1', 'n1', 'p1']);
  });
  it('knows scene rows, hand-off rows and the rest apart', () => {
    expect(isStorySceneRow(rows[4])).toBe(true);
    expect(isStorySceneRow(rows[0])).toBe(false);
    expect(isHandoffRow(rows[2])).toBe(true);
    expect(isHandoffRow(rows[0])).toBe(false);
    expect(isHandoffRow(rows[6])).toBe(false);
    expect(isHandoffRow({ id: 'm', role: 'assistant', sender_name: 'Xeyle', content: '[img](https://x/y.png)' })).toBe(false);
  });
  it('knows when a post comes right after a scene', () => {
    expect(followsStoryScene(rows, 5)).toBe(true);
    expect(followsStoryScene(rows, 4)).toBe(false);
    expect(followsStoryScene([rows[4], rows[3], rows[5]], 2)).toBe(true);
    expect(followsStoryScene(rows, 0)).toBe(false);
  });
  it('reads the end of the latest DM post as the setting, without tags or table asides', () => {
    expect(sceneSetting(rows)).toBe('Sparks fly.');
    expect(sceneSetting([{ id: 'd', role: 'assistant', sender_name: 'DM', content: '[TABLE]lol[/TABLE]\n[VOICE:Heph]"Go."[/VOICE]<!--MOOD:x-->' }])).toBe('"Go."');
    expect(sceneSetting([{ id: 'd', role: 'assistant', sender_name: 'DM', content: 'x'.repeat(2000) }])).toHaveLength(1501);
  });
});

describe('wordsOf', () => {
  it('keeps apostrophes inside words and ignores markup', () => {
    expect(wordsOf('**Don’t** [VOICE:A]"go"[/VOICE]...')).toEqual(["don't", 'voice', 'a', 'go', 'voice']);
  });
});
