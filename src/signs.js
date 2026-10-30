import * as THREE from 'three';
import { makeCanvas, canvasTexture, rng } from './util.js';

export const F = {
  archivo: "'Archivo Black', 'Arial Black', Impact, sans-serif",
  barlow: "'Barlow', 'Segoe UI', Arial, sans-serif",
  cond: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
  nunito: "'Nunito', 'Arial Rounded MT Bold', Arial, sans-serif",
  oswald: "'Oswald', 'Arial Narrow', Arial, sans-serif",
  medieval: "'MedievalSharp', Georgia, serif",
  rye: "'Rye', Georgia, serif",
};

export async function loadSignFonts() {
  const specs = [
    "400 40px 'Archivo Black'", "600 40px 'Barlow'", "700 40px 'Barlow'", "italic 600 40px 'Barlow'",
    "700 40px 'Barlow Condensed'", "600 40px 'Barlow Condensed'", "900 40px 'Nunito'", "700 40px 'Oswald'",
    "400 40px 'MedievalSharp'", "400 40px 'Rye'",
  ];
  const timeout = new Promise((r) => setTimeout(r, 6000));
  try { await Promise.race([Promise.all(specs.map((s) => document.fonts.load(s))), timeout]); } catch (e) { /* fall back to system fonts */ }
}

const COLORS = { ace: '#D2202F', dominoBlue: '#006491', dominoRed: '#E31837', r2o: '#C8102E', pumas: '#2F55C8', bigLotsOrange: '#F26722' };

function tex(c) {
  const t = canvasTexture(c, { wrap: false, aniso: 8 });
  t.generateMipmaps = true;
  return t;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// Draw text with manual letter spacing, centered on cx.
function spaced(ctx, text, cx, y, spacing) {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = cx - total / 2;
  const align = ctx.textAlign; ctx.textAlign = 'left';
  chars.forEach((ch, i) => { ctx.fillText(ch, x, y); x += widths[i] + spacing; });
  ctx.textAlign = align;
  return total;
}
function spacedWidth(ctx, text, spacing) {
  return [...text].reduce((a, ch) => a + ctx.measureText(ch).width, 0) + spacing * (text.length - 1);
}

// ---------- tenant marks ----------
export function drawBens(ctx, img, x, y, w, h, pad = 0.06) {
  const iw = img.width, ih = img.height;
  const s = Math.min((w * (1 - pad * 2)) / iw, (h * (1 - pad * 2)) / ih);
  const dw = iw * s, dh = ih * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export function drawAce(ctx, x, y, w, h) {
  ctx.save();
  const ref = 100;
  ctx.font = `400 ${ref}px ${F.archivo}`;
  const wA = ctx.measureText('ACE').width;
  ctx.font = `700 ${ref * 0.66}px ${F.cond}`;
  const wH = ctx.measureText('Hardware').width;
  const gap = ref * 0.16, total = wA + gap + wH + ref * 0.15, cap = ref * 0.74;
  const s = Math.min(w / total, (h * 0.8) / cap);
  const x0 = x + (w - total * s) / 2, base = y + h / 2 + (cap * s) / 2;
  ctx.translate(x0, base);
  ctx.transform(1, 0, -0.2, 1, 0, 0);
  ctx.fillStyle = COLORS.ace;
  ctx.font = `400 ${ref * s}px ${F.archivo}`;
  ctx.fillText('ACE', 0, 0);
  ctx.fillStyle = '#262626';
  ctx.font = `700 ${ref * 0.66 * s}px ${F.cond}`;
  ctx.fillText('Hardware', (wA + gap) * s, 0);
  ctx.restore();
}

function dominoTile(ctx, cx, cy, L) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(-Math.PI / 4);
  const b = L * 0.07, H = L / 2, r = L * 0.08;
  ctx.fillStyle = '#ffffff'; roundRect(ctx, -L / 2 - b, -H / 2 - b, L + 2 * b, H + 2 * b, r + b); ctx.fill();
  ctx.fillStyle = COLORS.dominoBlue; roundRect(ctx, -L / 2, -H / 2, L / 2 - b * 0.35, H, r); ctx.fill();
  ctx.fillStyle = COLORS.dominoRed; roundRect(ctx, b * 0.35, -H / 2, L / 2 - b * 0.35, H, r); ctx.fill();
  ctx.fillStyle = '#ffffff';
  const dot = (px, py) => { ctx.beginPath(); ctx.arc(px, py, L * 0.065, 0, Math.PI * 2); ctx.fill(); };
  dot(L / 4, 0); dot(-L / 4 - L * 0.1, -H * 0.2); dot(-L / 4 + L * 0.1, H * 0.2);
  ctx.restore();
}
export function drawDominos(ctx, x, y, w, h, { onBlue = false } = {}) {
  ctx.save();
  const ref = 100;
  ctx.font = `900 ${ref}px ${F.nunito}`;
  const wt = ctx.measureText("Domino's").width;
  const tile = ref * 1.25, gap = ref * 0.25, total = tile + gap + wt, cap = ref * 0.9;
  const s = Math.min(w / total, (h * 0.86) / Math.max(cap, tile * 0.95));
  const x0 = x + (w - total * s) / 2, cy = y + h / 2;
  dominoTile(ctx, x0 + (tile * s) / 2, cy, tile * s * 0.78);
  ctx.fillStyle = onBlue ? '#ffffff' : COLORS.dominoBlue;
  ctx.font = `900 ${ref * s}px ${F.nunito}`;
  ctx.textBaseline = 'middle';
  ctx.fillText("Domino's", x0 + (tile + gap) * s, cy + ref * s * 0.04);
  ctx.restore();
}

export function drawRent2Own(ctx, x, y, w, h, { cabinet = true } = {}) {
  ctx.save();
  if (cabinet) {
    const x0 = x + w * 0.02, x1 = x + w * 0.98, top = y + h * 0.06, bot = y + h * 0.94, eave = y + h * 0.28, xm = (x0 + x1) / 2;
    const path = () => { ctx.beginPath(); ctx.moveTo(x0, eave); ctx.lineTo(xm, top); ctx.lineTo(x1, eave); ctx.lineTo(x1, bot); ctx.lineTo(x0, bot); ctx.closePath(); };
    path(); ctx.fillStyle = COLORS.r2o; ctx.fill();
    ctx.lineWidth = h * 0.035; ctx.strokeStyle = '#ffffff'; ctx.lineJoin = 'miter';
    ctx.save(); ctx.translate(xm, (top + bot) / 2); ctx.scale(0.965, 0.9); ctx.translate(-xm, -(top + bot) / 2); path(); ctx.stroke(); ctx.restore();
    const size = Math.min(h * 0.5, (w * 0.86) / 5.1);
    ctx.font = `700 ${size}px ${F.oswald}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = size * 0.1; ctx.strokeStyle = '#2a0a0a';
    const ty = (eave + bot) / 2 + h * 0.02;
    ctx.strokeText('RENT-2-OWN', xm, ty);
    ctx.fillStyle = '#ffffff'; ctx.fillText('RENT-2-OWN', xm, ty);
  } else {
    const size = Math.min(h * 0.62, (w * 0.84) / 5.6);
    ctx.font = `700 ${size}px ${F.oswald}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.r2o; ctx.fillText('RENT -2- OWN', x + w / 2, y + h / 2 + size * 0.04);
  }
  ctx.restore();
}

function d20(ctx, cx, cy, r) {
  ctx.save();
  ctx.fillStyle = '#c62828'; ctx.strokeStyle = '#ffd7d0'; ctx.lineWidth = r * 0.08;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 3; ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  const p = (i) => [cx + r * Math.cos(-Math.PI / 2 + (i * Math.PI) / 3), cy + r * Math.sin(-Math.PI / 2 + (i * Math.PI) / 3)];
  const t = [[cx, cy - r * 0.45], [cx - r * 0.5, cy + r * 0.35], [cx + r * 0.5, cy + r * 0.35]];
  ctx.moveTo(...t[0]); ctx.lineTo(...t[1]); ctx.lineTo(...t[2]); ctx.closePath();
  [0, 2, 4].forEach((i, k) => { ctx.moveTo(...p(i)); ctx.lineTo(...t[k === 0 ? 0 : k === 1 ? 2 : 1]); });
  ctx.stroke();
  ctx.restore();
}
export function drawPumas(ctx, x, y, w, h) {
  ctx.save();
  const R = h * 0.42;
  const title = 'Pumas Rest';
  const ref = 100;
  ctx.font = `400 ${ref}px ${F.medieval}`;
  const wt = ctx.measureText(title).width;
  const total = R * 2 + h * 0.12 + 0;
  const avail = w - total - w * 0.04;
  const s = Math.min(avail / wt, (h * 0.58) / (ref * 0.8));
  const blockW = total + wt * s;
  const x0 = x + (w - blockW) / 2;
  // badge
  const bx = x0 + R, by = y + h / 2;
  ctx.fillStyle = '#18181a'; ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = R * 0.12; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  d20(ctx, bx, by + R * 0.08, R * 0.52);
  // title
  const tx = x0 + R * 2 + h * 0.12, ty = y + h * 0.56;
  ctx.font = `400 ${ref * s}px ${F.medieval}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = ref * s * 0.16; ctx.strokeStyle = '#101010'; ctx.strokeText(title, tx, ty);
  ctx.lineWidth = ref * s * 0.06; ctx.strokeStyle = '#e8eeff'; ctx.strokeText(title, tx, ty);
  ctx.fillStyle = '#2446b8'; ctx.fillText(title, tx, ty);
  ctx.font = `italic 600 ${h * 0.2}px ${F.barlow}`;
  ctx.fillStyle = '#1d1d1d';
  ctx.fillText('Your Local Game Store', tx + ref * s * 0.3, y + h * 0.86);
  ctx.restore();
}

export function drawForLease(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#f7f6f2'; ctx.fillRect(x, y, w, h);
  ctx.lineWidth = h * 0.06; ctx.strokeStyle = '#7a2d25'; ctx.strokeRect(x + h * 0.05, y + h * 0.05, w - h * 0.1, h - h * 0.1);
  const size = Math.min(h * 0.55, (w * 0.8) / 5.2);
  ctx.font = `700 ${size}px ${F.barlow}`; ctx.fillStyle = '#141414'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  spaced(ctx, 'FOR LEASE', x + w / 2, y + h / 2 + size * 0.04, size * 0.06);
  ctx.restore();
}

export function drawBigLots(ctx, x, y, w, h, { outline = true } = {}) {
  ctx.save();
  const ref = 100;
  ctx.font = `400 ${ref}px ${F.archivo}`; const wB = ctx.measureText('BIG').width;
  ctx.font = `600 ${ref * 1.05}px ${F.barlow}`; const wL = ctx.measureText('LOTS').width;
  ctx.font = `400 ${ref}px ${F.archivo}`; const wE = ctx.measureText('!').width;
  const total = wB + wL + wE + ref * 0.08, cap = ref * 0.74;
  const s = Math.min((w * 0.9) / total, (h * 0.62) / cap);
  const x0 = x + (w - total * s) / 2, base = y + h / 2 + (cap * s) / 2;
  ctx.lineJoin = 'round';
  const put = (txt, font, fx, fill) => {
    ctx.font = font;
    if (outline) { ctx.lineWidth = ref * s * 0.09; ctx.strokeStyle = '#2a2a2a'; ctx.strokeText(txt, fx, base); }
    ctx.fillStyle = fill; ctx.fillText(txt, fx, base);
  };
  put('BIG', `400 ${ref * s}px ${F.archivo}`, x0, '#ffffff');
  put('LOTS', `600 ${ref * 1.05 * s}px ${F.barlow}`, x0 + wB * s, '#ffffff');
  ctx.save(); ctx.translate(x0 + (wB + wL + ref * 0.08) * s, base); ctx.transform(1, 0, -0.18, 1, 0, 0);
  ctx.font = `400 ${ref * s}px ${F.archivo}`;
  if (outline) { ctx.lineWidth = ref * s * 0.09; ctx.strokeStyle = '#2a2a2a'; ctx.strokeText('!', 0, 0); }
  ctx.fillStyle = COLORS.bigLotsOrange; ctx.fillText('!', 0, 0);
  ctx.restore();
  ctx.restore();
}

function aged(ctx, w, h, seed, amount = 1) {
  const r = rng(seed);
  for (let i = 0; i < 70 * amount; i++) {
    ctx.fillStyle = `rgba(${90 + r() * 40},${80 + r() * 30},${50 + r() * 30},${0.03 + r() * 0.05})`;
    const rw = 20 + r() * 160, rh = 10 + r() * 80;
    ctx.fillRect(r() * w, r() * h, rw, rh);
  }
  ctx.fillStyle = `rgba(200,170,90,${0.06 * amount})`; ctx.fillRect(0, 0, w, h);
}

// ---------- composite sign faces ----------
export function billboardAfter(banner) {
  const c = makeCanvas(2048, 372), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 372);
  g.addColorStop(0, '#fbfaf6'); g.addColorStop(1, '#f1efe8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 2048, 372);
  drawBens(ctx, banner, 0, 0, 2048, 372, 0.04);
  return tex(c);
}
export function billboardBefore() {
  const c = makeCanvas(2048, 372), ctx = c.getContext('2d');
  ctx.fillStyle = '#d7ccb6'; ctx.fillRect(0, 0, 2048, 372);
  for (let x = 0; x < 2048; x += 28) { ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x, 0, 5, 372); ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fillRect(x + 5, 0, 6, 372); }
  aged(ctx, 2048, 372, 7, 1.2);
  drawBigLots(ctx, 520, 30, 1000, 312);
  return tex(c);
}

export function fasciaSign(kind, banner) {
  const W = 1024, H = kind === 'ace' ? 128 : 224;
  const c = makeCanvas(kind === 'ace' ? 2048 : W, kind === 'ace' ? 256 : H), ctx = c.getContext('2d');
  const cw = c.width, ch = c.height;
  if (kind === 'ace') drawAce(ctx, 0, 0, cw, ch);
  else if (kind === 'dominos') drawDominos(ctx, 0, 0, cw, ch);
  else if (kind === 'rent2own') drawRent2Own(ctx, cw * 0.14, 0, cw * 0.72, ch);
  else if (kind === 'pumas') drawPumas(ctx, 0, 0, cw, ch);
  else if (kind === 'forlease') drawForLease(ctx, cw * 0.1, ch * 0.12, cw * 0.8, ch * 0.76);
  else if (kind === 'bens') drawBens(ctx, banner, 0, 0, cw, ch, 0.02);
  return tex(c);
}

// Pylon tenant area: 3.1 m x 3.6 m face, 330 px/m.
export function pylonTenants(banner, phase) {
  const W = 1024, H = 1190;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  if (phase === 'after') {
    const rows = [['bens', 284], ['ace', 205], ['pumas', 172], ['rent2own', 172], ['dominos', 172], ['leasing', 145]];
    let y = 0;
    for (const [k, h] of rows) {
      ctx.fillStyle = k === 'leasing' ? '#34363a' : '#fbfaf7';
      ctx.fillRect(0, y, W, h);
      const px = 50, py = h * 0.1;
      if (k === 'bens') drawBens(ctx, banner, px - 20, y, W - (px - 20) * 2, h, 0.02);
      if (k === 'ace') drawAce(ctx, px, y + py, W - px * 2, h - py * 2);
      if (k === 'pumas') drawPumas(ctx, px, y + py, W - px * 2, h - py * 2);
      if (k === 'rent2own') drawRent2Own(ctx, 160, y + h * 0.08, W - 320, h * 0.84);
      if (k === 'dominos') drawDominos(ctx, px, y + py, W - px * 2, h - py * 2);
      if (k === 'leasing') {
        ctx.fillStyle = '#f3f0e8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `700 ${h * 0.46}px ${F.cond}`;
        spaced(ctx, 'NOW LEASING', W / 2, y + h / 2 + 4, h * 0.08);
      }
      y += h + 8;
    }
  } else {
    const rows = [['biglots', 310], ['pumas', 165], ['blank', 211], ['rent2own', 181], ['split', 149], ['dominos', 174]];
    let y = 0;
    for (const [k, h] of rows) {
      ctx.fillStyle = k === 'biglots' ? '#141414' : '#f4f2ec';
      ctx.fillRect(0, y, W, h);
      if (k === 'biglots') drawBigLots(ctx, 40, y, W - 80, h, { outline: false });
      if (k === 'pumas') drawPumas(ctx, 260, y + 14, W - 520, h - 28);
      if (k === 'blank') { ctx.fillStyle = '#ece8dc'; ctx.fillRect(0, y, W, h); }
      if (k === 'rent2own') drawRent2Own(ctx, 60, y, W - 120, h, { cabinet: false });
      if (k === 'split') { ctx.fillStyle = '#f2f0ea'; ctx.fillRect(0, y, W / 2, h); ctx.fillStyle = '#e4dcc4'; ctx.fillRect(W / 2, y, W / 2, h); }
      if (k === 'dominos') { ctx.fillStyle = '#f2f0ea'; ctx.fillRect(0, y, W / 2, h); ctx.fillStyle = '#1565a8'; ctx.fillRect(W / 2, y, W / 2, h); drawDominos(ctx, W / 2 + 20, y + 20, W / 2 - 40, h - 40, { onBlue: true }); }
      ctx.fillStyle = '#9b9588'; ctx.fillRect(0, y + h - 3, W, 3);
      y += h;
    }
    aged(ctx, W, H, 17, 1.6);
  }
  return tex(c);
}

// Pylon name cabinet: 3.4 m x 1.33 m face.
export function pylonName(phase) {
  const W = 1024, H = 400;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if (phase === 'after') {
    ctx.fillStyle = '#f3f0e8';
    ctx.font = `700 190px ${F.cond}`;
    spaced(ctx, 'CIRCLEVILLE', W / 2, 225, 14);
    ctx.font = `600 78px ${F.cond}`;
    const tw = spaced(ctx, 'CENTER', W / 2, 330, 30);
    ctx.fillRect(W / 2 - tw / 2 - 190, 302, 150, 6);
    ctx.fillRect(W / 2 + tw / 2 + 40, 302, 150, 6);
  } else {
    ctx.fillStyle = '#e3d8bb'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#c9bb98'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, W - 10, H - 10);
    ctx.fillStyle = '#c3272f';
    ctx.font = `400 170px ${F.rye}`;
    const w0 = ctx.measureText('CIRCLEVILLE').width;
    ctx.save(); ctx.translate(W / 2, 220); ctx.scale(Math.min(1, 900 / w0), 1); ctx.fillText('CIRCLEVILLE', 0, 0); ctx.restore();
    ctx.font = `400 92px ${F.rye}`;
    spaced(ctx, 'center', W / 2, 335, 40);
    aged(ctx, W, H, 23, 1.4);
  }
  return tex(c);
}

// Vertical accessible-parking sign face (0.3 m x 0.46 m).
export function adaSignFace(van = false) {
  const W = 256, H = 392, c = makeCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#fbfbf8'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#1f4f9a'; ctx.lineWidth = 8; ctx.strokeRect(6, 6, W - 12, H - 12);
  ctx.fillStyle = '#1f4f9a'; ctx.textAlign = 'center';
  ctx.font = `700 40px ${F.cond}`; ctx.fillText('RESERVED', W / 2, 58); ctx.fillText('PARKING', W / 2, 98);
  ctx.fillRect(W / 2 - 72, 118, 144, 144);
  isa(ctx, W / 2, 190, 118, '#ffffff');
  if (van) { ctx.fillStyle = '#1f4f9a'; ctx.font = `700 34px ${F.cond}`; ctx.fillText('VAN', W / 2, 310); ctx.fillText('ACCESSIBLE', W / 2, 350); }
  else { ctx.fillStyle = '#1f4f9a'; ctx.font = `600 26px ${F.cond}`; ctx.fillText('PERMIT REQUIRED', W / 2, 322); }
  return tex(c);
}

// International Symbol of Access, drawn inside a box of size s centered at cx,cy.
export function isa(ctx, cx, cy, s, color, lineOnly = false) {
  ctx.save();
  ctx.translate(cx - s / 2, cy - s / 2);
  const k = s / 100;
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.arc(46 * k, 16 * k, 8 * k, 0, Math.PI * 2);
  if (lineOnly) { ctx.lineWidth = 3.5 * k; ctx.stroke(); } else ctx.fill();
  ctx.lineWidth = 9 * k;
  ctx.beginPath(); ctx.moveTo(44 * k, 30 * k); ctx.lineTo(42 * k, 58 * k); ctx.lineTo(66 * k, 58 * k); ctx.lineTo(76 * k, 82 * k); ctx.lineTo(84 * k, 78 * k); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(43 * k, 44 * k); ctx.lineTo(60 * k, 44 * k); ctx.stroke();
  ctx.lineWidth = 7 * k;
  ctx.beginPath(); ctx.arc(44 * k, 66 * k, 22 * k, Math.PI * 1.18, Math.PI * 2.62); ctx.stroke();
  ctx.restore();
}

// ---------- pavement decals ----------
export function decalTextures() {
  const mk = (w, h, draw) => { const c = makeCanvas(w, h); draw(c.getContext('2d'), w, h); return tex(c); };
  return {
    adaNew: mk(256, 256, (ctx, w, h) => { ctx.fillStyle = '#1f5aa6'; ctx.fillRect(8, 8, w - 16, h - 16); isa(ctx, w / 2, h / 2, 196, '#ffffff'); }),
    adaOld: mk(256, 256, (ctx, w, h) => { isa(ctx, w / 2, h / 2, 210, 'rgba(214,190,92,0.75)', true); }),
    stop: mk(256, 512, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(1, 2.2); ctx.font = `700 118px ${F.cond}`; ctx.fillText('STOP', 0, 0); ctx.restore();
    }),
    fire: mk(1024, 192, (ctx, w, h) => {
      ctx.fillStyle = '#f2c230'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 140px ${F.cond}`; spaced(ctx, 'FIRE LANE', w / 2, h / 2 + 6, 22);
    }),
    noPark: mk(512, 128, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 92px ${F.cond}`; ctx.fillText('NO PARKING', w / 2, h / 2 + 4);
    }),
  };
}

// ---------- storefront interiors (back-wall art, 1024 x 512 = unit width x ~3.3 m) ----------
export function interiorArt(kind, seed = 1) {
  const W = 1024, H = 512, c = makeCanvas(W, H), ctx = c.getContext('2d'), r = rng(seed);
  const wall = (col) => { ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); };
  if (kind === 'bens') {
    wall('#e8e6e1');
    ctx.fillStyle = '#b3202b'; ctx.fillRect(0, 36, W, 26); ctx.fillStyle = '#26345a'; ctx.fillRect(0, 62, W, 10);
    let x = 20;
    while (x < W - 60) {
      const t = r();
      if (t < 0.45) { // refrigerator
        const w = 70 + r() * 20, h = 300 + r() * 40, steel = r() < 0.6;
        ctx.fillStyle = steel ? '#c9cdd1' : '#f7f7f5'; ctx.fillRect(x, H - h - 20, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x + w / 2 - 1, H - h - 20, 2, h * 0.62); ctx.fillRect(x, H - 20 - h * 0.36, w, 2);
        ctx.fillStyle = '#6d7277'; ctx.fillRect(x + w / 2 - 8, H - h, 3, 90); ctx.fillRect(x + w / 2 + 5, H - h, 3, 90);
        x += w + 16;
      } else if (t < 0.8) { // washer / dryer
        const w = 76, h = 110;
        ctx.fillStyle = '#f5f5f3'; ctx.fillRect(x, H - h - 20, w, h);
        ctx.fillStyle = '#d9dcdf'; ctx.fillRect(x, H - h - 20, w, 18);
        ctx.fillStyle = '#9aa3aa'; ctx.beginPath(); ctx.arc(x + w / 2, H - 20 - h / 2 + 8, 28, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3d4a55'; ctx.beginPath(); ctx.arc(x + w / 2, H - 20 - h / 2 + 8, 20, 0, Math.PI * 2); ctx.fill();
        x += w + 10;
      } else { // range
        const w = 80, h = 105;
        ctx.fillStyle = '#2c2f33'; ctx.fillRect(x, H - h - 20, w, h);
        ctx.fillStyle = '#c3c7cb'; ctx.fillRect(x, H - h - 36, w, 18);
        ctx.fillStyle = '#15171a'; ctx.fillRect(x + 10, H - h + 10, w - 20, 50);
        x += w + 14;
      }
    }
  } else if (kind === 'ace') {
    wall('#efece6');
    ctx.fillStyle = '#c8202e'; ctx.fillRect(0, 30, W, 34);
    for (let x = 10; x < W; x += 170) {
      ctx.fillStyle = '#9da3a8'; ctx.fillRect(x, 90, 150, 400);
      for (let sy = 110; sy < 480; sy += 62) {
        ctx.fillStyle = '#7b8186'; ctx.fillRect(x, sy + 52, 150, 5);
        let px = x + 4;
        while (px < x + 146) {
          const pw = 10 + r() * 22;
          ctx.fillStyle = ['#c62828', '#ef6c00', '#fbc02d', '#1565c0', '#2e7d32', '#6d4c41', '#eeeeee', '#455a64'][Math.floor(r() * 8)];
          ctx.fillRect(px, sy + 52 - (24 + r() * 26), Math.min(pw, x + 146 - px), 24 + r() * 26);
          px += pw + 2;
        }
      }
    }
  } else if (kind === 'dominos') {
    wall('#f1efea');
    ctx.fillStyle = '#006491'; ctx.fillRect(0, 40, W, 20); ctx.fillStyle = '#e31837'; ctx.fillRect(0, 60, W, 8);
    ctx.fillStyle = '#1b1c1e'; for (let i = 0; i < 4; i++) ctx.fillRect(120 + i * 200, 110, 170, 110);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 4; i++) for (let l = 0; l < 6; l++) ctx.fillRect(135 + i * 200, 125 + l * 15, 90 + r() * 50, 5);
    ctx.fillStyle = '#6d4c41'; ctx.fillRect(60, 330, W - 120, 160); ctx.fillStyle = '#3e2723'; ctx.fillRect(60, 320, W - 120, 16);
  } else if (kind === 'rent2own') {
    wall('#e9e6e0');
    ctx.fillStyle = '#c8102e'; ctx.fillRect(0, 34, W, 22);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = '#111316'; ctx.fillRect(40 + i * 200, 90, 150, 88); ctx.fillStyle = '#2b3642'; ctx.fillRect(46 + i * 200, 96, 138, 76); }
    ctx.fillStyle = '#5d4037'; roundRect(ctx, 60, 330, 330, 120, 20); ctx.fill(); roundRect(ctx, 450, 350, 220, 100, 18); ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#161616'; ctx.beginPath(); ctx.arc(760 + (i % 2) * 110, 300 + Math.floor(i / 2) * 110, 48, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(760 + (i % 2) * 110, 300 + Math.floor(i / 2) * 110, 22, 0, Math.PI * 2); ctx.fill(); }
  } else if (kind === 'pumas') {
    wall('#dfe3ea');
    ctx.fillStyle = '#2f55c8'; ctx.fillRect(0, 30, W, 22);
    for (let x = 20; x < W; x += 245) {
      ctx.fillStyle = '#5d4037'; ctx.fillRect(x, 80, 220, 400);
      for (let sy = 96; sy < 470; sy += 74) {
        let px = x + 6;
        while (px < x + 214) { const pw = 22 + r() * 34; ctx.fillStyle = `hsl(${r() * 360},55%,${40 + r() * 25}%)`; ctx.fillRect(px, sy, Math.min(pw, x + 214 - px), 60); px += pw + 3; }
      }
    }
  } else if (kind === 'vanilla') {
    wall('#f0eee9');
    ctx.fillStyle = '#e2dfd8'; ctx.fillRect(0, H - 60, W, 60);
  } else { // vacant, dark
    wall('#6f6a62');
    ctx.fillStyle = '#5a554e'; ctx.fillRect(0, H - 150, W, 150);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(40,36,32,0.35)'; ctx.fillRect(r() * W, r() * H * 0.6, 60 + r() * 120, 30 + r() * 60); }
  }
  return tex(c);
}

export function ceilingArt(lit = true) {
  const W = 256, H = 256, c = makeCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = lit ? '#cfcfcc' : '#3e3c39'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i <= W; i += 64) { ctx.fillRect(i, 0, 2, H); ctx.fillRect(0, i, W, 2); }
  if (lit) { ctx.fillStyle = '#ffffff'; ctx.fillRect(18, 24, 92, 16); ctx.fillRect(146, 24, 92, 16); ctx.fillRect(18, 152, 92, 16); ctx.fillRect(146, 152, 92, 16); }
  const t = canvasTexture(c);
  return t;
}

// Vinyl lettering for a door transom: runs of [text, color], centered.
export function transomText(runs) {
  const W = 512, H = 124, c = makeCanvas(W, H), ctx = c.getContext('2d');
  let size = 72;
  const font = () => `700 ${size}px ${F.cond}`;
  ctx.font = font();
  const width = () => runs.reduce((a, [t]) => a + ctx.measureText(t).width, 0);
  while (width() > W * 0.92 && size > 20) { size -= 2; ctx.font = font(); }
  let x = (W - width()) / 2;
  ctx.textBaseline = 'middle';
  for (const [t, col] of runs) { ctx.fillStyle = col; ctx.fillText(t, x, H / 2 + 4); x += ctx.measureText(t).width; }
  return tex(c);
}

// Orange window graphics on the closed Big Lots entrance sidelights (existing condition).
export function bigLotsGraphic() {
  const W = 256, H = 640, c = makeCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#e8611d'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `700 34px ${F.cond}`; ctx.textAlign = 'center';
  ctx.fillText('WANNA BE A VIP?', W / 2, 70);
  ctx.font = `600 26px ${F.barlow}`;
  ctx.fillText('Join Big Rewards', W / 2, 108); ctx.fillText("It's FREE!", W / 2, 140);
  roundRect(ctx, W / 2 - 70, H - 230, 140, 140, 22); ctx.fill();
  ctx.fillStyle = '#e8611d'; ctx.font = `400 104px ${F.archivo}`; ctx.fillText('B!', W / 2 + 4, H - 120);
  return tex(c);
}

// Faded window decal left by a former tanning tenant in unit 211 (existing condition).
export function tanHereDecal() {
  const W = 256, H = 270, c = makeCanvas(W, H), ctx = c.getContext('2d');
  const cx = W / 2, cy = 96, R = 46;
  ctx.fillStyle = 'rgba(245,190,40,0.85)';
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2, rr = i % 2 ? R + 34 : R + 6;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(250,210,70,0.95)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(40,30,20,0.85)'; ctx.beginPath(); ctx.arc(cx - 15, cy - 6, 5, 0, Math.PI * 2); ctx.arc(cx + 15, cy - 6, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(245,190,40,0.9)'; ctx.textAlign = 'center';
  ctx.font = `400 40px ${F.archivo}`; ctx.fillText('TAN HERE!', cx, 222);
  ctx.font = `600 18px ${F.barlow}`; ctx.fillStyle = 'rgba(230,220,200,0.7)'; ctx.fillText('ALL YOUR TANNING NEEDS', cx, 252);
  return tex(c);
}

export function paperArt(seed = 3) {
  const W = 128, H = 256, c = makeCanvas(W, H), ctx = c.getContext('2d'), r = rng(seed);
  ctx.fillStyle = '#c9b48f'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(90,70,40,${r() * 0.12})`; ctx.fillRect(0, r() * H, W, 1 + r() * 3); }
  return tex(c);
}

export { THREE };
