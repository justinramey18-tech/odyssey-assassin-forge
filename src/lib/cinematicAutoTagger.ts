/**
 * Cinematic Auto-Tagger
 *
 * Scans DM response paragraphs for keywords and injects cinematic tags
 * that the AI should have emitted but didn't. Runs BEFORE the slide parser.
 *
 * Rules:
 * - Only adds tags to paragraphs that don't already have them
 * - First paragraph always gets AMBIENCE + MOOD if missing
 * - Each paragraph is scanned independently for SFX and VFX triggers
 * - MOOD and AMBIENCE persist, so they're only injected when the tone shifts
 */

// ── Keyword → tag mappings ──────────────────────────────────────────────

interface TagRule {
  patterns: RegExp;
  sfx?: string;
  vfx?: string[];
  mood?: string;
  ambience?: string;
}

const PARAGRAPH_RULES: TagRule[] = [
  // DRAGON
  { patterns: /\bdragon.*(?:roar|scream|bellow|shriek)|(?:roar|scream|bellow|shriek).*dragon|\btairn.*(?:land|roar|snarl|growl)|\bandarna/i, sfx: 'dragon-roar', vfx: ['screen-shake'] },
  { patterns: /\bwings?\s+(?:fold|spread|flare|beat|snap)|wing\s*beats?\b/i, sfx: 'dragon-roar' },
  { patterns: /\bdragon.*land|lands?\s+(?:behind|beside|before|heavily)|claws?\s+(?:goug|dig|scor|tear)/i, sfx: 'dragon-roar', vfx: ['screen-shake'] },
  { patterns: /\bdragon\s*fire|\bfire\s*breath|\bflame.*erupts?|\binferno/i, sfx: 'fire-whoosh', vfx: ['embers', 'screen-shake'] },

  // COMBAT - impacts
  { patterns: /\bsword.*(?:clash|strike|swing|slash|cut|slice|parr)|blade.*(?:connect|ring|clash|sing)|steel\s+(?:on|meets|against)\s+steel/i, sfx: 'sword-clash', vfx: ['screen-shake'] },
  { patterns: /\barrow.*(?:hit|strike|thud|impact|slam|pierc|embed)|bolt.*(?:hit|strike|slam)/i, sfx: 'arrow-impact' },
  { patterns: /\bexplo(?:sion|des?)|detonat|\bblast\b|\bbomb\b/i, sfx: 'explosion', vfx: ['screen-shake', 'flash-white'] },
  { patterns: /\bbone.*(?:snap|crack|break|shatter)|(?:snap|crack|break|shatter).*bone|\bsicken(?:ing)?\s+(?:crack|snap|crunch)/i, sfx: 'bone-snap', vfx: ['blood-vignette'] },
  { patterns: /\b(?:stab|slash|cut|wound|gash|bleed|blood\s+(?:pool|spray|spill|run|flow|drip|seep|pour))|takes?\s+(?:the\s+)?(?:hit|blow|damage)/i, vfx: ['blood-vignette'] },

  // COMBAT - general
  { patterns: /\bcombat\s+begin|initiative|roll\s+for\s+initiative|\battack(?:s|ed|ing)?\b.*(?:swing|lunge|thrust|charge)/i, mood: 'danger', ambience: 'combat-drums' },
  { patterns: /\bcharge(?:s|d)?\s+(?:at|toward|forward|into)|lunge(?:s|d)?\s+(?:at|toward|forward)/i, mood: 'danger' },

  // WEATHER
  { patterns: /\bthunder(?:\s*clap|\s*crack|\s*boom|\s*roll|storm|ing|\b)|lightning\s+(?:strike|flash|split|crack|bolt)/i, sfx: 'thunder', vfx: ['screen-shake', 'lightning'] },
  { patterns: /\brain\s+(?:fall|pour|pelt|drum|hammer|beat|start|begin|lash)|downpour|\braining\b|(?:heavy|driving|cold)\s+rain/i, ambience: 'rain', vfx: ['rain'] },
  { patterns: /\bwind\s+(?:howl|gust|whip|scream|roar|pick|blast)|gale\s+force|\bwindswept\b|\bgusting\b/i, ambience: 'wind' },
  { patterns: /\bstorm\b.*(?:rage|roll|break|approach|gather|build)/i, ambience: 'rain', vfx: ['rain', 'lightning'] },

  // MAGIC / SIGNET
  { patterns: /\bsignet\s+(?:flare|activate|pulse|crackle|burn|glow|surge)|signet.*power|\bchanneling\b.*(?:magic|power|energy)|relic\s+(?:glow|pulse|burn|heat|flare)/i, sfx: 'signet-crackle', vfx: ['gold-particles'] },
  { patterns: /\bward\s+(?:hum|shimmer|flicker|pulse|glow|activate|hold|crack|fall|fail|break)|the\s+ward(?:'s|\s+line)/i, sfx: 'ward-hum' },
  { patterns: /\bburnout\b|\bsignet\s+strain|\bveins?\s+(?:glow|burn|light|pulse)|\bheat.*(?:build|spread|radiat|sear)/i, sfx: 'signet-crackle', vfx: ['embers'], mood: 'danger' },
  { patterns: /\bmagic.*(?:surge|explode|detonate|blast|erupt)|spell.*(?:detonate|explode|erupt)/i, sfx: 'explosion', vfx: ['flash-white', 'screen-shake'] },

  // FIRE
  { patterns: /\bfire\s+(?:erupt|burst|roar|spread|blaz|crack)|flame(?:s)?\s+(?:erupt|burst|lick|danc|spread|engulf)|ablaze\b|\binferno\b/i, sfx: 'fire-whoosh', vfx: ['embers'] },

  // DOORS / STRUCTURES
  { patterns: /\bdoor\s+(?:creak|groan|swing|open|slam|burst)|gate\s+(?:creak|groan|open|swing)/i, sfx: 'door-creak' },
  { patterns: /\bbell\s+(?:toll|ring|chime|peal|sound)|(?:toll|ring|chime|peal)\s+of\s+(?:a\s+)?bell/i, sfx: 'bell-toll' },

  // CREATURES / SOUNDS
  { patterns: /\bhorse.*(?:gallop|thunder|charge|ride)|hoofbeat|galloping\b|(?:ride|riding)\s+(?:hard|fast|at\s+full)/i, sfx: 'horse-gallop' },
  { patterns: /\bwhisper(?:s|ed|ing)?\b.*(?:voice|word|secret|name|warning)|voice.*whisper/i, sfx: 'whisper' },
  { patterns: /\bcrowd\s+(?:gasp|scream|roar|shout|murmur|erupt|react|fall\s+silent)|(?:gasp|shock|horror)\s+(?:from|of|ripple)/i, sfx: 'crowd-gasp' },

  // HEARTBEAT / TENSION
  { patterns: /\bheartbeat\b|\bheart\s+(?:pound|race|hammer|slam|thud|skip|stop)|pulse(?:s|d)?\s+(?:in|through|beneath|under)/i, sfx: 'heartbeat' },
  { patterns: /\bground\s+(?:shake|tremble|split|crack|pulse|rumble|vibrat)|earth\s+(?:shake|tremble|split|quake)/i, vfx: ['ground-pulse', 'screen-shake'] },

  // COLD / FROST
  { patterns: /\bfrost\s+(?:spread|creep|form|coat|cover)|ice\s+(?:form|spread|crack|shatter|coat)|frozen\s+(?:solid|still|in\s+place)|\bfrostbite\b/i, vfx: ['frost'], mood: 'cold' },

  // FLYING
  { patterns: /\btake(?:s)?\s+(?:off|flight|to\s+the\s+(?:sky|air))|launch(?:es|ed)?\s+(?:into|skyward)|soar(?:s|ed|ing)?\b|\bdive(?:s|d)?\s+(?:toward|down|beneath)/i, ambience: 'flying' },

  // ENVIRONMENTS
  { patterns: /\btavern\b|\binn\b|\bmess\s+hall|\bbar(?:keep|tend)|\bale\b.*\bglass/i, ambience: 'tavern', mood: 'warm' },
  { patterns: /\bforest\b|\bwood(?:s|land)\b|\btree(?:s|line)\b.*(?:surround|tower|thick|dense)/i, ambience: 'forest' },
  { patterns: /\bdungeon\b|\bcave\b|\btunnel\b|\bunderground\b|\bcatacomb/i, ambience: 'dungeon', mood: 'dark' },
  { patterns: /\bcamp(?:fire|site)?\b.*(?:crack|warm|flame|glow|sit|gather)|fire\s+(?:crack|pop|warm)/i, ambience: 'campfire', mood: 'warm' },
  { patterns: /\bcrowd\b.*(?:gather|push|press|cheer|jeer|watch)|market(?:place)?|gathering\s+hall/i, ambience: 'crowd' },

  // SILENCE / DREAD
  { patterns: /\bsilence\s+(?:fall|descend|settle|press|hang|stretch|deafen)|(?:deafen|eerie|absolute|complete|dead)\s+silence|\bsound.*(?:stop|die|cease|vanish)/i, ambience: 'silence', mood: 'dark' },

  // EMOTIONAL TONES
  { patterns: /\bvenin\b|\bcorrupt(?:ion|ed)?\b|\btaint(?:ed)?\b|\bvoid\b.*(?:presenc|power|energy|spread)|something\s+(?:is\s+)?(?:deeply\s+)?wrong/i, mood: 'danger', vfx: ['ground-pulse'] },
  { patterns: /\bdead\b|\bdeath\b|\bfallen\b|\bdie(?:s|d)?\b|\bcorpse|\bbody\s+(?:lie|lay|fall|crumple)/i, mood: 'grief' },
  { patterns: /\bvictory\b|\btriumph\b|\bwin\b|\bsucceed|\bovercome|\bdefeat(?:s|ed)?\s+(?:the|their|every)/i, mood: 'triumph', vfx: ['gold-particles'] },
  { patterns: /\bsafe(?:ty)?\b|\brelief\b|\bwarm(?:th)?\b.*(?:fire|hearth|embrace|comfort)|finally\s+(?:safe|rest|breath)/i, mood: 'warm' },
  { patterns: /\bcold\b.*(?:bit|cut|seep|creep|bone)|bitter\s+cold|\bexposed\b|\bisolat/i, mood: 'cold' },
];

// ── MOOD inference from overall paragraph tone ──

function inferMood(text: string): string | null {
  const lower = text.toLowerCase();
  if (/combat|attack|sword|fight|blood|wound|strike|slash|venin|corrupt|threat|danger|scream/.test(lower)) return 'danger';
  if (/death|die|fallen|corpse|mourn|grief|loss|gone|never\s+again/.test(lower)) return 'grief';
  if (/victory|triumph|succeed|overcome|celebrate|cheer/.test(lower)) return 'triumph';
  if (/tavern|fire|warm|safe|rest|comfort|laugh|friend|campfire/.test(lower)) return 'warm';
  if (/cold|frost|ice|snow|bitter|exposed|alone|isolat/.test(lower)) return 'cold';
  if (/dark|shadow|silence|dread|fear|uneasy|wrong|ominous|creep/.test(lower)) return 'dark';
  return null;
}

// ── AMBIENCE inference from overall paragraph context ──

function inferAmbience(text: string): string | null {
  const lower = text.toLowerCase();
  if (/rain|storm|downpour|thunder/.test(lower)) return 'rain';
  if (/wind|gust|gale|breeze/.test(lower)) return 'wind';
  if (/tavern|inn|bar|mess\s+hall|drink/.test(lower)) return 'tavern';
  if (/forest|wood|tree|grove|clearing/.test(lower)) return 'forest';
  if (/dungeon|cave|tunnel|underground|catacomb/.test(lower)) return 'dungeon';
  if (/campfire|camp|fireside|hearth/.test(lower)) return 'campfire';
  if (/crowd|market|gathering|plaza|square|audience/.test(lower)) return 'crowd';
  if (/fly|soar|dive|aerial|sky|above\s+the\s+cloud/.test(lower)) return 'flying';
  if (/combat|fight|battle|clash|charge|initiative/.test(lower)) return 'combat-drums';
  if (/tension|dread|silence|wrong|uneasy|ominous|void|venin/.test(lower)) return 'tension-drone';
  return null;
}

// ── Main auto-tag function ──

/**
 * Scans raw DM response content and injects cinematic tags for any
 * paragraph that is missing them. Preserves any tags the AI did emit.
 */
export function autoTagResponse(rawContent: string): string {
  const blocks = rawContent.split('\n\n');
  const result: string[] = [];
  let lastMood: string | null = null;
  let lastAmbience: string | null = null;
  let isFirstTextBlock = true;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) { result.push(''); continue; }

    // Check what tags already exist on this block
    const existingSfx = block.match(/<!--SFX:.+?-->/g) || [];
    const existingVfx = block.match(/<!--VFX:.+?-->/g) || [];
    const existingMood = block.match(/<!--MOOD:.+?-->/);
    const existingAmbience = block.match(/<!--AMBIENCE:.+?-->/);

    // Get clean text for keyword scanning
    const cleanText = block.replace(/<!--(?:SFX|AMBIENCE|VFX|MOOD|MUSIC):.+?-->/g, '').trim();
    if (!cleanText) { result.push(block); continue; }

    const tagsToAdd: string[] = [];

    // Scan paragraph against all rules
    const matchedSfx = new Set<string>();
    const matchedVfx = new Set<string>();
    let matchedMood: string | null = null;
    let matchedAmbience: string | null = null;

    for (const rule of PARAGRAPH_RULES) {
      if (rule.patterns.test(cleanText)) {
        if (rule.sfx) matchedSfx.add(rule.sfx);
        if (rule.vfx) rule.vfx.forEach(v => matchedVfx.add(v));
        if (rule.mood && !matchedMood) matchedMood = rule.mood;
        if (rule.ambience && !matchedAmbience) matchedAmbience = rule.ambience;
      }
    }

    // Infer mood and ambience if rules didn't match but context suggests them
    if (!matchedMood) matchedMood = inferMood(cleanText);
    if (!matchedAmbience) matchedAmbience = inferAmbience(cleanText);

    // First text paragraph: always inject AMBIENCE and MOOD if missing
    if (isFirstTextBlock) {
      if (!existingAmbience && matchedAmbience) {
        tagsToAdd.push(`<!--AMBIENCE:${matchedAmbience}-->`);
        lastAmbience = matchedAmbience;
      }
      if (!existingMood) {
        const mood = matchedMood || 'neutral';
        tagsToAdd.push(`<!--MOOD:${mood}-->`);
        lastMood = mood;
      }
      isFirstTextBlock = false;
    } else {
      // Subsequent paragraphs: only inject MOOD/AMBIENCE if they changed
      if (!existingMood && matchedMood && matchedMood !== lastMood) {
        tagsToAdd.push(`<!--MOOD:${matchedMood}-->`);
        lastMood = matchedMood;
      }
      if (!existingAmbience && matchedAmbience && matchedAmbience !== lastAmbience) {
        tagsToAdd.push(`<!--AMBIENCE:${matchedAmbience}-->`);
        lastAmbience = matchedAmbience;
      }
    }

    // Add SFX if the AI didn't already tag any for this paragraph (skip first paragraph)
    if (!isFirstTextBlock || i > 0) {
      if (existingSfx.length === 0) {
        for (const sfx of matchedSfx) {
          tagsToAdd.push(`<!--SFX:${sfx}-->`);
        }
      }
    }

    // Add VFX if the AI didn't already tag any for this paragraph
    if (existingVfx.length === 0) {
      for (const vfx of matchedVfx) {
        tagsToAdd.push(`<!--VFX:${vfx}-->`);
      }
    }

    // Prepend tags to the block
    if (tagsToAdd.length > 0) {
      result.push(tagsToAdd.join('') + '\n' + block);
    } else {
      result.push(block);
    }
  }

  return result.join('\n\n');
}
