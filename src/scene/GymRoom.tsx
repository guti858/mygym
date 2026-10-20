import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { CanvasTexture, PMREMGenerator, RepeatWrapping, SRGBColorSpace, Vector3, type Texture } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PLATES } from '../engine/load';
import { DEG } from '../engine/math';
import { Beam, Mat, Pad } from './kit';
import type { ScenePalette } from './palette';

/**
 * Sala del gimnasio: suelo de caucho en losetas, paredes del fondo (solo las que quedan detrás
 * según la cámara, para no tapar nunca la estación), espejos, rotulación, tira LED y atrezo.
 */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const textureCache = new Map<string, Texture>();

/** Loseta de caucho 1 × 1 m (la textura cubre 2 × 2 losetas con ligeras variaciones de tono). */
function rubberTexture(p: ScenePalette): Texture {
  const key = `rubber${p.room.floorA}${p.room.speck}`;
  const hit = textureCache.get(key);
  if (hit) return hit;
  const N = 512;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const r = rng(7);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? p.room.floorA : p.room.floorB;
      g.fillRect((i * N) / 2, (j * N) / 2, N / 2, N / 2);
    }
  }
  g.fillStyle = p.room.speck;
  for (let k = 0; k < 2600; k++) {
    g.globalAlpha = 0.25 + 0.5 * r();
    const s = 0.8 + 1.8 * r();
    g.fillRect(r() * N, r() * N, s, s);
  }
  g.globalAlpha = 1;
  g.strokeStyle = p.room.seam;
  g.lineWidth = 3;
  for (const t of [0, N / 2, N]) {
    g.beginPath();
    g.moveTo(t, 0);
    g.lineTo(t, N);
    g.moveTo(0, t);
    g.lineTo(N, t);
    g.stroke();
  }
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

/** Luna de espejo: degradado con dos reflejos diagonales. */
export function mirrorTexture(p: ScenePalette): Texture {
  const key = `mirror${p.room.mirror}`;
  const hit = textureCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, p.room.mirror);
  grad.addColorStop(1, p.room.wallLow);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 512);
  g.globalAlpha = 0.22;
  g.fillStyle = '#ffffff';
  for (const [x, w] of [
    [40, 46],
    [120, 16],
  ] as const) {
    g.beginPath();
    g.moveTo(x, 512);
    g.lineTo(x + w, 512);
    g.lineTo(x + w + 180, 0);
    g.lineTo(x + 180, 0);
    g.closePath();
    g.fill();
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/** Rotulación pintada en la pared. */
function decalTexture(p: ScenePalette): Texture {
  const key = `decal${p.room.decal}${p.room.wall}`;
  const hit = textureCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = p.room.decal;
  g.font = "900 170px 'Big Shoulders Display', Impact, 'Arial Black', sans-serif";
  g.textBaseline = 'middle';
  g.fillText('MYGYM', 20, 120);
  const w = g.measureText('MYGYM').width;
  g.fillRect(40 + w, 98, 26, 44);
  g.globalAlpha = 0.75;
  g.font = "600 46px 'IBM Plex Mono', ui-monospace, monospace";
  g.fillText('GUION ARTICULAR', 110 + w, 122);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/** Mapa de entorno procedural (sin descargas): reflejos suaves en metal, espejos y piel. */
export function RoomLighting({ intensity = 0.45 }: { intensity?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = intensity;
    invalidate();
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, intensity, invalidate]);
  return null;
}

function Dumbbell({ position, rotY = 0, size, color }: { position: readonly [number, number, number]; rotY?: number; size: number; color: string }) {
  const r = 0.038 + 0.02 * size;
  const len = 0.04 + 0.022 * size;
  const half = 0.075 + len / 2;
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.016, 0.016, 0.16, 10]} />
        <Mat color="#9aa3ad" metal={0.8} rough={0.3} />
      </mesh>
      {[-half, half].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[r, r, len, 6]} />
          <Mat color={color} metal={0.1} rough={0.75} />
        </mesh>
      ))}
    </group>
  );
}

function DumbbellRack({ palette }: { palette: ScenePalette }) {
  const f = palette.frameDark;
  const pairs = [0, 1, 2, 3, 4];
  return (
    <group>
      {[-0.95, 0.95].map((x) => (
        <group key={x}>
          <Beam from={[x, 0, 0]} to={[x, 0.82, -0.08]} w={0.05} color={f} />
          <Beam from={[x, 0, 0.12]} to={[x, 0.5, 0.18]} w={0.05} color={f} />
        </group>
      ))}
      <Beam from={[-1, 0.78, -0.07]} to={[1, 0.78, -0.07]} w={0.04} color={palette.frame} />
      <Beam from={[-1, 0.47, 0.17]} to={[1, 0.47, 0.17]} w={0.04} color={palette.frame} />
      {pairs.map((i) => (
        <group key={i}>
          <Dumbbell position={[-0.78 + i * 0.39, 0.86, -0.07]} rotY={Math.PI / 2} size={i * 0.2} color="#2a2e34" />
          <Dumbbell position={[-0.78 + i * 0.39, 0.56, 0.17]} rotY={Math.PI / 2} size={0.9 + i * 0.25} color="#2a2e34" />
        </group>
      ))}
    </group>
  );
}

function PlateTree({ palette }: { palette: ScenePalette }) {
  const pegs: Array<{ y: number; dir: 1 | -1; kg: number[] }> = [
    { y: 0.32, dir: 1, kg: [25, 25] },
    { y: 0.32, dir: -1, kg: [20, 20] },
    { y: 0.72, dir: 1, kg: [15, 10] },
    { y: 0.72, dir: -1, kg: [10, 5, 5] },
  ];
  return (
    <group>
      <mesh position={[0, 0.02, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.7, 0.04, 0.5]} />
        <Mat color={palette.frameDark} rough={0.6} />
      </mesh>
      <Beam from={[0, 0, 0]} to={[0, 1.1, 0]} w={0.07} color={palette.frame} />
      {pegs.map((p, i) => {
        let off = 0.06;
        return (
          <group key={i}>
            <mesh position={[0, p.y, p.dir * 0.12]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.024, 0.024, 0.24, 10]} />
              <Mat color={palette.metal} metal={0.7} rough={0.35} />
            </mesh>
            {p.kg.map((kg, j) => {
              const spec = PLATES.find((s) => s.kg === kg)!;
              const z = p.dir * (off + spec.thickness / 2);
              off += spec.thickness + 0.004;
              return (
                <mesh key={j} position={[0, Math.max(p.y, spec.diameter / 2 + 0.04), z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[spec.diameter / 2, spec.diameter / 2, spec.thickness, 28]} />
                  <Mat color={spec.color} rough={0.6} metal={0.05} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

function Kettlebells({ palette }: { palette: ScenePalette }) {
  const sizes = [0.7, 0.85, 1, 1.15];
  return (
    <group>
      {sizes.map((k, i) => (
        <group key={i} position={[i * 0.3, 0, 0]} scale={k}>
          <mesh position={[0, 0.1, 0]} castShadow>
            <sphereGeometry args={[0.1, 18, 14]} />
            <Mat color="#23272d" metal={0.35} rough={0.45} />
          </mesh>
          <mesh position={[0, 0.2, 0]} castShadow>
            <torusGeometry args={[0.055, 0.014, 8, 20]} />
            <Mat color="#23272d" metal={0.35} rough={0.45} />
          </mesh>
          <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.075, 18]} />
            <Mat color={palette.accent} rough={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function FlatBench({ palette }: { palette: ScenePalette }) {
  return (
    <group>
      <Pad position={[0, 0.43, 0]} size={[0.3, 0.08, 1.15]} color={palette.pad} />
      <Beam from={[0, 0.02, -0.5]} to={[0, 0.02, 0.5]} w={0.06} color={palette.frame} />
      <Beam from={[0, 0, -0.45]} to={[0, 0.39, -0.45]} w={0.05} color={palette.frame} />
      <Beam from={[0, 0, 0.45]} to={[0, 0.39, 0.45]} w={0.05} color={palette.frame} />
      <Beam from={[-0.22, 0.02, -0.5]} to={[0.22, 0.02, -0.5]} w={0.05} color={palette.frame} />
      <Beam from={[-0.22, 0.02, 0.5]} to={[0.22, 0.02, 0.5]} w={0.05} color={palette.frame} />
    </group>
  );
}

interface WallProps {
  palette: ScenePalette;
  /** Centro del pie de la pared y dirección de su normal (hacia la sala). */
  base: Vector3;
  normal: Vector3;
  length: number;
  height: number;
  mirrors: number;
  decal: boolean;
}

function Wall({ palette, base, normal, length, height, mirrors, decal }: WallProps) {
  const rotY = Math.atan2(normal.x, normal.z);
  const r = palette.room;
  const low = 1.05;
  const decalTex = decal ? decalTexture(palette) : null;
  const mirrorW = Math.min(1.3, (length * 0.55) / Math.max(1, mirrors));
  return (
    <group position={base} rotation={[0, rotY, 0]}>
      <mesh position={[0, height / 2, 0]} receiveShadow>
        <planeGeometry args={[length, height]} />
        <meshStandardMaterial color={r.wall} roughness={0.92} />
      </mesh>
      <mesh position={[0, low / 2, 0.004]} receiveShadow>
        <planeGeometry args={[length, low]} />
        <meshStandardMaterial color={r.wallLow} roughness={0.95} />
      </mesh>
      <mesh position={[0, low + 0.03, 0.006]}>
        <planeGeometry args={[length, 0.06]} />
        <meshStandardMaterial color={palette.accent} roughness={0.6} />
      </mesh>
      {/* Zócalo de goma */}
      <mesh position={[0, 0.06, 0.012]}>
        <boxGeometry args={[length, 0.12, 0.02]} />
        <meshStandardMaterial color={r.seam} roughness={0.8} />
      </mesh>
      {/* Tira LED cenital */}
      <mesh position={[0, height - 0.18, 0.03]}>
        <boxGeometry args={[length * 0.92, 0.035, 0.05]} />
        <meshStandardMaterial color={r.led} emissive={r.led} emissiveIntensity={1.4} />
      </mesh>
      {Array.from({ length: mirrors }, (_, i) => {
        const x = (i - (mirrors - 1) / 2) * (mirrorW + 0.12);
        return (
          <group key={i} position={[x, 0.32 + 0.95, 0.012]}>
            <mesh>
              <planeGeometry args={[mirrorW + 0.05, 1.95]} />
              <meshStandardMaterial color={r.seam} roughness={0.5} metalness={0.6} />
            </mesh>
            <mesh position={[0, 0, 0.004]}>
              <planeGeometry args={[mirrorW, 1.9]} />
              <meshStandardMaterial map={mirrorTexture(palette)} metalness={0.55} roughness={0.12} envMapIntensity={1.2} />
            </mesh>
          </group>
        );
      })}
      {decalTex && (
        <mesh position={[mirrors ? 0 : 0, height - 0.62, 0.008]}>
          <planeGeometry args={[2.4, 0.6]} />
          <meshBasicMaterial map={decalTex} transparent toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

export interface GymRoomProps {
  palette: ScenePalette;
  center: readonly [number, number];
  size: readonly [number, number];
  /** Azimut de la cámara en grados (las paredes solo se levantan en el lado opuesto). */
  azimuth: number;
  elevation: number;
  height?: number;
  /** Estación: atrezo en las esquinas. Gimnasio: paredes con espejos y estanterías. */
  variant: 'station' | 'hub';
}

export function GymRoom({ palette, center, size, azimuth, elevation, height = 3, variant }: GymRoomProps) {
  const tex = useMemo(() => {
    const t = rubberTexture(palette).clone();
    t.needsUpdate = true;
    t.repeat.set(size[0] / 2, size[1] / 2);
    return t;
  }, [palette, size]);
  const az = azimuth * DEG;
  const dirX = Math.sin(az);
  const dirZ = Math.cos(az);
  const showWalls = elevation < 80;
  const [cx, cz] = center;
  const hx = size[0] / 2;
  const hz = size[1] / 2;
  const walls: WallProps[] = [];
  if (showWalls && Math.abs(dirX) > 0.2) {
    const s = Math.sign(dirX);
    walls.push({ palette, base: new Vector3(cx - s * hx, 0, cz), normal: new Vector3(s, 0, 0), length: size[1], height, mirrors: variant === 'hub' ? 4 : 2, decal: variant === 'hub' || Math.abs(dirX) >= Math.abs(dirZ) });
  }
  if (showWalls && Math.abs(dirZ) > 0.2) {
    const s = Math.sign(dirZ);
    walls.push({ palette, base: new Vector3(cx, 0, cz - s * hz), normal: new Vector3(0, 0, s), length: size[0], height, mirrors: variant === 'hub' ? 5 : 1, decal: Math.abs(dirZ) > Math.abs(dirX) && variant === 'station' });
  }
  // Atrezo junto a la pared del fondo en X (o en Z si solo hay esa).
  const props =
    variant === 'station' && walls.length > 0
      ? (() => {
          const w = walls[0]!;
          const along = new Vector3(-w.normal.z, 0, w.normal.x);
          const inward = w.normal.clone();
          const at = (t: number, d: number) => w.base.clone().add(along.clone().multiplyScalar(t)).add(inward.clone().multiplyScalar(d));
          const rot = Math.atan2(w.normal.x, w.normal.z);
          const L = w.length / 2;
          return [
            <group key="rack" position={at(L - 1.15, 0.32)} rotation={[0, rot, 0]}>
              <DumbbellRack palette={palette} />
            </group>,
            <group key="tree" position={at(-L + 0.55, 0.5)} rotation={[0, rot, 0]}>
              <PlateTree palette={palette} />
            </group>,
            <group key="kb" position={at(-L + 1.2, 0.3)} rotation={[0, rot, 0]}>
              <Kettlebells palette={palette} />
            </group>,
          ];
        })()
      : null;
  const second =
    variant === 'station' && walls.length > 1
      ? (() => {
          const w = walls[1]!;
          const along = new Vector3(-w.normal.z, 0, w.normal.x);
          const p = w.base.clone().add(along.multiplyScalar(w.length / 2 - 1.1)).add(w.normal.clone().multiplyScalar(0.55));
          return (
            <group position={p} rotation={[0, Math.atan2(w.normal.x, w.normal.z) + Math.PI / 2, 0]}>
              <FlatBench palette={palette} />
            </group>
          );
        })()
      : null;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} receiveShadow>
        <planeGeometry args={[size[0], size[1]]} />
        <meshStandardMaterial map={tex} roughness={0.96} metalness={0} />
      </mesh>
      {walls.map((w, i) => (
        <Wall key={i} {...w} />
      ))}
      {props}
      {second}
    </group>
  );
}
