/* Möbius world: the circuit is a twisted strip floating in the sky above a far-off sea planet.
 * One lap puts the field on the other face with the lanes mirrored; the camera rides the
 * road's own "up", so the cars stay upright on screen while the world turns over. */
import * as THREE from 'three';
import { V, mat, mesh, mergeStatic } from './kit.js?v=f731741466';
import { buildRoad, addBoards, describeBoards, mountain, cloudField } from './trackkit.js?v=892f528c5d';

export function buildMobius(scene, sponsors, track) {
  let seed = 1858;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const range = (a, b) => a + (b - a) * rand();
  const world = new THREE.Group(); scene.add(world);
  const clouds = cloudField();

  buildRoad(world, track, { mobius: true });
  // boards over both laps: the second lap's frames put them on the strip's other face
  // the strip bends as steadily as the ring does, so boards go all the way round
  const faces = addBoards(world, track, sponsors, { spacing: 40, span: track.length, maxTurn: .4 });

  // a sea planet far below, dotted with islands
  const R = 1400, C = new V(0, -1650, 0);
  const sea = mesh(world, new THREE.SphereGeometry(R, 120, 80),
    new THREE.MeshStandardMaterial({ color: '#369fc8', roughness: .22, metalness: .2 }), C.x, C.y, C.z);
  sea.castShadow = false;
  for (let i = 0; i < 30; i++) {
    const a = rand() * Math.PI * 2, t = Math.acos(1 - rand() * .045);          // a cap under the strip
    const n = new V(Math.sin(t) * Math.cos(a), Math.cos(t), Math.sin(t) * Math.sin(a));
    const base = C.clone().addScaledVector(n, R - 3);
    mountain(world, base, n, range(26, 64), range(24, 90), ['#7c984c', '#91a64d', '#84a0c3'][i % 3], rand);
  }

  // clouds drifting around the strip, clear of the road
  for (let i = 0; i < 56; i++) {
    const a = rand() * Math.PI * 2, r = rand() < .5 ? range(40, 95) : range(215, 420), y = range(-110, 95);
    if (r > 95 && r < 215 && Math.abs(y) < 60) continue;
    clouds.add(new V(Math.cos(a) * r, y, Math.sin(a) * r), new V(0, 1, 0), range(5, 9), rand);
  }

  clouds.build(world);
  const boards = describeBoards(world, faces);
  mergeStatic(world, new Set([sea]), 2);
  const signs = [];
  world.traverse((o) => { if (o.isMesh && o.material.userData && o.material.userData.sponsor) signs.push(o); });
  return { group: world, signs, boards, clouds, update() {} };
}
