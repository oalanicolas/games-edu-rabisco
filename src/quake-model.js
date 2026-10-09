export const STEP = 1 / 240;
export const DURATION = 20;
export const GROUND_AMPLITUDE = 0.08;

export function createExperiment() {
  return { time: 0, frequency: 1, damping: 0.05, mode: 'harmonic', playing: false, towers: [
    { floors: 10, braced: false, x: 0, velocity: 0, peak: 0 },
    { floors: 4, braced: true, x: 0, velocity: 0, peak: 0 }
  ] };
}

export const naturalFrequency = tower => 10 / tower.floors * Math.sqrt(tower.braced ? 3 : 1);
export function resetMotion(state) {
  state.time = 0;
  state.towers.forEach(t => { t.x = 0; t.velocity = 0; t.peak = 0; });
}

export function ground(state, time = state.time) {
  if (state.mode === 'kick') {
    const omega = Math.PI / 0.4;
    if (time > 0.4) return { x: 0, acceleration: 0 };
    return { x: GROUND_AMPLITUDE * Math.sin(omega * time) ** 2, acceleration: 2 * GROUND_AMPLITUDE * omega ** 2 * Math.cos(2 * omega * time) };
  }
  const ramp = Math.PI / 2;
  const envelope = time < 2 ? (1 - Math.cos(ramp * time)) / 2 : 1;
  const slope = time < 2 ? ramp * Math.sin(ramp * time) / 2 : 0;
  const curvature = time < 2 ? ramp ** 2 * Math.cos(ramp * time) / 2 : 0;
  const waves = state.mode === 'mixed' ? [[0.65, 0.4], [1.4, 0.3], [2.8, 0.2], [4.4, 0.1]] : [[state.frequency, 1]];
  let x = 0, acceleration = 0;
  for (const [frequency, weight] of waves) {
    const omega = 2 * Math.PI * frequency;
    const amplitude = GROUND_AMPLITUDE * weight;
    x += amplitude * envelope * Math.sin(omega * time);
    acceleration += amplitude * ((curvature - envelope * omega ** 2) * Math.sin(omega * time) + 2 * slope * omega * Math.cos(omega * time));
  }
  return { x, acceleration };
}

export function stepExperiment(state, dt = STEP) {
  if (!state.playing) return;
  dt = Math.min(dt, DURATION - state.time);
  for (const tower of state.towers) {
    const omega = 2 * Math.PI * naturalFrequency(tower);
    const derivative = (x, velocity, time) => [velocity, -omega * omega * x - 2 * state.damping * omega * velocity - ground(state, time).acceleration];
    const a = derivative(tower.x, tower.velocity, state.time);
    const b = derivative(tower.x + a[0] * dt / 2, tower.velocity + a[1] * dt / 2, state.time + dt / 2);
    const c = derivative(tower.x + b[0] * dt / 2, tower.velocity + b[1] * dt / 2, state.time + dt / 2);
    const d = derivative(tower.x + c[0] * dt, tower.velocity + c[1] * dt, state.time + dt);
    tower.x += dt / 6 * (a[0] + 2 * b[0] + 2 * c[0] + d[0]);
    tower.velocity += dt / 6 * (a[1] + 2 * b[1] + 2 * c[1] + d[1]);
    tower.peak = Math.max(tower.peak, Math.abs(tower.x));
  }
  state.time = Math.min(DURATION, state.time + dt);
  if (state.time >= DURATION - 1e-9) { state.time = DURATION; state.playing = false; }
}

export function steadyAmplification(frequency, natural, damping) {
  const ratio = frequency / natural;
  return ratio ** 2 / Math.hypot(1 - ratio ** 2, 2 * damping * ratio);
}
