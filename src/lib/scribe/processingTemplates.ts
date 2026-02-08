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
  {
    id: 'epic-noir',
    name: 'Epic Noir',
    description: 'Grand fantasy narratives with shadowy undertones',
    primaryStyle: 'fantasy',
    secondaryStyle: 'noir',
    ratio: 30,
  },
  {
    id: 'literary-action',
    name: 'Literary Action',
    description: 'Refined prose meets pulse-pounding combat',
    primaryStyle: 'literary',
    secondaryStyle: 'action',
    ratio: 35,
  },
  {
    id: 'cosmic-salvatore',
    name: 'Cosmic Warrior',
    description: 'Drizzt-style combat with Lovecraftian dread',
    primaryStyle: 'salvatore',
    secondaryStyle: 'lovecraftian',
    ratio: 25,
  },
  {
    id: 'gonzo-deadpool',
    name: 'Chaotic Chronicle',
    description: 'Frantic energy with fourth-wall breaks',
    primaryStyle: 'gonzo',
    secondaryStyle: 'deadpool',
    ratio: 40,
  },
  {
    id: 'dark-absurd',
    name: 'Gallows Surreal',
    description: 'Sardonic wit meets deadpan weirdness',
    primaryStyle: 'dark_comedy',
    secondaryStyle: 'subtle_absurdity',
    ratio: 35,
  },
  {
    id: 'hemingway-noir',
    name: 'Hard-Boiled Minimal',
    description: 'Brutal efficiency with noir atmosphere',
    primaryStyle: 'hemingway',
    secondaryStyle: 'noir',
    ratio: 30,
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
