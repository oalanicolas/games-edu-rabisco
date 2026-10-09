import test from 'node:test';
import assert from 'node:assert/strict';
import { createExperiment, naturalFrequency, ground, stepExperiment, resetMotion, steadyAmplification, GROUND_AMPLITUDE, STEP } from '../src/quake-model.js';
function run(frequency, damping = 0.05) { const s = createExperiment(); s.frequency = frequency; s.damping = damping; s.playing = true; for (let i = 0; i < 4801; i++) stepExperiment(s); return s; }
test('ressonância muda de torre ao mudar apenas a frequência', () => {
  const a = run(1), b = run(naturalFrequency(createExperiment().towers[1]));
  assert.ok(a.towers[0].peak > a.towers[1].peak * 5);
  assert.ok(b.towers[1].peak > b.towers[0].peak * 5);
});
test('integração converge para a resposta analítica do oscilador', () => {
  const s = run(1); const expected = steadyAmplification(1, 1, 0.05);
  assert.ok(Math.abs(s.towers[0].peak / GROUND_AMPLITUDE - expected) < 0.1);
  assert.equal(s.time, 20); assert.equal(s.playing, false);
});
test('amortecimento dissipa resposta e reforço desloca frequência', () => {
  assert.ok(run(1, 0.2).towers[0].peak < run(1).towers[0].peak / 2);
  const t = { floors: 10, braced: false }; const f = naturalFrequency(t); t.braced = true; assert.ok(naturalFrequency(t) > f); t.floors = 14; assert.ok(naturalFrequency(t) < naturalFrequency({ floors: 10, braced: true }));
});
test('pausa, reinício e vibração composta são determinísticos', () => {
  const s = createExperiment(); stepExperiment(s); assert.equal(s.time, 0); s.playing = true; s.mode = 'mixed';
  for (let i = 0; i < 1200; i++) { stepExperiment(s); assert.ok(Math.abs(ground(s).x) <= GROUND_AMPLITUDE + 1e-12); }
  const before = s.towers.map(t => t.x); s.playing = false; stepExperiment(s); assert.deepEqual(s.towers.map(t => t.x), before); resetMotion(s); assert.equal(s.time, 0); assert.ok(s.towers.every(t => t.x === 0 && t.peak === 0));
});
test('impulso e extremos permitidos permanecem finitos', () => {
  for (const mode of ['kick', 'mixed', 'harmonic']) { const s = createExperiment(); s.mode = mode; s.frequency = 9; s.damping = 0.02; s.towers[0].floors = 2; s.towers[0].braced = true; s.playing = true; for (let i = 0; i < 20 / STEP + 1; i++) stepExperiment(s); assert.ok(s.towers.every(t => Number.isFinite(t.x) && Number.isFinite(t.peak))); }
});
