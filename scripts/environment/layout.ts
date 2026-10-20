/**
 * Vuelca la planta del gimnasio a JSON para el script de Blender (build_rooms.py): suelo, zonas,
 * huella de cada máquina en el gimnasio (para dejar libre su sitio al colocar el atrezo) y la sala
 * de estación.
 * Uso: npx tsx scripts/environment/layout.ts [salida.json]
 */
import { writeFileSync } from 'node:fs';
import { HUB_FLOOR, HUB_HEIGHT, HUB_ZONES, STATION_ROOM } from '../../src/scene/layout';
import { CATALOG } from '../../src/stations/catalog';
import { STATION_MODULES } from '../../src/stations/modules';

const out = process.argv[2] ?? 'scripts/environment/layout.json';

const stations = CATALOG.map((e) => {
  const b = STATION_MODULES[e.id]!.logic.bounds;
  // En el gimnasio la máquina se centra en su posición (igual que en HubComposition) y se gira `yaw`.
  const hx = (b.max[0] - b.min[0]) / 2;
  const hz = (b.max[2] - b.min[2]) / 2;
  const c = Math.abs(Math.cos(e.hub.yaw));
  const s = Math.abs(Math.sin(e.hub.yaw));
  return {
    id: e.id,
    x: e.hub.x,
    z: e.hub.z,
    yaw: e.hub.yaw,
    half: [+(hx * c + hz * s).toFixed(3), +(hx * s + hz * c).toFixed(3)],
    height: b.max[1],
    // Huella de la máquina en su sala, respecto al centro de la sala (= centro de la caja).
    roomHalf: [+hx.toFixed(3), +hz.toFixed(3)],
  };
});

const layout = {
  hub: { floor: HUB_FLOOR, height: HUB_HEIGHT, zones: HUB_ZONES, stations },
  station: STATION_ROOM,
};
writeFileSync(out, `${JSON.stringify(layout, null, 2)}\n`);
console.log(out);
