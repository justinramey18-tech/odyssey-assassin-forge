// Physical 3D dice that pop up over the screen when a roll is made.
// The numbers are decided before the throw (dice odds); real physics throws
// the dice, and once they settle the up face is made to read the decided value.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { Physics, RigidBody, CuboidCollider, ConvexHullCollider, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { playDiceRattle, playDiceThud } from '@/lib/diceSounds';
import { bumpMs, relabelForTop, setDice3dEnabled, type DieThrow, type Die3D } from '@/lib/dice3d';

const HALF_W = 2.1, HALF_D = 2.9, WALL_H = 3;
const SETTLE_MAX_MS = 3800;
let lastBuzz = 0;
const buzz = (ms: number | number[]) => {
  const t = Date.now();
  if (typeof ms === 'number' && (ms <= 0 || t - lastBuzz < 55)) return;
  lastBuzz = t;
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
};

interface Face { center: THREE.Vector3; normal: THREE.Vector3; size: number }
interface Shape { geo: THREE.BufferGeometry; hull: Float32Array; faces: Face[] }

function buildShape(sides: Die3D): Shape {
  const r = 0.68;
  let g: THREE.BufferGeometry =
    sides === 4 ? new THREE.TetrahedronGeometry(r * 1.25)
    : sides === 6 ? new THREE.BoxGeometry(r * 1.4, r * 1.4, r * 1.4).toNonIndexed()
    : sides === 8 ? new THREE.OctahedronGeometry(r * 1.05)
    : sides === 12 ? new THREE.DodecahedronGeometry(r * 0.95)
    : new THREE.IcosahedronGeometry(r);
  g = g.index ? g.toNonIndexed() : g;
  g.computeVertexNormals();
  const pos = g.getAttribute('position');
  const groups = new Map<string, { n: THREE.Vector3; pts: THREE.Vector3[] }>();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    const n = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    const key = n.toArray().map((v) => v.toFixed(2)).join(',');
    const grp = groups.get(key) ?? { n, pts: [] };
    grp.pts.push(a.clone(), b.clone(), c.clone());
    groups.set(key, grp);
  }
  const faces: Face[] = [...groups.values()].map(({ n, pts }) => {
    const uniq = pts.filter((p, i) => pts.findIndex((q) => q.distanceTo(p) < 1e-4) === i);
    const center = uniq.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(uniq.length);
    if (n.dot(center) < 0) n.negate();
    const inr = Math.min(...uniq.map((p) => p.distanceTo(center)));
    return { center, normal: n, size: inr * (sides === 6 ? 1.1 : sides === 4 ? 0.9 : 1.15) };
  });
  return { geo: g, hull: new Float32Array(pos.array as ArrayLike<number>), faces: faces.slice(0, sides) };
}

const texCache = new Map<number, THREE.CanvasTexture>();
function numberTex(n: number): THREE.CanvasTexture {
  const hit = texCache.get(n);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const x = cv.getContext('2d')!;
  x.fillStyle = '#f2d38a';
  x.font = `bold ${n >= 10 ? 62 : 74}px Cinzel, Georgia, serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 4;
  x.fillText(String(n), 64, 66);
  if (n === 6 || n === 9) x.fillRect(42, 104, 44, 6);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(n, t);
  return t;
}

function feltTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const x = cv.getContext('2d')!;
  x.fillStyle = '#1d3a2c'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    const l = 20 + Math.random() * 30;
    x.fillStyle = `hsla(150, 30%, ${l}%, 0.18)`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const DIE_COLOR: Record<DieThrow['role'], string> = { test: '#7a1420', damage: '#3a2a5e', heal: '#145a3a', effect: '#5a4214' };
// The face the player sees best: pointing at the camera, not straight up.
const UP = new THREE.Vector3(0, 8.5, 3.2).normalize();

function Die({ d, index, onSettled }: { d: DieThrow; index: number; onSettled: (i: number) => void }) {
  const shape = useMemo(() => buildShape(d.sides), [d.sides]);
  const body = useRef<RapierRigidBody>(null);
  const [labels, setLabels] = useState(() => Array.from({ length: shape.faces.length }, (_, i) => i + 1));
  const [glow, setGlow] = useState(false);
  const still = useRef(0);
  const age = useRef(0);
  const done = useRef(false);

  useEffect(() => {
    const rb = body.current;
    if (!rb) return;
    const s = 7 + Math.random() * 3;
    rb.applyImpulse({ x: (Math.random() - 0.5) * 2, y: 1.5, z: -s * 0.9 * rb.mass() }, true);
    rb.applyTorqueImpulse({ x: (Math.random() - 0.5) * 0.6, y: (Math.random() - 0.5) * 0.6, z: (Math.random() - 0.5) * 0.6 }, true);
  }, []);

  useFrame((_, dt) => {
    const rb = body.current;
    if (!rb) return;
    age.current += Math.min(dt, 0.05);
    const v = rb.linvel(), w = rb.angvel();
    const moving = Math.hypot(v.x, v.y, v.z) + Math.hypot(w.x, w.y, w.z);
    still.current = moving < 0.08 ? still.current + Math.min(dt, 0.05) : 0;
    if (done.current) return;
    if (still.current > 0.35 || rb.isSleeping() || age.current * 1000 > SETTLE_MAX_MS) {
      done.current = true;
      const q = rb.rotation();
      const quat = new THREE.Quaternion(q.x, q.y, q.z, q.w);
      let top = 0, best = -2;
      shape.faces.forEach((f, i) => { const y = f.normal.clone().applyQuaternion(quat).dot(UP); if (y > best) { best = y; top = i; } });
      console.log('[dice3d] settle', d.sides, d.value, top, best.toFixed(2), age.current.toFixed(2));
      setLabels((l) => relabelForTop(l, top, d.value));
      setGlow(true);
      onSettled(index);
    }
  });

  const startX = (index - 1) * 0.7 + (Math.random() - 0.5) * 0.3;
  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={[startX, 1.4 + index * 0.25, HALF_D - 0.7]}
      rotation={[Math.random() * 6, Math.random() * 6, Math.random() * 6]}
      linearDamping={0.25}
      angularDamping={0.35}
      ccd
      onCollisionEnter={() => {
        const v = body.current?.linvel();
        const sp = v ? Math.hypot(v.x, v.y, v.z) : 0;
        const ms = bumpMs(sp);
        if (ms) { buzz(ms); playDiceThud?.(); }
      }}
    >
      <ConvexHullCollider args={[shape.hull]} restitution={0.35} friction={0.6} density={1.4} />
      <mesh geometry={shape.geo} castShadow receiveShadow>
        <meshPhysicalMaterial color={DIE_COLOR[d.role]} roughness={0.28} metalness={0.05} clearcoat={0.8} clearcoatRoughness={0.2} emissive={glow ? '#ffb347' : '#000000'} emissiveIntensity={glow ? 0.18 : 0} flatShading />
      </mesh>
      {shape.faces.map((f, i) => (
        <mesh key={i} position={f.center.clone().addScaledVector(f.normal, 0.004)} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.normal)}>
          <planeGeometry args={[f.size, f.size]} />
          <meshBasicMaterial map={numberTex(labels[i])} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </RigidBody>
  );
}

function Tray() {
  const felt = useMemo(feltTexture, []);
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[HALF_W * 2 + 0.6, HALF_D * 2 + 0.6]} />
        <meshStandardMaterial map={felt} roughness={0.95} />
      </mesh>
      {[[-1, 0], [1, 0], [0, -1], [0, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * (HALF_W + 0.2), 0.2, sz * (HALF_D + 0.2)]} castShadow receiveShadow>
          <boxGeometry args={[sx ? 0.4 : HALF_W * 2 + 0.8, 0.4, sz ? 0.4 : HALF_D * 2 + 0.8]} />
          <meshStandardMaterial color="#4a2e1a" roughness={0.6} />
        </mesh>
      ))}
      <CuboidCollider args={[HALF_W + 1, 0.5, HALF_D + 1]} position={[0, -0.5, 0]} friction={0.8} restitution={0.25} />
      <CuboidCollider args={[0.2, WALL_H, HALF_D + 1]} position={[-HALF_W - 0.2, WALL_H, 0]} restitution={0.4} />
      <CuboidCollider args={[0.2, WALL_H, HALF_D + 1]} position={[HALF_W + 0.2, WALL_H, 0]} restitution={0.4} />
      <CuboidCollider args={[HALF_W + 1, WALL_H, 0.2]} position={[0, WALL_H, -HALF_D - 0.2]} restitution={0.4} />
      <CuboidCollider args={[HALF_W + 1, WALL_H, 0.2]} position={[0, WALL_H, HALF_D + 0.2]} restitution={0.4} />
      <CuboidCollider args={[HALF_W + 1, 0.2, HALF_D + 1]} position={[0, WALL_H * 2, 0]} />
    </>
  );
}

export interface Dice3DPopupProps {
  title: string;
  dice: DieThrow[];
  /** Words shown once the dice settle, e.g. "Hit · 14" */
  summary: string;
  crit?: 'high' | 'low' | null;
  onDone: () => void;
}

export default function Dice3DPopup({ title, dice, summary, crit, onDone }: Dice3DPopupProps) {
  const [settled, setSettled] = useState<Set<number>>(new Set());
  const [rollKey] = useState(() => Math.random());
  const allDone = settled.size >= dice.length;
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => { playDiceRattle(900); buzz([18, 30, 12]); }, []);
  useEffect(() => {
    if (!allDone || doneRef.current) return;
    doneRef.current = true;
    buzz(crit === 'high' ? [40, 60, 40, 60, 120] : crit === 'low' ? [200] : [25]);
    window.setTimeout(() => onDoneRef.current(), crit ? 1900 : 1300);
  }, [allDone, crit]);

  return createPortal(
    <div className="fixed inset-0 z-[75] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm" role="dialog" aria-label={`Dice roll for ${title}`} onClick={() => allDone && onDone()} data-vaul-no-drag>
      <p className="mb-2 max-w-[85%] truncate font-cinzel text-sm text-amber-200">{title}</p>
      <div className="relative h-[62vh] max-h-[560px] w-[92vw] max-w-[420px] overflow-hidden rounded-2xl border border-amber-900/50 shadow-2xl">
        <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 8.5, 3.2], fov: 45 }} onCreated={({ camera }) => camera.lookAt(0, 0, 0.2)}>
          <color attach="background" args={['#120c08']} />
          <ambientLight intensity={0.25} />
          <directionalLight position={[3, 9, 4]} intensity={1.6} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} />
          <pointLight position={[-2, 3, -2]} intensity={6} color="#ffb070" />
          <Environment resolution={64}>
            <Lightformer intensity={0.8} position={[0, 5, 0]} scale={[10, 10, 1]} rotation-x={Math.PI / 2} />
            <Lightformer intensity={0.5} color="#ffcc99" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
          </Environment>
          <Physics gravity={[0, -28, 0]} key={rollKey}>
            <Tray />
            {dice.map((d, i) => (
              <Die key={i} d={d} index={i} onSettled={(n) => setSettled((s) => new Set(s).add(n))} />
            ))}
          </Physics>
        </Canvas>
      </div>
      <div className="mt-3 h-8 text-center">
        {allDone && <p className={`font-cinzel text-lg font-bold tracking-widest ${crit === 'high' ? 'text-amber-300' : crit === 'low' ? 'text-red-400' : 'text-emerald-300'}`}>{summary}</p>}
      </div>
      <button type="button" onClick={(e) => { e.stopPropagation(); setDice3dEnabled(false); onDone(); }} style={{ touchAction: 'manipulation' }} className="mt-1 min-h-[48px] px-4 text-xs uppercase tracking-wider text-white/50">Use flat dice instead</button>
    </div>,
    document.body,
  );
}
