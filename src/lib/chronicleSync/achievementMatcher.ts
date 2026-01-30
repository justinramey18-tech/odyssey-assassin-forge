// Chronicle Sync Achievement Matcher
// Maps narrative phrases to 40 achievement category IDs

import { ConfidenceLevel, ParsedAchievementTrigger } from './types';

// Keyword mapping for all 40 achievements
// Each achievement has multiple trigger keywords/phrases
export const ACHIEVEMENT_KEYWORDS: Record<string, string[]> = {
  // SET 1: THE MERC WITH A MOUTH'S REGALIA
  'distract-enemies': [
    'distract', 'witty remark', 'taunt', 'mock the enemy', 'diversion',
    'banter', 'quip during combat', 'verbal jab', 'insult the enemy',
    'draw attention', 'confuse with words'
  ],
  'survive-zero-hp': [
    'unconscious', "death's door", 'nearly died', '0 hp', 'barely alive',
    'knocked out', 'fell unconscious', 'dropped to zero', 'death saving',
    'stabilized', 'brought back from brink'
  ],
  'overkill-strikes': [
    'overkill', 'obliterate', 'devastating blow', 'excessive damage',
    'completely destroy', 'annihilate', 'massive damage', 'pulverize',
    'crush completely', 'overwhelming force'
  ],
  'collect-items': [
    'find item', 'loot', 'acquire', 'discover item', 'pick up',
    'collect', 'gather', 'obtain item', 'treasure found', 'new item'
  ],
  'successful-leaps': [
    'leap', 'jump from', 'dive from', 'acrobatic jump', 'vault over',
    'leap of faith', 'jump across', 'parkour', 'aerial maneuver', 'spring from'
  ],
  
  // SET 2: ARSENAL OF CHAOTIC CONTRACTS
  'post-kill-oneliners': [
    'quip', 'one-liner', 'witty retort', 'jokes over the body',
    'punchline after kill', 'clever remark', 'post-mortem humor',
    'finishing quip', 'victory quip', 'death pun'
  ],
  'faction-quests': [
    'complete quest', 'mission complete', 'faction reward', 'guild task',
    'side quest done', 'contract fulfilled', 'job finished', 'bounty completed',
    'faction reputation', 'guild mission'
  ],
  'shots-no-miss': [
    'hit with arrow', 'accurate shot', 'bullseye', 'arrow strikes',
    'perfect aim', 'ranged hit', 'bolt finds mark', 'shot lands',
    'crossbow hit', 'thrown weapon hit'
  ],
  'food-in-combat': [
    'eat during combat', 'consume food', 'snack in battle', 'munch while fighting',
    'bite of food', 'quick meal', 'eat in fight', 'food mid-combat',
    'ration during battle', 'eat while dodging'
  ],
  'arrive-late': [
    'arrive late', 'fashionably late', 'last to arrive', 'join late',
    'show up late', 'missed the start', 'tardy entrance', 'late arrival',
    'delayed entrance', 'came in late'
  ],
  
  // SET 3: REGALIA OF REGENERATIVE RIDICULOUSNESS
  'fail-wisdom-save': [
    'fail wisdom', 'failed wis save', 'wisdom saving throw failed',
    'mind affected', 'charmed successfully', 'feared', 'dominated'
  ],
  'zero-to-full': [
    'heal to full', 'full hp', 'completely healed', 'restored to full',
    'back to maximum', 'fully recovered', 'all hp restored',
    'health fully restored', 'maximum health'
  ],
  'nonverbal-combat': [
    'gesture', 'signal', 'hand sign', 'silent communication',
    'wordless coordination', 'nonverbal cue', 'eye contact signal',
    'nod to ally', 'silent understanding', 'tactical gesture'
  ],
  'quick-draw-attack': [
    'quick draw', 'fast attack', 'rapid strike', 'swift draw',
    'draw and attack', 'fast weapon draw', 'quick slash',
    'immediate strike', 'instant attack', 'lightning draw'
  ],
  'dash-action': [
    'dash', 'sprint', 'run across', 'full speed', 'dash action',
    'running movement', 'double move', 'rush forward', 'charge ahead',
    'speed burst'
  ],
  
  // SET 4: THE SELF-AWARE SLAYER'S KIT
  'predict-plot': [
    'i knew it', 'predicted', 'saw that coming', 'called it',
    'as expected', 'told you so', 'foresaw', 'anticipated correctly',
    'guess was right', 'prediction correct'
  ],
  'survive-meant-lose': [
    'impossible odds', 'should have lost', 'unwinnable', 'outmatched',
    'overwhelmed but survived', 'against all odds', 'hopeless situation',
    'certain death avoided', 'miraculously survived'
  ],
  'recognize-tropes': [
    'trope', 'cliche', 'typical story', 'narrative pattern',
    'seen this before', 'classic setup', 'predictable plot',
    'story convention', 'genre staple', 'familiar pattern'
  ],
  'reverse-situations': [
    'turn the tables', 'reverse', 'unexpected victory', 'sudden reversal',
    'flip the script', 'tables turned', 'situation reversed',
    'comeback victory', 'snatch victory from defeat'
  ],
  'hidden-paths': [
    'secret passage', 'hidden door', 'concealed path', 'secret route',
    'discover hidden', 'find secret', 'hidden entrance', 'secret tunnel',
    'mysterious path', 'obscured way'
  ],
  
  // SET 5: VESTMENTS OF VIOLENT COMEDY
  'humor-defuse': [
    'joke to defuse', 'laugh it off', 'humor saves', 'comic relief',
    'funny moment', 'lighten mood', 'break tension', 'humorous solution',
    'wit saves day', 'comedy victory'
  ],
  'minor-injuries': [
    'scratch', 'minor wound', 'small cut', "flesh wound", 'superficial',
    'light damage', 'graze', 'nick', 'bruise', 'minor hit'
  ],
  'combat-flourishes': [
    'flourish', 'spin attack', 'dramatic strike', 'showy',
    'unnecessary style', 'flashy move', 'dramatic flair', 'stylish attack',
    'theatrical combat', 'show off'
  ],
  'share-food-enemies': [
    'share food', 'offer meal', 'bread and salt', 'share rations',
    'give food to enemy', 'peace offering food', 'food truce',
    'eat together', 'meal with enemy'
  ],
  'lucky-items': [
    'lucky find', 'just what i needed', 'convenient item', 'perfect timing',
    'exactly what we need', 'fortunate discovery', 'serendipitous find',
    'just in time item', 'lucky discovery'
  ],
  
  // SET 6: UNKILLABLE MERC'S LOADOUT
  'survive-lethal': [
    'should have died', 'lethal damage', 'fatal blow', 'deadly strike',
    'mortal wound', 'killing blow', 'death denied', 'impossible survival',
    'survived the unsurvivable', 'cheated death'
  ],
  'come-back-death': [
    'return from death', 'resurrection', 'revive', 'brought back',
    'return to life', 'raised from dead', 'back from beyond',
    'death reversed', 'alive again', 'second life'
  ],
  'counterattack-hit': [
    'counterattack', 'riposte', 'parry and strike', 'retaliate',
    'counter strike', 'attack of opportunity', 'reactive strike',
    'strike back', 'counter blow', 'revenge attack'
  ],
  'reverse-time': [
    'rewind', 'undo', 'time manipulation', 'reverse outcome',
    'turn back time', 'temporal', 'second chance', 'reset',
    'do over', 'time reversal'
  ],
  'avoid-area-effects': [
    'dodge aoe', 'avoid blast', 'escape explosion', 'evade area',
    'sidestep spell', 'duck fireball', 'dodge lightning', 'avoid cone',
    'escape radius', 'successful save'
  ],
  
  // SET 7: ARSENAL OF ABSOLUTE ABSURDITY
  'break-fourth-wall': [
    'fourth wall', 'narrator', 'audience', 'aware of story',
    'meta reference', 'break immersion', 'acknowledge player',
    'talk to reader', 'wink at camera', 'out of character reference'
  ],
  'befriend-enemies': [
    'befriend', 'ally with enemy', 'turn enemy', 'make friend',
    'convert foe', 'diplomatic victory', 'win over enemy',
    'enemy becomes ally', 'unexpected alliance', 'friend from foe'
  ],
  'defeat-with-words': [
    'talk down', 'persuade to surrender', 'words alone', 'diplomacy wins',
    'verbal victory', 'convince to stop', 'speech triumph',
    'negotiate victory', 'talk into submission', 'eloquent defeat'
  ],
  'lucky-accidents': [
    'lucky accident', 'fortunate mishap', 'happy coincidence',
    'accidental success', 'unintended victory', 'lucky break',
    'fortuitous error', 'beneficial mistake', 'serendipity'
  ],
  'dramatic-entrances': [
    'dramatic entrance', 'appear suddenly', 'heroic arrival',
    'grand entrance', 'burst in', 'make an entrance', 'theatrical arrival',
    'surprise appearance', 'timely arrival', 'spectacular entry'
  ],
  
  // SET 8: SELF-AWARE SLAYER'S KIT
  'perceive-meta': [
    'meta narrative', 'story structure', 'aware of plot',
    'notice pattern', 'recognize story', 'see the narrative',
    'detect trope', 'sense the story', 'meta awareness'
  ],
  'survive-impossible': [
    'impossible survival', 'defy odds', 'miraculous', 'shouldn\'t be alive',
    'against probability', 'statistically impossible', 'beat the odds',
    'improbable survival', 'defied death', 'miracle escape'
  ],
  'influence-story': [
    'change story', 'influence narrative', 'alter fate', 'shape events',
    'redirect plot', 'change outcome', 'affect story', 'alter course',
    'narrative influence', 'story impact'
  ],
  'deus-ex-machina': [
    'convenient solution', 'improbable rescue', 'last second save',
    'miraculous help', 'unexpected aid', 'divine intervention',
    'sudden solution', 'impossible help', 'narrative convenience'
  ],
  'escape-last-second': [
    'last second', 'nick of time', 'barely escape', 'just in time',
    'narrow escape', 'close call', 'hair breadth', 'by the skin',
    'split second', 'moment to spare'
  ],
};

// Achievement names for display
export const ACHIEVEMENT_NAMES: Record<string, string> = {
  'distract-enemies': 'Distracting Enemies with Dialogue',
  'survive-zero-hp': 'Surviving After Being Reduced to 0 HP',
  'overkill-strikes': 'Overkill Strikes on Low-Health Enemies',
  'collect-items': 'Collecting Unique Items',
  'successful-leaps': 'Performing Successful Leaps',
  'post-kill-oneliners': 'Delivering Post-Kill One-Liners',
  'faction-quests': 'Completing Side Quests for Factions',
  'shots-no-miss': 'Firing Shots Without Missing',
  'food-in-combat': 'Consuming Food During Combat',
  'arrive-late': 'Arriving Late to Battles',
  'fail-wisdom-save': 'Failing Wisdom Saving Throws and Surviving',
  'zero-to-full': 'Healing from 0 to Full HP',
  'nonverbal-combat': 'Using Non-Verbal Communication in Combat',
  'quick-draw-attack': 'Drawing Weapons and Attacking Quickly',
  'dash-action': 'Using Dash Action',
  'predict-plot': 'Predicting Plot Twists',
  'survive-meant-lose': 'Surviving Meant-to-Lose Encounters',
  'recognize-tropes': 'Recognizing Narrative Tropes',
  'reverse-situations': 'Reversing Situations with Improbable Actions',
  'hidden-paths': 'Discovering Hidden Paths',
  'humor-defuse': 'Defusing Tension with Humor',
  'minor-injuries': 'Enduring Battles with Minor Injuries',
  'combat-flourishes': 'Performing Unnecessary Combat Flourishes',
  'share-food-enemies': 'Sharing Food with Enemies',
  'lucky-items': 'Finding Useful Items Against Odds',
  'survive-lethal': 'Surviving Lethal Damage',
  'come-back-death': 'Coming Back from Death',
  'counterattack-hit': 'Counterattacking After Being Hit',
  'reverse-time': 'Reversing Time or Outcomes',
  'avoid-area-effects': 'Avoiding Area Effects',
  'break-fourth-wall': 'Breaking the Fourth Wall',
  'befriend-enemies': 'Befriending Enemies',
  'defeat-with-words': 'Defeating Enemies with Words Alone',
  'lucky-accidents': 'Benefiting from Lucky Accidents',
  'dramatic-entrances': 'Making Dramatic Entrances',
  'perceive-meta': 'Perceiving Meta-Narrative Elements',
  'survive-impossible': 'Surviving Impossible Odds',
  'influence-story': 'Influencing Story Outcomes',
  'deus-ex-machina': 'Resolving Conflicts Through Improbable Means',
  'escape-last-second': 'Escaping at the Last Second',
};

interface AchievementMatch {
  achievementId: string;
  keyword: string;
  confidence: ConfidenceLevel;
  context: string;
  index: number;
}

/**
 * Match narrative text against achievement keywords
 * Returns matches with confidence based on match quality
 */
export function matchAchievements(text: string): AchievementMatch[] {
  const matches: AchievementMatch[] = [];
  const normalizedText = text.toLowerCase();
  
  for (const [achievementId, keywords] of Object.entries(ACHIEVEMENT_KEYWORDS)) {
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      let searchIndex = 0;
      
      while (true) {
        const foundIndex = normalizedText.indexOf(keywordLower, searchIndex);
        if (foundIndex === -1) break;
        
        // Get surrounding context (60 chars before and after)
        const start = Math.max(0, foundIndex - 60);
        const end = Math.min(text.length, foundIndex + keyword.length + 60);
        const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
        
        // Calculate confidence based on match quality
        let confidence: ConfidenceLevel = 'medium';
        
        // High confidence: exact phrase match with word boundaries
        const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(keywordLower)}\\b`, 'i');
        if (wordBoundaryRegex.test(context)) {
          confidence = 'high';
        }
        
        // Low confidence: partial word match or very short keyword
        if (keyword.length < 5) {
          confidence = 'low';
        }
        
        matches.push({
          achievementId,
          keyword,
          confidence,
          context,
          index: foundIndex,
        });
        
        searchIndex = foundIndex + 1;
      }
    }
  }
  
  // Deduplicate: keep highest confidence match per achievement per context window
  const deduped = deduplicateMatches(matches);
  
  return deduped;
}

/**
 * Convert matches to parsed achievement triggers
 */
export function buildAchievementTriggers(matches: AchievementMatch[]): ParsedAchievementTrigger[] {
  // Group by achievement ID and count occurrences
  const grouped: Record<string, AchievementMatch[]> = {};
  
  for (const match of matches) {
    if (!grouped[match.achievementId]) {
      grouped[match.achievementId] = [];
    }
    grouped[match.achievementId].push(match);
  }
  
  const triggers: ParsedAchievementTrigger[] = [];
  
  for (const [achievementId, achievementMatches] of Object.entries(grouped)) {
    // Use highest confidence match for the trigger
    const bestMatch = achievementMatches.reduce((best, current) => 
      getConfidenceScore(current.confidence) > getConfidenceScore(best.confidence) ? current : best
    );
    
    // Increment based on number of distinct matches (different contexts)
    const distinctContexts = new Set(achievementMatches.map(m => m.context));
    const increment = Math.min(distinctContexts.size, 5); // Cap at 5 per sync
    
    triggers.push({
      achievementId,
      achievementName: ACHIEVEMENT_NAMES[achievementId] || achievementId,
      increment,
      evidence: bestMatch.keyword,
      confidence: bestMatch.confidence,
      sourceText: bestMatch.context,
    });
  }
  
  return triggers;
}

// Helper functions

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getConfidenceScore(confidence: ConfidenceLevel): number {
  switch (confidence) {
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

function deduplicateMatches(matches: AchievementMatch[]): AchievementMatch[] {
  const seen = new Map<string, AchievementMatch>();
  
  for (const match of matches) {
    // Create a key based on achievement and approximate position
    const positionBucket = Math.floor(match.index / 100); // Group by 100-char windows
    const key = `${match.achievementId}-${positionBucket}`;
    
    const existing = seen.get(key);
    if (!existing || getConfidenceScore(match.confidence) > getConfidenceScore(existing.confidence)) {
      seen.set(key, match);
    }
  }
  
  return Array.from(seen.values());
}
