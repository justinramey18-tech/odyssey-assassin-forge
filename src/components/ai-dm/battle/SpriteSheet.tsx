// Plays one fighter's sprite sheet: the idle loop, and a one-shot (an attack, a flinch) when asked,
// then back to idle. One element with the sheet as its background; no canvas, no library.
// With reduced motion it shows the first idle frame and never moves.
import { useEffect, useRef, useState } from 'react';
import { spriteFrameAt, spriteFrameStyle, type BattleSprite, type SpritePlay } from '@/lib/battle-sprites';

interface Props {
  sprite: BattleSprite;
  /** A one-shot to play now; a new key restarts it. null or absent: idle. */
  play?: SpritePlay | null;
  className?: string;
}

const calm = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function SpriteSheet({ sprite, play, className }: Props) {
  const [shown, setShown] = useState<{ anim: string; index: number }>({ anim: sprite.idle, index: 0 });
  const playKey = play ? `${play.anim}:${play.key}` : null;
  const latest = useRef(play);
  latest.current = play;

  useEffect(() => {
    if (calm()) { setShown({ anim: sprite.idle, index: 0 }); return; }
    const wanted = latest.current;
    const shot = wanted && sprite.anims[wanted.anim] && !sprite.anims[wanted.anim].loop ? wanted.anim : null;
    let name = shot ?? sprite.idle;
    let started = performance.now();
    let last = '';
    const tick = () => {
      const anim = sprite.anims[name] ?? sprite.anims[sprite.idle];
      if (!anim) return;
      const at = spriteFrameAt(anim, performance.now() - started);
      if (at.done) { name = sprite.idle; started = performance.now(); }
      const now = at.done ? { anim: sprite.idle, index: 0 } : { anim: name, index: at.index };
      const sig = `${now.anim}:${now.index}`;
      if (sig !== last) { last = sig; setShown(now); }
    };
    tick();
    // Twelve checks a second is finer than the fastest animation (6 frames a second) and costs nothing.
    const timer = window.setInterval(tick, 1000 / 12);
    return () => window.clearInterval(timer);
  }, [sprite, playKey]);

  const anim = sprite.anims[shown.anim] ?? sprite.anims[sprite.idle];
  if (!anim) return null;
  return (
    <div
      aria-hidden="true"
      data-sprite-anim={shown.anim}
      data-sprite-frame={shown.index}
      className={className}
      style={{
        aspectRatio: `${sprite.frame.w} / ${sprite.frame.h}`,
        backgroundImage: `url(${sprite.sheet})`,
        backgroundRepeat: 'no-repeat',
        ...spriteFrameStyle(sprite, anim, shown.index),
      }}
    />
  );
}
