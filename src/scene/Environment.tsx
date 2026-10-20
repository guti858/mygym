import type { ScenePalette } from './palette';

/**
 * Luces en tiempo real (máquina y avatar; la sala trae la suya horneada).
 * - `keyPosition`: luz principal que acompaña a la cámara, para modelar el volumen en cualquier vista.
 * - `shadowPosition`: si se indica, las sombras salen de esta luz fija (como las luminarias del
 *   techo de la sala horneada) y no giran con la cámara; si no, las proyecta la luz principal.
 */
export function Lights({
  extent = 3,
  keyPosition = [4, 7, 5],
  shadowPosition,
}: {
  extent?: number;
  keyPosition?: readonly [number, number, number];
  shadowPosition?: readonly [number, number, number];
}) {
  const shadowProps = {
    castShadow: true,
    'shadow-mapSize-width': 1024,
    'shadow-mapSize-height': 1024,
    'shadow-camera-left': -extent,
    'shadow-camera-right': extent,
    'shadow-camera-top': extent,
    'shadow-camera-bottom': -extent,
    'shadow-camera-near': 0.5,
    'shadow-camera-far': 30,
    'shadow-bias': -0.0005,
  };
  return (
    <>
      <hemisphereLight args={['#ffffff', '#4a505a', 0.95]} />
      <directionalLight position={[keyPosition[0], keyPosition[1], keyPosition[2]]} intensity={shadowPosition ? 1.15 : 1.7} {...(shadowPosition ? {} : shadowProps)} />
      {shadowPosition && <directionalLight position={[shadowPosition[0], shadowPosition[1], shadowPosition[2]]} intensity={0.75} {...shadowProps} />}
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
