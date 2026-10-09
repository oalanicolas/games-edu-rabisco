/* AI Race — the 3D world, three.js r180.
 *
 * Look and feel follow the SAEL Lab reference build: flat-shaded physically based
 * materials under ACES tone mapping, a soft room environment, ambient occlusion, a small
 * faceted globe with the circuit around its crown, and a camera rig that follows the pack.
 * The world is static geometry — nothing scrolls or wraps; the cars really drive the ring. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { V, UP, mat, cube, mesh, box, beam, canvasTexture, fitFont, mergeStatic } from './kit.js?v=f731741466';
import { signMaterials, cloudField } from './trackkit.js?v=892f528c5d';
import { makeTrack } from './track-math.js?v=9636839fba';
import { buildGP } from './world-gp.js?v=410e5ecf00';
import { buildPlanet } from './world-planet.js?v=1474a9572f';
import { buildMobius } from './world-mobius.js?v=fa36b4ed65';

/* ---------------- motion ---------------- */
export const TRACK_RADIUS = 110;
const CIRCUIT = 2 * Math.PI * TRACK_RADIUS;
const LANE_SPACING = 42 / 16;                // sixteen lanes across the 42-wide road; a car is 2.54 wide, so they never touch
const NORMAL_SPEED = 32, SLOW_RATE = .12;
const ACCEL_MS = 450, TRANSITION_MS = 3200, DECEL_MS = 1000;
/* In the pack, a car pulls out to pass only once the field is up to speed: a fan phase between the
   launch and the reorder, so the move reads as steering out, never as a slide. Zero in the wide field. */
const FAN_MS = 1200, TUCK_MS = 900, PACK_ACCEL_MS = 700, FAN_CAP_MS = 2400;
let fanMs = 0, tuckMs = 0, accelMs = ACCEL_MS;
/* How long a change is expected to take, for timers set when it starts. The reorder itself starts
   through a gate (everyone pulled out, the racing line mostly eased off), never on a fixed clock. */
const settledMs = () => accelMs + fanMs + TRANSITION_MS;
const NAMES_MS = 1000;                       // after a race change every name shows this long, then folds to a badge
// interleaved lane order, so neighbours in the lab list never share a lane edge
const SLOTS = [12, 1, 6, 10, 11, 2, 4, 13, 7, 9, 5, 8, 0, 3, 14, 15];   // eight a side
const laneFor = (i) => (SLOTS[i % SLOTS.length] - (SLOTS.length - 1) / 2) * LANE_SPACING;
/* Rank spacing along the track: 60 units for the ranked field (the reference used 44), with
   rank weighted 80% in app.js, keeps adjacent ranks 3.7+ units apart, and no-data cars sit
   well behind the last ranked car. 60 is the spacing of the look Ryan signed off. */
export const SPREAD = { lo: -46, hi: 30, missing: -56 };
/* Pack formation. At rest the field runs two abreast, every lab on its own fixed side of the road,
   nose to tail down the order with a little stagger. A car that changes place pulls out into a
   passing channel on its side while the field is still standing (the ACCEL phase, before anyone
   moves along the track), holds it for the whole reorder, and tucks back in during DECEL, once
   everyone has stopped moving. Channels are one car apart, bigger moves take the wider ones, and
   seven a side means the whole field can change place at once. Nothing ever crosses the centre line
   while anything is moving along the track, so nothing can meet anything: a car is only ever beside
   cars in other channels. Outermost channel 19.65 + half a car 1.27 sits inside the white line at 21.05. */
/* Not two columns: at rest each car has its own place across the road, `inner` to `inner + spread`
   from the centre on its side, so the pack reads as a loose line with cars offset left and right of
   the one ahead. Safety then comes from the spacing along the road: a car sits at least `tail`
   behind any car it is not laterally clear of (`clearLat`: a car's width, the racing line's worst
   squeeze over a car's length, and a margin), and only `sideBy` behind one it is. Passing channels
   start beyond the widest rest place: 6.95 + 4 × 2.58 = 17.27, plus half a car, inside the white line. */
const PACK = { inner: .8, spread: 3.2, clearLat: 5.2, sideBy: 2.4, ch0: 6.9, chStep: 3.7, channels: 4, stagger: 1.5, tail: { f1: 7, motogp: 5.5, nascar: 7.8 },   // 3.7: a car steering out at 22° is 3.4 wide, and a little over; 6.9 + 3 × 3.7 = 18.0, plus half a car 19.27   // clearLat = 2.54 + slew .5 × 4.7 + .3; channels 6.9 + 4 × 2.9 = 18.5, plus half a car 19.77
  /* the racing line: in toward the apex by `line` units per unit of curvature, pulled the other way
     by what the road does `ahead` units either side (wide in, wide out), at most `lineMax` (the
     outer wheels then sit on the white line: 2.67 + .25 + 16.8 + 1.27 = 20.99), smoothed over ±15 and
     never steeper than `slew` a unit, precomputed per circuit */
  line: 2000, lineAnticipate: 500, ahead: 28, lineMax: 15.7, slew: .5,   // 15.7: the widest rest place (4.0) plus half a car then sits on the white line   // 2000/500: within 4 of the white line through 97% of the twisty's corners
  roll: 14,                // a car rolls out of a bend: radians per unit of curvature, capped per vehicle by its spec (small: the wheels have to stay down)
  view: 11 };              // how far each side of the road the TV shots frame: the pack and the first three channels
// first place gets clear air ahead of second: on a diagonal view that is what makes the
// leader read at a glance. Order is untouched; only the gap grows.
const LEAD_GAP = 6;
// bikes: a gentle weave inside the lane (amplitude, wavelength) and the lean it and the bends call for
const WEAVE_A = .3, WEAVE_L = 8, LEAN_K = 52, MAX_LEAN = .95;

const smoothStep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * t * (t * (t * 6 - 15) + 10); };
/* The field's speed through a change: up from wherever it was over the launch, full while the order
   changes and the pack tucks back in, then down to the cruise. `settled` is absolute clock time. */
function playbackAt(e, initial, now, merged) {
  if (e < accelMs) return initial + (1 - initial) * smoothStep(e / accelMs);
  if (now <= merged) return 1;                       // full speed until the field has merged back onto the line
  return 1 - (1 - SLOW_RATE) * smoothStep((now - merged) / DECEL_MS);
}
export function trackPose(distance, lane = 0) {
  const angle = distance / TRACK_RADIUS, radius = TRACK_RADIUS + lane;
  return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius, angle, radius };
}

/* ---------------- the world ---------------- */
function buildWorld(scene, sponsors) {
  let seed = 7312;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const range = (a, b) => a + (b - a) * rand();
  const polar = (radius, angle) => [Math.sin(angle) * radius, Math.cos(angle) * radius];
  const world = new THREE.Group(); scene.add(world);

  function ring(inner, outer, y, material, segments = 720) {
    const verts = [], uv = [];
    for (let i = 0; i < segments; i++) {
      const a = i / segments * Math.PI * 2, b = (i + 1) / segments * Math.PI * 2;
      const [ix, iz] = polar(inner, a), [ox, oz] = polar(outer, a), [nx, nz] = polar(inner, b), [qx, qz] = polar(outer, b);
      verts.push(ix, y, iz, ox, y, oz, nx, y, nz, ox, y, oz, qx, y, qz, nx, y, nz);
      uv.push(0, i / segments, 1, i / segments, 0, (i + 1) / segments, 1, i / segments, 1, (i + 1) / segments, 0, (i + 1) / segments);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const o = mesh(world, g, material); o.castShadow = false; return o;
  }

  // A single faceted globe with a level circuit engineered around its crown.
  const profile = [[0, -290], [35, -287], [75, -270], [115, -242], [151, -200], [176, -151], [183, -110],
    [177, -76], [164, -42], [150, -17], [140, -5], [135, -1], [132, -.35], [87, -.35], [82, .5], [77, .1],
    [72, -1], [0, -1]].map(([r, y]) => new THREE.Vector2(r, y));
  const planetGeo = new THREE.LatheGeometry(profile, 112).toNonIndexed();
  {
    const colors = [], p = planetGeo.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
      const c = new THREE.Color(y < -42 ? '#648b57' : y < -7 ? '#7c984c' : '#91a64d').multiplyScalar(range(.91, 1.07));
      for (let j = 0; j < 3; j++) colors.push(c.r, c.g, c.b);
    }
    planetGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  mesh(world, planetGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })).castShadow = false;

  // the lake inside the ring, with a sparkle that drifts
  const lakeMat = new THREE.MeshStandardMaterial({ color: '#369fc8', roughness: .22, metalness: .2 });
  lakeMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 }; lakeMat.userData.shader = shader;
    shader.vertexShader = 'varying vec3 vWaterWorld;\n' + shader.vertexShader.replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nvWaterWorld = (modelMatrix * vec4(transformed, 1.)).xyz;');
    shader.fragmentShader = 'uniform float uTime; varying vec3 vWaterWorld;\n' + shader.fragmentShader.replace('#include <color_fragment>',
      `#include <color_fragment>
      float ripple = sin(vWaterWorld.x * 1.13 + vWaterWorld.z * .23 + uTime * .3) * sin(vWaterWorld.z * 2.9 + uTime * .19);
      diffuseColor.rgb += pow(max(0., ripple), 18.) * vec3(.13, .19, .2);`);
  };
  const water = mesh(world, new THREE.CircleGeometry(72, 128), lakeMat, 0, -.7, 0);
  water.rotation.x = -Math.PI / 2; water.castShadow = false;
  ring(72, 77, -.4, mat('#acb481'), 256);

  // road with a fine aggregate texture, a cream apron, curbs, edge lines and guardrails
  const roadTex = canvasTexture(512, 512, (x) => {
    let s2 = 991; const r2 = () => { s2 = (s2 * 1664525 + 1013904223) >>> 0; return s2 / 4294967296; };
    x.fillStyle = '#727b87'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 34000; i++) {
      const v = Math.floor(94 + r2() * 70);
      x.fillStyle = `rgba(${v},${v},${v + 7},${.05 + r2() * .19})`;
      x.fillRect(r2() * 512, r2() * 512, .3 + r2(), .3 + r2());
    }
  });
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(3, Math.round(CIRCUIT / 5));
  ring(TRACK_RADIUS - 22.3, TRACK_RADIUS + 22.3, -.12, mat('#eee8d7'));
  ring(TRACK_RADIUS - 21.2, TRACK_RADIUS + 21.2, 0,
    new THREE.MeshStandardMaterial({ map: roadTex, color: '#cbd0d8', roughness: .94 }));
  const curbTex = canvasTexture(8, 128, (x) => {
    x.fillStyle = '#f16d73'; x.fillRect(0, 0, 8, 64); x.fillStyle = '#fff7e8'; x.fillRect(0, 64, 8, 64);
  });
  curbTex.wrapS = curbTex.wrapT = THREE.RepeatWrapping; curbTex.repeat.y = Math.round(CIRCUIT / 4.4);
  const curbMat = new THREE.MeshStandardMaterial({ map: curbTex, roughness: .9 });
  for (const side of [-1, 1]) {
    const r = TRACK_RADIUS + side * 21.7;
    ring(r - .56, r + .56, .03, curbMat);
    const edge = TRACK_RADIUS + side * 21.05;
    ring(edge - .085, edge + .085, .035, mat('#fff8ec'));
    const rail = TRACK_RADIUS + side * 23.3;
    for (const h of [.55, .92]) {
      const m = mesh(world, new THREE.TorusGeometry(rail, .105, 5, 480), mat('#bcc4c4', .5, .4), 0, h, 0);
      m.rotation.x = Math.PI / 2;
    }
    for (let i = 0; i < 160; i++) {
      const a = i / 160 * Math.PI * 2, [x, z] = polar(rail, a);
      const o = box(world, .17, 1.4, .2, x, .6, z, '#a4b0b3', .85); o.rotation.y = a;
    }
  }

  /* Trackside signage: low hoardings along the infield edge, parallel to the track and
     facing it, like circuit advertising boards. Content comes from sponsors.json. */
  const boardFaces = [], OUTER_BOARD_R = TRACK_RADIUS + 25.5, STEP = Math.PI * 2 / 24;
  // true where a tree or rock would stand in front of an outer board (placement keeps its
  // random draws either way, so the rest of the world is unchanged)
  const outerBoardAt = (a, r) => {
    if (!sponsors.length || r > 140) return false;
    const f = ((a / STEP - .5) % 1 + 1) % 1;
    return Math.min(f, 1 - f) * STEP * OUTER_BOARD_R < 9.5;
  };
  if (sponsors.length) {
    const signMats = signMaterials(sponsors);   // text or sponsor artwork; clickable through material.userData
    // 20 units wide at radius 85: the board ends stay inside the inner guardrail (85.6 vs 86.7)
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2, [x, z] = polar(TRACK_RADIUS - 25, a), g = new THREE.Group();
      g.position.set(x, 0, z); g.rotation.y = a; world.add(g);
      box(g, 20.3, 4, .3, 0, 2.6, 0, '#7c898c', .85);
      const face = mesh(g, new THREE.PlaneGeometry(20, 3.8), signMats[i % signMats.length], 0, 2.6, .16);
      face.castShadow = false; boardFaces.push({ face, half: 10, halfH: 1.9 });
      box(g, .16, 4.8, .18, -10.15, 2, 0, '#a9b5b7', .85); box(g, .16, 4.8, .18, 10.15, 2, 0, '#a9b5b7', .85);
    }
    /* Outer verge: low boards tilted back toward the lens, like TV-facing trackside boards.
       Between the outer guardrail (133.3) and the forest (137+), top edge ~2.3 units high, so
       from the elevated camera they sit below the outer-lane cars rather than over them. */
    for (let i = 0; i < 24; i++) {
      const a = (i + .5) / 24 * Math.PI * 2, [x, z] = polar(OUTER_BOARD_R, a), g = new THREE.Group();
      g.position.set(x, 0, z); g.rotation.y = a; world.add(g);
      const tilt = new THREE.Group(); tilt.position.set(0, .35, 0); tilt.rotation.x = -.9; g.add(tilt);
      box(tilt, 16.3, 3.2, .25, 0, 1.6, -.14, '#7c898c', .85);
      const face = mesh(tilt, new THREE.PlaneGeometry(16, 3), signMats[(i + 3) % signMats.length], 0, 1.6, .01);
      face.castShadow = false; boardFaces.push({ face, half: 8, halfH: 1.5 });
      box(g, .16, 2.2, .18, -7, -.6, .3, '#a9b5b7', .85); box(g, .16, 2.2, .18, 7, -.6, .3, '#a9b5b7', .85);
    }
  }

  // landmarks: rocks, forest, island peaks, a village, a lighthouse, a viaduct, boats, clouds
  function rock(x, y, z, size = 1) {
    const m = mesh(world, new THREE.IcosahedronGeometry(size, 0), mat(['#aaa99e', '#bbb6a7', '#9da5a5'][Math.floor(rand() * 3)]), x, y, z);
    m.rotation.set(rand(), rand() * 6, rand()); m.scale.set(range(.8, 1.3), range(.7, 1.1), range(.8, 1.2));
    return m;
  }
  for (let i = 0; i < 170; i++) {
    const a = rand() * Math.PI * 2, r = i < 90 ? range(136, 143) : range(73, 80), [x, z] = polar(r, a);
    const m = rock(x, i < 90 ? -2 : -.3, z, range(.8, 2.4));
    if (i < 90 && outerBoardAt(a, r)) m.scale.setScalar(1e-4);
  }
  {
    const count = 620;
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.14, .21, 1.7, 5), mat('#817046'), count);
    const tops = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 3.2, 5), mat('#ffffff'), count);
    const upper = new THREE.InstancedMesh(new THREE.ConeGeometry(.77, 2.7, 5), mat('#ffffff'), count);
    for (const o of [trunks, tops, upper]) { o.castShadow = true; o.receiveShadow = true; world.add(o); }
    const dummy = new THREE.Object3D(), treeColors = ['#789837', '#8aa638', '#638b37', '#98af48', '#709749', '#9cb341'];
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2, r = i < 400 ? range(137, 151) : range(77.5, 82), [x, z] = polar(r, a);
      const scale = range(.7, 1.75), y = i < 400 ? -1 - Math.max(0, r - 137) * .95 : -.15;
      dummy.scale.setScalar(scale); dummy.rotation.y = rand() * 6;
      if (i < 400 && outerBoardAt(a, r)) dummy.scale.setScalar(1e-4);
      dummy.position.set(x, y + .6 * scale, z); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.y = y + 2.3 * scale; dummy.updateMatrix(); tops.setMatrixAt(i, dummy.matrix);
      dummy.position.y = y + 3.8 * scale; dummy.updateMatrix(); upper.setMatrixAt(i, dummy.matrix);
      const c = new THREE.Color(treeColors[i % 6]);
      tops.setColorAt(i, c); upper.setColorAt(i, c.clone().multiplyScalar(1.07));
    }
  }
  const peakMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
  function mountain(x, z, r, h, color) {
    const n = 7, vertices = [], colors = [], c = new THREE.Color(color), snow = new THREE.Color('#fff8f4');
    const points = Array.from({ length: n }, (_, i) => [Math.cos(i / n * Math.PI * 2) * r * range(.8, 1.2), Math.sin(i / n * Math.PI * 2) * r * range(.7, 1.1)]);
    for (let j = 0; j < n; j++) {
      const a = points[j], b = points[(j + 1) % n], cut = range(.6, .77), cut2 = range(.6, .77);
      const A = [a[0], 0, a[1]], B = [b[0], 0, b[1]], C = [a[0] * (1 - cut), h * cut, a[1] * (1 - cut)];
      const D = [b[0] * (1 - cut2), h * cut2, b[1] * (1 - cut2)], peak = [0, h, 0];
      for (const [tri, base] of [[[A, C, B], c], [[C, D, B], c], [[C, peak, D], snow]]) {
        const shade = base.clone().multiplyScalar(range(.8, 1.09));
        for (const p of tri) { vertices.push(...p); colors.push(shade.r, shade.g, shade.b); }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    mesh(world, geo, peakMat, x, -.5, z);
  }
  for (let i = 0; i < 9; i++) {
    const a = 2 + i * .29, [x, z] = polar(range(39, 53), a);
    mountain(x, z, range(14, 23), range(22, 42), ['#84a0c3', '#91adbe', '#7896b8'][i % 3]);
  }
  for (let i = 0; i < 58; i++) {
    const a = -1.2 + i * .025, [x, z] = polar(range(74, 79), a);
    const w = range(1.4, 2.5), h = range(1.5, 3.5), d = range(1.5, 2.5), g = new THREE.Group();
    g.position.set(x, .1, z); g.rotation.y = a; world.add(g);
    box(g, w, h, d, 0, h / 2, 0, ['#f1e6cc', '#e4b38d', '#f2d1b7', '#fff1d9'][i % 4], .85);
    const roof = mesh(g, new THREE.CylinderGeometry(0, 1, 1, 4), mat(['#b3735d', '#a46a51', '#808d93'][i % 3]), 0, h + .3, 0);
    roof.scale.set(w * .8, 1, d * .8); roof.rotation.y = Math.PI / 4;
    for (let j = 0; j < 2; j++) box(g, .23, .43, .02, -w * .22 + j * w * .44, h * .6, d / 2 + .015, '#6e8998', .85);
  }
  {
    const lighthouse = new THREE.Group(), [lx, lz] = polar(69, .4);
    lighthouse.position.set(lx, 0, lz); world.add(lighthouse); rock(lx, -.7, lz, 3.2);
    for (const [top, bottom, h, y, color] of [[.85, 1.5, 7, 3.1, '#f5efdc'], [.98, 1.1, .65, 5.7, '#e75e48'],
      [1.1, 1.1, .28, 6.8, '#e65e46'], [.65, .65, 1.1, 7.4, '#cde3e7'], [0, 1.05, 1, 8.35, '#e9654e']]) {
      mesh(lighthouse, new THREE.CylinderGeometry(top, bottom, h, 10), mat(color), 0, y, 0);
    }
  }
  for (let i = 0; i < 12; i++) {
    const x = -57 + i * 4.6, z = 15;
    box(world, .65, 5, .8, x, 1.7, z, '#b7beb3', .85); box(world, 4.8, .5, 2, x, 4.3, z, '#c5cabc', .85);
    box(world, 4.8, .22, .16, x, 5.05, z + 1, '#a9b6ae', .85);
  }
  const sailMat = new THREE.MeshStandardMaterial({ color: '#fffaf1', side: THREE.DoubleSide, roughness: .75 });
  for (let i = 0; i < 12; i++) {
    const a = range(-.4, 1.7), r = range(16, 60), [x, z] = polar(r, a), g = new THREE.Group();
    g.position.set(x, -.57, z); g.rotation.y = range(-1, 1); g.scale.setScalar(range(.7, 1.3)); world.add(g);
    const hull = mesh(g, new THREE.SphereGeometry(1, 8, 4), mat('#fff3dd')); hull.scale.set(1.6, .24, .45);
    mesh(g, new THREE.CylinderGeometry(.03, .03, 3.6, 6), mat('#c3cbd0'), 0, 1.8, 0);
    const sail = new THREE.BufferGeometry();
    sail.setAttribute('position', new THREE.Float32BufferAttribute([.08, .45, 0, .08, 3.5, 0, 1.4, .45, 0, -.08, .5, 0, -1, .5, 0, -.08, 2.85, 0], 3));
    sail.computeVertexNormals();
    mesh(g, sail, sailMat);
  }
  const clouds = cloudField();
  for (let i = 0; i < 17; i++) {
    const a = i / 17 * Math.PI * 2, [x, z] = polar(range(250, 300), a), y = range(90, 120), lumps = [];
    for (let j = 0; j < 4; j++) { const r = range(4.5, 8); lumps.push({ o: new V(j * 5.5, range(-1.5, 2), 0), r }); }
    clouds.addCluster(new V(x, y, z), UP, lumps);
  }
  clouds.build(world);

  // static geometry stays static: merge it once. Boats ride still water now — bobbing
  // kept 36 meshes apart, for motion nobody could see at this distance.
  // where each board face is, before merging folds the meshes away
  world.updateMatrixWorld(true);
  const boards = boardFaces.map(({ face, half, halfH }) => ({
    c: face.getWorldPosition(new V()), half, halfH,
    t: new V(1, 0, 0).transformDirection(face.matrixWorld),
    u: new V(0, 1, 0).transformDirection(face.matrixWorld),
    n: new V(0, 0, 1).transformDirection(face.matrixWorld)
  }));
  mergeStatic(world, new Set([water]), 2);
  const signs = [];
  world.traverse((o) => { if (o.isMesh && o.material.userData && o.material.userData.sponsor) signs.push(o); });

  return {
    group: world, signs, boards, clouds,
    update(time) { if (lakeMat.userData.shader) lakeMat.userData.shader.uniforms.uTime.value = time; }
  };
}

/* ---------------- the cars ---------------- */
function buildCar(lab, index, paintLogo, sponsors) {
  const g = new THREE.Group();
  const color = new THREE.Color(lab.paint || lab.color);
  const dark = color.clone().multiplyScalar(.73);
  const lum = color.r * .2126 + color.g * .7152 + color.b * .0722;   // linear luminance
  const ink = lum > .45 ? '#333846' : '#ffffff';
  const whiteMat = mat('#fffaf0', .38), visorMat = mat('#1d293b', .19, .45);

  function taper(length, widthBack, widthFront, height, x, y, z) {
    const s = new THREE.Shape();
    s.moveTo(-length / 2, -widthBack / 2); s.lineTo(length / 2, -widthFront / 2);
    s.lineTo(length / 2, widthFront / 2); s.lineTo(-length / 2, widthBack / 2); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .055, bevelThickness: .045 });
    geo.rotateX(-Math.PI / 2);
    return mesh(g, geo, mat(color, .37, .12), x, y, z);
  }
  const panelMats = new Map();
  const panel = (tex, w, h, x, y, z) => {
    if (!panelMats.has(tex)) panelMats.set(tex, new THREE.MeshStandardMaterial({ map: tex, transparent: true,
      roughness: .8, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    const o = mesh(g, new THREE.PlaneGeometry(w, h), panelMats.get(tex), x, y, z);
    o.castShadow = false; return o;
  };

  box(g, 4.1, .13, 1.38, -.08, .3, 0, '#202631', .8);                        // floor
  taper(2.85, 1.1, .9, .52, -.45, .4, 0);                                     // tub
  taper(2.08, .74, .3, .28, 1.3, .36, 0);                                     // nose
  for (const z of [-.71, .71]) {
    box(g, 1.9, .5, .44, -.45, .55, z, color, .42, .1);                       // side pods
    box(g, 1.25, .04, .38, -.75, .827, z, dark, .4, .1);
  }
  box(g, .56, .13, 2.48, 2.3, .25, 0, color, .36, .15);                       // front wing
  box(g, .14, .17, 2.45, 2.03, .34, 0, '#1a2330', .5);
  for (const z of [-1.18, 1.18]) box(g, .65, .39, .085, 2.27, .38, z, color, .35, .1);
  box(g, .65, .15, 2.08, -1.85, 1.2, 0, color, .36, .12);                     // rear wing
  box(g, .36, .13, 2.02, -1.94, 1.02, 0, dark, .4);
  for (const z of [-.94, .94]) box(g, .74, .58, .075, -1.84, 1.13, z, color, .4, .1);
  for (const z of [-.45, .45]) box(g, .16, .8, .12, -1.75, .72, z, '#29303c');
  const intake = mesh(g, new THREE.ConeGeometry(.34, .95, 4), mat(color, .4, .1), -.95, 1.12, 0); intake.rotation.z = .5;
  box(g, .18, .26, .36, -.78, 1.46, 0, color); box(g, .19, .13, .23, -.675, 1.48, 0, '#202532');
  const cockpit = mesh(g, new THREE.SphereGeometry(.48, 12, 8), mat('#17202e'), -.03, .94, 0); cockpit.scale.set(1.15, .23, .85);
  const body = mesh(g, new THREE.SphereGeometry(.28, 10, 8), whiteMat, .05, 1.04, 0); body.scale.set(.95, 1.1, 1);
  const helmet = mesh(g, new THREE.SphereGeometry(.3, 16, 12), whiteMat, .13, 1.39, 0); helmet.scale.set(.95, 1.02, .92);
  const visor = mesh(g, new THREE.SphereGeometry(.305, 16, 8, 0, Math.PI * 2, Math.PI * .35, Math.PI * .27), visorMat, .13, 1.39, 0);
  visor.scale.set(.96, 1.02, .93);
  const halo = mesh(g, new THREE.TorusGeometry(.48, .035, 5, 16, Math.PI * 1.5), mat(color, .4, .2), .05, 1.24, 0);
  halo.rotation.x = Math.PI / 2; halo.scale.set(1.3, 1, 1);
  beam(g, new V(.58, .85, 0), new V(.63, 1.23, 0), .03, color);
  for (const z of [-.54, .54]) { box(g, .26, .13, .13, .35, 1, z, color); beam(g, new V(.25, .88, z * .65), new V(.35, 1, z), .025, color); }

  // wheels: tyres are symmetric so they merge with the body; hubs carry the rotation
  const tyreGeo = new THREE.CylinderGeometry(.49, .49, .42, 16, 1); tyreGeo.rotateX(Math.PI / 2);
  const hubs = [];
  for (const x of [-1.27, 1.35]) for (const z of [-1.06, 1.06]) {
    mesh(g, tyreGeo, mat('#171c27', .96), x, .49, z);
    const hub = mesh(g, hubGeometry(Math.sign(z)), mat('#8b97a4', .35, .65), x, .49, z);
    hub.castShadow = false; hubs.push(hub);
    beam(g, new V(x - .25, .48, Math.sign(z) * .4), new V(x, .49, z), .032, '#29303b');
    beam(g, new V(x + .25, .35, Math.sign(z) * .4), new V(x, .49, z), .028, '#29303b');
  }

  // lettering: the lab's newest model on the side pods, grid number on the nose, logo on the wing
  const nameTex = canvasTexture(512, 128, (x, w, h) => {
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = ink;
    fitFont(x, lab.model, 700, 66, 26, w * .92);
    x.fillText(lab.model, w / 2, h * .54, w * .94);
  });
  for (const side of [-1, 1]) {
    const t = panel(nameTex, 1.66, .39, -.45, .57, side * .938);
    if (side < 0) t.rotation.y = Math.PI;
  }
  const numTex = canvasTexture(128, 128, (x, w, h) => {
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = ink;
    x.font = '700 92px Fredoka, Arial, sans-serif'; x.fillText(String(index + 1).padStart(2, '0'), w / 2, h * .55);
  });
  const num = panel(numTex, .36, .36, 1.12, .724, 0); num.rotation.x = -Math.PI / 2; num.rotation.z = -Math.PI / 2;
  const logoTex = canvasTexture(256, 160, (x, w, h) => {
    x.fillStyle = '#fffaf0'; x.beginPath(); x.arc(w / 2, h / 2, 70, 0, Math.PI * 2); x.fill();
    paintLogo(x, lab.id, w / 2, h / 2, 96);
  });
  const logo = panel(logoTex, .65, .4, -1.84, 1.285, 0); logo.rotation.x = -Math.PI / 2;

  // sponsor stickers: the rear wing faces the rear camera, the endplates, floor and nose face the rest
  const kit = decals(sponsors), pick = (k) => index * 3 + k;
  // helmets take the short bold mark: a full name at helmet size cannot be read
  const onHelmet = kit.onBold ? kit.onBold(index + 2) : pick(2);
  decal(g, kit, pick(0), 1.2, -2.2, 1.12, 0, { y: -Math.PI / 2 });   // clear of the logo on the wing above
  for (const side of [-1, 1]) {
    const out = side < 0 ? Math.PI : 0;
    decal(g, kit, pick(2), .56, -1.84, 1.13, side * .99, { y: out });
    decal(g, kit, pick(1), .62, .2, .33, side * .70, { y: out });
    decal(g, kit, pick(0), .3, 1.15, .42, side * .28, { y: out });
    decalSphere(g, kit, onHelmet, .309, .13, 1.39, 0, { phi: side * Math.PI / 2, width: 1.25, rise: .3, scale: [.95, 1.02, .92] });
  }

  // fold the near-duplicate materials into paint, darker paint and trim before merging
  const paint = mat(color, .38, .12), darkPaint = mat(dark, .4, .1), trim = mat('#222936', .6, .05);
  const paintHex = color.getHexString(), darkHex = dark.getHexString();
  const trimHex = new Set(['#202631', '#1a2330', '#29303c', '#202532', '#17202e', '#29303b']
    .map((c) => new THREE.Color(c).getHexString()));
  g.traverse((o) => {
    if (!o.isMesh || o.material.map || hubs.includes(o)) return;
    const h = o.material.color.getHexString();
    if (h === paintHex) o.material = paint;
    else if (h === darkHex) o.material = darkPaint;
    else if (trimHex.has(h)) o.material = trim;
  });
  mergeStatic(g, new Set(hubs), 2);
  const meshes = [];
  g.traverse((o) => { if (o.isMesh) { o.userData.labId = lab.id; meshes.push(o); } });
  return { g, hubs, meshes, spec: CAR_SPEC };
}

/* What the race needs to know about a vehicle, in its own frame (forward x, up y, right z):
   wheel radius, the rear axle a wheelie turns about, exhausts for the boost flames, where skid
   smoke rises, the label anchor, a body box for label dodging, and the driver's eye. How it moves
   is here too, so the race itself never asks what it is carrying: how far it rolls into a bend
   (`roll`) and into a lane change (`yawRoll`), how far the nose lifts under power (`nose`), how
   much it twitches and pitches under a lock-up (`fishtail`, `pitch`) and how wide it lays rubber. */
const CAR_SPEC = { kind: 'f1', wheelR: .49, rear: -1.27, exhausts: [[-2.2, .58, -.34], [-2.2, .58, .34]], flame: 1, ringX: -2.6,
  puffs: [[-1.35, .25, -1.06], [-1.35, .25, 1.06]], top: 2.1, box: { x: [-2.3, 2.4], y: [0, 1.5], z: [-1.3, 1.3] }, eye: { x: -.55, y: 2.25 },
  roll: .04, yawRoll: .05, nose: .05, fishtail: .08, pitch: .02, mark: .29 };   // 2.3 degrees: the outer wheel at 1.06 drops .043, inside the .07 of ride height
const BIKE_SCALE = 1.75;           // a real MotoGP bike is ~2 m long: drawn bigger so it reads beside the cars' lanes
const BIKE_SPEC = { kind: 'motogp', wheelR: .31 * BIKE_SCALE, rear: -.72 * BIKE_SCALE, exhausts: [[-.84 * BIKE_SCALE, .62 * BIKE_SCALE, .1 * BIKE_SCALE]],
  flame: .4, ringX: -1.05 * BIKE_SCALE, puffs: [[-.72 * BIKE_SCALE, .06, 0]], top: 1.24 * BIKE_SCALE,
  box: { x: [-.95 * BIKE_SCALE, 1.03 * BIKE_SCALE], y: [0, 1.14 * BIKE_SCALE], z: [-.3 * BIKE_SCALE, .3 * BIKE_SCALE] },
  eye: { x: -.3 * BIKE_SCALE, y: 1.32 * BIKE_SCALE },            // over the rider's shoulders: helmet, screen and nose below
  roll: 0, yawRoll: 0, nose: 0, fishtail: .06, pitch: .05, mark: .21 };   // a bike leans instead of rolling, and wheelies instead of lifting its nose
const STOCK_SPEC = { kind: 'nascar', wheelR: .46, rear: -1.35, exhausts: [[-.86, .5, -.72], [-.86, .5, .72]], flame: .8, ringX: -2.75,
  puffs: [[-1.35, .25, -.92], [-1.35, .25, .92]], top: 1.8, box: { x: [-2.5, 2.45], y: [0, 1.68], z: [-1.1, 1.1] },
  eye: { x: -.98, y: 1.9 },                                      // the roof camera, a shot NASCAR actually carries: the roof and its number fill the bottom of the frame
  roll: .05, yawRoll: .07, nose: .03, fishtail: .14, pitch: .035, mark: .34 };   // 2.9 degrees, and a tall body makes more of it than an F1 car's does; it steps further out under a lock-up too

/* ---------------- the bikes ----------------
   Modelled in metres, then scaled. A tucked rider over a winged fairing, two wheels whose hubs
   turn, the lab's model name on the fairing, its logo on the tail and grid number on the nose. */
function buildBike(lab, index, paintLogo, sponsors) {
  const g = new THREE.Group();
  const color = new THREE.Color(lab.paint || lab.color);
  const dark = color.clone().multiplyScalar(.73);
  const lum = color.r * .2126 + color.g * .7152 + color.b * .0722;
  const ink = lum > .45 ? '#333846' : '#ffffff';
  const whiteMat = mat('#fffaf0', .38), visorMat = mat('#1d293b', .19, .45);
  const metal = '#9aa5b1';

  // a side profile (x forward, y up) extruded across the bike, narrowing toward `narrowAt`
  function profile(points, width, material, narrow) {
    const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .018, bevelThickness: .018 });
    geo.translate(0, 0, -width / 2);
    if (narrow) {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * narrow(p.getX(i), p.getY(i)));
      geo.computeVertexNormals();
    }
    return mesh(g, geo, material);
  }
  const limb = (a, b, r, color) => {
    const d = b.clone().sub(a);
    const o = mesh(g, new THREE.CapsuleGeometry(r, Math.max(.001, d.length()), 3, 7), color?.isMaterial ? color : mat(color, .5, .05));
    o.position.copy(a).add(b).multiplyScalar(.5); o.quaternion.setFromUnitVectors(UP, d.normalize());
    return o;
  };
  const panelMats = new Map();
  const panel = (tex, w, h, x, y, z) => {
    if (!panelMats.has(tex)) panelMats.set(tex, new THREE.MeshStandardMaterial({ map: tex, transparent: true,
      roughness: .8, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    const o = mesh(g, new THREE.PlaneGeometry(w, h), panelMats.get(tex), x, y, z);
    o.castShadow = false; return o;
  };
  const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

  // wheels: round-profile tyres merge with the body; the hubs (rim, spokes, brake discs) turn
  const hubs = [];
  for (const [x, front] of [[-.72, false], [.72, true]]) {
    const tyre = new THREE.TorusGeometry(.225, front ? .085 : .095, 8, 22);
    const t = mesh(g, tyre, mat('#171c27', .96), x, .31, 0); if (!front) t.scale.z = 1.15;
    const hub = mesh(g, bikeHubGeometry(front), mat(metal, .35, .65), x, .31, 0);
    hub.castShadow = false; hubs.push(hub);
  }
  // front fork, raked back, with the mudguard over the tyre
  for (const z of [-.075, .075]) beam(g, new V(.72, .31, z), new V(.55, .74, z), .024, '#d9b44a');
  const guard = mesh(g, new THREE.TorusGeometry(.33, .028, 4, 10, Math.PI * .42), mat(color, .4, .1), .72, .31, 0);
  guard.rotation.z = Math.PI * .34; guard.scale.z = 2.2;
  // swingarm, engine and exhaust
  for (const z of [-.1, .1]) beam(g, new V(-.12, .36, z), new V(-.72, .31, z), .032, '#29303c');
  box(g, .44, .3, .26, -.02, .36, 0, '#29303c', .6, .2);
  beam(g, new V(-.05, .24, .1), new V(-.46, .44, .13), .038, '#5d6672');
  beam(g, new V(-.46, .44, .13), new V(-.8, .62, .1), .045, '#5d6672');

  // fairing: nose, belly pan and side panels in one piece, the nose narrowing to a point
  profile([[.64, .77], [.57, .64], [.38, .4], [.18, .22], [-.18, .2], [-.28, .3], [-.24, .52], [0, .64], [.3, .7], [.5, .8], [.61, .8]],
    .36, mat(color, .37, .12), (x) => 1 - .55 * smooth((x - .38) / .3));
  // windscreen
  profile([[.63, .79], [.43, .97], [.3, .96], [.47, .77]], .24, visorMat, (x) => 1 - .5 * smooth((x - .35) / .3));
  // aero wings on the nose
  for (const z of [-1, 1]) for (const [x, y, s] of [[.5, .6, 1], [.47, .69, .8]]) {
    const w = box(g, .17 * s, .022, .11, x, y, z * .2, dark, .4, .1); w.rotation.z = -.12;
  }
  // tank, seat and tail
  const tank = mesh(g, new THREE.SphereGeometry(1, 12, 8), mat(dark, .4, .1), .1, .7, 0); tank.scale.set(.27, .1, .15);
  profile([[-.18, .64], [-.3, .55], [-.84, .72], [-.9, .8], [-.62, .84], [-.3, .74]], .26, mat(color, .37, .12),
    (x) => 1 - .45 * smooth((-x - .45) / .4));
  box(g, .3, .05, .2, -.38, .74, 0, '#202532');                                                // seat pad
  // clip-on bars
  for (const z of [-1, 1]) beam(g, new V(.47, .8, z * .09), new V(.43, .78, z * .2), .016, '#202532');

  // the rider, tucked in behind the screen
  // leathers share the fairing's paint materials, so a rider adds no draw calls of its own
  const leathers = mat(color, .38, .12), leathersDark = mat(dark, .4, .1), trimMat = mat('#222936', .6, .05);
  limb(new V(-.28, .83, 0), new V(.17, .93, 0), .13, leathers);                                  // torso
  // the aero hump behind the rider's shoulders: long, and drawn to a point at the tail
  const humpGeo = new THREE.SphereGeometry(.085, 14, 10);
  {
    const q = humpGeo.attributes.position;
    for (let i = 0; i < q.count; i++) {
      const t = Math.max(0, Math.min(1, (q.getX(i) + .085) / .17));   // 0 at the tail, 1 at the shoulders
      const k = .34 + .66 * t;
      q.setY(i, q.getY(i) * k); q.setZ(i, q.getZ(i) * k);
    }
    humpGeo.computeVertexNormals();
  }
  const hump = mesh(g, humpGeo, leathersDark, -.13, .983, 0); hump.scale.set(2.05, .82, .95);
  for (const z of [-1, 1]) {
    limb(new V(.17, .92, z * .13), new V(.29, .76, z * .2), .045, leathers);                     // upper arm
    limb(new V(.29, .76, z * .2), new V(.45, .79, z * .19), .04, leathersDark);                  // forearm
    mesh(g, new THREE.SphereGeometry(.045, 8, 6), trimMat, .46, .79, z * .19);                   // glove
    limb(new V(-.26, .78, z * .12), new V(.03, .6, z * .25), .066, leathers);                    // thigh
    limb(new V(.03, .6, z * .25), new V(-.25, .43, z * .19), .05, leathersDark);                 // shin
    box(g, .15, .06, .065, -.24, .41, z * .19, trimMat);                                         // boot
  }
  const helmet = mesh(g, new THREE.SphereGeometry(.15, 16, 12), whiteMat, .33, .99, 0); helmet.scale.set(1.05, .95, .92);
  const visor = mesh(g, new THREE.SphereGeometry(.152, 16, 8, Math.PI * .55, Math.PI * .9, Math.PI * .36, Math.PI * .24), visorMat, .33, .99, 0);
  visor.scale.set(1.05, .95, .92);

  // lettering: model name on the fairing, logo on the tail, grid number on the nose
  const nameTex = canvasTexture(512, 128, (x, w, h) => {
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = ink;
    fitFont(x, lab.model, 700, 66, 26, w * .92);
    x.fillText(lab.model, w / 2, h * .54, w * .94);
  });
  for (const side of [-1, 1]) {
    const t = panel(nameTex, .46, .115, .08, .43, side * .2);
    if (side < 0) t.rotation.y = Math.PI;
  }
  const numTex = canvasTexture(128, 128, (x, w, h) => {
    x.fillStyle = '#fffaf0'; x.beginPath(); x.ellipse(w / 2, h / 2, 60, 52, 0, 0, Math.PI * 2); x.fill();
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#231A08';
    x.font = '700 76px Fredoka, Arial, sans-serif'; x.fillText(String(index + 1).padStart(2, '0'), w / 2, h * .55);
  });
  const num = panel(numTex, .12, .12, .6, .72, 0); num.rotation.y = Math.PI / 2; num.rotation.x = -.5;
  const logoTex = canvasTexture(160, 160, (x, w, h) => {
    x.fillStyle = '#fffaf0'; x.beginPath(); x.arc(w / 2, h / 2, 74, 0, Math.PI * 2); x.fill();
    paintLogo(x, lab.id, w / 2, h / 2, 100);
  });
  for (const side of [-1, 1]) {
    const t = panel(logoTex, .15, .15, -.62, .76, side * .102);
    if (side < 0) t.rotation.y = Math.PI;
  }

  // sponsor stickers, in metres like the rest of the bike
  const kit = decals(sponsors), pick = (k) => index * 3 + k;
  const onHelmet = kit.onBold ? kit.onBold(index + 2) : pick(2);
  const onTail = kit.onBold ? kit.onBold(index + 1) : pick(1);
  // the number plate: upright off the back of the tail, where the rear camera reads it square on
  decal(g, kit, onTail, .28, -.93, .775, 0, { y: -Math.PI / 2 });
  /* Only the back of the helmet. A patch near the sides lifts off the shell, because the helmet is a
     squashed sphere and the patch is a round one; kept tight to the crown it sits flush. */
  decalSphere(g, kit, onHelmet, .157, .33, .99, 0, { phi: 0, width: 1.15, rise: .6, scale: [1.05, .95, .92] });
  for (const side of [-1, 1]) {
    const out = side < 0 ? Math.PI : 0;
    /* Each sits a little proud of its panel: flush with the surface, the two faces fight for the same
       depth and the sticker flickers in and out. The tilt follows the panel it is on - the tail rises
       toward the back, the rider leans forward - so it reads as painted on rather than pinned on. */
    decal(g, kit, pick(0), .3, .02, .3, side * .208, { y: out });                    // fairing flank
    decal(g, kit, pick(2), .36, -.62, .783, side * .134, { y: out, z: side * -.28 });  // one per seat side
    decal(g, kit, onTail, .24, -.06, .9, side * .147, { y: out, z: side * .22 });    // the rider, both sides
  }

  const paint = mat(color, .38, .12), darkPaint = mat(dark, .4, .1), trim = mat('#222936', .6, .05);
  const paintHex = color.getHexString(), darkHex = dark.getHexString();
  const trimHex = new Set(['#29303c', '#202532', '#5d6672'].map((c) => new THREE.Color(c).getHexString()));
  g.traverse((o) => {
    if (!o.isMesh || o.material.map || hubs.includes(o)) return;
    const h = o.material.color.getHexString();
    if (h === paintHex) o.material = paint;
    else if (h === darkHex) o.material = darkPaint;
    else if (trimHex.has(h)) o.material = trim;
  });
  mergeStatic(g, new Set(hubs), 2);
  // everything was drawn in metres: scale the parts, so the group's own frame is in world units
  for (const o of g.children) { o.position.multiplyScalar(BIKE_SCALE); o.scale.multiplyScalar(BIKE_SCALE); }
  const meshes = [];
  g.traverse((o) => { if (o.isMesh) { o.userData.labId = lab.id; meshes.push(o); } });
  return { g, hubs, meshes, spec: BIKE_SPEC };
}

const bikeHubCache = new Map();
function bikeHubGeometry(front) {
  if (bikeHubCache.has(front)) return bikeHubCache.get(front);
  const parts = [];
  const rim = new THREE.CylinderGeometry(.15, .15, .07, 14); rim.rotateX(Math.PI / 2); parts.push(rim);
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const spoke = new THREE.BoxGeometry(.3, .022, .012); spoke.rotateZ(k * Math.PI / 3); spoke.translate(0, 0, side * .038);
      parts.push(spoke);
    }
    if (front) { const disc = new THREE.CylinderGeometry(.13, .13, .008, 16); disc.rotateX(Math.PI / 2); disc.translate(0, 0, side * .06); parts.push(disc); }
  }
  const merged = mergeGeometries(parts.map((p) => { const q = p.index ? p.toNonIndexed() : p; q.deleteAttribute('uv'); return q; }), false);
  merged.userData.shared = true;
  bikeHubCache.set(front, merged);
  return merged;
}

/* ---------------- the stock cars ----------------
   NASCAR, on the same wheelbase as the F1 car so it sits in the same lanes. The body is one side
   profile extruded across the car with the two wheel arches cut out of it as holes, tucked inboard
   of the tyres below the fender line; the greenhouse is a belt band and a glasshouse above it,
   tumbled in toward the roof. Number on the doors and on the roof, the lab's newest model across
   the bonnet with the lab's mark beside it, and a sponsor's across the top of the windscreen. */
function buildStock(lab, index, paintLogo, sponsors) {
  const g = new THREE.Group();
  const color = new THREE.Color(lab.paint || lab.color);
  const dark = color.clone().multiplyScalar(.73);
  const lum = color.r * .2126 + color.g * .7152 + color.b * .0722;
  const ink = lum > .45 ? '#333846' : '#ffffff';
  const back = lum > .45 ? '#ffffff' : '#231a08';       // the outline that keeps a number off its own paint
  const visorMat = mat('#1d293b', .19, .45);
  const paintMat = mat(color, .37, .12), darkMat = mat(dark, .4, .1);
  const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

  // a side profile (x forward, y up) extruded across the car, with the arches as holes in it and an
  // optional per-vertex narrowing — the sills tuck in below the fenders, the roof tumbles home
  function profile(points, width, material, { holes = [], narrow = null, bevel = .03 } = {}) {
    const pts = (list) => list.map(([x, y]) => new THREE.Vector2(x, y));
    const s = new THREE.Shape(pts(points));
    for (const h of holes) s.holes.push(new THREE.Path(pts(h)));
    const geo = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: bevel, bevelThickness: bevel });
    geo.translate(0, 0, -width / 2);
    if (narrow) {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * narrow(p.getX(i), p.getY(i)));
      geo.computeVertexNormals();
    }
    return mesh(g, geo, material);
  }
  const panelMats = new Map();
  const panel = (tex, w, h, x, y, z) => {
    if (!panelMats.has(tex)) panelMats.set(tex, new THREE.MeshStandardMaterial({ map: tex, transparent: true,
      roughness: .8, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    const o = mesh(g, new THREE.PlaneGeometry(w, h), panelMats.get(tex), x, y, z);
    o.castShadow = false; return o;
  };

  /* The wheels sit in holes cut clean through the body, so every measure here is set against the
     tyre: half a metre of it across (.185 either side of z = ±.88), .44 of radius. The extrusion's
     bevel shrinks a hole by its own size, so the arches are cut .10 clear of the tyre in every
     direction on a bevel of .018, and the sills below them tuck inboard of the tyres' inner faces.
     Nothing on the car is allowed to pass through a tyre. */
  const BODY = 2.12, BEVEL = .018, SKIN = BODY / 2 + BEVEL;   // across the fenders, then out to where the bevel really puts the flank
  const WH_X = 1.35, WH_Z = .88, WH_R = .46, WH_W = .185;     // axle, track, tyre radius and half its width
  box(g, 4.5, .12, 1.24, -.05, .2, 0, '#202631', .8);  // floor
  // one body: blunt nose, flat bonnet back to the boot, an arch over each axle
  const arch = (cx) => [[cx - .56, .5], [cx + .56, .5], [cx + .56, .86], [cx + .28, 1], [cx - .28, 1], [cx - .56, .86]];
  profile([[2.37, .42], [-2.42, .42], [-2.42, 1.06], [1.62, 1.06], [2.37, .86]], BODY, paintMat, {
    holes: [arch(-WH_X), arch(WH_X)], bevel: BEVEL,
    narrow: (x, y) => (y < .5 ? .58 : 1) * (1 - .1 * smooth((x - 1.5) / .85))
  });
  // inner fenders: without them an arch is a tunnel you can see daylight through
  for (const cx of [-WH_X, WH_X]) for (const z of [-1, 1]) box(g, 1.14, .52, .04, cx, .75, z * .62, '#5b6673', .9);
  profile([[.82, 1], [.74, 1.12], [-1.62, 1.12], [-1.76, 1]], 1.64, paintMat);             // belt band under the glass
  profile([[.74, 1.12], [.52, 1.52], [-1.12, 1.52], [-1.62, 1.12]], 1.64, visorMat,
    { narrow: (x, y) => 1 - .17 * smooth((y - 1.12) / .4) });                              // windscreen, sides and backlight in one
  box(g, 1.76, .07, 1.48, -.3, 1.575, 0, color, .37, .12);                                 // roof, over the glass
  for (const z of [-.64, .64]) box(g, 1.62, .055, .07, -.3, 1.635, z, dark, .4, .1);       // roof rails
  for (const z of [-.26, .26]) box(g, .48, .02, .2, -.92, 1.617, z, '#202532');            // the roof flaps, closed
  // spoiler, splitter, grille, rocker extensions and the side pipes
  const blade = box(g, .07, .32, 2.02, -2.36, 1.23, 0, dark, .4, .1); blade.rotation.z = .26;   // one blade across the boot, no end plates: a stock car's is a plain slab
  box(g, .44, .05, 1.94, 2.32, .44, 0, '#1a2330', .5);
  box(g, .07, .24, 1.46, 2.4, .66, 0, '#1a2330', .5);
  for (const z of [-1, 1]) box(g, 1.58, .17, .06, 0, .47, z, '#29303c');                  // rocker extensions, between the arches
  // side pipes: out at the rocker ahead of the rear tyre, never into it
  for (const z of [-1, 1]) beam(g, new V(-.34, .42, z * .5), new V(-.78, .5, z * .76), .05, '#5d6672');

  // wheels: the tyres are symmetric so they merge with the body; the steel wheels carry the rotation
  const tyreGeo = new THREE.CylinderGeometry(WH_R, WH_R, WH_W * 2, 16, 1); tyreGeo.rotateX(Math.PI / 2);
  const hubs = [];
  for (const x of [-WH_X, WH_X]) for (const z of [-WH_Z, WH_Z]) {
    mesh(g, tyreGeo, mat('#171c27', .96), x, WH_R, z);
    const hub = mesh(g, stockHubGeometry(Math.sign(z)), mat('#b9c2cc', .4, .6), x, WH_R, z);
    hub.castShadow = false; hubs.push(hub);
  }

  // lettering: the model across the windscreen and the tail, the number on both doors and the roof,
  // the lab's mark on the bonnet
  const bannerTex = canvasTexture(512, 80, (x, w, h) => {
    x.fillStyle = '#fffaf0';
    x.beginPath(); x.roundRect(4, 6, w - 8, h - 12, 9); x.fill();
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#231a08';
    fitFont(x, lab.model, 700, 46, 20, w * .88);
    x.fillText(lab.model, w / 2, h * .53, w * .9);
  });
  // the bonnet carries the model, as a stock car carries its sponsor's name: the widest flat panel
  // on the car, and square to the television camera looking down at the pack
  const hood = panel(bannerTex, 1.34, .21, .98, 1.096, 0); hood.rotation.x = -Math.PI / 2; hood.rotation.z = Math.PI / 2;
  const plate = panel(bannerTex, 1.5, .235, -2.456, .74, 0); plate.rotation.y = -Math.PI / 2;   // and again on the tail, square to the rear camera
  const numTex = canvasTexture(160, 160, (x, w, h) => {
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '700 122px Fredoka, Arial, sans-serif';
    x.lineWidth = 12; x.lineJoin = 'round'; x.strokeStyle = back;
    x.strokeText(String(index + 1).padStart(2, '0'), w / 2, h * .55);
    x.fillStyle = ink; x.fillText(String(index + 1).padStart(2, '0'), w / 2, h * .55);
  });
  for (const side of [-1, 1]) {
    const n = panel(numTex, .56, .56, -.2, .76, side * (SKIN + .012));
    if (side < 0) n.rotation.y = Math.PI;
  }
  const roofNum = panel(numTex, .6, .6, -.18, 1.618, 0); roofNum.rotation.x = -Math.PI / 2; roofNum.rotation.z = Math.PI / 2;
  const logoTex = canvasTexture(256, 160, (x, w, h) => {
    x.fillStyle = '#fffaf0'; x.beginPath(); x.arc(w / 2, h / 2, 70, 0, Math.PI * 2); x.fill();
    paintLogo(x, lab.id, w / 2, h / 2, 96);
  });
  const logo = panel(logoTex, .62, .39, 1.38, 1.096, 0); logo.rotation.x = -Math.PI / 2; logo.rotation.z = Math.PI / 2;

  // sponsor stickers: bonnet and grille for the front cameras, doors and quarters for the side,
  // the tail for the rear
  const kit = decals(sponsors), pick = (k) => index * 3 + k;
  const onBold = kit.onBold ? kit.onBold(index + 1) : pick(1);
  /* The windscreen banner, where the bonnet's lettering used to be: a stock car's most-read strip,
     the short bold mark on it so it carries at the size the screen leaves. */
  const banner = decal(g, kit, onBold, 1.2, .66, 1.338, 0);
  if (banner) { banner.rotateY(Math.PI / 2); banner.rotateX(-.502); }
  decal(g, kit, pick(0), .6, -2.05, 1.096, 0, { x: -Math.PI / 2, z: -Math.PI / 2 });  // boot lid
  decal(g, kit, pick(1), .8, 2.45, .6, 0, { y: Math.PI / 2 });                        // grille, square to the car behind
  decal(g, kit, pick(2), .62, -2.456, .52, 0, { y: -Math.PI / 2 });                  // tail, under the model plate
  for (const side of [-1, 1]) {
    const out = side < 0 ? Math.PI : 0;
    decal(g, kit, pick(0), .5, -2.12, .78, side * (SKIN + .012), { y: out });         // rear quarter
    decal(g, kit, pick(1), .42, .52, .78, side * (SKIN + .012), { y: out });          // door, ahead of the number
  }

  const trim = mat('#222936', .6, .05);
  const paintHex = color.getHexString(), darkHex = dark.getHexString();
  const trimHex = new Set(['#202631', '#1a2330', '#29303c', '#202532', '#5d6672'].map((c) => new THREE.Color(c).getHexString()));
  g.traverse((o) => {
    if (!o.isMesh || o.material.map || hubs.includes(o)) return;
    const h = o.material.color.getHexString();
    if (h === paintHex) o.material = paintMat;
    else if (h === darkHex) o.material = darkMat;
    else if (trimHex.has(h)) o.material = trim;
  });
  mergeStatic(g, new Set(hubs), 2);
  const meshes = [];
  g.traverse((o) => { if (o.isMesh) { o.userData.labId = lab.id; meshes.push(o); } });
  return { g, hubs, meshes, spec: STOCK_SPEC };
}

/* A steel wheel: rim, the dish that faces out, five lugs and the centre cap. */
const stockHubCache = new Map();
function stockHubGeometry(side) {
  if (stockHubCache.has(side)) return stockHubCache.get(side);
  const parts = [];
  const rim = new THREE.CylinderGeometry(.29, .29, .34, 12); rim.rotateX(Math.PI / 2); parts.push(rim);
  const dish = new THREE.CylinderGeometry(.27, .27, .045, 12); dish.rotateX(Math.PI / 2); dish.translate(0, 0, side * .172); parts.push(dish);
  for (let k = 0; k < 5; k++) {
    const lug = new THREE.CylinderGeometry(.03, .03, .035, 5); lug.rotateX(Math.PI / 2);
    lug.translate(Math.cos(k * 2 * Math.PI / 5) * .115, Math.sin(k * 2 * Math.PI / 5) * .115, side * .195);
    parts.push(lug);
  }
  const cap = new THREE.CylinderGeometry(.055, .055, .04, 8); cap.rotateX(Math.PI / 2); cap.translate(0, 0, side * .2); parts.push(cap);
  const merged = mergeGeometries(parts.map((p) => { const q = p.index ? p.toNonIndexed() : p; q.deleteAttribute('uv'); return q; }), false);
  merged.userData.shared = true;
  stockHubCache.set(side, merged);
  return merged;
}
/* ---------------- sponsor decals ----------------
   Stickers on the cars and bikes, so a sponsor is on screen from the rear and cinematic cameras too,
   not only on the trackside hoardings. Every mark is drawn once into one atlas texture, so all the
   decals on a vehicle share a material and merge into a single draw call. Decals are not clickable:
   a click anywhere on a vehicle opens that lab's card, as it always has. */
const DECAL_COLS = 4, DECAL_ROWS = 8, DECAL_W = 256, DECAL_H = 64;
let decalKit = null;
function decals(sponsors) {
  if (decalKit) return decalKit;
  const list = (sponsors || []).filter((sp) => sp && sp.text).slice(0, Math.floor(DECAL_COLS * DECAL_ROWS / 3));
  if (!list.length) return (decalKit = { list, material: null });
  // a helmet or a tail is a few centimetres across: the full name there is unreadable, so those
  // cells carry the first word only, set as large as it will go
  const short = (t) => (t.split(' ').length > 1 ? t.split(' ')[0].replace(/[^\w.@%-]/g, '') : t);
  const cell = (x, sp, i, dark, big) => {
    const ox = (i % DECAL_COLS) * DECAL_W, oy = Math.floor(i / DECAL_COLS) * DECAL_H;
    x.save(); x.translate(ox, oy);
    x.fillStyle = dark ? '#16121f' : (sp.bg || '#f6f1e8'); x.fillRect(0, 0, DECAL_W, DECAL_H);
    if (sp.accent) { x.fillStyle = sp.accent; x.fillRect(0, DECAL_H - 5, DECAL_W, 5); }
    x.strokeStyle = dark ? 'rgba(255,246,233,.5)' : 'rgba(20,16,30,.35)';
    x.lineWidth = 3; x.strokeRect(1.5, 1.5, DECAL_W - 3, DECAL_H - 3);
    // artwork only reads on its own background; on the dark plate the name is set instead
    if (big) {
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#FFF6E9';
      fitFont(x, short(sp.text), 700, 54, 26, DECAL_W * .8);
      x.fillText(short(sp.text), DECAL_W / 2, DECAL_H / 2 - 2, DECAL_W * .84);
    } else if (sp.img && sp.img.naturalWidth && !dark) {
      const k = Math.min(DECAL_W * .84 / sp.img.naturalWidth, DECAL_H * .68 / sp.img.naturalHeight);
      const w = sp.img.naturalWidth * k, h = sp.img.naturalHeight * k;
      x.drawImage(sp.img, (DECAL_W - w) / 2, (DECAL_H - 5 - h) / 2, w, h);
    } else {
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = dark ? '#FFF6E9' : (sp.fg || '#252b3e');
      fitFont(x, sp.text, 700, 42, 18, DECAL_W * .86);
      x.fillText(sp.text, DECAL_W / 2, DECAL_H / 2 - 2, DECAL_W * .88);
    }
    x.restore();
  };
  const tex = canvasTexture(DECAL_W * DECAL_COLS, DECAL_H * DECAL_ROWS, (x) => {
    list.forEach((sp, i) => {
      cell(x, sp, i, false);
      cell(x, sp, list.length + i, true);
      cell(x, sp, list.length * 2 + i, true, true);
    });
  });
  // cells 0..n-1 are the sponsor's own colours; n..2n-1 are the same marks on a dark plate
  const wrap = (i) => ((i % list.length) + list.length) % list.length;
  decalKit = { list, count: list.length * 3, onDark: (i) => list.length + wrap(i), onBold: (i) => list.length * 2 + wrap(i),
    material: new THREE.MeshStandardMaterial({ map: tex, roughness: .7, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }) };
  return decalKit;
}
/** A sticker that follows a curved surface: a patch of a sphere, so a helmet decal wraps the helmet
    instead of standing off it as a flat card. */
function decalSphere(g, kit, index, r, x, y, z, { phi = Math.PI / 2, width = .9, scale = null, rise = 0 } = {}) {
  if (!kit.material) return null;
  const i = ((index % kit.count) + kit.count) % kit.count;
  const col = i % DECAL_COLS, row = Math.floor(i / DECAL_COLS);
  // the patch keeps the atlas cell's proportions: arc across ~= 4x arc down
  const height = width * DECAL_H / DECAL_W;
  // theta counts down from the top, so a positive rise lifts the patch up the shell
  const geo = new THREE.SphereGeometry(r, 20, 12, phi - width / 2, width, Math.PI / 2 - height / 2 - rise, height);
  const uv = geo.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, (col + uv.getX(k)) / DECAL_COLS, 1 - (row + 1 - uv.getY(k)) / DECAL_ROWS);
  const o = mesh(g, geo, kit.material, x, y, z);
  o.castShadow = false;
  if (scale) o.scale.set(scale[0], scale[1], scale[2]);
  return o;
}

/** One sticker: a plane whose uvs point at that sponsor's cell of the atlas. Only the width is given —
    the height follows the atlas cell, so a sponsor's mark is never stretched. */
function decal(g, kit, index, w, x, y, z, rot = {}) {
  const h = w * DECAL_H / DECAL_W;
  if (!kit.material) return null;
  const i = ((index % kit.count) + kit.count) % kit.count;
  const col = i % DECAL_COLS, row = Math.floor(i / DECAL_COLS);
  const geo = new THREE.PlaneGeometry(w, h), uv = geo.attributes.uv;
  // the atlas is drawn top-down; texture v runs bottom-up
  for (let k = 0; k < uv.count; k++) uv.setXY(k, (col + uv.getX(k)) / DECAL_COLS, 1 - (row + 1 - uv.getY(k)) / DECAL_ROWS);
  const o = mesh(g, geo, kit.material, x, y, z);
  o.castShadow = false;
  if (rot.x) o.rotation.x = rot.x;
  if (rot.y) o.rotation.y = rot.y;
  if (rot.z) o.rotation.z = rot.z;
  return o;
}

/* The three fields. `RIDES` is the only list of them: the page reads it for its own button. */
const BUILDERS = { f1: buildCar, motogp: buildBike, nascar: buildStock };
export const RIDES = Object.keys(BUILDERS);
const rideKind = (id) => (BUILDERS[id] ? id : 'f1');
const buildVehicle = (ride, lab, index, paintLogo, sponsors) => BUILDERS[rideKind(ride)](lab, index, paintLogo, sponsors);

const hubCache = new Map();
function hubGeometry(side) {
  if (hubCache.has(side)) return hubCache.get(side);
  const parts = [];
  const rim = new THREE.CylinderGeometry(.25, .25, .435, 12); rim.rotateX(Math.PI / 2); parts.push(rim);
  const cap = new THREE.SphereGeometry(.09, 8, 6); cap.scale(1, 1, .2); cap.translate(0, 0, side * .226); parts.push(cap);
  for (let k = 0; k < 5; k++) {
    const spoke = new THREE.BoxGeometry(.35, .025, .013); spoke.rotateZ(k * Math.PI / 5); spoke.translate(0, 0, side * .229);
    parts.push(spoke);
  }
  const clean = parts.map((p) => { const q = p.index ? p.toNonIndexed() : p; q.deleteAttribute('uv'); return q; });
  const merged = mergeGeometries(clean, false);
  merged.userData.shared = true;
  hubCache.set(side, merged);
  return merged;
}

/* Sponsor links are tagged so they can see the traffic came from the race. */
export function withRef(href) {
  try { const u = new URL(href); u.searchParams.set('ref', 'ai-race'); return u.toString(); } catch (e) { return href; }
}

/* ---------------- studio: macro, long exposure, day and night ----------------
   Camera effects after Token Town (tt.lab.sael.net), behind a hidden panel (⌘'). All of them start
   off, and 13:00 is the signed-off daylight exactly, so the race looks as it always has until
   someone opens the panel and changes something. */
const fsMat = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ uniforms, fragmentShader, depthTest: false, depthWrite: false,
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}' });
const DOF_COMMON = `uniform sampler2D tDepth;uniform float near;uniform float far;uniform float focus;uniform float range;uniform vec2 cocScale;uniform float maxCoc;
float viewDist(vec2 uv){float d=texture2D(tDepth,uv).x;return near*far/((far-near)*d-far)*-1.;}
float coc(vec2 uv){float z=viewDist(uv)-focus;float c=max(abs(z)-range,0.)*(z<0.?cocScale.x:cocScale.y);return sign(z)*min(c,maxCoc);}`;
/* Tilt-shift "macro": a narrow band of sharpness around the focus distance and a strong, bokeh-like
   blur before and behind it (stronger in front), gathered at half resolution on a golden-angle
   spiral, so the race reads as a miniature. Depth comes from the AO pass, which renders it anyway. */
class MacroDOF extends Pass {
  constructor(camera) {
    super();
    const o = { type: THREE.HalfFloatType };
    this.half = new THREE.WebGLRenderTarget(1, 1, o); this.blurRT = new THREE.WebGLRenderTarget(1, 1, o);
    this.u = { tColor: { value: null }, tDepth: { value: null }, tHalf: { value: this.half.texture }, tBlur: { value: this.blurRT.texture },
      near: { value: camera.near }, far: { value: camera.far }, focus: { value: 120 }, range: { value: 7 },
      cocScale: { value: new THREE.Vector2(.55, .2) }, maxCoc: { value: 13 }, texel: { value: new THREE.Vector2() }, fullTexel: { value: new THREE.Vector2() } };
    this.pre = new FullScreenQuad(fsMat(`uniform sampler2D tColor;uniform vec2 fullTexel;varying vec2 vUv;${DOF_COMMON}
      void main(){vec2 o=fullTexel*.5;vec3 c=(texture2D(tColor,vUv+vec2(-o.x,-o.y)).rgb+texture2D(tColor,vUv+vec2(o.x,-o.y)).rgb+texture2D(tColor,vUv+vec2(-o.x,o.y)).rgb+texture2D(tColor,vUv+o).rgb)*.25;
      gl_FragColor=vec4(min(c,vec3(24.)),coc(vUv));}`, this.u));
    this.blur = new FullScreenQuad(fsMat(`uniform sampler2D tHalf;uniform vec2 texel;uniform float maxCoc;varying vec2 vUv;
      void main(){vec4 c0=texture2D(tHalf,vUv);float cc=abs(c0.a);vec3 col=c0.rgb;float tot=1.;float near=0.;float r=1.6;float ang=0.;
      for(int i=0;i<64;i++){if(r>=maxCoc)break;vec2 tc=vUv+vec2(cos(ang),sin(ang))*texel*r;vec4 s=texture2D(tHalf,tc);float sc=abs(s.a);if(s.a>c0.a)sc=min(sc,cc*2.);
       float m=smoothstep(r-.8,r+.8,sc);col+=mix(col/tot,s.rgb,m);tot+=1.;if(s.a<0.)near=max(near,m*sc);ang+=2.39996;r+=2.2/r;}
      gl_FragColor=vec4(col/tot,max(cc,near));}`, this.u));
    this.comp = new FullScreenQuad(fsMat(`uniform sampler2D tColor;uniform sampler2D tBlur;varying vec2 vUv;
      void main(){vec3 s=texture2D(tColor,vUv).rgb;vec4 b=texture2D(tBlur,vUv);gl_FragColor=vec4(mix(s,b.rgb,smoothstep(.45,1.8,b.a)),1.);}`, this.u));
  }
  setSize(w, h) {
    const hw = Math.ceil(w / 2), hh = Math.ceil(h / 2);
    this.half.setSize(hw, hh); this.blurRT.setSize(hw, hh); this.u.texel.value.set(1 / hw, 1 / hh); this.u.fullTexel.value.set(1 / w, 1 / h);
  }
  render(r, write, read) {
    this.u.tColor.value = read.texture;
    r.setRenderTarget(this.half); this.pre.render(r);
    r.setRenderTarget(this.blurRT); this.blur.render(r);
    r.setRenderTarget(this.renderToScreen ? null : write); this.comp.render(r);
  }
  dispose() { this.half.dispose(); this.blurRT.dispose(); [this.pre, this.blur, this.comp].forEach((q) => { q.material.dispose(); q.dispose(); }); }
}
/* The light round the clock: hour, sky, fog, hemisphere sky / ground / strength, sun colour and
   strength, fill, exposure, environment, night (lamps on), bloom strength and threshold. */
const DAY = [
  [0, '#0b1224', '#131c30', '#3e4f7c', '#231f2a', .55, '#8ea6ff', .35, .18, 1.2, .12, 1, .7, .9],
  [5, '#111a2e', '#1a2438', '#4e5f8e', '#2c2630', .58, '#9fb0ff', .38, .2, 1.2, .13, 1, .68, .9],
  [6.5, '#5b6a8c', '#7a7e95', '#b8a8c8', '#5e5048', 1.2, '#ffae84', 1.6, .35, 1.15, .2, .45, .4, 1.05],
  [8.5, '#86bff0', '#a2c8e6', '#c6dcf5', '#8f8660', 1.85, '#ffe6c8', 3, .55, 1.2, .3, 0, .2, 1.12],
  [13, '#93cafa', '#a9d0ed', '#c8e4ff', '#9b9263', 2.05, '#fff0d9', 3.35, .65, 1.23, .32, 0, .16, 1.15],   // the signed-off look
  [17, '#8fb6dc', '#b2c2d4', '#d0cad6', '#8a7a5c', 1.8, '#ffc890', 2.8, .5, 1.22, .28, .12, .22, 1.1],
  [19, '#3a4460', '#56586a', '#a3b6da', '#564840', 1.1, '#ffb07a', 1.4, .3, 1.18, .18, 1, .5, .95],
  [20.5, '#1c2640', '#2a3348', '#7486b6', '#3c3538', .75, '#b4c2ff', .6, .22, 1.2, .14, 1, .62, .9],
  [22, '#0f1628', '#18203a', '#4c5b84', '#2a262e', .6, '#94aaff', .4, .18, 1.2, .12, 1, .7, .9],
  [24, '#0b1224', '#131c30', '#3e4f7c', '#231f2a', .55, '#8ea6ff', .35, .18, 1.2, .12, 1, .7, .9]
].map((k) => k.map((v) => (typeof v === 'string' ? new THREE.Color(v) : v)));
const DAY_SECONDS = 240;             // one turn of the clock at 1×: four minutes, half a minute at 8×
/* Head (+1) and tail (-1) lamps in each vehicle's own frame: type, forward, up, right, streak half-width. */
const LAMPS = {
  f1: [[1, 2.2, .32, -.85, .17], [1, 2.2, .32, .85, .17], [-1, -2.28, .52, -.14, .14], [-1, -2.28, .52, .14, .14]],
  motogp: [[1, 1.0 * BIKE_SCALE, .64 * BIKE_SCALE, -.035 * BIKE_SCALE, .1], [1, 1.0 * BIKE_SCALE, .64 * BIKE_SCALE, .035 * BIKE_SCALE, .1],
    [-1, -.92 * BIKE_SCALE, .74 * BIKE_SCALE, -.03 * BIKE_SCALE, .09], [-1, -.92 * BIKE_SCALE, .74 * BIKE_SCALE, .03 * BIKE_SCALE, .09]],
  nascar: [[1, 2.4, .72, -.6, .16], [1, 2.4, .72, .6, .16], [-1, -2.44, .82, -.82, .15], [-1, -2.44, .82, .82, .15]]
};
const HIST = 48, LAMP_CAP = 4 * 48;   // pose samples kept per vehicle; lamps the streak buffer holds

/* ---------------- the race ---------------- */
export function createRace({ canvas, labelsEl, labs = [], sponsors = [], paintLogo, badgeHTML,
  reduced = false, onSelect = () => {}, onHover = () => {}, onSponsor = () => {}, uiRects = () => ({}), circuit = 'ring', ride: rideAt = 'f1', labels: labelsAt = 'top3',
  onClock = () => {}, formation = 'pack' }) {
  let pack = formation !== 'wide';
  fanMs = pack ? FAN_MS : 0; tuckMs = pack ? TUCK_MS : 0; accelMs = pack ? PACK_ACCEL_MS : ACCEL_MS;
  const mobile = () => innerWidth <= 860 || innerWidth / innerHeight < 1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#93cafa');
  scene.fog = new THREE.Fog('#a9d0ed', 160, 520);
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 1, 1600);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // capped: a 5K panel at full density is millions of fragments of AO and blur for a cartoon
  let dpr = Math.min(devicePixelRatio || 1, mobile() ? 1.5 : 1.25);
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.23;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const hemi = new THREE.HemisphereLight('#c8e4ff', '#9b9263', 2.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d9', 3.35);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -86, right: 86, top: 78, bottom: -70, near: 1, far: 220 });
  sun.shadow.bias = -.00015; sun.shadow.normalBias = .045;
  scene.add(sun, sun.target);
  const SUN_OFFSET = new V(-36, 80, 45), FILL_OFFSET = new V(30, 25, -45);   // in the pack's frame
  const fill = new THREE.DirectionalLight('#d5eaff', .65); fill.position.set(30, 25, -45); scene.add(fill, fill.target);
  {
    const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, .05).texture; scene.environmentIntensity = .32;
    room.dispose(); pmrem.dispose();
  }

  // the hidden studio panel's settings; all off, and the clock at the signed-off daylight
  const studio = { macro: false, shutter: 0, cycle: false, hour: 13, lapse: 1, night: 0, focusAuto: true, focus: 60, focusNow: 60 };
  const overlays = [];                 // light, not surfaces: kept out of the AO pass's depth and normals
  let composer = null, gtao = null, dof = null, bloom = null, macro = null;
  function buildComposer() {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(dpr); composer.setSize(innerWidth, innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
    gtao.updateGtaoMaterial({ radius: 1.1, distanceExponent: 1.25, thickness: 1.6, scale: 1, samples: 12 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
    gtao.blendIntensity = .85; composer.addPass(gtao);
    const aoRender = gtao.render.bind(gtao);
    gtao.render = (...a) => {
      const shown = overlays.filter((o) => o.visible);
      shown.forEach((o) => { o.visible = false; }); aoRender(...a); shown.forEach((o) => { o.visible = true; });
    };
    dof = new BokehPass(scene, camera, { focus: 75, aperture: .00015, maxblur: .0035 });
    composer.addPass(dof);
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .16, .45, 1.15);
    composer.addPass(bloom);
    macro = new MacroDOF(camera); macro.u.tDepth.value = gtao.depthTexture;
    composer.addPass(macro);
    composer.addPass(new OutputPass());
    applyMacro(); applyLight();
  }
  function dropComposer() {
    if (!composer) return;
    composer.passes.forEach((p) => p.dispose && p.dispose());
    composer.dispose(); composer = gtao = dof = bloom = macro = null;
  }
  // macro replaces the broadcast depth of field and needs the AO pass's depth, so AO comes back on
  function applyMacro() {
    if (!composer) return;
    macro.enabled = studio.macro; dof.enabled = !studio.macro;
    if (studio.macro) gtao.enabled = true;
  }
  function applyLight() {
    const h = studio.hour;
    let i = 0; while (h >= DAY[i + 1][0]) i++;
    const a = DAY[i], b = DAY[i + 1], f = THREE.MathUtils.smoothstep(h, a[0], b[0]);
    const col = (k, c) => c.copy(a[k]).lerp(b[k], f), num = (k) => a[k] + (b[k] - a[k]) * f;
    col(1, scene.background); col(2, scene.fog.color); col(3, hemi.color); col(4, hemi.groundColor); hemi.intensity = num(5);
    col(6, sun.color); sun.intensity = num(7); fill.intensity = num(8);
    renderer.toneMappingExposure = num(9); scene.environmentIntensity = num(10); studio.night = num(11);
    if (bloom) { bloom.strength = num(12); bloom.threshold = num(13); }
  }
  // phones render straight to the screen: no AO, blur or bloom passes on a battery. On every machine
  // the passes wait until the field is on track, so the world's first frame is not held up by them.
  let wantComposer = labs.length > 0;
  if (wantComposer && !mobile()) buildComposer();

  let track = makeTrack(circuit);
  const buildEnv = (id) => (id === 'gp' || id === 'twisty' ? buildGP(scene, sponsors, track)
    : id === 'planet' ? buildPlanet(scene, sponsors, track)
    : id === 'mobius' ? buildMobius(scene, sponsors, track)
    : buildWorld(scene, sponsors));
  let env = buildEnv(track.id);
  /* Frames: position, forward, up, right. The camera, sun and sky light are carried in the
     pack's frame, so every circuit — flat, over a planet, or twisting — is lit and framed the
     way the ring was tuned. */
  const frameObj = () => ({ p: new V(), f: new V(), u: new V(), r: new V() });
  const tf = frameObj(), cf = frameObj(), cfA = frameObj(), tfA = frameObj(), tfB = frameObj();
  function camFrameAt(D, o) {
    track.frame(D, 0, o);
    if (track.samples) {
      // average the heading over the pack's length so corners don't whip the camera round
      o.f.multiplyScalar(2);
      for (const dd of [-24, 24]) { track.frame(D + dd, 0, cfA); o.f.add(cfA.f); }
      o.f.normalize(); o.r.crossVectors(o.f, o.u).normalize();
    }
    return o;
  }
  const toWorld = (local, F, out) => out.copy(F.p).addScaledVector(F.f, local.x).addScaledVector(F.u, local.y).addScaledVector(F.r, local.z);

  let ride = rideKind(rideAt), swapping = false;   // swapping: a change of vehicle is still building, so ignore another
  const makeCar = (lab, i) => {
    const built = buildVehicle(ride, lab, i, paintLogo, sponsors);
    scene.add(built.g);
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'car-label';
    el.style.setProperty('--car-color', lab.color);
    el.setAttribute('aria-label', `Inspect ${lab.name}`);
    el.innerHTML = '<svg class="crown" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18 5 6l4.5 5L12 4l2.5 7L19 6l2 12H3z"/></svg>'
      + `<span class="badge">${badgeHTML(lab)}</span><span class="label-name"></span>`;
    el.querySelector('.label-name').textContent = lab.name;
    el.addEventListener('click', () => onSelect(lab.id));
    el.addEventListener('mouseenter', () => onHover(lab.id));
    el.addEventListener('mouseleave', () => onHover(null));
    labelsEl.append(el);
    const x = -20 - i * 4;                   // in the frame from the first frame, never sixteen on one spot
    // a fixed side and lane per lab; the stagger and the lateral jitter are its own too, so the
    // formation never looks ruled and never changes from one visit to the next
    const laneWide = laneFor(i), side = laneWide < 0 ? -1 : 1, h = ((i * 9301 + 49297) % 233280) / 233280;
    const c = { lab, ...built, el, side, laneWide, spot: h, stag: (h - .5) * 2 * PACK.stagger, channel: null, x, fromX: x, toX: x, rank: null,
      prevDistance: x, wheelRotation: 0, lean: 0, weave: 0, lift: 0, lw: 110, lh: 26, sx: 0, sy: 0, on: false };
    c.lineK = 1; c.lineOff = 0; c.lineOn = 0;   // the racing line's weight, and its own delays to let go of it and to take it up again
    c.laneFrom = c.laneBase = restLane(c); c.lane = c.prevLane = c.laneBase + (pack ? lineShift(raceDistance + x) : 0); c.prevXf = x; c.yaw = 0;
    c.pace = 1; c.fanT0 = 0; c.tuckT0 = 0; c.moveT0 = 0; c.latV = 0;   // its own timing comes with the first ranking; finite from the first frame
    return c;
  };
  const cars = [], pickables = [];
  function addCars(list, offset = 0) {
    list.forEach((lab, i) => cars.push(makeCar(lab, offset + i)));
    pickables.length = 0;
    for (const c of cars) pickables.push(...c.meshes);
  }
  if (labs.length) addCars(labs);

  /* ---------- camera rig ----------
     Offsets from the pack, in the pack's own frame (forward along the track, up, and
     outward from the ring's centre). Ahead of the leader and outside the ring, looking
     back and in: first place is the nearest car, the lake and island peaks fill the
     background. The rig is fitted per viewport to the envelope of every position a car
     can reach, inside the space the interface leaves free, then carried round the ring. */
  /* Shots, as offsets from the pack in its own frame. All sit outside the ring, where the
     infield hoardings face the lens. Shot 0 is the hero angle (the look Ryan signed off);
     a category switch glides to a random other shot that passed fit()'s checks: the ranked
     field framed, and sponsor hoardings clearly in view all the way round the lap. */
  const SHOTS = {
    landscape: [
      { name: 'hero', fwd: 35, up: 56, out: 80, aimFwd: -4, aimUp: 0, aimOut: -8, fov: 42 },
      { name: 'low', fwd: 22, up: 34, out: 74, aimFwd: -2, aimUp: 0, aimOut: -12, fov: 40 },
      { name: 'high', fwd: 28, up: 84, out: 66, aimFwd: -4, aimUp: 0, aimOut: -12, fov: 38 },
      { name: 'ahead', fwd: 58, up: 48, out: 58, aimFwd: -6, aimUp: 0, aimOut: -8, fov: 40 },
      { name: 'side', fwd: 8, up: 50, out: 88, aimFwd: -4, aimUp: 0, aimOut: -10, fov: 40 }
    ],
    // phones get perspective too: looking along the road, so the fixed lanes span the narrow
    // width and the race runs up the tall screen toward the horizon
    portrait: [
      { name: 'hero', fwd: 62, up: 58, out: 18, aimFwd: -2, aimUp: 0, aimOut: -4, fov: 46 },
      { name: 'chase', fwd: -64, up: 54, out: 10, aimFwd: 4, aimUp: 0, aimOut: -4, fov: 42 },
      { name: 'high', fwd: 40, up: 86, out: 14, aimFwd: -2, aimUp: 0, aimOut: -4, fov: 44 }
    ]
  };
  const VIEW = { landscape: SHOTS.landscape[0], portrait: SHOTS.portrait[0] };
  // QA: ?view=fwd,out,up,aimOut,fov overrides the hero shot for the current orientation
  {
    const q = new URLSearchParams(location.search).get('view');
    const n = q ? q.split(',').map(Number) : [];
    if (n.length === 5 && n.every(Number.isFinite)) {
      const [fwd, out, up, aimOut, fov] = n;
      Object.assign(innerWidth / innerHeight < 1 ? VIEW.portrait : VIEW.landscape, { fwd, out, up, aimOut, fov });
    }
  }
  const rig = { pos: new V(), aim: new V(), fov: 42, safe: null };
  let shots = [], shotIndex = 0, camMoveStart = -1e9;
  const camFrom = { pos: new V(), aim: new V(), fov: 42 };
  /* Camera modes. TV is the fitted broadcast shot above; the rest ride with the race: a helicopter
     circling the field, a rear cam chasing the leader, a driver cam in a cockpit, and a cinematic
     program of kerbside, orbit and crane shots. Any change glides on from the lens's last pose. */
  const CAM_MODES = ['tv', 'heli', 'rear', 'driver', 'cine'];
  let camMode = 'tv', camBlendStart = -1e9, camBlendMs = 1000, followId = null;
  const poseNow = { pos: new V(), aim: new V(), up: new V(0, 1, 0), fov: 42 };
  const poseFrom = { pos: new V(), aim: new V(), up: new V(0, 1, 0), fov: 42 };
  const poseTarget = { pos: new V(), aim: new V(), up: new V(0, 1, 0), fov: 42 };
  const follow = { id: null, x: 0, lane: 0, fromX: 0, fromLane: 0, since: -1e9 };
  const cine = { shot: 0, start: -1e9, anchorD: 0 };
  const camF = frameObj(), camG = frameObj(), camH = frameObj(), gaze = { p: new V(), t: -1 };
  /* Label modes. 'top3': names on the podium and a faded logo badge for everyone else, except for a
     few seconds after a race change, when every name shows and then folds away. 'all': every name.
     'off': none, unless a visitor asks to see one. */
  let labelMode = labelsAt === 'all' || labelsAt === 'off' ? labelsAt : 'top3', namesUntil = 0, namesOpen = false, hotUntil = 0, hotOn = false;
  function isCompact(c) {
    if (labelMode === 'all') return false;
    return !(c.rank && (c.rank <= 3 || clockMs < namesUntil));
  }
  function markCompact(c) { c.compact = isCompact(c); c.el.classList.toggle('compact', c.compact); }
  // while the field speeds to a new order, the new podium's labels stand out
  function markHot() {
    hotOn = clockMs < hotUntil;
    cars.forEach((c) => c.el.classList.toggle('hot', hotOn && !!c.rank && c.rank <= 3));
  }
  function refreshLabels() {
    cars.forEach(markCompact);
    sizeLabels();
    // measured again once the fold has finished, for label dodging
    clearTimeout(refreshLabels.timer); refreshLabels.timer = setTimeout(sizeLabels, 480);
  }
  // the ranked field: no-data cars trail further back and may run behind the standings panel
  function envelope() {
    const lanes = SLOTS.map((_, i) => laneFor(i));
    let lap = 0;
    if (pack) for (let j = 0; j < 32; j++) lap = Math.max(lap, Math.abs(lineShift(j / 32 * track.length)));
    const half = pack ? Math.max(PACK.view, lap + 4) : Math.max(...lanes) + 1.5;
    const lo = -half, hi = half;
    const k = spreadScale(), d0 = SPREAD.lo * k - 3, d1 = (SPREAD.hi + LEAD_GAP) * k + 3, pts = [];
    // in the camera frame's own coordinates (forward x, up y, right z); a curving circuit is
    // sampled at several points round the lap so the framing holds through its bends
    const at = track.id === 'ring' ? [0] : Array.from({ length: 8 }, (_, j) => j / 8 * track.length);
    const w = new V();
    for (const D of at) {
      camFrameAt(D, cf);
      for (let i = 0; i <= 8; i++) {
        const d = d0 + (d1 - d0) * i / 8;
        for (const l of [lo, hi]) {
          track.frame(D + d, l, tf);
          for (const [y, label] of [[0, false], [1.75, false], [2.1, true]]) {
            w.copy(tf.p).addScaledVector(tf.u, y).sub(cf.p);
            pts.push({ v: new V(w.dot(cf.f), w.dot(cf.u), w.dot(cf.r)), label });
          }
        }
      }
    }
    return pts;
  }
  function fitShot(P) {
    const w = innerWidth, h = innerHeight, portrait = w / h < 1;
    camera.aspect = w / h; camera.fov = P.fov; camera.updateProjectionMatrix();
    const P0 = new V(0, 0, 0);                              // the pack's frame: forward +x, up +y, right (outward) +z
    const aim0 = P0.clone().add(new V(P.aimFwd, P.aimUp, P.aimOut));
    const dir = new V(P.fwd - P.aimFwd, P.up - P.aimUp, P.out - P.aimOut);
    const r = uiRects();
    const safe = { left: portrait ? 10 : 24,
      right: w - (portrait ? 10 : Math.max(90, w * .12)),      // the leader keeps clear of the right edge
      top: portrait ? h * .16 : Math.max(h * .2, (r.header ? r.header.bottom : 0) + 20), bottom: h - 16 };
    if (portrait && r.header) safe.top = r.header.bottom + 8;
    if (r.chips) safe.bottom = Math.min(safe.bottom, r.chips.top - 14);
    if (r.board) {
      if (r.board.right < w * .5 && r.board.top < h * .5) safe.left = Math.max(safe.left, r.board.right + 20);
      else safe.bottom = Math.min(safe.bottom, r.board.top - 10);
    }
    if (r.rail) safe.left = Math.max(safe.left, r.rail.right + 6);   // the phone's rank rail on the left edge
    // Landscape frames tighter than the field: the front is anchored at the right margin and
    // the tail may run up to 12% past the left edge of the box, toward the standings panel.
    const slackW = portrait ? .96 : 1.12;
    camera.up.set(0, 1, 0);                                    // the road's up, in every orientation
    const pts = envelope(), v = new V(), right = new V(), up = new V();
    let k = 1, panX = 0, panY = 0, aim = aim0.clone(), need = 1;
    for (let it = 0; it < 30; it++) {
      camera.position.copy(aim0).addScaledVector(dir, k); camera.lookAt(aim0); camera.updateMatrixWorld();
      right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1);
      const shift = right.clone().multiplyScalar(panX).addScaledVector(up, panY);
      camera.position.add(shift); aim = aim0.clone().add(shift);
      camera.lookAt(aim); camera.updateMatrixWorld();
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const p of pts) {
        v.copy(p.v).project(camera);
        if (v.z > 1) continue;
        const sx = (v.x * .5 + .5) * w, sy = (-v.y * .5 + .5) * h, mx = p.label && !portrait ? 64 : 0, my = p.label ? 38 : 0;   // phones keep the one label on screen themselves
        x0 = Math.min(x0, sx - mx); x1 = Math.max(x1, sx + mx); y0 = Math.min(y0, sy - my); y1 = Math.max(y1, sy);
      }
      need = Math.max((x1 - x0) / ((safe.right - safe.left) * slackW), (y1 - y0) / ((safe.bottom - safe.top) * .96));
      const upp = 2 * camera.position.distanceTo(aim) * Math.tan(camera.fov * Math.PI / 360) / h;
      panX += (portrait ? (x0 + x1) / 2 - (safe.left + safe.right) / 2 : x1 - safe.right) * upp * .8;
      panY -= ((y0 + y1) / 2 - (safe.top + safe.bottom) / 2) * upp * .8;
      k *= Math.pow(Math.min(Math.max(need, .8), 1.25), .85);
    }
    return { name: P.name, pos: camera.position.clone(), aim, fov: P.fov, safe, need };
  }
  /* How many hoardings a shot shows clearly: fully in frame, facing the lens, clear of the
     interface and wide enough to read — the worst case over a board spacing of pack travel,
     so a shot cannot pass by luck of where the pack happens to be. */
  function sponsorScore(s) {
    const W = innerWidth, H = innerHeight, portrait = W / H < 1, r = uiRects();
    const ui = [r.board, r.chips, r.header].filter(Boolean);
    // readable size scales with the window: ~11% of its width on desktop
    const minPx = portrait ? 80 : Math.max(120, W * .105), tmp = new V(), c = new V(), t = new V(), n = new V(), q = new V();
    let widest = 0;
    camera.fov = s.fov; camera.updateProjectionMatrix();
    const probes = track.id === 'ring' ? [0, 1, 2, 3].map((k) => k / 4 * (track.length / 24))
      : Array.from({ length: 12 }, (_, k) => k / 12 * track.length);
    const counts = [];
    for (const D of probes) {
      camFrameAt(D, cf);
      toWorld(s.pos, cf, camera.position); toWorld(s.aim, cf, tmp);
      camera.up.copy(cf.u);
      camera.lookAt(tmp); camera.updateMatrixWorld();
      let count = 0;
      for (const b of env.boards) {
        if (b.n.dot(tmp.copy(camera.position).sub(b.c)) <= 0) continue;
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, behind = false;
        for (const u of [-b.half, b.half]) for (const dy of [-b.halfH, b.halfH]) {
          q.copy(b.c).addScaledVector(b.t, u).addScaledVector(b.u, dy); q.project(camera);
          if (q.z > 1) behind = true;
          const sx = (q.x * .5 + .5) * W, sy = (-q.y * .5 + .5) * H;
          x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
        }
        if (behind || x0 < 0 || x1 > W || y0 < 0 || y1 > H || x1 - x0 < minPx) continue;
        if (ui.some((u) => x0 < u.right && x1 > u.left && y0 < u.bottom && y1 > u.top)) continue;
        count++; widest = Math.max(widest, x1 - x0);
      }
      counts.push(count);
    }
    counts.sort((a, b) => a - b);
    // ring: the worst case; other circuits: the 20th percentile, as board runs vary round a lap
    const worst = track.id === 'ring' ? counts[0] : counts[Math.floor(counts.length * .2)];
    return { min: worst, widest: Math.round(widest) };
  }
  function fit() {
    const portrait = innerWidth / innerHeight < 1;
    shots = SHOTS[portrait ? 'portrait' : 'landscape'].map((P, i) => {
      const s = fitShot(P);
      s.sponsors = sponsorScore(s);
      // phones carry the sponsors in the marquee: a narrow view along the road sees hoardings edge-on
      s.valid = i === 0 || (s.need <= 1.05 && (portrait || s.sponsors.min >= 2));
      return s;
    });
    if (!shots[shotIndex] || !shots[shotIndex].valid) shotIndex = 0;
    const s = shots[shotIndex];
    rig.pos.copy(s.pos); rig.aim.copy(s.aim); rig.fov = s.fov; rig.safe = s.safe;
    camMoveStart = -1e9;
    camera.fov = s.fov; camera.updateProjectionMatrix();
  }
  // a category switch glides the camera to a random other shot that passed the checks
  function cutToNewShot() {
    const options = shots.map((_, i) => i).filter((i) => i !== shotIndex && shots[i].valid);
    if (!options.length) return;
    camFrom.pos.copy(rig.pos); camFrom.aim.copy(rig.aim); camFrom.fov = rig.fov;
    shotIndex = options[Math.floor(Math.random() * options.length)];
    rig.safe = shots[shotIndex].safe;
    camMoveStart = clockMs;
  }

  /* ---------- motion state ---------- */
  let clockMs = 0, raceDistance = 0, worldTime = 0, changeStart = -1e9, initialRate = SLOW_RATE;
  // the reorder's own clock: opened by the gate, and Infinity until then; the racing line's weight, eased
  let settledAt = -1e9, mergedAt = -1e9, pendingSkid = null, pendingBoost = null, lineClusters = [];
  const motion = { lat: 0, back: 0 };        // peak lateral speed since last reset; the fastest drop-back this frame (u/s)
  let playbackRate = SLOW_RATE, changing = false, initialized = false;

  let lastRows = null, lastOrient = null, pendingBurst = false;
  // phones pack the field tighter: the whole spread has to fit down a narrow band
  const spreadScale = () => (innerWidth / innerHeight < 1 ? .65 : 1);
  const targetOf = (row, rank) => (row && row.t != null
    ? SPREAD.lo + (SPREAD.hi - SPREAD.lo) * row.t + (rank === 1 ? LEAD_GAP : 0) : SPREAD.missing) * spreadScale();
  /* Where a car sits across the road when nothing is changing. */
  function restLane(c) { return pack ? c.side * (PACK.inner + c.spot * PACK.spread) : c.laneWide; }
  /* The pack's targets: down each side of the road, nose to tail with a stagger, never closer than a
     car's length to the one ahead on the same side (the unranked queue up behind the field). */
  /* Down the order, front to back: a car sits `tail` behind every car ahead it is not laterally clear
     of, and only `sideBy` behind those it is. The result is a loose line, side by side where there is
     room. The unranked queue up behind the field. */
  function spaceOut(key) {
    const tail = PACK.tail[ride] || PACK.tail.f1, placed = [];
    for (const c of cars.slice().sort((a, b) => b[key] - a[key])) {
      let x = c[key] + (key === 'toX' ? c.stag : 0);
      for (const p of placed) x = Math.min(x, p[key] - (Math.abs(restLane(p) - restLane(c)) >= PACK.clearLat ? PACK.sideBy : tail));
      c[key] = x; placed.push(c);
    }
  }
  function packTargets() { if (pack) spaceOut('toX'); }
  /* Who pulls out, and where to. Two cars on the same side are safe together as long as their paths
     never cross: they start a car apart, end a car apart, and the gap in between is a blend of the
     two. So a car holds the line unless it would cross another car holding the line on its side;
     those that must pull out are grouped so no group has a crossing inside it, one channel per
     group, the biggest sweep outermost. A side that needs more than its seven channels borrows the
     other side's spare ones (the centre line is only crossed while nothing moves along the track).
     Each car gets its own moment and pace to pull out and tuck in, so the field never moves as one. */
  let packDemand = { left: 0, right: 0, overflow: 0 };
  function packChannels() {
    for (const c of cars) { c.laneFrom = c.laneBase; c.channel = restLane(c); }
    if (!pack) return;
    /* Two cars "cross" if their paths swap order — or if they start within a car's length of each other
       along the road without being laterally clear: a change landing mid-change finds cars beside each
       other that were in different channels, and giving them the same lateral target would fold them
       together. Either way they must be in different channels and wait for each other. */
    const tail = PACK.tail[ride] || PACK.tail.f1, disp = (c) => Math.abs(c.toX - c.fromX);
    const cross = (a, b) => (a.fromX - b.fromX) * (a.toX - b.toX) < 0
      || (Math.abs(a.fromX - b.fromX) < tail && Math.abs(restLane(a) - restLane(b)) < PACK.clearLat);
    const groupsOf = {}, heldAll = [];
    for (const side of [-1, 1]) {
      const held = [], groups = [];
      for (const c of cars.filter((k) => k.side === side).sort((a, b) => disp(a) - disp(b))) {
        // hold the line unless it would cross a held car within lateral reach (on either side)
        if (disp(c) <= .3 || !heldAll.some((h) => cross(h, c) && Math.abs(restLane(h) - restLane(c)) < PACK.clearLat)) { held.push(c); heldAll.push(c); continue; }
        const g = groups.find((grp) => !grp.some((x) => cross(x, c)));
        if (g) g.push(c); else groups.push([c]);
      }
      groups.sort((a, b) => Math.max(...a.map(disp)) - Math.max(...b.map(disp)));
      groupsOf[side] = groups;
    }
    packDemand = { left: groupsOf[-1].length, right: groupsOf[1].length, overflow: 0 };
    for (const c of cars) { c.grp = 0; c.crossers = cars.filter((o) => o !== c && cross(o, c)); c.moveStart = Infinity; }
    let gi = 0;
    for (const side of [-1, 1]) groupsOf[side].forEach((g, k) => {
      gi++; for (const c of g) c.grp = gi;
      let at = side, slot = k;
      // never the other side: tucking back in from there would sweep through a side-by-side partner's place
      if (k >= PACK.channels) { slot = PACK.channels - 1; packDemand.overflow++; }
      for (const c of g) c.channel = at * (PACK.ch0 + PACK.chStep * slot);
    });
    const bandT0 = Math.random() * 300;
    for (const c of cars) c.moveT0 = bandT0;
    for (const side of [-1, 1]) for (const g of groupsOf[side]) { const t0 = Math.random() * 400; for (const c of g) c.moveT0 = t0; }
    for (const c of cars) {   // its own moment to pull out and to tuck in, and its own pace across the road
      c.fanT0 = Math.random() * 250; c.tuckT0 = Math.random() * 1800; c.pace = .8 + Math.random() * .5;
    }
    /* Letting go of the line and taking it up again is staggered too, but two cars that overlap along
       the road must do it together, or the line's shift would pull them into each other: cars are
       clustered by overlap (before the change for letting go, after it for taking up), one delay each. */
    const cluster = (key, field, span) => {
      const sorted = cars.slice().sort((a, b) => a[key] - b[key]), groups = [];
      let t0 = Math.random() * span, last = -1e9, cur = null;
      for (const c of sorted) { if (c[key] - last >= 5) { t0 = Math.random() * span; cur = []; groups.push(cur); } c[field] = t0; cur.push(c); last = c[key]; }
      return groups;
    };
    cluster('fromX', 'lineOff', 300); lineClusters = cluster('toX', 'lineOn', 1500);
  }
  /* The reorder as a whole, and a car's own share of it: its group starts when it starts, everyone is
     home together. Nothing moves along the track until the gate has opened. */
  const xProgress = (c) => smoothStep((clockMs - c.moveStart - (pack ? c.moveT0 : 0)) / (TRANSITION_MS - (pack ? c.moveT0 : 0)));
  const progressNow = () => (changing ? Math.min(...cars.map(xProgress)) : 1);
  /* The gate: the launch is over, every car is in its channel (or the fan has run long enough), and the
     racing line has mostly eased off, so every channel sits inside the road. */
  /* A group may start along the track once the launch is over and every car in it, and every car
     any of them will pass, is settled: in its channel or holding the line, with the racing line
     let go (.15: its squeeze is then under half a unit). Groups therefore start at different
     moments, and the field never sets off as one. In the wide field everyone is settled at once. */
  const settledCar = (c) => !pack || (Math.abs(c.laneBase - c.channel) < .35 && c.lineK < .15);
  /* A car it will pass need only have let go of the line if it can never reach this car's lateral
     path: it is on the other side of the road, or bound for a channel inside this car's (channels go
     biggest sweep outermost, and a car pulls out monotonically); otherwise it must be settled. */
  const clearOf = (me, o) => o.lineK < .15 && (settledCar(o) || o.side !== me.side || Math.abs(o.channel) < Math.abs(me.channel) - 2.5);
  function openGate() {
    if (!changing) return;
    const e = clockMs - changeStart;
    if (e < accelMs) return;
    const late = e >= accelMs + FAN_CAP_MS;
    const byGroup = new Map();
    for (const c of cars) { if (c.moveStart !== Infinity) continue; if (!byGroup.has(c.grp)) byGroup.set(c.grp, []); byGroup.get(c.grp).push(c); }
    for (const g of byGroup.values()) {
      const ready = late || g.every((c) => settledCar(c) && c.crossers.every((o) => clearOf(c, o)));
      if (!ready) continue;
      for (const c of g) {
        c.moveStart = clockMs;
        if (pendingBoost === c) { c.boost.start = clockMs; pendingBoost = null; }        // the flames light as the car goes, not as the click lands

      }
    }
  }
  /* The racing line: how far toward the inside of the bend the road is turning through at this
     distance. Sampled twelve units apart so it is smooth, and positive toward whichever side the
     bend turns to, so the pack hugs the inside of every corner and drifts across between them. */
  const lnA = { p: new V(), f: new V(), u: new V(), r: new V() }, lnB = { p: new V(), f: new V(), u: new V(), r: new V() }, lnC = { p: new V(), f: new V(), u: new V(), r: new V() };
  function curvAt(d) {
    track.frame(d + 6, 0, lnA); track.frame(d - 6, 0, lnB); track.frame(d, 0, lnC);
    return lnA.f.sub(lnB.f).dot(lnC.r) / 12;
  }
  function rawLine(d) {
    const here = curvAt(d), around = (curvAt(d + PACK.ahead) + curvAt(d - PACK.ahead)) / 2;
    return THREE.MathUtils.clamp(here * PACK.line - around * PACK.lineAnticipate, -PACK.lineMax, PACK.lineMax);
  }
  /* The line round the whole lap, one entry a unit: a box average over ±30, then a slew limit run
     forward and back round the loop, so nowhere on any circuit does it climb faster than `slew`. */
  let lineTable = null;
  function buildLine() {
    const N = Math.max(8, Math.round(track.length)), raw = new Float32Array(N), out = new Float32Array(N);
    for (let i = 0; i < N; i++) raw[i] = rawLine(i);
    for (let i = 0; i < N; i++) { let sum = 0; for (let k = -15; k <= 15; k += 3) sum += raw[((i + k) % N + N) % N]; out[i] = sum / 11; }
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i <= N; i++) { const a = out[(i - 1) % N], j = i % N; out[j] = THREE.MathUtils.clamp(out[j], a - PACK.slew, a + PACK.slew); }
      for (let i = N - 1; i >= -1; i--) { const a = out[(i + 1 + N) % N], j = (i + N) % N; out[j] = THREE.MathUtils.clamp(out[j], a - PACK.slew, a + PACK.slew); }
    }
    lineTable = out;
  }
  function lineShift(d) {
    if (!lineTable) buildLine();
    const N = lineTable.length, x = ((d % N) + N) % N, i = Math.floor(x), f = x - i;
    return lineTable[i] * (1 - f) + lineTable[(i + 1) % N] * f;
  }
  /* Across the road, right now. A car pulls out to its channel once the launch has it up to speed
     (the fan phase, before anyone moves along the track), holds it for the reorder, and tucks back
     in during the run-down. The racing line eases off while a change is running, so every channel
     stays inside the white line, and comes back as the pack settles. */
  /* Across the road, as state rather than a formula of time: each frame the car steers toward where it
     should be, no faster than a share of its road speed, so a change landing at any moment (mid-change,
     in a bend, in slow motion) only re-aims it, never moves it. Its target is its channel from its own
     moment in the fan until the order has settled, then the line again after its own tuck-in delay. */
  function laneAt(c, delta) {
    if (!pack) { c.laneBase = c.laneWide; return c.laneWide; }
    const rest = restLane(c), line = lineShift(raceDistance + c.x);
    if (reduced) { c.laneBase = rest; return rest + line; }
    const e = clockMs - changeStart;
    let target = rest;
    if (changing) target = e >= accelMs * .3 + c.fanT0 ? c.channel : c.laneBase;
    else if (clockMs < settledAt + c.tuckT0) target = c.laneBase;
    // an S-curve: sideways speed builds and fades with a limited sideways acceleration, and eases
    // out as the car closes on its place, so it never turns in or straightens up sharply
    const fwd = NORMAL_SPEED * Math.max(playbackRate, SLOW_RATE) * studio.lapse;
    // pulling out is brisk for everyone (the field waits on the slowest); tucking in is each car's own pace
    const vmax = (target === c.channel && changing ? 1.15 : c.pace) * Math.max(2, .38 * fwd), amax = Math.max(3, .65 * fwd);
    // the speed that still stops on the mark at a gentle deceleration (a landing, not an asymptote)
    const gap = target - c.laneBase, want = Math.sign(gap) * Math.min(vmax, Math.sqrt(2 * amax * .5 * Math.abs(gap)));
    c.latV += THREE.MathUtils.clamp(want - c.latV, -amax * delta, amax * delta);
    c.laneBase += c.latV * delta;
    if (Math.abs(target - c.laneBase) < .06 && Math.abs(c.latV) < .6) { c.laneBase = target; c.latV = 0; }   // home: exactly on its mark
    return c.laneBase + line * c.lineK;
  }

  function setRanking(rows, { first = false } = {}) {
    lastRows = rows;
    namesUntil = clockMs; namesOpen = false;   // the top three keep their names through a change; the rest stay badges
    hotUntil = reduced ? 0 : clockMs + settledMs() + 400;
    const prevLeader = cars.find((c) => c.rank === 1);
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const c of cars) {
      const row = byId.get(c.lab.id);
      c.rank = row ? row.rank : null;
      c.shoutText = row && row.shout;
      c.fromX = c.x;
      c.toX = targetOf(row, c.rank);
      c.el.classList.toggle('first', c.rank === 1);
      c.el.dataset.podium = c.rank && c.rank <= 3 ? String(c.rank) : '';
      markCompact(c);
      c.el.classList.toggle('missing', c.rank == null);
      c.el.style.zIndex = String(c.rank ? 100 - c.rank : 1);
    }
    packTargets();
    // the first field starts in the frame in its formation, a little back, and drives up into place
    if (first) for (const c of cars) c.fromX = c.toX - 22 * spreadScale();
    packChannels();
    markHot();
    sizeLabels();
    if (reduced) {
      cars.forEach((c) => { c.x = c.toX; c.prevDistance = raceDistance + c.x; });
      changing = false;
    } else {
      if (!initialized || first) cars.forEach((c) => { c.x = c.fromX; c.prevDistance = raceDistance + c.x; });
      initialRate = playbackRate; changeStart = clockMs; changing = true; settledAt = 1e12; mergedAt = 1e12;
    }
    const firstTime = !initialized;
    initialized = true;
    if (!first && !firstTime && !reduced) cutToNewShot();
    /* Drama for a change of lead: the car taking the front boosts and shouts why; a leader
       being pushed back skids. Confetti waits until the new leader has actually settled. */
    const lead = cars.find((c) => c.rank === 1);
    if (!reduced && changing) {
      const end = clockMs + settledMs() + 500;
      cars.forEach((c) => { if (c !== lead) c.shoutUntil = 0; });
      if (lead && (first || lead !== prevLeader || lead.toX - lead.fromX > 1.5)) {
        lead.boost = { start: clockMs + 1e6, end }; pendingBoost = lead;                 // flames when it actually goes
        lead.skid = { start: clockMs + 80, end: clockMs + 1100 };                       // wheelspin from the click: it digs in while it pulls out
        shout(lead, lead.shoutText);
      }
      if (prevLeader && prevLeader !== lead && prevLeader.toX < prevLeader.fromX - 1.5) {
        prevLeader.skid = null; prevLeader.boost = null;   // it is simply overtaken: no lock-up, no drama of its own
      }
    }
    pendingBurst = !reduced && !!lead;
  }

  function sizeLabels() {
    for (const c of cars) {
      const shown = c.el.style.display;
      c.el.style.display = 'flex';
      c.lw = c.el.offsetWidth || c.lw; c.lh = (c.el.offsetHeight || c.lh) + (c.rank === 1 ? 20 : 0);
      c.el.style.display = shown;
    }
  }

  /* ---------- overtaking effects ---------- */
  // plain blending: additive flames wash out to nothing against the pale asphalt
  const fxMats = {
    flameOuter: new THREE.MeshBasicMaterial({ color: '#ff4d12', transparent: true, opacity: .95, depthWrite: false }),
    flameInner: new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: .98, depthWrite: false })
  };
  const flameGeo = new THREE.ConeGeometry(.44, 3.4, 10); flameGeo.translate(0, 1.7, 0);       // base at the exhaust
  const flameCore = new THREE.ConeGeometry(.24, 2.1, 8); flameCore.translate(0, 1.05, 0);
  const ringGeo = new THREE.RingGeometry(.55, .95, 28);
  const streakGeo = new THREE.BoxGeometry(1, .05, .05); streakGeo.translate(-.5, 0, 0);
  function boostFx(c) {
    if (c.fx) return c.fx;
    const g = new THREE.Group(); c.g.add(g);
    const flames = [], sp = c.spec;
    for (const [x, y, z] of sp.exhausts) {
      // cones point up by default; a quarter turn about z sends the tip out behind the car
      const outer = new THREE.Mesh(flameGeo, fxMats.flameOuter); outer.position.set(x, y, z); outer.rotation.z = Math.PI / 2;
      const inner = new THREE.Mesh(flameCore, fxMats.flameInner); inner.position.set(x + .05, y, z); inner.rotation.z = Math.PI / 2;
      g.add(outer, inner); flames.push(outer, inner);
    }
    const streaks = [];
    for (let k = 0; k < 20; k++) {
      const m = new THREE.Mesh(streakGeo, new THREE.MeshBasicMaterial({ color: k % 4 ? '#ffffff' : (c.lab.color ?? '#ffffff'), transparent: true, depthWrite: false }));
      m.userData = { y: .15 + Math.random() * 2.2, z: (Math.random() - .5) * 4.4, phase: Math.random(), len: 2.6 + Math.random() * 4, x: sp.ringX + .2 };
      g.add(m); streaks.push(m);
    }
    // a shock ring punched out behind the car as the boost lights
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    ring.position.set(sp.ringX, .7, 0); ring.rotation.y = Math.PI / 2; g.add(ring);
    g.traverse((o) => { o.castShadow = false; });
    c.fx = { g, flames, streaks, ring, flame: sp.flame };
    return c.fx;
  }
  const smokeGeo = new THREE.IcosahedronGeometry(.5, 0);
  /* Tyre smoke: one instanced mesh and one draw call for every puff, with the fade in a per-puff
     attribute, instead of a lit transparent mesh each (48 sorted draw calls, and every one of them
     rendered again into the ambient-occlusion pass). Smoke is light, not a surface: kept out of AO. */
  const SMOKE_N = 96;
  const smokeFade = new THREE.InstancedBufferAttribute(new Float32Array(SMOKE_N), 1).setUsage(THREE.DynamicDrawUsage);
  smokeGeo.setAttribute('aFade', smokeFade);
  // Lambert, not Standard: a puff is a flat-shaded white blob, and at Retina density the overdraw of
  // thirty overlapping puffs makes the fragment shader the whole cost
  const smokeMat = new THREE.MeshLambertMaterial({ color: '#eef0f2', flatShading: true, transparent: true, depthWrite: false });
  smokeMat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float aFade;varying float vFade;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade=aFade;');
    sh.fragmentShader = 'varying float vFade;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a*=vFade;');
  };
  const smokeMesh = new THREE.InstancedMesh(smokeGeo, smokeMat, SMOKE_N);
  smokeMesh.castShadow = false; smokeMesh.frustumCulled = false;   // always drawn: 64 zero-size instances cost nothing, and the shader compiles on frame one, not on the first skid
  scene.add(smokeMesh); overlays.push(smokeMesh);
  const smoke = Array.from({ length: SMOKE_N }, () => ({ pos: new V(), on: false, life: 0, max: 1, vel: new V() }));
  const smokeM = new THREE.Matrix4();
  const hideSmoke = (i) => smokeMesh.setMatrixAt(i, smokeM.makeScale(0, 0, 0));
  for (let i = 0; i < SMOKE_N; i++) hideSmoke(i);
  smokeMesh.instanceMatrix.needsUpdate = true;
  let smokeNext = 0;
  function puff(p, up) {
    const s = smoke[smokeNext++ % SMOKE_N];
    // in timelapse a puff lives and rises `lapse` times faster, so the trail keeps its length along the road
    s.pos.copy(p); s.on = true; s.life = 0; s.max = (.8 + Math.random() * .6) / studio.lapse;
    s.vel.copy(up).multiplyScalar((1 + Math.random() * 1.4) * studio.lapse);
  }
  function updateSmoke(delta) {
    let live = 0;
    smoke.forEach((s, i) => {
      if (!s.on) return;
      s.life += delta;
      const u = s.life / s.max;
      if (u >= 1) { s.on = false; hideSmoke(i); smokeFade.setX(i, 0); return; }
      live++;
      s.pos.addScaledVector(s.vel, delta);
      const k = .5 + u * 2.1;                                          // grows less than it did: less of the screen under each puff
      smokeMesh.setMatrixAt(i, smokeM.makeScale(k, k, k).setPosition(s.pos));
      smokeFade.setX(i, .8 * (1 - u));
    });
    if (live || smokeMesh.userData.dirty) { smokeMesh.instanceMatrix.needsUpdate = true; smokeFade.needsUpdate = true; }
    smokeMesh.userData.dirty = live > 0;
  }
  /* Tyre marks: a ribbon laid on the road under a sliding tyre, fading over about ten seconds. Each
     quad bridges the tyre's last contact point to its current one, so the rubber reads as one
     unbroken streak however fast the vehicle is going. One geometry and one draw call for the lot;
     the fade lives in the vertex alpha. */
  const MARKS = 128, MARK_LIFE = 9000, MARK_GAP = 9;   // a longer jump than this is a snap, not a slide
  const markPos = new Float32Array(MARKS * 12), markCol = new Float32Array(MARKS * 16);
  const markBorn = new Float32Array(MARKS).fill(-1e9);
  const markGeo = new THREE.BufferGeometry();
  markGeo.setAttribute('position', new THREE.BufferAttribute(markPos, 3));
  markGeo.setAttribute('color', new THREE.BufferAttribute(markCol, 4));
  {
    const idx = [];
    for (let i = 0; i < MARKS; i++) { const v = i * 4; idx.push(v, v + 1, v + 2, v, v + 2, v + 3); }
    markGeo.setIndex(idx);
  }
  const marks = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true,
    side: THREE.DoubleSide,            // a ribbon turns either way through a bend; never let one face away
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }));
  marks.frustumCulled = false; marks.visible = false;
  scene.add(marks);
  let markNext = 0;
  const markR = new V();
  /** One ribbon segment: the tyre's last contact point joined to where it is now. */
  function laySeg(from, to, F, halfWide) {
    const i = markNext++ % MARKS, o = i * 12;
    markBorn[i] = clockMs;
    markR.copy(F.r).multiplyScalar(halfWide);
    const ends = [from, from, to, to], sw = [1, -1, -1, 1];
    for (let k = 0; k < 4; k++) {
      const e = ends[k];
      markPos[o + k * 3] = e.x + markR.x * sw[k] + F.u.x * .03;
      markPos[o + k * 3 + 1] = e.y + markR.y * sw[k] + F.u.y * .03;
      markPos[o + k * 3 + 2] = e.z + markR.z * sw[k] + F.u.z * .03;
    }
    markGeo.attributes.position.needsUpdate = true;
  }
  function fadeMarks() {
    let live = false;
    for (let i = 0; i < MARKS; i++) {
      const a = Math.max(0, 1 - (clockMs - markBorn[i]) / MARK_LIFE) * .5;
      if (a > 0) live = true;
      const o = i * 16;
      for (let k = 0; k < 4; k++) {
        markCol[o + k * 4] = .07; markCol[o + k * 4 + 1] = .06; markCol[o + k * 4 + 2] = .08;
        markCol[o + k * 4 + 3] = a;
      }
    }
    markGeo.attributes.color.needsUpdate = true;
    marks.visible = live;
  }
  const clearMarks = () => { markBorn.fill(-1e9); fadeMarks(); };

  /* Long exposure: every head and tail lamp draws a flat ribbon along the road it drove in the last
     `shutter` seconds, so streaks bend through the corners and lengthen with speed. Poses are
     sampled from the vehicle itself, so a lean, a wheelie or a fishtail shows in the light. One
     geometry, one draw call; brighter at night, and a head lamp brighter when it faces the lens. */
  const trailPos = new Float32Array(LAMP_CAP * HIST * 6), trailCol = new Float32Array(LAMP_CAP * HIST * 6);
  const trailGeo = new THREE.BufferGeometry();
  {
    const idx = [];
    for (let r = 0; r < LAMP_CAP; r++) for (let k = 0; k < HIST - 1; k++) { const a = (r * HIST + k) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    trailGeo.setIndex(idx);
  }
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3).setUsage(THREE.DynamicDrawUsage));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3).setUsage(THREE.DynamicDrawUsage));
  const trails = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  trails.frustumCulled = false; trails.renderOrder = 3; trails.visible = false;
  scene.add(trails); overlays.push(trails);
  // the lamps themselves, lit after dark: one instanced mesh for every vehicle
  const lampMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(.14, 8, 6), lampMat, LAMP_CAP);
  lamps.frustumCulled = false; lamps.visible = false; lamps.count = 0;
  const HEAD = new THREE.Color(1.7, 1.45, 1.1), TAIL = new THREE.Color(2.2, .14, .06);
  for (let i = 0; i < LAMP_CAP; i++) lamps.setColorAt(i, i % 4 < 2 ? HEAD : TAIL);
  scene.add(lamps); overlays.push(lamps);
  const lampM = new THREE.Matrix4(), lampP = new V(), toCam = new V(), ONE = new V(1, 1, 1), NOQ = new THREE.Quaternion();
  const clearTrails = () => { for (const c of cars) c.hist = null; };
  function sampleHistory(c, stepMs) {
    const h = c.hist || (c.hist = { n: 0, head: 0, t: new Float64Array(HIST), m: new Float32Array(HIST * 12), last: -1e9 });
    if (clockMs - h.last < stepMs) return;
    h.last = clockMs; h.head = (h.head + 1) % HIST; h.n = Math.min(HIST, h.n + 1);
    const e = c.g.matrixWorld.elements, o = h.head * 12;
    // position, then the vehicle's forward, up and right axes
    h.m.set([e[12], e[13], e[14], e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]], o);
    h.t[h.head] = clockMs;
  }
  function updateStudio() {
    const exposure = studio.shutter * 1000, streaks = exposure > 20, lit = studio.night > .03;
    trails.visible = streaks; lamps.visible = lit;
    if (!streaks && !lit) return;
    const step = Math.max(16, exposure / (HIST - 2));
    let r = 0, li = 0;
    for (const c of cars) {
      const set = LAMPS[c.spec.kind] || LAMPS.f1, e = c.g.matrixWorld.elements;
      if (lit) for (const [, lx, ly, lz] of set) {
        if (li >= LAMP_CAP) break;
        lampP.set(e[12] + e[0] * lx + e[4] * ly + e[8] * lz, e[13] + e[1] * lx + e[5] * ly + e[9] * lz, e[14] + e[2] * lx + e[6] * ly + e[10] * lz);
        lamps.setMatrixAt(li++, lampM.compose(lampP, NOQ, ONE));
      }
      if (!streaks) continue;
      sampleHistory(c, step);
      const h = c.hist;
      for (const [type, lx, ly, lz, w] of set) {
        if (r >= LAMP_CAP) break;
        let px = 0, py = 0, pz = 0, done = false, prevX = NaN, prevY = 0, prevZ = 0;
        for (let k = 0; k < HIST; k++) {
          // point 0 is the pose now; then the history, newest first, back to the start of the exposure
          let m = e, mo = 0, age = 0, fx, fy, fz, rx, ry, rz, ux, uy, uz, ox, oy, oz;
          if (k > 0 && !done) {
            const s = (h.head - (k - 1) + HIST) % HIST;
            age = clockMs - h.t[s];
            if (k - 1 >= h.n || age > exposure) done = true; else { m = h.m; mo = s * 12; }
          }
          if (m === e) { ox = e[12]; oy = e[13]; oz = e[14]; fx = e[0]; fy = e[1]; fz = e[2]; ux = e[4]; uy = e[5]; uz = e[6]; rx = e[8]; ry = e[9]; rz = e[10]; }
          else { ox = m[mo]; oy = m[mo + 1]; oz = m[mo + 2]; fx = m[mo + 3]; fy = m[mo + 4]; fz = m[mo + 5]; ux = m[mo + 6]; uy = m[mo + 7]; uz = m[mo + 8]; rx = m[mo + 9]; ry = m[mo + 10]; rz = m[mo + 11]; }
          const a = ((r * HIST) + k) * 6;
          if (!done) {
            px = ox + fx * lx + ux * ly + rx * lz; py = oy + fy * lx + uy * ly + ry * lz; pz = oz + fz * lx + uz * ly + rz * lz;
            // a jump this long is a teleport (a new circuit, a snapped field), not a drive: the streak ends there
            if (k > 0 && (px - prevX) ** 2 + (py - prevY) ** 2 + (pz - prevZ) ** 2 > 3600) done = true;
          }
          if (done) {             // collapse the rest of the ribbon onto its last point
            trailPos.copyWithin(a, a - 6, a); trailCol.fill(0, a, a + 6); continue;
          }
          prevX = px; prevY = py; prevZ = pz;
          trailPos[a] = px + rx * w; trailPos[a + 1] = py + ry * w; trailPos[a + 2] = pz + rz * w;
          trailPos[a + 3] = px - rx * w; trailPos[a + 4] = py - ry * w; trailPos[a + 5] = pz - rz * w;
          toCam.set(camera.position.x - px, camera.position.y - py, camera.position.z - pz).normalize();
          const facing = (fx * toCam.x + fy * toCam.y + fz * toCam.z) * type, u = exposure ? age / exposure : 0;
          const I = (.15 + .85 * THREE.MathUtils.smoothstep(facing, -.2, .7)) * (u < .7 ? 1 : (1 - u) / .3)
            * (type < 0 ? 1.3 * (c.skid ? 2 : 1) : 1.05) * (.3 + .7 * studio.night);
          const g = I * (type < 0 ? .07 : .8), b = I * (type < 0 ? .03 : .56);
          trailCol[a] = trailCol[a + 3] = I; trailCol[a + 1] = trailCol[a + 4] = g; trailCol[a + 2] = trailCol[a + 5] = b;
        }
        r++;
      }
    }
    if (lit) { lamps.count = li; lamps.instanceMatrix.needsUpdate = true; lampMat.color.setScalar(.25 + .75 * studio.night); }
    if (streaks) {
      trailGeo.setDrawRange(0, r * (HIST - 1) * 6);
      trailGeo.attributes.position.needsUpdate = trailGeo.attributes.color.needsUpdate = true;
    }
  }

  const fxLevel = (e) => (e ? Math.max(0, Math.min(smoothStep((clockMs - e.start) / 280), 1 - smoothStep((clockMs - (e.end - 650)) / 650))) : 0);
  const fxW = new V();
  function applyFx(c, F) {
    const B = fxLevel(c.boost), S = fxLevel(c.skid), sp = c.spec;
    if (c.boost && clockMs > c.boost.end) c.boost = null;
    if (c.skid && clockMs > c.skid.end) c.skid = null;
    if (B > .001) {
      const fx = boostFx(c); fx.g.visible = true;
      if (c.spec.kind === 'motogp') {
        // a wheelie under power, turning about the rear tyre's contact patch so it stays on the road
        const a = B * (.3 + .05 * Math.sin(clockMs / 260)), L = -c.spec.rear;
        c.g.position.add(fxW.set(-L * (1 - Math.cos(a)), L * Math.sin(a), 0).applyQuaternion(c.g.quaternion));
        c.g.rotateZ(a);
      } else {
        c.g.rotateZ(sp.nose * B);                                     // nose up under power
        c.g.position.addScaledVector(F.u, Math.abs(Math.sin(worldTime * 38)) * .05 * B);
      }
      const flick = .7 + Math.random() * .6, tt = clockMs / 1000, fs = B * fx.flame;
      fx.flames.forEach((m, k) => m.scale.set(fs * (k % 2 ? .9 : 1), fs * flick * (k % 2 ? 1 : 1.15), fs * (k % 2 ? .9 : 1)));
      for (const m of fx.streaks) {
        const u = (m.userData.phase + tt * 2.4) % 1;
        m.position.set(m.userData.x - u * 12, m.userData.y, m.userData.z);
        m.scale.set(m.userData.len * B * (1.3 - u), 1, 1);
        m.material.opacity = .85 * B * (1 - u);
      }
      const r = c.boost ? Math.min(1, (clockMs - c.boost.start) / 520) : 1;
      fx.ring.visible = r < 1; fx.ring.scale.setScalar(1 + r * 5); fx.ring.material.opacity = .85 * (1 - r);
    } else if (c.fx && c.fx.g.visible) c.fx.g.visible = false;
    if (S > .001 && c.skid) {
      const w = (clockMs - c.skid.start) / 1000;
      c.g.rotateY(Math.sin(w * 13) * sp.fishtail * S);               // a twitch under the lock-up, or a stock car's step out
      c.g.rotateX(Math.sin(w * 13 + 1.2) * sp.pitch * S);
      const trav = raceDistance + c.x;   // how far down the road: puffs and rubber are laid per unit of it, so timelapse never spaces them out
      if (S > .25) {
        if (c.puffD == null || trav - c.puffD > 40) c.puffD = trav - 2.2;   // (re)start the trail here, never bridge a snap
        const owed = Math.min(8, Math.floor((trav - c.puffD) / 2.2));
        if (owed > 0) {
          c.g.updateMatrixWorld();
          for (let k = owed; k >= 1; k--) {
            const back = trav - (c.puffD + k * 2.2);                 // this puff belongs `back` units behind the tyre
            for (const [x, y, z] of c.spec.puffs) puff(c.g.localToWorld(fxW.set(x, y, z)).addScaledVector(F.f, -back), F.u);
          }
          c.puffD += owed * 2.2;
        }
      }
      // rubber laid on the road: each tyre's contact point joined to where it was a moment ago
      if (S > .2 && trav - (c.markD ?? -1e9) > 1) {
        c.markD = trav; c.g.updateMatrixWorld();
        const wide = sp.mark;                               // wide enough to still read from the TV cam
        if (!c.markAt) c.markAt = c.spec.puffs.map(() => new V(NaN, 0, 0));
        c.spec.puffs.forEach(([x, , z], k) => {
          const at = c.g.localToWorld(fxW.set(x, 0, z)), was = c.markAt[k];
          if (!Number.isNaN(was.x) && at.distanceTo(was) < MARK_GAP * studio.lapse) laySeg(was, at, F, wide);
          was.copy(at);
        });
      }
    }
  }
  const BODY_LIFT = 26, MAX_LIFT = 64;   // px: the most a name climbs to clear another car, or another name
  const SHOUT_GAP = -15;               // the bubble's 14px tail then ends right on top of the crown
  function shout(c, text) {
    if (!text) return;
    if (!c.shoutEl) {
      c.shoutEl = document.createElement('div'); c.shoutEl.className = 'shout'; c.shoutEl.setAttribute('aria-hidden', 'true');
      labelsEl.append(c.shoutEl);
    }
    c.shoutEl.textContent = text;
    // measure unseen; the label loop places it over the label, then it pops
    c.shoutEl.style.visibility = 'hidden'; c.shoutEl.style.display = 'block'; c.shoutShown = true;
    c.shoutW = c.shoutEl.offsetWidth; c.shoutPending = true;
    c.shoutUntil = clockMs + settledMs() + 1600;
    c.shoutEl.classList.remove('pop');
  }

  /* ---------- confetti, carried with the leader ---------- */
  const confetti = new THREE.Group();
  {
    const cols = ['#ffd36e', '#ff7aa8', '#63d2ff', '#a0e86f', '#fff6e9'];
    const geo = new THREE.PlaneGeometry(.2, .32);
    for (let i = 0; i < 90; i++) {
      const p = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, transparent: true }));
      p.visible = false; confetti.add(p);
    }
    confetti.userData.t = -1;
  }
  function burst(car) {
    car.g.add(confetti);
    confetti.userData.t = 0;
    for (const p of confetti.children) {
      p.visible = true; p.material.opacity = 1;
      p.position.set((Math.random() - .5) * 2.4, 1.6 + Math.random() * 1.2, (Math.random() - .5) * 2);
      p.userData.v = new V((Math.random() - .5) * 5, 5 + Math.random() * 5, (Math.random() - .5) * 5);
      p.userData.spin = new V(Math.random() * 9, Math.random() * 9, 0);
    }
  }

  /* ---------- frame loop ---------- */
  const aimW = new V(), proj = new V(), fwd = new V(), focus = new V(), basis = new THREE.Matrix4();
  let last = performance.now(), slowFrames = 0, sampled = 0, firstRenderAt = 0;
  /* Carry the fitted rig round the ring with the pack; the sun turns with it, so the
     view is always lit the way it was tuned. */
  function aimRig(progress = 1) {
    camFrameAt(raceDistance, cf);
    if (camMode === 'tv' || !cars.length) {
      const s = shots[shotIndex];
      if (s) {
        const u = smoothStep((clockMs - camMoveStart) / settledMs());
        rig.pos.lerpVectors(camFrom.pos, s.pos, u); rig.aim.lerpVectors(camFrom.aim, s.aim, u);
        rig.fov = camFrom.fov + (s.fov - camFrom.fov) * u;
      }
      toWorld(rig.pos, cf, poseTarget.pos); toWorld(rig.aim, cf, poseTarget.aim);
      poseTarget.up.copy(cf.u); poseTarget.fov = rig.fov;
    } else {
      modePose(progress, poseTarget);
    }
    // glide from wherever the lens was when the mode (or cinematic shot) changed
    const u = smoothStep((clockMs - camBlendStart) / camBlendMs);
    if (u < 1) {
      poseNow.pos.lerpVectors(poseFrom.pos, poseTarget.pos, u); poseNow.aim.lerpVectors(poseFrom.aim, poseTarget.aim, u);
      poseNow.up.lerpVectors(poseFrom.up, poseTarget.up, u).normalize();
      poseNow.fov = poseFrom.fov + (poseTarget.fov - poseFrom.fov) * u;
    } else {
      poseNow.pos.copy(poseTarget.pos); poseNow.aim.copy(poseTarget.aim); poseNow.up.copy(poseTarget.up); poseNow.fov = poseTarget.fov;
    }
    if (Math.abs(camera.fov - poseNow.fov) > 1e-3) { camera.fov = poseNow.fov; camera.updateProjectionMatrix(); }
    camera.position.copy(poseNow.pos); aimW.copy(poseNow.aim); camera.up.copy(poseNow.up);
    camera.lookAt(aimW); camera.updateMatrixWorld();
    toWorld(SUN_OFFSET, cf, sun.position); sun.target.position.copy(cf.p);
    hemi.position.copy(cf.u);                                   // sky is above the road, wherever it points
    if (track.id !== 'ring') { toWorld(FILL_OFFSET, cf, fill.position); fill.target.position.copy(cf.p); }
    const viewDistance = poseNow.pos.distanceTo(poseNow.aim);
    scene.fog.near = Math.max(160, viewDistance * .94); scene.fog.far = Math.max(520, viewDistance * 2.5);
  }

  const carOffset = (c, progress) => (changing ? THREE.MathUtils.lerp(c.fromX, c.toX, reduced ? progress : xProgress(c)) : c.x);
  // the car a riding camera stays with: the lab picked on the page, else the given place
  function camCar(place) {
    return (followId && cars.find((c) => c.lab.id === followId && c.rank)) || cars.find((c) => c.rank === place)
      || cars.find((c) => c.rank === 1) || cars[0];
  }
  // follow that car along the road; switching to another car glides across instead of cutting
  function trackCar(c, progress) {
    const x = carOffset(c, progress);
    if (follow.id !== c.lab.id) {
      follow.fromX = follow.id ? follow.x : x; follow.fromLane = follow.id ? follow.lane : c.lane;
      follow.id = c.lab.id; follow.since = clockMs;
    }
    const s = smoothStep((clockMs - follow.since) / 700);
    follow.x = THREE.MathUtils.lerp(follow.fromX, x, s); follow.lane = THREE.MathUtils.lerp(follow.fromLane, c.lane, s);
  }
  function modePose(progress, out) {
    const portrait = innerWidth / innerHeight < 1;
    if (camMode === 'heli') {
      trackCar(camCar(1), progress);
      // circling high over the field, centred a little behind the leader
      track.frame(raceDistance + follow.x - 14 * spreadScale(), 0, camF);
      const th = clockMs / 1000 * .05, R = portrait ? 80 : 66;
      out.aim.copy(camF.p);
      out.pos.copy(camF.p).addScaledVector(camF.f, Math.cos(th) * R).addScaledVector(camF.r, Math.sin(th) * R)
        .addScaledVector(camF.u, portrait ? 96 : 72);
      out.up.copy(camF.u); out.fov = portrait ? 58 : 46;
    } else if (camMode === 'rear') {
      trackCar(camCar(1), progress);
      track.frame(raceDistance + follow.x - 10.5, follow.lane, camF);
      track.frame(raceDistance + follow.x + 8, follow.lane, camG);
      out.pos.copy(camF.p).addScaledVector(camF.u, 3.8);
      out.aim.copy(camG.p).addScaledVector(camG.u, 1.2);
      out.up.copy(camF.u); out.fov = portrait ? 66 : 50;
    } else if (camMode === 'driver') {
      // in the cockpit of the car in second, eyes on the road just ahead and on the leader it chases
      const rider = camCar(2), lead = cars.find((c) => c.rank === 1 && c !== rider), eye = rider.spec.eye;
      trackCar(rider, progress);
      track.frame(raceDistance + follow.x + eye.x, follow.lane + rider.weave, camF);
      // a tall screen shows mostly sky above a level gaze, so portrait looks further down the road
      track.frame(raceDistance + follow.x + (portrait ? 12 : 15), follow.lane, camG);
      // the eye rides the lean of a bike; the horizon stays level, like a gyro-stabilised onboard camera
      out.pos.copy(camF.p).addScaledVector(camF.u, eye.y * Math.cos(rider.lean)).addScaledVector(camF.r, eye.y * Math.sin(rider.lean));
      out.aim.copy(camG.p).addScaledVector(camG.u, portrait ? -2.4 : .7);
      if (lead) {
        // the gaze eases toward the leader, so a change of leader turns the head instead of snapping it
        track.frame(raceDistance + carOffset(lead, progress), lead.lane, camH);
        const k = 1 - Math.exp(-Math.max(0, clockMs - gaze.t) / 220);
        gaze.p.lerp(camH.p.addScaledVector(camH.u, portrait ? -.6 : 1), gaze.t < 0 ? 1 : k);
        out.aim.lerp(gaze.p, portrait ? .8 : .55);
      }
      gaze.t = clockMs;
      out.up.copy(camF.u); out.fov = portrait ? 78 : 60;
    } else {
      cinePose(progress, out);
    }
  }
  const CINE_MS = 7000;
  function cinePose(progress, out) {
    const portrait = innerWidth / innerHeight < 1;
    trackCar(camCar(1), progress);
    const dLead = raceDistance + follow.x;
    // a new shot every few seconds, or as soon as the field has run past the kerbside camera
    if (clockMs - cine.start > CINE_MS || (cine.shot === 0 && dLead > cine.anchorD + 20)) {
      holdPose(1600);
      cine.shot = (cine.shot + 1) % 3; cine.start = clockMs; cine.anchorD = dLead + 24;
    }
    const t = (clockMs - cine.start) / 1000;
    track.frame(dLead, follow.lane, camG);
    if (cine.shot === 0) {                        // low at the kerb as the field comes past
      track.frame(cine.anchorD, 23, camF);
      out.pos.copy(camF.p).addScaledVector(camF.u, 2.3);
      out.aim.copy(camG.p).addScaledVector(camG.u, 1.1);
      out.up.copy(camF.u); out.fov = portrait ? 50 : 34;
    } else if (cine.shot === 1) {                 // a slow low orbit round the leader, kept over the road
      const th = 2.3 + t * .17, R = 13;
      track.frame(dLead + Math.cos(th) * R, THREE.MathUtils.clamp(follow.lane + Math.sin(th) * R, -23, 23), camF);
      out.pos.copy(camF.p).addScaledVector(camF.u, 3.3);
      out.aim.copy(camG.p).addScaledVector(camG.u, 1.1);
      out.up.copy(camG.u); out.fov = portrait ? 56 : 42;
    } else {                                      // a crane rising behind the pack
      const rise = smoothStep(t / 6.5);
      track.frame(dLead - 30 + rise * 6, 4, camF);
      out.pos.copy(camF.p).addScaledVector(camF.u, 3 + rise * 38);
      out.aim.copy(track.frame(dLead + 4, 0, camG));
      out.up.copy(camF.u); out.fov = portrait ? 60 : 44;
    }
  }
  // the lens as it is now becomes the start of a glide to the next pose
  function holdPose(ms) {
    poseFrom.pos.copy(poseNow.pos); poseFrom.aim.copy(poseNow.aim); poseFrom.up.copy(poseNow.up); poseFrom.fov = poseNow.fov;
    camBlendStart = clockMs; camBlendMs = ms;
  }
  function setCamMode(mode) {
    if (!CAM_MODES.includes(mode) || mode === camMode) return camMode;
    holdPose(mode === 'tv' ? 1200 : 1000);
    camMode = mode;
    cine.shot = 0; cine.start = clockMs; cine.anchorD = raceDistance + follow.x + 24;
    // the cockpit sits centimetres from the halo: bring the near plane in for the close cameras
    camera.near = mode === 'driver' ? .1 : mode === 'rear' || mode === 'cine' ? .4 : 1;
    camera.updateProjectionMatrix();
    if (dof && dof.uniforms.nearClip) dof.uniforms.nearClip.value = camera.near;
    return camMode;
  }

  /* Cars onto their lanes, wheels turning by distance travelled, then name labels:
     leader first, anyone overlapping a better-placed label is lifted clear. */
  function placeCars(delta, progress) {
    const W = innerWidth, H = innerHeight;
    let backNow = 0;
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      if (changing) c.x = THREE.MathUtils.lerp(c.fromX, c.toX, reduced ? progress : xProgress(c));
      const distance = raceDistance + c.x, sp = c.spec, bike = sp.kind === 'motogp';
      c.lane = laneAt(c, delta);
      // steer, don't slide: the nose turns into the sideways speed, against the speed down the road
      if (delta > 0) {
        const latV = (c.lane - c.prevLane) / delta;
        const fwd = NORMAL_SPEED * Math.max(playbackRate, SLOW_RATE) * studio.lapse + (c.x - c.prevXf) / delta;
        const want = THREE.MathUtils.clamp(Math.atan2(latV, Math.max(fwd, 4)), -.5, .5);
        c.yaw += (want - c.yaw) * Math.min(1, delta * 10);
      }
      if (delta > 0) motion.lat = Math.max(motion.lat, Math.abs(c.lane - c.prevLane) / delta);   // the fastest any car has moved across the road, per frame of the race itself
      if (delta > 0) backNow = Math.max(backNow, (c.prevXf - c.x) / delta);
      c.prevLane = c.lane; c.prevXf = c.x;
      if (bike) {
        /* Bikes weave gently within their lane and lean into it and into every bend: the lean is
           the path's sideways curvature (the track's own bend plus the weave's) at a MotoGP-ish angle. */
        const ph = distance / WEAVE_L + i * 1.9;
        c.weave = WEAVE_A * Math.sin(ph);
        track.frame(distance + 2, c.lane, tfA); track.frame(distance - 2, c.lane, tfB);
        track.frame(distance, c.lane, tf);
        const k = tfA.f.sub(tfB.f).dot(tf.r) / 4 - WEAVE_A / (WEAVE_L * WEAVE_L) * Math.sin(ph);
        c.lean = THREE.MathUtils.clamp(Math.atan(k * LEAN_K), -MAX_LEAN, MAX_LEAN);
      } else { c.weave = 0; c.lean = 0; }
      track.frame(distance, c.lane + c.weave, tf);
      c.g.position.copy(tf.p).addScaledVector(tf.u, (bike ? .02 : .07) + Math.sin(worldTime * 12 + i) * .007);
      basis.makeBasis(tf.f, tf.u, tf.r); c.g.quaternion.setFromRotationMatrix(basis);
      if (c.yaw) c.g.rotateY(-c.yaw);                                  // nose into the lane change
      if (bike) c.g.rotateX(c.lean + c.yaw * .6);                      // positive tips the top toward the right (+z); a rider leans into the move too
      else if (pack) {
        /* A car is not a bike: it does not lean into the bend, it rolls out of it. The weight goes
           to the outside, so the roll is the negative of the bend, and the same for a lane change —
           the body rolls away from the way the nose has gone. More of both the faster it is going.
           It has to stay small. A real car rolls its body on its springs and leaves four tyres on
           the road; this is one rigid group turning about its own centreline, so every degree of
           roll lifts a wheel `halfTrack × sin(roll)` off the ground. Past about three degrees the
           inside wheels are visibly in the air and it reads as a bike laying into a corner, which
           is what `sp.roll` caps — below the ride height at the widest wheel of each vehicle. */
        const roll = THREE.MathUtils.clamp(curvAt(distance) * PACK.roll, -sp.roll, sp.roll) * Math.sqrt(Math.max(playbackRate, SLOW_RATE)) + c.yaw * sp.yawRoll;
        c.g.rotateX(-THREE.MathUtils.clamp(roll, -sp.roll, sp.roll));
      }
      applyFx(c, tf);
      const laneScale = track.id === 'ring' ? (track.radius + c.lane) / track.radius : 1;
      c.wheelRotation += (distance - c.prevDistance) * laneScale / sp.wheelR;
      c.prevDistance = distance;
      for (const hub of c.hubs) hub.rotation.z = -c.wheelRotation;
      c.g.updateMatrixWorld();
      // bikes label from above the rider, upright, so the tag does not swing with the lean
      if (bike) proj.copy(tf.p).addScaledVector(tf.u, sp.top).project(camera);
      else proj.set(0, sp.top, 0).applyMatrix4(c.g.matrixWorld).project(camera);
      c.sx = (proj.x * .5 + .5) * W; c.sy = (-proj.y * .5 + .5) * H;
      let bl = 1e9, br = -1e9, bt = 1e9, bb = -1e9;
      for (const bx of sp.box.x) for (const by of sp.box.y) for (const bz of sp.box.z) {
        proj.set(bx, by, bz).applyMatrix4(c.g.matrixWorld).project(camera);
        const px = (proj.x * .5 + .5) * W, py = (-proj.y * .5 + .5) * H;
        bl = Math.min(bl, px); br = Math.max(br, px); bt = Math.min(bt, py); bb = Math.max(bb, py);
      }
      c.box = { l: bl, r: br, t: bt, b: bb };
      c.on = proj.z < 1 && proj.z > -1 && c.sx > -40 && c.sx < W + 40 && c.sy > 0 && c.sy < H + 20;
      if (camMode === 'driver' && c.lab.id === follow.id) c.on = false;      // no label on the car you sit in
    }
    motion.back += (backNow - motion.back) * Math.min(1, delta * 6);   // eased, so the frame's extra speed never steps
    if (changing && progress >= 1) {
      changing = false; settledAt = clockMs; cars.forEach((c) => { c.x = c.toX; });
      if (pendingBurst) { pendingBurst = false; const lead = cars.find((c) => c.rank === 1); if (lead) burst(lead); }
    }

    /* Obstacles: other name labels, and other car bodies only while a small lift clears them. A name
       lifted far above its own car reads as someone else's, so the lift is capped; a logo badge never
       moves off its car and is nobody's obstacle. */
    const placed = cars.filter((c) => c.on && c.box).map((c) => ({ ...c.box, owner: c, body: true }));
    const order = cars.slice().sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
    // phones in 'top3': the podium wears labels and the rank rail carries the rest; 'off' hides them all.
    // A tap on the rail reveals one either way.
    const railMode = innerWidth <= 860, nowMs = performance.now();
    for (const c of order) {
      const off = !(c.revealUntil > nowMs) && (labelMode === 'off' || (railMode && labelMode === 'top3' && !(c.rank && c.rank <= 3)));
      if (off !== c.offrail) { c.offrail = off; c.el.classList.toggle('offrail', off); }
      if (!c.on || off) {
        if (c.el.style.display !== 'none') c.el.style.display = 'none';
        if (c.shoutEl && c.shoutShown) { c.shoutShown = false; c.shoutEl.style.display = 'none'; }
        continue;
      }
      // a label coming back into view is measured now: sizes read while it was hidden come back as zero
      if (c.el.style.display !== 'flex') {
        c.el.style.display = 'flex';
        const ow = c.el.offsetWidth, oh = c.el.offsetHeight;
        if (ow) c.lw = ow;
        if (oh) c.lh = oh + (c.rank === 1 ? 20 : 0);
      }
      const half = c.lw / 2;
      // clear of its own car body too: from a steep angle the roof point lands mid-car
      const ay = Math.min(c.sy, c.box.t - 4);
      // phones: keep the leader's label (and its shout) on screen and clear of the rank rail
      const edge = (w) => Math.min(Math.max(c.sx, (rig.safe ? rig.safe.left : 0) + w / 2 + 4), W - w / 2 - 6);
      const lx = railMode ? edge(c.lw) : c.sx;
      let lift = 0;
      for (let step = 0; step < 10 && !c.compact && !(railMode && c.rank === 1); step++) {
        const t = ay - c.lh - lift, b = ay - lift;
        const hit = placed.find((p) => p.owner !== c && lx - half < p.r + 3 && lx + half > p.l - 3 && t < p.b + 2 && b > p.t - 2
          && (!p.body || ay - p.t + 3 <= BODY_LIFT));
        if (!hit) break;
        const next = Math.min(ay - hit.t + 3, MAX_LIFT);
        if (next <= lift) break;
        lift = next;
      }
      c.lift += (lift - c.lift) * (delta === 0 ? 1 : Math.min(1, delta * 9));
      if (!c.compact) placed.push({ l: lx - half, r: lx + half, t: ay - c.lh - c.lift, b: ay - c.lift, owner: c });
      if (c.el.style.display !== 'flex') c.el.style.display = 'flex';
      c.el.style.transform = `translate3d(${lx.toFixed(1)}px,${(ay - c.lift).toFixed(1)}px,0) translate(-50%,-100%)`;
      if (c.shoutEl) {
        const show = clockMs < (c.shoutUntil || 0);
        if (show !== c.shoutShown) { c.shoutShown = show; c.shoutEl.style.display = show ? 'block' : 'none'; }
        if (show) {
          // position rides on `translate`, so the pop's scale and rotate turn about the tail tip, not the page corner
          c.shoutEl.style.translate = `${(railMode ? edge(c.shoutW || c.lw) : c.sx).toFixed(1)}px ${(ay - c.lift - c.lh + SHOUT_GAP).toFixed(1)}px`;
          if (c.shoutPending) {
            c.shoutPending = false; c.shoutEl.style.visibility = '';
            void c.shoutEl.offsetWidth; c.shoutEl.classList.add('pop');
          }
        }
      }
    }

  }

  /* The sharp band spans the leader and both board lines (infield hoardings behind the pack,
     tilted boards on the outer verge in front). Aperture is sized so blur inside the band stays
     under ~1px; the lake, peaks and near forest still soften. */
  function updateFocus() {
    const r = autoFocus();
    if (!dof) return r;
    if (!studio.focusAuto) { dof.uniforms.focus.value = studio.focus; if (macro) macro.u.focus.value = studio.focus; }
    studio.focusNow = macro && macro.enabled ? macro.u.focus.value : dof.uniforms.focus.value;
    if (macro) {
      macro.u.range.value = THREE.MathUtils.clamp(macro.u.focus.value * .12, 4, 20);   // a sharp band that grows with distance: the pack from the TV cam, the road ahead from the seat
      macro.u.near.value = camera.near; macro.u.far.value = camera.far;
    }
    return r;
  }
  function autoFocus() {
    if (!dof) return null;
    camera.getWorldDirection(fwd);
    const depth = (P) => focus.copy(P).sub(camera.position).dot(fwd);
    const lead = cars.find((c) => c.rank === 1);
    if (camMode !== 'tv') {
      // riding cameras focus on their car; the driver cam looks past its own nose to the leader
      const ridden = follow.id && cars.find((c) => c.lab.id === follow.id);
      const target = camMode === 'driver' ? lead : ridden || lead;
      // the driver cam sits on its own car: focus no nearer than the road just ahead, or the nose swallows the frame
      dof.uniforms.focus.value = target ? Math.max(camMode === 'driver' ? 12 : 4, depth(target.g.position)) : 40;
      if (macro) macro.u.focus.value = dof.uniforms.focus.value;
      dof.uniforms.aperture.value = camMode === 'cine' ? .00011 : camMode === 'heli' ? .00002 : .00004;
      return { focus: Math.round(dof.uniforms.focus.value), aperture: dof.uniforms.aperture.value };
    }
    // track.frame() returns the position vector itself
    const dLead = lead ? depth(lead.g.position) : depth(track.frame(raceDistance + 4, 0, tf));
    const dIn = depth(track.frame(raceDistance, -25, tf)), dOut = depth(track.frame(raceDistance, 25.5, tf));
    const near = Math.min(dLead, dIn, dOut), far = Math.max(dLead, dIn, dOut);
    if (macro) macro.u.focus.value = dLead;   // a miniature is sharp on its subject: the leader
    const halfBand = (far - near) / 2 + 14;
    dof.uniforms.focus.value = Math.max(15, (near + far) / 2);
    // blur radius in px ~= |depth - focus| * aperture * 0.4 * buffer width
    dof.uniforms.aperture.value = Math.min(.00015, 1 / (.4 * renderer.domElement.width * halfBand));
    return { near: Math.round(near), far: Math.round(far), focus: Math.round(dof.uniforms.focus.value), aperture: dof.uniforms.aperture.value };
  }

  /* No cloud may stand between the lens and the race: any cloud near the camera, or in front of
     the pack and overlapping it on screen, shrinks away; it grows back once clear. */
  const cloudTmp = new V();
  function updateClouds(delta) {
    const field = env.clouds;
    if (!field || !field.items.length) return;
    const W = innerWidth, H = innerHeight, tanV = Math.tan(camera.fov * Math.PI / 360);
    camera.getWorldDirection(fwd);
    let l = 1e9, r = -1e9, t = 1e9, b = -1e9, far = 0, any = false;
    for (const c of cars) {
      if (!c.on || !c.box) continue;
      any = true;
      l = Math.min(l, c.box.l); r = Math.max(r, c.box.r); t = Math.min(t, c.box.t); b = Math.max(b, c.box.b);
      far = Math.max(far, cloudTmp.copy(c.g.position).sub(camera.position).dot(fwd));
    }
    let dirty = false;
    for (const it of field.items) {
      const depth = cloudTmp.copy(it.centre).sub(camera.position).dot(fwd);
      let hide = false;
      if (camera.position.distanceTo(it.centre) < it.radius + 70) hide = true;          // at the lens
      else if (depth > 0 && any && depth < far + it.radius) {
        cloudTmp.copy(it.centre).project(camera);
        const sx = (cloudTmp.x * .5 + .5) * W, sy = (-cloudTmp.y * .5 + .5) * H;
        const rp = it.radius / (depth * tanV) * H / 2;
        if (sx + rp > l - 40 && sx - rp < r + 40 && sy + rp > t - 60 && sy - rp < b + 40) hide = true;
      }
      const target = hide ? 0 : 1;
      if (it.k !== target) {
        it.k += (target - it.k) * Math.min(1, delta * 7);
        if (Math.abs(it.k - target) < .02) it.k = target;
        dirty = true;
      }
    }
    if (dirty) field.apply();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    // 30fps while cruising, 60 while cars are overtaking
    const since = now - last;
    if (since < (changing ? 1000 / 60 : 1000 / 30) - 1.5) return;
    const delta = Math.min(since / 1000, .1); last = now;

    clockMs += delta * 1000;
    const elapsed = clockMs - changeStart;
    // the run-down to slow motion waits until every car is back on the line (or five seconds, whichever first)
    if (!changing && mergedAt === 1e12 && (clockMs > settledAt + 5000 || cars.every((c) => Math.abs(c.laneBase - restLane(c)) < .4 && (!pack || c.lineK > .9)))) mergedAt = clockMs + 400;
    playbackRate = reduced ? 0 : playbackAt(elapsed, initialRate, clockMs, mergedAt);
    // the racing line eases off for a change and comes back once the order has settled, never in a jump
    if (changing) {   // each car lets go of the racing line on its own delay
      for (const c of cars) if (clockMs - changeStart >= c.lineOff) c.lineK = Math.max(0, c.lineK - delta / .7);
    } else {          // and takes it up again once its whole overlap cluster is home, on the cluster's delay
      for (const g of lineClusters) if (clockMs - settledAt >= g[0].lineOn && g.every((c) => Math.abs(c.laneBase - restLane(c)) < .5))
        for (const c of g) c.lineK = Math.min(1, c.lineK + delta / 2.0);
    }
    openGate();
    // timelapse speeds the traffic, the scenery and the clock; the overtake choreography keeps real time
    raceDistance += (NORMAL_SPEED * playbackRate + (pack ? motion.back : 0)) * delta * studio.lapse;
    worldTime += (reduced ? 0 : Math.max(playbackRate, SLOW_RATE)) * delta * studio.lapse;
    if (studio.cycle) {
      const was = Math.floor(studio.hour * 4);
      studio.hour = (studio.hour + delta * studio.lapse * 24 / DAY_SECONDS) % 24;
      applyLight();
      if (Math.floor(studio.hour * 4) !== was) onClock(studio.hour);
    }
    const progress = reduced ? 1 : progressNow();

    aimRig(progress);
    if (namesOpen && clockMs >= namesUntil) { namesOpen = false; refreshLabels(); }
    if (hotOn && clockMs >= hotUntil) markHot();
    placeCars(delta, progress);

    if (confetti.userData.t >= 0) {
      confetti.userData.t += delta;
      for (const p of confetti.children) {
        if (!p.visible) continue;
        p.userData.v.y -= 16 * delta;
        p.position.addScaledVector(p.userData.v, delta);
        p.rotation.x += p.userData.spin.x * delta; p.rotation.y += p.userData.spin.y * delta;
        if (confetti.userData.t > 1) p.material.opacity = Math.max(0, 1 - (confetti.userData.t - 1) / .6);
        if (p.position.y < 0) p.visible = false;
      }
      if (confetti.userData.t > 1.6) { confetti.userData.t = -1; confetti.children.forEach((p) => { p.visible = false; }); }
    }

    fadeMarks();
    updateStudio();
    env.update(worldTime);
    updateClouds(delta * studio.lapse);
    updateSmoke(delta);
    updateFocus();
    if (composer) composer.render(); else renderer.render(scene, camera);
    if (!firstRenderAt) firstRenderAt = Math.round(performance.now());

    // if the machine cannot hold the pace, shed ambient occlusion first, then resolution
    if (sampled < 120) {
      sampled++;
      if (delta > .05) slowFrames++;
      if (sampled === 120 && slowFrames > 40) {
        if (gtao) { gtao.enabled = false; }
        else if (dpr > 1) { dpr = 1; renderer.setPixelRatio(dpr); if (composer) composer.setPixelRatio(dpr); resize(); }
        sampled = 0; slowFrames = 0;
      }
    }
  }

  /* Swap the circuit: the old world goes, the new one is built, and the camera shots are
     re-fitted and re-scored against the new track's boards. Rankings and lanes carry over. */
  function setTrack(id) {
    const next = makeTrack(id);
    if (next.id === track.id) return track.id;
    scene.remove(env.group);
    env.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    track = next; lineTable = null;
    env = buildEnv(track.id);
    raceDistance = 0;
    clearMarks(); clearTrails();        // the old rubber and light belong to the old circuit
    for (const c of cars) c.prevDistance = raceDistance + c.x;
    shotIndex = 0;
    fit();
    cars.forEach(markCompact);
    aimRig(); placeCars(0, progressNow()); updateClouds(1);
    return track.id;
  }

  /* One car swapped for a bike or a stock car, in place: new meshes on the same lane, rank and
     motion. The old ones are dropped here rather than left to the collector — sixteen vehicles'
     geometry and textures is real memory, and a visitor can try all three in a few seconds. */
  function swapVehicle(c, i) {
    const old = c.g, built = buildVehicle(ride, c.lab, i, paintLogo, sponsors);
    if (confetti.parent === old) built.g.add(confetti);
    scene.remove(old);
    old.traverse((o) => {
      if (!o.isMesh || o.geometry.userData.shared || o.geometry === flameGeo || o.geometry === flameCore
        || o.geometry === streakGeo || o.geometry === ringGeo) return;
      o.geometry.dispose();
      if (o.material.map) { o.material.map.dispose(); o.material.dispose(); }
    });
    /* Everything cached for the old vehicle goes with it. The boost rig was built on its exhausts,
       and the smoke and rubber trails hold one entry per tyre on the ground — a bike's one, a car's
       two — so a car that inherited a bike's list read a tyre that was not there, and threw. */
    c.fx = null; c.markAt = null; c.markD = null; c.puffD = null;
    Object.assign(c, built);
    scene.add(c.g);
  }
  /* Swap the whole field, in waves of four a frame apart like the first roll-out. Building sixteen
     vehicles in one frame is a visible stall — long enough on a phone to look like the page died —
     and the race carries on through the swap, so it reads as the field coming out of the pits
     rather than as a freeze. Nothing else changes: lanes, ranks, camera and motion all carry on. */
  async function setRide(kind) {
    const next = rideKind(kind);
    if (next === ride || swapping) return ride;
    ride = next; swapping = true;
    for (let i = 0; i < cars.length; i += 4) {
      for (let k = i; k < Math.min(i + 4, cars.length); k++) swapVehicle(cars[k], k);
      pickables.length = 0;
      for (const c of cars) pickables.push(...c.meshes);
      if (i + 4 < cars.length) await new Promise((r) => requestAnimationFrame(r));
    }
    swapping = false;
    clearTrails();
    placeCars(0, progressNow());
    return ride;
  }

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    if (mobile() && composer) dropComposer();
    else if (wantComposer && !mobile() && !composer) buildComposer();
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(w, h); }
    // rotating between portrait and landscape changes the spacing: move straight to the new targets
    const orient = w / h < 1 ? 'p' : 'l';
    if (lastRows && lastOrient && orient !== lastOrient) {
      const byId = new Map(lastRows.map((r) => [r.id, r]));
      for (const c of cars) c.toX = targetOf(byId.get(c.lab.id), c.rank);
      packTargets();
      for (const c of cars) { c.x = c.fromX = c.toX; c.prevDistance = raceDistance + c.x; }
    }
    lastOrient = orient;
    fit();
    cars.forEach(markCompact);
    sizeLabels();
  }

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  canvas.addEventListener('pointerdown', (e) => {
    ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const car = ray.intersectObjects(pickables, false)[0];
    if (car) { onSelect(car.object.userData.labId); return; }
    const sign = ray.intersectObjects(env.signs, false)[0];
    const sponsor = sign && sign.object.material.userData.sponsor;
    if (sponsor && sponsor.href) {
      onSponsor(sponsor);
      window.open(withRef(sponsor.href), '_blank', 'noopener');
      return;
    }
    onSelect(null);
  });
  let hoverAt = 0;
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || performance.now() - hoverAt < 90) return;
    hoverAt = performance.now();
    ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const sign = ray.intersectObjects(env.signs, false)[0];
    const carHit = ray.intersectObjects(pickables, false)[0], id = carHit ? carHit.object.userData.labId : null;
    const clickable = (sign && sign.object.material.userData.sponsor && sign.object.material.userData.sponsor.href) || id;
    canvas.style.cursor = clickable ? 'pointer' : '';
    if (id !== hoverId) { hoverId = id; onHover(id); }
  });
  let hoverId = null;
  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);

  /* Layout inspection for tests: true bounding boxes of every car and its label. */
  function measure() {
    camera.updateMatrixWorld();
    const W = innerWidth, H = innerHeight, b3 = new THREE.Box3(), v = new V();
    return cars.map((c) => {
      c.g.updateMatrixWorld(true);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const m of c.meshes) {
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        b3.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
        for (const X of [b3.min.x, b3.max.x]) for (const Y of [b3.min.y, b3.max.y]) for (const Z of [b3.min.z, b3.max.z]) {
          v.set(X, Y, Z).project(camera);
          const sx = (v.x * .5 + .5) * W, sy = (-v.y * .5 + .5) * H;
          x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
        }
      }
      const r = c.el.style.display === 'none' ? null : c.el.getBoundingClientRect();
      v.copy(c.g.position).project(camera);
      return { id: c.lab.id, rank: c.rank, x: c.x, lane: c.lane, body: { x0, x1, y0, y1 },
        label: r && { l: r.left, r: r.right, t: r.top, b: r.bottom }, ox: (v.x * .5 + .5) * W, oy: (-v.y * .5 + .5) * H };
    });
  }
  // settle every car at its target now, with meshes and labels actually moved there
  function snap() {
    cars.forEach((c) => { c.x = c.toX; c.prevDistance = raceDistance + c.x; c.lift = 0; });
    changing = false;
    aimRig(); placeCars(0, 1); updateClouds(1);
  }
  function drawCalls() {
    renderer.info.autoReset = false; renderer.info.reset();
    renderer.render(scene, camera);
    const out = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    renderer.info.autoReset = true;
    return out;
  }

  return {
    setRanking, resize, setTrack, setRide,
    /* 'pack' (two abreast, passing channels) or 'wide' (a lane per lab across the whole road). */
    get formation() { return pack ? 'pack' : 'wide'; },
    setFormation(mode) {
      const next = mode === 'wide' ? false : true;
      if (next === pack) return this.formation;
      pack = next; fanMs = pack ? FAN_MS : 0; tuckMs = pack ? TUCK_MS : 0; accelMs = pack ? PACK_ACCEL_MS : ACCEL_MS;
      fit();
      if (lastRows) setRanking(lastRows); else for (const c of cars) c.lane = c.laneFrom = c.laneBase = c.channel = restLane(c);
      return this.formation;
    },
    /* The hidden studio panel: macro, shutter (seconds of exposure), day/night cycle, hour, timelapse. */
    studio: {
      get() { return { macro: studio.macro, shutter: studio.shutter, cycle: studio.cycle, hour: studio.hour, lapse: studio.lapse, macroOK: !!composer,
        focusAuto: studio.focusAuto, focus: studio.focus, focusNow: +studio.focusNow.toFixed(1) }; },
      set(p = {}) {
        if ('macro' in p) { studio.macro = !!p.macro; applyMacro(); }
        if ('focusAuto' in p) { studio.focusAuto = !!p.focusAuto; if (!studio.focusAuto && !('focus' in p)) studio.focus = studio.focusNow; }
        if ('focus' in p) studio.focus = THREE.MathUtils.clamp(+p.focus || 60, 3, 600);
        if ('shutter' in p) studio.shutter = THREE.MathUtils.clamp(Math.round(+p.shutter * 10) / 10 || 0, 0, 4);
        if ('cycle' in p) studio.cycle = !!p.cycle;
        if ('hour' in p) { studio.hour = ((+p.hour || 0) % 24 + 24) % 24; applyLight(); onClock(studio.hour); }
        if ('lapse' in p) studio.lapse = [1, 4, 8, 16].includes(+p.lapse) ? +p.lapse : 1;
        return this.get();
      }
    },
    /* The field, once race.json has landed. The world is already running by then. */
    /* In waves of four, a frame apart: fourteen vehicles in one frame is a long stall, and cars
       arriving in groups reads as the field rolling out rather than as a page that froze. */
    async setLabs(list) {
      if (cars.length || !list || !list.length) return cars.length;
      for (let i = 0; i < list.length; i += 4) {
        addCars(list.slice(i, i + 4), i);
        if (i + 4 < list.length) await new Promise((r) => requestAnimationFrame(r));
      }
      cars.forEach(markCompact);
      sizeLabels();
      fit();
      wantComposer = true;
      if (!mobile() && !composer) buildComposer();
      aimRig(); placeCars(0, 1);
      return cars.length;
    },
    get carCount() { return cars.length; },
    get firstRenderAt() { return firstRenderAt; },
    setLabels(mode) { labelMode = mode === 'all' || mode === 'off' ? mode : 'top3'; refreshLabels(); return labelMode; },
    get labels() { return labelMode; },
    get trackId() { return track.id; },
    get ride() { return ride; },
    get swapping() { return swapping; },
    /* Where a car and its label are on screen, for annotations drawn by the page. */
    anchorOf(id) {
      const c = cars.find((x) => x.lab.id === id);
      if (!c || !c.on) return null;
      const r = c.el.style.display === 'flex' ? c.el.getBoundingClientRect() : null;
      return { label: r && { x: r.left + r.width / 2, y: r.top, left: r.left, right: r.right, bottom: r.bottom },
        car: c.box && { x: (c.box.l + c.box.r) / 2, y: (c.box.t + c.box.b) / 2 } };
    },
    reveal(id, ms = 3600) { const c = cars.find((x) => x.lab.id === id); if (c) c.revealUntil = performance.now() + ms; },
    highlight(id) { cars.forEach((c) => c.el.classList.toggle('hl', !!id && c.lab.id === id)); },
    setCam(mode, { instant = false } = {}) { const m = setCamMode(mode); if (instant) camBlendStart = -1e9; return m; },
    get cam() { return camMode; },
    follow(id) { followId = id || null; },
    get playbackRate() { return playbackRate; },
    get changing() { return changing; },
    debug: {
      confettiT: () => confetti.userData.t, get packDemand() { return packDemand; }, get lineK() { return Math.max(...cars.map((c) => c.lineK)); }, motion, scene, camera, renderer, cars, VIEW, SHOTS, rig, fit, measure, snap, drawCalls, SPREAD, updateFocus,
      trackPose: (d, l = 0) => { track.frame(d, l, tf); return { x: tf.p.x, y: tf.p.y, z: tf.p.z }; },
      get track() { return track; }, get env() { return env; },
      get shots() { return shots; }, get shotIndex() { return shotIndex; },
      setShot(i) { shotIndex = i; fit(); },
      setDistance(d) { raceDistance = d; for (const c of cars) c.prevDistance = raceDistance + c.x; snap(); },
      get composer() { return composer; }, get raceDistance() { return raceDistance; } }
  };
}
