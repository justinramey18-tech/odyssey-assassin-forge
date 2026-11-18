// Solo Empyrean hall scene: the three joined background images and where each tappable object
// sits in them. Boxes are in pixels of the full scene (left + center + right images side by side),
// measured on the art installed at d205d32. If an image is regenerated, re-measure its boxes.

export const HALL_SCENE_WIDTH = 6160;
export const HALL_SCENE_HEIGHT = 1100;

/** Where each image starts and how wide it is, in scene pixels. */
export const HALL_SCENE_PARTS = [
  { key: 'left', x: 0, width: 1760 },
  { key: 'center', x: 1760, width: 2640 },
  { key: 'right', x: 4400, width: 1760 },
] as const;

/** The two joins between images (a soft pillar shadow is drawn over each). */
export const HALL_SCENE_SEAMS = [1760, 4400] as const;

/** The calm dark wall behind the story text, in scene pixels. */
export const HALL_STORY_WALL = { x0: 2660, x1: 3480 } as const;

export type HallSpotId =
  | 'camp' | 'map' | 'loot' | 'quests' | 'people'
  | 'bag' | 'sheet' | 'signet' | 'tools' | 'director' | 'dragon';

export interface HallSpot {
  id: HallSpotId;
  /** What the object is, for screen readers and the small caption. */
  label: string;
  /** Left, top, right, bottom in scene pixels. */
  box: readonly [number, number, number, number];
}

export const HALL_SPOTS: readonly HallSpot[] = [
  { id: 'camp', label: 'Camp', box: [90, 390, 510, 850] },
  { id: 'map', label: 'Map', box: [745, 390, 1410, 850] },
  { id: 'loot', label: 'Loot', box: [1425, 690, 1660, 875] },
  { id: 'quests', label: 'Quests', box: [1925, 440, 2165, 865] },
  { id: 'people', label: 'People', box: [2175, 370, 2465, 850] },
  { id: 'bag', label: 'Bag', box: [3680, 500, 3880, 815] },
  { id: 'sheet', label: 'Sheet', box: [3975, 430, 4305, 875] },
  { id: 'signet', label: 'Signet', box: [4600, 490, 4790, 855] },
  { id: 'tools', label: 'Tools', box: [4860, 550, 5070, 855] },
  { id: 'director', label: 'Director', box: [5225, 385, 5415, 855] },
  { id: 'dragon', label: 'Dragon', box: [5600, 130, 6045, 765] },
];

/** A box as CSS percentages of the scene, so it stays on its object at any size. */
export function hallSpotStyle(box: HallSpot['box']): { left: string; top: string; width: string; height: string } {
  const [x0, y0, x1, y1] = box;
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return {
    left: pct(x0, HALL_SCENE_WIDTH),
    top: pct(y0, HALL_SCENE_HEIGHT),
    width: pct(x1 - x0, HALL_SCENE_WIDTH),
    height: pct(y1 - y0, HALL_SCENE_HEIGHT),
  };
}
