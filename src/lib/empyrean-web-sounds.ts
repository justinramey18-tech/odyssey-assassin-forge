// Sounds for the solo Empyrean progression web, made with the Web Audio API. No sound files: every
// sound is built from tones and noise, the way the dice sounds are (src/lib/diceSounds.ts).
// The rider can switch them off on the web screen; the choice is kept on this device.

const KEY = 'empyrean-web-sound';

export function webSoundOn(): boolean {
  try { return window.localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
export function setWebSound(on: boolean): void {
  try { window.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode: the choice lasts until the page closes */ }
}

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

/** One struck tone that rings out. */
function tone(c: AudioContext, at: number, freq: number, seconds: number, volume: number, type: OscillatorType = 'sine', endFreq?: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, at + seconds);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + seconds + 0.05);
}

/** A low roll of filtered noise: the dragon under a capstone. */
function rumble(c: AudioContext, at: number, seconds: number, volume: number) {
  const length = Math.max(1, Math.floor(c.sampleRate * seconds));
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const source = c.createBufferSource();
  source.buffer = buffer;
  const low = c.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.setValueAtTime(190, at);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.18);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  source.connect(low).connect(gain).connect(c.destination);
  source.start(at);
  source.stop(at + seconds + 0.05);
}

/** A node is unlocked: a chime of struck metal. A major node rings longer, a capstone has a dragon's
 *  rumble under it, and the dragon's half is pitched lower than the rider's. Never throws. */
export function playWebUnlock(tier: 'small' | 'big' | 'capstone', half: 'rider' | 'dragon'): void {
  if (!webSoundOn()) return;
  const c = audio();
  if (!c) return;
  try {
    const at = c.currentTime + 0.01;
    const base = half === 'dragon' ? 329.63 : 523.25;
    const volume = tier === 'small' ? 0.07 : 0.09;
    tone(c, at, base, 0.5, volume, 'triangle');
    tone(c, at, base * 2.76, 0.32, volume * 0.4);
    tone(c, at + 0.07, base * 1.5, 0.6, volume * 0.7, 'triangle');
    if (tier !== 'small') tone(c, at + 0.16, base * 2, 0.85, volume * 0.7, 'triangle');
    if (tier === 'capstone') {
      tone(c, at, 58, 1.3, 0.16, 'sawtooth', 38);
      rumble(c, at, 1.4, 0.22);
      tone(c, at + 0.3, base * 3, 1.1, 0.05);
    }
  } catch { /* a sound is never worth an error */ }
}
