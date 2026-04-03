/**
 * Cinematic Auto-Tagger V2
 *
 * Scans DM response paragraphs and injects cinematic tags based on keyword analysis.
 * Does NOT depend on the AI emitting tags. Works for both Solo and Party mode.
 *
 * Design principles:
 * - BE GENEROUS. More effects = more cinematic. Silence is only used deliberately.
 * - Preserve any tags the AI did emit. Only ADD missing tags.
 * - First paragraph always gets AMBIENCE + MOOD.
 * - Every paragraph gets MOOD if one can be inferred.
 * - SFX fire on action moments. VFX stack for big impacts.
 * - Empyrean-specific vocabulary gets premium treatment.
 */

// ── SFX TRIGGER RULES ──────────────────────────────────────────────────

interface SfxRule {
  pattern: RegExp;
  sfx: string;
  /** Higher priority overrides lower for the same SFX slot */
  priority?: number;
}

const SFX_RULES: SfxRule[] = [
  // DRAGON — very generous, dragons are the star
  { pattern: /\bdragon|tairn|andarna|sgaeyl|codagh/i, sfx: 'dragon-roar', priority: 1 },
  { pattern: /\bwing(?:s)?\s*(?:fold|spread|flare|beat|snap|open|tuck|extend|unfurl)/i, sfx: 'dragon-roar' },
  { pattern: /\bdragon.*(?:land|roar|snarl|growl|shriek|bellow|scream|screech|hiss|rumbl|snort)/i, sfx: 'dragon-roar', priority: 2 },
  { pattern: /\bclaws?\s*(?:goug|dig|scor|tear|scrape|rake|click|flex|extend)/i, sfx: 'dragon-roar' },
  { pattern: /\btail\s*(?:lash|whip|slam|sweep|curl|coil|thrash|flick)/i, sfx: 'dragon-roar' },
  { pattern: /\bscales?\s*(?:shift|shimmer|rattle|ripple|glow|darken|brighten|heat)/i, sfx: 'dragon-roar' },
  { pattern: /\bdragon\s*fire|\bfire\s*breath|\bflame.*(?:erupt|burst|pour|stream|jet)|inferno/i, sfx: 'fire-whoosh', priority: 3 },
  { pattern: /\bmassive\s*(?:head|form|body|shape|shadow|wing)|enormous\s*(?:dragon|beast|creature)/i, sfx: 'dragon-roar' },

  // MELEE COMBAT
  { pattern: /\bsword|blade|steel|dagger|axe|mace|hammer|spear|pike|halberd|glaive|rapier|scimitar|longsword|greatsword/i, sfx: 'sword-clash' },
  { pattern: /\bclash|parr(?:y|ied)|block(?:ed)?|deflect|riposte|lunge|thrust|swing|slash|strike|cut(?:s|ting)?|slice|stab|cleave/i, sfx: 'sword-clash' },
  { pattern: /\bsteel\s*(?:on|meets|against|ring|sing|screech|scrape)/i, sfx: 'sword-clash', priority: 2 },
  { pattern: /\bweapon.*(?:connect|impact|hit|land|strike|draw|raise|ready)/i, sfx: 'sword-clash' },
  { pattern: /\bfist|punch|kick|elbow|knee|headbutt|grappl|tackl|slam(?:s|med)?.*(?:into|against|down)/i, sfx: 'sword-clash' },

  // RANGED
  { pattern: /\barrow|bolt|crossbow|bow\s*string|quiver|shaft|fletching/i, sfx: 'arrow-impact' },
  { pattern: /\barrow.*(?:hit|strike|thud|impact|slam|pierc|embed|whiz|fly|loose|fire|nock|draw)/i, sfx: 'arrow-impact', priority: 2 },
  { pattern: /\bthunk\b|(?:arrow|bolt).*(?:find|bury|buried|lodge)/i, sfx: 'arrow-impact' },

  // EXPLOSIONS
  { pattern: /\bexplo(?:sion|de)|detonat|(?:massive|huge|enormous)\s*blast|\bbomb\b|erupt(?:s|ed|ion)/i, sfx: 'explosion', priority: 3 },
  { pattern: /\bshatter(?:s|ed|ing)?.*(?:glass|crystal|stone|wall|ward|barrier|shield)/i, sfx: 'explosion' },
  { pattern: /\bcollaps(?:e|es|ed|ing).*(?:wall|ceiling|floor|tower|building|structure|bridge)/i, sfx: 'explosion' },
  { pattern: /\bcrumbl(?:e|es|ed|ing)|cave(?:\s*|-)?in/i, sfx: 'explosion' },

  // BONE/BODY HORROR
  { pattern: /\bbone.*(?:snap|crack|break|shatter|crunch|splinter)|(?:snap|crack|break|crunch).*bone/i, sfx: 'bone-snap', priority: 2 },
  { pattern: /\bsicken(?:ing)?\s*(?:crack|snap|crunch|pop|twist)|neck\s*(?:snap|crack|twist|break)/i, sfx: 'bone-snap', priority: 3 },
  { pattern: /\bjoint.*(?:pop|dislocat|twist|wrench)|limb.*(?:bend|twist|snap|break|wrench|dislocat)/i, sfx: 'bone-snap' },
  { pattern: /\bcrunch\b.*(?:bone|cartilage|skull|rib|spine)/i, sfx: 'bone-snap', priority: 2 },

  // FIRE
  { pattern: /\bfire\s*(?:erupt|burst|roar|spread|blaz|crack|engulf|consum|ignit)/i, sfx: 'fire-whoosh' },
  { pattern: /\bflame(?:s)?\s*(?:erupt|burst|lick|danc|spread|engulf|leap|climb|consum|ignit)/i, sfx: 'fire-whoosh' },
  { pattern: /\bablaze\b|(?:catch|caught)\s*(?:on\s*)?fire|\binferno\b|\bpyre\b|\bbonfire\b/i, sfx: 'fire-whoosh' },
  { pattern: /\btorch(?:es|ed|light)?.*(?:flick|flare|ignit|catch|light|burn|glow)/i, sfx: 'fire-whoosh' },

  // THUNDER / STORMS
  { pattern: /\bthunder(?:\s*clap|\s*crack|\s*boom|\s*roll|\s*rumbl|storm|ous|ing|\b)/i, sfx: 'thunder', priority: 2 },
  { pattern: /\blightning\s*(?:strike|flash|split|crack|bolt|arc|fork|sear|illum)/i, sfx: 'thunder', priority: 2 },
  { pattern: /\bsky\s*(?:split|crack|tear|open|shatter|flash|light\s*up)/i, sfx: 'thunder' },

  // DOORS / STRUCTURES
  { pattern: /\bdoor\s*(?:creak|groan|swing|open|slam|burst|bang|scrape|rattle|unlock|creak)/i, sfx: 'door-creak' },
  { pattern: /\bgate\s*(?:creak|groan|open|swing|rais|lower|clang|shut|slam)/i, sfx: 'door-creak' },
  { pattern: /\bporticull|drawbridge|hatch|trapdoor|grate.*(?:open|lift|slide|scrape)/i, sfx: 'door-creak' },
  { pattern: /\bhinge(?:s)?\s*(?:creak|groan|protest|squeal|screech|rust)/i, sfx: 'door-creak' },

  // BELLS
  { pattern: /\bbell\s*(?:toll|ring|chime|peal|sound|echo|clang)|(?:toll|ring|chime|peal)\s*(?:of|from)\s*(?:a\s*)?bell/i, sfx: 'bell-toll' },
  { pattern: /\balarm\s*(?:bell|sound|ring|blare)|warning\s*(?:bell|chime)/i, sfx: 'bell-toll' },

  // HORSES / MOUNTS
  { pattern: /\bhorse|mount|steed|stallion|mare|charger|destrier/i, sfx: 'horse-gallop' },
  { pattern: /\bhoofbeat|gallop|canter|trot.*(?:approach|thund|echo|fade|grow)/i, sfx: 'horse-gallop', priority: 2 },
  { pattern: /\brid(?:e|es|ing|ers?)\s*(?:hard|fast|full|toward|away|out|through|into)/i, sfx: 'horse-gallop' },

  // WHISPERS / QUIET
  { pattern: /\bwhisper(?:s|ed|ing)?\b/i, sfx: 'whisper' },
  { pattern: /\bmurmur(?:s|ed|ing)?|mutter(?:s|ed|ing)?|hiss(?:es|ed|ing)?\s*(?:a\s*)?(?:word|warning|name|threat)/i, sfx: 'whisper' },
  { pattern: /\bunder\s*(?:his|her|their|your)\s*breath|barely\s*audible|voice.*(?:drop|low|quiet|hush|soft)/i, sfx: 'whisper' },

  // CROWD REACTIONS
  { pattern: /\bcrowd\s*(?:gasp|scream|roar|shout|murmur|erupt|react|surge|cheer|jeer|fall\s*silent)/i, sfx: 'crowd-gasp' },
  { pattern: /\b(?:collective|sharp|audible|stunned)\s*(?:gasp|inhale|intake|silence|hush)/i, sfx: 'crowd-gasp' },
  { pattern: /\b(?:gasp|shock|horror|disbelief|outrage)\s*(?:rippl|spread|fill|sweep|run)/i, sfx: 'crowd-gasp' },
  { pattern: /\beveryone\s*(?:freeze|stop|stare|watch|turn|fall\s*silent|go\s*quiet)/i, sfx: 'crowd-gasp' },

  // HEARTBEAT / TENSION
  { pattern: /\bheartbeat\b|\bheart\s*(?:pound|race|hammer|slam|thud|skip|stop|lurch|stutter)/i, sfx: 'heartbeat', priority: 2 },
  { pattern: /\bpulse\s*(?:in|through|beneath|under|quicken|spike|surge|race|throb|thunder)/i, sfx: 'heartbeat' },
  { pattern: /\bblood\s*(?:pound|rush|roar|surge)\s*(?:in|through)/i, sfx: 'heartbeat' },
  { pattern: /\badrenaline\s*(?:spike|surge|flood|dump|kick|hit)/i, sfx: 'heartbeat' },

  // MAGIC / SIGNETS (Empyrean-specific)
  { pattern: /\bsignet\b/i, sfx: 'signet-crackle' },
  { pattern: /\brelic\s*(?:glow|pulse|burn|heat|flare|warm|tingle|ache|throb|sear|crackle)/i, sfx: 'signet-crackle', priority: 2 },
  { pattern: /\bchannel(?:s|ed|ing)?\s*(?:magic|power|energy|signet|mana)/i, sfx: 'signet-crackle' },
  { pattern: /\bmagic.*(?:surge|flare|crackle|pulse|glow|build|gather|swell|release)/i, sfx: 'signet-crackle' },
  { pattern: /\bpower\s*(?:surge|build|gather|swell|crackle|pulse|flow|release|erupt)\s*(?:through|from|within|inside)/i, sfx: 'signet-crackle' },
  { pattern: /\bspell\b.*(?:cast|hurl|release|weave|channel|form|shap)/i, sfx: 'signet-crackle' },
  { pattern: /\barcane|enchant|incantation|conjur|evocation|transmut|divination|abjur/i, sfx: 'signet-crackle' },

  // WARDS (Empyrean-specific)
  { pattern: /\bward\b(?:\s*line)?.*(?:hum|shimmer|flicker|pulse|glow|activat|hold|crack|fall|fail|break|weaken|strain|buckle|surge|repair|strengthen|stabiliz)/i, sfx: 'ward-hum', priority: 2 },
  { pattern: /\bward(?:'s|\s+line)?\b/i, sfx: 'ward-hum' },
  { pattern: /\bbarrier\s*(?:shimmer|pulse|flicker|crack|hold|fall|glow)/i, sfx: 'ward-hum' },
  { pattern: /\bprotective\s*(?:shield|ward|barrier|dome|field)/i, sfx: 'ward-hum' },
];

// ── VFX TRIGGER RULES ──────────────────────────────────────────────────

interface VfxRule {
  pattern: RegExp;
  vfx: string[];
}

const VFX_RULES: VfxRule[] = [
  // SCREEN SHAKE — physical impacts, heavy landings, explosions, hits
  { pattern: /\bland(?:s|ed|ing)\s*(?:behind|beside|before|heavily|hard|with\s*(?:a\s*)?(?:thud|crash|boom|impact))/i, vfx: ['screen-shake'] },
  { pattern: /\bexplo(?:sion|de)|detonat|(?:massive|huge|enormous)\s*(?:blast|impact|crash)/i, vfx: ['screen-shake', 'flash-white'] },
  { pattern: /\bcollaps|crumbl|cave\s*in|toppl|crash(?:es|ed|ing)?\s*(?:down|through|into)/i, vfx: ['screen-shake'] },
  { pattern: /\bground\s*(?:shake|tremble|split|crack|pulse|rumble|vibrat|quake|shudder|heave|buckle)/i, vfx: ['ground-pulse', 'screen-shake'] },
  { pattern: /\bearth\s*(?:shake|tremble|split|quake|shudder|heave|buckle|crack|open)/i, vfx: ['ground-pulse', 'screen-shake'] },
  { pattern: /\bimpact\s*(?:send|knock|throw|hurl|slam)|(?:send|knock|throw|hurl).*(?:flying|sprawl|tumbl)/i, vfx: ['screen-shake'] },
  { pattern: /\bshock\s*wave|concussive|(?:hit|struck|slam)\s*(?:the\s*)?(?:ground|wall|floor)/i, vfx: ['screen-shake'] },
  { pattern: /\bthunder(?:\s*clap|\s*crack|\s*boom)/i, vfx: ['screen-shake', 'lightning'] },
  { pattern: /\bdragon.*land|claws?\s*goug/i, vfx: ['screen-shake'] },
  { pattern: /\bsword.*clash|steel.*(?:on|meets)\s*steel|blades?\s*(?:connect|lock|ring)/i, vfx: ['screen-shake'] },

  // RAIN
  { pattern: /\brain\s*(?:fall|pour|pelt|drum|hammer|beat|start|begin|lash|soak|drench|sting)/i, vfx: ['rain'] },
  { pattern: /\bdownpour|deluge|\braining\b|(?:heavy|driving|cold|icy|freezing)\s*rain/i, vfx: ['rain'] },

  // EMBERS — fire, burnout, heat, destruction aftermath
  { pattern: /\bfire|flame|blaz|burn(?:ing|t|s)?|inferno|pyre|ash(?:es)?|cinder|ember|smolder|scorch/i, vfx: ['embers'] },
  { pattern: /\bburnout\b|signet\s*strain|veins?\s*(?:glow|burn|light|pulse|sear)/i, vfx: ['embers'] },
  { pattern: /\bheat\s*(?:shimmer|wave|radiat|blast|wash|pour|build|intensif|sear|scorch)/i, vfx: ['embers'] },
  { pattern: /\bdestruction|devastat|ruin|wreckage|rubble|aftermath.*(?:fire|burn|smolder)/i, vfx: ['embers'] },
  { pattern: /\bdragon\s*fire|\bfire\s*breath/i, vfx: ['embers', 'screen-shake'] },

  // LIGHTNING — storms, electrical
  { pattern: /\blightning\b/i, vfx: ['lightning'] },
  { pattern: /\bstorm.*(?:rage|break|intensif|build|approach|overhead)/i, vfx: ['lightning', 'rain'] },
  { pattern: /\belectric(?:al|ity)?|(?:arc|bolt|spark)\s*(?:of\s*)?(?:light|energy|power)/i, vfx: ['lightning'] },
  { pattern: /\bsky\s*(?:flash|light\s*up|split|crack|strobe)/i, vfx: ['lightning'] },

  // GROUND PULSE — underground threats, venin, seismic
  { pattern: /\bbeneath\s*(?:the\s*)?(?:surface|ground|earth|feet|floor)|under(?:neath|ground)\s*(?:something|threat|presence|movement)/i, vfx: ['ground-pulse'] },
  { pattern: /\bvenin\b|\bcorrupt(?:ion|ed)?\b|\btaint(?:ed)?\b|\bvoid\b.*(?:presenc|power|energy|spread|creep|reach)/i, vfx: ['ground-pulse'] },
  { pattern: /\bwarm\s*(?:ground|earth|stone|floor)|ground.*(?:radiat|pulse|throb|warm|glow|heat)/i, vfx: ['ground-pulse'] },
  { pattern: /\bseismic|tremor|quake/i, vfx: ['ground-pulse', 'screen-shake'] },

  // FLASH WHITE — blinding light, signet detonation, sudden impact
  { pattern: /\bblind(?:ing)?\s*(?:light|flash|flare|white|bright)|flash\s*(?:of\s*)?(?:white|light|bright)/i, vfx: ['flash-white'] },
  { pattern: /\bsignet.*(?:detonate|explode|overload|flare|burst)|(?:detonate|explode|overload).*signet/i, vfx: ['flash-white', 'screen-shake'] },
  { pattern: /\blight\s*(?:explode|erupt|burst|detonate|blind|sear|flash|flare)\s*(?:outward|across|through|from)/i, vfx: ['flash-white'] },

  // FADE TO BLACK — unconsciousness, scene transitions, blackouts
  { pattern: /\b(?:world|vision|consciousness|everything|sight)\s*(?:go(?:es)?|fade|slip|dim|darken|blur|tunnel|narrow).*(?:black|dark|away|nothing)/i, vfx: ['fade-to-black'] },
  { pattern: /\bblack(?:ness|out)?\s*(?:claim|take|swallow|engulf|close|descend)/i, vfx: ['fade-to-black'] },
  { pattern: /\blose\s*consciousness|pass(?:es|ed)?\s*out|faint(?:s|ed)?/i, vfx: ['fade-to-black'] },

  // BLOOD VIGNETTE — damage, pain, injury
  { pattern: /\bblood\s*(?:spray|spill|pour|pool|flow|drip|seep|run|splatter|bloom|blossom|well|stain)/i, vfx: ['blood-vignette'] },
  { pattern: /\bpain\s*(?:flare|spike|shoot|lance|explode|bloom|white-hot|blind|sear|stab|radiat|erupt)/i, vfx: ['blood-vignette'] },
  { pattern: /\bwound(?:ed)?|gash|lacerat|bleed(?:ing)?|injur(?:y|ed)|hurt\b.*(?:bad|deep|serious|critical)/i, vfx: ['blood-vignette'] },
  { pattern: /\bstab(?:bed)?|slash(?:ed)?|cut\s*(?:deep|open|across|through)|gash|lacerat/i, vfx: ['blood-vignette'] },
  { pattern: /\btakes?\s*(?:a\s*)?(?:hit|blow|slash|cut|stab|wound|damage)|(?:hit|blow|slash)\s*(?:connect|land)/i, vfx: ['blood-vignette'] },
  { pattern: /\bbone.*(?:snap|crack|break)/i, vfx: ['blood-vignette'] },

  // FROST — cold, ice, winter
  { pattern: /\bfrost\s*(?:spread|creep|form|coat|cover|crack|pattern|bloom|crystal)/i, vfx: ['frost'] },
  { pattern: /\bice\s*(?:form|spread|crack|shatter|coat|encase|crystalliz|creep|crawl)/i, vfx: ['frost'] },
  { pattern: /\bfrozen\b|\bfreezing\b|\bfrostbite\b|\bglacial\b/i, vfx: ['frost'] },
  { pattern: /\bbreath\s*(?:mist|fog|frost|cloud|visible|plume|puff)\s*(?:in|from|before)/i, vfx: ['frost'] },

  // GOLD PARTICLES — magic, triumph, signet power, bond moments, beauty
  { pattern: /\bsignet\s*(?:flare|activat|pulse|crackle|glow|surge|blaze|shine|ignit)/i, vfx: ['gold-particles'] },
  { pattern: /\bgold(?:en)?\s*(?:light|glow|shimmer|particle|spark|dust|mote|fleck|aura)/i, vfx: ['gold-particles'] },
  { pattern: /\bbond\s*(?:flare|pulse|sing|warm|surge|deepen|ignit|strengthen|solidif)/i, vfx: ['gold-particles'] },
  { pattern: /\bvictory|triumph|succeed|overcome|prevail|conquer/i, vfx: ['gold-particles'] },
  { pattern: /\bbeautiful|magnificent|glorious|majestic|awe.*(?:inspir|strik|struck)/i, vfx: ['gold-particles'] },
  { pattern: /\bmagic.*(?:shimmer|glow|sparkle|dance|swirl|pulse|radiat)/i, vfx: ['gold-particles'] },
  { pattern: /\bdragon.*(?:bond|chose|choose|accept|acknowledg)/i, vfx: ['gold-particles'] },
];

// ── MOOD INFERENCE ──────────────────────────────────────────────────────

interface MoodRule {
  pattern: RegExp;
  mood: string;
  weight: number;
}

const MOOD_RULES: MoodRule[] = [
  // DANGER — highest priority combat/threat signals
  { pattern: /\bcombat|attack|fight|battle|clash|charge|initiative|engage/i, mood: 'danger', weight: 10 },
  { pattern: /\bvenin\b|corrupt(?:ion|ed)?|taint(?:ed)?|void\b.*(?:presenc|power|energy)/i, mood: 'danger', weight: 10 },
  { pattern: /\bsword|blade|weapon|arrow|spear|axe|shield\s*(?:rais|draw|ready)/i, mood: 'danger', weight: 7 },
  { pattern: /\bblood|wound|pain|scream|agony|hurt|injur|suffer/i, mood: 'danger', weight: 8 },
  { pattern: /\bthreat|danger|peril|lethal|deadly|fatal|kill|murder|slay/i, mood: 'danger', weight: 9 },
  { pattern: /\bburnout\b|signet\s*strain|veins?\s*glow/i, mood: 'danger', weight: 8 },
  { pattern: /\bexplo(?:sion|de)|detonat|blast|shatter/i, mood: 'danger', weight: 9 },
  { pattern: /\brun\b|flee|escape|retreat|ambush|trap\b/i, mood: 'danger', weight: 6 },
  { pattern: /\bscream|shriek|cry\s*out|howl\s*(?:of|in|with)/i, mood: 'danger', weight: 7 },

  // GRIEF
  { pattern: /\bdead\b|death|fallen|die(?:s|d)?|corpse|body\s*(?:lie|lay|fall|crumple|still)/i, mood: 'grief', weight: 10 },
  { pattern: /\bmourn|grief|sorrow|loss|gone\s*forever|never\s*(?:again|return|come\s*back)/i, mood: 'grief', weight: 9 },
  { pattern: /\btear(?:s)?\s*(?:fall|stream|roll|slide|spill|well|blur|sting)/i, mood: 'grief', weight: 7 },
  { pattern: /\bfuneral|burial|memorial|grave|tomb|pyre.*(?:burn|light)/i, mood: 'grief', weight: 9 },
  { pattern: /\bsacrifice(?:d)?|gave\s*(?:their|his|her)\s*life/i, mood: 'grief', weight: 8 },
  { pattern: /\bremember(?:ing)?.*(?:fallen|dead|lost|gone)|in\s*memory\s*of/i, mood: 'grief', weight: 7 },

  // TRIUMPH
  { pattern: /\bvictory|triumph|win\b|won\b|succeed|overcome|prevail|conquer/i, mood: 'triumph', weight: 9 },
  { pattern: /\bcheer(?:s|ing)?|celebrat|rejoic|exult|elat/i, mood: 'triumph', weight: 7 },
  { pattern: /\bdefeat(?:s|ed)?\s*(?:the|their|every|all)|vanquish|destroy(?:s|ed)?\s*(?:the|their)/i, mood: 'triumph', weight: 8 },
  { pattern: /\bsurviv(?:e|ed|al)|made\s*it|pull(?:ed)?\s*through|alive\b.*(?:still|somehow)/i, mood: 'triumph', weight: 6 },
  { pattern: /\bprove(?:d|n)?\s*(?:worthy|themselves|yourself|himself|herself)/i, mood: 'triumph', weight: 7 },

  // WARM
  { pattern: /\btavern|inn\b|hearth|fireside|campfire|fireplace|ale\b|mead\b|drink/i, mood: 'warm', weight: 7 },
  { pattern: /\bsafe(?:ty)?|comfort|relief|rest(?:ing)?|peace(?:ful)?|calm(?:ly)?|serene/i, mood: 'warm', weight: 6 },
  { pattern: /\bwarm(?:th)?|cozy|gentle|soft\s*(?:light|glow|smile|voice|touch)/i, mood: 'warm', weight: 7 },
  { pattern: /\bfriend|companion|together|trust|loyal|bond(?:ed)?|care|love|embrace|hug/i, mood: 'warm', weight: 5 },
  { pattern: /\blaugh(?:ter|s|ing)?|smile(?:s|d)?|grin(?:s|ned)?|chuckl/i, mood: 'warm', weight: 5 },
  { pattern: /\bcamp\b.*(?:set|make|sit|gather|around)|fire.*(?:crack|warm|glow)/i, mood: 'warm', weight: 7 },

  // COLD
  { pattern: /\bcold\b.*(?:bit|cut|seep|creep|bone|deep|bitter|biting|harsh|brutal)/i, mood: 'cold', weight: 8 },
  { pattern: /\bfrost|ice|frozen|freezing|glacial|arctic|winter|snow|blizzard/i, mood: 'cold', weight: 7 },
  { pattern: /\bexposed|isolat|alone|abandon|desolat|barren|empty|void|hollow/i, mood: 'cold', weight: 6 },
  { pattern: /\bnumb(?:ness)?|shiver|trembl(?:e|ing)?\s*(?:from|with)\s*(?:cold|chill)/i, mood: 'cold', weight: 7 },

  // DARK — dread, mystery, creeping horror
  { pattern: /\bdark(?:ness|en|ened)?|shadow(?:s|y)?|gloom|murk|black(?:ness)?/i, mood: 'dark', weight: 5 },
  { pattern: /\bdread|fear|terror|horror|nightmar|creep(?:ing)?|uneasy|uneas(?:iness|y)/i, mood: 'dark', weight: 7 },
  { pattern: /\bsilence\b.*(?:press|fall|descend|settle|hang|stretch|deafen|absolute|complete|eerie)/i, mood: 'dark', weight: 8 },
  { pattern: /\bwrong\b|ominous|forebod|sinister|menac|malevolent|evil\b/i, mood: 'dark', weight: 7 },
  { pattern: /\bsomething\s*(?:is\s*)?(?:deeply\s*)?(?:wrong|off|different|changed|watching)/i, mood: 'dark', weight: 8 },
  { pattern: /\bwatch(?:ing|es)?\s*(?:from|in)\s*(?:the\s*)?(?:dark|shadow|corner|tree|distance)/i, mood: 'dark', weight: 6 },
  { pattern: /\beyes?\s*(?:in|from|watch|glow|gleam|peer)\s*(?:the\s*)?(?:dark|shadow)/i, mood: 'dark', weight: 7 },
  { pattern: /\bhair.*(?:stand|rise|prickle)|(?:chill|shiver).*(?:down|up).*spine/i, mood: 'dark', weight: 6 },

  // NEUTRAL — fallback hints
  { pattern: /\bwalk(?:s|ed|ing)?|travel|journey|path|road|corridor|hall(?:way)?/i, mood: 'neutral', weight: 2 },
  { pattern: /\bmorning|dawn|sunrise|afternoon|class|training|lecture|lesson|briefing/i, mood: 'neutral', weight: 3 },
];

function inferMood(text: string): string {
  const scores: Record<string, number> = {};
  for (const rule of MOOD_RULES) {
    if (rule.pattern.test(text)) {
      scores[rule.mood] = (scores[rule.mood] || 0) + rule.weight;
    }
  }
  let best = 'neutral';
  let bestScore = 0;
  for (const [mood, score] of Object.entries(scores)) {
    if (score > bestScore) { best = mood; bestScore = score; }
  }
  return best;
}

// ── AMBIENCE INFERENCE ──────────────────────────────────────────────────

interface AmbienceRule {
  pattern: RegExp;
  ambience: string;
  weight: number;
}

const AMBIENCE_RULES: AmbienceRule[] = [
  // Weather — high priority
  { pattern: /\brain|storm|downpour|deluge|raining|drizzl/i, ambience: 'rain', weight: 10 },
  { pattern: /\bwind\s*(?:howl|gust|whip|scream|roar|blast|buffet|whistle|moan)|gale|windswept|gusting/i, ambience: 'wind', weight: 9 },

  // Environments
  { pattern: /\btavern|inn\b|bar(?:keep|tend)|mess\s*hall|pub\b|alehouse|drink.*(?:order|pour|raise)/i, ambience: 'tavern', weight: 8 },
  { pattern: /\bforest|wood(?:s|land)|tree(?:s|line)|grove|clearing|canopy|underbrush|thicket/i, ambience: 'forest', weight: 7 },
  { pattern: /\bdungeon|cave|tunnel|underground|catacomb|crypt|cellar|vault|subterranean|cavern/i, ambience: 'dungeon', weight: 8 },
  { pattern: /\bcamp(?:fire|site)?.*(?:crack|warm|flame|glow|sit|gather|set\s*up|make)|fireside|around\s*(?:the\s*)?(?:fire|flame)/i, ambience: 'campfire', weight: 8 },
  { pattern: /\bcrowd|market(?:place)?|plaza|square|gathering\s*hall|arena|colosseum|audience|spectator/i, ambience: 'crowd', weight: 7 },
  { pattern: /\bfly(?:ing)?|soar(?:ing)?|dive|aerial|above\s*the\s*cloud|altitude|airborne|in\s*the\s*(?:sky|air)/i, ambience: 'flying', weight: 9 },

  // Combat
  { pattern: /\bcombat|battle\s*(?:begin|start|rage|erupt|join|engage)|initiative|fight(?:ing)?\s*(?:break|begin|erupt|start)/i, ambience: 'combat-drums', weight: 9 },
  { pattern: /\bclash\s*(?:of|between)|battlefield|war\s*(?:zone|ground|front|cry)|skirmish|melee\s*(?:begin|erupt)/i, ambience: 'combat-drums', weight: 8 },
  { pattern: /\bcharge(?:s|d)?\s*(?:at|toward|forward|into|the\s*line)/i, ambience: 'combat-drums', weight: 7 },

  // Tension
  { pattern: /\btension|dread|uneasy|ominous|forebod|wrong|menac|sinister|creep(?:ing)?|stalk/i, ambience: 'tension-drone', weight: 7 },
  { pattern: /\bvenin|corrupt(?:ion|ed)?|taint(?:ed)?|void\b|wither|drain|decay/i, ambience: 'tension-drone', weight: 9 },
  { pattern: /\bsilence\b.*(?:press|fall|descend|settle|deafen|eerie|complete|absolute|dead|heavy)/i, ambience: 'silence', weight: 10 },
  { pattern: /\bsound.*(?:stop|die|cease|vanish|disappear|drain|gone)|all\s*(?:sound|noise)\s*(?:stop|cease|gone|disappear)/i, ambience: 'silence', weight: 10 },
  { pattern: /\bstill(?:ness)?|hush(?:ed)?|quiet(?:ly)?.*(?:descend|fall|settle)/i, ambience: 'silence', weight: 6 },

  // Wind as default outdoor
  { pattern: /\boutside|exterior|open\s*(?:air|sky|ground|field)|rooftop|battlement|parapet|wall\s*walk/i, ambience: 'wind', weight: 4 },
  { pattern: /\bbasgiath|courtyard|training\s*(?:ground|yard|field|ring|pit)|sparring/i, ambience: 'wind', weight: 3 },
];

function inferAmbience(text: string): string | null {
  const scores: Record<string, number> = {};
  for (const rule of AMBIENCE_RULES) {
    if (rule.pattern.test(text)) {
      scores[rule.ambience] = (scores[rule.ambience] || 0) + rule.weight;
    }
  }
  let best: string | null = null;
  let bestScore = 0;
  for (const [amb, score] of Object.entries(scores)) {
    if (score > bestScore) { best = amb; bestScore = score; }
  }
  return best;
}

// ── MAIN AUTO-TAG FUNCTION ──────────────────────────────────────────────

export function autoTagResponse(rawContent: string): string {
  const blocks = rawContent.split('\n\n');
  const result: string[] = [];
  let lastMood: string | null = null;
  let lastAmbience: string | null = null;
  let paragraphIndex = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) { result.push(''); continue; }

    // Check existing tags on this block
    const hasAnySfx = /<!--SFX:.+?-->/.test(block);
    const hasAnyVfx = /<!--VFX:.+?-->/.test(block);
    const hasAnyMood = /<!--MOOD:.+?-->/.test(block);
    const hasAnyAmbience = /<!--AMBIENCE:.+?-->/.test(block);

    // Get clean text for scanning (strip existing tags)
    const cleanText = block.replace(/<!--(?:SFX|AMBIENCE|VFX|MOOD|MUSIC):.+?-->/g, '').trim();
    if (!cleanText) { result.push(block); continue; }

    const tagsToAdd: string[] = [];
    const isFirstParagraph = paragraphIndex === 0;
    const isDialogue = /^[""\u201C]/.test(cleanText);

    // ── MOOD ──
    if (!hasAnyMood) {
      const mood = inferMood(cleanText);
      if (isFirstParagraph) {
        // First paragraph always gets mood
        tagsToAdd.push(`<!--MOOD:${mood}-->`);
        lastMood = mood;
      } else if (mood !== 'neutral' && mood !== lastMood) {
        // Subsequent: only inject if mood genuinely shifts
        tagsToAdd.push(`<!--MOOD:${mood}-->`);
        lastMood = mood;
      }
    } else {
      // Extract existing mood for tracking
      const existing = block.match(/<!--MOOD:(.+?)-->/);
      if (existing) lastMood = existing[1];
    }

    // ── AMBIENCE ──
    if (!hasAnyAmbience) {
      const ambience = inferAmbience(cleanText);
      if (isFirstParagraph && ambience) {
        tagsToAdd.push(`<!--AMBIENCE:${ambience}-->`);
        lastAmbience = ambience;
      } else if (isFirstParagraph && !ambience) {
        // Default first paragraph to wind (outdoor Basgiath default)
        tagsToAdd.push(`<!--AMBIENCE:wind-->`);
        lastAmbience = 'wind';
      } else if (ambience && ambience !== lastAmbience) {
        tagsToAdd.push(`<!--AMBIENCE:${ambience}-->`);
        lastAmbience = ambience;
      }
    } else {
      const existing = block.match(/<!--AMBIENCE:(.+?)-->/);
      if (existing) lastAmbience = existing[1];
    }

    // ── SFX ── (skip first paragraph to let opening line breathe, and be lighter on dialogue)
    if (!hasAnySfx && !isFirstParagraph) {
      const matchedSfx = new Set<string>();
      const sfxPriorities: Record<string, number> = {};
      for (const rule of SFX_RULES) {
        if (rule.pattern.test(cleanText)) {
          const p = rule.priority || 1;
          if (!sfxPriorities[rule.sfx] || p > sfxPriorities[rule.sfx]) {
            matchedSfx.add(rule.sfx);
            sfxPriorities[rule.sfx] = p;
          }
        }
      }
      // Cap at 2 SFX per paragraph to avoid chaos
      const sfxList = Array.from(matchedSfx).sort((a, b) => (sfxPriorities[b] || 0) - (sfxPriorities[a] || 0)).slice(0, 2);
      // Dialogue gets max 1 SFX
      const limit = isDialogue ? 1 : 2;
      for (const sfx of sfxList.slice(0, limit)) {
        tagsToAdd.push(`<!--SFX:${sfx}-->`);
      }
    }

    // ── VFX ── (generous but not on every paragraph)
    if (!hasAnyVfx) {
      const matchedVfx = new Set<string>();
      for (const rule of VFX_RULES) {
        if (rule.pattern.test(cleanText)) {
          for (const v of rule.vfx) matchedVfx.add(v);
        }
      }
      // Dialogue gets no VFX unless it's a truly dramatic moment
      if (isDialogue && matchedVfx.size > 0) {
        // Only keep blood-vignette or gold-particles for dialogue
        const allowed = new Set(['blood-vignette', 'gold-particles', 'fade-to-black']);
        for (const v of matchedVfx) {
          if (!allowed.has(v)) matchedVfx.delete(v);
        }
      }
      if (matchedVfx.size > 0) {
        // Combine into single VFX tag with + separator
        tagsToAdd.push(`<!--VFX:${Array.from(matchedVfx).join('+')}-->`);
      }
    }

    // Prepend tags
    if (tagsToAdd.length > 0) {
      result.push(tagsToAdd.join('') + '\n' + block);
    } else {
      result.push(block);
    }

    paragraphIndex++;
  }

  return result.join('\n\n');
}
