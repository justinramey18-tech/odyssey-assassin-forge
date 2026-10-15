import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { CompanionRig } from '@/lib/companion-rig';

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
  prowler:   { len: 118, h: 44, leg: 58, head: 21, neck: 26, legW: 11 },
  behemoth:  { len: 128, h: 64, leg: 48, head: 27, neck: 16, legW: 17 },
  drake:     { len: 124, h: 48, leg: 50, head: 21, neck: 34, legW: 12 },
  automaton: { len: 118, h: 52, leg: 56, head: 23, neck: 22, legW: 13 },
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
    if (S.sleeping) { S.sleeping = false; S.idle = 0; S.ear = 0.6; react(`${rigRef.current.name} cracks one eye open and stretches.`); }
    S.idle = 0;
  };

  useImperativeHandle(ref, () => ({
    tossTreat: () => {
      const S = sim.current; const G = S.geo;
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
      S.gx = p.x; S.gy = p.y; S.hasGaze = true; S.idle = 0;
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
      // fall asleep after a quiet spell (sooner when it trusts you)
      const sleepAfter = 30 - R.bond * 0.15;
      if (!S.sleeping && S.idle > sleepAfter && !S.treat) { S.sleeping = true; react(`${R.name} circles twice and curls up by the fire.`); }
      S.sleep = lerp(S.sleep, S.sleeping ? 1 : 0, dt * (S.sleeping ? 0.8 : 3));
      // blinking
      S.nextBlink -= dt;
      if (S.nextBlink <= 0) { S.blink = 1; S.nextBlink = 3.8 + Math.random() * 2.4; if (Math.random() < 0.25) S.nextBlink = 0.22; }
      S.blink = Math.max(0, S.blink - dt * 7);
      // ear spring
      const earF = -S.ear * 60 - S.earV * 6; S.earV += earF * dt; S.ear += S.earV * dt;
      if (Math.random() < dt * 0.15) S.earV += (Math.random() - 0.5) * 4;
      // jaw
      S.jaw = lerp(S.jaw, S.jawTarget, dt * 12);
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
      const ph = S.t * Math.PI * 2 * breathHz;
      const breath = Math.sin(ph) + 0.25 * Math.sin(ph * 2 + 0.7);
      const bx = W * 0.6 - S.recoil * 10 * s;
      const by = ground - legL - bodyH * 0.35 + breath * 1.4 * s + sleepK * bodyH * 0.05;
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
        ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(footX + (front ? 4 : 2) * s + sleepK * (front ? 14 : -10) * s, fy - legW * 0.35, legW * 0.75, legW * 0.42, 0, 0, Math.PI * 2); ctx.fill();
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
      const baseA = Math.PI + (S.sleeping ? 0.5 : -0.75 + (1 - S.vigilance) * 0.4);
      const pts: [number, number][] = [[tx, ty]];
      for (let i = 1; i <= tailN; i++) {
        const k = i / tailN;
        const a = baseA + Math.sin(S.t * wagF - i * 0.55) * wagAmp * k + (S.sleeping ? k * 0.9 : -k * 1.1);
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

      // drake wing / spine spikes
      if (R.chassis === 'drake') {
        ctx.fillStyle = shade(pelt, -0.25);
        ctx.beginPath(); ctx.moveTo(bx + bodyL * 0.2, by - bodyH * 0.35); ctx.lineTo(bx - bodyL * 0.35, by - bodyH * (0.75 + breath * 0.03)); ctx.lineTo(bx - bodyL * 0.2, by - bodyH * 0.3); ctx.lineTo(bx - bodyL * 0.4, by - bodyH * 0.35); ctx.closePath(); ctx.fill();
        ctx.fillStyle = R.accent; for (let i = 0; i < 6; i++) { const x = bx - bodyL * 0.4 + i * bodyL * 0.13; ctx.beginPath(); ctx.moveTo(x - 4 * s, by - bodyH * 0.47); ctx.lineTo(x, by - bodyH * 0.62); ctx.lineTo(x + 4 * s, by - bodyH * 0.47); ctx.fill(); }
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
      if (S.hasGaze && !S.sleeping) want = clamp(Math.atan2(S.gy - nby, S.gx - nbx), -1.25, 0.45);
      if (S.purr > 0.3) want = Math.min(want, -0.8);
      const eased = lerp(S.headAng, want, Math.min(1, (T.gazeLazy * 60) * (1 / 60) * 2.2));
      S.headAng = eased + Math.sin(S.sneeze * 20) * 0.3 * S.sneeze;
      const neckA = lerp(restA, S.headAng, 0.5);
      const hx = nbx + Math.cos(neckA) * neckLen, hy = nby + Math.sin(neckA) * neckLen;
      ctx.strokeStyle = pelt; ctx.lineWidth = headR * (R.chassis === 'behemoth' ? 1.6 : 1.25); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(nbx - 6 * s, nby + 4 * s); ctx.lineTo(hx, hy); ctx.stroke();
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
      // skull
      ctx.fillStyle = pelt;
      ctx.beginPath(); if (metal) ctx.rect(-headR, -headR * 0.85, headR * 1.8, headR * 1.6); else ctx.ellipse(0, 0, headR, headR * 0.86, 0, 0, Math.PI * 2); ctx.fill();
      // upper muzzle
      ctx.beginPath(); ctx.moveTo(headR * 0.3, -headR * 0.55); ctx.lineTo(headR * 0.3 + mLen, -headR * 0.12); ctx.lineTo(headR * 0.3 + mLen, headR * 0.12); ctx.lineTo(headR * 0.2, headR * 0.25); ctx.closePath(); ctx.fill();
      // nose
      ctx.fillStyle = metal ? R.accent : '#111'; ctx.beginPath(); ctx.arc(headR * 0.3 + mLen, -headR * 0.05, headR * 0.15, 0, Math.PI * 2); ctx.fill();
      // jaw (hinged)
      const jawA = S.jaw * 0.45 + (S.stress > 0.6 ? 0.12 : 0);
      ctx.save(); ctx.translate(headR * 0.1, headR * 0.3); ctx.rotate(jawA);
      ctx.fillStyle = shade(pelt, -0.1); ctx.beginPath(); ctx.moveTo(0, -headR * 0.1); ctx.lineTo(mLen * 0.95, -headR * 0.05); ctx.lineTo(mLen * 0.85, headR * 0.2); ctx.lineTo(0, headR * 0.3); ctx.closePath(); ctx.fill();
      if (jawA > 0.08) { ctx.fillStyle = '#f1f5f9'; for (let i = 0; i < 4; i++) { const x = mLen * (0.35 + i * 0.15); ctx.beginPath(); ctx.moveTo(x - 2 * s, -headR * 0.08); ctx.lineTo(x, -headR * 0.28); ctx.lineTo(x + 2 * s, -headR * 0.08); ctx.fill(); } }
      ctx.restore();
      if (jawA > 0.08) { ctx.fillStyle = '#3b0d12'; ctx.beginPath(); ctx.moveTo(headR * 0.2, headR * 0.22); ctx.lineTo(headR * 0.25 + mLen * 0.9, headR * 0.12); ctx.lineTo(headR * 0.2 + mLen * 0.8, headR * 0.12 + jawA * mLen * 0.8); ctx.fill(); }
      if (R.scars.muzzle) { ctx.strokeStyle = shade(pelt, 0.5); ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(headR * 0.5, -headR * 0.5); ctx.lineTo(headR * 0.9, headR * 0.05); ctx.stroke(); }
      // eye
      const ex = headR * 0.32, ey = -headR * 0.28, er = headR * 0.24;
      // pupil target in head-local space
      let lx = 0, ly = 0;
      if (S.hasGaze) { const dx = S.gx - hx, dy = S.gy - hy; const ca = Math.cos(-S.headAng), sa = Math.sin(-S.headAng); lx = dx * ca - dy * sa; ly = dx * sa + dy * ca; const d = Math.hypot(lx, ly) || 1; lx = lx / d * er * 0.4; ly = ly / d * er * 0.4; }
      S.pupilX = lerp(S.pupilX, lx, 0.45); S.pupilY = lerp(S.pupilY, ly, 0.45);
      const lid = Math.max(S.blink, sleepK, S.purr > 0.5 ? 0.55 : 0, R.temperament === 'cunning' ? 0.3 : 0);
      const blindEye = R.scars.eye;
      ctx.fillStyle = metal ? '#0a0a0a' : '#120d08'; ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
      if (R.glowEyes && !blindEye) { ctx.shadowColor = R.eye; ctx.shadowBlur = 12 * s * (1 - lid); }
      ctx.fillStyle = blindEye ? '#cbd5e1' : R.eye; ctx.beginPath(); ctx.arc(ex, ey, er * 0.82, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      if (!blindEye) {
        // pupil dilates when hunting / alert, slits toward the fire
        const dil = S.treat ? 0.6 : 0.25 + S.vigilance * 0.2;
        ctx.fillStyle = '#050505'; ctx.beginPath();
        if (R.chassis === 'prowler' || R.chassis === 'drake') ctx.ellipse(ex + S.pupilX, ey + S.pupilY, er * dil * 0.6, er * 0.7, 0, 0, Math.PI * 2);
        else ctx.arc(ex + S.pupilX, ey + S.pupilY, er * dil, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(ex + S.pupilX - er * 0.25, ey + S.pupilY - er * 0.3, er * 0.16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,200,140,0.5)'; ctx.beginPath(); ctx.arc(ex + S.pupilX + er * 0.2, ey + S.pupilY + er * 0.2, er * 0.08, 0, Math.PI * 2); ctx.fill();
      } else { ctx.strokeStyle = shade(pelt, 0.5); ctx.lineWidth = 1.8 * s; ctx.beginPath(); ctx.moveTo(ex - er * 1.3, ey - er * 1.4); ctx.lineTo(ex + er * 1.1, ey + er * 1.4); ctx.stroke(); }
      if (lid > 0.02) { ctx.fillStyle = pelt; ctx.beginPath(); ctx.rect(ex - er * 1.1, ey - er * 1.1, er * 2.2, er * 2.2 * lid); ctx.fill(); }
      ctx.restore();

      Object.assign(G, { headX: hx, headY: hy, headR, mouthX: hx + Math.cos(S.headAng) * (headR * 0.3 + mLen), mouthY: hy + Math.sin(S.headAng) * (headR * 0.3 + mLen) });

      // firelight wash over everything
      ctx.globalCompositeOperation = 'lighter';
      const fl = ctx.createRadialGradient(fireX, ground - 20, 5, fireX, ground - 20, W * 0.85);
      fl.addColorStop(0, `rgba(255,140,40,${0.28 * flick})`); fl.addColorStop(0.5, `rgba(255,110,30,${0.08 * flick})`); fl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fl; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';

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
