"""
Compacta el glTF binario de las salas para la web (Python puro, sin Blender):

  * quita las normales: la sala se pinta con MeshBasicMaterial y luz horneada, no las usa;
  * quita las UV de detalle (TEXCOORD_0) de las primitivas cuyo material no tiene textura de
    detalle (atrezo liso: mancuernas, discos, carpinterías...);
  * reescribe el búfer binario solo con lo que se sigue usando y regenera el módulo base64.

Uso: python3 scripts/environment/compact_glb.py src/scene/env/gym-env
     (lee y reescribe <ruta>.glb y <ruta>.generated.ts). build_rooms.py lo aplica al exportar.
"""

import base64
import json
import struct
import sys

GLB_MAGIC, CHUNK_JSON, CHUNK_BIN = 0x46546C67, 0x4E4F534A, 0x004E4942


def read_glb(data):
    magic, _, _ = struct.unpack_from('<III', data, 0)
    assert magic == GLB_MAGIC, 'no es un glTF binario'
    off, gltf, binary = 12, None, b''
    while off < len(data):
        length, kind = struct.unpack_from('<II', data, off)
        chunk = data[off + 8: off + 8 + length]
        if kind == CHUNK_JSON:
            gltf = json.loads(chunk)
        elif kind == CHUNK_BIN:
            binary = chunk
        off += 8 + length
    return gltf, binary


def write_glb(gltf, binary):
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    binary += b'\0' * (-len(binary) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    return (struct.pack('<III', GLB_MAGIC, 2, total) + struct.pack('<II', len(js), CHUNK_JSON) + js
            + struct.pack('<II', len(binary), CHUNK_BIN) + binary)


def compact(gltf, binary):
    materials = gltf.get('materials', [])
    for mesh in gltf['meshes']:
        for prim in mesh['primitives']:
            attrs = prim['attributes']
            attrs.pop('NORMAL', None)
            mat = materials[prim['material']] if 'material' in prim else {}
            if 'baseColorTexture' not in mat.get('pbrMetallicRoughness', {}):
                attrs.pop('TEXCOORD_0', None)
    # Accesores y vistas que siguen en uso (renumerados en orden).
    used_acc = sorted({a for m in gltf['meshes'] for p in m['primitives'] for a in [*p['attributes'].values(), p.get('indices')] if a is not None})
    acc_map = {old: new for new, old in enumerate(used_acc)}
    accessors = [gltf['accessors'][i] for i in used_acc]
    used_bv = sorted({a['bufferView'] for a in accessors if 'bufferView' in a} | {img['bufferView'] for img in gltf.get('images', []) if 'bufferView' in img})
    bv_map = {old: new for new, old in enumerate(used_bv)}
    out = bytearray()
    views = []
    for old in used_bv:
        bv = dict(gltf['bufferViews'][old])
        start = bv.get('byteOffset', 0)
        chunk = binary[start: start + bv['byteLength']]
        out += b'\0' * (-len(out) % 4)
        bv['byteOffset'] = len(out)
        out += chunk
        views.append(bv)
    for a in accessors:
        if 'bufferView' in a:
            a['bufferView'] = bv_map[a['bufferView']]
    for img in gltf.get('images', []):
        if 'bufferView' in img:
            img['bufferView'] = bv_map[img['bufferView']]
    for mesh in gltf['meshes']:
        for prim in mesh['primitives']:
            prim['attributes'] = {k: acc_map[v] for k, v in prim['attributes'].items()}
            if 'indices' in prim:
                prim['indices'] = acc_map[prim['indices']]
    gltf['accessors'] = accessors
    gltf['bufferViews'] = views
    gltf['buffers'] = [{'byteLength': len(out) + (-len(out) % 4)}]
    return gltf, bytes(out)


def write_module(path, data):
    with open(path, 'w') as f:
        f.write('// Generado por scripts/environment/build_rooms.py (Blender + Cycles). No editar a mano.\n')
        f.write(f'// Salas «station» y «hub» en glTF binario ({len(data)} bytes) codificado en base64.\n')
        f.write(f"export const GYM_ENV_GLB = '{base64.b64encode(data).decode()}';\n")


def main(base):
    data = open(base + '.glb', 'rb').read()
    gltf, binary = read_glb(data)
    out = write_glb(*compact(gltf, binary))
    open(base + '.glb', 'wb').write(out)
    write_module(base + '.generated.ts', out)
    print(f'{base}.glb: {len(data) / 1e6:.2f} MB → {len(out) / 1e6:.2f} MB')


if __name__ == '__main__':
    main(sys.argv[1])
