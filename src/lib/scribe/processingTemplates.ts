// Processing Templates - Save and load combinations of options + editing rules

import { EditingRule, RuleType, RuleScope } from './editingRules';
import { ProcessingOptions } from '@/lib/narrativeProcessor';

export interface BlendConfig {
  secondaryStyle: string;
  ratio: number; // 10-90, primary style gets (100 - ratio)%
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
