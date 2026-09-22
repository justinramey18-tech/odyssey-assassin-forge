import type { AbilityScore } from '@/lib/diceRollerConfig';
import strengthArt from '@/assets/dice/strength.webp.asset.json';
import dexterityArt from '@/assets/dice/dexterity.webp.asset.json';
import constitutionArt from '@/assets/dice/constitution.webp.asset.json';
import intelligenceArt from '@/assets/dice/intelligence.webp.asset.json';
import wisdomArt from '@/assets/dice/wisdom.webp.asset.json';
import charismaArt from '@/assets/dice/charisma.webp.asset.json';
import acrobaticsArt from '@/assets/dice/acrobatics.webp.asset.json';
import animalHandlingArt from '@/assets/dice/animal-handling.webp.asset.json';
import arcanaArt from '@/assets/dice/arcana.webp.asset.json';
import athleticsArt from '@/assets/dice/athletics.webp.asset.json';
import deceptionArt from '@/assets/dice/deception.webp.asset.json';
import historyArt from '@/assets/dice/history.webp.asset.json';
import insightArt from '@/assets/dice/insight.webp.asset.json';
import intimidationArt from '@/assets/dice/intimidation.webp.asset.json';
import investigationArt from '@/assets/dice/investigation.webp.asset.json';
import medicineArt from '@/assets/dice/medicine.webp.asset.json';
import natureArt from '@/assets/dice/nature.webp.asset.json';
import perceptionArt from '@/assets/dice/perception.webp.asset.json';
import performanceArt from '@/assets/dice/performance.webp.asset.json';
import persuasionArt from '@/assets/dice/persuasion.webp.asset.json';
import religionArt from '@/assets/dice/religion.webp.asset.json';
import sleightOfHandArt from '@/assets/dice/sleight-of-hand.webp.asset.json';
import stealthArt from '@/assets/dice/stealth.webp.asset.json';
import survivalArt from '@/assets/dice/survival.webp.asset.json';
import d4Art from '@/assets/dice/d4.webp.asset.json';
import d6Art from '@/assets/dice/d6.webp.asset.json';
import d8Art from '@/assets/dice/d8.webp.asset.json';
import d10Art from '@/assets/dice/d10.webp.asset.json';
import d12Art from '@/assets/dice/d12.webp.asset.json';
import d20Art from '@/assets/dice/d20.webp.asset.json';

export const ABILITY_ART: Record<AbilityScore, string> = {
  str: strengthArt.url,
  dex: dexterityArt.url,
  con: constitutionArt.url,
  int: intelligenceArt.url,
  wis: wisdomArt.url,
  cha: charismaArt.url,
};

export const SKILL_ART: Record<string, string> = {
  acrobatics: acrobaticsArt.url,
  animal_handling: animalHandlingArt.url,
  arcana: arcanaArt.url,
  athletics: athleticsArt.url,
  deception: deceptionArt.url,
  history: historyArt.url,
  insight: insightArt.url,
  intimidation: intimidationArt.url,
  investigation: investigationArt.url,
  medicine: medicineArt.url,
  nature: natureArt.url,
  perception: perceptionArt.url,
  performance: performanceArt.url,
  persuasion: persuasionArt.url,
  religion: religionArt.url,
  sleight_of_hand: sleightOfHandArt.url,
  stealth: stealthArt.url,
  survival: survivalArt.url,
};

export const DIE_ART: Record<number, string> = {
  4: d4Art.url,
  6: d6Art.url,
  8: d8Art.url,
  10: d10Art.url,
  12: d12Art.url,
  20: d20Art.url,
};