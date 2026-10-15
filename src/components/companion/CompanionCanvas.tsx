import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { CompanionRig } from '@/lib/companion-rig';
import { Behavior, freshFeelings, gapAfter, makeBehavior, narrate, notifyAlert, notifyTouch, notifyTreat, pickNextBehavior, poseFor, tickFeelings, Pose } from '@/lib/companion-idle';

// A procedurally animated 2D companion at a night campfire.
// Everything is drawn in code each frame; the loop stops when hidden.

export interface CompanionCanvasHandle {
  tossTreat: () => void;
  wake: () => void;
}

interface Props {
  rig: CompanionRig;
  active: boolean;
  onBond?: (amount: number, reason: string) => void;
  onReaction?: (text: string) => void;
}

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; kind: 'ember' | 'heart' | 'dust' | 'z' | 'crumb' };

const CHASSIS = {
  // amp = how far the chest rises; sway = sideways sinuous drift; tick = mechanical stepping
  prowler:   { len: 118, h: 44, leg: 58, head: 21, neck: 26, legW: 11, amp: 1.3, sway: 0, tick: 0, hz: 1 },
  behemoth:  { len: 128, h: 64, leg: 48, head: 27, neck: 16, legW: 17, amp: 3.0, sway: 0, tick: 0, hz: 0.6 },
  drake:     { len: 124, h: 48, leg: 50, head: 21, neck: 34, legW: 12, amp: 1.5, sway: 3, tick: 0, hz: 0.8 },
  automaton: { len: 118, h: 52, leg: 56, head: 23, neck: 22, legW: 13, amp: 1.0, sway: 0, tick: 6, hz: 1.2 },
} as const;

const TEMPER = {
  feral:    { wag: 0.6, gazeLazy: 0.12, breath: 0.38 },
  sentinel: { wag: 0.35, gazeLazy: 0.07, breath: 0.3 },
  reckless: { wag: 1.0, gazeLazy: 0.18, breath: 0.45 },
  cunning:  { wag: 0.45, gazeLazy: 0.05, breath: 0.28 },
} as const;

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* ignore */ } };

export const CompanionCanvas = forwardRef<CompanionCanvasHandle, Props>(function CompanionCanvas(
  { rig, active, onBond, onReaction }, ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rigRef = useRef(rig); rigRef.current = rig;
  const cbRef = useRef({ onBond, onReaction }); cbRef.current = { onBond, onReaction };

  // Mutable simulation state (never triggers React renders)
  const sim = useRef({
    t: 0, gx: 0, gy: 0, hasGaze: false, headAng: -0.35, pupilX: 0, pupilY: 0,
    blink: 0, nextBlink: 3, jaw: 0, jawTarget: 0, ear: 0, earV: 0,
    vigilance: 0.5, affection: 0.3, stress: 0.1, purr: 0, recoil: 0,
    idle: 0, sleep: 0, sleeping: false, sneeze: 0, kick: 0,
    treat: null as null | { x: number; y: number; vx: number; vy: number },
    feel: freshFeelings(), beh: null as null | Behavior, behT: 0, nextBeh: 2, pendingLook: false,
    pose: poseFor(null, 0, 0) as Pose,
    particles: [] as Particle[], lastBondAt: 0, stroke: 0,
    pointer: { down: false, x: 0, y: 0, lx: 0, ly: 0, downAt: 0, moved: 0, lastTap: 0, zone: '' as string },
    geo: { headX: 0, headY: 0, headR: 20, bodyX: 0, bodyY: 0, bodyL: 100, bodyH: 40, mouthX: 0, mouthY: 0, s: 1, W: 0, H: 0, fireX: 0, ground: 0 },
  });

  const react = (txt: string) => cbRef.current.onReaction?.(txt);
  const bond = (amt: number, why: string) => {
    const S = sim.current;
    if (S.t - S.lastBondAt < 1.2) return;
    S.lastBondAt = S.t;
    cbRef.current.onBond?.(amt, why);
  };
  const wakeUp = () => {
    const S = sim.current;
    if (S.sleeping) { S.sleeping = false; S.idle = 0; S.ear = 0.6; S.beh = makeBehavior('stretch', rigRef.current); S.behT = 0; react(`${rigRef.current.name} cracks one eye open and stretches.`); }
    S.idle = 0;
  };

  useImperativeHandle(ref, () => ({
    tossTreat: () => {
      const S = sim.current; S.feel = notifyTreat(S.feel); S.beh = null; S.pendingLook = false; const G = S.geo;
      wakeUp();
      S.treat = { x: G.W * 0.08, y: G.H * 0.85, vx: G.W * 0.55 + Math.random() * 40, vy: -G.H * 1.05 };
      S.vigilance = 1;
    },
    wake: wakeUp,
  }), []);

  // Pointer input
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const zoneAt = (x: number, y: number) => {
      const G = sim.current.geo;
      const dh = Math.hypot(x - G.headX, y - G.headY);
      if (Math.hypot(x - G.mouthX, y - G.mouthY) < G.headR * 0.6) return 'nose';
      if (dh < G.headR * 1.1) return y > G.headY + G.headR * 0.2 ? 'chin' : 'head';
      if (Math.abs(x - G.bodyX) < G.bodyL * 0.6 && Math.abs(y - G.bodyY) < G.bodyH * 0.75) return 'body';
      return 'air';
    };
    const down = (e: PointerEvent) => {
      const S = sim.current; const p = pos(e);
      c.setPointerCapture?.(e.pointerId);
      Object.assign(S.pointer, { down: true, x: p.x, y: p.y, lx: p.x, ly: p.y, downAt: S.t, moved: 0, zone: zoneAt(p.x, p.y) });
      S.feel = notifyTouch(S.feel); S.idle = 0;
      // polite interruption: big moments finish before it looks at you
      if (S.beh && !S.sleeping && S.behT / S.beh.duration < S.beh.finishBefore) { S.pendingLook = true; S.gx = p.x; S.gy = p.y; return; }
      if (S.beh && S.beh.kind !== 'stretch') S.beh = null;
      S.gx = p.x; S.gy = p.y; S.hasGaze = true;
      if (S.sleeping) { wakeUp(); return; }
    };
    const move = (e: PointerEvent) => {
      const S = sim.current; const p = pos(e); const P = S.pointer;
      S.gx = p.x; S.gy = p.y; S.hasGaze = true; S.idle = 0;
      if (!P.down) return;
      const d = Math.hypot(p.x - P.lx, p.y - P.ly);
      P.moved += d; P.lx = p.x; P.ly = p.y;
      const z = zoneAt(p.x, p.y);
      if (z === 'chin' || z === 'head' || z === 'body') {
        S.stroke += d;
        S.purr = Math.min(1, S.purr + d / 220);
        S.affection = Math.min(1, S.affection + d / 4000);
        if (z === 'head' && S.stroke > 600) S.kick = 1;
        if (S.stroke > 160) {
          S.stroke = 0;
          buzz([8, 30, 8]);
          for (let i = 0; i < 2; i++) S.particles.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 30, life: 0, max: 1.4, kind: 'heart' });
          bond(1, z === 'chin' ? 'chin scratch' : 'stroke');
        }
      }
    };
    const up = (e: PointerEvent) => {
      const S = sim.current; const P = S.pointer; const p = pos(e);
      if (!P.down) return;
      P.down = false;
      const held = S.t - P.downAt;
      if (P.moved < 12) {
        const z = zoneAt(p.x, p.y);
        const dbl = S.t - P.lastTap < 0.35;
        P.lastTap = S.t;
        if (held > 0.6 && z === 'head') {
          S.purr = 1; S.stress = Math.max(0, S.stress - 0.4); S.jawTarget = 0;
          buzz([20, 60, 20, 60, 20]); bond(2, 'forehead press');
          react(`${rigRef.current.name} lowers its head into your palm and sighs.`);
        } else if (z === 'nose') {
          S.sneeze = 1; buzz(25);
          react(`${rigRef.current.name} sneezes and shakes its head, offended.`);
        } else if (z === 'body' && dbl) {
          S.recoil = 1; S.vigilance = 1; S.jawTarget = 0.7; buzz([30, 40, 50]);
          react(`${rigRef.current.name} plants its paws and huffs — ready for war.`);
          setTimeout(() => { sim.current.jawTarget = 0; }, 450);
        } else if (z === 'air') {
          S.ear = 0.8; S.vigilance = Math.min(1, S.vigilance + 0.2);
        }
      }
    };
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    return () => {
      c.removeEventListener('pointerdown', down);
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up);
      c.removeEventListener('pointercancel', up);
    };
  }, []);

  // Render loop
  useEffect(() => {
    if (!active) return;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    let raf = 0; let last = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = c.clientWidth, H = c.clientHeight;
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      step(dt, W, H);
      draw(ctx, W, H);
    };

    const step = (dt: number, W: number, H: number) => {
      const S = sim.current; const R = rigRef.current;
      S.t += dt; S.idle += dt;
      // brain drift
      S.purr = Math.max(0, S.purr - dt * 0.35);
      S.recoil = Math.max(0, S.recoil - dt * 2.5);
      S.sneeze = Math.max(0, S.sneeze - dt * 1.8);
      S.kick = Math.max(0, S.kick - dt * 0.6);
      S.vigilance = lerp(S.vigilance, S.hasGaze ? 0.65 : 0.4, dt * 0.3);
      S.affection = lerp(S.affection, R.bond / 100, dt * 0.05);
      if (S.idle > 4) S.hasGaze = false;
      // ---------- idle director ----------
      S.feel = tickFeelings(S.feel, dt * (1 + R.bond / 200), R.temperament, S.idle, S.sleeping);
      if (S.beh) {
        S.behT += dt;
        if (S.behT >= S.beh.duration) {
          const done = S.beh; S.beh = null; S.nextBeh = gapAfter(R.temperament, Math.random);
          if (done.kind === 'alert') react(`${R.name} decides the camp is safe and settles again.`);
          if (S.pendingLook) { S.pendingLook = false; S.beh = makeBehavior('glance', R); S.behT = 0; S.hasGaze = true; }
        }
      } else if (!S.sleeping && !S.treat && !S.pointer.down) {
        S.nextBeh -= dt;
        if (S.nextBeh <= 0 && S.idle > 2) {
          const d = pickNextBehavior(S.feel, R, S.idle, Math.random);
          if (d === 'sleep') {
            S.sleeping = true; react(R.head === 'visor' ? `${R.name} folds down by the fire and powers down.` : `${R.name} circles twice and curls up by the fire.`);
          } else if (d) {
            S.beh = d; S.behT = 0; S.hasGaze = false;
            if (d.kind === 'alert') S.feel = notifyAlert(S.feel);
            const line = narrate(d, R.name); if (line && Math.random() < 0.6) react(line);
          }
          S.nextBeh = gapAfter(R.temperament, Math.random);
        }
      }
      S.pose = poseFor(S.beh, S.beh ? S.behT / S.beh.duration : 0, S.t);
      if (S.pose.earKick) S.earV += S.pose.earKick * dt * 12;
      // where the eyes go during a behaviour
      if (!S.hasGaze && S.beh) {
        const G0 = S.geo; const g = S.pose.gaze;
        if (g === 'fire') { S.gx = G0.fireX; S.gy = G0.ground - 20; }
        else if (g === 'treeline') { S.gx = G0.W * 0.95; S.gy = G0.ground - G0.H * 0.3; }
        else if (g === 'ground') { S.gx = G0.headX + 40; S.gy = G0.ground; }
        else if (g === 'player') { S.gx = G0.W * 0.5; S.gy = G0.H * 0.95; }
        else if (g === 'spark') { const e = S.particles.find(p => p.kind === 'ember' && p.life > 0.3); if (e) { S.gx = e.x; S.gy = e.y; } }
      }
      S.sleep = lerp(S.sleep, S.sleeping ? 1 : 0, dt * (S.sleeping ? 0.8 : 3));
      // blinking
      S.nextBlink -= dt;
      if (S.nextBlink <= 0) { S.blink = 1; S.nextBlink = 3.8 + Math.random() * 2.4; if (Math.random() < 0.25) S.nextBlink = 0.22; }
      S.blink = Math.max(0, S.blink - dt * 7);
      // ear spring
      const earF = -S.ear * 60 - S.earV * 6; S.earV += earF * dt; S.ear += S.earV * dt;
      if (Math.random() < dt * 0.15) S.earV += (Math.random() - 0.5) * 4;
      // jaw
      S.jaw = lerp(S.jaw, Math.max(S.jawTarget, S.pose.jaw), dt * 12);
      // treat physics
      const G = S.geo;
      if (S.treat) {
        const tr = S.treat;
        tr.vy += H * 1.6 * dt; tr.x += tr.vx * dt; tr.y += tr.vy * dt;
        S.gx = tr.x; S.gy = tr.y; S.hasGaze = true; S.idle = 0;
        const dm = Math.hypot(tr.x - G.mouthX, tr.y - G.mouthY);
        S.jawTarget = dm < G.headR * 3 ? 0.9 : 0.25;
        if (dm < G.headR * 0.9) {
          S.treat = null; S.jawTarget = 0; S.jaw = 0.1; buzz([15, 20, 15]);
          for (let i = 0; i < 6; i++) S.particles.push({ x: G.mouthX, y: G.mouthY, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 60, life: 0, max: 0.7, kind: 'crumb' });
          bond(3, 'treat');
          react(`${R.name} snatches the treat out of the air. Crunch.`);
        } else if (tr.y > H + 20 || tr.x > W + 20) {
          S.treat = null; S.jawTarget = 0; react(`${R.name} watches the treat sail past, unimpressed.`);
        }
      }
      // embers + particles
      if (Math.random() < dt * 9) S.particles.push({ x: G.fireX + (Math.random() - 0.5) * 18, y: G.ground - 18, vx: (Math.random() - 0.3) * 20, vy: -30 - Math.random() * 40, life: 0, max: 2 + Math.random() * 2, kind: 'ember' });
      if (S.sleeping && Math.random() < dt * 0.7) S.particles.push({ x: G.headX + 10, y: G.headY - 14, vx: 8, vy: -14, life: 0, max: 2.4, kind: 'z' });
      for (const p of S.particles) {
        p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.kind === 'ember') { p.vx += Math.sin(S.t * 3 + p.y * 0.05) * 6 * dt; }
        if (p.kind === 'crumb') p.vy += 220 * dt;
      }
      S.particles = S.particles.filter(p => p.life < p.max).slice(-160);
    };

    const draw = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
      const S = sim.current; const R = rigRef.current; const C = CHASSIS[R.chassis]; const T = TEMPER[R.temperament];
      const s = Math.min(W / 380, H / 300) * 1.05;
      const ground = H * 0.82; const fireX = W * 0.16;
      // ---------- backdrop ----------
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#05070d'); sky.addColorStop(0.6, '#0d1220'); sky.addColorStop(1, '#1a130d');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // stars
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 40; i++) { const x = (i * 97.3) % W, y = (i * 53.7) % (H * 0.45); const tw = 0.5 + 0.5 * Math.sin(S.t * 1.3 + i); ctx.globalAlpha = 0.2 + tw * 0.4; ctx.fillRect(x, y, 1.2, 1.2); }
      ctx.globalAlpha = 1;
      // pine silhouettes
      ctx.fillStyle = '#070a10';
      for (let i = 0; i < 9; i++) { const x = (i / 8) * W + ((i * 37) % 23) - 10, h = H * (0.25 + ((i * 13) % 7) / 30); ctx.beginPath(); ctx.moveTo(x - h * 0.22, ground - 6); ctx.lineTo(x, ground - h - 6); ctx.lineTo(x + h * 0.22, ground - 6); ctx.fill(); }
      // ground
      const gg = ctx.createLinearGradient(0, ground - 10, 0, H); gg.addColorStop(0, '#1d1710'); gg.addColorStop(1, '#0c0906');
      ctx.fillStyle = gg; ctx.fillRect(0, ground - 6, W, H - ground + 6);
      // fire
      const flick = 0.85 + 0.15 * Math.sin(S.t * 13) * Math.sin(S.t * 7.3 + 1) + Math.random() * 0.05;
      ctx.fillStyle = '#2a1a10'; ctx.fillRect(fireX - 22, ground - 6, 44, 6);
      for (let i = 0; i < 3; i++) {
        const fh = (34 - i * 9) * flick * s, fw = (16 - i * 4) * s;
        ctx.fillStyle = ['#c2410c', '#f59e0b', '#fde68a'][i];
        ctx.beginPath(); ctx.moveTo(fireX - fw, ground - 4);
        ctx.quadraticCurveTo(fireX - fw * 0.6 + Math.sin(S.t * 9 + i) * 3, ground - fh * 0.6, fireX + Math.sin(S.t * 11 + i) * 4, ground - fh);
        ctx.quadraticCurveTo(fireX + fw * 0.6, ground - fh * 0.5, fireX + fw, ground - 4); ctx.fill();
      }

      // ---------- creature geometry ----------
      const sleepK = S.sleep;
      const bodyL = C.len * s * (0.95 + R.build * 0.12);
      const bodyH = C.h * s * (0.82 + R.build * 0.4);
      const legL = C.leg * s * (1 - sleepK * 0.7);
      const legW = C.legW * s * (0.8 + R.build * 0.45);
      const headR = C.head * s * (0.92 + R.build * 0.15);
      const breathHz = (S.stress > 0.6 ? 1.2 : T.breath) * (S.sleeping ? 0.7 : 1);
      const tt = C.tick ? Math.floor(S.t * C.tick) / C.tick : S.t;
      const ph = tt * Math.PI * 2 * breathHz * C.hz;
      const breath = Math.sin(ph) + 0.25 * Math.sin(ph * 2 + 0.7);
      const bx = W * 0.6 - S.recoil * 10 * s + Math.sin(S.t * 0.9) * C.sway * s + S.pose.shakeX * s;
      const by = ground - legL - bodyH * 0.35 + breath * C.amp * s + sleepK * bodyH * 0.05 + S.pose.crouch * bodyH * 0.15;
      const chest = 1 + breath * 0.035;
      const G = S.geo; Object.assign(G, { bodyX: bx, bodyY: by, bodyL, bodyH, s, W, H, fireX, ground });

      const pelt = R.pelt, far = shade(pelt, -0.35), belly = R.belly;
      const metal = R.chassis === 'automaton';

      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.ellipse(bx, ground, bodyL * 0.62, 7 * s * (1 - breath * 0.03), 0, 0, Math.PI * 2); ctx.fill();

      const hipX = bx - bodyL * 0.34, shX = bx + bodyL * 0.32, legTop = by + bodyH * 0.15;
      const leg = (x: number, footX: number, col: string, front: boolean, lift = 0) => {
        const fy = ground - lift;
        const kx = (x + footX) / 2 + (front ? -1 : 1) * legL * 0.18 * (1 + sleepK);
        const ky = (legTop + fy) / 2 - sleepK * legL * 0.3;
        ctx.strokeStyle = col; ctx.lineWidth = legW; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(x, legTop); ctx.lineTo(kx, ky); ctx.lineTo(footX + (sleepK * (front ? 14 : -10) * s), fy - legW * 0.3); ctx.stroke();
        // paw
        const fx = footX + (front ? 4 : 2) * s + sleepK * (front ? 14 : -10) * s;
        if (R.feet === 'paws') { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(fx, fy - legW * 0.35, legW * 0.75, legW * 0.42, 0, 0, Math.PI * 2); ctx.fill(); }
        else if (R.feet === 'pads') { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(fx + legW * 0.2, fy - legW * 0.3, legW * 1.05, legW * 0.38, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(fx + legW * (0.5 + i * 0.25), fy - legW * 0.12, legW * 0.12, 0, Math.PI * 2); ctx.fill(); } }
        else if (R.feet === 'hooves') { ctx.fillStyle = '#1c1917'; ctx.beginPath(); ctx.moveTo(fx - legW * 0.45, fy - legW * 0.9); ctx.lineTo(fx + legW * 0.45, fy - legW * 0.9); ctx.lineTo(fx + legW * 0.65, fy); ctx.lineTo(fx - legW * 0.6, fy); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.moveTo(fx, fy - legW * 0.85); ctx.lineTo(fx + legW * 0.1, fy); ctx.stroke(); }
        else { ctx.strokeStyle = shade(R.belly, -0.3); ctx.lineWidth = Math.max(1.5 * s, legW * 0.22); ctx.lineCap = 'round'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(fx, fy - legW * 0.4); ctx.quadraticCurveTo(fx + legW * (0.4 + i * 0.5), fy - legW * 0.5, fx + legW * (0.9 + i * 0.6), fy); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(fx, fy - legW * 0.4); ctx.lineTo(fx - legW * 0.8, fy); ctx.stroke(); }
        if (metal) { ctx.fillStyle = shade(R.accent, -0.2); ctx.beginPath(); ctx.arc(kx, ky, legW * 0.45, 0, Math.PI * 2); ctx.fill(); }
        if (!front || R.paws === 'none') return;
        const px = footX + 4 * s + sleepK * 14 * s;
        if (R.paws === 'wraps') { ctx.strokeStyle = '#d8cfbd'; ctx.lineWidth = 2 * s; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(px - legW * 0.5, fy - legW * (0.9 + i * 0.4)); ctx.lineTo(px + legW * 0.5, fy - legW * (0.6 + i * 0.4)); ctx.stroke(); } }
        if (R.paws === 'blades') { ctx.fillStyle = '#cbd5e1'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(px + legW * 0.4, fy - legW * 0.2 - i * 3 * s); ctx.lineTo(px + legW * 1.4, fy - legW * 0.1 - i * 3 * s); ctx.lineTo(px + legW * 0.4, fy - legW * 0.5 - i * 3 * s); ctx.fill(); } }
      };
      const kick = S.kick > 0 ? Math.abs(Math.sin(S.t * 28)) * 14 * s * S.kick : 0;
      // far legs
      leg(hipX + 6 * s, hipX - 4 * s, far, false);
      leg(shX + 6 * s, shX + 14 * s, far, true);

      // tail (procedural chain)
      const tailN = 7; const tailLen = bodyL * (R.tail === 'whip' ? 0.8 : 0.6);
      const wagAmp = (0.15 + R.bond / 100 * 0.35 + S.purr * 0.3) * T.wag * (S.sleeping ? 0.15 : 1);
      const wagF = 2 + S.purr * 4 + S.affection * 2;
      let tx = bx - bodyL * 0.48, ty = by - bodyH * 0.12;
      const baseA = Math.PI + (S.sleeping ? -0.3 : 0.7 - (1 - S.vigilance) * 0.4);
      const pts: [number, number][] = [[tx, ty]];
      for (let i = 1; i <= tailN; i++) {
        const k = i / tailN;
        const a = baseA + Math.sin(S.t * wagF - i * 0.55) * wagAmp * k + (S.sleeping ? -k * 0.5 : -k * 1.4);
        tx += Math.cos(a) * tailLen / tailN; ty += Math.sin(a) * tailLen / tailN;
        pts.push([tx, ty]);
      }
      for (let i = 0; i < tailN; i++) {
        const k = i / tailN; ctx.strokeStyle = R.tail === 'chain' ? shade(pelt, -0.1 + (i % 2) * 0.2) : pelt;
        ctx.lineWidth = Math.max(2 * s, legW * (R.tail === 'plume' ? 1.1 + k * 0.6 : 0.95 - k * 0.7)); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
      }
      const tip = pts[tailN];
      if (R.tail === 'plume') { ctx.fillStyle = belly; ctx.beginPath(); ctx.arc(tip[0], tip[1], legW * 0.9, 0, Math.PI * 2); ctx.fill(); }
      if (R.tail === 'club') { ctx.fillStyle = shade(pelt, -0.2); ctx.beginPath(); ctx.arc(tip[0], tip[1], legW * 1.1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#d6d3d1'; for (let a = 0; a < 6; a++) { const aa = a * 1.05; ctx.beginPath(); ctx.moveTo(tip[0] + Math.cos(aa) * legW, tip[1] + Math.sin(aa) * legW); ctx.lineTo(tip[0] + Math.cos(aa) * legW * 1.7, tip[1] + Math.sin(aa) * legW * 1.7); ctx.lineTo(tip[0] + Math.cos(aa + 0.3) * legW, tip[1] + Math.sin(aa + 0.3) * legW); ctx.fill(); } }
      if (R.tail === 'whip') { ctx.fillStyle = R.accent; ctx.beginPath(); ctx.moveTo(tip[0], tip[1] - 5 * s); ctx.lineTo(tip[0] - 9 * s, tip[1]); ctx.lineTo(tip[0], tip[1] + 5 * s); ctx.fill(); }

      // torso
      const torso = new Path2D();
      if (metal) {
        const r = 12 * s; const x0 = bx - bodyL / 2, y0 = by - bodyH / 2;
        torso.roundRect?.(x0, y0, bodyL, bodyH * chest, r);
        if (!torso.roundRect) torso.rect(x0, y0, bodyL, bodyH * chest);
      } else {
        torso.ellipse(bx - bodyL * 0.05, by, bodyL * 0.52, bodyH * 0.5 * chest, 0, 0, Math.PI * 2);
        torso.ellipse(bx + bodyL * 0.28, by - bodyH * 0.05, bodyH * 0.55 * chest * (R.chassis === 'behemoth' ? 1.15 : 1), bodyH * 0.55 * chest, 0, 0, Math.PI * 2);
        if (R.chassis === 'behemoth') torso.ellipse(bx + bodyL * 0.15, by - bodyH * 0.42, bodyL * 0.22, bodyH * 0.25, 0, 0, Math.PI * 2);
      }
      ctx.fillStyle = pelt; ctx.fill(torso);
      ctx.save(); ctx.clip(torso);
      // belly band
      const bg = ctx.createLinearGradient(0, by, 0, by + bodyH * 0.6); bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(0.45, belly); bg.addColorStop(1, belly);
      ctx.fillStyle = bg; ctx.globalAlpha = 0.85; ctx.fillRect(bx - bodyL, by, bodyL * 2, bodyH);
      ctx.globalAlpha = 1;
      // top light from sky, warm side light from fire
      const tl = ctx.createLinearGradient(0, by - bodyH / 2, 0, by + bodyH / 2); tl.addColorStop(0, 'rgba(255,255,255,0.08)'); tl.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = tl; ctx.fillRect(bx - bodyL, by - bodyH, bodyL * 2, bodyH * 2);
      // patterns
      const glowPulse = 0.6 + 0.4 * Math.sin(ph);
      if (R.pattern === 'stripes') { ctx.strokeStyle = shade(pelt, -0.55); ctx.lineWidth = 4 * s; for (let i = 0; i < 7; i++) { const x = bx - bodyL * 0.45 + i * bodyL * 0.13; ctx.beginPath(); ctx.moveTo(x, by - bodyH * 0.55); ctx.quadraticCurveTo(x + 6 * s, by - bodyH * 0.1, x - 2 * s, by + bodyH * 0.1); ctx.stroke(); } }
      if (R.pattern === 'spots') { ctx.fillStyle = shade(pelt, -0.5); for (let i = 0; i < 14; i++) { const x = bx - bodyL * 0.45 + ((i * 37) % 100) / 100 * bodyL * 0.9, y = by - bodyH * 0.4 + ((i * 53) % 60) / 100 * bodyH; ctx.beginPath(); ctx.arc(x, y, (2.5 + (i % 3)) * s, 0, Math.PI * 2); ctx.fill(); } }
      if (R.pattern === 'cracks' || R.pattern === 'runes') {
        ctx.shadowColor = R.accent; ctx.shadowBlur = 10 * s * glowPulse; ctx.strokeStyle = R.accent; ctx.globalAlpha = 0.55 + 0.45 * glowPulse; ctx.lineWidth = 1.8 * s;
        if (R.pattern === 'cracks') { for (let i = 0; i < 5; i++) { let x = bx - bodyL * 0.4 + i * bodyL * 0.18, y = by - bodyH * 0.45; ctx.beginPath(); ctx.moveTo(x, y); for (let j = 0; j < 4; j++) { x += ((i + j) % 2 ? 5 : -4) * s; y += bodyH * 0.14; ctx.lineTo(x, y); } ctx.stroke(); } }
        else { for (let i = 0; i < 6; i++) { const x = bx - bodyL * 0.38 + i * bodyL * 0.14, y = by - bodyH * 0.32; ctx.beginPath(); ctx.moveTo(x - 3 * s, y); ctx.lineTo(x, y - 5 * s); ctx.lineTo(x + 3 * s, y); ctx.moveTo(x, y - 5 * s); ctx.lineTo(x, y + 4 * s); ctx.stroke(); } }
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
      if (metal) { ctx.fillStyle = shade(R.accent, -0.1); for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(bx - bodyL * 0.42 + i * bodyL * 0.12, by - bodyH * 0.38, 1.8 * s, 0, Math.PI * 2); ctx.fill(); } ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.moveTo(bx - bodyL * 0.1, by - bodyH / 2); ctx.lineTo(bx - bodyL * 0.1, by + bodyH / 2); ctx.stroke(); }
      if (R.scars.ribs) { ctx.strokeStyle = shade(pelt, 0.45); ctx.lineWidth = 1.6 * s; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(bx - bodyL * 0.05 + i * 6 * s, by - bodyH * 0.25); ctx.lineTo(bx + bodyL * 0.08 + i * 6 * s, by + bodyH * 0.1); ctx.stroke(); } }
      ctx.restore();

      // back feature: wings, spines, shell (mane is drawn at the neck)
      if (R.back === 'wings') {
        const flap = Math.sin(ph) * 0.04 + (S.stress > 0.6 ? 0.12 : 0);
        const wx = bx + bodyL * 0.15, wy = by - bodyH * 0.35;
        const tipX = bx - bodyL * 0.45, tipY = by - bodyH * (0.95 + flap);
        ctx.fillStyle = shade(pelt, -0.3); ctx.globalAlpha = 0.92;
        ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(tipX, tipY);
        for (let i = 0; i < 3; i++) { const k = (i + 1) / 3; ctx.quadraticCurveTo(lerp(tipX, wx, k) - 6 * s, lerp(tipY, wy, k) + bodyH * 0.3, lerp(tipX, wx - bodyL * 0.1, k), lerp(tipY, wy, k) + bodyH * 0.12); }
        ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = shade(pelt, -0.5); ctx.lineWidth = 2.2 * s; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(tipX, tipY); ctx.stroke();
      }
      if (R.back === 'spines') {
        ctx.fillStyle = R.accent; for (let i = 0; i < 7; i++) { const x = bx - bodyL * 0.42 + i * bodyL * 0.12, h = (8 + (i % 3) * 3) * s; ctx.beginPath(); ctx.moveTo(x - 4 * s, by - bodyH * 0.46); ctx.lineTo(x - 1 * s, by - bodyH * 0.46 - h); ctx.lineTo(x + 4 * s, by - bodyH * 0.46); ctx.fill(); }
      }
      if (R.back === 'shell') {
        const sc = shade(R.accent, -0.45);
        ctx.fillStyle = sc; ctx.strokeStyle = shade(R.accent, -0.7); ctx.lineWidth = 1.8 * s;
        ctx.beginPath(); ctx.ellipse(bx - bodyL * 0.05, by - bodyH * 0.12, bodyL * 0.5, bodyH * 0.55 * chest, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        for (let i = 0; i < 4; i++) { const x = bx - bodyL * 0.4 + i * bodyL * 0.24; ctx.beginPath(); ctx.moveTo(x, by - bodyH * 0.12); ctx.lineTo(x + bodyL * 0.06, by - bodyH * 0.5); ctx.lineTo(x + bodyL * 0.18, by - bodyH * 0.5); ctx.lineTo(x + bodyL * 0.24, by - bodyH * 0.12); ctx.stroke(); }
      }
      // armor
      if (R.armor !== 'none') {
        const col = R.armor === 'leather' ? '#6b4423' : R.armor === 'chain' ? '#8b929c' : '#b8bec7';
        ctx.fillStyle = col; ctx.strokeStyle = shade(col.length === 7 ? col : '#888888', -0.4); ctx.lineWidth = 1.5 * s;
        ctx.beginPath(); ctx.ellipse(bx - bodyL * 0.02, by - bodyH * 0.2, bodyL * 0.36, bodyH * 0.32, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        if (R.armor === 'chain') { ctx.strokeStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.arc(bx - bodyL * 0.3 + i * bodyL * 0.06, by - bodyH * 0.3, 2 * s, 0, Math.PI * 2); ctx.stroke(); } }
        if (R.armor === 'plate') { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx - bodyL * 0.3, by - bodyH * 0.44, bodyL * 0.56, 2 * s); ctx.fillStyle = R.accent; ctx.beginPath(); ctx.arc(bx, by - bodyH * 0.32, 3 * s, 0, Math.PI * 2); ctx.fill(); }
      }

      // near legs
      leg(hipX, hipX - 10 * s, pelt, false, kick);
      leg(shX, shX + 8 * s, pelt, true);

      // ---------- neck & head ----------
      const nbx = bx + bodyL * 0.4, nby = by - bodyH * 0.25;
      const neckLen = (C.neck * s + headR) * (1 - sleepK * 0.35);
      const restA = S.sleeping ? 0.35 : -0.55;
      let want = restA;
      const lookAt = S.hasGaze || (S.beh && S.pose.gaze !== 'none');
      if (lookAt && !S.sleeping) want = clamp(Math.atan2(S.gy - nby, S.gx - nbx), -1.25, 0.45);
      if (!S.sleeping) want = clamp(want + S.pose.headDelta, -1.4, 0.9);
      if (S.purr > 0.3) want = Math.min(want, -0.8);
      const eased = lerp(S.headAng, want, Math.min(1, (T.gazeLazy * 60) * (1 / 60) * 2.2));
      S.headAng = eased + Math.sin(S.sneeze * 20) * 0.3 * S.sneeze;
      const neckA = lerp(restA, S.headAng, 0.5);
      const hx = nbx + Math.cos(neckA) * neckLen, hy = nby + Math.sin(neckA) * neckLen;
      ctx.strokeStyle = pelt; ctx.lineWidth = headR * (R.chassis === 'behemoth' ? 1.6 : 1.25); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(nbx - 6 * s, nby + 4 * s); ctx.lineTo(hx, hy); ctx.stroke();
      if (R.back === 'mane') {
        ctx.fillStyle = shade(pelt, -0.3);
        for (let i = 0; i < 9; i++) { const k = i / 8; const mx = lerp(nbx - bodyL * 0.15, hx, k), my = lerp(nby - 2 * s, hy, k); const a = neckA - Math.PI / 2 + Math.sin(S.t * 1.5 + i) * 0.08; const len = headR * (0.9 - k * 0.3) * (1 + R.build * 0.4);
          ctx.beginPath(); ctx.moveTo(mx - 5 * s, my); ctx.lineTo(mx + Math.cos(a - 0.4) * len, my + Math.sin(a - 0.4) * len); ctx.lineTo(mx + 5 * s, my); ctx.fill(); }
      }
      // collar
      if (R.collar !== 'none') {
        const cx = lerp(nbx, hx, 0.35), cy = lerp(nby, hy, 0.35);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(neckA + Math.PI / 2);
        ctx.fillStyle = R.collar === 'pendant' ? '#3f2a1a' : R.collar === 'spiked' ? '#334155' : '#7c4a24';
        ctx.fillRect(-headR * 0.75, -3 * s, headR * 1.5, 6 * s);
        if (R.collar === 'spiked') { ctx.fillStyle = '#e2e8f0'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * headR * 0.28 - 2.5 * s, -3 * s); ctx.lineTo(i * headR * 0.28, -9 * s); ctx.lineTo(i * headR * 0.28 + 2.5 * s, -3 * s); ctx.fill(); } }
        if (R.collar === 'pendant') { ctx.shadowColor = R.accent; ctx.shadowBlur = 8 * s * glowPulse; ctx.fillStyle = R.accent; ctx.beginPath(); ctx.moveTo(-headR * 0.8, 3 * s); ctx.lineTo(-headR * 0.8 - 4 * s, 10 * s); ctx.lineTo(-headR * 0.8 + 4 * s, 10 * s); ctx.fill(); ctx.shadowBlur = 0; }
        ctx.restore();
      }

      ctx.save(); ctx.translate(hx, hy); ctx.rotate(S.headAng);
      const mLen = headR * (0.75 + R.muzzle * 0.9);
      const earWob = S.ear * 0.5 + (S.vigilance - 0.5) * 0.4;
      // ears (behind skull)
      const earCol = shade(pelt, -0.1);
      const drawEar = (ox: number, scale: number, col: string) => {
        ctx.save(); ctx.translate(-headR * 0.25 + ox, -headR * 0.7); ctx.rotate(-0.5 + earWob - sleepK * 0.6);
        if (R.ears === 'pricked' || R.ears === 'tufted') {
          ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-headR * 0.3 * scale, 0); ctx.lineTo(0, -headR * 0.95 * scale); ctx.lineTo(headR * 0.3 * scale, 0); ctx.fill();
          if (R.ears === 'tufted') { ctx.strokeStyle = col; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(0, -headR * 0.95 * scale); ctx.lineTo(2 * s, -headR * 1.3 * scale); ctx.stroke(); }
          if (R.scars.ear && scale === 1) { ctx.fillStyle = sky; ctx.beginPath(); ctx.moveTo(headR * 0.12, -headR * 0.55); ctx.lineTo(headR * 0.3, -headR * 0.45); ctx.lineTo(headR * 0.22, -headR * 0.3); ctx.fill(); }
        } else if (R.ears === 'horns') {
          ctx.strokeStyle = '#d6cfc0'; ctx.lineWidth = 5 * s * scale; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-headR * 0.9, -headR * 0.8, -headR * 1.2, -headR * 0.1); ctx.stroke();
        } else if (R.ears === 'frills') {
          ctx.fillStyle = R.accent; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(0, 0); for (let i = 0; i < 4; i++) { ctx.lineTo(-headR * (0.3 + i * 0.25), -headR * (0.9 - i * 0.1)); ctx.lineTo(-headR * (0.4 + i * 0.25), -headR * 0.2); } ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
        }
        ctx.restore();
      };
      if (R.ears !== 'none') { drawEar(-4 * s, 0.85, far); drawEar(0, 1, earCol); }
      // ---------- head: each shape is built differently ----------
      const HS = R.head; const k = R.muzzle;
      const jawA = S.jaw * 0.45 + (S.stress > 0.6 ? 0.12 : 0);
      let snout = headR * 0.3 + mLen;
      let ex = headR * 0.32, ey = -headR * 0.28, er = headR * 0.24;
      let slit = R.chassis === 'prowler' || R.chassis === 'drake';
      const mouthDark = '#3b0d12';
      const teeth = (x0: number, x1: number, y: number, n: number, up = true) => { ctx.fillStyle = '#f1f5f9'; for (let i = 0; i < n; i++) { const x = lerp(x0, x1, (i + 0.5) / n); ctx.beginPath(); ctx.moveTo(x - 1.8 * s, y); ctx.lineTo(x, y + (up ? -1 : 1) * 4.5 * s); ctx.lineTo(x + 1.8 * s, y); ctx.fill(); } };
      if (HS === 'canid') {
        ctx.fillStyle = pelt; ctx.beginPath(); ctx.ellipse(0, 0, headR, headR * 0.86, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(headR * 0.3, -headR * 0.55); ctx.lineTo(headR * 0.3 + mLen, -headR * 0.12); ctx.lineTo(headR * 0.3 + mLen, headR * 0.12); ctx.lineTo(headR * 0.2, headR * 0.25); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(headR * 0.3 + mLen, -headR * 0.05, headR * 0.15, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.translate(headR * 0.1, headR * 0.3); ctx.rotate(jawA);
        ctx.fillStyle = shade(pelt, -0.1); ctx.beginPath(); ctx.moveTo(0, -headR * 0.1); ctx.lineTo(mLen * 0.95, -headR * 0.05); ctx.lineTo(mLen * 0.85, headR * 0.2); ctx.lineTo(0, headR * 0.3); ctx.closePath(); ctx.fill();
        if (jawA > 0.08) teeth(mLen * 0.3, mLen * 0.85, -headR * 0.08, 4);
        ctx.restore();
        if (jawA > 0.08) { ctx.fillStyle = mouthDark; ctx.beginPath(); ctx.moveTo(headR * 0.2, headR * 0.22); ctx.lineTo(headR * 0.25 + mLen * 0.9, headR * 0.12); ctx.lineTo(headR * 0.2 + mLen * 0.8, headR * 0.12 + jawA * mLen * 0.8); ctx.fill(); }
      } else if (HS === 'feline') {
        // round skull, flat face, tiny muzzle pad, whiskers
        const mw = headR * (0.32 + k * 0.22);
        snout = headR * 0.72 + mw;
        ctx.fillStyle = pelt; ctx.beginPath(); ctx.ellipse(0, -headR * 0.05, headR * 1.02, headR * 0.92, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = shade(belly, -0.05); ctx.beginPath(); ctx.ellipse(headR * 0.72, headR * 0.22, mw, headR * 0.36, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c0707a'; ctx.beginPath(); ctx.moveTo(headR * 0.72 + mw * 0.6, headR * 0.02); ctx.lineTo(headR * 0.72 + mw * 1.05, headR * 0.02); ctx.lineTo(headR * 0.72 + mw * 0.85, headR * 0.18); ctx.fill();
        ctx.save(); ctx.translate(headR * 0.55, headR * 0.45); ctx.rotate(jawA * 0.9);
        ctx.fillStyle = shade(belly, -0.15); ctx.beginPath(); ctx.ellipse(mw * 0.5, 0, mw * 0.75, headR * 0.16, 0, 0, Math.PI * 2); ctx.fill();
        if (jawA > 0.08) teeth(mw * 0.1, mw * 0.9, -headR * 0.1, 2);
        ctx.restore();
        ctx.strokeStyle = 'rgba(240,240,230,0.55)'; ctx.lineWidth = 0.9 * s;
        for (let i = -1; i <= 1; i++) { const wy = headR * (0.2 + i * 0.08); ctx.beginPath(); ctx.moveTo(headR * 0.8 + mw * 0.5, wy); ctx.quadraticCurveTo(headR * 1.4 + mw, wy + i * 3 * s - 2 * s + Math.sin(S.t * 2 + i) * s, headR * 1.8 + mw, wy + i * 7 * s); ctx.stroke(); }
        ex = headR * 0.42; ey = -headR * 0.18; er = headR * 0.3; slit = true;
      } else if (HS === 'ursine') {
        // broad heavy skull, boxy blunt muzzle, small deep-set eyes, jowls
        const ml = headR * (0.45 + k * 0.6);
        snout = headR * 0.45 + ml;
        ctx.fillStyle = pelt; ctx.beginPath(); ctx.ellipse(-headR * 0.05, -headR * 0.05, headR * 1.1, headR * 0.98, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = shade(belly, -0.2); ctx.beginPath(); ctx.roundRect?.(headR * 0.4, -headR * 0.35, ml, headR * 0.62, headR * 0.25); ctx.fill();
        ctx.fillStyle = shade(pelt, -0.15); ctx.beginPath(); ctx.ellipse(headR * 0.55, headR * 0.35, headR * 0.45, headR * 0.28, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0d0d0d'; ctx.beginPath(); ctx.roundRect?.(headR * 0.4 + ml - headR * 0.32, -headR * 0.4, headR * 0.36, headR * 0.26, headR * 0.1); ctx.fill();
        ctx.save(); ctx.translate(headR * 0.45, headR * 0.27); ctx.rotate(jawA * 0.8);
        ctx.fillStyle = shade(pelt, -0.2); ctx.beginPath(); ctx.roundRect?.(0, 0, ml * 0.9, headR * 0.28, headR * 0.12); ctx.fill();
        if (jawA > 0.08) teeth(ml * 0.15, ml * 0.8, 0, 3);
        ctx.restore();
        ex = headR * 0.22; ey = -headR * 0.42; er = headR * 0.15; slit = false;
      } else if (HS === 'beaked') {
        // feathered facial disc with a hooked raptor beak (owlbear)
        const bl = headR * (0.45 + k * 0.5);
        snout = headR * 0.5 + bl * 0.8;
        ctx.fillStyle = pelt; ctx.beginPath(); ctx.ellipse(-headR * 0.05, 0, headR * 1.05, headR * 0.95, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = shade(belly, 0.05);
        ctx.beginPath(); for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2; const r = headR * (0.72 + (i % 2) * 0.08); const x = headR * 0.2 + Math.cos(a) * r * 0.9, y = Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fill();
        ctx.strokeStyle = shade(belly, -0.25); ctx.lineWidth = 1 * s; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(headR * 0.2, 0, headR * (0.35 + i * 0.08), -0.9, 0.9); ctx.stroke(); }
        ctx.save(); ctx.translate(headR * 0.55, headR * 0.15); ctx.rotate(jawA * 0.7);
        ctx.fillStyle = '#8a7350'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(bl * 0.55, headR * 0.05); ctx.lineTo(0, headR * 0.22); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#d4b878'; ctx.beginPath(); ctx.moveTo(headR * 0.5, -headR * 0.32); ctx.quadraticCurveTo(headR * 0.55 + bl, -headR * 0.35, headR * 0.5 + bl * 0.85, headR * 0.28); ctx.quadraticCurveTo(headR * 0.5 + bl * 0.55, headR * 0.02, headR * 0.5, headR * 0.15); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(headR * 0.55, -headR * 0.28); ctx.quadraticCurveTo(headR * 0.5 + bl * 0.7, -headR * 0.3, headR * 0.5 + bl * 0.8, headR * 0.05); ctx.lineTo(headR * 0.55, -headR * 0.2); ctx.fill();
        ex = headR * 0.3; ey = -headR * 0.32; er = headR * 0.28; slit = false;
        ctx.fillStyle = shade(pelt, -0.45); ctx.beginPath(); ctx.arc(ex, ey, er * 1.35, 0, Math.PI * 2); ctx.fill();
      } else if (HS === 'reptile') {
        // long flat wedge, heavy brow ridge, always-visible teeth, nostril bump
        const ml = headR * (0.7 + k * 1.1);
        snout = headR * 0.2 + ml;
        ctx.fillStyle = pelt; ctx.beginPath();
        ctx.moveTo(-headR * 0.9, -headR * 0.25); ctx.quadraticCurveTo(-headR * 0.4, -headR * 0.78, headR * 0.3, -headR * 0.55);
        ctx.lineTo(headR * 0.2 + ml, -headR * 0.18); ctx.quadraticCurveTo(headR * 0.3 + ml, -headR * 0.02, headR * 0.15 + ml, headR * 0.06);
        ctx.lineTo(-headR * 0.4, headR * 0.35); ctx.quadraticCurveTo(-headR * 0.9, headR * 0.3, -headR * 0.9, -headR * 0.25); ctx.fill();
        ctx.fillStyle = shade(pelt, -0.35); ctx.beginPath(); ctx.moveTo(-headR * 0.2, -headR * 0.6); ctx.quadraticCurveTo(headR * 0.25, -headR * 0.85, headR * 0.55, -headR * 0.48); ctx.lineTo(headR * 0.1, -headR * 0.45); ctx.fill();
        ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.ellipse(headR * 0.05 + ml, -headR * 0.16, headR * 0.08, headR * 0.05, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(headR * 0.1 + i * ml * 0.14, -headR * 0.3, 1.4 * s, 0, Math.PI * 2); ctx.fill(); }
        teeth(headR * 0.3, headR * 0.1 + ml * 0.95, headR * 0.06, 5, false);
        ctx.save(); ctx.translate(-headR * 0.3, headR * 0.28); ctx.rotate(jawA * 1.1);
        ctx.fillStyle = shade(belly, -0.25); ctx.beginPath(); ctx.moveTo(0, -headR * 0.1); ctx.lineTo(ml * 1.25, -headR * 0.18); ctx.lineTo(ml * 1.05, headR * 0.05); ctx.lineTo(0, headR * 0.2); ctx.closePath(); ctx.fill();
        if (jawA > 0.06) teeth(ml * 0.4, ml * 1.15, -headR * 0.14, 4);
        ctx.restore();
        ex = headR * 0.12; ey = -headR * 0.38; er = headR * 0.2; slit = true;
      } else {
        // visor: armoured helm with a glowing sensor slit and grille jaw
        const ml = headR * (0.3 + k * 0.6);
        snout = headR * 0.8 + ml * 0.5;
        ctx.fillStyle = shade(pelt, 0.05); ctx.beginPath(); ctx.moveTo(-headR, -headR * 0.8); ctx.lineTo(headR * 0.55, -headR * 0.85); ctx.lineTo(headR * 0.8 + ml * 0.5, -headR * 0.15); ctx.lineTo(headR * 0.65 + ml * 0.5, headR * 0.35); ctx.lineTo(-headR, headR * 0.6); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.4 * s; ctx.stroke();
        ctx.fillStyle = shade(R.accent, -0.15); for (const [rx, ry] of [[-headR * 0.7, -headR * 0.55], [-headR * 0.7, headR * 0.35], [headR * 0.35, -headR * 0.6]]) { ctx.beginPath(); ctx.arc(rx, ry, 1.8 * s, 0, Math.PI * 2); ctx.fill(); }
        ctx.save(); ctx.translate(headR * 0.1, headR * 0.35); ctx.rotate(jawA * 0.6);
        ctx.fillStyle = shade(pelt, -0.3); ctx.fillRect(0, 0, headR * 0.5 + ml * 0.5, headR * 0.3);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1 * s; for (let i = 1; i < 5; i++) { const x = (headR * 0.5 + ml * 0.5) * i / 5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, headR * 0.3); ctx.stroke(); }
        ctx.restore();
      }
      if (R.scars.muzzle) { ctx.strokeStyle = shade(pelt, 0.5); ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(snout * 0.55, -headR * 0.5); ctx.lineTo(snout * 0.85, headR * 0.05); ctx.stroke(); }
      // eyes
      let lx = 0, ly = 0;
      if (S.hasGaze || S.beh) { const dx = S.gx - hx, dy = S.gy - hy; const ca = Math.cos(-S.headAng), sa = Math.sin(-S.headAng); lx = dx * ca - dy * sa; ly = dx * sa + dy * ca; const d = Math.hypot(lx, ly) || 1; lx = lx / d * er * 0.4; ly = ly / d * er * 0.4; }
      S.pupilX = lerp(S.pupilX, lx, 0.45); S.pupilY = lerp(S.pupilY, ly, 0.45);
      const lid = Math.max(S.blink, sleepK, S.pose.lidMin, S.purr > 0.5 ? 0.55 : 0, R.temperament === 'cunning' ? 0.3 : 0);
      const blindEye = R.scars.eye;
      if (HS === 'visor') {
        const vx = -headR * 0.2, vy = -headR * 0.35, vw = headR * 0.95, vh = headR * 0.2 * (1 - lid * 0.9);
        ctx.fillStyle = '#050505'; ctx.fillRect(vx, vy - headR * 0.12, vw, headR * 0.24);
        if (R.glowEyes && !blindEye) { ctx.shadowColor = R.eye; ctx.shadowBlur = 14 * s * (1 - lid); }
        ctx.fillStyle = blindEye ? '#475569' : R.eye; ctx.globalAlpha = 0.55; ctx.fillRect(vx, vy - vh / 2, vw, vh); ctx.globalAlpha = 1;
        if (!blindEye && lid < 0.9) { const dot = clamp(vx + vw * 0.6 + S.pupilX * 3, vx + 3 * s, vx + vw - 3 * s); ctx.fillStyle = '#ffffff'; ctx.fillRect(dot - 3 * s, vy - vh / 2, 6 * s, vh); }
        ctx.shadowBlur = 0;
        if (blindEye) { ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.moveTo(vx + vw * 0.3, vy - headR * 0.3); ctx.lineTo(vx + vw * 0.5, vy); ctx.lineTo(vx + vw * 0.4, vy + headR * 0.25); ctx.stroke(); }
      } else {
        ctx.fillStyle = '#120d08'; ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
        if (R.glowEyes && !blindEye) { ctx.shadowColor = R.eye; ctx.shadowBlur = 12 * s * (1 - lid); }
        ctx.fillStyle = blindEye ? '#cbd5e1' : R.eye; ctx.beginPath(); ctx.arc(ex, ey, er * 0.82, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        if (!blindEye) {
          const dil = S.treat ? 0.6 : 0.25 + S.vigilance * 0.2;
          ctx.fillStyle = '#050505'; ctx.beginPath();
          if (slit) ctx.ellipse(ex + S.pupilX, ey + S.pupilY, er * dil * 0.6, er * 0.7, 0, 0, Math.PI * 2);
          else ctx.arc(ex + S.pupilX, ey + S.pupilY, er * dil * (HS === 'beaked' ? 1.6 : 1), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(ex + S.pupilX - er * 0.25, ey + S.pupilY - er * 0.3, er * 0.16, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,200,140,0.5)'; ctx.beginPath(); ctx.arc(ex + S.pupilX + er * 0.2, ey + S.pupilY + er * 0.2, er * 0.08, 0, Math.PI * 2); ctx.fill();
        } else { ctx.strokeStyle = shade(pelt, 0.5); ctx.lineWidth = 1.8 * s; ctx.beginPath(); ctx.moveTo(ex - er * 1.3, ey - er * 1.4); ctx.lineTo(ex + er * 1.1, ey + er * 1.4); ctx.stroke(); }
        if (lid > 0.02) { ctx.fillStyle = HS === 'beaked' ? shade(pelt, -0.45) : pelt; ctx.beginPath(); ctx.rect(ex - er * 1.1, ey - er * 1.1, er * 2.2, er * 2.2 * lid); ctx.fill(); }
      }
      ctx.restore();

      Object.assign(G, { headX: hx, headY: hy, headR, mouthX: hx + Math.cos(S.headAng) * snout, mouthY: hy + Math.sin(S.headAng) * snout });

      // firelight wash over everything
      ctx.globalCompositeOperation = 'lighter';
      const fl = ctx.createRadialGradient(fireX, ground - 20, 5, fireX, ground - 20, W * 0.85);
      fl.addColorStop(0, `rgba(255,140,40,${0.28 * flick})`); fl.addColorStop(0.5, `rgba(255,110,30,${0.08 * flick})`); fl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fl; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';

      // tongue flick (reptiles) and sensor sweep (constructs) during idles
      if (S.pose.tongue > 0.05) { ctx.strokeStyle = '#be123c'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); const tl = 14 * s * S.pose.tongue; ctx.moveTo(G.mouthX, G.mouthY); ctx.lineTo(G.mouthX + tl, G.mouthY + tl * 0.2); ctx.lineTo(G.mouthX + tl + 3 * s, G.mouthY - 2 * s); ctx.moveTo(G.mouthX + tl, G.mouthY + tl * 0.2); ctx.lineTo(G.mouthX + tl + 3 * s, G.mouthY + 3 * s); ctx.stroke(); }
      if (S.pose.scan !== 0 && R.head === 'visor') { ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = R.eye; ctx.beginPath(); ctx.moveTo(G.mouthX, G.headY); ctx.lineTo(G.mouthX + 60 * s, ground + S.pose.scan * 14 * s - 6 * s); ctx.lineTo(G.mouthX + 60 * s, ground + S.pose.scan * 14 * s + 6 * s); ctx.fill(); ctx.restore(); }
      // treat
      if (S.treat) { ctx.fillStyle = '#9a3412'; ctx.save(); ctx.translate(S.treat.x, S.treat.y); ctx.rotate(S.t * 8); ctx.fillRect(-6 * s, -3 * s, 12 * s, 6 * s); ctx.fillStyle = '#f5f5f4'; ctx.beginPath(); ctx.arc(-6 * s, 0, 3 * s, 0, Math.PI * 2); ctx.arc(6 * s, 0, 3 * s, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }

      // particles
      for (const p of S.particles) {
        const k = 1 - p.life / p.max;
        if (p.kind === 'ember') { ctx.fillStyle = `rgba(255,${150 + Math.round(k * 80)},60,${k})`; ctx.fillRect(p.x, p.y, 1.8, 1.8); }
        else if (p.kind === 'heart') { ctx.fillStyle = `rgba(250,204,21,${k})`; ctx.font = `${12 * s}px serif`; ctx.fillText('✦', p.x, p.y); }
        else if (p.kind === 'z') { ctx.fillStyle = `rgba(226,232,240,${k * 0.8})`; ctx.font = `bold ${(10 + (1 - k) * 6) * s}px serif`; ctx.fillText('z', p.x, p.y); }
        else if (p.kind === 'crumb') { ctx.fillStyle = `rgba(180,83,9,${k})`; ctx.fillRect(p.x, p.y, 2.5, 2.5); }
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block select-none"
      style={{ touchAction: 'none' }}
      aria-label={`${rig.name}, your companion, resting by the campfire. Stroke, tap or press to interact.`}
      role="img"
    />
  );
});
