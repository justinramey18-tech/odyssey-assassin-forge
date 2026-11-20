// Empyrean quest GM guides: when a rider accepts a quest, a writer model drafts a large hidden

// guide for the DM (the truth behind the quest, its cast, branches and twists) plus a short list

// of steps. The steps become the quest's objectives; the DM marks them with hidden tags and the

// quest's percent follows. The guide is sent to the DM only while its quest is active and is

// removed when the quest ends. Pure rules; the network half is empyrean-quest-guide-writer.ts.

import { normalizeQuestMap, questKeyFrom, questTitle, type Quest, type QuestStage } from '@/lib/quests';



/** Reserved quest_flags key holding the guides of this campaign's quests. */

export const GUIDES_KEY = '__empyrean_quest_guides__';

/** At most this many active quests carry a guide at once (each one is sent with every DM reply). */

export const MAX_GUIDED_QUESTS = 3;

export const MAX_GUIDE_CHARS = 24_000;

export const MIN_GUIDE_CHARS = 1_200;

export const MIN_GUIDE_STEPS = 3;

/** The shared quest model keeps six objectives per quest. */

export const MAX_GUIDE_STEPS = 6;

const STEP_CHARS = 160;

const TEST_CHARS = 500;



export interface QuestGuide {

  questKey: string;

  title: string;

  /** Player-facing step names, in order. They are also the quest's objectives. */

  steps: string[];

  completeWhen: string;

  failWhen: string;

  /** The hidden guide. Never shown on screen. */

  text: string;

  /** The model that wrote it. */

  model: string;

  at: string;

}



export type QuestGuideMap = Record<string, QuestGuide>;



function cleanLine(value: unknown, max: number): string {

  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

}



export function normalizeQuestGuides(raw: unknown): QuestGuideMap {

  const out: QuestGuideMap = {};

  const guides = (raw as { guides?: unknown } | null)?.guides;

  if (!guides || typeof guides !== 'object') return out;

  for (const [key, value] of Object.entries(guides as Record<string, unknown>)) {

    if (!value || typeof value !== 'object') continue;

    const g = value as Record<string, unknown>;

    const text = String(g.text ?? '').trim().slice(0, MAX_GUIDE_CHARS);

    const steps = (Array.isArray(g.steps) ? g.steps : []).map(s => cleanLine(s, STEP_CHARS)).filter(Boolean).slice(0, MAX_GUIDE_STEPS);

    if (!text || steps.length === 0) continue;

    out[key] = {

      questKey: key,

      title: cleanLine(g.title, 120),

      steps,

      completeWhen: cleanLine(g.completeWhen, TEST_CHARS),

      failWhen: cleanLine(g.failWhen, TEST_CHARS),

      text,

      model: cleanLine(g.model, 80),

      at: g.at ? String(g.at) : '',

    };

  }

  return out;

}



export function storedQuestGuides(guides: QuestGuideMap): Record<string, unknown> {

  // status 'unknown' keeps panels that count quest_flags by status from treating this as a quest.

  return { status: 'unknown', guides: { ...guides }, updated_at: new Date().toISOString() };

}



/** Guides of quests that are active right now, oldest first. */

export function activeQuestGuides(guides: QuestGuideMap, quests: Quest[]): QuestGuide[] {

  const active = new Set(quests.filter(q => q.status === 'active').map(q => q.key));

  return Object.values(guides).filter(g => active.has(g.questKey)).sort((a, b) => a.at.localeCompare(b.at));

}



/** True while another guide fits under the limit. */

export function guideSlotFree(guides: QuestGuideMap, quests: Quest[]): boolean {

  return activeQuestGuides(guides, quests).length < MAX_GUIDED_QUESTS;

}



/** Keys whose guide should be dropped: the quest is finished or failed. */

export function finishedGuideKeys(guides: QuestGuideMap, quests: Quest[]): string[] {

  const over = new Set(quests.filter(q => q.status === 'completed' || q.status === 'failed').map(q => q.key));

  return Object.keys(guides).filter(k => over.has(k));

}



/** The quest's objectives made from a guide's steps (ids are stable: <key>-g1, <key>-g2 …). */

export function guideStages(questKey: string, guide: QuestGuide): QuestStage[] {

  return guide.steps.map((text, i) => ({ id: `${questKey}-g${i + 1}`, text, done: false }));

}



// ─── The writer's instruction sheet ──────────────────────────────────────────



export interface GuideContext {

  characterName: string;

  dragonName?: string;

  signetType?: string;

  yearAtBasgiath?: string;

  /** The running campaign summary (trimmed by the caller). */

  campaignSummary?: string;

  /** The latest DM posts and rider messages, oldest first (trimmed by the caller). */

  recentStory?: string;

  /** Settled outcomes the story must not contradict. */

  worldFacts?: string[];

  /** The rider's standing across the Quest Hub, in one line. */

  standingLine?: string;

  /** Titles of the rider's other active quests. */

  otherQuests: string[];

}



/** True when the quest keeps its own objectives (it is already under way and has at least two). */

export function keepsObjectives(quest: Quest): boolean {

  return quest.status === 'active' && (quest.stages?.length ?? 0) >= 2;

}



export function buildGuidePrompt(quest: Quest, ctx: GuideContext): { system: string; user: string } {

  const keep = keepsObjectives(quest);

  const stages = quest.stages ?? [];

  const system = [

    'You are a veteran game master writing a private GM guide for ONE quest in a solo dragon-rider campaign set at Basgiath War College, where cadets train, bond dragons and wield signet powers. Another AI game master will run the quest from your guide. The player never sees it.',

    'Write for a game master, in plain direct prose. Be concrete and generous: this is a large, layered guide, about 2,500 to 3,500 words.',

    '',

    'RULES',

    '- Build on the story so far. Use the people, places and loose threads it already has wherever you can. Invent a new character only for a role nobody in the story fills, and give them a name that belongs to no known character.',

    '- Do not restate or invent setting lore. The game master has the lore; write only what is particular to this quest.',

    '- Never contradict the story so far or the settled facts you are given.',

    '- Write situations, people and pressures, not a script. The rider decides what happens. For every major beat give at least two ways it can go, and say how the quest continues if the rider refuses, fails, cheats or takes a path you did not plan.',

    '- The rider is one cadet among hundreds. Do not build the quest on leadership (wingleaders, section leaders, squad leaders, professors, command) taking a special interest in the rider, making decisions about the rider or arguing over the rider, unless the notes you are given show that the rider\'s own actions caused it. Give the cast business of their own that would go on without the rider.',

    '- Never rewrite a canon event or a canon character\'s story so that it is about the rider, and never move canon dates to suit the quest. Keep the quest inside what a cadet could really be doing at that point of the year.',

    '- Failure must move the story forward: a cost, a complication or a harder road, never a dead end. Say what truly fails the quest.',

    '- Fit the difficulty and the stakes to the challenge rating you are given. Do not hand out XP, gold or levels; you may suggest story rewards (favors, access, reputation, a keepsake).',

    '- No dice numbers, DCs or stat blocks. Say what is hard and why; the game master sets the numbers.',

    '- Adults only. Nothing sexual involving animals or characters in animal form, no real people, no slurs.',

    '',

    'WHAT THE GUIDE COVERS (use these headings, in this order)',

    '1. THE TRUTH: what is really going on behind the quest, including what the rider does not know yet.',

    '2. STAKES AND CLOCK: what happens if the rider does nothing, and how fast.',

    '3. CAST: everyone who matters. For each: what they want, what they fear, what they hide, how they talk, and what would change their mind.',

    '4. PLACES: where it happens, with two or three sensory details and one thing to interact with in each.',

    '5. THE STEPS IN DEPTH: for each numbered step, how it can open, the obstacles, at least two ways through, what success and partial success look like, and exactly what must have happened in the story for the step to count as done.',

    '6. COMPLICATIONS AND TWISTS: three to five, each with the moment it fits best. They are optional tools, not a schedule.',

    '7. IF THE RIDER GOES OFF THE PATH: the most likely detours and how the quest bends around them.',

    '8. THE DRAGON AND THE SIGNET: how the bond, the dragon\'s nature and the rider\'s signet can matter here (skip what does not apply).',

    '9. ENDINGS: the full success, a costly success and the failure, and what each changes afterwards.',

    '',

    'THE STEPS',

    keep

      ? `- This quest is already under way and its objectives are fixed. Under ===STEPS=== repeat them exactly as given, in the same order, and write the guide for them. Objectives marked [done] have already happened: treat them as history.`

      : `- Give ${MIN_GUIDE_STEPS + 1} to ${MAX_GUIDE_STEPS} steps in the order they are most likely to happen. Each is a short line the PLAYER will see as an objective (at most 12 words): it must give away no twist and no secret. Keep the intent of the offer's objectives; you may reword, split or add to them. No step may repeat another.`,

    '- A step is done only when it has truly happened in the story, not when it was attempted or planned.',

    '',

    'OUTPUT FORMAT (exactly these four markers, each on its own line, nothing before the first)',

    '===STEPS===',

    'a numbered list, one step per line',

    '===COMPLETE WHEN===',

    'one or two sentences: the test for the whole quest being done',

    '===FAILED WHEN===',

    'one or two sentences: the test for the quest being lost for good',

    '===GUIDE===',

    'the guide, under the nine headings above',

  ].join('\n');



  const lines = [

    `Rider: ${ctx.characterName || 'the rider'}${ctx.yearAtBasgiath ? `, ${ctx.yearAtBasgiath}` : ''}.`,

    ctx.dragonName ? `Bonded dragon: ${ctx.dragonName}.` : 'Not bonded to a dragon right now.',

    ctx.signetType ? `Signet: ${ctx.signetType}.` : '',

    ctx.standingLine ? `Standing: ${ctx.standingLine}` : '',

    ctx.campaignSummary ? `STORY SO FAR\n${ctx.campaignSummary}` : '',

    ctx.recentStory ? `LATEST SCENES (oldest first)\n${ctx.recentStory}` : '',

    ctx.worldFacts?.length ? `SETTLED FACTS (never contradict)\n${ctx.worldFacts.slice(0, 30).map(f => `- ${f}`).join('\n')}` : '',

    ctx.otherQuests.length ? `The rider's other active quests (do not resolve or overlap them): ${ctx.otherQuests.slice(0, 12).join('; ')}` : '',

    [

      'THE QUEST',

      `Title: ${questTitle(quest)}`,

      quest.category ? `Category: ${quest.category}` : '',

      `Challenge: ${quest.challengeRating ?? 'moderate'}${quest.questType === 'main' ? ' (main quest)' : ''}`,

      quest.description ? `Brief: ${quest.description}` : '',

      quest.notes ? `Notes so far: ${quest.notes}` : '',

      stages.length

        ? `${keep ? 'Objectives (fixed)' : "The offer's objectives"}:\n${stages.map((s, i) => `${i + 1}. ${s.text}${s.done ? ' [done]' : ''}`).join('\n')}`

        : '',

    ].filter(Boolean).join('\n'),

    'Write the GM guide for this quest now, in the output format.',

  ].filter(Boolean);

  return { system, user: lines.join('\n\n') };

}



// ─── Reading the writer's reply ──────────────────────────────────────────────



function section(raw: string, name: string, next: string[]): string {

  const start = raw.search(new RegExp(`={2,}\\s*${name}\\s*={2,}`, 'i'));

  if (start === -1) return '';

  const after = raw.slice(start).replace(new RegExp(`^={2,}\\s*${name}\\s*={2,}`, 'i'), '');

  let end = after.length;

  for (const n of next) {

    const at = after.search(new RegExp(`={2,}\\s*${n}\\s*={2,}`, 'i'));

    if (at !== -1 && at < end) end = at;

  }

  return after.slice(0, end).trim();

}



/** Step lines from a numbered or bulleted list; drops repeats and lines that contain one another. */

export function parseGuideSteps(block: string): string[] {

  const out: string[] = [];

  for (const line of String(block ?? '').split('\n')) {

    const text = cleanLine(line.replace(/^\s*(?:\d+\s*[.):-]|[-*•])\s*/, '').replace(/\*\*/g, ''), STEP_CHARS);

    if (text.length < 4) continue;

    const low = text.toLowerCase();

    if (out.some(o => { const p = o.toLowerCase(); return p === low || p.includes(low) || low.includes(p); })) continue;

    out.push(text);

    if (out.length === MAX_GUIDE_STEPS) break;

  }

  return out;

}



/** Cut a long guide at the end of a paragraph (or a sentence) under the limit. */

function fitGuide(text: string): string {

  if (text.length <= MAX_GUIDE_CHARS) return text;

  const cut = text.slice(0, MAX_GUIDE_CHARS);

  const para = cut.lastIndexOf('\n\n');

  if (para > MAX_GUIDE_CHARS * 0.6) return cut.slice(0, para).trimEnd();

  const stop = cut.lastIndexOf('. ');

  return stop > MAX_GUIDE_CHARS * 0.6 ? cut.slice(0, stop + 1) : cut;

}



/**

 * Read the writer's reply into a guide, or null when it can't be used (no guide text, too short,

 * too few steps). A quest that keeps its objectives keeps them whatever the writer listed.

 */

export function parseGuideReply(text: string, quest: Quest, model: string, at: string): QuestGuide | null {

  const raw = String(text ?? '').replace(/\r/g, '');

  const names = ['STEPS', 'COMPLETE WHEN', 'FAILED WHEN', 'GUIDE'];

  const body = fitGuide(section(raw, 'GUIDE', []));

  if (body.length < MIN_GUIDE_CHARS) return null;

  const steps = keepsObjectives(quest)

    ? (quest.stages ?? []).map(s => cleanLine(s.text, STEP_CHARS)).filter(Boolean).slice(0, MAX_GUIDE_STEPS)

    : parseGuideSteps(section(raw, 'STEPS', names.slice(1)));

  if (steps.length < (keepsObjectives(quest) ? 2 : MIN_GUIDE_STEPS)) return null;

  return {

    questKey: quest.key,

    title: questTitle(quest),

    steps,

    completeWhen: cleanLine(section(raw, 'COMPLETE WHEN', ['FAILED WHEN', 'GUIDE']), TEST_CHARS) || 'Every step has happened in the story.',

    failWhen: cleanLine(section(raw, 'FAILED WHEN', ['GUIDE']), TEST_CHARS) || 'The goal can no longer be reached by any road.',

    text: body,

    model,

    at,

  };

}



// ─── What the DM is told ─────────────────────────────────────────────────────



const DM_RULES = [

  '=== ACTIVE QUEST GM GUIDES (PRIVATE: THE PLAYER NEVER SEES THESE) ===',

  'These guides are for you alone. Never quote them, never name a twist, a secret or a later step before the story reaches it, and never mention that a guide exists.',

  'They describe situations, people and pressures, not a script. The rider\'s choices always win: if the rider goes another way, bend the guide\'s material to where the story is and never force a scene. Where the story has already contradicted a guide, the story is right.',

  'Where a guide disagrees with THE WORLD IN MOTION rules or with the Calendar lines in GAME FACTS, those win. Use the guide for its places, obstacles and people, but never let it make leadership or canon characters revolve around the rider, and never move canon dates to suit it. A guide written before those rules may assume otherwise: quietly play it their way.',

  'PROGRESS TAGS: when a numbered step of a quest has truly happened in the reply you are writing (not merely been attempted or planned), put its tag on its own line at the very end of the reply, written exactly like this: <!--QUEST_STEP:quest_key:step_number-->. One tag for each step finished in this reply. When a quest\'s "Complete when" test is met, add <!--QUEST_DONE:quest_key-->. When its "Failed when" test is met, add <!--QUEST_FAILED:quest_key-->. Copy the quest key exactly. Never mention the tags, never tag a step marked [done], and never tag a step the story has not reached.',

].join('\n');



/**

 * The block added to the DM's guides: every active quest's guide with its steps as they stand.

 * Empty when no active quest has a guide. Reads quest_flags directly so it can be built before the hub hook.

 */

export function buildQuestGuidesBlock(questFlags: Record<string, unknown> | null | undefined): string {

  if (!questFlags) return '';

  const quests = normalizeQuestMap(questFlags as Record<string, any>);

  const guides = activeQuestGuides(normalizeQuestGuides(questFlags[GUIDES_KEY]), quests);

  if (guides.length === 0) return '';

  const parts = [DM_RULES];

  for (const g of guides) {

    const quest = quests.find(q => q.key === g.questKey);

    const stages = quest?.stages?.length ? quest.stages : guideStages(g.questKey, g);

    parts.push([

      `--- QUEST: ${quest ? questTitle(quest) : g.title} (quest key: ${g.questKey}) ---`,

      'Steps:',

      ...stages.map((s, i) => `${i + 1}. ${s.done ? '[done] ' : ''}${s.text}`),

      `Complete when: ${g.completeWhen}`,

      `Failed when: ${g.failWhen}`,

      'Guide:',

      g.text,

    ].join('\n'));

  }

  parts.push('=== END OF QUEST GM GUIDES ===');

  return parts.join('\n\n');

}



// ─── Reading the DM's tags ───────────────────────────────────────────────────



export type QuestTag =

  | { kind: 'step'; questKey: string; step: number }

  | { kind: 'done' | 'failed'; questKey: string };



const TAG_RE = /<!--\s*QUEST_(STEP|DONE|FAILED)\s*:\s*([^:>\s][^:>]*?)\s*(?::\s*(\d+)\s*)?-->/gi;



/** Every quest tag in a DM reply, in order. */

export function readQuestTags(content: string): QuestTag[] {

  const out: QuestTag[] = [];

  for (const m of String(content ?? '').matchAll(TAG_RE)) {

    const kind = m[1].toUpperCase();

    const questKey = questKeyFrom(m[2]);

    if (!questKey) continue;

    if (kind === 'STEP') {

      const step = Number(m[3]);

      if (Number.isInteger(step) && step >= 1 && step <= MAX_GUIDE_STEPS) out.push({ kind: 'step', questKey, step });

    } else {

      out.push({ kind: kind === 'DONE' ? 'done' : 'failed', questKey });

    }

  }

  return out;

}



/** Remove quest tags from text shown on screen (a tag still being typed at the very end too). */

export function stripQuestTags(content: string): string {

  return String(content ?? '')

    .replace(/<!--\s*QUEST_(?:STEP|DONE|FAILED)\s*:[^>]*?-->/gi, '')

    .replace(/<!--\s*QUEST_[A-Z]*(?::[^>]*)?$/i, '');

}



export interface QuestTagProgress {

  key: string;

  stages_completed: string[];

  status: 'completed' | 'failed' | null;

}



/**

 * Turn the DM's tags into quest progress (the shape the story extractor uses). Only active quests

 * that have a guide are moved; a step already done, an unknown quest and a step number past the

 * list are ignored. A quest both finished and failed in one reply counts as finished.

 */

export function progressFromTags(tags: QuestTag[], guides: QuestGuideMap, quests: Quest[]): QuestTagProgress[] {

  const out = new Map<string, QuestTagProgress>();

  for (const tag of tags) {

    const quest = quests.find(q => q.key === tag.questKey);

    if (!quest || quest.status !== 'active' || !guides[tag.questKey]) continue;

    const entry = out.get(quest.key) ?? { key: quest.key, stages_completed: [], status: null };

    if (tag.kind === 'step') {

      const stage = (quest.stages ?? [])[tag.step - 1];

      if (!stage || stage.done || entry.stages_completed.includes(stage.text)) continue;

      entry.stages_completed.push(stage.text);

    } else if (tag.kind === 'done') {

      entry.status = 'completed';

    } else if (entry.status !== 'completed') {

      entry.status = 'failed';

    }

    out.set(quest.key, entry);

  }

  return [...out.values()].filter(e => e.stages_completed.length > 0 || e.status !== null);

}
