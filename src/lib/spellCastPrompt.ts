import { applyTimePrefix } from '@/lib/fourthWallTime';

export function generateSpellPrompt(
  name: string,
  characterName: string,
  isCantrip: boolean,
  detail?: {
    level?: number; school?: string; description?: string; damageFormula?: string; damageType?: string;
    healingFormula?: string; saveStat?: string; attackType?: string; isHomebrew?: boolean;
  },
): string {
  const type = isCantrip ? 'cantrip' : 'spell';
  const bits: string[] = [];
  if (detail?.school) bits.push(` ${detail.school} school${typeof detail.level === 'number' ? `, level ${detail.level}` : ''}.`);
  if (detail?.description) bits.push(` Its rules text: ${detail.description}`);
  if (detail?.damageFormula) bits.push(` Damage ${detail.damageFormula}${detail.damageType ? ` ${detail.damageType}` : ''}.`);
  if (detail?.healingFormula) bits.push(` Healing ${detail.healingFormula}.`);
  if (detail?.saveStat) bits.push(` Target makes a ${String(detail.saveStat).toUpperCase()} save.`);
  if (detail?.attackType) bits.push(` Resolved as a ${String(detail.attackType).replace(/_/g, ' ')} attack.`);
  if (detail?.isHomebrew) bits.push(' This is a custom spell — follow the rules text exactly, do not substitute a similar spell.');
  return applyTimePrefix(
    `${characterName} casts ${name} (${type}).${bits.join('')} Describe the somatic/verbal components, the magical manifestation, and its effect. Keep it under 80 words.`
  );
}
