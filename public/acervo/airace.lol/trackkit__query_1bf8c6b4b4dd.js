/* Circuit-building kit for any track shape. Everything is placed through track.frame(), so the
 * same code lays a road on a flat Grand Prix loop, over a planet, or along a Möbius strip. */
import * as THREE from 'three';
import { V, mat, mesh, box, canvasTexture, fitFont } from './kit.js?v=f731741466';

export const frameObj = () => ({ p: new V(), f: new V(), u: new V(), r: new V() });
const basis = new THREE.Matrix4();

/* A surface strip between two lane offsets, raised `y` along the road normal. `uvScale` sets
   how many units of track one texture repeat covers. */
export function stripGeometry(track, { from = 0, to = track.length, laneA, laneB, y = 0, step = 2, cross = 1, uvScale = 5 }) {
  const F = frameObj(), segs = Math.max(8, Math.round((to - from) / step)), row = cross + 1;
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const d = from + (to - from) * i / segs;
    for (let c = 0; c <= cross; c++) {
      const lane = laneA + (laneB - laneA) * c / cross;
      track.frame(d, lane, F);
      pos.push(F.p.x + F.u.x * y, F.p.y + F.u.y * y, F.p.z + F.u.z * y);
      nor.push(F.u.x, F.u.y, F.u.z);
      uv.push(c / cross, d / uvScale);
    }
    if (i < segs) for (let c = 0; c < cross; c++) {
      const k = i * row + c;
      // counter-clockwise seen from +up (lane→ then along→): the front face looks up the road normal
      idx.push(k, k + 1, k + row, k + 1, k + row + 1, k + row);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

let roadMats = null;
function roadMaterials() {
  if (roadMats) return roadMats;
  const asphalt = canvasTexture(512, 512, (x) => {
    let s2 = 991; const r2 = () => { s2 = (s2 * 1664525 + 1013904223) >>> 0; return s2 / 4294967296; };
    x.fillStyle = '#727b87'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 34000; i++) {
      const v = Math.floor(94 + r2() * 70);
      x.fillStyle = `rgba(${v},${v},${v + 7},${.05 + r2() * .19})`;
      x.fillRect(r2() * 512, r2() * 512, .3 + r2(), .3 + r2());
    }
  });
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
  const curb = canvasTexture(8, 128, (x) => {
    x.fillStyle = '#f16d73'; x.fillRect(0, 0, 8, 64); x.fillStyle = '#fff7e8'; x.fillRect(0, 64, 8, 64);
  });
  curb.wrapS = curb.wrapT = THREE.RepeatWrapping;
  const side = THREE.DoubleSide;
  roadMats = {
    road: new THREE.MeshStandardMaterial({ map: asphalt, color: '#cbd0d8', roughness: .94, side }),
    apron: new THREE.MeshStandardMaterial({ color: '#eee8d7', roughness: .9, flatShading: true, side }),
    curb: new THREE.MeshStandardMaterial({ map: curb, roughness: .9, side,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    line: new THREE.MeshStandardMaterial({ color: '#fff8ec', roughness: .85, side,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })
  };
  return roadMats;
}

/* Road, apron, curbs, edge lines, guardrails and posts. `span` is how much track the surface
   covers (half a Möbius lap already covers both faces). */
export function buildRoad(world, track, { span = track.length, rails = true, mobius = false } = {}) {
  const M = roadMaterials(), add = (g, m) => { const o = new THREE.Mesh(g, m); o.receiveShadow = true; world.add(o); return o; };
  /* On a Möbius strip half a lap of double-sided road already covers both faces, and anything
     laid "under" the road on one face would sit on top of it on the other. So the apron is
     only the two edge strips, and curbs and lines run both laps (the second lap's frames put
     them on the other face). */
  const surface = mobius ? track.length / 2 : span, trim = mobius ? track.length : span;
  if (mobius) {
    add(stripGeometry(track, { to: surface, laneA: -22.3, laneB: -21.2, y: 0, step: 3 }), M.apron);
    add(stripGeometry(track, { to: surface, laneA: 21.2, laneB: 22.3, y: 0, step: 3 }), M.apron);
  } else {
    add(stripGeometry(track, { to: span, laneA: -22.3, laneB: 22.3, y: -.12, step: 3 }), M.apron);
  }
  add(stripGeometry(track, { to: surface, laneA: -21.2, laneB: 21.2, y: 0, step: 2, cross: 8, uvScale: 5 }), M.road)
    .material.map.repeat.set(3, 1);
  for (const side of [-1, 1]) {
    const cg = stripGeometry(track, { to: trim, laneA: side * 21.7 - .56, laneB: side * 21.7 + .56, y: .03, step: 2, uvScale: 4.4 });
    add(cg, M.curb);
    add(stripGeometry(track, { to: trim, laneA: side * 21.05 - .085, laneB: side * 21.05 + .085, y: .035, step: 2 }), M.line);
  }
  if (!rails) return;
  const F = frameObj(), railMat = mat('#bcc4c4', .5, .4);
  for (const side of [-1, 1]) {
    for (const h of [.55, .92]) {
      const pts = [];
      for (let d = 0; d < track.length; d += 4) { track.frame(d, side * 23.3, F); pts.push(F.p.clone().addScaledVector(F.u, h)); }
      const curve = new THREE.CatmullRomCurve3(pts, true);
      mesh(world, new THREE.TubeGeometry(curve, pts.length * 2, .105, 5, true), railMat).castShadow = false;
    }
  }
  const count = Math.floor(track.length / 13.6) * 2;
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(.17, 1.4, .2), mat('#a4b0b3', .85), count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1;
    track.frame(Math.floor(i / 2) * 13.6, side * 23.3, F);
    dummy.position.copy(F.p).addScaledVector(F.u, .6);
    dummy.quaternion.setFromRotationMatrix(basis.makeBasis(F.f, F.u, F.r));
    dummy.updateMatrix(); posts.setMatrixAt(i, dummy.matrix);
  }
  posts.castShadow = true; posts.receiveShadow = true; world.add(posts);
}

/* One material per sponsor; merged faces stay clickable through material.userData.sponsor. */
export function signMaterials(sponsors) {
  return sponsors.map((sp) => Object.assign(new THREE.MeshStandardMaterial({ roughness: .8,
    map: canvasTexture(1024, 194, (x, w, h) => {
      x.fillStyle = sp.bg || '#f6f1e8'; x.fillRect(0, 0, w, h);
      if (sp.accent) { x.fillStyle = sp.accent; x.fillRect(0, h - 16, w, 16); }
      if (sp.img && sp.img.naturalWidth) {
        // a sponsor's own artwork, fitted inside the board with a margin
        const k = Math.min(w * .86 / sp.img.naturalWidth, h * .74 / sp.img.naturalHeight);
        const iw = sp.img.naturalWidth * k, ih = sp.img.naturalHeight * k;
        x.drawImage(sp.img, (w - iw) / 2, (h - 16 - ih) / 2 + 2, iw, ih);
        return;
      }
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = sp.fg || '#252b3e';
      fitFont(x, sp.text, 700, 150, 96, w * .9);
      x.fillText(sp.text, w / 2, h * .48, w * .92);
    }) }), { userData: { sponsor: sp } }));
}

/* How sharply the track turns around distance d (radians of heading change over ±span). */
export function turnAt(track, d, span = 12) {
  const a = frameObj(), b = frameObj();
  track.frame(d - span, 0, a); track.frame(d + span, 0, b);
  return Math.acos(Math.max(-1, Math.min(1, a.f.dot(b.f))));
}

/* Sponsor boards along the track: upright hoardings on the infield (lane -25) and low boards
   tilted toward the lens on the outer verge (lane +25.5), both facing the camera side (+r).
   Only on straights, where a flat board sits true to the road. Returns face records. */
export function addBoards(world, track, sponsors, { spacing = 46, span = track.length, maxTurn = .16 } = {}) {
  const faces = [];
  if (!sponsors.length) return faces;
  const mats = signMaterials(sponsors), F = frameObj();
  let k = 0;
  for (let d = spacing / 2; d < span; d += spacing, k++) {
    if (turnAt(track, d) > maxTurn) continue;
    // infield hoarding
    track.frame(d, -25, F);
    const g = new THREE.Group();
    g.position.copy(F.p); g.quaternion.setFromRotationMatrix(basis.makeBasis(F.f, F.u, F.r)); world.add(g);
    box(g, 20.3, 4, .3, 0, 2.6, 0, '#7c898c', .85);
    const face = mesh(g, new THREE.PlaneGeometry(20, 3.8), mats[k % mats.length], 0, 2.6, .16);
    face.castShadow = false; faces.push({ face, half: 10, halfH: 1.9 });
    box(g, .16, 4.8, .18, -10.15, 2, 0, '#a9b5b7', .85); box(g, .16, 4.8, .18, 10.15, 2, 0, '#a9b5b7', .85);
    // outer verge, half a spacing on, tilted back toward the camera
    const d2 = d + spacing / 2;
    if (d2 >= span || turnAt(track, d2) > maxTurn) continue;
    track.frame(d2, 25.5, F);
    const o = new THREE.Group();
    o.position.copy(F.p); o.quaternion.setFromRotationMatrix(basis.makeBasis(F.f, F.u, F.r)); world.add(o);
    const tilt = new THREE.Group(); tilt.position.set(0, .35, 0); tilt.rotation.x = -.9; o.add(tilt);
    box(tilt, 16.3, 3.2, .25, 0, 1.6, -.14, '#7c898c', .85);
    const face2 = mesh(tilt, new THREE.PlaneGeometry(16, 3), mats[(k + 3) % mats.length], 0, 1.6, .01);
    face2.castShadow = false; faces.push({ face: face2, half: 8, halfH: 1.5 });
    box(o, .16, 1.2, .18, -7, .1, .3, '#a9b5b7', .85); box(o, .16, 1.2, .18, 7, .1, .3, '#a9b5b7', .85);
  }
  return faces;
}

/* Board face records -> world-space descriptors used by the camera's sponsor check. */
export function describeBoards(world, faces) {
  world.updateMatrixWorld(true);
  return faces.map(({ face, half, halfH }) => ({
    c: face.getWorldPosition(new V()), half, halfH,
    t: new V(1, 0, 0).transformDirection(face.matrixWorld),
    u: new V(0, 1, 0).transformDirection(face.matrixWorld),
    n: new V(0, 0, 1).transformDirection(face.matrixWorld)
  }));
}

/* Two-tier low-poly conifers, instanced. `spots` = [{ p: Vector3, up: Vector3, scale }]. */
export function conifers(world, spots, colors = ['#789837', '#8aa638', '#638b37', '#98af48', '#709749', '#9cb341']) {
  const n = spots.length;
  if (!n) return;
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.14, .21, 1.7, 5), mat('#817046'), n);
  const tops = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 3.2, 5), mat('#ffffff'), n);
  const upper = new THREE.InstancedMesh(new THREE.ConeGeometry(.77, 2.7, 5), mat('#ffffff'), n);
  const q = new THREE.Quaternion(), yUp = new V(0, 1, 0), spin = new THREE.Quaternion(), m4 = new THREE.Matrix4(), s = new V(), p = new V();
  spots.forEach((t, i) => {
    q.setFromUnitVectors(yUp, t.up).multiply(spin.setFromAxisAngle(yUp, (i * 2.399) % 6.28));
    s.setScalar(t.scale);
    m4.compose(p.copy(t.p).addScaledVector(t.up, .6 * t.scale), q, s); trunks.setMatrixAt(i, m4);
    m4.compose(p.copy(t.p).addScaledVector(t.up, 2.3 * t.scale), q, s); tops.setMatrixAt(i, m4);
    m4.compose(p.copy(t.p).addScaledVector(t.up, 3.8 * t.scale), q, s); upper.setMatrixAt(i, m4);
    const c = new THREE.Color(colors[i % colors.length]);
    tops.setColorAt(i, c); upper.setColorAt(i, c.clone().multiplyScalar(1.07));
  });
  for (const o of [trunks, tops, upper]) { o.castShadow = true; o.receiveShadow = true; world.add(o); }
}

/* A faceted peak with a snow cap, standing on `up` at `base`. */
const peakMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
export function mountain(world, base, up, r, h, color, rand = Math.random) {
  const n = 7, verts = [], cols = [], c = new THREE.Color(color), snow = new THREE.Color('#fff8f4');
  const range = (a, b) => a + (b - a) * rand();
  const pts = Array.from({ length: n }, (_, i) => [Math.cos(i / n * Math.PI * 2) * r * range(.8, 1.2), Math.sin(i / n * Math.PI * 2) * r * range(.7, 1.1)]);
  for (let j = 0; j < n; j++) {
    const a = pts[j], b = pts[(j + 1) % n], cut = range(.6, .77), cut2 = range(.6, .77);
    const A = [a[0], 0, a[1]], B = [b[0], 0, b[1]], C = [a[0] * (1 - cut), h * cut, a[1] * (1 - cut)];
    const D = [b[0] * (1 - cut2), h * cut2, b[1] * (1 - cut2)], peak = [0, h, 0];
    for (const [tri, col] of [[[A, C, B], c], [[C, D, B], c], [[C, peak, D], snow]]) {
      const shade = col.clone().multiplyScalar(range(.8, 1.09));
      for (const p of tri) { verts.push(...p); cols.push(shade.r, shade.g, shade.b); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  const o = mesh(world, g, peakMat);
  o.position.copy(base); o.quaternion.setFromUnitVectors(new V(0, 1, 0), up.clone().normalize());
  return o;
}

/* Clouds for a whole world as one instanced mesh, so each can be faded out on its own when it
   drifts near the lens or in front of the pack. add() lumps a cloud along `up`; addCluster()
   takes explicit lumps ({ o: local offset, r: radius }) for worlds with hand-placed clouds. */
export function cloudField() {
  const items = [], yUp = new V(0, 1, 0);
  let inst = null;
  const m4 = new THREE.Matrix4(), s3 = new V(), p3 = new V(), q1 = new THREE.Quaternion();
  const field = {
    items,
    addCluster(p, up, lumps) {
      const q = new THREE.Quaternion().setFromUnitVectors(yUp, up.clone().normalize());
      const mid = lumps.reduce((a, l) => a.add(l.o), new V()).multiplyScalar(1 / lumps.length);
      const radius = Math.max(...lumps.map((l) => l.o.distanceTo(mid) + l.r * 1.1));
      items.push({ p: p.clone(), q, lumps, mid, radius, centre: mid.clone().applyQuaternion(q).add(p), k: 1 });
    },
    add(p, up, size = 5, rand = Math.random) {
      const lumps = [];
      for (let j = 0; j < 4; j++) {
        const r = size * (.7 + rand() * .6);
        lumps.push({ o: new V(j * size * 1.1, (rand() - .5) * size * .4, 0), r });
      }
      field.addCluster(p, up, lumps);
    },
    build(world) {
      const count = items.reduce((n, it) => n + it.lumps.length, 0);
      if (!count) return null;
      inst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat('#fffaf4'), count);
      inst.castShadow = false; inst.receiveShadow = true;
      world.add(inst); field.apply();
      return inst;
    },
    apply() {
      if (!inst) return;
      let n = 0;
      for (const it of items) {
        for (const l of it.lumps) {
          // shrink toward the cloud's middle as k falls to 0
          p3.copy(l.o).sub(it.mid).multiplyScalar(it.k).add(it.mid).applyQuaternion(it.q).add(it.p);
          s3.set(1.1 * l.r * it.k, .65 * l.r * it.k, .8 * l.r * it.k);
          inst.setMatrixAt(n++, m4.compose(p3, it.q, s3));
        }
      }
      inst.instanceMatrix.needsUpdate = true;
    }
  };
  return field;
}
