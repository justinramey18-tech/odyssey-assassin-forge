// Legendary Set Image Mapping
// Front and back views for each complete armor set

// Set 1: The Merc with a Mouth's Regalia
import mercWithMouthFront from '@/assets/sets/merc-with-mouth-front.jpg';
import mercWithMouthBack from '@/assets/sets/merc-with-mouth-back.jpg';

// Set 2: Arsenal of Chaotic Contracts
import chaoticContractsFront from '@/assets/sets/chaotic-contracts-front.jpg';
import chaoticContractsBack from '@/assets/sets/chaotic-contracts-back.jpg';

// Set 3: Regalia of Regenerative Ridiculousness
import regenerativeRidiculousnessFront from '@/assets/sets/regenerative-ridiculousness-front.jpg';
import regenerativeRidiculousnessBack from '@/assets/sets/regenerative-ridiculousness-back.jpg';

// Set 4: The Mercenary's Self-Aware Arsenal
import selfAwareArsenalFront from '@/assets/sets/self-aware-arsenal-front.jpg';
import selfAwareArsenalBack from '@/assets/sets/self-aware-arsenal-back.jpg';

// Set 5: Vestments of Violent Comedy
import violentComedyFront from '@/assets/sets/violent-comedy-front.jpg';
import violentComedyBack from '@/assets/sets/violent-comedy-back.jpg';

// Set 6: The Unkillable Merc's Loadout
import unkillableMercFront from '@/assets/sets/unkillable-merc-front.jpg';
import unkillableMercBack from '@/assets/sets/unkillable-merc-back.jpg';

// Set 7: Arsenal of Absolute Absurdity
import absoluteAbsurdityFront from '@/assets/sets/absolute-absurdity-front.jpg';
import absoluteAbsurdityBack from '@/assets/sets/absolute-absurdity-back.jpg';

// Set 8: The Self-Aware Slayer's Kit
import selfAwareSlayerFront from '@/assets/sets/self-aware-slayer-front.jpg';
import selfAwareSlayerBack from '@/assets/sets/self-aware-slayer-back.jpg';

export interface SetImagePair {
  front: string;
  back: string;
  name: string;
  glowColor: string;
}

export const setImages: Record<string, SetImagePair> = {
  'merc-with-mouth': {
    front: mercWithMouthFront,
    back: mercWithMouthBack,
    name: "The Merc with a Mouth's Regalia",
    glowColor: 'rgba(239, 68, 68, 0.5)', // red-500
  },
  'chaotic-contracts': {
    front: chaoticContractsFront,
    back: chaoticContractsBack,
    name: 'Arsenal of Chaotic Contracts',
    glowColor: 'rgba(245, 158, 11, 0.5)', // amber-500
  },
  'regenerative-ridiculousness': {
    front: regenerativeRidiculousnessFront,
    back: regenerativeRidiculousnessBack,
    name: 'Regalia of Regenerative Ridiculousness',
    glowColor: 'rgba(34, 197, 94, 0.5)', // green-500
  },
  'self-aware-arsenal': {
    front: selfAwareArsenalFront,
    back: selfAwareArsenalBack,
    name: "The Mercenary's Self-Aware Arsenal",
    glowColor: 'rgba(168, 85, 247, 0.5)', // purple-500
  },
  'violent-comedy': {
    front: violentComedyFront,
    back: violentComedyBack,
    name: 'Vestments of Violent Comedy',
    glowColor: 'rgba(249, 115, 22, 0.5)', // orange-500
  },
  'unkillable-merc': {
    front: unkillableMercFront,
    back: unkillableMercBack,
    name: "The Unkillable Merc's Loadout",
    glowColor: 'rgba(220, 38, 38, 0.5)', // red-600
  },
  'absolute-absurdity': {
    front: absoluteAbsurdityFront,
    back: absoluteAbsurdityBack,
    name: 'Arsenal of Absolute Absurdity',
    glowColor: 'rgba(59, 130, 246, 0.5)', // blue-500
  },
  'self-aware-slayer': {
    front: selfAwareSlayerFront,
    back: selfAwareSlayerBack,
    name: "The Self-Aware Slayer's Kit",
    glowColor: 'rgba(234, 179, 8, 0.5)', // yellow-500
  },
};

// Get the complete set image if all 8 pieces are equipped
export function getCompleteSetImage(equippedSetId: string | null, activePieces: number): SetImagePair | null {
  if (!equippedSetId || activePieces < 8) return null;
  return setImages[equippedSetId] || null;
}
