export const LENGTH = 180;
export const WIDTH = 108;
export const SAMPLES = 241;
export const initialState = () => ({ year: 0, flow: 55, sediment: 60, season: 'normal', playing: true, speed: 8, view: 'diorama', labels: true });

export function channelAt(x, state) {
  const energy = state.flow / 100;
  const supply = state.sediment / 100;
  const age = state.year / 300;
  const phase = x * Math.PI / 53 + age * energy * 1.25;
  const amplitude = 20 + age * energy * (5 + 6 * supply);
  const z = Math.sin(phase) * amplitude + 2.8 * Math.sin(x * Math.PI / 27 + .6);
  const slope = Math.cos(phase) * amplitude * Math.PI / 53 + 2.8 * Math.cos(x * Math.PI / 27 + .6) * Math.PI / 27;
  const curvature = -Math.sin(phase) * amplitude * (Math.PI / 53) ** 2 - 2.8 * Math.sin(x * Math.PI / 27 + .6) * (Math.PI / 27) ** 2;
  const width = 13 + energy * 4 + (1 - supply) * age * 3;
  return { x, z, slope, curvature, width };
}

export function bankAt(x, z, state) {
  const center = channelAt(x, state);
  const lateral = (z - center.z) / Math.sqrt(1 + center.slope ** 2);
  const distance = Math.abs(lateral) - center.width / 2;
  const inside = lateral * center.curvature > 0;
  const ripple = .23 * Math.sin(x * .72 + z * .43) + .12 * Math.sin(z * 1.5 - x * .31);
  const shore = inside ? 8 + state.sediment * .075 : 2.1;
  const height = distance < 0 ? -2.8 + 2.3 * Math.exp(distance * .55) : Math.min(1, distance / shore) * (4.6 + ripple);
  const lowland = 1.4 + 1.1 * Math.sin(x * .048 + z * .03) ** 2;
  const floodHeight = state.season === 'flood' ? 3.7 : state.season === 'dry' ? -.25 : 1.1;
  const floodEdge = Math.max(0, 1 - distance / 32);
  const landHeight = height > 1 && distance > 6 ? height - lowland * floodEdge * .36 : height;
  const waterWidth = center.width / 2 + (state.season === 'flood' ? 12 : state.season === 'dry' ? -1.6 : 2.5);
  return { height: landHeight, lateral, distance, inside, flooded: landHeight < floodHeight && Math.abs(lateral) < waterWidth, waterHeight: floodHeight };
}

export function metrics(state) {
  let length = 0;
  let flooded = 0;
  let total = 0;
  let previous = channelAt(-LENGTH / 2, state);
  for (let i = 1; i < SAMPLES; i++) {
    const point = channelAt(-LENGTH / 2 + LENGTH * i / (SAMPLES - 1), state);
    length += Math.hypot(point.x - previous.x, point.z - previous.z);
    previous = point;
  }
  for (let x = -88; x <= 88; x += 4) for (let z = -52; z <= 52; z += 4) {
    const bank = bankAt(x, z, state);
    if (bank.distance > 0) { total++; if (bank.flooded) flooded++; }
  }
  return { sinuosity: length / LENGTH, flooded: Math.round(100 * flooded / total), migration: state.year * state.flow / 100 * (.018 + .012 * state.sediment / 100) };
}

export function advance(state, elapsed) {
  if (!state.playing) return;
  state.year = Math.min(300, state.year + Math.min(elapsed, .1) * state.speed);
  if (state.year >= 300) state.playing = false;
}
