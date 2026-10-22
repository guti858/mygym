import { useRef } from 'react';
import type { CameraSpec } from '../scene/camera';
import { screenToFloor } from '../scene/hubCamera';
import { HUB_AREAS, HUB_FLOOR, HUB_ZONES } from '../scene/layout';
import type { ScenePalette } from '../scene/palette';
import { CATALOG, type Zone } from '../stations/catalog';
import { hubFootprint } from '../stations/hubPlacement';

const [W, D] = HUB_FLOOR;

/**
 * Mini-mapa del gimnasio (planta esquemática, con el norte arriba): zonas, máquinas y el trozo que
 * se ve en el plano. Un clic o un arrastre centran el plano en ese punto. Solo aparece con zoom.
 */
export function HubMiniMap({ palette, cam, chosen, onCenter }: { palette: ScenePalette; cam: CameraSpec; chosen: string | null; onCenter: (point: [number, number]) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const corners = [
    [0, 0],
    [cam.width, 0],
    [cam.width, cam.height],
    [0, cam.height],
  ].map(([x, y]) => screenToFloor(cam, x!, y!));
  const toFloor = (clientX: number, clientY: number): [number, number] | null => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return [Math.min(W / 2, Math.max(-W / 2, p.x)), Math.min(D / 2, Math.max(-D / 2, p.y))];
  };
  return (
    <svg
      ref={svgRef}
      className="hub-minimap"
      viewBox={`${-W / 2 - 0.3} ${-D / 2 - 0.3} ${W + 0.6} ${D + 0.6}`}
      role="img"
      aria-label="Mini-mapa del gimnasio: pulsa o arrastra para mover el plano"
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = toFloor(e.clientX, e.clientY);
        if (p) onCenter(p);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const p = toFloor(e.clientX, e.clientY);
        if (p) onCenter(p);
      }}
    >
      <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={0.2} fill={palette.room.floorA} />
      {(Object.keys(HUB_ZONES) as Zone[]).map((z) => {
        const r = HUB_ZONES[z];
        return <rect key={z} x={r.x - r.w / 2} y={r.z - r.d / 2} width={r.w} height={r.d} fill={palette.zone[z]} />;
      })}
      {HUB_AREAS.map((a) => (
        <rect key={a.id} x={a.x - a.w / 2} y={a.z - a.d / 2} width={a.w} height={a.d} fill="none" stroke={palette.room.line} strokeWidth={0.08} />
      ))}
      {CATALOG.map((e) => {
        const { half } = hubFootprint(e);
        return (
          <rect
            key={e.id}
            x={-half[0]}
            y={-half[1]}
            width={2 * half[0]}
            height={2 * half[1]}
            transform={`translate(${e.hub.x} ${e.hub.z}) rotate(${(-e.hub.yaw * 180) / Math.PI})`}
            fill={e.id === chosen ? palette.accent : palette.frameDark}
          />
        );
      })}
      <polygon points={corners.map(([x, z]) => `${x},${z}`).join(' ')} fill={palette.accent} fillOpacity={0.14} stroke={palette.accent} strokeWidth={0.12} strokeLinejoin="round" />
    </svg>
  );
}
