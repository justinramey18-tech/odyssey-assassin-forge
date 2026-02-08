// Editing Rules Types, Templates, and Utilities

export type RuleType = 'replace' | 'remove' | 'style' | 'character' | 'custom';
export type RuleScope = 'dialogue' | 'narration' | 'combat' | 'all';

export interface EditingRule {
  id: string;
  type: RuleType;
  instruction: string;
  scope: RuleScope;
  isValid: boolean;
  validationWarning?: string;
}

export interface RuleSet {
  id: string;
  name: string;
  rules: EditingRule[];
  createdAt: string;
  lastUsed: string;
}

export interface RuleTemplate {
  type: RuleType;
  label: string;
  template: string;
  description: string;
}

// Predefined rule templates for common use cases
export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    type: 'replace',
    label: 'Word Replacement',
    template: "Replace '[word]' with '[newWord]'",
    description: 'Substitute one word or phrase for another',
  },
  {
    type: 'remove',
    label: 'Remove Content',
    template: "Remove all instances of '[phrase]'",
    description: 'Delete specific words or phrases',
  },
  {
    type: 'character',
    label: 'Rename Character',
    template: "Rename '[oldName]' to '[newName]'",
    description: 'Change a character name throughout',
  },
  {
    type: 'style',
    label: 'Adjust Tone',
    template: 'Make the tone more [adjective]',
    description: 'Shift the overall writing style',
  },
  {
    type: 'style',
    label: 'Remove Modern Language',
    template: 'Remove modern slang and casual language',
    description: 'Keep language period-appropriate',
  },
  {
    type: 'style',
    label: 'Formal Dialogue',
    template: "In dialogue, replace contractions with full words (e.g., \"don't\" to \"do not\")",
    description: 'Make speech more formal',
  },
];

// Validation constants
export const MAX_RULES = 10;
export const MAX_RULE_LENGTH = 200;
export const MIN_RULE_LENGTH = 5;

// Prompt injection patterns to sanitize
const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)\s+instructions?/gi,
  /disregard\s+(previous|above|all)\s+instructions?/gi,
  /forget\s+(everything|all|previous)/gi,
  /new\s+instructions?:/gi,
  /system\s*:\s*/gi,
  /\[INST\]/gi,
  /<<SYS>>/gi,
  /<\|im_start\|>/gi,
  /<user_editing_rules>/gi,
  /<\/user_editing_rules>/gi,
];

/**
 * Sanitize rule instruction to prevent prompt injection
 */
export function sanitizeRuleInstruction(instruction: string): string {
  let sanitized = instruction;
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized.trim();
}

/**
 * Validate a single editing rule
 */
export function validateRule(rule: EditingRule): EditingRule {
  const warnings: string[] = [];
  let isValid = true;

  // Check for empty instruction
  if (!rule.instruction || rule.instruction.trim().length === 0) {
    isValid = false;
    warnings.push('Rule cannot be empty');
  }

  // Check for minimum length
  if (rule.instruction.trim().length < MIN_RULE_LENGTH) {
    isValid = false;
    warnings.push(`Rule must be at least ${MIN_RULE_LENGTH} characters`);
  }

  // Check for maximum length
  if (rule.instruction.length > MAX_RULE_LENGTH) {
    isValid = false;
    warnings.push(`Rule exceeds ${MAX_RULE_LENGTH} character limit`);
  }

  // Check for vague rules (less than 3 words)
  const wordCount = rule.instruction.trim().split(/\s+/).length;
  if (wordCount < 3 && isValid) {
    warnings.push('This rule might be too vague');
  }

  // Check for injection patterns
  const sanitized = sanitizeRuleInstruction(rule.instruction);
  if (sanitized.includes('[REDACTED]')) {
    warnings.push('Some content was sanitized for security');
  }

  return {
    ...rule,
    instruction: sanitized,
    isValid,
    validationWarning: warnings.length > 0 ? warnings[0] : undefined,
  };
}

/**
 * Create a new editing rule with defaults
 */
export function createRule(instruction: string = '', type: RuleType = 'custom'): EditingRule {
  const rule: EditingRule = {
    id: crypto.randomUUID(),
    type,
    instruction,
    scope: 'all',
    isValid: true,
  };
  return validateRule(rule);
}

/**
 * Serialize rules for inclusion in AI prompt
 */
export function serializeRulesForPrompt(rules: EditingRule[]): string {
  const validRules = rules.filter(r => r.isValid && r.instruction.trim().length > 0);
  
  if (validRules.length === 0) return '';

  const rulesText = validRules
    .map((r, i) => {
      const scopeLabel = r.scope !== 'all' ? ` [SCOPE: ${r.scope.toUpperCase()}]` : '';
      return `${i + 1}.${scopeLabel} ${r.instruction}`;
    })
    .join('\n');

  return `
<user_editing_rules>
Apply these specific editing rules during transformation:
${rulesText}

Important: Apply each rule exactly as stated. Do not creatively interpret or extend beyond the literal instruction.
</user_editing_rules>`;
}

/**
 * Get icon name for rule type (for use with lucide-react)
 */
export function getRuleTypeIcon(type: RuleType): string {
  switch (type) {
    case 'replace': return 'Replace';
    case 'remove': return 'Trash2';
    case 'style': return 'Palette';
    case 'character': return 'User';
    case 'custom': return 'Pencil';
    default: return 'Pencil';
  }
}

/**
 * Get display label for rule type
 */
export function getRuleTypeLabel(type: RuleType): string {
  switch (type) {
    case 'replace': return 'Replacement';
    case 'remove': return 'Removal';
    case 'style': return 'Style';
    case 'character': return 'Character';
    case 'custom': return 'Custom';
    default: return 'Custom';
  }
}

/**
 * Detect rule type from instruction text
 */
export function detectRuleType(instruction: string): RuleType {
  const lower = instruction.toLowerCase();
  
  if (lower.includes('replace') && lower.includes('with')) return 'replace';
  if (lower.includes('remove') || lower.includes('delete')) return 'remove';
  if (lower.includes('rename') || lower.includes('character')) return 'character';
  if (lower.includes('tone') || lower.includes('style') || lower.includes('formal') || lower.includes('casual')) return 'style';
  
  return 'custom';
}
