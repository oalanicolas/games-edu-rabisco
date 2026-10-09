/* Planet tour world: the circuit is a great circle round a small faceted globe, so the field
 * drives over the horizon through oceans, forest, desert and snowy high latitudes. The
 * ground is held flat in a band under the road; everything else is free to be a world. */
import * as THREE from 'three';
import { V, mat, mesh, mergeStatic } from './kit.js?v=f731741466';
import { buildRoad, addBoards, describeBoards, conifers, mountain, cloudField } from './trackkit.js?v=892f528c5d';

export function buildPlanet(scene, sponsors, track) {
  let seed = 4242;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const range = (a, b) => a + (b - a) * rand();
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const world = new THREE.Group(); scene.add(world);
  const clouds = cloudField();
  const Rp = track.radius;
  // normal of the great circle the road follows
  const N = new V().crossVectors(new V(track.A.x, track.A.y, track.A.z), new V(track.B.x, track.B.y, track.B.z)).normalize();

  const noise = (x, y, z) => Math.sin(x * 3.1 + 1.7) * Math.cos(y * 2.7 - .4) * .55 + Math.sin(y * 5.3 + z * 4.1) * .3
    + Math.cos(z * 6.7 - x * 3.3 + .9) * .2 + Math.sin((x + y + z) * 9.1) * .08;
  const warm = (x, y, z) => Math.sin(x * 2.2 - z * 1.7 + .3) * .6 + Math.cos(y * 4.4 + x * 1.3) * .4;
  const band = (n) => Math.abs(n.x * N.x + n.y * N.y + n.z * N.z) * Rp;   // distance from the road's circle
  const heightAt = (n) => {
    const v = noise(n.x, n.y, n.z);
    const h = v < -.18 ? -3.2 : v > .5 ? (v - .5) * 50 : v * 2.2;
    return -.35 + (h + .35) * smooth(34, 70, band(n));
  };

  // the globe: displaced icosphere, one colour per facet
  const geo = new THREE.IcosahedronGeometry(1, 40);
  {
    const p = geo.attributes.position, n = new V(), colors = [], c = new THREE.Color();
    const hs = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      n.fromBufferAttribute(p, i).normalize();
      hs[i] = heightAt(n);
      p.setXYZ(i, n.x * (Rp + hs[i]), n.y * (Rp + hs[i]), n.z * (Rp + hs[i]));
    }
    for (let i = 0; i < p.count; i += 3) {
      n.set(0, 0, 0);
      for (let j = 0; j < 3; j++) n.x += p.getX(i + j), n.y += p.getY(i + j), n.z += p.getZ(i + j);
      n.normalize();
      const h = (hs[i] + hs[i + 1] + hs[i + 2]) / 3, lat = Math.abs(n.y);
      if (h < -1.5) c.set('#cdb985');
      else if (lat > .82 || h > 16) c.set('#f4f7f8');
      else if (h > 8) c.set('#9aa3a8');
      else if (lat < .32 && warm(n.x, n.y, n.z) > .15) c.set('#d9c38a');
      else c.set(['#91a64d', '#7c984c', '#86a24a'][(i / 3) % 3]);
      c.multiplyScalar(range(.92, 1.06));
      for (let j = 0; j < 3; j++) colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
  }
  const globe = mesh(world, geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  globe.castShadow = false;
  const sea = mesh(world, new THREE.SphereGeometry(Rp - 1.1, 128, 80),
    new THREE.MeshStandardMaterial({ color: '#369fc8', roughness: .22, metalness: .2 }));
  sea.castShadow = false;

  buildRoad(world, track);
  const faces = addBoards(world, track, sponsors, { spacing: 46 });

  const randomDir = () => {
    const z = rand() * 2 - 1, a = rand() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    return new V(Math.cos(a) * s, z, Math.sin(a) * s);
  };

  // forest on dry, temperate land clear of the road
  const spots = [];
  for (let i = 0; i < 4000 && spots.length < 1300; i++) {
    const n = randomDir(), h = heightAt(n), lat = Math.abs(n.y);
    if (h < -.2 || h > 7 || band(n) < 40 || lat > .78) continue;
    if (lat < .32 && warm(n.x, n.y, n.z) > .15 && rand() < .85) continue;       // sparse in the desert
    spots.push({ p: n.clone().multiplyScalar(Rp + h - .15), up: n, scale: range(.7, 1.75) });
  }
  conifers(world, spots);

  // rocks, peaks and clouds
  for (let i = 0, placed = 0; i < 900 && placed < 180; i++) {
    const n = randomDir(), h = heightAt(n), b = band(n);
    if (h < -.2 || b < 30 || b > 90) continue;
    const m = mesh(world, new THREE.IcosahedronGeometry(range(.8, 2.2), 0), mat(['#aaa99e', '#bbb6a7', '#9da5a5'][placed % 3]));
    m.position.copy(n).multiplyScalar(Rp + h); m.rotation.set(rand(), rand() * 6, rand());
    m.scale.set(range(.8, 1.3), range(.7, 1.1), range(.8, 1.2)); placed++;
  }
  for (let i = 0, placed = 0; i < 2000 && placed < 28; i++) {
    const n = randomDir(), h = heightAt(n);
    if (h < 2 || band(n) < 95) continue;
    mountain(world, n.clone().multiplyScalar(Rp + h - 2), n, range(18, 34), range(28, 60),
      ['#84a0c3', '#91adbe', '#7896b8'][placed % 3], rand);
    placed++;
  }
  for (let i = 0; i < 40; i++) {
    const n = randomDir();
    clouds.add(n.clone().multiplyScalar(Rp + range(70, 105)), n, range(4.5, 8), rand);
  }

  clouds.build(world);
  const boards = describeBoards(world, faces);
  mergeStatic(world, new Set([sea, globe]), 2);
  const signs = [];
  world.traverse((o) => { if (o.isMesh && o.material.userData && o.material.userData.sponsor) signs.push(o); });
  return { group: world, signs, boards, clouds, update() {} };
}
