/* Track geometry for every circuit, as plain maths (no three.js), so it can be checked in
 * Node. Each track maps a distance along its centre line and a lane offset to a frame:
 *   p  position          f  forward (direction of travel)
 *   u  up (road normal)   r  right (= f × u; positive lanes lie this way)
 * frame() writes into objects with x/y/z fields, so THREE.Vector3s can be passed in. */

const set = (o, x, y, z) => { o.x = x; o.y = y; o.z = z; return o; };
const len = (x, y, z) => Math.hypot(x, y, z) || 1;

function crossInto(o, a, b) {
  return set(o, a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}

/* The signed-off circuit: a flat ring around the lake. Identical to the original trackPose. */
export function makeRing(R = 110) {
  return {
    id: 'ring', length: 2 * Math.PI * R, radius: R,
    frame(d, lane, o) {
      const a = d / R, s = Math.sin(a), c = Math.cos(a);
      set(o.f, c, 0, -s); set(o.u, 0, 1, 0); set(o.r, s, 0, c);
      return set(o.p, s * (R + lane), 0, c * (R + lane));
    }
  };
}

/* A full Grand Prix loop: a closed centripetal Catmull-Rom spline, resampled to even arc
   length so distance along it is true distance. Flat, so up is always +y. */
// smoothed until every corner is at least ~73 units in radius (a 42-unit road stays clean on the inside)
export const GP_POINTS = [
  [0, 300], [-190, 290], [-320, 220], [-350, 93], [-318, -16], [-330, -130], [-250, -260], [-90, -290],
  [23, -251], [140, -260], [276, -208], [317, -84], [287, 41], [303, 168], [230, 290]
];
/* Twisty circuit: the same island, laid out like a modern F1 or MotoGP track — a long main straight
   into a hairpin, esses, a fast sweeper, a back straight, a second hairpin, a chicane and a long
   final bend. Fourteen corners both ways round, each at least ~44 units in radius (eased with a
   relaxation pass so the 42-unit road never folds on its inside), sections 120+ units apart. */
export const TWISTY_POINTS = [
  [0, 320], [170, 320], [280, 310], [318, 262], [307, 214], [250, 185], [150, 185], [80, 150], [67, 91], [110, 40],
  [180, 10], [250, -40], [320, -110], [335, -210], [270, -280], [130, -295], [-50, -295], [-190, -285], [-290, -250],
  [-320, -180], [-280, -120], [-222, -87], [-199, -38], [-227, 17], [-308, 53], [-345, 150], [-310, 250], [-200, 315]
];
export function makeGP(points = GP_POINTS, samples = 4096, id = 'gp') {
  let P = points.map(([x, z]) => ({ x, z }));
  // run the same way round as the ring, so +right (where the camera sits) is the outside
  let area = 0;
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; area += a.x * b.z - b.x * a.z; }
  if (area > 0) P = P.reverse();
  const n = P.length, dense = [];
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    const knot = (a, b) => Math.pow(Math.hypot(b.x - a.x, b.z - a.z), .5) || 1e-3;
    const t0 = 0, t1 = t0 + knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
    for (let k = 0; k < 240; k++) {
      const t = t1 + (t2 - t1) * k / 240;
      const lerp = (a, b, ta, tb) => ({ x: (tb - t) / (tb - ta) * a.x + (t - ta) / (tb - ta) * b.x, z: (tb - t) / (tb - ta) * a.z + (t - ta) / (tb - ta) * b.z });
      const A1 = lerp(p0, p1, t0, t1), A2 = lerp(p1, p2, t1, t2), A3 = lerp(p2, p3, t2, t3);
      const B1 = lerp(A1, A2, t0, t2), B2 = lerp(A2, A3, t1, t3);
      dense.push(lerp(B1, B2, t1, t2));
    }
  }
  const cum = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1], b = dense[i % dense.length];
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
  }
  const total = cum[cum.length - 1];
  const xs = new Float64Array(samples), zs = new Float64Array(samples);
  for (let s = 0, j = 0; s < samples; s++) {
    const target = s / samples * total;
    while (cum[j + 1] < target) j++;
    const a = dense[j], b = dense[(j + 1) % dense.length], u = (target - cum[j]) / (cum[j + 1] - cum[j] || 1);
    xs[s] = a.x + (b.x - a.x) * u; zs[s] = a.z + (b.z - a.z) * u;
  }
  const step = total / samples;
  /* Headings are precomputed over a ±8-sample window and interpolated between samples. Taking
     the heading from the nearest samples made it step at every sample boundary (~0.5 units
     apart), and the camera, sitting ~100 units out, turned each step into visible jitter. */
  const W = 8, tx = new Float64Array(samples), tz = new Float64Array(samples);
  for (let s = 0; s < samples; s++) {
    const a = (s - W + samples) % samples, b = (s + W) % samples;
    const dx = xs[b] - xs[a], dz = zs[b] - zs[a], l = Math.hypot(dx, dz) || 1;
    tx[s] = dx / l; tz[s] = dz / l;
  }
  return {
    id, length: total, samples: { xs, zs, step },
    frame(d, lane, o) {
      const q = ((d % total) + total) % total / step, i = Math.floor(q) % samples, j = (i + 1) % samples, u = q - Math.floor(q);
      const x = xs[i] + (xs[j] - xs[i]) * u, z = zs[i] + (zs[j] - zs[i]) * u;
      let fx = tx[i] + (tx[j] - tx[i]) * u, fz = tz[i] + (tz[j] - tz[i]) * u;
      const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
      set(o.f, fx, 0, fz); set(o.u, 0, 1, 0); set(o.r, -fz, 0, fx);    // r = f × u
      return set(o.p, x - fz * lane, 0, z + fx * lane);
    }
  };
}

/* Planet tour: a tilted great circle over a globe of radius Rp centred at the origin, so the
   field drives over the horizon through every latitude. Up is the globe's normal. */
export function makePlanet(Rp = 260, tilt = .42) {
  const A = { x: 1, y: 0, z: 0 }, B = { x: 0, y: Math.cos(tilt), z: Math.sin(tilt) };
  return {
    id: 'planet', length: 2 * Math.PI * Rp, radius: Rp, A, B,
    frame(d, lane, o) {
      const a = d / Rp, s = Math.sin(a), c = Math.cos(a);
      const ux = c * A.x + s * B.x, uy = c * A.y + s * B.y, uz = c * A.z + s * B.z;
      set(o.u, ux, uy, uz);
      set(o.f, -s * A.x + c * B.x, -s * A.y + c * B.y, -s * A.z + c * B.z);
      crossInto(o.r, o.f, o.u);
      // a lane is an offset across the surface: step sideways, then back onto the sphere
      const px = ux * Rp + o.r.x * lane, py = uy * Rp + o.r.y * lane, pz = uz * Rp + o.r.z * lane;
      const k = Rp / len(px, py, pz);
      return set(o.p, px * k, py * k, pz * k);
    }
  };
}

/* Möbius strip: a ring whose road surface makes a half twist per lap. After one lap the
   field is on the other face with the lanes mirrored; after two it is home again. */
export function makeMobius(Rm = 150) {
  return {
    id: 'mobius', length: 4 * Math.PI * Rm, radius: Rm,
    frame(d, lane, o) {
      const a = d / Rm, s = Math.sin(a), c = Math.cos(a), h = a / 2, sh = Math.sin(h), ch = Math.cos(h);
      set(o.f, c, 0, -s);
      set(o.r, ch * s, sh, ch * c);            // across the strip: radial, rotated toward +y by a/2
      set(o.u, -sh * s, ch, -sh * c);          // road normal
      return set(o.p, Rm * s + o.r.x * lane, o.r.y * lane, Rm * c + o.r.z * lane);
    }
  };
}

export const makeTwisty = () => makeGP(TWISTY_POINTS, 4096, 'twisty');
export const makeTrack = (id) => ({ ring: makeRing, gp: makeGP, twisty: makeTwisty, planet: makePlanet, mobius: makeMobius }[id] || makeRing)();
