// Processing Templates - Save and load combinations of options + editing rules

import { EditingRule, RuleType, RuleScope } from './editingRules';
import { ProcessingOptions } from '@/lib/narrativeProcessor';

export interface BlendConfig {
  secondaryStyle: string;
  ratio: number; // 10-90, primary style gets remaining %
  tertiaryStyle?: string;
  tertiaryRatio?: number; // 5-30, optional third style
}

export interface BlendPreset {
  id: string;
  name: string;
  description: string;
  primaryStyle: string;
  secondaryStyle: string;
  ratio: number;
  tertiaryStyle?: string;
  tertiaryRatio?: number;
}

// Curated blend presets for common combinations
export const BLEND_PRESETS: BlendPreset[] = [
  // Fantasy-based blends
  {
    id: 'epic-noir',
    name: 'Epic Noir',
    description: 'Grand fantasy narratives with shadowy undertones',
    primaryStyle: 'fantasy',
    secondaryStyle: 'noir',
    ratio: 30,
  },
  {
    id: 'fantasy-literary',
    name: 'High Fantasy',
    description: 'Epic adventures told with elegant, refined prose',
    primaryStyle: 'fantasy',
    secondaryStyle: 'literary',
    ratio: 25,
  },
  {
    id: 'fantasy-trio',
    name: 'Epic Saga',
    description: 'Fantasy core with literary polish and action beats',
    primaryStyle: 'fantasy',
    secondaryStyle: 'literary',
    ratio: 25,
    tertiaryStyle: 'action',
    tertiaryRatio: 15,
  },

  // Noir-based blends
  {
    id: 'noir-lovecraft',
    name: 'Cosmic Noir',
    description: 'Hard-boiled investigation into unknowable horrors',
    primaryStyle: 'noir',
    secondaryStyle: 'lovecraftian',
    ratio: 30,
  },
  {
    id: 'noir-hemingway',
    name: 'Hard-Boiled Minimal',
    description: 'Sparse, brutal noir with no wasted words',
    primaryStyle: 'noir',
    secondaryStyle: 'hemingway',
    ratio: 35,
  },
  {
    id: 'noir-fantasy',
    name: 'Magical Detective',
    description: 'Gritty investigations in a world of magic',
    primaryStyle: 'noir',
    secondaryStyle: 'fantasy',
    ratio: 25,
  },

  // Literary-based blends
  {
    id: 'literary-action',
    name: 'Literary Action',
    description: 'Refined prose meets pulse-pounding combat',
    primaryStyle: 'literary',
    secondaryStyle: 'action',
    ratio: 35,
  },
  {
    id: 'literary-dark',
    name: 'Gothic Literary',
    description: 'Elegant prose with sardonic dark undertones',
    primaryStyle: 'literary',
    secondaryStyle: 'dark_comedy',
    ratio: 20,
  },

  // Action-based blends
  {
    id: 'action-salvatore',
    name: 'Combat Master',
    description: 'Fast-paced action with named technique flourishes',
    primaryStyle: 'action',
    secondaryStyle: 'salvatore',
    ratio: 30,
  },
  {
    id: 'action-gonzo',
    name: 'Adrenaline Rush',
    description: 'Explosive combat with frantic energy',
    primaryStyle: 'action',
    secondaryStyle: 'gonzo',
    ratio: 25,
  },
  {
    id: 'action-noir',
    name: 'Gritty Action',
    description: 'Punchy combat in morally grey settings',
    primaryStyle: 'action',
    secondaryStyle: 'noir',
    ratio: 30,
  },

  // Salvatore-based blends
  {
    id: 'cosmic-salvatore',
    name: 'Cosmic Warrior',
    description: 'Drizzt-style combat against cosmic horrors',
    primaryStyle: 'salvatore',
    secondaryStyle: 'lovecraftian',
    ratio: 25,
  },
  {
    id: 'salvatore-fantasy',
    name: 'Blade Poet',
    description: 'Warrior poetry in epic fantasy tradition',
    primaryStyle: 'salvatore',
    secondaryStyle: 'fantasy',
    ratio: 30,
  },

  // Deadpool-based blends
  {
    id: 'deadpool-gonzo',
    name: 'Chaotic Chronicle',
    description: 'Fourth-wall breaks meet frantic journalism',
    primaryStyle: 'deadpool',
    secondaryStyle: 'gonzo',
    ratio: 35,
  },
  {
    id: 'deadpool-action',
    name: 'Meta Mayhem',
    description: 'Self-aware chaos with explosive combat',
    primaryStyle: 'deadpool',
    secondaryStyle: 'action',
    ratio: 30,
  },
  {
    id: 'deadpool-dark',
    name: 'Irreverent Darkness',
    description: 'Breaking the fourth wall with gallows humor',
    primaryStyle: 'deadpool',
    secondaryStyle: 'dark_comedy',
    ratio: 25,
  },

  // Dark Comedy-based blends
  {
    id: 'dark-absurd',
    name: 'Gallows Surreal',
    description: 'Sardonic wit meets deadpan weirdness',
    primaryStyle: 'dark_comedy',
    secondaryStyle: 'subtle_absurdity',
    ratio: 35,
  },
  {
    id: 'dark-noir',
    name: 'Cynical Shadows',
    description: 'Noir atmosphere with bitter humor',
    primaryStyle: 'dark_comedy',
    secondaryStyle: 'noir',
    ratio: 30,
  },

  // Subtle Absurdity-based blends
  {
    id: 'absurd-literary',
    name: 'Kafkaesque',
    description: 'Elegant prose describing impossible things',
    primaryStyle: 'subtle_absurdity',
    secondaryStyle: 'literary',
    ratio: 25,
  },
  {
    id: 'absurd-fantasy',
    name: 'Surreal Quest',
    description: 'Epic adventures that bend reality',
    primaryStyle: 'subtle_absurdity',
    secondaryStyle: 'fantasy',
    ratio: 30,
  },

  // Lovecraftian-based blends
  {
    id: 'lovecraft-noir',
    name: 'Eldritch Investigation',
    description: 'Hard-boiled detectives against cosmic dread',
    primaryStyle: 'lovecraftian',
    secondaryStyle: 'noir',
    ratio: 30,
  },
  {
    id: 'lovecraft-literary',
    name: 'Cosmic Poetry',
    description: 'Elegant descriptions of sanity-shattering horrors',
    primaryStyle: 'lovecraftian',
    secondaryStyle: 'literary',
    ratio: 25,
  },
  {
    id: 'horror-trio',
    name: 'Cosmic Horror Comedy',
    description: 'Lovecraftian dread with dark humor undertones',
    primaryStyle: 'lovecraftian',
    secondaryStyle: 'dark_comedy',
    ratio: 20,
    tertiaryStyle: 'subtle_absurdity',
    tertiaryRatio: 10,
  },

  // Gonzo-based blends
  {
    id: 'gonzo-action',
    name: 'Savage Reporting',
    description: 'Frantic journalism covering explosive events',
    primaryStyle: 'gonzo',
    secondaryStyle: 'action',
    ratio: 30,
  },
  {
    id: 'gonzo-absurd',
    name: 'Fear & Weirdness',
    description: 'Hunter S. Thompson meets Kafka',
    primaryStyle: 'gonzo',
    secondaryStyle: 'subtle_absurdity',
    ratio: 35,
  },

  // Hemingway-based blends
  {
    id: 'hemingway-action',
    name: 'Brutal Efficiency',
    description: 'Short sentences, maximum impact combat',
    primaryStyle: 'hemingway',
    secondaryStyle: 'action',
    ratio: 35,
  },
  {
    id: 'hemingway-noir',
    name: 'Terse Shadows',
    description: 'Minimalist prose in shadowy settings',
    primaryStyle: 'hemingway',
    secondaryStyle: 'noir',
    ratio: 30,
  },
  {
    id: 'hemingway-salvatore',
    name: 'Warrior Haiku',
    description: 'Named techniques in spare, powerful prose',
    primaryStyle: 'hemingway',
    secondaryStyle: 'salvatore',
    ratio: 25,
  },
];

/**
 * Generate a description of what the blend will produce
 */
export function getBlendDescription(
  primaryStyle: string,
  blendConfig?: BlendConfig
): string {
  if (!blendConfig) {
    return getStyleDescription(primaryStyle);
  }

  const primaryName = formatStyleName(primaryStyle);
  const secondaryName = formatStyleName(blendConfig.secondaryStyle);
  const primaryRatio = blendConfig.tertiaryStyle 
    ? 100 - blendConfig.ratio - (blendConfig.tertiaryRatio || 0)
    : 100 - blendConfig.ratio;

  const blendDescriptions: Record<string, Record<string, string>> = {
    fantasy: {
      noir: 'Epic quests shadowed by moral ambiguity and gritty realism',
      literary: 'Grand adventures told with elegant, refined prose',
      action: 'Sweeping fantasy with punchy, kinetic combat scenes',
      lovecraftian: 'High fantasy touched by unknowable cosmic forces',
    },
    noir: {
      fantasy: 'Hard-boiled investigations in magical settings',
      literary: 'Atmospheric crime stories with poetic undertones',
      hemingway: 'Sparse, brutal noir with no wasted words',
    },
    salvatore: {
      lovecraftian: 'Warrior poetry against incomprehensible horrors',
      action: 'Named blade techniques with explosive pacing',
      fantasy: 'Combat mastery in epic fantasy tradition',
    },
    deadpool: {
      gonzo: 'Meta chaos meets frantic journalistic energy',
      dark_comedy: 'Fourth-wall breaks with gallows humor',
    },
    literary: {
      action: 'Refined prose punctuated by visceral action',
      fantasy: 'Elevated language for fantastical narratives',
    },
  };

  const specific = blendDescriptions[primaryStyle]?.[blendConfig.secondaryStyle] 
    || blendDescriptions[blendConfig.secondaryStyle]?.[primaryStyle];

  if (specific) {
    if (blendConfig.tertiaryStyle) {
      const tertiaryName = formatStyleName(blendConfig.tertiaryStyle);
      return `${specific}, with ${tertiaryName.toLowerCase()} accents`;
    }
    return specific;
  }

  // Generic description
  let desc = `${primaryRatio}% ${primaryName} foundation with ${blendConfig.ratio}% ${secondaryName} influence`;
  if (blendConfig.tertiaryStyle) {
    const tertiaryName = formatStyleName(blendConfig.tertiaryStyle);
    desc += ` and ${blendConfig.tertiaryRatio}% ${tertiaryName} touches`;
  }
  return desc;
}

function getStyleDescription(style: string): string {
  const style_info = NARRATIVE_STYLES.find(s => s.value === style);
  return style_info?.description || 'Custom narrative style';
}

// Re-export ProcessingOptions for convenience
export type { ProcessingOptions };

export interface ProcessingTemplate {
  id: string;
  name: string;
  createdAt: string;
  lastUsed: string;
  
  // Processing config
  narrativeStyle: string;
  blendConfig?: BlendConfig;
  smartParseEnabled: boolean;
  processingOptions: ProcessingOptions;
  
  // Editing rules
  editingRules: EditingRule[];
}

// LocalStorage key
export const TEMPLATES_STORAGE_KEY = 'scribe-processing-templates';

// Max templates allowed
export const MAX_TEMPLATES = 20;

/**
 * Load templates from localStorage
 */
export function loadTemplates(): ProcessingTemplate[] {
  try {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!stored) return [];
    const templates = JSON.parse(stored) as ProcessingTemplate[];
    // Sort by lastUsed, most recent first
    return templates.sort((a, b) => 
      new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
    );
  } catch (error) {
    console.error('Failed to load processing templates:', error);
    return [];
  }
}

/**
 * Save templates to localStorage
 */
export function saveTemplates(templates: ProcessingTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error('Failed to save processing templates:', error);
  }
}

/**
 * Validate a processing template
 */
export function validateTemplate(template: Partial<ProcessingTemplate>): boolean {
  if (!template.name || template.name.trim().length === 0) return false;
  if (!template.narrativeStyle) return false;
  if (!template.processingOptions) return false;
  return true;
}

/**
 * Create a new template from current settings
 */
export function createTemplate(
  name: string,
  narrativeStyle: string,
  smartParseEnabled: boolean,
  processingOptions: ProcessingOptions,
  editingRules: EditingRule[],
  blendConfig?: BlendConfig
): ProcessingTemplate {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: now,
    lastUsed: now,
    narrativeStyle,
    blendConfig,
    smartParseEnabled,
    processingOptions: { ...processingOptions },
    editingRules: editingRules.map(rule => ({ ...rule })),
  };
}

/**
 * Get a display-friendly summary of template settings
 */
export function getTemplateSummary(template: ProcessingTemplate): string {
  const parts: string[] = [];
  
  // Style info
  if (template.blendConfig) {
    const primaryRatio = 100 - template.blendConfig.ratio;
    parts.push(`${primaryRatio}% ${formatStyleName(template.narrativeStyle)} + ${template.blendConfig.ratio}% ${formatStyleName(template.blendConfig.secondaryStyle)}`);
  } else {
    parts.push(formatStyleName(template.narrativeStyle));
  }
  
  // Rule count
  const ruleCount = template.editingRules.length;
  if (ruleCount > 0) {
    parts.push(`${ruleCount} rule${ruleCount > 1 ? 's' : ''}`);
  }
  
  // Smart parse
  if (template.smartParseEnabled) {
    parts.push('Smart Parse');
  }
  
  return parts.join(' • ');
}

/**
 * Format style name for display
 */
export function formatStyleName(style: string): string {
  const styleNames: Record<string, string> = {
    fantasy: 'Fantasy',
    noir: 'Noir',
    literary: 'Literary',
    action: 'Action',
    salvatore: 'Salvatore',
    deadpool: 'Deadpool',
    dark_comedy: 'Dark Comedy',
    subtle_absurdity: 'Subtle Absurdity',
    lovecraftian: 'Lovecraftian',
    gonzo: 'Gonzo',
    hemingway: 'Hemingway',
  };
  return styleNames[style] || style;
}

/**
 * Get all available narrative styles
 */
export const NARRATIVE_STYLES = [
  { value: 'fantasy', label: 'Fantasy', description: 'Epic high fantasy prose' },
  { value: 'noir', label: 'Noir', description: 'Dark, gritty detective style' },
  { value: 'literary', label: 'Literary', description: 'Elegant, refined prose' },
  { value: 'action', label: 'Action', description: 'Fast-paced, punchy writing' },
  { value: 'salvatore', label: 'R.A. Salvatore', description: 'Warrior poetry & named blade techniques' },
  { value: 'deadpool', label: 'Deadpool', description: 'Fourth-wall-breaking meta chaos' },
  { value: 'dark_comedy', label: 'Dark Comedy', description: 'Gallows humor & sardonic wit' },
  { value: 'subtle_absurdity', label: 'Subtle Absurdity', description: 'Kafkaesque deadpan surrealism' },
  { value: 'lovecraftian', label: 'Lovecraftian Horror', description: 'Cosmic dread & sanity erosion' },
  { value: 'gonzo', label: 'Gonzo Journalism', description: "Hunter S. Thompson's savage reporting" },
  { value: 'hemingway', label: 'Hemingway Minimalist', description: 'Brutal efficiency, short sentences' },
] as const;
