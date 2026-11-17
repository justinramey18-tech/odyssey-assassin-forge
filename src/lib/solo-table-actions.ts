import type { CharacterContext } from '@/components/oracle/types';
import type { DiceTestRoll } from '@/lib/diceRollBus';
import type { RulesCheck, CheckRisk } from '@/lib/empyrean-rules-client';

/** Both whisper paths use the same final d20; the referee never rolls again. */
export async function soloRollLine(message: string, roll: DiceTestRoll, dc: number | null | undefined, risk: CheckRisk, label: string,
  check?: (input: { d20: number; modifier: number; dc: number | null; risk: CheckRisk; label: string }) => Promise<RulesCheck | null>) {
  if (roll.die !== 20 || dc == null || !Number.isFinite(dc) || !check) return message;
  const ruling = await check({ d20: roll.kept, modifier: roll.modifier, dc, risk, label });
  return ruling ? `${message}\n${ruling.line}` : message;
}

export function soloPortraitPrompt(ctx?: CharacterContext) {
  return `Hyper-realistic cinematic portrait of ${ctx?.name || 'a dragon rider'}, ${ctx?.race || 'human'} ${ctx?.characterClass || 'rider'}. Black flight leathers, natural torch lighting, detailed face, no text.`.slice(0, 4000);
}