/**
 * Cinematic Slideshow Audio Engine
 *
 * Provides synthesized SFX and looping ambience for the cinematic slideshow.
 * Tries real audio files from the cinematic-audio bucket first (via
 * slideshowAudioLoader), falling back to Web Audio API synthesis.
 */

import { getCachedBuffer, loadAudioBuffer } from '@/lib/slideshowAudioLoader';

// --- Shared AudioContext (lazy init) ---

let ctx: AudioContext | null = null;

export function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// --- Ambience state ---

interface AmbienceState {
  nodes: AudioNode[];
  sources: AudioBufferSourceNode[];
  gainNode: GainNode;
}

let currentAmbience: AmbienceState | null = null;
let currentAmbienceName: string | null = null;

function stopAmbienceLoop(state: AmbienceState, fadeTime = 0.3): void {
  try {
    const c = getCtx();
    state.gainNode.gain.linearRampToValueAtTime(0, c.currentTime + fadeTime);
    setTimeout(() => {
      for (const s of state.sources) {
        try { s.stop(); } catch { /* already stopped */ }
      }
      for (const n of state.nodes) {
        try { n.disconnect(); } catch { /* already disconnected */ }
      }
    }, fadeTime * 1000 + 100);
  } catch { /* ignore */ }
}

// === SFX SYNTHESIS REGISTRY ===
// Each builder creates a short one-shot sound using the Web Audio API.

type SfxBuilder = (c: AudioContext) => void;

function synthThunder(c: AudioContext) {
  const dur = 0.8;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.2));
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(200, c.currentTime);
  lp.frequency.exponentialRampToValueAtTime(60, c.currentTime + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.6, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + dur);
  src.connect(lp).connect(g).connect(c.destination);
  src.start();
}

function synthSwordClash(c: AudioContext) {
  const dur = 0.15;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.03));
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2000;
  const g = c.createGain();
  g.gain.setValueAtTime(0.4, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + dur);
  src.connect(hp).connect(g).connect(c.destination);
  src.start();
}

function synthHeartbeat(c: AudioContext) {
  for (let beat = 0; beat < 2; beat++) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 50;
    const g = c.createGain();
    const t = c.currentTime + beat * 0.3;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  }
}

function synthExplosion(c: AudioContext) {
  const dur = 0.6;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.1));
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(400, c.currentTime);
  lp.frequency.exponentialRampToValueAtTime(30, c.currentTime + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.7, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + dur);
  src.connect(lp).connect(g).connect(c.destination);
  src.start();
}

function synthDragonRoar(c: AudioContext) {
  const dur = 1.0;
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, c.currentTime + dur);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(600, c.currentTime);
  lp.frequency.exponentialRampToValueAtTime(100, c.currentTime + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.5, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + dur);
  osc.connect(lp).connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + dur);
}

function synthSignetCrackle(c: AudioContext) {
  const dur = 0.4;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.3 * (Math.sin(i / 8) > 0.7 ? 1 : 0.1);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3000;
  const g = c.createGain();
  g.gain.setValueAtTime(0.35, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + dur);
  src.connect(hp).connect(g).connect(c.destination);
  src.start();
}

function synthDoorCreak(c: AudioContext) {
  const dur = 0.6;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, c.currentTime);
  osc.frequency.linearRampToValueAtTime(600, c.currentTime + dur * 0.5);
  osc.frequency.linearRampToValueAtTime(250, c.currentTime + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.15, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + dur);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + dur);
}

function synthArrowImpact(c: AudioContext) {
  const dur = 0.12;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.02));
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1500;
  bp.Q.value = 2;
  const g = c.createGain();
  g.gain.setValueAtTime(0.45, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + dur);
  src.connect(bp).connect(g).connect(c.destination);
  src.start();
}

function synthWardHum(c: AudioContext) {
  const dur = 1.2;
  const osc1 = c.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = 180;
  const osc2 = c.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 183;
  const g = c.createGain();
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(0.2, c.currentTime + 0.3);
  g.gain.linearRampToValueAtTime(0.2, c.currentTime + dur - 0.3);
  g.gain.linearRampToValueAtTime(0, c.currentTime + dur);
  osc1.connect(g);
  osc2.connect(g);
  g.connect(c.destination);
  osc1.start();
  osc2.start();
  osc1.stop(c.currentTime + dur);
  osc2.stop(c.currentTime + dur);
}

function synthBoneSnap(c: AudioContext) {
  const dur = 0.08;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.01));
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(0.5, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + dur);
  src.connect(g).connect(c.destination);
  src.start();
}

function synthFireWhoosh(c: AudioContext) {
  const dur = 0.5;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.15));
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(800, c.currentTime);
  bp.frequency.exponentialRampToValueAtTime(200, c.currentTime + dur);
  bp.Q.value = 1;
  const g = c.createGain();
  g.gain.setValueAtTime(0.5, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + dur);
  src.connect(bp).connect(g).connect(c.destination);
  src.start();
}

function synthHorseGallop(c: AudioContext) {
  for (let i = 0; i < 4; i++) {
    const t = c.currentTime + i * 0.18;
    const buf = c.createBuffer(1, c.sampleRate * 0.06, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let j = 0; j < data.length; j++) {
      data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (c.sampleRate * 0.01));
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    const g = c.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
    src.connect(lp).connect(g).connect(c.destination);
    src.start(t);
  }
}

function synthBellToll(c: AudioContext) {
  const dur = 2.0;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 220;
  const osc2 = c.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 550;
  const g = c.createGain();
  g.gain.setValueAtTime(0.4, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + dur);
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0.15, c.currentTime);
  g2.gain.exponentialRampToValueAtTime(0.01, c.currentTime + dur * 0.6);
  osc.connect(g).connect(c.destination);
  osc2.connect(g2).connect(c.destination);
  osc.start();
  osc2.start();
  osc.stop(c.currentTime + dur);
  osc2.stop(c.currentTime + dur);
}

function synthWhisper(c: AudioContext) {
  const dur = 0.8;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.15;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1200;
  bp.Q.value = 3;
  const g = c.createGain();
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(0.2, c.currentTime + 0.1);
  g.gain.linearRampToValueAtTime(0.2, c.currentTime + dur - 0.2);
  g.gain.linearRampToValueAtTime(0, c.currentTime + dur);
  src.connect(bp).connect(g).connect(c.destination);
  src.start();
}

function synthCrowdGasp(c: AudioContext) {
  for (let v = 0; v < 5; v++) {
    const dur = 0.3 + Math.random() * 0.3;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.1;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600 + Math.random() * 800;
    bp.Q.value = 2;
    const g = c.createGain();
    const t = c.currentTime + Math.random() * 0.15;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.15, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.01, t + dur);
    src.connect(bp).connect(g).connect(c.destination);
    src.start(t);
  }
}

const SFX_REGISTRY: Record<string, SfxBuilder> = {
  'dragon-roar': synthDragonRoar,
  'thunder': synthThunder,
  'sword-clash': synthSwordClash,
  'heartbeat': synthHeartbeat,
  'signet-crackle': synthSignetCrackle,
  'explosion': synthExplosion,
  'door-creak': synthDoorCreak,
  'crowd-gasp': synthCrowdGasp,
  'arrow-impact': synthArrowImpact,
  'ward-hum': synthWardHum,
  'bone-snap': synthBoneSnap,
  'fire-whoosh': synthFireWhoosh,
  'horse-gallop': synthHorseGallop,
  'bell-toll': synthBellToll,
  'whisper': synthWhisper,
};

// === AMBIENCE SYNTHESIS REGISTRY ===
// Each builder creates a looping ambience using oscillators / noise.

type AmbienceBuilder = (c: AudioContext, master: GainNode) => AmbienceState;

function buildRainAmbience(c: AudioContext, mg: GainNode): AmbienceState {
  const dur = 2;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.3;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 600;
  src.connect(lp).connect(mg);
  src.start();
  return { nodes: [lp, mg], sources: [src], gainNode: mg };
}

function buildWindAmbience(c: AudioContext, mg: GainNode): AmbienceState {
  const dur = 3;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.2;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 300;
  bp.Q.value = 0.5;
  src.connect(bp).connect(mg);
  src.start();
  return { nodes: [bp, mg], sources: [src], gainNode: mg };
}

function buildTavernAmbience(c: AudioContext, mg: GainNode): AmbienceState {
  const sources: AudioBufferSourceNode[] = [];
  const dur = 2;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.08;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 500;
  bp.Q.value = 1;
  src.connect(bp).connect(mg);
  src.start();
  sources.push(src);
  return { nodes: [bp, mg], sources, gainNode: mg };
}

function buildForestAmbience(c: AudioContext, mg: GainNode): AmbienceState {
  const dur = 4;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.05 + Math.sin(i / 500) * 0.03;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2000;
  bp.Q.value = 0.3;
  src.connect(bp).connect(mg);
  src.start();
  return { nodes: [bp, mg], sources: [src], gainNode: mg };
}

function buildCombatDrumsAmbience(c: AudioContext, mg: GainNode): AmbienceState {
  const sources: AudioBufferSourceNode[] = [];
  const dur = 1.6;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  const beatLen = c.sampleRate * 0.08;
  for (let beat = 0; beat < 4; beat++) {
    const offset = Math.floor(beat * (c.sampleRate * 0.4));
    for (let i = 0; i < beatLen && offset + i < data.length; i++) {
      data[offset + i] = (Math.random() * 2 - 1) * 0.4 * Math.exp(-i / (c.sampleRate * 0.02));
    }
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 250;
  src.connect(lp).connect(mg);
  src.start();
  sources.push(src);
  return { nodes: [lp, mg], sources, gainNode: mg };
}

function buildTensionDroneAmbience(c: AudioContext, mg: GainNode): AmbienceState {
  const osc1 = c.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = 55;
  const osc2 = c.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 56.5;
  const g1 = c.createGain();
  g1.gain.value = 0.3;
  const g2 = c.createGain();
  g2.gain.value = 0.3;
  osc1.connect(g1).connect(mg);
  osc2.connect(g2).connect(mg);
  osc1.start();
  osc2.start();
  return { nodes: [g1, g2, mg], sources: [], gainNode: mg };
}

function buildCampfireAmbience(c: AudioContext, mg: GainNode): AmbienceState {
  const dur = 2;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.15 * (Math.sin(i / 200) > 0.5 ? 1 : 0.2);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 400;
  bp.Q.value = 1;
  src.connect(bp).connect(mg);
  src.start();
  return { nodes: [bp, mg], sources: [src], gainNode: mg };
}

function buildDungeonAmbience(c: AudioContext, mg: GainNode): AmbienceState {
  const dur = 3;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.04;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 200;
  src.connect(lp).connect(mg);
  src.start();

  const drip = c.createOscillator();
  drip.type = 'sine';
  drip.frequency.value = 1200;
  const dg = c.createGain();
  dg.gain.value = 0;
  drip.connect(dg).connect(mg);
  drip.start();

  return { nodes: [lp, dg, mg], sources: [src], gainNode: mg };
}

function buildCrowdAmbience(c: AudioContext, mg: GainNode): AmbienceState {
  const dur = 2;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.12;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 700;
  bp.Q.value = 0.8;
  src.connect(bp).connect(mg);
  src.start();
  return { nodes: [bp, mg], sources: [src], gainNode: mg };
}

function buildFlyingAmbience(c: AudioContext, mg: GainNode): AmbienceState {
  const dur = 3;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.25;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 400;
  bp.Q.value = 0.3;
  src.connect(bp).connect(mg);
  src.start();
  return { nodes: [bp, mg], sources: [src], gainNode: mg };
}

const AMBIENCE_BUILDERS: Record<string, AmbienceBuilder> = {
  'rain': buildRainAmbience,
  'wind': buildWindAmbience,
  'tavern': buildTavernAmbience,
  'forest': buildForestAmbience,
  'combat-drums': buildCombatDrumsAmbience,
  'tension-drone': buildTensionDroneAmbience,
  'campfire': buildCampfireAmbience,
  'dungeon': buildDungeonAmbience,
  'crowd': buildCrowdAmbience,
  'flying': buildFlyingAmbience,
};

// === PUBLIC API ===

export function playSFX(name: string): void {
  try {
    const c = getCtx();

    // Fast path: if already cached, play immediately
    const cached = getCachedBuffer('sfx', name);
    if (cached) {
      const source = c.createBufferSource();
      source.buffer = cached;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.5, c.currentTime);
      source.connect(gain).connect(c.destination);
      source.start();
      return;
    }

    // Try to load the real file with a timeout race
    // If it loads within 800ms, play the real file
    // If not, fall back to synth
    const synthBuilder = SFX_REGISTRY[name];
    let synthPlayed = false;

    const timeout = setTimeout(() => {
      if (!synthPlayed && synthBuilder) {
        synthPlayed = true;
        synthBuilder(c);
      }
    }, 800);

    loadAudioBuffer(c, 'sfx', name).then(buffer => {
      clearTimeout(timeout);
      if (buffer && !synthPlayed) {
        const source = c.createBufferSource();
        source.buffer = buffer;
        const gain = c.createGain();
        gain.gain.setValueAtTime(0.5, c.currentTime);
        source.connect(gain).connect(c.destination);
        source.start();
      } else if (!buffer && !synthPlayed && synthBuilder) {
        synthPlayed = true;
        synthBuilder(c);
      }
    }).catch(() => {
      clearTimeout(timeout);
      if (!synthPlayed && synthBuilder) {
        synthPlayed = true;
        synthBuilder(c);
      }
    });
  } catch {
    // Audio not available — silent fail
  }
}

export function setAmbience(name: string): void {
  try {
    if (name === 'silence') {
      if (currentAmbience) {
        stopAmbienceLoop(currentAmbience);
        currentAmbience = null;
        currentAmbienceName = null;
      }
      return;
    }

    // Don't restart the same ambience
    if (name === currentAmbienceName) return;

    const c = getCtx();

    // Fade out old ambience
    if (currentAmbience) {
      stopAmbienceLoop(currentAmbience, 1.5);
    }

    // Try cached real audio file first
    const buffer = getCachedBuffer('ambience', name);
    if (buffer) {
      const mg = c.createGain();
      mg.gain.setValueAtTime(0, c.currentTime);
      mg.connect(c.destination);
      mg.gain.linearRampToValueAtTime(0.4, c.currentTime + 1.5);

      const source = c.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(mg);
      source.start();

      currentAmbience = { nodes: [mg], sources: [source], gainNode: mg };
      currentAmbienceName = name;
      return;
    }

    // Fall back to synthesized ambience
    const builder = AMBIENCE_BUILDERS[name];
    if (!builder) return;

    const mg = c.createGain();
    mg.gain.setValueAtTime(0, c.currentTime);
    mg.connect(c.destination);
    mg.gain.linearRampToValueAtTime(1, c.currentTime + 1.5);

    currentAmbience = builder(c, mg);
    currentAmbienceName = name;

    // Kick off background loading for next time (non-blocking)
    loadAudioBuffer(c, 'ambience', name).catch(() => {});
  } catch {
    // Audio not available — silent fail
  }
}

/** Stop all audio (called when slideshow closes) */
export function stopAll(): void {
  if (currentAmbience) {
    stopAmbienceLoop(currentAmbience, 0.5);
    currentAmbience = null;
    currentAmbienceName = null;
  }
}
