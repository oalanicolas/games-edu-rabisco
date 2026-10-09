/* AI Race — the race model: which labs take a lane, what each race measures, how the field
 * ranks, and each race's share address. Plain data and no DOM, so the page and the build (link
 * previews) rank the field exactly the same way. */

import { t, ago } from './i18n.js?v=fdae2b818c';

export const CFG = { LANES: 16 };
/* Labs that get a lane whenever they appear in the feed. Pure metrics rank by
 * volume and leaderboard position, which drops names everyone expects to see
 * (MiniMax ships rarely; NVIDIA's models rank low) — remaining lanes are filled
 * by the relevance score below. */
export const ROSTER = ['OpenAI', 'Anthropic', 'Google', 'DeepSeek', 'Alibaba', 'Moonshot AI',
  'SpaceXAI', 'Meta', 'MiniMax', 'NVIDIA', 'Mistral', 'Z.AI',
  'TypeSafe', 'InclusionAI', 'StepFun', 'Xiaomi'];
const FALLBACK = [0xFF8A4C, 0x63D2FF, 0xFFD36E, 0xA0E86F, 0xFF7EB6, 0x8FD3FF];

/* Label and paint colours from the SAEL Lab reference build. Z.AI and SpaceXAI race in
   near-white paint with dark labels; everyone else paints in their label colour. */
export const PALETTE = {
  Anthropic: { color: 0xf79740 }, OpenAI: { color: 0x00bdaa },
  'Z.AI': { color: 0x353b46, paint: 0xf4f5f6 }, SpaceXAI: { color: 0x525d70, paint: 0xe8eaee },
  'Moonshot AI': { color: 0xa05bfb }, Google: { color: 0x3279ff }, Alibaba: { color: 0xff8627 },
  Meta: { color: 0x3764fd }, DeepSeek: { color: 0x8869ed }, MiniMax: { color: 0xf27eb1 },
  Tencent: { color: 0x249cf3 }, NVIDIA: { color: 0x97c81a }, Mistral: { color: 0xedb912 },
  Perplexity: { color: 0x568d97 }
};

const rgb2hsl = (n) => {
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, sa = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, sa, l];
};
const hsl2rgb = (h, s, l) => {
  if (s === 0) { const v = Math.round(l * 255); return (v << 16) | (v << 8) | v; }
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p; };
  const c = [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255));
  return (c[0] << 16) | (c[1] << 8) | c[2];
};

/**
 * Brand colours come from each lab's own artwork, so two labs can land on nearly
 * the same hue. Lanes have to stay tellable apart, so a colliding hue is rotated
 * the minimum amount that separates it. Labs in PALETTE override this afterwards.
 */
function assignColours(labs, BRAND) {
  const used = [];
  const dh = (a, b) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));
  const MIN_GAP = .028, MAX_DRIFT = .045;
  labs.forEach((l, i) => {
    let c = BRAND[l.lab] ?? FALLBACK[i % FALLBACK.length];
    let [h, sa, li] = rgb2hsl(c);
    if (sa > .12) {
      const h0 = h;
      let drift = 0, dir = 1;
      while (drift <= MAX_DRIFT &&
             used.some(([uh, us, ul]) => us > .12 && dh(uh, h) < MIN_GAP && Math.abs(ul - li) < .16)) {
        dir = -dir;
        if (dir > 0) drift += .009;
        h = (h0 + dir * drift + 1) % 1;
      }
      if (used.some(([uh, us, ul]) => us > .12 && dh(uh, h) < MIN_GAP && Math.abs(ul - li) < .16)) {
        h = h0;
        li = li > .55 ? Math.max(li - .18, .34) : Math.min(li + .18, .78);
      }
      c = hsl2rgb(h, sa, li);
    }
    used.push([h, sa, li]);
    l.color = c;
  });
}

// whole days since the release date: a model out at 00:00 UTC today reads "today" all day, not "yesterday" after noon
const daysBetween = (a, b) => Math.floor((b - a) / 864e5);

/** Labs, races and the reference date for a race.json snapshot. savedSource picks the
    "according to" source for the smartest race. */
export function buildModel(DATA, { savedSource = null } = {}) {
  const RASTER = DATA.rasters || {}, LOGO = DATA.logos || {}, BRAND = DATA.brands || {};
  DATA.lensBy = Object.fromEntries(DATA.lenses.map((l) => [l.key, l]));
  let NOW, LABS, METRICS;
  NOW = DATA.models.reduce((m, x) => (x.released > m ? x.released : m), '2000-01-01');
  // count from the real today, so a stale feed never calls an old release "today"
  const nowMs = Math.max(Date.now(), new Date(NOW + 'T00:00:00Z').getTime());
  const yearAgo = nowMs - 365 * 864e5;

  const byLab = new Map();
  DATA.models.forEach((m, i) => {
    if (!byLab.has(m.lab)) byLab.set(m.lab, []);
    const ms = new Date(m.released + 'T00:00:00Z').getTime();
    /* exact listing time, when it falls on the release day (an announced date can be earlier),
       so two releases on the same day still race in the order they came out */
    const at = m.at && m.at * 1000 - ms >= 0 && m.at * 1000 - ms < 864e5 ? m.at * 1000 : ms;
    byLab.get(m.lab).push({ ...m, i, ms, at });
  });

  const all = [...byLab.entries()].map(([lab, models]) => {
    models.sort((a, b) => b.ms - a.ms || b.at - a.at);
    const recent = models.filter((m) => m.ms >= yearAgo);
    const priced = models.filter((m) => m.pin != null);
    const ctx = models.filter((m) => m.ctx);
    return {
      lab, models, latest: models[0],
      recentCount: recent.length, total: models.length,
      daysSince: daysBetween(models[0].ms, nowMs),
      // blended price: three tokens in for every one out, the usual convention; a free output counts as free
      cheapest: priced.length ? Math.min(...priced.map((m) => (3 * m.pin + (m.pout || 0)) / 4)) : null,
      maxCtx: ctx.length ? Math.max(...ctx.map((m) => m.ctx)) : null,
      /* No global ranking exists in first-party data, so the lab's newest model is
         its flagship. For a scored lens we take its best measured run. */
      onLens: (key) => {
        const lens = DATA.lensBy[key]; if (!lens) return null;
        let best = null, bm = null;
        for (const m of models) {
          const v = lens.scores[m.i];
          if (v != null && (best === null || v > best)) { best = v; bm = m; }
        }
        return best === null ? null : { v: best, model: bm };
      }
    };
  });

  const maxRecent = Math.max(...all.map((l) => l.recentCount)) || 1;
  for (const l of all) {
    l.relevance = .55 * (l.total / Math.max(...all.map((x) => x.total)))
      + .45 * (l.recentCount / maxRecent);
  }
  all.sort((a, b) => b.relevance - a.relevance);
  const hasMark = (l) => !!(RASTER[l.lab] || LOGO[l.lab]);
  const seated = all.filter((l) => ROSTER.includes(l.lab));
  // fill lanes only with labs we can actually badge; a monogram is not an identity
  const rest = all.filter((l) => !ROSTER.includes(l.lab) && hasMark(l));
  LABS = [...seated, ...rest].slice(0, CFG.LANES);
  LABS.sort((a, b) => b.relevance - a.relevance);
  assignColours(LABS, BRAND);
  for (const l of LABS) {
    const p = PALETTE[l.lab];
    if (p) l.color = p.color;
    l.paint = (p && p.paint) || l.color;
  }

  DATA.hiddenLabs = all.length - LABS.length;
  DATA.hiddenModels = all.filter((l) => !LABS.includes(l)).reduce((s, l) => s + l.total, 0);

  const fmtCtx = (v) => (v >= 1e6 ? (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + 'M' : Math.round(v / 1000) + 'K');

  // everything a visitor reads goes through t(): English here, Chinese or Japanese from i18n/*.json
  METRICS = [
    { id: 'fresh', chip: t('race.fresh.title', 'Who’s freshest?'), title: t('race.fresh.title', 'Who’s freshest?'),
      unit: 'days ago', invert: true, value: (l) => l.daysSince,
      tie: (l) => -l.latest.at,   // same day: the later release leads
      fmt: (v) => (v < 2 ? ago(v) : t('fmt.dAgo', '{n}d ago', { n: v })),
      note: t('race.fresh.note', 'Days since that lab’s newest model appeared on OpenRouter or in the lab’s own API.') },
    { id: 'busy', chip: t('race.busy.title', 'Who ships most?'), title: t('race.busy.title', 'Who ships most?'),
      unit: 'releases', value: (l) => l.recentCount,
      fmt: (v) => t('fmt.busy', '{n} in 12mo', { n: v }), note: t('race.busy.note', 'Models released in the last 12 months.') },
    { id: 'cheap', chip: t('race.cheap.title', 'Who’s cheapest?'), title: t('race.cheap.title', 'Who’s cheapest?'),
      unit: '$/1M', invert: true, value: (l) => l.cheapest,
      fmt: (v) => '$' + v.toFixed(3).replace(/0$/, ''), note: t('race.cheap.note2', 'Cheapest price per million tokens, blended three input to one output.') },
    { id: 'ctx', chip: t('race.ctx.title', 'Biggest memory?'), title: t('race.ctx.title', 'Biggest memory?'),
      unit: 'tokens', value: (l) => l.maxCtx, fmt: fmtCtx,
      note: t('race.ctx.note', 'Largest context window the lab offers — how much it can read at once.') }
  ];

  const CHIP = {
    aaIntelligence: t('race.aaIntelligence.title', 'Who’s smartest?'),
    aaCoding: t('race.aaCoding.title', 'Who codes best?'),
    aaAgentic: t('race.aaAgentic.title', 'Best agent?'),
    designArena: t('race.designArena.title', 'Who designs best?'),
    terminalBench4: t('race.terminalBench4.title', 'Runs a computer best?')
  };
  const ORDER = ['aaIntelligence', 'aaCoding', 'aaAgentic', 'designArena', 'terminalBench4'];
  const ordered = [...DATA.lenses].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
  for (const l of ordered) {
    const title = CHIP[l.key] || l.name;
    METRICS.push({
      id: l.key, chip: title, chipCount: l.n, title, lens: l.key, unit: t('lens.' + l.key + '.name', l.name),
      source: l.source, sourceUrl: l.sourceUrl,
      value: (lab) => { const r = lab.onLens(l.key); return r ? r.v : null; },
      detail: (lab) => lab.onLens(l.key),
      fmt: (v) => (l.max > 200 ? Math.round(v).toString() : v.toFixed(1)),
      note: t('note.lens', '{desc} Source: {source}. Only {n} of {total} models have a published score, so labs without one sit behind the start line.',
        { desc: t('lens.' + l.key + '.desc', l.desc), source: l.source, n: l.n, total: DATA.models.length })
    });
  }

  /* "Who's smartest?" has more than one honest answer. Artificial Analysis stays the
     default; Epoch AI's boards (their own runs, or official leaderboards they transcribe)
     and ARC Prize's and SimpleBench's own leaderboards are "according to" alternatives. Picking one swaps the
     metric's scoring in place, so the chip, lanes and camera all stay put. */
  const smart = METRICS.find((m) => m.id === 'aaIntelligence');
  if (smart) {
    const aa = { key: 'aa', short: 'Artificial Analysis', unit: smart.unit, source: smart.source,
      value: smart.value, detail: smart.detail, fmt: smart.fmt, note: smart.note };
    const boards = Object.entries(DATA.boards || {}).map(([key, b]) => {
      const n = LABS.filter((l) => b.labs[l.lab]).length;
      return {
        key, short: t('board.' + key + '.short', b.short), unit: t('board.' + key + '.name', b.name),
        source: b.source, sourceUrl: b.sourceUrl, n,
        value: (lab) => (b.labs[lab.lab] ? b.labs[lab.lab].v : null),
        detail: (lab) => { const r = b.labs[lab.lab]; return r ? { v: r.v, model: { name: r.model } } : null; },
        fmt: (v) => (b.kind === 'pct' ? v.toFixed(1) + '%' : v.toFixed(1)),
        note: t('note.board2', '{desc} {n} of {labs} labs on track have a score; the rest sit behind the start line. Data: {credit}.',
          { desc: t('board.' + key + '.desc', b.desc), n, labs: LABS.length,
            credit: b.licence ? `${b.source}, ${b.licence.replace(/-(?=[\d.]+$)/, ' ')}` : b.source })
      };
    }).filter((b) => b.n >= 5);
    smart.sources = [aa, ...boards];
    smart.pick = (key) => {
      const src = smart.sources.find((x) => x.key === key) || aa;
      Object.assign(smart, { sourceKey: src.key, unit: src.unit, source: src.source,
        value: src.value, detail: src.detail, fmt: src.fmt, note: src.note });
    };
    smart.pick(savedSource);
  }

  return { LABS, METRICS, NOW };
}

/* Positions: exact ordering, with rank weighted more than value so adjacent places
   never bunch up. The footer says so — the order is real, the spacing is widened. */
export function rankRace(labs, m) {
  const raw = labs.map((l) => ({ l, v: m.value(l) }));
  const ok = raw.filter((r) => r.v != null && Number.isFinite(r.v));
  const miss = raw.filter((r) => !ok.includes(r));
  ok.sort((a, b) => (m.invert ? a.v - b.v : b.v - a.v) || (m.tie ? m.tie(a.l) - m.tie(b.l) : 0));
  const vals = ok.map((r) => r.v);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const n = ok.length;
  ok.forEach((r, i) => {
    const byVal = m.invert ? 1 - (r.v - lo) / span : (r.v - lo) / span;
    const byRank = n > 1 ? 1 - i / (n - 1) : 1;
    r.t = 0.2 * byVal + 0.8 * byRank;
    r.rank = i + 1;
  });
  miss.forEach((r) => { r.t = null; r.rank = null; });
  return { ranked: ok, missing: miss, all: [...ok, ...miss] };
}

/** The one fact that puts a leader in front, as a phrase: "at $0.02 per million tokens". */
export function reasonFor(m, r) {
  if (m.id === 'fresh') return r.l.latest ? t('reason.fresh', 'with {model}, out {when}', { model: r.l.latest.name, when: ago(r.v) }) : '';
  if (m.id === 'busy') return t('reason.busy', 'with {n} models in 12 months', { n: r.v });
  if (m.id === 'cheap') return t('reason.cheap', 'at {price} per million tokens', { price: m.fmt(r.v) });
  if (m.id === 'ctx') return t('reason.ctx', 'with {ctx} tokens of context', { ctx: m.fmt(r.v) });
  const det = m.detail ? m.detail(r.l) : null;
  return det && det.model && det.model.name
    ? t('reason.lensModel', 'with {score} from {model}', { score: m.fmt(r.v), model: det.model.name })
    : t('reason.lens', 'with {score}', { score: m.fmt(r.v) });
}

/* Share addresses: airace.lol/cheapest, and airace.lol/smartest-gpqa for another source. */
export const RACE_SLUGS = { fresh: 'freshest', busy: 'ships-most', cheap: 'cheapest', ctx: 'biggest-memory',
  aaIntelligence: 'smartest', aaCoding: 'codes-best', aaAgentic: 'best-agent', designArena: 'designs-best',
  terminalBench4: 'runs-a-computer' };
export function slugFor(m, sourceKey = m.sourceKey) {
  const base = RACE_SLUGS[m.id] || m.id;
  return m.sources && sourceKey && sourceKey !== 'aa' ? `${base}-${sourceKey}` : base;
}
/** A race and source from a slug ("cheapest", "smartest-gpqa") or a race id ("cheap"). */
export function raceFromSlug(METRICS, slug) {
  if (!slug) return null;
  const want = String(slug).toLowerCase().replace(/\.html$/, '');
  for (const m of METRICS) {
    const base = RACE_SLUGS[m.id] || m.id;
    if (want === base || want === m.id.toLowerCase()) return { metric: m, sourceKey: m.sources ? 'aa' : null };
    if (m.sources && want.startsWith(base + '-')) {
      const key = want.slice(base.length + 1);
      if (m.sources.some((x) => x.key === key)) return { metric: m, sourceKey: key };
    }
  }
  return null;
}
