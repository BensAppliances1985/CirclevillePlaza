import { VIEWS, VIEW_MENU, SCOPE, SCHEMES, UNITS, B, NORTH, EAST, PYLON } from './config.js';

const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  for (const k of kids) e.append(k);
  return e;
};
const FT = 3.28084;

export function createUI({ onPhase, onMode, onLight, onScheme, onView, onTour, onMapClick }) {
  const touch = matchMedia('(pointer: coarse)').matches;

  // ---- views ----
  const vl = $('#viewList');
  for (const key of VIEW_MENU) {
    const v = VIEWS[key];
    vl.append(el('button', { id: `view-${key}`, onclick: () => onView(key) }, el('span', { class: 'kind', text: v.eye ? 'Standing' : 'Aerial' }), v.label));
  }
  // ---- scope ----
  const sl = $('#scopeList');
  for (const [i, s] of SCOPE.entries()) {
    const t = el('div', { class: 't' }, el('span', { class: 'scope-mark', 'aria-hidden': 'true' }), s.title);
    sl.append(el('div', { class: 'row' }, t, el('div', { class: 'd', text: s.detail }), el('button', { id: `scope-${i}`, class: 'linkbtn go', onclick: () => onView(s.view, { phase: 'after' }) , text: 'Show' })));
  }
  // ---- palette ----
  const pl = $('#schemeList');
  const schemeBtns = {};
  let lastGroup = null;
  for (const [key, s] of Object.entries(SCHEMES)) {
    if (s.group !== lastGroup) {
      pl.append(el('p', { class: 'eyebrow group-label', text: s.group === 'Bold' ? 'Bold' : 'Classic (neutral)' }));
      lastGroup = s.group;
    }
    const strip = el('div', { class: 'strip', 'aria-hidden': 'true', style: `grid-template-columns:repeat(${s.chips.length},1fr)` });
    for (const c of s.chips) strip.append(el('span', { style: `background:${c.hex}` }));
    const chips = el('div', { class: 'chips' });
    for (const c of s.chips) {
      chips.append(el('span', { class: 'chip', style: `background:${c.hex}` }));
      chips.append(el('span', { class: 'chip-text' }, el('strong', { text: c.name }), ` · ${c.role} `, el('span', { class: 'code', text: c.code })));
    }
    const head = el('div', { class: 'scheme-head' }, el('span', { class: 'scheme-name', text: s.name }), el('span', { class: `tag${s.tag === 'Recommended' ? ' rec' : ''}`, text: s.tag }));
    const b = el('button', { id: `scheme-${key}`, class: 'scheme', 'aria-pressed': 'false', onclick: () => onScheme(key) }, head, strip, el('p', { class: 'muted', text: s.blurb }), chips);
    schemeBtns[key] = b;
    pl.append(b);
  }
  // ---- tenants ----
  const tl = $('#tenantList');
  const tenantRows = [];
  for (const u of UNITS) {
    const name = el('span');
    const status = el('span', { class: 'status' });
    const t = el('div', { class: 't' }, name, status);
    const d = el('div', { class: 'd' });
    tl.append(el('div', { class: 'row' }, t, d, el('button', { id: `tenant-${u.id}`, class: 'linkbtn go', onclick: () => onView(u.view), text: 'Show' })));
    tenantRows.push({ u, name, status, d });
  }

  // ---- tabs ----
  const tabs = document.querySelectorAll('.tabs button');
  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    document.querySelectorAll('.sheet').forEach((s) => { s.hidden = s.dataset.sheet !== t.dataset.tab; });
  }));
  // ---- rail ----
  document.querySelectorAll('[data-phase]').forEach((b) => b.addEventListener('click', () => onPhase(b.dataset.phase)));
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => onMode(b.dataset.mode)));
  document.querySelectorAll('[data-light]').forEach((b) => b.addEventListener('click', () => onLight(b.dataset.light)));
  $('#tourBtn').addEventListener('click', () => onTour());
  const panel = $('#panel'), panelBtn = $('#panelBtn');
  panelBtn.addEventListener('click', () => { const open = !panel.classList.contains('open'); panel.classList.toggle('open', open); panelBtn.setAttribute('aria-expanded', String(open)); });
  const closeSheetOnPhone = () => { if (matchMedia('(max-width: 760px)').matches) { panel.classList.remove('open'); panelBtn.setAttribute('aria-expanded', 'false'); } };

  // ---- site plan (north-up) ----
  const map = $('#mapCanvas'), mctx = map.getContext('2d');
  const MW = map.width, MH = map.height;
  const toEN = (x, z) => [x * EAST.x + z * EAST.z, x * NORTH.x + z * NORTH.z];
  const fromEN = (e, n) => [e * EAST.x + n * NORTH.x, e * EAST.z + n * NORTH.z];
  const corners = [[-40, -92], [190, -92], [190, 92], [-40, 92]].map(([x, z]) => toEN(x, z));
  const e0 = Math.min(...corners.map((c) => c[0])), e1 = Math.max(...corners.map((c) => c[0]));
  const n0 = Math.min(...corners.map((c) => c[1])), n1 = Math.max(...corners.map((c) => c[1]));
  const scale = Math.min(MW / (e1 - e0), MH / (n1 - n0)) * 1.08;
  const ec = (e0 + e1) / 2, nc = (n0 + n1) / 2;
  const P = (x, z) => { const [e, n] = toEN(x, z); return [MW / 2 + (e - ec) * scale, MH / 2 - (n - nc) * scale]; };
  const inv = (sx, sy) => fromEN(ec + (sx - MW / 2) / scale, nc - (sy - MH / 2) / scale);
  let colors = {};
  const readColors = () => { const cs = getComputedStyle(document.documentElement); for (const k of ['paper', 'paper-2', 'ink', 'ink-2', 'rule', 'mark', 'accent']) colors[k] = cs.getPropertyValue(`--${k}`).trim(); };
  readColors();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', readColors);
  new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const poly = (pts, fill, stroke) => { mctx.beginPath(); pts.forEach(([x, z], i) => { const [sx, sy] = P(x, z); i ? mctx.lineTo(sx, sy) : mctx.moveTo(sx, sy); }); mctx.closePath(); if (fill) { mctx.fillStyle = fill; mctx.fill(); } if (stroke) { mctx.strokeStyle = stroke; mctx.stroke(); } };
  const footprint = [[0, 3.0], [0, 79.5], [53.4, 79.5], [53.4, 23.9], [73.4, 23.9], [73.4, 45.9], [88.0, 45.9], [88.0, 40.9], [124.5, 40.9], [124.5, 3.0], [118.8, 3.0], [118.8, 0], [13.1, 0], [13.1, 3.0]];
  const lotPoly = [[-36, -69.5], [133, -69.5], [133, -14], [137.5, -14], [137.5, 0], [-8, 0]];
  let lastDraw = 0;
  function drawMap(marker, now) {
    if (now - lastDraw < 60) return; lastDraw = now;
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.fillStyle = colors['paper-2']; mctx.fillRect(0, 0, MW, MH);
    mctx.lineWidth = 1.5;
    poly([[-300, -72.5], [400, -72.5], [400, -83.5], [-300, -83.5]], colors.rule);
    poly(lotPoly, colors.rule);
    poly([[134, -69.5], [178, -69.5], [178, -6], [134, -6]], null, colors.rule);
    poly(footprint, colors.ink);
    // unit lines on the storefront
    mctx.strokeStyle = colors['paper-2']; mctx.lineWidth = 1.5;
    for (const u of UNITS) { const [ax, ay] = P(u.x1, 0), [bx, by] = P(u.x1, 9); mctx.beginPath(); mctx.moveTo(ax, ay); mctx.lineTo(bx, by); mctx.stroke(); }
    // pylon
    const [px, py] = P(PYLON.x, PYLON.z); mctx.fillStyle = colors.accent; mctx.fillRect(px - 4, py - 4, 8, 8);
    // labels
    mctx.fillStyle = colors['ink-2']; mctx.font = '600 20px "Barlow Condensed", sans-serif';
    const [lx, ly] = P(-20, -79.5); mctx.save(); mctx.translate(lx, ly); mctx.rotate(Math.atan2(-NORTH.x, EAST.x)); mctx.fillText('LANCASTER PIKE', 0, 6); mctx.restore();
    // camera marker (pinned to the edge when the camera is off the plan)
    let [mx, my] = P(marker.x, marker.z);
    const off = mx < 14 || mx > MW - 14 || my < 14 || my > MH - 14;
    mx = Math.min(MW - 14, Math.max(14, mx)); my = Math.min(MH - 14, Math.max(14, my));
    mctx.globalAlpha = off ? 0.6 : 1;
    const fwd = [-Math.sin(marker.yaw), -Math.cos(marker.yaw)];
    const [fe, fn] = toEN(fwd[0], fwd[1]);
    const ang = Math.atan2(-fn, fe);
    mctx.save(); mctx.translate(mx, my); mctx.rotate(ang);
    const base = mctx.globalAlpha;
    mctx.fillStyle = colors.mark; mctx.globalAlpha = base * 0.3;
    mctx.beginPath(); mctx.moveTo(0, 0); mctx.arc(0, 0, 44, -0.5, 0.5); mctx.closePath(); mctx.fill();
    mctx.globalAlpha = base; mctx.beginPath(); mctx.moveTo(13, 0); mctx.lineTo(-8, -8); mctx.lineTo(-4, 0); mctx.lineTo(-8, 8); mctx.closePath(); mctx.fill();
    mctx.strokeStyle = colors.ink; mctx.lineWidth = 1.5; mctx.stroke();
    mctx.restore();
    mctx.globalAlpha = 1;
    // north arrow
    mctx.fillStyle = colors.ink; mctx.beginPath(); mctx.moveTo(MW - 26, 14); mctx.lineTo(MW - 34, 38); mctx.lineTo(MW - 26, 32); mctx.lineTo(MW - 18, 38); mctx.closePath(); mctx.fill();
    mctx.font = '700 20px "Barlow Condensed", sans-serif'; mctx.textAlign = 'center'; mctx.fillText('N', MW - 26, 60); mctx.textAlign = 'left';
    // scale bar: 200 ft
    const len = (200 / FT) * scale;
    mctx.fillStyle = colors.ink; mctx.fillRect(16, MH - 22, len, 5);
    mctx.fillStyle = colors['paper-2']; mctx.fillRect(16 + len / 2, MH - 21, len / 2 - 1, 3);
    mctx.fillStyle = colors.ink; mctx.font = '600 18px "IBM Plex Mono", monospace'; mctx.fillText('200 ft', 16 + len + 8, MH - 15);
  }
  map.addEventListener('click', (e) => {
    const r = map.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * MW, sy = ((e.clientY - r.top) / r.height) * MH;
    const [x, z] = inv(sx, sy);
    onMapClick(x, z);
  });

  // ---- loading ----
  const bar = $('#loadBar'), text = $('#loadText'), loading = $('#loading');
  const progress = (msg, f) => { text.textContent = msg; bar.style.width = `${Math.round(f * 100)}%`; };
  const done = () => { loading.classList.add('done'); setTimeout(() => loading.remove(), 700); };
  const fail = (msg) => { const card = loading.querySelector('.loading-card'); card.append(el('div', { class: 'err', text: msg })); bar.parentElement.remove(); };

  // ---- walk hint + joystick ----
  const hint = $('#hint'), joy = $('#joy');
  const hintText = touch ? 'Drag the joystick to walk · drag anywhere else to look' : 'W A S D or arrow keys to walk · drag to look · hold Shift to walk faster';

  function sync(state) {
    const set = (sel, on) => document.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(on(b))));
    set('[data-phase]', (b) => b.dataset.phase === state.phase);
    set('[data-mode]', (b) => b.dataset.mode === state.mode);
    set('[data-light]', (b) => b.dataset.light === state.light);
    $('#tourBtn').setAttribute('aria-pressed', String(!!state.touring));
    for (const [k, b] of Object.entries(schemeBtns)) b.setAttribute('aria-pressed', String(k === state.scheme));
    const pill = $('#phasePill');
    pill.textContent = state.phase === 'before' ? 'Existing' : 'Proposed';
    pill.classList.toggle('existing', state.phase === 'before');
    $('#phaseNote').textContent = state.phase === 'before' ? 'As photographed, Sept–Oct 2026' : `${SCHEMES[state.scheme].name} palette`;
    $('#mapMode').textContent = state.mode === 'walk' ? 'Walking' : state.touring ? 'Touring' : 'Orbit';
    hint.hidden = state.mode !== 'walk'; hint.textContent = hintText;
    joy.hidden = !(state.mode === 'walk' && touch);
    for (const r of tenantRows) {
      const before = state.phase === 'before';
      r.name.textContent = before ? r.u.before : r.u.name;
      const st = before ? (r.u.id === 'bens' || r.u.id === 'ace' ? 'Vacant' : 'Open') : r.u.status;
      r.status.textContent = st;
      r.status.className = `status ${st === 'Anchor' ? 'anchor' : st === 'Coming soon' ? 'coming' : st === 'Available' || st === 'Vacant' ? 'available' : ''}`;
      const ft = Math.round(((r.u.x1 - r.u.x0) * FT) / 5) * 5;
      r.d.textContent = `${r.u.unit ? `Unit ${r.u.unit} · ` : ''}≈ ${ft} ft of frontage${r.u.sub ? ` · ${r.u.sub}` : ''}${r.u.note ? ` · ${r.u.note}` : ''}`;
    }
  }

  return { sync, drawMap, progress, done, fail, joystick: { base: joy, knob: joy.querySelector('.knob') }, closeSheetOnPhone };
}
