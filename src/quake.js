import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createExperiment, naturalFrequency, ground, stepExperiment, resetMotion, steadyAmplification, STEP, DURATION, GROUND_AMPLITUDE } from './quake-model.js';

const state = createExperiment();
const $ = id => document.getElementById(id);
const format = (value, digits = 2) => value.toFixed(digits).replace('.', ',');
const status = message => { $('quake-status').textContent = message; };
const stage = $('quake-stage');
const STORAGE = 'geografia-terremotos-records';
const names = { harmonic: 'Ritmo constante', mixed: 'Composta', kick: 'Impulso' };
let renderer, scene, camera, orbit, table, buildings = [], accumulator = 0, previous = 0, history = [], view = 'perspective';

function chart() {
  for (const [index, id] of ['curve-a', 'curve-b'].entries()) {
    const points = Array.from({ length: 400 }, (_, i) => {
      const frequency = 0.3 + i / 399 * 8.7;
      const response = steadyAmplification(frequency, naturalFrequency(state.towers[index]), state.damping);
      return `${i ? 'L' : 'M'}${(35 + i / 399 * 545).toFixed(2)},${(105 - Math.min(26, response) / 26 * 90).toFixed(2)}`;
    });
    $(id).setAttribute('d', points.join(' '));
  }
  const marker = 35 + (state.frequency - 0.3) / 8.7 * 545;
  $('frequency-marker').setAttribute('d', `M${marker},12V105`);
  $('frequency-marker').style.display = state.mode === 'harmonic' ? '' : 'none';
}

function sync() {
  $('quake-frequency').value = state.frequency;
  $('frequency-value').textContent = state.mode === 'harmonic' ? `${format(state.frequency)} Hz` : names[state.mode];
  $('quake-frequency').disabled = state.mode !== 'harmonic';
  $('quake-play').textContent = state.playing ? 'Pausar vibração' : state.time >= DURATION ? 'Repetir ensaio' : 'Iniciar vibração';
  for (const [index, letter] of ['a', 'b'].entries()) {
    const t = state.towers[index];
    $(`freq-${letter}`).textContent = `${format(naturalFrequency(t))} Hz`;
    $(`floors-${letter}-value`).textContent = t.floors;
    $(`peak-${letter}`).textContent = `${format(t.peak / GROUND_AMPLITUDE)}×`;
  }
  $('quake-time').textContent = `${format(state.time, 1)} / 20 s`;
  $('damping-value').textContent = `${Math.round(state.damping * 100)}%`;
}

function readRecords() {
  let records = [];
  try { records = JSON.parse(sessionStorage.getItem(STORAGE) || '[]'); } catch {}
  return Array.isArray(records) ? records.filter(r => r && typeof r === 'object' && ['harmonic', 'mixed', 'kick'].includes(r.mode) && ['time', 'frequency', 'damping'].every(k => Number.isFinite(r[k])) && Array.isArray(r.towers) && r.towers.length === 2 && r.towers.every(t => t && typeof t === 'object' && ['floors', 'peak'].every(k => Number.isFinite(t[k])) && typeof t.braced === 'boolean')).slice(-12) : [];
}

function renderRecords() {
  const container = $('quake-records'); container.replaceChildren();
  if (!history.length) { container.textContent = 'Nenhum registro ainda. Faça um ensaio e use “Registrar observação”.'; return; }
  const wrap = document.createElement('div'); wrap.className = 'records-wrap';
  const records = document.createElement('table'); records.className = 'records-table';
  records.createCaption().textContent = 'Ensaios do modelo — amplitude da mesa fixa';
  const header = records.createTHead().insertRow();
  for (const label of ['Excitação', 'Tempo / s', 'Ritmo / Hz', 'Amort. / %', 'A: andares / X', 'B: andares / X', 'Pico A / mesa', 'Pico B / mesa']) {
    const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; header.append(th);
  }
  const body = records.createTBody();
  for (const r of history) {
    const row = body.insertRow();
    const towers = r.towers.map(t => `${t.floors} / ${t.braced ? 'sim' : 'não'}`);
    for (const value of [names[r.mode], format(r.time, 1), r.mode === 'harmonic' ? format(r.frequency) : '—', Math.round(r.damping * 100), ...towers, ...r.towers.map(t => `${format(t.peak / GROUND_AMPLITUDE)}×`)]) row.insertCell().textContent = value;
  }
  wrap.append(records); container.append(wrap);
}

function restart(playing = false) {
  resetMotion(state); state.playing = playing; accumulator = 0;
  chart(); sync();
}

for (const [index, letter] of ['a', 'b'].entries()) {
  $(`floors-${letter}`).addEventListener('input', event => { state.towers[index].floors = Number(event.target.value); rebuild(); restart(); status('Altura alterada. Ensaio reiniciado e pausado.'); });
  $(`brace-${letter}`).addEventListener('change', event => { state.towers[index].braced = event.target.checked; rebuild(); restart(); status('Reforços alterados. Ensaio reiniciado e pausado.'); });
  $(`drive-${letter}`).addEventListener('click', () => { state.frequency = naturalFrequency(state.towers[index]); state.mode = 'harmonic'; restart(true); status(`Ensaio iniciado no ritmo natural da torre ${letter.toUpperCase()}. Aguarde 20 s para comparar.`); });
}
$('quake-frequency').addEventListener('input', event => { state.frequency = Number(event.target.value); state.mode = 'harmonic'; restart(); status('Ritmo alterado. Ensaio reiniciado e pausado.'); });
$('quake-damping').addEventListener('input', event => { state.damping = Number(event.target.value) / 100; restart(); status('Amortecimento alterado. Ensaio reiniciado e pausado.'); });
for (const mode of ['mixed', 'kick']) $('drive-' + mode).addEventListener('click', () => { state.mode = mode; restart(true); status(`${names[mode]}: ensaio iniciado. Entrada sintética, sem dados de um sismo real.`); });
$('quake-play').addEventListener('click', () => { if (state.time >= DURATION) restart(true); else state.playing = !state.playing; sync(); status(state.playing ? 'Ensaio em andamento. Você pode pausar.' : 'Ensaio pausado. Picos preservados.'); });
$('quake-reset').addEventListener('click', () => { restart(); status('Ensaio reiniciado e pausado. Configurações preservadas.'); });
$('quake-record').addEventListener('click', () => {
  if (!state.time) { status('Inicie um ensaio antes de registrar.'); return; }
  history.push({ mode: state.mode, time: state.time, frequency: state.frequency, damping: state.damping, towers: state.towers.map(t => ({ floors: t.floors, braced: t.braced, peak: t.peak })) });
  history = history.slice(-12);
  let stored = true;
  try { sessionStorage.setItem(STORAGE, JSON.stringify(history)); } catch { stored = false; }
  renderRecords(); status(`Observação registrada em ${format(state.time, 1)} s.${stored ? '' : ' Armazenamento indisponível: copie a tabela antes de sair.'}`);
});
$('quake-clear').addEventListener('click', () => { history = []; try { sessionStorage.removeItem(STORAGE); } catch {} renderRecords(); status('Registros desta aba apagados.'); });

function material(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.76, ...extra }); }
const ink = material(0x182998), paper = material(0xfff9e4), red = material(0xb84442), dark = material(0x344764), wood = material(0xab8b5c), steel = material(0x737d9b, { metalness: 0.5, roughness: 0.35 }), glass = material(0x8cbbc0, { metalness: 0.25, roughness: 0.25 }), glow = material(0xffd687, { emissive: 0xffb749, emissiveIntensity: 0.35 });
const outline = new THREE.LineBasicMaterial({ color: 0x263c86, transparent: true, opacity: 0.72 });
function box(parent, size, position, mat, edges = true) {
  const geometry = new THREE.BoxGeometry(...size); const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true;
  if (edges) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), outline));
  parent.add(mesh); return mesh;
}
function rod(parent, a, b, radius, mat) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 8), mat); mesh.position.copy(start).add(end).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); mesh.castShadow = true; parent.add(mesh); return mesh;
}
function label(parent, text, position, color = '#182998', width = 2.2) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 160;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff9e4'; ctx.fillRect(0, 0, 512, 160); ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.strokeRect(5, 5, 502, 150); ctx.fillStyle = color; ctx.font = '600 82px Caveat'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 87);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 160 / 512), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })); mesh.position.set(...position); parent.add(mesh);
}
function makeBuilding(index) {
  const config = state.towers[index], group = new THREE.Group(), levels = [], center = index ? 3.15 : -3.15, trim = index ? ink : red;
  group.position.x = center; table.add(group);
  box(group, [3, 0.16, 2.75], [0, 0.08, 0], paper);
  box(group, [3.15, 0.1, 2.9], [0, 0.01, 0], wood);
  for (let i = 0; i < config.floors; i++) {
    const floor = new THREE.Group(); floor.position.y = 0.18 + i * 0.48; group.add(floor); levels.push(floor);
    box(floor, [2.12, 0.44, 1.85], [0, 0.24, 0], paper);
    box(floor, [2.3, 0.075, 2.05], [0, 0.025, 0], trim);
    for (const z of [-0.94, 0.94]) {
      for (let j = 0; j < 5; j++) {
        box(floor, [0.29, 0.27, 0.018], [-0.8 + j * 0.4, 0.25, z], (i * 5 + j + index) % 4 === 0 ? glow : glass, false);
        box(floor, [0.025, 0.3, 0.038], [-0.98 + j * 0.4, 0.25, z], trim, false);
      }
      box(floor, [2.05, 0.027, 0.03], [0, 0.39, z], trim, false);
      if (config.braced) {
        rod(floor, [-1.09, 0.065, z * 1.06], [1.09, 0.455, z * 1.06], 0.033, dark);
        rod(floor, [1.09, 0.065, z * 1.06], [-1.09, 0.455, z * 1.06], 0.033, dark);
      }
    }
    for (const side of [-1, 1]) {
      for (const z of [-0.6, 0, 0.6]) box(floor, [0.025, 0.28, 0.38], [side * 1.07, 0.25, z], glass, false);
      box(floor, [0.09, 0.43, 0.09], [side * 1.05, 0.24, 0.89], trim);
      box(floor, [0.09, 0.43, 0.09], [side * 1.05, 0.24, -0.89], trim);
    }
  }
  const roof = new THREE.Group(); roof.position.y = 0.18 + config.floors * 0.48; group.add(roof);
  box(roof, [2.35, 0.09, 2.08], [0, 0.01, 0], paper);
  box(roof, [0.65, 0.3, 0.65], [0.45, 0.2, -0.35], steel);
  box(roof, [0.9, 0.24, 0.48], [-0.55, 0.17, 0.35], paper);
  rod(roof, [0.6, 0.25, -0.5], [0.6, 0.85, -0.5], 0.025, dark);
  label(roof, `TORRE ${index ? 'B' : 'A'}`, [0, 0.9, 0], index ? '#182998' : '#b84442', 1.65);
  for (const x of [-1.3, 1.3]) for (const z of [-1, 1]) {
    const plant = new THREE.Group(); plant.position.set(x, 0.18, z); group.add(plant);
    rod(plant, [0, 0, 0], [0, 0.4, 0], 0.035, wood);
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(0.21, 1), material(0x699468)); canopy.position.y = 0.43; canopy.castShadow = true; plant.add(canopy);
  }
  label(group, index ? 'B / REFORÇOS?' : 'A / RITMO?', [0, 0.12, 1.48], index ? '#182998' : '#b84442', 2.25);
  return { group, levels, roof };
}

function rebuild() {
  if (!renderer) return;
  buildings.forEach(b => { table.remove(b.group); b.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material?.map) { o.material.map.dispose(); o.material.dispose(); } }); });
  buildings = [makeBuilding(0), makeBuilding(1)];
}
function setView(selected) {
  view = selected;
  if (camera) { camera.position.set(...(view === 'front' ? [0, 4.7, 19.5] : [10, 8.2, 17.5])); orbit.target.set(0, 2.3, 0); orbit.update(); }
  $('view-front').setAttribute('aria-pressed', view === 'front'); $('view-perspective').setAttribute('aria-pressed', view === 'perspective');
}
$('view-front').addEventListener('click', () => setView('front'));
$('view-perspective').addEventListener('click', () => setView('perspective'));

function buildScene() {
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); } catch {
    $('quake-loading').textContent = 'Cena 3D indisponível neste navegador. Use os controles, os picos textuais, o mapa e a ficha para investigar.';
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  stage.prepend(renderer.domElement); $('quake-loading').hidden = true;
  scene = new THREE.Scene(); scene.background = new THREE.Color(0xebe9dc); scene.fog = new THREE.Fog(0xebe9dc, 27, 55);
  camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100); orbit = new OrbitControls(camera, renderer.domElement); orbit.enableDamping = true; orbit.minDistance = 10; orbit.maxDistance = 26; orbit.maxPolarAngle = Math.PI * 0.49; orbit.enablePan = false;
  scene.add(new THREE.HemisphereLight(0xfff8df, 0x8093b0, 2.2));
  const sun = new THREE.DirectionalLight(0xffefcb, 3.2); sun.position.set(-5, 13, 8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -9 }); sun.shadow.bias = -0.0005; scene.add(sun);
  const rim = new THREE.DirectionalLight(0x9bafef, 1.4); rim.position.set(8, 9, -6); scene.add(rim);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), material(0xeae6d7)); plane.rotation.x = -Math.PI / 2; plane.position.y = -1.75; plane.receiveShadow = true; scene.add(plane);
  const grid = new THREE.GridHelper(60, 60, 0xa6aec0, 0xc6c8c4); grid.position.y = -1.744; scene.add(grid);
  const chassis = new THREE.Group(); scene.add(chassis);
  box(chassis, [11.8, 0.24, 5], [0, -1.53, 0], dark);
  box(chassis, [11.4, 0.13, 4.8], [0, -1.34, 0], wood);
  for (const x of [-5, 5]) { box(chassis, [0.9, 1.1, 3], [x, -0.73, 0], paper); box(chassis, [0.96, 0.08, 3.1], [x, -0.16, 0], ink); }
  rod(chassis, [-5, -0.72, 1.9], [5, -0.72, 1.9], 0.07, steel);
  box(chassis, [2.15, 0.45, 0.65], [0, -0.72, 1.9], dark);
  for (const sign of [-1, 1]) {
    const points = Array.from({ length: 241 }, (_, i) => new THREE.Vector3(sign * (1.2 + i / 240 * 3.1), -0.72 + Math.sin(i / 240 * Math.PI * 16) * 0.2, 1.9 + Math.cos(i / 240 * Math.PI * 16) * 0.2));
    const spring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 240, 0.024, 6, false), steel); spring.castShadow = true; chassis.add(spring);
  }
  label(chassis, 'MESA DE VIBRAÇÃO', [0, -1.49, 2.54], '#182998', 3.2);
  table = new THREE.Group(); scene.add(table);
  box(table, [10.8, 0.22, 4.35], [0, -0.16, 0], paper); box(table, [11, 0.07, 4.5], [0, -0.04, 0], ink);
  for (const x of [-4.7, 4.7]) for (const z of [-1.8, 1.8]) box(table, [0.12, 0.05, 0.12], [x, 0.02, z], steel, false);
  rebuild(); setView('perspective');
  new ResizeObserver(() => { if (stage.clientWidth) { renderer.setSize(stage.clientWidth, stage.clientHeight, false); camera.aspect = stage.clientWidth / stage.clientHeight; camera.zoom = Math.min(1, camera.aspect / 1.15); camera.updateProjectionMatrix(); } }).observe(stage);
}

function frame(timestamp) {
  requestAnimationFrame(frame);
  const delta = Math.min(0.1, previous ? (timestamp - previous) / 1000 : 0); previous = timestamp;
  if (state.playing && !document.hidden && !document.querySelector('#atividades').hidden) {
    accumulator += delta;
    while (accumulator >= STEP && state.playing) { stepExperiment(state); accumulator -= STEP; }
    if (!state.playing) status('Ensaio concluído em 20 s. Registre os picos antes de mudar as configurações.');
    sync();
  }
  if (renderer && stage.clientWidth && !document.hidden) {
    table.position.x = ground(state).x * 3;
    buildings.forEach((b, index) => {
      const displacement = state.towers[index].x * 3;
      b.levels.forEach((level, i) => { level.position.x = displacement * ((i + 0.5) / b.levels.length) ** 1.3; }); b.roof.position.x = displacement;
    });
    orbit.update(); renderer.render(scene, camera);
  }
}

history = readRecords(); renderRecords(); chart(); sync();
await document.fonts.ready;
buildScene();
window.__TERREMOTOS__ = {
  ready: true,
  observe: () => ({ ...structuredClone(state), view, webgl: Boolean(renderer), renderer: renderer?.getContext().getParameter(renderer.getContext().RENDERER), triangles: renderer?.info.render.triangles ?? 0 }),
  advance: seconds => { const playing = state.playing; state.playing = true; for (let i = 0; i < Math.round(seconds / STEP); i++) stepExperiment(state); if (state.time < DURATION) state.playing = playing; sync(); if (state.time >= DURATION) status('Ensaio concluído em 20 s. Registre os picos antes de mudar as configurações.'); }
};
requestAnimationFrame(frame);
