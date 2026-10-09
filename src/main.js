import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LENGTH, WIDTH, SAMPLES, initialState, channelAt, bankAt, metrics, advance } from './model.js';
import { prepareOffline } from './offline.js';

const state = initialState();
const $ = selector => document.querySelector(selector);
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' }); }
catch (error) { $('#loading').innerHTML = 'A cena 3D não está disponível neste navegador. <a href="/escola.html">Continuar no caderno de Geografia</a>'; throw error; }
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
$('#scene').append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#163a30');
scene.fog = new THREE.FogExp2('#163a30', .0016);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .1, 1200);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = .065;
orbit.minDistance = 55;
orbit.maxDistance = 800;
orbit.maxPolarAngle = Math.PI * .49;
orbit.target.set(0, 0, 0);
const landscape = new THREE.Group();
scene.add(landscape);
const hemisphere = new THREE.HemisphereLight('#eff2ce', '#3d4b27', 2.1);
scene.add(hemisphere);
const sun = new THREE.DirectionalLight('#ffdfaa', 4.1);
sun.position.set(-75, 160, 45);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.left = -145;
sun.shadow.camera.right = 145;
sun.shadow.camera.top = 130;
sun.shadow.camera.bottom = -130;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 400;
sun.shadow.normalBias = .075;
sun.shadow.bias = -.00015;
sun.shadow.radius = 3;
scene.add(sun);
const rim = new THREE.DirectionalLight('#7fc8b4', 1.5);
rim.position.set(100, 75, -100);
scene.add(rim);

function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let n = Math.imul(seed ^ seed >>> 15, 1 | seed); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
const random = rng(1618033);
const standard = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .93, ...extra });
function box(width, height, depth, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  landscape.add(mesh);
  return mesh;
}
box(LENGTH + 2.5, 1.6, WIDTH + 2.5, standard('#1c3029', { metalness: .2, roughness: .54 }), 0, -11.5, 0);
box(LENGTH + 2.8, .2, WIDTH + 2.8, standard('#b19360', { metalness: .65, roughness: .4 }), 0, -10.7, 0);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(2500, 2500), standard('#163a30'));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -13;
ground.receiveShadow = true;
scene.add(ground);

const nx = 240, nz = 144;
const terrainGeometry = new THREE.PlaneGeometry(LENGTH, WIDTH, nx, nz);
terrainGeometry.rotateX(-Math.PI / 2);
const terrainPositions = terrainGeometry.attributes.position;
const colors = new Float32Array(terrainPositions.count * 3);
terrainGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
const terrain = new THREE.Mesh(terrainGeometry, standard('#ffffff', { vertexColors: true, flatShading: true }));
terrain.castShadow = true;
terrain.receiveShadow = true;
landscape.add(terrain);
const soilColors = ['#ac8155', '#d0af7a', '#765746', '#4f554b'];
const sideMeshes = [];
for (let side = 0; side < 4; side++) {
  const count = side < 2 ? nx : nz;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((count + 1) * 5 * 3), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array((count + 1) * 5 * 3), 3));
  const indices = [];
  for (let i = 0; i < count; i++) for (let row = 0; row < 4; row++) {
    const a = i * 5 + row, b = (i + 1) * 5 + row;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, standard('#ffffff', { vertexColors: true, side: THREE.DoubleSide, flatShading: true }));
  mesh.receiveShadow = true;
  landscape.add(mesh);
  sideMeshes.push({ mesh, side, count });
}

const treeData = Array.from({ length: 2100 }, () => ({ x: (random() - .5) * (LENGTH - 2), z: (random() - .5) * (WIDTH - 2), size: .75 + random() * 1.05, rotation: random() * Math.PI * 2, shade: random(), palm: random() < .10 }));
const crownGeometry = new THREE.IcosahedronGeometry(1, 1);
const crownMeshes = Array.from({ length: 3 }, () => {
  const mesh = new THREE.InstancedMesh(crownGeometry, standard('#ffffff', { flatShading: true }), treeData.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  landscape.add(mesh);
  return mesh;
});
const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.10, .18, 1, 5), standard('#665a3b'), treeData.length);
trunks.castShadow = true;
trunks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
landscape.add(trunks);
const leafGeometry = new THREE.BufferGeometry();
leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, .15, .45, 2.4, -.8, 0, 0, 0, 0, 2.4, -.8, 0, 1, .15, -.45], 3));
leafGeometry.computeVertexNormals();
const fronds = new THREE.InstancedMesh(leafGeometry, standard('#6c9955', { side: THREE.DoubleSide }), treeData.length * 7);
fronds.castShadow = true;
fronds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
landscape.add(fronds);
const treeGreen = new THREE.Color();
treeData.forEach((data, i) => {
  treeGreen.setHSL(.265 + data.shade * .055, .44 + data.shade * .14, .125 + data.shade * .11);
  crownMeshes.forEach((mesh, j) => mesh.setColorAt(i, treeGreen.clone().multiplyScalar(1 + j * .08)));
});
const grassData = Array.from({ length: 2600 }, () => ({x: (random() - .5) * LENGTH, z: (random() - .5) * WIDTH, size: .3 + random() * .8, rotation: random() * 6.28}));
const shrubs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), standard('#789756', { flatShading: true }), grassData.length);
shrubs.receiveShadow = true;
landscape.add(shrubs);
const dummy = new THREE.Object3D();

const crossSamples = 24;
const waterGeometry = new THREE.BufferGeometry();
const waterPositions = new Float32Array(SAMPLES * (crossSamples + 1) * 3);
const waterUV = new Float32Array(SAMPLES * (crossSamples + 1) * 2);
const waterIndices = [];
for (let i = 0; i < SAMPLES; i++) for (let j = 0; j <= crossSamples; j++) {
  const index = i * (crossSamples + 1) + j;
  waterUV[index * 2] = i / (SAMPLES - 1);
  waterUV[index * 2 + 1] = j / crossSamples;
  if (i < SAMPLES - 1 && j < crossSamples) {
    const a = index, b = index + crossSamples + 1;
    waterIndices.push(a, a + 1, b, b, a + 1, b + 1);
  }
}
waterGeometry.setAttribute('position', new THREE.BufferAttribute(waterPositions, 3));
waterGeometry.setAttribute('uv', new THREE.BufferAttribute(waterUV, 2));
waterGeometry.setIndex(waterIndices);
const waterMaterial = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  uniforms: { time: { value: 0 }, energy: { value: .55 }, sediment: { value: .6 }, viewPosition: { value: camera.position } },
  vertexShader: `varying vec2 vUv; varying vec3 vWorld; uniform float time;
    void main(){vUv=uv;vec3 p=position;p.y+=.045*sin(p.x*1.7+time*1.2)*cos(p.z*2.1-time*.7);vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
  fragmentShader: `varying vec2 vUv; varying vec3 vWorld; uniform float time;uniform float energy;uniform float sediment;uniform vec3 viewPosition;
    void main(){float a=vUv.x*175.-time*(.7+energy*1.7);float b=vUv.y;
    float wave=sin(a*1.9+b*35.+sin(a*.23)*2.)*.5+.5;
    float ripples=pow(wave,22.)*(.25+.75*pow(sin(a*.17+b*3.),2.));
    float sparkle=pow(max(0.,sin(a*4.6+b*95.)*sin(a*1.5-b*83.)),22.);
    float broad=sin(a*.055+b*4.8)*.5+.5;
    vec3 deep=mix(vec3(.19,.28,.23),vec3(.43,.32,.20),sediment);
    vec3 shallow=mix(vec3(.43,.48,.34),vec3(.68,.52,.33),sediment);
    float edge=pow(abs(b-.5)*2.,3.);vec3 col=mix(deep,shallow,.18+edge*.55+broad*.23);
    vec3 eye=normalize(viewPosition-vWorld);float fresnel=pow(1.-max(0.,eye.y),3.);
    col+=vec3(.75,.78,.58)*(ripples*.17+sparkle*.4);col=mix(col,vec3(.73,.80,.65),fresnel*.33);
    float foam=smoothstep(.88,.99,abs(b-.5)*2.)*pow(max(0.,sin(a*6.5+b*18.)),8.);col+=foam*.07;
    gl_FragColor=vec4(col,.91);}`
});
const water = new THREE.Mesh(waterGeometry, waterMaterial);
water.renderOrder = 2;
landscape.add(water);

const particleCount = 1700;
const particleData = Array.from({ length: particleCount }, () => ({ t: random(), lateral: (random() - .5) * .88, speed: .7 + random() * .6 }));
const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(particleCount * 3), 3));
const particleMaterial = new THREE.PointsMaterial({ color: '#e1ce94', size: .19, transparent: true, opacity: .53, depthWrite: false, blending: THREE.AdditiveBlending });
const particles = new THREE.Points(particleGeometry, particleMaterial);
particles.renderOrder = 3;
landscape.add(particles);
const arrowGeometry = new THREE.BufferGeometry();
arrowGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-.75, 0, -.09, .5, 0, -.09, .5, 0, .09, -.75, 0, -.09, .5, 0, .09, -.75, 0, .09, .25, 0, -.38, 1, 0, 0, .25, 0, .38], 3));
arrowGeometry.computeVertexNormals();
const arrows = new THREE.InstancedMesh(arrowGeometry, new THREE.MeshBasicMaterial({ color: '#f2e3bc', transparent: true, opacity: .43, side: THREE.DoubleSide, depthWrite: false }), 56);
arrows.renderOrder = 4;
landscape.add(arrows);

const nameCanvas = document.createElement('canvas');
nameCanvas.width = 2048;
nameCanvas.height = 256;
const ink = nameCanvas.getContext('2d');
ink.fillStyle = '#263d2e';
ink.fillRect(0, 0, 2048, 256);
ink.fillStyle = '#d6c69c';
ink.font = '72px Georgia';
ink.textAlign = 'center';
ink.fillText('A M A Z O N A S', 1024, 109);
ink.font = '22px sans-serif';
ink.fillText('P L A N Í C I E   A L U V I A L   ·   A T L A S   V I V O', 1024, 169);
const plaque = new THREE.Mesh(new THREE.PlaneGeometry(36, 4.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(nameCanvas) }));
plaque.position.set(0, -7.4, WIDTH / 2 + .13);
landscape.add(plaque);
for (const x of [-18.8, 18.8]) box(.14, 3.8, .15, standard('#d4b77c', {metalness: .65, roughness: .45}), x, -7.4, WIDTH / 2 + .12);

const grid = new THREE.GridHelper(220, 22, '#76927b', '#496755');
grid.position.y = -12.9;
grid.material.transparent = true;
grid.material.opacity = .15;
scene.add(grid);

const palette = { sand: new THREE.Color('#c0ad78'), clay: new THREE.Color('#9b7c51'), bed: new THREE.Color('#716948'), green: new THREE.Color('#647d45'), dark: new THREE.Color('#486846') };
const tempColor = new THREE.Color();
let lastUpdate = -Infinity;
let dirty = true;
let visibleTrees = 0;

function updateLandscape() {
  for (let i = 0; i < terrainPositions.count; i++) {
    const x = terrainPositions.getX(i), z = terrainPositions.getZ(i);
    const bank = bankAt(x, z, state);
    terrainPositions.setY(i, bank.height);
    const texture = .5 + .5 * Math.sin(x * .34 + z * .19) * Math.cos(z * .29 - x * .14);
    if (bank.height < .3) tempColor.copy(palette.bed).lerp(palette.sand, Math.max(0, bank.height + 2.8) / 3.1);
    else if (bank.height < 3.7) tempColor.copy(palette.sand).lerp(palette.clay, bank.inside ? .07 : .35);
    else tempColor.copy(palette.green).lerp(palette.dark, texture * .8);
    tempColor.multiplyScalar(.92 + texture * .16);
    tempColor.toArray(colors, i * 3);
  }
  terrainPositions.needsUpdate = true;
  terrainGeometry.attributes.color.needsUpdate = true;
  terrainGeometry.computeVertexNormals();
  for (const { mesh, side, count } of sideMeshes) {
    const pos = mesh.geometry.attributes.position, color = mesh.geometry.attributes.color;
    for (let i = 0; i <= count; i++) {
      const x = side < 2 ? -LENGTH / 2 + LENGTH * i / count : (side === 2 ? -1 : 1) * LENGTH / 2;
      const z = side < 2 ? (side === 0 ? -1 : 1) * WIDTH / 2 : -WIDTH / 2 + WIDTH * i / count;
      const h = bankAt(x, z, state).height;
      const layers = [h, -2.7 + .35 * Math.sin(x * .04 + z * .05), -5.6 + .27 * Math.sin(x * .06), -8.3 + .3 * Math.cos(z * .07), -10.6];
      for (let row = 0; row < 5; row++) {
        const index = i * 5 + row;
        pos.setXYZ(index, x, Math.min(h, layers[row]), z);
        tempColor.set(soilColors[Math.min(row, 3)]).multiplyScalar(.9 + .1 * Math.sin(i * 1.3 + row * 5));
        color.setXYZ(index, tempColor.r, tempColor.g, tempColor.b);
      }
    }
    pos.needsUpdate = true;
    color.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }
  visibleTrees = 0;
  treeData.forEach((data, i) => {
    const bank = bankAt(data.x, data.z, state);
    const present = bank.distance > (bank.inside ? 12 : 3.5) && bank.height > 3.3;
    const scale = present ? data.size : 0;
    if (present) visibleTrees++;
    const height = (data.palm ? 7.3 : 5.1) * scale;
    dummy.position.set(data.x, bank.height + height * .46, data.z);
    dummy.rotation.set(0, data.rotation, data.palm ? .07 : 0);
    dummy.scale.set(scale * 1.3, height, scale * 1.3);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    crownMeshes.forEach((mesh, j) => {
      const angle = data.rotation + j * 2.094;
      dummy.position.set(data.x + Math.cos(angle) * scale * .72, bank.height + height + (j === 0 ? .6 : -.5) * scale, data.z + Math.sin(angle) * scale * .72);
      dummy.rotation.set(.05, data.rotation, .07);
      const s = data.palm ? 0 : scale;
      dummy.scale.set(s * (j ? 1.6 : 1.9), s * (j ? 1.45 : 1.95), s * (j ? 1.5 : 1.85));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    for (let j = 0; j < 7; j++) {
      dummy.position.set(data.x, bank.height + height, data.z);
      dummy.rotation.set(.05, j * Math.PI * 2 / 7 + data.rotation, .13);
      dummy.scale.setScalar(data.palm ? scale * 1.3 : 0);
      dummy.updateMatrix();
      fronds.setMatrixAt(i * 7 + j, dummy.matrix);
    }
  });
  trunks.instanceMatrix.needsUpdate = true;
  fronds.instanceMatrix.needsUpdate = true;
  crownMeshes.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); });
  grassData.forEach((data, i) => {
    const bank = bankAt(data.x, data.z, state);
    dummy.position.set(data.x, bank.height + .25 * data.size, data.z);
    dummy.rotation.set(0, data.rotation, 0);
    dummy.scale.setScalar(bank.height > 3.3 && bank.distance > 5 ? data.size * .65 : 0);
    dummy.updateMatrix();
    shrubs.setMatrixAt(i, dummy.matrix);
  });
  shrubs.instanceMatrix.needsUpdate = true;
  for (let i = 0; i < SAMPLES; i++) {
    const x = -LENGTH / 2 + LENGTH * i / (SAMPLES - 1);
    const point = channelAt(x, state);
    const expansion = state.season === 'flood' ? 12 : state.season === 'dry' ? -1.6 : 2.5;
    const halfWidth = point.width / 2 + expansion;
    for (let j = 0; j <= crossSamples; j++) {
      const lateral = (j / crossSamples * 2 - 1) * halfWidth;
      const z = point.z + lateral * Math.sqrt(1 + point.slope ** 2);
      const bank = bankAt(x, z, state);
      const index = (i * (crossSamples + 1) + j) * 3;
      waterPositions[index] = x;
      waterPositions[index + 1] = bank.waterHeight;
      waterPositions[index + 2] = Math.max(-WIDTH / 2, Math.min(WIDTH / 2, z));
    }
  }
  waterGeometry.attributes.position.needsUpdate = true;
  waterGeometry.computeBoundingSphere();
  waterMaterial.uniforms.energy.value = state.flow / 100;
  waterMaterial.uniforms.sediment.value = state.sediment / 100;
  particleMaterial.opacity = .16 + state.sediment * .006;
  updateMetrics();
  lastUpdate = state.year;
  dirty = false;
}

function updateCurrent(time) {
  const positions = particleGeometry.attributes.position;
  const waterY = state.season === 'flood' ? 3.77 : state.season === 'dry' ? -.18 : 1.17;
  const velocity = .004 + state.flow * .0001;
  particleData.forEach((data, i) => {
    const t = (data.t + time * velocity * data.speed) % 1;
    const x = -LENGTH / 2 + t * LENGTH;
    const point = channelAt(x, state);
    const z = point.z + data.lateral * point.width * Math.sqrt(1 + point.slope ** 2);
    positions.setXYZ(i, x, waterY + .06 * Math.sin(t * 40 + i), z);
  });
  positions.needsUpdate = true;
  for (let i = 0; i < 56; i++) {
    const t = ((i / 56) + time * velocity * .75) % 1;
    const x = -LENGTH / 2 + LENGTH * t;
    const point = channelAt(x, state);
    const lateral = (i % 3 - 1) * point.width * .23;
    dummy.position.set(x, waterY + .14, point.z + lateral * Math.sqrt(1 + point.slope ** 2));
    dummy.rotation.set(0, -Math.atan(point.slope), 0);
    dummy.scale.setScalar(1.3);
    dummy.updateMatrix();
    arrows.setMatrixAt(i, dummy.matrix);
  }
  arrows.instanceMatrix.needsUpdate = true;
}

function updateMetrics() {
  const info = metrics(state);
  $('#sinuosity').textContent = info.sinuosity.toFixed(2).replace('.', ',');
  $('#flood-area').innerHTML = `${info.flooded}<small>%</small>`;
  $('#migration').textContent = info.migration.toFixed(1).replace('.', ',');
  const messages = {
    dry: ['VAZANTE · A TERRA APARECE', 'O rio recua. Os bancos de areia <em>voltam a aparecer.</em>', 'A floresta está fora d’água', '02 / 03'],
    normal: ['ÁGUAS EM TRANSIÇÃO', 'Na curva, o rio <em>toma de uma margem</em> e devolve à outra.', 'Entre a terra e a água', '01 / 03'],
    flood: ['CHEIA · A VÁRZEA RESPIRA', 'A água sobe e <em>entra na floresta.</em> Rio e várzea se conectam.', 'As raízes ficam sob a água', '03 / 03']
  };
  const message = messages[state.season];
  $('#season-badge').textContent = message[0];
  $('#observation-text').innerHTML = message[1];
  $('#flood-caption').textContent = message[2];
  $('.observation-number').textContent = message[3];
}

const projected = new THREE.Vector3();
function updateLabels() {
  const center = channelAt(26, state);
  const normal = Math.sqrt(1 + center.slope ** 2);
  const anchors = {
    erosion: [26, 6, center.z + (center.width / 2 + 1) * normal],
    deposit: [26, 2, center.z - (center.width / 2 + 4) * normal],
    forest: [-43, 12, 40]
  };
  const placed = [];
  for (const [name, point] of Object.entries(anchors)) {
    projected.set(...point).project(camera);
    const element = $(`[data-marker=${name}]`);
    const x = (projected.x * .5 + .5) * innerWidth;
    let y = (-projected.y * .5 + .5) * innerHeight;
    const labelWidth = element.offsetWidth, labelHeight = element.offsetHeight;
    for (const other of placed) if (Math.abs(x - other.x) < (labelWidth + other.width) / 2 + 8 && Math.abs(y - other.y) < labelHeight + 8) y = other.y - other.height - 12;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    const onScreen = x > 70 && x < innerWidth - 70 && y > 220 && y < innerHeight - 165;
    element.style.opacity = state.labels && onScreen && projected.z < 1 ? '1' : '0';
    if (onScreen) placed.push({ x, y, width: labelWidth, height: labelHeight });
  }
}

const viewTarget = new THREE.Vector3();
let cameraDestination = null;
let targetDestination = null;
function frameView(view, animate = true) {
  const mobile = innerWidth < 760 || innerHeight < 550;
  const aspectCompensation = Math.max(1, 1.35 / camera.aspect);
  const distance = mobile ? 1.48 : 1.18;
  const views = {
    diorama: [118 * distance, 119 * distance, 147 * distance],
    map: [0, 272 * aspectCompensation, .15],
    section: [43 * distance, 56 * distance, 181 * distance]
  };
  viewTarget.set(0, mobile ? -7 : 0, 0);
  const position = new THREE.Vector3(...views[view]);
  if (mobile && view !== 'map') position.multiplyScalar(Math.max(1, aspectCompensation * .72));
  if (animate) { cameraDestination = position; targetDestination = viewTarget.clone(); }
  else { camera.position.copy(position); orbit.target.copy(viewTarget); camera.lookAt(orbit.target); }
}
orbit.addEventListener('start', () => { cameraDestination = null; targetDestination = null; });
function chooseView(view) {
  state.view = view;
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
  frameView(view);
}
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => chooseView(button.dataset.view)));
document.querySelectorAll('[data-season]').forEach(button => button.addEventListener('click', () => {
  state.season = button.dataset.season;
  document.querySelectorAll('[data-season]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  dirty = true;
}));
function rangeFill(element) { element.style.setProperty('--fill', `${100 * (element.value - element.min) / (element.max - element.min)}%`); }
for (const key of ['flow', 'sediment']) {
  $(`#${key}`).addEventListener('input', event => {
    state[key] = Number(event.target.value);
    $(`#${key}-value`).textContent = `${state[key]}%`;
    rangeFill(event.target);
    dirty = true;
  });
  rangeFill($(`#${key}`));
}
function updatePlay() {
  $('#play').setAttribute('aria-label', state.playing ? 'Pausar simulação' : 'Continuar simulação');
  $('#play').setAttribute('aria-pressed', String(state.playing));
  $('#play-icon').setAttribute('d', state.playing ? 'M8 5v14M16 5v14' : 'M8 5l11 7-11 7z');
}
$('#play').addEventListener('click', () => { if (state.year >= 300) state.year = 0; state.playing = !state.playing; updatePlay(); });
$('#year').addEventListener('input', event => { state.year = Number(event.target.value); state.playing = false; updatePlay(); dirty = true; });
document.querySelectorAll('[data-speed]').forEach(button => button.addEventListener('click', () => {
  state.speed = Number(button.dataset.speed);
  document.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
}));
function toggleLabels() { state.labels = !state.labels; $('#labels').setAttribute('aria-pressed', String(state.labels)); }
$('#labels').addEventListener('click', toggleLabels);
const ambient = new Audio('/audio/river-ambience.ogg');
ambient.loop = true;
ambient.volume = .24;
let soundOn = false;
$('#sound').addEventListener('click', async () => {
  if (soundOn) { ambient.pause(); soundOn = false; }
  else { try { await ambient.play(); soundOn = true; } catch { $('#sound').title = 'O navegador não conseguiu reproduzir o ambiente.'; } }
  $('#sound').setAttribute('aria-pressed', String(soundOn));
});
function reset() {
  Object.assign(state, initialState());
  if (reducedMotion || ['margens', 'cheias'].includes(activity)) state.playing = false;
  for (const key of ['flow', 'sediment', 'year']) { $(`#${key}`).value = state[key]; rangeFill($(`#${key}`)); }
  for (const key of ['flow', 'sediment']) $(`#${key}-value`).textContent = `${state[key]}%`;
  document.querySelectorAll('[data-season]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.season === state.season)));
  document.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === state.speed)));
  $('#labels').setAttribute('aria-pressed', 'true');
  chooseView('diorama');
  updatePlay();
  dirty = true;
}
$('#reset').addEventListener('click', reset);
$('#about-open').addEventListener('click', () => $('#about').showModal());
$('#about-close').addEventListener('click', () => $('#about').close());
$('#about').addEventListener('click', event => { if (event.target === $('#about')) { const bounds = $('#about').getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) $('#about').close(); } });
$('#controls-toggle').addEventListener('click', () => { const open = $('#controls').classList.toggle('open'); $('#controls-toggle').setAttribute('aria-expanded', String(open)); });
document.addEventListener('keydown', event => {
  if (event.target.closest('input,textarea,select,button,a') || document.querySelector('dialog[open]')) return;
  const key = event.key.toLowerCase();
  if (key === ' ') { event.preventDefault(); $('#play').click(); }
  if (key === 'v') { const views = ['diorama', 'map', 'section']; chooseView(views[(views.indexOf(state.view) + 1) % 3]); }
  if (key === 'r') reset();
  if (key === 'n') toggleLabels();
  if (key === 'arrowleft' || key === 'arrowright') { event.preventDefault(); state.year = THREE.MathUtils.clamp(state.year + (key === 'arrowleft' ? -10 : 10), 0, 300); state.playing = false; updatePlay(); dirty = true; }
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  frameView(state.view, false);
});
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reducedMotion) { state.playing = false; updatePlay(); }
const activity = new URLSearchParams(location.search).get('atividade');
if (['margens', 'cheias'].includes(activity)) {
  state.playing = false;
  updatePlay();
  $('#mission-open').hidden = false;
  $('#mission-title').textContent = activity === 'margens' ? 'Para onde vai a margem?' : 'Quando o rio encontra a floresta';
  $('#mission-instruction').textContent = activity === 'margens' ? 'Compare as etapas 0 e 240. Mantenha corrente 55, sedimentos 60 e transição. Desenhe as curvas e identifique erosão e deposição.' : 'Compare vazante e cheia na etapa 0, com corrente 55 e sedimentos 60. Qual área da paisagem a água alcança?';
  const presets = activity === 'margens' ? [['Etapa 0', 0, 'normal'], ['Etapa 240', 240, 'normal']] : [['Comparar vazante', 0, 'dry'], ['Comparar cheia', 0, 'flood']];
  for (const [label, year, season] of presets) {
    const button = document.createElement('button'); button.textContent = label;
    button.addEventListener('click', () => {
      reset(); state.year = year; state.season = season; state.playing = false; updatePlay();
      document.querySelectorAll('[data-season]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.season === season)));
      chooseView('map'); dirty = true; $('#mission').close();
    });
    $('#mission-presets').append(button);
  }
  $('#mission-open').addEventListener('click', () => $('#mission').showModal());
  $('#mission-close').addEventListener('click', () => $('#mission').close());
  $('#record-observation').addEventListener('click', () => {
    state.playing = false; updatePlay();
    try {
      const raw = JSON.parse(sessionStorage.getItem('atlas-amazonas-records') || '[]');
      const records = Array.isArray(raw) ? raw.slice(-11) : [];
      records.push({ activity, stage: Math.floor(state.year), season: state.season, flow: state.flow, sediment: state.sediment, ...metrics(state) });
      sessionStorage.setItem('atlas-amazonas-records', JSON.stringify(records));
      $('#record-feedback').textContent = 'Observação registrada nesta aba. Compare no caderno; fechar a aba encerra os registros.';
    } catch { $('#record-feedback').textContent = 'O navegador não permitiu guardar o registro. Anote a etapa, o ciclo e a área alagada na ficha.'; }
  });
}
prepareOffline();
frameView('diorama', false);
updateLandscape();
$('#loading').hidden = true;
let lastFrame = performance.now();
let animationTime = 0;
let previousPlaying = state.playing;
function frame(now) {
  const elapsed = Math.min(.1, (now - lastFrame) / 1000);
  lastFrame = now;
  advance(state, elapsed);
  if (!reducedMotion && state.playing) animationTime += elapsed;
  if (dirty || Math.abs(state.year - lastUpdate) > 1.2) updateLandscape();
  if (cameraDestination) {
    const factor = 1 - Math.exp(-elapsed * 5);
    camera.position.lerp(cameraDestination, factor);
    orbit.target.lerp(targetDestination, factor);
    if (camera.position.distanceTo(cameraDestination) < .12) { camera.position.copy(cameraDestination); orbit.target.copy(targetDestination); cameraDestination = null; targetDestination = null; }
  }
  orbit.update();
  waterMaterial.uniforms.time.value = animationTime;
  waterMaterial.uniforms.viewPosition.value.copy(camera.position);
  updateCurrent(animationTime);
  updateLabels();
  $('#year-value').textContent = String(Math.floor(state.year));
  $('#year').value = state.year;
  rangeFill($('#year'));
  if (previousPlaying !== state.playing) { updatePlay(); previousPlaying = state.playing; }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__AMAZONAS__ = {
  observe: () => ({ ...state, ...metrics(state), visibleTrees, camera: camera.position.toArray(), soundOn, audio: { paused: ambient.paused, currentTime: ambient.currentTime, readyState: ambient.readyState }, renderer: renderer.getContext().getParameter(renderer.getContext().getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL || renderer.getContext().RENDERER), rendered: renderer.info.render }),
  pause: () => { state.playing = false; updatePlay(); },
  reset,
  ready: true
};
