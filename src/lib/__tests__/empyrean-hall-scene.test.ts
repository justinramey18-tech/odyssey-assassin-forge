import { describe, expect, it } from 'vitest';
import {
  HALL_SCENE_HEIGHT, HALL_SCENE_PARTS, HALL_SCENE_SEAMS, HALL_SCENE_WIDTH, HALL_SPOTS, HALL_STORY_WALL, hallSpotStyle,
} from '@/lib/empyrean-hall-scene';

describe('Empyrean hall scene map', () => {
  it('the three images sit side by side and fill the scene exactly', () => {
    let x = 0;
    for (const part of HALL_SCENE_PARTS) {
      expect(part.x).toBe(x);
      x += part.width;
    }
    expect(x).toBe(HALL_SCENE_WIDTH);
    expect([...HALL_SCENE_SEAMS]).toEqual(HALL_SCENE_PARTS.slice(1).map(p => p.x));
  });

  it('has one tap area per object, each inside the scene, big enough to tap and clear of the joins', () => {
    expect(HALL_SPOTS.map(s => s.id)).toEqual(['camp', 'map', 'loot', 'quests', 'people', 'bag', 'sheet', 'signet', 'tools', 'director', 'dragon']);
    for (const spot of HALL_SPOTS) {
      const [x0, y0, x1, y1] = spot.box;
      expect(x0).toBeGreaterThanOrEqual(0);
      expect(y0).toBeGreaterThanOrEqual(0);
      expect(x1).toBeLessThanOrEqual(HALL_SCENE_WIDTH);
      expect(y1).toBeLessThanOrEqual(HALL_SCENE_HEIGHT);
      // On a story area only 380 px tall the smallest area is still a comfortable tap.
      const scale = 380 / HALL_SCENE_HEIGHT;
      expect((x1 - x0) * scale).toBeGreaterThanOrEqual(60);
      expect((y1 - y0) * scale).toBeGreaterThanOrEqual(60);
      for (const seam of HALL_SCENE_SEAMS) expect(x1 <= seam || x0 >= seam).toBe(true);
    }
  });

  it('no two tap areas overlap', () => {
    for (let i = 0; i < HALL_SPOTS.length; i++) {
      for (let j = i + 1; j < HALL_SPOTS.length; j++) {
        const [ax0, ay0, ax1, ay1] = HALL_SPOTS[i].box;
        const [bx0, by0, bx1, by1] = HALL_SPOTS[j].box;
        const apart = ax1 <= bx0 || bx1 <= ax0 || ay1 <= by0 || by1 <= ay0;
        expect(apart, `${HALL_SPOTS[i].id} and ${HALL_SPOTS[j].id}`).toBe(true);
      }
    }
  });

  it('the story (one screen wide, centred) covers no object on a phone-shaped story area', () => {
    const center = HALL_SCENE_WIDTH / 2;
    // The art's calm wall is centred in the scene to within a few pixels.
    expect(Math.abs((HALL_STORY_WALL.x0 + HALL_STORY_WALL.x1) / 2 - center)).toBeLessThanOrEqual(20);
    // 411 px wide screen, story area 430 px tall.
    const half = (411 / 2) * (HALL_SCENE_HEIGHT / 430);
    for (const spot of HALL_SPOTS) {
      const [x0, , x1] = spot.box;
      expect(x1 <= center - half || x0 >= center + half, spot.id).toBe(true);
    }
  });

  it('turns a box into percentages of the scene', () => {
    expect(hallSpotStyle([0, 0, HALL_SCENE_WIDTH, HALL_SCENE_HEIGHT])).toEqual({ left: '0%', top: '0%', width: '100%', height: '100%' });
    expect(hallSpotStyle([HALL_SCENE_WIDTH / 2, HALL_SCENE_HEIGHT / 4, HALL_SCENE_WIDTH, HALL_SCENE_HEIGHT / 2])).toEqual({ left: '50%', top: '25%', width: '50%', height: '25%' });
  });
});
