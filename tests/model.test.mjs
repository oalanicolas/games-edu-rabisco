import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, channelAt, bankAt, metrics, advance } from '../src/model.js';

test('a cheia alaga mais várzea que a vazante', () => {
  const dry = metrics({ ...initialState(), season: 'dry' });
  const flood = metrics({ ...initialState(), season: 'flood' });
  assert.ok(flood.flooded > dry.flooded + 10);
});
test('mais corrente acelera a migração e zero sedimento alarga o canal', () => {
  const weak = { ...initialState(), year: 300, flow: 10 };
  const strong = { ...weak, flow: 100 };
  assert.ok(metrics(strong).migration > metrics(weak).migration);
  assert.ok(channelAt(20, { ...strong, sediment: 0 }).width > channelAt(20, { ...strong, sediment: 100 }).width);
});
test('a margem interna tem rampa mais suave que a externa', () => {
  const state = initialState();
  const center = channelAt(26, state);
  const offset = (center.width / 2 + 3) * Math.sqrt(1 + center.slope ** 2);
  const inside = bankAt(26, center.z - offset, state);
  const outside = bankAt(26, center.z + offset, state);
  assert.equal(inside.inside, true);
  assert.equal(outside.inside, false);
  assert.ok(inside.height < outside.height);
});
test('voltar na linha do tempo reproduz a mesma paisagem', () => {
  const state = initialState();
  state.year = 40;
  const earlier = channelAt(12, state);
  state.year = 220;
  assert.notDeepEqual(channelAt(12, state), earlier);
  state.year = 40;
  assert.deepEqual(channelAt(12, state), earlier);
});
test('pausa congela o ano, reset restaura o estado e o relógio termina em 300', () => {
  const state = initialState();
  advance(state, .1);
  assert.ok(state.year > 0);
  state.playing = false;
  const paused = state.year;
  advance(state, .1);
  assert.equal(state.year, paused);
  Object.assign(state, initialState(), { year: 299.9, speed: 24 });
  advance(state, .1);
  assert.equal(state.year, 300);
  assert.equal(state.playing, false);
  Object.assign(state, initialState());
  assert.equal(state.year, 0);
});
