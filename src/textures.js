import * as THREE from 'three';
import { rng, makeCanvas, canvasTexture, clamp } from './util.js';

// ---------- noise helpers ----------
// Periodic value noise so every texture tiles seamlessly.
function valueNoise(size, cells, seed) {
  const r = rng(seed);
  const grid = new Float32Array(cells * cells);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const gy = (y / size) * cells, y0 = Math.floor(gy), fy = gy - y0, sy = fy * fy * (3 - 2 * fy);
    const r0 = (y0 % cells) * cells, r1 = ((y0 + 1) % cells) * cells;
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * cells, x0 = Math.floor(gx), fx = gx - x0, sx = fx * fx * (3 - 2 * fx);
      const c0 = x0 % cells, c1 = (x0 + 1) % cells;
      const a = grid[r0 + c0], b = grid[r0 + c1], c = grid[r1 + c0], d = grid[r1 + c1];
      out[y * size + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    }
  }
  return out;
}
export function fbm(size, seed, octaves = [[4, 0.5], [8, 0.25], [16, 0.13], [32, 0.07], [64, 0.05]]) {
  const out = new Float32Array(size * size);
  let total = 0;
  octaves.forEach(([cells, w], i) => {
    const n = valueNoise(size, cells, seed + i * 101);
    for (let k = 0; k < out.length; k++) out[k] += n[k] * w;
    total += w;
  });
  for (let k = 0; k < out.length; k++) out[k] /= total;
  return out;
}

function grayCanvas(size, fn) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size), d = img.data;
  for (let i = 0; i < size * size; i++) {
    const v = clamp(Math.round(fn(i) * 255), 0, 255);
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------- ground ----------
export function asphaltGrain() {
  const S = 512, n = fbm(S, 11), r = rng(12);
  const c = grayCanvas(S, (i) => {
    let v = 0.8 + (n[i] - 0.5) * 0.28;
    const s = r();
    if (s < 0.05) v += 0.16 + r() * 0.12; else if (s < 0.09) v -= 0.14;
    return v;
  });
  return { map: canvasTexture(c), bump: canvasTexture(c, { srgb: false }) };
}

export function concrete() {
  const S = 512, n = fbm(S, 21, [[4, 0.4], [16, 0.3], [64, 0.3]]), r = rng(22);
  const c = grayCanvas(S, (i) => {
    const x = i % S, y = (i / S) | 0;
    let v = 0.9 + (n[i] - 0.5) * 0.14 + (r() - 0.5) * 0.05;
    if (x < 3 || y < 3) v -= 0.28; // control joint at the tile edge
    return v;
  });
  return canvasTexture(c);
}

// Fine grass detail only; large-scale variation comes from the ground mesh's vertex colors so the tile never reads.
export function grass() {
  const S = 512, n = fbm(S, 31, [[16, 0.35], [32, 0.35], [64, 0.3]]), r = rng(33);
  const c = makeCanvas(S, S), ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S), d = img.data;
  for (let i = 0; i < S * S; i++) {
    const t = n[i], s = r();
    let R = 74 + t * 26, G = 102 + t * 32, Bc = 44 + t * 14;
    if (s < 0.08) { R *= 0.8; G *= 0.82; Bc *= 0.8; } else if (s < 0.12) { R *= 1.1; G *= 1.1; }
    d[i * 4] = R; d[i * 4 + 1] = G; d[i * 4 + 2] = Bc; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvasTexture(c);
}

// ---------- building ----------
// Cultured (faux) stone veneer, 1.6 m x 1.2 m tile: pale irregular flagstones with thin shadowed joints,
// as on the knee walls and the NE end block. Periodic Voronoi cells so the tile repeats seamlessly.
export function stone() {
  const W = 1024, H = 768, r = rng(41);
  const cols = 7, rowsN = 5, cw = W / cols, ch = H / rowsN;
  const pts = [];
  for (let j = 0; j < rowsN; j++) for (let i = 0; i < cols; i++) {
    pts.push({ x: (i + 0.15 + r() * 0.7) * cw, y: (j + 0.15 + r() * 0.7) * ch, tone: 0.93 + r() * 0.12, tilt: r() * Math.PI * 2 });
  }
  const n = fbm(256, 43, [[8, 0.5], [32, 0.3], [64, 0.2]]);
  const c = makeCanvas(W, H), ctx = c.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  const b = makeCanvas(W, H), bctx = b.getContext('2d'), bimg = bctx.createImageData(W, H), bd = bimg.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let d1 = 1e9, d2 = 1e9, best = null;
    const ci = Math.floor(x / cw), cj = Math.floor(y / ch);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = (ci + di + cols) % cols, jj = (cj + dj + rowsN) % rowsN;
      const p = pts[jj * cols + ii];
      const px = p.x + (ci + di - ii) * cw, py = p.y + (cj + dj - jj) * ch;
      const dd = Math.hypot(x - px, y - py);
      if (dd < d1) { d2 = d1; d1 = dd; best = { p, px, py }; } else if (dd < d2) d2 = dd;
    }
    const edge = d2 - d1;                               // distance to the cell border (x2)
    const nv = n[((y * 256 / H) | 0) * 256 + ((x * 256 / W) | 0)];
    // face: slight dome toward the cell centre plus a directional shade (light from upper left)
    const dx = (x - best.px) / cw, dy = (y - best.py) / ch;
    const dome = Math.max(0, 1 - Math.hypot(dx, dy) * 1.1);
    let v = best.p.tone * (0.9 + nv * 0.12) * (0.97 + dome * 0.05) * (1 - 0.05 * (dx + dy));
    let bump = 0.55 + dome * 0.25 + nv * 0.15;
    if (edge < 7) { const k = edge / 7; v *= 0.55 + 0.45 * k; bump *= 0.25 + 0.75 * k; }
    const i = (y * W + x) * 4;
    d[i] = Math.min(255, 214 * v); d[i + 1] = Math.min(255, 205 * v); d[i + 2] = Math.min(255, 190 * v); d[i + 3] = 255;
    bd[i] = bd[i + 1] = bd[i + 2] = Math.min(255, bump * 255); bd[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); bctx.putImageData(bimg, 0, 0);
  return { map: canvasTexture(c), bump: canvasTexture(b, { srgb: false }) };
}
// Vertical ribbed metal panel: one rib per tile (tile = 0.3 m wide).
export function ribs() {
  const W = 128, H = 8;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const b = makeCanvas(W, H), bx = b.getContext('2d');
  const stops = [[0, 0.93, 0.35], [0.56, 0.93, 0.35], [0.6, 1.0, 0.7], [0.7, 1.0, 1.0], [0.78, 0.74, 0.7], [0.84, 0.86, 0.35], [1, 0.93, 0.35]];
  for (let x = 0; x < W; x++) {
    const t = x / W;
    let i = 0; while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [t0, v0, h0] = stops[i], [t1, v1, h1] = stops[i + 1];
    const f = (t - t0) / (t1 - t0 || 1);
    const v = v0 + (v1 - v0) * f, h = h0 + (h1 - h0) * f;
    ctx.fillStyle = `rgb(${v * 255 | 0},${v * 255 | 0},${v * 255 | 0})`; ctx.fillRect(x, 0, 1, H);
    bx.fillStyle = `rgb(${h * 255 | 0},${h * 255 | 0},${h * 255 | 0})`; bx.fillRect(x, 0, 1, H);
  }
  return { map: canvasTexture(c), bump: canvasTexture(b, { srgb: false }) };
}

// Standing-seam roof panel: tile = 0.45 m wide, seam near the right edge.
export function seams() {
  const W = 128, H = 8;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const b = makeCanvas(W, H), bx = b.getContext('2d');
  ctx.fillStyle = 'rgb(238,238,238)'; ctx.fillRect(0, 0, W, H);
  bx.fillStyle = 'rgb(60,60,60)'; bx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgb(250,250,250)'; ctx.fillRect(W - 12, 0, 4, H);
  ctx.fillStyle = 'rgb(200,200,200)'; ctx.fillRect(W - 8, 0, 5, H);
  bx.fillStyle = 'rgb(255,255,255)'; bx.fillRect(W - 12, 0, 8, H);
  return { map: canvasTexture(c), bump: canvasTexture(b, { srgb: false }) };
}

// Metal soffit panels with a V-groove every 0.3 m.
export function soffitLines() {
  const W = 128, H = 8;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = 'rgb(240,240,240)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgb(175,175,175)'; ctx.fillRect(0, 0, 3, H);
  ctx.fillStyle = 'rgb(252,252,252)'; ctx.fillRect(3, 0, 2, H);
  return canvasTexture(c);
}

// Cedar-tone slats (for the modern scheme's soffit): tile 1.2 m x 0.6 m, four 150 mm boards.
export function woodSlats() {
  const W = 512, H = 256, r = rng(51);
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const tones = ['#a8744a', '#9a6a43', '#b07d52', '#8f613d'];
  for (let s = 0; s < 4; s++) {
    const y0 = s * 64;
    let x = 0;
    while (x < W) {
      const len = 180 + r() * 300;
      ctx.fillStyle = tones[Math.floor(r() * tones.length)];
      ctx.fillRect(x, y0, len, 64);
      for (let k = 0; k < 22; k++) {
        ctx.strokeStyle = r() < 0.5 ? 'rgba(60,30,10,0.18)' : 'rgba(255,220,180,0.12)';
        ctx.lineWidth = 1 + r() * 2;
        const gy = y0 + 4 + r() * 56;
        ctx.beginPath(); ctx.moveTo(x, gy);
        ctx.bezierCurveTo(x + len * 0.3, gy + (r() - 0.5) * 8, x + len * 0.7, gy + (r() - 0.5) * 8, x + len, gy + (r() - 0.5) * 4);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(40,20,5,0.55)'; ctx.fillRect(x, y0, 2, 64);
      x += len;
    }
    ctx.fillStyle = 'rgba(30,15,5,0.7)'; ctx.fillRect(0, y0 + 61, W, 3);
  }
  return canvasTexture(c);
}

// Concrete masonry units, running bond: tile = 0.8 m x 0.4 m (two blocks, two courses).
export function cmu() {
  const W = 512, H = 256, n = fbm(256, 61, [[8, 0.5], [32, 0.5]]), r = rng(62);
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const course = Math.floor(y / 128), offset = course % 2 ? 128 : 0;
    const lx = (x + offset) % 256, ly = y % 128;
    let v = 0.88 + (n[(y % 256) * 256 + (x % 256)] - 0.5) * 0.12 + (r() - 0.5) * 0.06;
    if (ly < 5 || lx < 5) v = 0.72;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = clamp(v * 255, 0, 255); d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvasTexture(c);
}

// Single-ply roof membrane, tile = 8 m, with seams.
export function membrane() {
  const S = 512, n = fbm(S, 71, [[3, 0.5], [12, 0.3], [48, 0.2]]);
  const c = grayCanvas(S, (i) => {
    const x = i % S;
    let v = 0.86 + (n[i] - 0.5) * 0.18;
    if (x % 192 < 3) v -= 0.1;
    return v;
  });
  return canvasTexture(c);
}

// Asphalt shingles, tile = 3 m.
export function shingles() {
  const S = 512, r = rng(81);
  const c = makeCanvas(S, S), ctx = c.getContext('2d');
  ctx.fillStyle = '#777'; ctx.fillRect(0, 0, S, S);
  const rowH = 32;
  for (let y = 0; y < S; y += rowH) {
    const off = (y / rowH) % 2 ? 24 : 0;
    for (let x = -48; x < S; x += 48) {
      const v = 95 + r() * 60;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x + off, y, 46, rowH - 3);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, y + rowH - 3, S, 3);
  }
  return canvasTexture(c);
}

// Weathering streaks for the existing facade, tile = 6 m. Mostly white (multiplier).
export function grime() {
  const S = 512, n = fbm(S, 91, [[3, 0.5], [10, 0.3], [40, 0.2]]), r = rng(92);
  const c = grayCanvas(S, (i) => 0.95 + (n[i] - 0.5) * 0.09);
  const ctx = c.getContext('2d');
  for (let k = 0; k < 60; k++) {
    const x = r() * S, len = 40 + r() * 260, w = 2 + r() * 8;
    const g = ctx.createLinearGradient(0, S - 0, 0, S - len);
    g.addColorStop(0, 'rgba(70,60,50,0.06)'); g.addColorStop(1, 'rgba(70,60,50,0)');
    ctx.fillStyle = g; ctx.fillRect(x, S - len, w, len);
  }
  return canvasTexture(c);
}

// Cloud layer (RGBA), tiles.
export function clouds() {
  const S = 1024, n = fbm(S, 101, [[4, 0.45], [8, 0.25], [16, 0.15], [32, 0.1], [64, 0.05]]);
  const c = makeCanvas(S, S), ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S), d = img.data;
  for (let i = 0; i < S * S; i++) {
    const a = clamp((n[i] - 0.52) * 4.2, 0, 1);
    const shadeV = 235 - clamp((n[i] - 0.6) * 260, 0, 60);
    d[i * 4] = shadeV; d[i * 4 + 1] = shadeV; d[i * 4 + 2] = shadeV + 8; d[i * 4 + 3] = a * 235;
  }
  ctx.putImageData(img, 0, 0);
  return canvasTexture(c);
}

// Soft radial pool used for light spill at dusk (additive).
export function lightPool() {
  const S = 256, c = makeCanvas(S, S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,236,200,1)');
  g.addColorStop(0.35, 'rgba(255,226,180,0.55)');
  g.addColorStop(1, 'rgba(255,220,170,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return canvasTexture(c, { wrap: false });
}

// Leafy variation for tree canopies.
export function leaves() {
  const S = 256, n = fbm(S, 111, [[8, 0.4], [32, 0.35], [64, 0.25]]), r = rng(112);
  const c = grayCanvas(S, (i) => 0.62 + n[i] * 0.45 + (r() < 0.1 ? -0.25 : 0));
  return canvasTexture(c);
}

// Wear mask for faded paint lines (RGBA alpha holes), tile = 2 m along the line.
export function wear() {
  const W = 256, H = 16, n = fbm(256, 121, [[8, 0.5], [32, 0.3], [64, 0.2]]);
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, v = n[(y * 16 % 256) * 256 + x];
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255;
    d[i * 4 + 3] = clamp((v - 0.3) * 2.2, 0, 1) * 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvasTexture(c);
}

export function setRepeat(t, sx, sy = sx) { t.repeat.set(1 / sx, 1 / sy); return t; }
export const TEX_ANISO = { value: 8 };
export function applyAniso(textures, max) { for (const t of textures) if (t && t.isTexture) t.anisotropy = max; }
export { THREE };
