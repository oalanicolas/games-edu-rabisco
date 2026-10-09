/* AI Race — data and interface. The 3D world lives in scene.js. */
import { createRace, withRef } from './scene.js?v=849ecc8bec';
import { buildModel, rankRace, slugFor, raceFromSlug, reasonFor } from './model.js?v=e00cd5caf9';
import { t, useStrings, ago, LANGS, lang, intlLocale } from './i18n.js?v=fdae2b818c';

let LOGO = {}, FLAG = {}, COUNTRY = {}, RASTER = {};
const RIMG = {};   // decoded site icons, ready for canvas

// lab names arrive already resolved (OpenRouter namespace -> the lab's own name)
const nameOf = (lab) => lab;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
// boot timeline, readable from the console as __T: where the wait actually goes
const T = (window.__T = { module: Math.round(performance.now()) });
const mark = (k) => { T[k] = Math.round(performance.now()); };





const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const fmtDate = (s) => new Date(s + 'T00:00:00Z').toLocaleDateString(intlLocale(),
  { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/* ============================ DATA ============================ */
let DATA, LABS = [], METRICS = [], metric, NOW, SPONSORS = [], race;

/* Circuits. The lake ring is the signed-off default; the others are selectable from the top
   right, remembered per browser and shareable as ?circuit=. */
const CIRCUITS = [
  { id: 'ring', name: 'Lake ring', icon: '<ellipse cx="12" cy="12" rx="9.5" ry="6"/><ellipse cx="12" cy="12" rx="4.6" ry="2.6"/>' },
  { id: 'gp', name: 'Grand Prix', icon: '<path d="M5.2 17.4c-2.4-2.9-.6-7.2 2.6-8.1 2.6-.7 1.8-4.1 5-4.3 3.4-.2 6.6 1.9 6.4 5.1-.2 2.8-3.1 3.1-2.1 6-1 2.4-3.3 3.2-6.3 2.6-2.4-.5-3.9 1.6-5.6-1.3z"/>' },
  { id: 'twisty', name: 'Twisty circuit', icon: '<path d="M3.6 16.8c-.8-2.5.4-4.9 2.6-5.3 1.9-.3 2.2-2.9 1.1-4.4-1-1.5.3-3.4 2.3-3 2 .4 1.8 3 3.6 3.6 1.9.6 3.3-1.7 5.3-.9 2.1.8 2.4 3.6.8 5-1.4 1.2-3.4.6-3.9 2.4-.5 1.9 2.4 2.6 1.7 4.7-.7 2-3.4 1.9-5.1 1.2-1.9-.8-3.5.3-5.3.4-1.5.1-2.6-1.8-3.1-3.7z"/>' },
  { id: 'planet', name: 'Planet tour', icon: '<circle cx="12" cy="12" r="6.3"/><ellipse cx="12" cy="12" rx="10.6" ry="3.4" transform="rotate(-24 12 12)"/>' },
  { id: 'mobius', name: 'Möbius strip', icon: '<path d="M2.8 12c0-3 2.2-5 4.7-5 4.1 0 5.9 10 9.9 10 2.5 0 4.8-2 4.8-5s-2.3-5-4.8-5c-4 0-5.8 10-9.9 10-2.5 0-4.7-2-4.7-5z"/>' }
];
const DEFAULT_CIRCUIT = 'planet';
const initialCircuit = () => {
  const q = new URLSearchParams(location.search).get('circuit');
  if (CIRCUITS.some((c) => c.id === q)) return q;
  try { const s = localStorage.getItem('race:circuit'); if (CIRCUITS.some((c) => c.id === s)) return s; } catch (e) { /* storage blocked */ }
  return DEFAULT_CIRCUIT;
};

/* Camera modes: TV (the fitted broadcast shots), heli, rear, driver and cinematic. One button left of
   the circuit picker cycles them, as does the C key; the choice is remembered and shareable as ?cam=. */
const CAMS = [{ id: 'tv', label: 'TV cam' }, { id: 'heli', label: 'Heli cam' }, { id: 'rear', label: 'Rear cam' },
  { id: 'driver', label: 'Driver cam' }, { id: 'cine', label: 'Cinematic' }];
const CAM_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5h11a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 15V9A1.5 1.5 0 0 1 3 7.5z"/><path d="m15.5 10.5 6-3v9l-6-3"/></svg>';
function setCam(id, { quiet = false } = {}) {
  const cam = CAMS.find((c) => c.id === id) || CAMS[0], label = t('cam.' + cam.id, cam.label);
  race.setCam(cam.id, { instant: quiet });
  document.body.classList.toggle('cam-cine', cam.id === 'cine');
  const btn = $('#camBtn');
  if (btn) {
    btn.querySelector('.cam-name').textContent = label;
    btn.setAttribute('aria-label', t('cam.aria', 'Camera: {cam}. Next camera', { cam: label }));
    btn.title = t('cam.title', '{cam} (C for the next camera)', { cam: label });
  }
  try { localStorage.setItem('race:cam', cam.id); } catch (e) { /* storage blocked */ }
  const url = new URL(location.href);
  if (cam.id === 'tv') url.searchParams.delete('cam'); else url.searchParams.set('cam', cam.id);
  if (url.href !== location.href) history.replaceState(null, '', url);
  if (!quiet) { toast(label, 1400); track('camera', { cam: cam.id }); }
}
const cycleCam = () => setCam(CAMS[(CAMS.findIndex((c) => c.id === race.cam) + 1) % CAMS.length].id);
/* Vehicles: F1 cars, MotoGP bikes or NASCAR stock cars, cycled by the button beside the camera;
   remembered per browser and shareable as ?ride=motogp or ?ride=nascar. The button names what is
   racing now and what one more click brings, like the camera button. The field is rebuilt in waves
   by the scene, so the race never stops for it and the button only holds while that is running. */
const RIDES = [
  { id: 'f1', label: 'F1', name: 'F1 cars',
    icon: '<path d="M2.3 8.6h3.4v2.6H2.3z"/><path d="M4 11.2v1.9"/>'
      + '<path d="M2.6 13.1h5.1l1.5-1.7h2.6l.8 1.7h3.1l4.6 1.5"/>'
      + '<path d="M19.2 13.5l3 .9-3 .9"/>'
      + '<path d="M9.7 15.3h5M2.6 15.3h1.2M19.8 15.3h1"/>'
      + '<circle cx="6.9" cy="15.3" r="2.6"/><circle cx="17.2" cy="15.3" r="2.6"/>' },
  { id: 'motogp', label: 'MotoGP', name: 'MotoGP bikes',
    icon: '<circle cx="5.4" cy="15.6" r="2.9"/><circle cx="18.6" cy="15.6" r="2.9"/>'
      + '<path d="M3.1 10.3h4.2c.4 0 .8.2 1 .5l1.1 1.4h3.9l1.3-2.3c.2-.4.7-.6 1.1-.5l2.3.5c.6.1.9.8.6 1.3l-1.1 2.1c-.2.3-.4.5-.7.6l-2.9.9"/>'
      + '<path d="M9.4 12.2l-2.1 3.4h5.3l1.9-3.3"/>'
      + '<path d="M16.2 12.6l2.4 3"/><path d="M15.4 9.4l1.9-1.8"/>' },
  { id: 'nascar', label: 'NASCAR', name: 'NASCAR stock cars',
    icon: '<path d="M4.3 14.4H2.9v-3.2l3.5-.5 2.2-3.2h5l2.2 3.1 5.2.4 1 1.8v1.6h-1.7"/>'
      + '<path d="M9.3 14.4h5.8"/>'
      + '<path d="M2.2 8.6l1.1.4-.4 2.2"/>'
      + '<path d="M9.7 10.6l1.1-1.5h2.4l1.2 1.5z"/>'
      + '<circle cx="6.8" cy="15.4" r="2.5"/><circle cx="17.6" cy="15.4" r="2.5"/>' }
];
const nextRide = (id) => RIDES[(RIDES.findIndex((r) => r.id === id) + 1) % RIDES.length];
const initialRide = () => {
  const q = new URLSearchParams(location.search).get('ride');
  if (RIDES.some((r) => r.id === q)) return q;
  try { const s = localStorage.getItem('race:ride'); if (RIDES.some((r) => r.id === s)) return s; } catch (e) { /* storage blocked */ }
  return 'f1';
};
function setRide(id, { quiet = false } = {}) {
  const ride = RIDES.find((r) => r.id === id) || RIDES[0], next = nextRide(ride.id);
  const nameOfRide = (r) => t('ride.' + r.id + '.name', r.name);
  if (race.ride !== ride.id) race.setRide(ride.id);
  const btn = $('#rideBtn');
  if (btn) {
    btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ride.icon}</svg><span class="cam-name">${ride.label}</span>`;
    btn.setAttribute('aria-label', t('ride.aria', 'Racing {now}. Switch to {next}', { now: nameOfRide(ride), next: nameOfRide(next) }));
    btn.title = t('ride.title', 'Racing {now} (click for {next})', { now: nameOfRide(ride), next: nameOfRide(next) });
  }
  try { localStorage.setItem('race:ride', ride.id); } catch (e) { /* storage blocked */ }
  const url = new URL(location.href);
  if (ride.id === 'f1') url.searchParams.delete('ride'); else url.searchParams.set('ride', ride.id);
  if (url.href !== location.href) history.replaceState(null, '', url);
  if (!quiet) { toast(nameOfRide(ride), 1400); track('ride', { ride: ride.id }); }
}
function wireRide() {
  const cam = $('#camBtn');
  if (!cam) return;
  cam.insertAdjacentHTML('afterend', '<button type="button" id="rideBtn" class="cam ride"></button>');
  $('#rideBtn').addEventListener('click', () => {
    // one change at a time: the field is still coming out in waves until the scene says otherwise
    if (race.swapping || document.body.classList.contains('building')) return;
    setRide(nextRide(race.ride).id);
  });
  setRide(race.ride, { quiet: true });
}

/* Car labels: names for the top three with faded logo badges for the rest (the default; every name shows
   for a few seconds after a race change), every name, or none. The tag button cycles them, as does L;
   remembered per browser and shareable as ?labels=all or ?labels=off. */
const LABEL_MODES = [
  { id: 'top3', label: 'Top 3', name: 'Names for the top 3' },
  { id: 'all', label: 'All names', name: 'Every name' },
  { id: 'off', label: 'No labels', name: 'No labels' }
];
const TAG = '<path d="M3.5 5.2v5.3c0 .5.2.9.5 1.2l8.4 8.4c.7.7 1.8.7 2.5 0l5-5c.7-.7.7-1.8 0-2.5L11.5 4.2c-.3-.3-.8-.5-1.2-.5H5c-.8 0-1.5.7-1.5 1.5z"/><circle cx="7.6" cy="7.9" r="1.2"/>';
const LABEL_ICON = { top3: TAG, all: TAG + '<path d="M9.5 1.8h3.2c.5 0 .9.2 1.2.5l7.6 7.6"/>', off: TAG + '<path d="M2.5 2.5l19 19"/>' };
const initialLabels = () => {
  const q = new URLSearchParams(location.search).get('labels');
  if (LABEL_MODES.some((x) => x.id === q)) return q;
  try { const s = localStorage.getItem('race:labels'); if (LABEL_MODES.some((x) => x.id === s)) return s; } catch (e) { /* storage blocked */ }
  return 'top3';
};
function setLabels(id, { quiet = false } = {}) {
  const mode = LABEL_MODES.find((x) => x.id === id) || LABEL_MODES[0];
  const label = t('labels.' + mode.id + '.label', mode.label), name = t('labels.' + mode.id + '.name', mode.name);
  race.setLabels(mode.id);
  const btn = $('#labelsBtn');
  if (btn) {
    btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${LABEL_ICON[mode.id]}</svg><span class="cam-name">${esc(label)}</span>`;
    btn.setAttribute('aria-label', t('labels.aria', 'Labels: {mode}. Next label style', { mode: name }));
    btn.title = t('labels.title', 'Labels: {mode} (L for the next style)', { mode: name });
  }
  try { localStorage.setItem('race:labels', mode.id); } catch (e) { /* storage blocked */ }
  const url = new URL(location.href);
  if (mode.id === 'top3') url.searchParams.delete('labels'); else url.searchParams.set('labels', mode.id);
  if (url.href !== location.href) history.replaceState(null, '', url);
  if (!quiet) { toast(name, 1400); track('labels', { labels: mode.id }); }
}
const cycleLabels = () => setLabels(LABEL_MODES[(LABEL_MODES.findIndex((x) => x.id === race.labels) + 1) % LABEL_MODES.length].id);
function wireLabels() {
  const before = $('#rideBtn') || $('#camBtn');
  if (!before) return;
  before.insertAdjacentHTML('afterend', '<button type="button" id="labelsBtn" class="cam labels"></button>');
  $('#labelsBtn').addEventListener('click', cycleLabels);
  setLabels(race.labels, { quiet: true });
}

/* Live visitors: Umami's count of distinct visitors in the last 5 minutes, read through the public
   share link. The first read waits a few seconds (a bounce never asks), the share token is kept per
   browser, and the poll slows once the count passes 250, so the analytics server sees about the same
   load however many are watching. A Cloudflare cache on dat.d1.tel takes the rest. */
const LIVE = { host: 'https://dat.d1.tel', share: 'z9yWa0iuLNwmeWuA', every: 60000 };
function wireLiveCount() {
  const el = $('#live');
  if (!el) return;
  let auth = null, timer = 0, last = 0;
  try { auth = JSON.parse(localStorage.getItem('race:live') || 'null'); } catch (e) { auth = null; }
  const signIn = async () => {
    const r = await fetch(`${LIVE.host}/api/share/${LIVE.share}`);
    if (!r.ok) throw new Error(`share ${r.status}`);
    auth = await r.json();
    try { localStorage.setItem('race:live', JSON.stringify(auth)); } catch (e) { /* storage blocked */ }
  };
  // no-store: the count must never come from the browser's own cache, whatever Cloudflare tells browsers.
  // Umami 3.x only honours the share token alongside the share-context header (401 without it).
  const active = () => fetch(`${LIVE.host}/api/websites/${auth.websiteId}/active`, {
    cache: 'no-store', headers: { 'x-umami-share-token': auth.token, 'x-umami-share-context': '1' }
  });
  async function read() {
    clearTimeout(timer);
    if (document.hidden) return;
    last = Date.now();
    let n = null;
    try {
      if (!auth) await signIn();
      let r = await active();
      if (r.status === 401 || r.status === 403) { await signIn(); r = await active(); }
      if (r.ok) n = (await r.json()).visitors;
    } catch (e) { /* analytics unreachable: the count just hides */ }
    el.hidden = !(n > 0);
    if (n > 0) el.querySelector('b').textContent = n.toLocaleString('en-US');
    const wait = LIVE.every * Math.min(15, Math.max(1, (n || 0) / 250));
    timer = setTimeout(read, wait * (.9 + Math.random() * .2));
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTimeout(timer); return; }
    timer = setTimeout(read, Math.max(0, LIVE.every - (Date.now() - last)));
  });
  timer = setTimeout(read, 4000 + Math.random() * 6000);
}

function wireCamera() {
  const nav = $('#circuits');
  if (!nav) return;
  nav.querySelector('.tools').insertAdjacentHTML('afterbegin', `<button type="button" id="camBtn" class="cam">${CAM_ICON}<span class="cam-name"></span></button>`);
  $('#camBtn').addEventListener('click', cycleCam);
  let saved = new URLSearchParams(location.search).get('cam');
  if (!CAMS.some((c) => c.id === saved)) { try { saved = localStorage.getItem('race:cam'); } catch (e) { saved = null; } }
  setCam(saved, { quiet: true });
}

function labelCircuits() {
  document.querySelectorAll('#circuits button[data-circuit]').forEach((b) => {
    const c = CIRCUITS.find((x) => x.id === b.dataset.circuit), name = t('circuit.' + c.id, c.name);
    b.title = name; b.setAttribute('aria-label', name);
  });
}

function wireCircuits() {
  const nav = $('#circuits');
  if (!nav) return;
  // the camera, vehicle and label buttons go in the tools group; circuits in their own
  nav.innerHTML = '<div class="tools"></div><div class="tracks">' + CIRCUITS.map((c) => `<button type="button" data-circuit="${c.id}" aria-pressed="${c.id === race.trackId}" `
    + `aria-label="${esc(c.name)}" title="${esc(c.name)}"><svg viewBox="0 0 24 24" aria-hidden="true">${c.icon}</svg></button>`).join('') + '</div>';
  labelCircuits();
  nav.querySelectorAll('button[data-circuit]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.circuit;
    if (id === race.trackId || document.body.classList.contains('building')) return;
    document.body.classList.add('building');
    nav.querySelectorAll('button[data-circuit]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    // let the building state paint before the world is generated
    requestAnimationFrame(() => requestAnimationFrame(() => {
      race.setTrack(id);
      track('circuit', { circuit: id });
      try { localStorage.setItem('race:circuit', id); } catch (e) { /* storage blocked */ }
      const url = new URL(location.href);
      if (id === DEFAULT_CIRCUIT) url.searchParams.delete('circuit'); else url.searchParams.set('circuit', id);
      history.replaceState(null, '', url);
      document.body.classList.remove('building');
    }));
  }));
}

/* Two loads, on purpose. The sponsors are 2 KB and the world needs them, so terrain, track and
   hoardings can be on screen while race.json — the big one — is still arriving; the field joins the
   moment it lands. Both were requested by the inline script in <head> before this module parsed. */
async function loadSponsors() {
  const s = await ((window.__data && window.__data.sponsors)
    || fetch('sponsors.json?v=3e2a76f106').then((r) => (r.ok ? r.json() : { boards: [] })).catch(() => ({ boards: [] })));
  SPONSORS = ((s && s.boards) || []).filter((b) => b && b.text);
  // sponsor artwork is drawn onto the boards once, so decode it before the world is built
  await Promise.all(SPONSORS.filter((b) => b.logo).map((b) => new Promise((res) => {
    const img = new Image();
    img.onload = () => { b.img = img; res(); };
    img.onerror = res;
    img.src = b.logo;
  })));
}

async function loadRace() {
  // a Chinese, Japanese or Spanish visit started fetching its strings in <head>
  const stringsP = (window.__lang && window.__lang.strings) || Promise.resolve(null);
  DATA = await ((window.__data && window.__data.race) || fetch('race.json?v=70cc086157').then((r) => r.json()));
  const strings = await stringsP;
  useStrings(strings ? window.__lang.code : 'en', strings);
  if (!strings) document.documentElement.lang = 'en';
  LOGO = DATA.logos || {};
  FLAG = DATA.flags || {};
  COUNTRY = DATA.country || {};
  RASTER = DATA.rasters || {};
  // decode site icons up front: the car textures are drawn once, synchronously
  await Promise.all(Object.entries(RASTER).map(([lab, src]) => new Promise((res) => {
    const img = new Image();
    img.onload = () => { RIMG[lab] = img; res(); };
    img.onerror = res;
    img.src = src;
  })));
  let saved = null;
  try { saved = localStorage.getItem('ai-race:smartest'); } catch (e) { /* storage blocked */ }
  ({ LABS, METRICS, NOW } = buildModel(DATA, { savedSource: saved }));
  metric = METRICS[0];
}
const standings = (m) => rankRace(LABS, m);


/** Draw a lab's mark onto a canvas: its site/OpenRouter icon, a Simple Icons path, or a monogram. */
function drawLogo(ctx, lab, cx, cy, size, color) {
  const img = RIMG[lab];
  if (img) { ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size); return; }
  const d = LOGO[lab];
  ctx.save();
  ctx.fillStyle = color;
  if (d && typeof Path2D !== 'undefined') {
    const k = size / 24;
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(k, k);
    ctx.fill(new Path2D(d));
  } else {
    ctx.font = `700 ${Math.round(size * .74)}px Fredoka, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(lab.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase(), cx, cy + size * .04);
  }
  ctx.restore();
}

/* ============================ UI ============================ */
const $ = (s) => document.querySelector(s);

function applyMetric(m, first = false, { quiet = false } = {}) {
  metric = m;
  const st = standings(m);

  /* Each lab keeps its own lane for good; only progress changes between races, so a
     category switch reads as overtaking and cars never cross paths. */
  if (!quiet) race.setRanking(st.all.map((r) => ({ id: r.l.lab, rank: r.rank, t: r.t, shout: r.rank === 1 ? shoutFor(m, r) : null })), { first });

  $('#title').textContent = m.title;
  const acc = $('#according');
  acc.hidden = !(m.sources && m.sources.length > 1);
  if (!acc.hidden) $('#source').value = m.sourceKey;
  $('#callout').innerHTML = calloutFor(m, st);

  const CROWN = '<svg class="crown" viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M3 18 5 6l4.5 5L12 4l2.5 7L19 6l2 12H3z"/></svg>';
  // the standings swap places smoothly: note where each lab's row was, re-render, then glide from there
  const rowsEl = $('#rows'), was = new Map();
  if (!first && !quiet && !REDUCED) rowsEl.querySelectorAll('.row').forEach((b) => { const r = b.getBoundingClientRect(); if (r.height) was.set(b.dataset.lab, r.top); });
  rowsEl.innerHTML = st.all.map((r) => `
    <button class="row ${r.rank === 1 ? 'lead' : ''}" data-lab="${esc(r.l.lab)}"
      style="color:${hex(r.l.color)};--t:${Math.max(r.t ?? 0, 0).toFixed(3)}">
      <span class="pos">${r.rank ?? '–'}</span>
      <span class="nm">${markup(r.l)}${flagImg(r.l)}<span>${esc(nameOf(r.l.lab))}</span>${r.rank === 1 ? CROWN : ''}</span>
      <span class="val">${r.v != null ? m.fmt(r.v) : esc(t('board.noData', 'no data'))}</span>
    </button>`).join('');
  if (was.size) {
    rowsEl.querySelectorAll('.row').forEach((b) => {
      const from = was.get(b.dataset.lab), r = b.getBoundingClientRect();
      if (from == null || !r.height || Math.abs(from - r.top) < 1) return;
      // rows climbing the table pass over the ones dropping back; `translate` leaves the hover transform alone
      b.style.zIndex = from > r.top ? '2' : '1';
      b.animate([{ translate: `0 ${(from - r.top).toFixed(1)}px` }, { translate: '0 0' }],
        { duration: 900, easing: 'cubic-bezier(.25,.8,.25,1)' }).finished.then(() => { b.style.zIndex = ''; }, () => {});
    });
  }
  $('#rows').querySelectorAll('.row').forEach((b) => {
    const lab = () => LABS.find((l) => l.lab === b.dataset.lab);
    b.addEventListener('click', () => openCard(lab(), desktopHover() ? { mode: 'row', row: b, pinned: true } : {}));
    // desktop: hovering a standings row previews that lab's card beside the row
    b.addEventListener('mouseenter', () => {
      if (desktopHover() && !(cardState.pinned && cardState.mode === 'corner')) openCard(lab(), { mode: 'row', row: b, pinned: false });
    });
    b.addEventListener('mouseleave', () => { if (desktopHover() && !cardState.pinned) closeCard(); });
  });
  if (cardState.id && cardState.mode === 'row') {
    cardState.row = document.querySelector(`.row[data-lab="${CSS.escape(cardState.id)}"]`);
    placeCard();
  }

  $('#more').textContent = t('more', '{note} {labs} more labs and {models} models are racing off-screen.', { note: m.note, labs: DATA.hiddenLabs, models: DATA.hiddenModels });
  document.querySelectorAll('.chip').forEach((c) =>
    c.setAttribute('aria-pressed', String(c.dataset.id === m.id)));
  document.querySelectorAll('.chipwrap').forEach((w) => w.classList.toggle('on', w.dataset.id === m.id));
  renderSourceMenu();
  renderRail(st);
  // a line of commentary when the race changes; never on the first load or a replay
  const key = m.id + ':' + (m.sourceKey || '');
  if (quiet) return;
  if (!first && lastRaceKey && key !== lastRaceKey) showCommentary(commentaryFor(m, st, lastLeader));
  lastRaceKey = key;
  syncRaceUrl(m, first);
  const lead = st.all.find((r) => r.rank === 1);
  lastLeader = lead ? lead.l.lab : null;
}

/* What the new leader shouts as it takes the front: the one fact that put it there. */
function shoutFor(m, r) {
  const l = r.l;
  if (m.id === 'fresh') return l.latest && l.latest.name;
  if (m.id === 'busy') return t('shout.busy', '{n} models!', { n: l.recentCount });
  if (m.id === 'cheap') return `$${r.v.toFixed(2)}`;
  if (m.id === 'ctx') return t('shout.ctx', '{ctx} context', { ctx: m.fmt(r.v) });
  const det = m.detail ? m.detail(l) : null;
  return det ? `${det.model.name} \u00b7 ${m.fmt(r.v)}` : m.fmt(r.v);
}

/* ---------- phone rank rail: every lab as a logo down the left edge ---------- */
function renderRail(st) {
  const rail = $('#rail');
  if (!rail) return;
  rail.innerHTML = st.all.map((r) => `<button type="button" class="rail-dot${r.rank === 1 ? ' lead' : ''}${r.rank ? '' : ' missing'}" `
    + `data-lab="${esc(r.l.lab)}" style="--c:${hex(r.l.color)}" aria-label="${esc(nameOf(r.l.lab))}${esc(r.rank ? t('rail.rank', ', rank {n}', { n: r.rank }) : t('rail.noData', ', no data'))}">`
    + `<span class="rk">${r.rank ?? '\u2013'}</span>${markup(r.l)}</button>`).join('');
  rail.querySelectorAll('.rail-dot').forEach((b) => b.addEventListener('click', () => pointToCar(b)));
  rail.hidden = false;
  layoutRail();
}
function layoutRail() {
  const rail = $('#rail');
  if (!rail || rail.hidden) return;
  const h = $('header').getBoundingClientRect();
  // down to whichever of the chips, standings or marquee starts highest below the header
  const dock = ['#chips', '#board', '#marquee'].map((s) => $(s)).filter((e) => e && !e.hidden && e.offsetParent !== null)
    .map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.top > h.bottom).map((r) => r.top);
  const top = h.bottom + 10, bottom = Math.min(innerHeight * .7, ...dock) - 10, n = rail.children.length || 1;
  const size = Math.max(18, Math.min(30, (bottom - top - (n - 1) * 4) / n));
  rail.style.setProperty('--dot', size.toFixed(1) + 'px');
  rail.style.top = Math.round(top) + 'px';
}
let railRaf = 0;
function pointToCar(btn) {
  const id = btn.dataset.lab, until = performance.now() + 3600, svg = $('#annot'), path = $('#railPath'), dot = $('#railDot');
  race.reveal(id, 3600);
  race.follow(id);
  track('lab', { lab: id, from: 'rail' });
  document.querySelectorAll('.rail-dot').forEach((d) => d.classList.toggle('on', d === btn));
  cancelAnimationFrame(railRaf);
  const tick = () => {
    if (performance.now() > until) { svg.classList.remove('rail'); btn.classList.remove('on'); return; }
    railRaf = requestAnimationFrame(tick);
    const a = race.anchorOf(id), r = btn.getBoundingClientRect();
    if (!a || !a.car) { svg.classList.remove('rail'); return; }
    const sx = r.right + 3, sy = r.top + r.height / 2, tx = a.car.x, ty = a.car.y;
    path.setAttribute('d', `M${sx},${sy} C${(sx + tx) / 2},${sy} ${tx},${(sy + ty) / 2} ${tx},${ty}`);
    dot.setAttribute('cx', tx); dot.setAttribute('cy', ty);
    svg.classList.add('rail');
  };
  tick();
}

/* ---------- "according to" source menu on the chip itself ---------- */
function renderSourceMenu() {
  const menu = $('#srcmenu'), smart = METRICS.find((x) => x.sources);
  if (!menu || !smart) return;
  menu.innerHTML = `<p class="srchead">${esc(t('source.head', 'According to'))}</p>` + smart.sources.map((s) =>
    `<button class="opt" type="button" role="option" data-key="${esc(s.key)}" aria-selected="${s.key === smart.sourceKey}">${esc(s.short)}</button>`).join('')
    + `<p class="srchint">${esc(t('source.hint', '\u2191 \u2193 to change source'))}</p>`;
  menu.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => { pickSource(b.dataset.key, 'source-menu'); closeSourceMenu(); }));
}
function pickSource(key, via) {
  const smart = METRICS.find((x) => x.sources);
  if (!smart || key === smart.sourceKey) return;
  smart.pick(key);
  try { localStorage.setItem('ai-race:smartest', key); } catch (err) { /* storage blocked */ }
  applyMetric(smart);
  if (via) track('race', { race: slugFor(smart), via });
}
function stepSource(dir, via) {
  const smart = METRICS.find((x) => x.sources);
  const i = smart.sources.findIndex((s) => s.key === smart.sourceKey);
  pickSource(smart.sources[(i + dir + smart.sources.length) % smart.sources.length].key, via);
}
function openSourceMenu(anchor) {
  const menu = $('#srcmenu');
  renderSourceMenu();
  menu.hidden = false;
  const r = anchor.getBoundingClientRect(), mr = menu.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(innerWidth - mr.width - 8, r.right - mr.width)) + 'px';
  menu.style.top = Math.max(8, r.top - mr.height - 10) + 'px';
  anchor.setAttribute('aria-expanded', 'true');
}
function closeSourceMenu() {
  const menu = $('#srcmenu');
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  document.querySelectorAll('.chev').forEach((c) => c.setAttribute('aria-expanded', 'false'));
}

function calloutFor(m, st) {
  const w = st.ranked[0]; if (!w) return '';
  const lab = esc(nameOf(w.l.lab));
  // The dash earns its place: "GPT-Live-1 3 days ago" reads as "1 3" without it.
  if (m.id === 'fresh') return t('callout.fresh', '<b>{lab}</b> shipped <b>{model}</b> — {when}.', { lab, model: esc(w.l.latest.name), when: esc(ago(w.l.daysSince)) });
  if (m.id === 'busy') {
    return t('callout.busy', '<b>{lab}</b> shipped <b>{n}</b> models in 12 months — about one every {every} days.',
      { lab, n: w.l.recentCount, every: Math.round(365 / w.l.recentCount) });
  }
  if (m.id === 'cheap') return t('callout.cheap', '<b>{lab}</b> will run you <b>{price}</b> per million tokens.', { lab, price: '$' + w.v.toFixed(2) });
  if (m.id === 'ctx') return t('callout.ctx', '<b>{lab}</b> can read <b>{ctx}</b> tokens at once.', { lab, ctx: esc(m.fmt(w.v)) });
  const det = m.detail ? m.detail(w.l) : null;
  const who = esc(det ? det.model.name : t('callout.flagship', 'its flagship'));
  return t('callout.lens', '<b>{lab}</b> leads: <b>{who}</b> scores <b>{score}</b> on {unit}.', { lab, who, score: esc(m.fmt(w.v)), unit: esc(m.unit) });
}

function flagImg(lab) {
  const c = COUNTRY[lab.lab];
  const src = c && FLAG[c];
  return src ? `<img class="flag" src="${src}" alt="" loading="lazy">` : '';
}

/** Inline brand mark for HTML surfaces; monogram when we have no path. */
function markup(lab) {
  const r = RASTER[lab.lab];
  if (r) return `<img class="mk" src="${r}" alt="" loading="lazy">`;
  const d = LOGO[lab.lab];
  if (d) return `<svg class="mk" viewBox="0 0 24 24" aria-hidden="true" style="fill:${hex(lab.color)}"><path d="${d}"/></svg>`;
  return `<i class="mk mono" style="background:${hex(lab.color)}">${esc(lab.lab.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase())}</i>`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* The address bar always holds a link to the race on screen (/cheapest, /smartest-gpqa), so the
   link a visitor copies or shares opens on that race with its own preview. */
function syncRaceUrl(m, first) {
  const url = new URL(location.href), plain = url.pathname === '/' || url.pathname.endsWith('/index.html');
  if (first && plain && !url.searchParams.has('race')) return;     // a plain visit keeps its plain address
  url.pathname = '/' + slugFor(m);
  url.searchParams.delete('race');
  if (url.href !== location.href) history.replaceState(null, '', url);
}

/* ---------- analytics ----------
   Umami on dat.d1.tel, which only counts airace.lol and race.lab.sael.net. Its automatic tracking is
   off (index.html): the address bar follows the race and auto-play changes it every 14 seconds, which
   would log a page view each time. One page view is sent on arrival; what visitors choose to do is an
   event. Auto-play's own race changes are never events. */
function track(name, data) {
  const send = () => {
    try { if (window.umami) (name ? window.umami.track(name, data) : window.umami.track()); } catch (e) { /* never break the race */ }
  };
  if (window.umami || document.readyState === 'complete') send(); else addEventListener('load', send, { once: true });
}
// how long the race held a visible tab: marks at 30 s, 2 min and 5 min
function trackWatching() {
  const marks = [30, 120, 300];
  let seen = 0;
  const tick = setInterval(() => {
    if (document.hidden) return;
    seen += 5;
    if (seen >= marks[0]) track('watching', { seconds: marks.shift() });
    if (!marks.length) clearInterval(tick);
  }, 5000);
}

/* ---------- race commentary ---------- */
let lastRaceKey = null, lastLeader = null, commentaryTimer = 0;
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
const RACE_NAME = { fresh: 'Freshest release', busy: 'Most shipped', cheap: 'Price check', ctx: 'Biggest memory',
  aaCoding: 'Best coder', aaAgentic: 'Best agent', designArena: 'Best designer', terminalBench4: 'Runs a computer best' };

/* One line from the race caller: which race, who leads, why, and who they passed. Each language
   orders the parts its own way, so the whole line is one template. */
function commentaryFor(m, st, prevLeader) {
  const r = st.all.find((x) => x.rank === 1);
  if (!r) return null;
  const held = prevLeader === r.l.lab;
  const passed = !held && prevLeader && st.all.some((x) => x.l.lab === prevLeader && x.rank) ? nameOf(prevLeader) : null;
  const why = reasonFor(m, r);
  const src = m.sources && m.sources.find((x) => x.key === m.sourceKey);
  const race = src ? t('cm.smartestBy', 'Smartest, according to {source}', { source: src.short }) : t('race.' + m.id + '.caller', RACE_NAME[m.id] || m.title);
  const verb = pickOne((held ? t('cm.hold', 'holds the lead|stays out front|keeps P1')
    : t('cm.take', 'takes the lead|storms to the front|grabs P1|surges ahead')).split('|'));
  return t('cm.line', '<b>{race}:</b> {lab} {verb}{why}{passed}.', {
    race: esc(race), lab: esc(nameOf(r.l.lab)), verb: esc(verb),
    why: why ? t('cm.why', ' {why}', { why: esc(why) }) : '',
    passed: passed ? t('cm.passing', ', passing {name}', { name: esc(passed) }) : ''
  });
}
function showCommentary(html) {
  const el = $('#commentary');
  if (!el || !html) return;
  el.querySelector('.cm-text').innerHTML = html;
  placeCommentary();
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(commentaryTimer);
  commentaryTimer = setTimeout(() => el.classList.remove('on'), 5200);
}
// top centre, in the open strip between the headline and the circuit picker; where that strip is
// too narrow (small laptops, phones) it sits just under the headline, clear of the rank rail
function placeCommentary() {
  const el = $('#commentary');
  if (!el) return;
  // (fixed elements such as the rail have no offsetParent, so visibility is judged by size)
  const box = (sel) => { const e = $(sel), r = e && !e.hidden && e.getBoundingClientRect(); return r && r.width ? r : null; };
  const head = $('header').getBoundingClientRect(), nav = box('#circuits'), rail = box('#rail'), board = box('#board');
  // 44px each side leaves room for the backdrop's feathered edge
  const from = head.right + 44, to = (nav ? nav.left : innerWidth) - 44;
  if (innerWidth > 860 && to - from >= 380) {
    el.style.top = Math.round(nav ? nav.top + 2 : 24) + 'px';
    el.style.left = Math.round(from) + 'px';
    el.style.right = Math.round(innerWidth - to) + 'px';
  } else {
    const beside = board && board.right < innerWidth * .5 && board.top < head.bottom + 80;
    el.style.top = Math.round(head.bottom + 12) + 'px';
    el.style.left = Math.round(rail ? rail.right + 18 : beside ? board.right + 16 : 12) + 'px';
    el.style.right = '18px';
  }
}

/* ---------- auto-play: the next race after 14 idle seconds ---------- */
const AUTO_MS = 14000;   // a change takes ~10 s to merge back onto the line; the race rests in slow motion before the next
const AUTOPLAY_BUTTON = '<button id="autoplay" class="autoplay" type="button">'
  + '<svg class="ap-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16"/></svg>'
  + '<svg class="ap-icon" viewBox="0 0 24 24" aria-hidden="true"><path class="ap-pause" d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/>'
  + '<path class="ap-play" d="M8 5.2v13.6L19 12z"/></svg></button>';
let autoOn = true, autoTimer = 0, renderAutoplay = () => {}, renderShuffle = () => {};
function wireAutoplay() {
  const btn = $('#autoplay');
  if (!btn) return;
  let saved = null;
  try { saved = localStorage.getItem('race:autoplay'); } catch (e) { /* storage blocked */ }
  autoOn = saved ? saved === 'on' : !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const render = renderAutoplay = () => {
    btn.classList.toggle('playing', autoOn);
    btn.setAttribute('aria-pressed', String(autoOn));
    btn.setAttribute('aria-label', autoOn ? t('autoplay.pause', 'Pause auto-play') : t('autoplay.playAria', 'Auto-play: next race every 14 seconds'));
    btn.title = autoOn ? t('autoplay.pause', 'Pause auto-play') : t('autoplay.playTitle', 'Play: next race every 14 seconds when idle');
  };
  btn.addEventListener('click', () => {
    autoOn = !autoOn;
    try { localStorage.setItem('race:autoplay', autoOn ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
    track('autoplay', { on: autoOn });
    render(); restartAuto();
  });
  // a click, key, scroll or touch restarts the idle clock; a pointer passing over the page does not
  for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(type, restartAuto, { passive: true });
  document.addEventListener('visibilitychange', restartAuto);
  render(); restartAuto();
}
function restartAuto() {
  clearTimeout(autoTimer);
  const btn = $('#autoplay');
  if (btn) { btn.classList.remove('tick'); void btn.offsetWidth; }
  if (!autoOn || document.hidden) return;
  if (btn) btn.classList.add('tick');
  autoTimer = setTimeout(autoStep, AUTO_MS);
}
function autoStep() {
  // hold while someone is reading a card, choosing a source or a circuit is building, then go as
  // soon as that ends rather than starting the full wait again
  if (cardState.id || !$('#srcmenu').hidden || !$('#langmenu').hidden || document.body.classList.contains('building')) {
    autoTimer = setTimeout(autoStep, 1000);
    return;
  }
  if (shuffleOn) goToMetric(randomMetric()); else stepMetric(1);
  restartAuto();
}

function goToMetric(next, via) {
  if (!next) return;
  closeSourceMenu();
  applyMetric(next);
  if (via) track('race', { race: slugFor(next), via });
  const chip = document.querySelector(`.chip[data-id="${next.id}"]`);
  if (chip) chip.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
}
const stepMetric = (dir, via) => goToMetric(METRICS[(METRICS.indexOf(metric) + dir + METRICS.length) % METRICS.length], via);

/* ---------- shuffle: races in random order ---------- */
const SHUFFLE_BUTTON = '<button id="shuffle" class="autoplay shuffle" type="button">'
  + '<svg class="ap-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 9.2 5.4 4 4 5.4l5.2 5.2 1.4-1.4zM14.5 4l2 2L4 18.6 5.4 20 18 7.5l2 2V4h-5.5zm.3 9.4-1.4 1.4 3.1 3.1-2 2.1H20v-5.5l-2 2-3.2-3.1z"/></svg></button>';
let shuffleOn = false, shuffleBag = [];
// every race comes up once, in random order, before any repeats
function randomMetric() {
  if (!shuffleBag.length) shuffleBag = METRICS.filter((x) => x !== metric).sort(() => Math.random() - .5);
  let next = shuffleBag.pop();
  if (next === metric && shuffleBag.length) next = shuffleBag.pop();
  return next;
}
function wireShuffle() {
  const btn = $('#shuffle');
  if (!btn) return;
  try { shuffleOn = localStorage.getItem('race:shuffle') === 'on'; } catch (e) { /* storage blocked */ }
  const render = renderShuffle = () => {
    btn.classList.toggle('on', shuffleOn);
    btn.setAttribute('aria-pressed', String(shuffleOn));
    btn.setAttribute('aria-label', t('shuffle.aria', 'Shuffle races'));
    btn.title = shuffleOn ? t('shuffle.on', 'Shuffle is on: auto-play picks races at random') : t('shuffle.off', 'Shuffle: jump to a random race');
  };
  btn.addEventListener('click', () => {
    shuffleOn = !shuffleOn;
    try { localStorage.setItem('race:shuffle', shuffleOn ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
    render();
    track('shuffle', { on: shuffleOn });
    if (shuffleOn) { shuffleBag = []; goToMetric(randomMetric(), 'shuffle'); }
  });
  render();
}
function toast(text, ms = 1800) {
  const el = $('#toast');
  if (!el) return;
  el.style.top = Math.round($('header').getBoundingClientRect().bottom + 10) + 'px';
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('on'), ms);
}
const noteSwiped = () => { try { localStorage.setItem('race:swiped', '1'); } catch (e) { /* storage blocked */ } };

/* Touch screens: swipe left/right to switch race, up/down to change the "according to" source.
   Swipes that start on something that scrolls or taps (chips, standings, rail, card) are theirs. */
function wireSwipes() {
  const theirs = '#chips, #board, #rail, #card, #srcmenu, #langmenu, .brandrow, #marquee, #circuits, #foot';
  let start = null;
  addEventListener('touchstart', (e) => {
    const p = e.touches[0];
    start = e.touches.length === 1 && !e.target.closest(theirs) ? { x: p.clientX, y: p.clientY, t: e.timeStamp } : null;
  }, { passive: true });
  addEventListener('touchcancel', () => { start = null; }, { passive: true });
  addEventListener('touchend', (e) => {
    const s = start, p = e.changedTouches[0];
    start = null;
    if (!s || !p || e.timeStamp - s.t > 800) return;
    const dx = p.clientX - s.x, dy = p.clientY - s.y;
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.3) { stepMetric(dx < 0 ? 1 : -1, 'swipe'); noteSwiped(); return; }
    if (Math.abs(dy) < 44 || Math.abs(dy) < Math.abs(dx) * 1.3) return;
    noteSwiped();
    if (!metric.sources) { toast(t('swipe.source', 'Swipe up or down on \u201cWho\u2019s smartest?\u201d to change source')); return; }
    stepSource(dy < 0 ? 1 : -1, 'swipe');   // the commentary line names the new source
  }, { passive: true });
  let swiped = false;
  try { swiped = localStorage.getItem('race:swiped') === '1'; } catch (e) { /* storage blocked */ }
  if (!swiped && matchMedia('(pointer: coarse)').matches) setTimeout(() => toast(t('swipe.hint', 'Swipe \u2190 \u2192 to switch race'), 3200), 2600);
}

let cardState = { id: null, mode: 'center', pinned: false, row: null };
const desktopHover = () => innerWidth > 860 && matchMedia('(hover: hover) and (pointer: fine)').matches;

/* The lab card has three homes: centred (phones), beside a standings row (desktop hover), or
   under the circuit picker with a dashed line to the car's label (desktop, from the 3D view). */
function fillCard(lab) {
  const m = lab.latest;
  $('#cardName').innerHTML = markup(lab) + flagImg(lab) + esc(nameOf(lab.lab));
  $('#cardHead').style.setProperty('--wash',
    `linear-gradient(135deg, ${hex(lab.color)}2E, ${hex(lab.color)}0A)`);
  $('#cardSub').textContent = t('card.latest', 'Latest: {model} — {date}', { model: m.name, date: fmtDate(m.released) });
  const lensHit = metric.detail ? metric.detail(lab) : null;
  const fmtCtx = (v) => (v >= 1e6 ? (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + 'M' : Math.round(v / 1000) + 'K');
  const rows = [
    [t('card.releases', 'Releases (12mo)'), lab.recentCount],
    [t('card.models', 'Models tracked'), lab.total],
    [t('card.last', 'Last shipped'), ago(lab.daysSince)],
    lab.cheapest != null && [t('card.cheapest', 'Cheapest'), '$' + lab.cheapest.toFixed(2) + '/1M'],
    lab.maxCtx != null && [t('card.context', 'Biggest context'), t('card.tokens', '{ctx} tokens', { ctx: fmtCtx(lab.maxCtx) })],
    lensHit && [metric.unit, metric.fmt(lensHit.v) + ' · ' + lensHit.model.name]
  ].filter(Boolean);
  $('#cardData').innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
}
function openCard(lab, { mode = 'center', row = null, pinned = true } = {}) {
  if (!lab) return;
  fillCard(lab);
  const card = $('#card');
  card.classList.toggle('at-row', mode === 'row');
  card.classList.toggle('at-corner', mode === 'corner');
  cardState = { id: lab.lab, mode, pinned, row };
  if (race && pinned) race.follow(lab.lab);             // riding cameras switch to the lab you pick
  if (pinned) track('lab', { lab: lab.lab, from: mode });
  placeCard();
  card.classList.add('on');
  if (race) race.highlight(lab.lab);
  if (mode === 'corner') startAnnotation(); else stopAnnotation();
}
function placeCard() {
  const card = $('#card'), { mode, row } = cardState;
  if (mode === 'row' && row) {
    const b = $('#board').getBoundingClientRect(), r = row.getBoundingClientRect(), h = card.offsetHeight;
    const top = Math.max(12, Math.min(innerHeight - h - 12, r.top + r.height / 2 - h / 2));
    card.style.setProperty('--cx', `${Math.round(b.right + 16)}px`);
    card.style.setProperty('--cy', `${Math.round(top)}px`);
    card.style.setProperty('--ny', `${Math.round(r.top + r.height / 2 - top)}px`);
  } else if (mode === 'corner') {
    const n = $('#circuits').getBoundingClientRect();
    card.style.setProperty('--cy', `${Math.round(n.bottom + 14)}px`);
  }
}
function closeCard() {
  $('#card').classList.remove('on');
  cardState = { id: null, mode: 'center', pinned: false, row: null };
  stopAnnotation();
  if (race) { race.highlight(null); race.follow(null); }
}
let annotRaf = 0;
function startAnnotation() {
  cancelAnimationFrame(annotRaf);
  const svg = $('#annot'), path = $('#annotPath'), dot = $('#annotDot');
  const tick = () => {
    annotRaf = requestAnimationFrame(tick);
    const a = cardState.id && race && race.anchorOf(cardState.id);
    const target = a && (a.label ? { x: a.label.x, y: a.label.y - 3 } : a.car);
    if (!target || cardState.mode !== 'corner') { svg.classList.remove('on'); return; }
    const r = $('#card').getBoundingClientRect(), sx = r.left, sy = r.top + 34;
    path.setAttribute('d', `M${sx},${sy} C${(sx + target.x) / 2},${sy} ${target.x},${(sy + target.y) / 2} ${target.x},${target.y}`);
    dot.setAttribute('cx', target.x); dot.setAttribute('cy', target.y);
    svg.classList.add('on');
  };
  tick();
}
function stopAnnotation() { cancelAnimationFrame(annotRaf); $('#annot').classList.remove('on'); }

function wireInput() {
  const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
  $('#chips').innerHTML = AUTOPLAY_BUTTON + SHUFFLE_BUTTON + METRICS.map((m) => (m.sources
    ? `<span class="chipwrap" data-id="${m.id}"><button class="chip has-src" type="button" data-id="${m.id}" aria-pressed="false">${esc(m.chip)}</button>`
      + `<button class="chev" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="srcmenu" aria-label="${esc(t('chip.sourceAria', 'Choose the source for {race}', { race: m.chip }))}">${CHEV}</button></span>`
    : `<button class="chip" type="button" data-id="${m.id}" aria-pressed="false">${esc(m.chip)}</button>`)).join('');
  $('#chips').querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
    const m = METRICS.find((x) => x.id === c.dataset.id);
    applyMetric(m);
    track('race', { race: slugFor(m), via: 'chip' });
  }));
  $('#chips').querySelectorAll('.chev').forEach((c) => c.addEventListener('click', (e) => {
    e.stopPropagation();
    const wrap = c.closest('.chipwrap'), m = METRICS.find((x) => x.id === wrap.dataset.id);
    if (metric !== m) applyMetric(m);
    if ($('#srcmenu').hidden) openSourceMenu(c); else closeSourceMenu();
  }));
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#srcmenu') && !e.target.closest('.chev')) closeSourceMenu();
  });

  const smart = METRICS.find((m) => m.sources);
  if (smart) {
    $('#source').innerHTML = smart.sources.map((s) =>
      `<option value="${esc(s.key)}">${esc(s.short)}</option>`).join('');
    $('#source').addEventListener('change', (e) => {
      const smart = METRICS.find((m) => m.sources);          // the model is rebuilt when the language changes
      smart.pick(e.target.value);
      try { localStorage.setItem('ai-race:smartest', e.target.value); } catch (err) { /* storage blocked */ }
      applyMetric(smart);
      track('race', { race: slugFor(smart), via: 'source-select' });
    });
  }

  const board = $('#board');
  const narrow = () => innerWidth <= 860;
  $('#toggle').textContent = toggleText(true);
  if (narrow()) board.classList.add('min');
  board.dataset.narrow = String(narrow());
  $('#toggle').addEventListener('click', () => {
    const min = board.classList.toggle('min');
    $('#toggle').textContent = toggleText(min);
    $('#toggle').setAttribute('aria-expanded', String(!min));
    if (race) race.resize();
  });
  /* The standings sheet collapses on phones. Flip it when the breakpoint is crossed
     (rotation, resize); a manual toggle in between stands. */
  addEventListener('resize', () => {
    if (board.dataset.narrow === String(narrow())) return;
    board.dataset.narrow = String(narrow());
    board.classList.toggle('min', narrow());
    $('#toggle').textContent = toggleText(narrow());
    $('#toggle').setAttribute('aria-expanded', String(!narrow()));
    if (race) race.resize();
  });

  addEventListener('resize', () => { layoutRail(); placeCommentary(); if (cardState.id) placeCard(); });
  $('#replay').addEventListener('click', () => { applyMetric(metric, true); track('replay', { race: slugFor(metric) }); });
  $('#followx').addEventListener('click', () => track('follow-x', { placement: 'footer' }));
  $('#close').addEventListener('click', closeCard);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeCard(); closeSourceMenu(); closeLangMenu(); return; }
    const el = e.target;
    // a focused <select> uses the arrows to change its own option
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
    if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey && !e.altKey) { cycleCam(); return; }
    if ((e.key === 'l' || e.key === 'L') && !e.metaKey && !e.ctrlKey && !e.altKey) { cycleLabels(); return; }
    // up/down change the "according to" source while a race that has one is showing
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && metric && metric.sources) {
      e.preventDefault();
      stepSource(e.key === 'ArrowDown' ? 1 : -1, 'key');
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    stepMetric(e.key === 'ArrowRight' ? 1 : -1, 'key');
  });
  wireSwipes();
  wireAutoplay();
  wireShuffle();

  renderCredits();

  // phones keep the credits one tap away, so the race gets the height
  const srcBtn = $('#srcToggle');
  if (srcBtn) srcBtn.addEventListener('click', () => {
    const open = $('#foot').classList.toggle('open');
    srcBtn.setAttribute('aria-expanded', String(open));
    if (race) race.resize();
  });
}

/* Phones get the sponsors as a scrolling strip: trackside boards are too small to read there.
   The list runs twice so the loop is seamless; screen readers get it once. */
function renderMarquee() {
  const box = $('#marquee');
  if (!box || !SPONSORS.length) return;
  const item = (sp, dup) => {
    const style = `background:${esc(sp.bg || '#FFF6E9')};color:${esc(sp.fg || '#231A08')}`;
    const inner = sp.logo ? `<img src="${esc(sp.logo)}" alt="${esc(sp.text)}">` : esc(sp.text);
    const hidden = dup ? ' aria-hidden="true" tabindex="-1"' : '';
    return sp.href
      ? `<a class="mq-item" href="${esc(withRef(sp.href))}" target="_blank" rel="noopener" data-sponsor="${esc(sp.id || sp.text)}" style="${style}"${hidden}>${inner}</a>`
      : `<span class="mq-item" style="${style}"${dup ? ' aria-hidden="true"' : ''}>${inner}</span>`;
  };
  box.querySelector('.mq-track').innerHTML = SPONSORS.map((sp) => item(sp, false)).join('') + SPONSORS.map((sp) => item(sp, true)).join('');
  box.querySelectorAll('a.mq-item').forEach((a) => a.addEventListener('click', () => track('sponsor-click', { sponsor: a.dataset.sponsor, placement: 'marquee' })));
  box.hidden = false;
}

/* ---------- language ----------
   English is built in; Simplified Chinese and Japanese load one small strings file (a visit in either
   language already fetched it in <head>). Switching rebuilds the model's strings and relabels the page
   in place, so the race keeps running. */
const EN_TITLE = document.title;
const GLOBE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>';
const toggleText = (min) => (min ? t('board.all', 'See all {n}', { n: LABS.length }) : t('board.less', 'Show less'));

// markup carries its English in the page: data-t for text, data-t-aria-label and data-t-title for attributes
function translateStatic() {
  document.querySelectorAll('[data-t]').forEach((el) => {
    if (el.dataset.en == null) el.dataset.en = el.textContent;
    el.textContent = t(el.dataset.t, el.dataset.en);
  });
  for (const [attr, store] of [['aria-label', 'enAria'], ['title', 'enTitle']]) {
    document.querySelectorAll(`[data-t-${attr}]`).forEach((el) => {
      if (el.dataset[store] == null) el.dataset[store] = el.getAttribute(attr) || '';
      el.setAttribute(attr, t(el.getAttribute(`data-t-${attr}`), el.dataset[store]));
    });
  }
  document.title = lang === 'en' ? EN_TITLE : t('site.title', EN_TITLE);
}
function renderCredits() {
  const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${esc(text)}</a>`;
  $('#src').innerHTML = t('foot.credits', 'Releases, pricing, context and benchmark indices from {openrouter} (indices by {aa}, {da}), with new Gemini models from {gemini}. Terminal-Bench from its own {tb}. Other “smartest” sources from {epoch} (CC-BY 4.0), {arc} and {sb}. Built {date}. Gaps between racers are widened for legibility; the order is exact.', {
    openrouter: a('https://openrouter.ai', 'OpenRouter'), aa: a('https://artificialanalysis.ai', 'Artificial Analysis'),
    da: a('https://www.designarena.ai', 'Design Arena'), gemini: a('https://ai.google.dev/gemini-api/docs/models', t('foot.geminiLink', 'Google’s model list')),
    tb: a('https://github.com/harbor-framework/terminal-bench', t('foot.tbLink', 'Apache-2.0 leaderboard')),
    epoch: a('https://epoch.ai/benchmarks', 'Epoch AI'), arc: a('https://arcprize.org/leaderboard', 'ARC Prize'),
    sb: a('https://simple-bench.com', 'SimpleBench'), date: esc((DATA.generatedAt || '').slice(0, 10))
  });
  // launches added by hand (src/announced.mjs) because OpenRouter's model list doesn't carry them yet
  const own = (DATA.models || []).filter((m) => m.src === 'announced' && /^https:\/\//.test(m.url || ''));
  if (own.length) $('#src').insertAdjacentHTML('beforeend', ' ' + t('foot.announced2', 'Added ahead of OpenRouter’s model list: {links}.',
    { links: own.map((m) => a(m.url, m.name)).join(', ') }));
}
function renderLangButton() {
  const btn = $('#langBtn'), cur = LANGS.find((l) => l.code === lang);
  if (!btn) return;
  btn.innerHTML = `${GLOBE}<span lang="${cur.html}">${cur.short}</span>`;
  btn.setAttribute('aria-label', t('lang.aria', 'Language: {name}', { name: cur.name }));
  btn.title = t('lang.menu', 'Language');
}
function closeLangMenu() {
  const menu = $('#langmenu');
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  $('#langBtn').setAttribute('aria-expanded', 'false');
}
function wireLanguage() {
  const btn = $('#langBtn'), menu = $('#langmenu');
  if (!btn || !menu) return;
  // each language is named in itself, and marked so it renders with its own glyphs
  menu.innerHTML = LANGS.map((l) => `<button class="opt" type="button" role="menuitemradio" data-lang="${l.code}" lang="${l.html}">${l.name}</button>`).join('');
  btn.addEventListener('click', () => {
    if (!menu.hidden) { closeLangMenu(); return; }
    menu.querySelectorAll('.opt').forEach((o) => o.setAttribute('aria-checked', String(o.dataset.lang === lang)));
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    const r = btn.getBoundingClientRect();
    menu.style.left = Math.round(Math.max(8, Math.min(r.left, innerWidth - menu.offsetWidth - 8))) + 'px';
    menu.style.top = Math.round(r.bottom + 8) + 'px';
    const cur = menu.querySelector('[aria-checked="true"]');
    if (cur) cur.focus({ preventScroll: true });
  });
  menu.querySelectorAll('.opt').forEach((o) => o.addEventListener('click', () => { closeLangMenu(); setLanguage(o.dataset.lang); }));
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#langmenu, #langBtn')) closeLangMenu(); });
  renderLangButton();
}
async function setLanguage(code) {
  if (code === lang || !LANGS.some((l) => l.code === code)) return;
  let strings = null;
  if (code !== 'en') {
    const url = window.__lang ? window.__lang.url(code) : `i18n/${code}.json`;
    strings = await fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!strings) return;
  }
  useStrings(code, strings);
  try { localStorage.setItem('race:lang', code); } catch (e) { /* storage blocked */ }
  document.documentElement.lang = LANGS.find((l) => l.code === code).html;
  // race titles, notes and number formats live in the model: rebuild it in the new language
  const smart = METRICS.find((x) => x.sources), id = metric.id;
  ({ LABS, METRICS, NOW } = buildModel(DATA, { savedSource: smart ? smart.sourceKey : null }));
  metric = METRICS.find((x) => x.id === id) || METRICS[0];
  shuffleBag = [];
  relabel();
  track('language', { lang: code });
}
function relabel() {
  translateStatic();
  renderLangButton();
  labelCircuits();
  setCam(race.cam, { quiet: true });
  setRide(race.ride, { quiet: true });
  setLabels(race.labels, { quiet: true });
  renderAutoplay();
  renderShuffle();
  document.querySelectorAll('#chips .chip').forEach((c) => { const m = METRICS.find((x) => x.id === c.dataset.id); if (m) c.textContent = m.chip; });
  document.querySelectorAll('#chips .chev').forEach((c) => {
    const m = METRICS.find((x) => x.id === c.closest('.chipwrap').dataset.id);
    if (m) c.setAttribute('aria-label', t('chip.sourceAria', 'Choose the source for {race}', { race: m.chip }));
  });
  const smart = METRICS.find((x) => x.sources);
  if (smart) $('#source').innerHTML = smart.sources.map((s) => `<option value="${esc(s.key)}">${esc(s.short)}</option>`).join('');
  $('#toggle').textContent = toggleText($('#board').classList.contains('min'));
  renderCredits();
  renderStudio();
  applyMetric(metric, false, { quiet: true });
  if (cardState.id) fillCard(LABS.find((l) => l.lab === cardState.id));
  layoutRail();
  placeCommentary();
  race.resize();
}

/* ============================ STUDIO ============================
   A hidden panel of camera effects after Token Town (tt.lab.sael.net): macro (tilt-shift), shutter
   (long-exposure light trails), timelapse and the day/night clock. ⌘' (Ctrl+' elsewhere) opens it.
   Everything starts off, so visitors see the signed-off look; settings are kept on this device, and
   the panel reopens by itself whenever something in it is on. */
const LAPSES = [1, 4, 8, 16];
let studioOpen = false, studioHintTimer = 0;
// the focus slider runs 3 m to 600 m on a log scale, so the near end has the room
const focusFromSlider = (v) => 3 * Math.pow(200, v), sliderFromFocus = (f) => Math.log(Math.max(3, f) / 3) / Math.log(200);
const clockText = (h) => { const q = Math.floor(h * 4) % 96; return `${String(q >> 2).padStart(2, '0')}:${String((q & 3) * 15).padStart(2, '0')}`; };
const studioActive = (s) => s.macro || s.shutter > 0 || s.cycle || Math.abs(s.hour - 13) > .01 || s.lapse !== 1;
function saveStudio() {
  try { localStorage.setItem('race:studio', JSON.stringify({ ...race.studio.get(), open: studioOpen })); } catch (e) { /* storage blocked */ }
}
function renderStudio() {
  let el = $('#studio');
  if (!el) { el = document.createElement('div'); el.id = 'studio'; el.hidden = true; document.body.append(el); }
  const kb = (k) => `<kbd>${k}</kbd>`;
  el.innerHTML = `<p class="st-keys" aria-hidden="true">${t('studio.keys2', '{shutter} shutter · {macro} macro · {focus} focus · {near} {far} nearer/farther · {day} day/night · {hour} hour · {lapse} timelapse · {hide} hide UI', {
      shutter: kb('[') + ' ' + kb(']'), macro: kb('M'), focus: kb('F'), near: kb('-'), far: kb('='), day: kb('D'), hour: kb(',') + ' ' + kb('.'), lapse: kb('1') + '–' + kb('4'), hide: kb('/') })}</p>
    <div class="st-bar" role="group" aria-label="${esc(t('studio.aria', 'Camera effects'))}">
      <label class="st-check"><input type="checkbox" data-k="macro"><span>${esc(t('studio.macro', 'Macro'))}</span></label>
      <label class="st-check"><input type="checkbox" data-k="focusAuto"><span>${esc(t('studio.focusAuto', 'Auto focus'))}</span></label>
      <label class="st-range"><output class="st-focus"></output><input type="range" data-k="focus" min="0" max="1" step="0.005" aria-label="${esc(t('studio.focus', 'Focus distance'))}"></label><i class="st-sep"></i>
      <label class="st-range"><span>${esc(t('studio.shutter', 'Shutter'))}</span><input type="range" data-k="shutter" min="0" max="4" step="0.1"></label><i class="st-sep"></i>
      <button type="button" class="st-lapse" data-k="lapse"></button><i class="st-sep"></i>
      <label class="st-check"><input type="checkbox" data-k="cycle"><span>${esc(t('studio.cycle', 'Day/night'))}</span></label><i class="st-sep"></i>
      <label class="st-range"><output class="st-clock"></output><input type="range" data-k="hour" min="0" max="23.75" step="0.25" aria-label="${esc(t('studio.hour', 'Time of day'))}"></label>
    </div>`;
  const q = (k) => el.querySelector(`[data-k="${k}"]`), set = (p) => { race.studio.set(p); syncStudio(); saveStudio(); };
  q('macro').onchange = (e) => set({ macro: e.target.checked });
  q('focusAuto').onchange = (e) => set({ focusAuto: e.target.checked });
  q('focus').oninput = (e) => set({ focusAuto: false, focus: focusFromSlider(+e.target.value) });
  q('shutter').oninput = (e) => set({ shutter: +e.target.value });
  q('cycle').onchange = (e) => set({ cycle: e.target.checked });
  q('hour').oninput = (e) => set({ hour: +e.target.value });
  q('lapse').onclick = () => { const s = race.studio.get(); set({ lapse: LAPSES[(LAPSES.indexOf(s.lapse) + 1) % LAPSES.length] }); };
  syncStudio();
}
function syncStudio() {
  const el = $('#studio'); if (!el) return;
  const s = race.studio.get(), q = (k) => el.querySelector(`[data-k="${k}"]`);
  q('macro').checked = s.macro; q('macro').disabled = !s.macroOK;
  q('macro').closest('label').title = s.macroOK ? '' : t('studio.macroOff', 'Macro needs the desktop renderer');
  q('shutter').value = s.shutter; q('cycle').checked = s.cycle;
  q('focusAuto').checked = s.focusAuto;
  if (document.activeElement !== q('focus')) q('focus').value = sliderFromFocus(s.focusAuto ? s.focusNow : s.focus);
  el.querySelector('.st-focus').textContent = (s.focusAuto ? s.focusNow : s.focus).toFixed(0) + ' m';
  q('focus').closest('label').classList.toggle('st-auto', s.focusAuto);
  if (document.activeElement !== q('hour')) q('hour').value = Math.floor(s.hour * 4) / 4;
  el.querySelector('.st-clock').textContent = clockText(s.hour);
  q('hour').setAttribute('aria-valuetext', clockText(s.hour));
  q('lapse').textContent = s.lapse === 1 ? t('studio.real', '1× real time') : t('studio.lapse', '{n}× timelapse', { n: s.lapse });
}
function toggleStudio(open = !studioOpen) {
  studioOpen = open; $('#studio').hidden = !open;
  if (open) syncStudio();                     // the state may have moved by keyboard while it was closed
  if (!open && $('#studio').contains(document.activeElement)) document.activeElement.blur();
  saveStudio();
}
function toggleUI() {
  const off = document.body.classList.toggle('ui-off');
  if (off && document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  let hint = $('#studiohint');
  if (!hint) { hint = document.createElement('p'); hint.id = 'studiohint'; hint.setAttribute('role', 'status'); document.body.append(hint); }
  hint.textContent = off ? t('studio.hidden', 'Interface hidden · press / to show it') : '';
  hint.classList.toggle('on', off); clearTimeout(studioHintTimer);
  if (off) studioHintTimer = setTimeout(() => hint.classList.remove('on'), 1800);
  race.resize();
}
function wireStudio() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('race:studio') || 'null'); } catch (e) { saved = null; }
  if (saved) race.studio.set(saved);
  renderStudio();
  toggleStudio(!!(saved && (saved.open || studioActive(race.studio.get()))));
  // the shortcuts work with the panel open or the interface hidden, and never while typing
  addEventListener('keydown', (e) => {
    const el = e.target;
    if (el && (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
      || (el.tagName === 'INPUT' && !/^(checkbox|range)$/.test(el.type)))) return;
    if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "'" || e.code === 'Quote')) { e.preventDefault(); toggleStudio(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;   // the effect keys work with the panel closed too
    const s = race.studio.get(), k = e.key.toLowerCase(), set = (p) => { race.studio.set(p); syncStudio(); saveStudio(); };
    if (e.key === '[') set({ shutter: s.shutter - .2 });
    else if (e.key === ']') set({ shutter: s.shutter + .2 });
    else if (k === 'm') set({ macro: !s.macro });
    else if (k === 'f') set({ focusAuto: !s.focusAuto });
    else if (e.key === '-') set({ focusAuto: false, focus: (s.focusAuto ? s.focusNow : s.focus) / 1.18 });
    else if (e.key === '=' || e.key === '+') set({ focusAuto: false, focus: (s.focusAuto ? s.focusNow : s.focus) * 1.18 });
    else if (k === 'd') set({ cycle: !s.cycle });
    else if (e.key === ',') set({ hour: Math.round(s.hour) - 1 });
    else if (e.key === '.') set({ hour: Math.round(s.hour) + 1 });
    else if (e.key >= '1' && e.key <= '4') set({ lapse: LAPSES[+e.key - 1] });
    else if (e.key === '/') toggleUI();
    else return;
    e.preventDefault();
  });
}

/* ============================ BOOT ============================
   Nothing waits for everything. The world goes up as soon as the sponsors are in — terrain, track,
   hoardings, the camera already moving — and the field joins the moment race.json lands, so there is
   no loading screen to sit through. */
(async function boot() {
  try {
    const rect = (el) => { const r = el && el.getBoundingClientRect(); return r && r.width ? r : null; };
    const dataP = loadRace();                 // the big file, already in flight
    await loadSponsors();                     // 2 KB: all the world needs
    mark('sponsors');
    race = createRace({
      canvas: document.getElementById('stage'),
      labelsEl: document.getElementById('labels'),
      sponsors: SPONSORS,
      reduced: REDUCED,
      paintLogo: (ctx, id, cx, cy, size) => {
        const lab = LABS.find((l) => l.lab === id);
        drawLogo(ctx, id, cx, cy, size, lab ? hex(lab.color) : '#333846');
      },
      badgeHTML: (lab) => markup(LABS.find((l) => l.lab === lab.id)),
      onSelect: (id) => (id ? openCard(LABS.find((l) => l.lab === id), desktopHover() ? { mode: 'corner', pinned: true } : {}) : closeCard()),
      onSponsor: (sp) => track('sponsor-click', { sponsor: sp.id || sp.text, placement: 'board', circuit: race.trackId, cam: race.cam }),
      onHover: (id) => {
        if (!desktopHover()) return;
        if (id) { if (!cardState.pinned) openCard(LABS.find((l) => l.lab === id), { mode: 'corner', pinned: false }); }
        else if (!cardState.pinned && cardState.mode === 'corner') closeCard();
      },
      uiRects: () => ({ board: rect($('#board')), chips: rect($('#chips')), header: rect($('header')), rail: rect($('#rail')) }),
      circuit: initialCircuit(),
      ride: initialRide(),
      labels: initialLabels(),
      onClock: () => syncStudio(),
      // ?formation=wide is the old field, a lane per lab across the whole road
      formation: new URLSearchParams(location.search).get('formation') === 'wide' ? 'wide' : 'pack'
    });
    mark('world');
    window.__race = race;                     // for inspection from the console
    document.getElementById('ui').hidden = false;   // the name and headline ride along with the world

    await dataP;
    mark('data');
    translateStatic();
    wireInput();
    renderMarquee();
    await race.setLabs(LABS.map((l) => ({ id: l.lab, name: nameOf(l.lab), color: hex(l.color), paint: hex(l.paint),
      model: (l.latest && l.latest.name) || l.lab })));
    wireCircuits();
    wireCamera();
    wireRide();
    wireLabels();
    wireLanguage();
    wireLiveCount();
    wireStudio();
    track();                        // the one page view, with the address the visitor arrived on
    trackWatching();
    // a shared link opens on its race: /cheapest, /smartest-gpqa, or ?race=cheap
    const linked = raceFromSlug(METRICS, new URLSearchParams(location.search).get('race') || location.pathname.split('/').filter(Boolean).pop());
    if (linked && linked.sourceKey) linked.metric.pick(linked.sourceKey);
    applyMetric(linked ? linked.metric : METRICS[0], true);
    mark('field');
    document.body.classList.remove('booting');
    race.resize();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layoutRail(); race.resize(); });
  } catch (err) {
    document.body.classList.remove('booting');
    const el = document.createElement('p');
    el.id = 'boom';
    el.textContent = t('boot.failed', 'The race could not start: ') + err.message;
    document.body.append(el);
    console.error(err);
  }
})();
