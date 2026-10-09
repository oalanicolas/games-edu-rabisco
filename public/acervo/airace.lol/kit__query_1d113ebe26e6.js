/* Shared building blocks for the race worlds and cars: cached flat-shaded materials, box and
   beam helpers, canvas textures that redraw once fonts load, and static-mesh merging. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const V = THREE.Vector3;
export const UP = new V(0, 1, 0);

const materials = new Map();
export function mat(color, roughness = .85, metalness = 0) {
  const c = new THREE.Color(color);
  const key = c.getHexString() + ':' + roughness + ':' + metalness;
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({ color: c, roughness, metalness, flatShading: true }));
  }
  return materials.get(key);
}
export const cube = new THREE.BoxGeometry(1, 1, 1);
export function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geometry, material);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true;
  parent.add(o); return o;
}
export function box(parent, w, h, d, x, y, z, color, rough = .8, metal = 0) {
  const o = mesh(parent, cube, color?.isMaterial ? color : mat(color, rough, metal), x, y, z);
  o.scale.set(w, h, d); return o;
}
export function beam(parent, a, b, r, color) {
  const delta = b.clone().sub(a);
  const o = mesh(parent, new THREE.CylinderGeometry(r, r, delta.length(), 7), mat(color));
  o.position.copy(a).add(b).multiplyScalar(.5);
  o.quaternion.setFromUnitVectors(UP, delta.normalize());
  return o;
}

/* Canvas textures are redrawn once the display fonts arrive. */
const redraws = [];
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const paint = () => { const x = c.getContext('2d'); x.clearRect(0, 0, w, h); draw(x, w, h); };
  paint();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  redraws.push(() => { paint(); t.needsUpdate = true; });
  return t;
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => redraws.forEach((r) => r()));

export const fitFont = (x, text, weight, start, min, maxW, family = 'Fredoka, Arial, sans-serif') => {
  let size = start;
  do { x.font = `${weight} ${size}px ${family}`; size -= 2; } while (x.measureText(text).width > maxW && size > min);
};

/* Merge every static mesh under `root` by material: one draw call per material instead
   of one per box. Meshes in `keep` stay separate (they move, or must be pickable). */
export function mergeStatic(root, keep = new Set(), minGroup = 2) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || keep.has(o)) return;
    if (!groups.has(o.material)) groups.set(o.material, []);
    groups.get(o.material).push(o);
  });
  const rel = new THREE.Matrix4();
  for (const [material, list] of groups) {
    if (list.length < minGroup) continue;
    const geos = list.map((o) => {
      let g = o.geometry.clone();
      if (g.index) g = g.toNonIndexed();
      g.applyMatrix4(rel.multiplyMatrices(inv, o.matrixWorld));
      for (const key of Object.keys(g.attributes)) {
        const wanted = key === 'position' || key === 'normal' || (key === 'uv' && material.map)
          || (key === 'color' && material.vertexColors);
        if (!wanted) g.deleteAttribute(key);
      }
      return g;
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, material);
    m.castShadow = list.some((o) => o.castShadow); m.receiveShadow = true;
    root.add(m);
    list.forEach((o) => o.removeFromParent());
  }
}

