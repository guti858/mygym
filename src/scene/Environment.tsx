import type { ScenePalette } from './palette';

export function Lights({ extent = 3, keyPosition = [4, 7, 5] }: { extent?: number; keyPosition?: readonly [number, number, number] }) {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#4a505a', 1.25]} />
      <directionalLight
        position={[keyPosition[0], keyPosition[1], keyPosition[2]]}
        intensity={1.7}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-5, 4, -3]} intensity={0.45} />
    </>
  );
}

export function Floor({ palette, size = 6, center = [0, 0] as readonly [number, number] }: { palette: ScenePalette; size?: number; center?: readonly [number, number] }) {
  return (
    <group position={[center[0], 0, center[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color={palette.floor} roughness={0.95} metalness={0} />
      </mesh>
      <gridHelper args={[size, Math.round(size / 0.5), palette.floorLine, palette.floorLine]} position={[0, 0.002, 0]} />
    </group>
  );
}
