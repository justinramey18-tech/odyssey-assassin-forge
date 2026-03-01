/**
 * Dice roll sound effects using Web Audio API.
 * No external files needed — all sounds are synthesized.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/** Short percussive "click" — one rattle tick */
function tick(ctx: AudioContext, time: number, volume = 0.08) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800 + Math.random() * 1200, time);
  gain.gain.setValueAtTime(volume, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.04);
}

/** Burst of noise — one rattle tick (alternative texture) */
function noiseTick(ctx: AudioContext, time: number, volume = 0.06) {
  const bufferSize = ctx.sampleRate * 0.02; // 20ms
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * volume;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(1, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2000 + Math.random() * 3000, time);
  filter.Q.setValueAtTime(2, time);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(time);
  source.stop(time + 0.03);
}

/**
 * Play a rattling dice sound that accelerates then decelerates
 * over the given duration (ms). Returns a promise that resolves when done.
 */
export function playDiceRattle(durationMs = 600): void {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const dur = durationMs / 1000;
    const tickCount = Math.floor(8 + dur * 12);

    for (let i = 0; i < tickCount; i++) {
      const progress = i / tickCount;
      // Ease-in-out timing: ticks cluster in the middle
      const t = now + dur * (progress * progress * (3 - 2 * progress));
      // Volume fades toward end
      const vol = 0.04 + 0.06 * (1 - progress);
      if (Math.random() > 0.4) {
        noiseTick(ctx, t, vol);
      } else {
        tick(ctx, t, vol);
      }
    }
  } catch {
    // Audio not available — silent fail
  }
}

/**
 * Play a satisfying "thud" when the die lands.
 */
export function playDiceThud(isCrit = false, isFumble = false): void {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    // Low thump
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const baseFreq = isCrit ? 120 : isFumble ? 60 : 90;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
    gain.gain.setValueAtTime(isCrit ? 0.25 : 0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);

    // Impact noise burst
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(isCrit ? 0.15 : 0.1, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(isCrit ? 3000 : 1500, now);
    noise.connect(lp).connect(noiseGain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.1);

    // Crit: add a bright shimmer
    if (isCrit) {
      const shimmer = ctx.createOscillator();
      const sGain = ctx.createGain();
      shimmer.type = 'triangle';
      shimmer.frequency.setValueAtTime(1200, now + 0.05);
      shimmer.frequency.exponentialRampToValueAtTime(800, now + 0.3);
      sGain.gain.setValueAtTime(0, now);
      sGain.gain.linearRampToValueAtTime(0.08, now + 0.08);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      shimmer.connect(sGain).connect(ctx.destination);
      shimmer.start(now + 0.05);
      shimmer.stop(now + 0.4);
    }

    // Fumble: add a low rumble
    if (isFumble) {
      const rumble = ctx.createOscillator();
      const rGain = ctx.createGain();
      rumble.type = 'sawtooth';
      rumble.frequency.setValueAtTime(45, now);
      rumble.frequency.exponentialRampToValueAtTime(25, now + 0.3);
      rGain.gain.setValueAtTime(0.06, now);
      rGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      rumble.connect(rGain).connect(ctx.destination);
      rumble.start(now);
      rumble.stop(now + 0.4);
    }
  } catch {
    // Audio not available — silent fail
  }
}
