/* Grand Prix circuit world: a wide faceted island on the same planet profile as the ring,
 * a full-length loop with straights and sweepers, an infield lake, a grandstand on the
 * longest straight, forest clear of the road, and peaks around the rim. */
import * as THREE from 'three';
import { V, mat, mesh, box, mergeStatic } from './kit.js?v=f731741466';
import { buildRoad, addBoards, describeBoards, conifers, mountain, cloudField, frameObj, turnAt } from './trackkit.js?v=892f528c5d';

export function buildGP(scene, sponsors, track) {
  let seed = 90210;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const range = (a, b) => a + (b - a) * rand();
  const world = new THREE.Group(); scene.add(world);
  const clouds = cloudField();
  const { xs, zs } = track.samples;
  const roadDist = (x, z) => {
    let best = 1e9;
    for (let i = 0; i < xs.length; i += 6) best = Math.min(best, Math.hypot(xs[i] - x, zs[i] - z));
    return best;
  };

  // island: a flat top out to r 470, then the planet's shoulders falling away
  const TOP = 470;
  const profile = [[0, -300], [140, -296], [280, -280], [400, -250], [500, -205], [560, -150], [585, -100],
    [580, -60], [560, -30], [530, -12], [500, -4], [480, -1], [TOP, -.35], [0, -.35]].map(([r, y]) => new THREE.Vector2(r, y));
  const islandY = (r) => (r <= TOP ? -.35 : r <= 480 ? -.35 - (r - TOP) / 10 * .65 : r <= 500 ? -1 - (r - 480) / 20 * 3 : r <= 530 ? -4 - (r - 500) / 30 * 8 : -12 - (r - 530) / 30 * 18);
  const geo = new THREE.LatheGeometry(profile, 160).toNonIndexed();
  {
    const colors = [], p = geo.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
      const c = new THREE.Color(y < -42 ? '#648b57' : y < -7 ? '#7c984c' : '#91a64d').multiplyScalar(range(.91, 1.07));
      for (let j = 0; j < 3; j++) colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  mesh(world, geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })).castShadow = false;

  buildRoad(world, track);
  // denser than the ring, and allowed onto gentle bends: a long circuit needs more boards per view
  const faces = addBoards(world, track, sponsors, { spacing: 36, maxTurn: .24 });

  // infield lake wherever the most room is
  let lake = { x: 0, z: 0, r: 0 };
  for (let x = -300; x <= 300; x += 20) for (let z = -260; z <= 260; z += 20) {
    const room = roadDist(x, z) - 48;
    if (room > lake.r && Math.hypot(x, z) < 300) lake = { x, z, r: Math.min(room, 95) };
  }
  let water = null;
  if (lake.r > 25) {
    water = mesh(world, new THREE.CircleGeometry(lake.r, 96),
      new THREE.MeshStandardMaterial({ color: '#369fc8', roughness: .22, metalness: .2 }), lake.x, -.18, lake.z);
    water.rotation.x = -Math.PI / 2; water.castShadow = false;
    const beach = mesh(world, new THREE.RingGeometry(lake.r, lake.r + 5, 96), mat('#acb481'), lake.x, -.22, lake.z);
    beach.rotation.x = -Math.PI / 2; beach.castShadow = false;
    for (let i = 0; i < 8; i++) {
      const a = rand() * Math.PI * 2, rr = lake.r * range(.2, .8);
      const g = new THREE.Group(); g.position.set(lake.x + Math.cos(a) * rr, -.1, lake.z + Math.sin(a) * rr); g.rotation.y = range(0, 6); world.add(g);
      const hull = mesh(g, new THREE.SphereGeometry(1, 8, 4), mat('#fff3dd')); hull.scale.set(1.6, .24, .45);
      mesh(g, new THREE.CylinderGeometry(.03, .03, 3.6, 6), mat('#c3cbd0'), 0, 1.8, 0);
    }
  }

  // grandstand behind the infield hoardings on the straightest stretch
  let bestD = 0, bestTurn = 1e9;
  for (let d = 0; d < track.length; d += 20) { const t = turnAt(track, d, 40); if (t < bestTurn) { bestTurn = t; bestD = d; } }
  {
    const F = frameObj(); track.frame(bestD, -44, F);
    const g = new THREE.Group(); g.position.copy(F.p);
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(F.f, F.u, F.r)); world.add(g);
    const seats = ['#e75e48', '#3279ff', '#ffd05a', '#00bdaa'];
    for (let row = 0; row < 7; row++) {
      box(g, 64, 1.1, 2.4, 0, .55 + row * 1.1, -row * 2.2, '#c5cabc', .85);
      box(g, 62, .35, .9, 0, 1.25 + row * 1.1, -row * 2.2 + .5, seats[row % seats.length], .7);
    }
    box(g, 66, .4, 18, 0, 10.5, -6.5, '#f5efdc', .8);
    for (const x of [-31, -10, 10, 31]) box(g, .5, 9, .5, x, 5.2, -15.5, '#a9b5b7', .85);
  }

  // forest across the island, clear of the road corridor and the lake
  const spots = [];
  for (let i = 0; i < 1400 && spots.length < 950; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 460, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (roadDist(x, z) < 38) continue;
    if (lake.r && Math.hypot(x - lake.x, z - lake.z) < lake.r + 8) continue;
    if (Math.hypot(x - xs[0], z - zs[0]) < 0 && false) continue;
    spots.push({ p: new V(x, -.5, z), up: new V(0, 1, 0), scale: range(.7, 1.75) });
  }
  conifers(world, spots);

  // rocks along the verges
  for (let i = 0; i < 160; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 460, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const dd = roadDist(x, z);
    if (dd < 30 || dd > 70) continue;
    const m = mesh(world, new THREE.IcosahedronGeometry(range(.8, 2.2), 0), mat(['#aaa99e', '#bbb6a7', '#9da5a5'][i % 3]), x, -.4, z);
    m.rotation.set(rand(), rand() * 6, rand()); m.scale.set(range(.8, 1.3), range(.7, 1.1), range(.8, 1.2));
  }

  // peaks around the rim, standing on the island's shoulder
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2 + range(-.12, .12), r = range(490, 540);
    mountain(world, new V(Math.cos(a) * r, islandY(r) - 1, Math.sin(a) * r), new V(0, 1, 0),
      range(26, 44), range(40, 85), ['#84a0c3', '#91adbe', '#7896b8'][i % 3], rand);
  }
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * Math.PI * 2, r = range(260, 520);
    clouds.add(new V(Math.cos(a) * r, range(95, 135), Math.sin(a) * r), new V(0, 1, 0), range(4.5, 8), rand);
  }

  clouds.build(world);
  const boards = describeBoards(world, faces);
  mergeStatic(world, new Set(water ? [water] : []), 2);
  const signs = [];
  world.traverse((o) => { if (o.isMesh && o.material.userData && o.material.userData.sponsor) signs.push(o); });
  return { group: world, signs, boards, clouds, update() {} };
}
