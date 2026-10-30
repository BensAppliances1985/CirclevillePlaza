import * as THREE from 'three';
import { LOT, ROAD, PYLON } from './config.js';
import { Batch, FlatBuilder, boxAt, flatPolygon, makeCanvas, canvasTexture, rng, signPlane } from './util.js';
import { fbm } from './textures.js';
import * as S from './signs.js';

// Lot outline (site-local). The SW edge runs diagonally along the tree line, as in the aerial.
const LOT_POLY = [[-36, -69.5], [133, -69.5], [133, -14], [137.5, -14], [137.5, 0], [-8, 0]];
const MACRO_BOX = { x0: -36, x1: 137.5, z0: -69.5, z1: 0 };
const EAST_DRIVE = [[124.5, 0], [137.5, 0], [137.5, 86], [124.5, 86]];
const REAR_YARD = [[53.4, 23.9], [73.4, 23.9], [73.4, 45.9], [88.0, 45.9], [88.0, 40.9], [124.5, 40.9], [124.5, 86], [-3, 86], [-3, 79.5], [53.4, 79.5]];

export function rows() {
  const out = [];
  const A = LOT.aisles, h = LOT.aisleW / 2;
  for (let i = 0; i < A.length - 1; i++) out.push({ xw: A[i] + h, xe: A[i + 1] - h });
  out.push({ xw: A[A.length - 1] + h, xe: LOT.eastRowEnd });
  for (const r of out) r.xm = (r.xw + r.xe) / 2;
  return out;
}
export const stallZ = (k) => LOT.rowFront - k * LOT.stallW; // front edge of stall k

// ADA stalls: first stalls of the half-rows beside each crosswalk aisle.
function adaHalfRows(R) {
  const list = [];
  for (const cx of LOT.crosswalks) {
    const west = R.find((r) => Math.abs(r.xe + LOT.aisleW / 2 - cx) < 0.2);
    const east = R.find((r) => Math.abs(r.xw - LOT.aisleW / 2 - cx) < 0.2);
    if (west) list.push({ x0: west.xm, x1: west.xe, side: 'east', entry: 'fromEast' });
    if (east) list.push({ x0: east.xw, x1: east.xm, side: 'west', entry: 'fromWest' });
  }
  return list;
}

// ---------- lot surface textures (whole-lot canvases) ----------
function crackPaths(seed) {
  const r = rng(seed), paths = [];
  for (let i = 0; i < 85; i++) {
    const pts = [];
    let x = MACRO_BOX.x0 + r() * (MACRO_BOX.x1 - MACRO_BOX.x0), z = MACRO_BOX.z0 + r() * (MACRO_BOX.z1 - MACRO_BOX.z0);
    let a = r() * Math.PI * 2;
    const n = 8 + Math.floor(r() * 30);
    for (let k = 0; k < n; k++) { pts.push([x, z]); a += (r() - 0.5) * 0.9; const step = 0.8 + r() * 1.6; x += Math.cos(a) * step; z += Math.sin(a) * step; }
    paths.push({ pts, long: n > 22 });
  }
  // alligator (block) cracking zones near the drive lane and the old Big Lots entrance
  for (const [cx, cz, rad] of [[33, -6, 5], [70, -14, 4], [105, -40, 5], [20, -52, 4], [90, -64, 5], [-12, -30, 4]]) {
    for (let k = 0; k < 40; k++) {
      const x = cx + (r() - 0.5) * rad * 2, z = cz + (r() - 0.5) * rad * 2, a = r() * Math.PI;
      paths.push({ pts: [[x, z], [x + Math.cos(a) * 0.8, z + Math.sin(a) * 0.8], [x + Math.cos(a + 1) * 1.3, z + Math.sin(a + 1) * 1.3]], long: false });
    }
  }
  return paths;
}

function macroCanvas(phase, R) {
  const W = 2048, H = 1024, c = makeCanvas(W, H), ctx = c.getContext('2d');
  const px = (x) => ((x - MACRO_BOX.x0) / (MACRO_BOX.x1 - MACRO_BOX.x0)) * W;
  const py = (z) => ((MACRO_BOX.z1 - z) / (MACRO_BOX.z1 - MACRO_BOX.z0)) * H;
  const r = rng(phase === 'before' ? 301 : 302);
  const before = phase === 'before';
  ctx.fillStyle = before ? '#b0ada5' : '#3b3c40';
  ctx.fillRect(0, 0, W, H);
  // low-frequency mottling from an upscaled noise tile
  const N = 256, n = fbm(N, before ? 311 : 312, [[3, 0.5], [7, 0.3], [18, 0.2]]);
  const nc = makeCanvas(N, N / 2), nctx = nc.getContext('2d'), img = nctx.createImageData(N, N / 2);
  for (let i = 0; i < (N * N) / 2; i++) {
    const v = n[i];
    const d = before ? (v - 0.5) * 70 : (v - 0.5) * 14;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 128 + d; img.data[i * 4 + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  ctx.globalCompositeOperation = 'overlay';
  ctx.drawImage(nc, 0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  const paths = crackPaths(77);
  if (before) {
    // patch repairs
    for (let i = 0; i < 26; i++) {
      const x = px(MACRO_BOX.x0 + r() * 170), y = py(-r() * 69), w = 30 + r() * 120, h = 20 + r() * 70;
      ctx.save(); ctx.translate(x, y); ctx.rotate((r() - 0.5) * 0.5);
      ctx.fillStyle = `rgba(96,94,89,${0.3 + r() * 0.25})`; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = 'rgba(60,58,55,0.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
    // oil stains in the stalls closest to the stores
    for (const row of R) for (let k = 0; k < 18; k++) {
      if (r() > (k < 5 ? 0.45 : 0.12)) continue;
      const zc = (stallZ(k) + stallZ(k + 1)) / 2;
      for (const xc of [(row.xw + row.xm) / 2 + 0.6, (row.xm + row.xe) / 2 - 0.6]) {
        if (r() < 0.5) continue;
        const g = ctx.createRadialGradient(px(xc), py(zc), 1, px(xc), py(zc), 10 + r() * 14);
        g.addColorStop(0, 'rgba(60,56,50,0.55)'); g.addColorStop(1, 'rgba(60,56,50,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px(xc), py(zc), 16 + r() * 12, 10 + r() * 10, r() * 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    // cracks
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const p of paths) {
      ctx.strokeStyle = `rgba(62,60,56,${0.32 + r() * 0.3})`; ctx.lineWidth = p.long ? 0.9 + r() * 0.5 : 0.7;
      ctx.beginPath(); p.pts.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), py(z)) : ctx.moveTo(px(x), py(z)))); ctx.stroke();
    }
    // grime along the storefront curb
    const g = ctx.createLinearGradient(0, 0, 0, 60);
    g.addColorStop(0, 'rgba(70,66,58,0.45)'); g.addColorStop(1, 'rgba(70,66,58,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 60);
  } else {
    // routed-and-sealed cracks show as slightly darker, glossier bands under the fresh sealcoat
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const p of paths) {
      if (!p.long) continue;
      ctx.strokeStyle = 'rgba(16,16,18,0.42)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); p.pts.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), py(z)) : ctx.moveTo(px(x), py(z)))); ctx.stroke();
    }
  }
  const t = canvasTexture(c, { wrap: false, aniso: 8 });
  return t;
}

export function buildLot(ctx) {
  const { M, tx } = ctx;
  const root = new THREE.Group(); root.name = 'lot';
  const before = new THREE.Group(), after = new THREE.Group();
  root.add(before, after);
  const common = new Batch(), bb = new Batch(), ab = new Batch();
  const colliders = [], circles = [], segments = [];
  const R = rows();

  // ---------- pavement ----------
  const grain = tx.grain.clone(); grain.needsUpdate = true; grain.repeat.set(1 / 3, 1 / 3);
  const grainBump = tx.grainBump.clone(); grainBump.needsUpdate = true; grainBump.repeat.set(1 / 3, 1 / 3);
  const macro = { before: macroCanvas('before', R), after: macroCanvas('after', R) };
  const lotMat = new THREE.MeshStandardMaterial({ map: grain, bumpMap: grainBump, bumpScale: 0.7, roughness: 0.93 });
  const macroU = { value: macro.after };
  lotMat.onBeforeCompile = (sh) => {
    sh.uniforms.macroMap = macroU;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 uvMacro;\nvarying vec2 vUvMacro;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvUvMacro = uvMacro;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D macroMap;\nvarying vec2 vUvMacro;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= texture2D(macroMap, vUvMacro).rgb;');
  };
  lotMat.customProgramCacheKey = () => 'lot-macro';
  const lot = new THREE.Mesh(flatPolygon(LOT_POLY, 0, MACRO_BOX), lotMat);
  lot.receiveShadow = true; lot.name = 'lot-surface';
  root.add(lot);
  for (const poly of [EAST_DRIVE, REAR_YARD]) { const m = new THREE.Mesh(flatPolygon(poly, 0.002), M.asphalt); m.receiveShadow = true; root.add(m); }
  // curb cuts from the lot to Lancaster Pike
  for (const e of LOT.entrances) { const m = new THREE.Mesh(flatPolygon([[e.x - e.w / 2, ROAD.z0], [e.x + e.w / 2, ROAD.z0], [e.x + e.w / 2, LOT.roadEdgeZ], [e.x - e.w / 2, LOT.roadEdgeZ]], 0.001), M.asphalt); m.receiveShadow = true; root.add(m); }

  // ---------- curbs ----------
  const gaps = LOT.entrances.map((e) => [e.x - e.w / 2, e.x + e.w / 2]).sort((a, b) => a[0] - b[0]);
  let cx = -36;
  for (const [g0, g1] of gaps) { if (g0 > cx) common.add('concrete', boxAt(cx, 0, LOT.roadEdgeZ - 0.18, g0, 0.15, LOT.roadEdgeZ)); cx = Math.max(cx, g1); }
  common.add('concrete', boxAt(cx, 0, LOT.roadEdgeZ - 0.18, 133, 0.15, LOT.roadEdgeZ));
  common.add('concrete', boxAt(133, 0, -69.5, 133.18, 0.15, -14));

  // ---------- striping ----------
  const white = new FlatBuilder(0.012), blue = new FlatBuilder(0.013), yellowOld = new FlatBuilder(0.011), hatch = new FlatBuilder(0.013);
  const ada = adaHalfRows(R);
  const isAda = (x0, x1, k) => ada.some((a) => Math.abs(a.x0 - x0) < 0.01 && Math.abs(a.x1 - x1) < 0.01 && k <= 3);
  for (const row of R) {
    for (const [x0, x1] of [[row.xw, row.xm], [row.xm, row.xe]]) {
      for (let k = 0; k <= LOT.stallsPerRow; k++) {
        const z = stallZ(k);
        (isAda(x0, x1, k) ? blue : white).line(x0, z, x1, z, 0.1);
        yellowOld.line(x0, z, x1, z, 0.1);
      }
    }
    white.line(row.xm, LOT.rowFront, row.xm, LOT.rowBack, 0.1);
    yellowOld.line(row.xm, LOT.rowFront, row.xm, LOT.rowBack, 0.1);
  }
  // ADA access aisles: hatching between stall 0 and stall 2, plus symbols and signs
  const dec = S.decalTextures();
  const decAda = new FlatBuilder(0.016), decNoPark = new FlatBuilder(0.016), decOld = new FlatBuilder(0.015);
  const signPosts = [];
  for (const a of ada) {
    const za = stallZ(1), zb = stallZ(2);
    const w = a.x1 - a.x0;
    for (let s = -3; s < w / 0.7 + 3; s++) {
      const xs = a.x0 + s * 0.7;
      // diagonal clipped to the aisle rectangle
      const p0 = [xs, zb], p1 = [xs + (za - zb), za];
      const clip = (p, q) => {
        let [x0, z0] = p, [x1, z1] = q;
        const t0 = Math.max(0, (a.x0 - x0) / (x1 - x0)), t1 = Math.min(1, (a.x1 - x0) / (x1 - x0));
        if (t1 <= t0) return null;
        return [[x0 + (x1 - x0) * t0, z0 + (z1 - z0) * t0], [x0 + (x1 - x0) * t1, z0 + (z1 - z0) * t1]];
      };
      const seg = clip(p0, p1);
      if (seg) hatch.line(seg[0][0], seg[0][1], seg[1][0], seg[1][1], 0.1);
    }
    hatch.line(a.x0, za, a.x0, zb, 0.1); hatch.line(a.x1, za, a.x1, zb, 0.1);
    const rot = a.entry === 'fromEast' ? 3 : 1;
    const npX = a.entry === 'fromEast' ? a.x1 - 1.1 : a.x0 + 1.1;
    decNoPark.rect(npX - 0.35, zb + 0.18, npX + 0.35, za - 0.18, 0.016, rot);
    for (const k of [0, 2]) {
      const zc = (stallZ(k) + stallZ(k + 1)) / 2, xc = (a.x0 + a.x1) / 2;
      decAda.rect(xc - 0.7, zc - 0.7, xc + 0.7, zc + 0.7, 0.016, rot);
      const headX = a.side === 'east' ? a.x0 + 0.35 : a.x1 - 0.35;
      signPosts.push({ x: headX, z: zc, facing: a.entry === 'fromEast' ? 'px' : 'nx', van: k === 0 });
    }
  }
  // faded yellow symbols of the old accessible stalls near the storefronts
  for (const [x, z] of [[71.1, -11.4], [77.6, -11.4], [4.6, -11.4], [13.6, -11.4], [109.1, -16.9]]) decOld.rect(x - 0.75, z - 0.75, x + 0.75, z + 0.75, 0.015, 3);

  // crosswalks across the drive lane (continental bars)
  for (const c of LOT.crosswalks) for (let n = 0; n < 8; n++) { const z = -0.9 - n * 1.2; white.line(c - 1.6, z, c + 1.6, z, 0.6); }
  // stop bars and STOP legends at the exits
  const decStop = new FlatBuilder(0.016), decFire = new FlatBuilder(0.016);
  for (const e of LOT.entrances) {
    white.line(e.x + 0.3, LOT.roadEdgeZ + 1.3, e.x + e.w / 2 - 0.4, LOT.roadEdgeZ + 1.3, 0.45);
    const sx = e.x + e.w / 4;
    decStop.rect(sx - 0.9, LOT.roadEdgeZ + 2.0, sx + 0.9, LOT.roadEdgeZ + 5.6, 0.016, 0);
  }
  for (const x of [8, 56, 96]) decFire.rect(x - 2.4, -2.2, x + 2.4, -1.3, 0.016, 2);

  const lineMat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, ...o });
  const decalMat = (map, o = {}) => new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6, ...o });
  const wearMap = tx.wear.clone(); wearMap.needsUpdate = true; wearMap.repeat.set(0.5, 1);
  const mesh = (fb, mat, group, order = 1) => { if (fb.empty) return; const m = new THREE.Mesh(fb.geometry(), mat); m.receiveShadow = true; m.renderOrder = order; group.add(m); return m; };
  mesh(white, lineMat('#efefea'), after);
  mesh(blue, lineMat('#2a62b0'), after);
  mesh(hatch, lineMat('#2a62b0'), after);
  mesh(yellowOld, lineMat('#dcc266', { map: wearMap, transparent: true, opacity: 0.92, depthWrite: false }), before);
  mesh(decAda, decalMat(dec.adaNew), after, 2);
  mesh(decNoPark, decalMat(dec.noPark), after, 2);
  mesh(decStop, decalMat(dec.stop), after, 2);
  mesh(decFire, decalMat(dec.fire), after, 2);
  mesh(decOld, decalMat(dec.adaOld), before, 2);

  // ---------- accessible parking signs ----------
  const faceNew = S.adaSignFace(false), faceVan = S.adaSignFace(true);
  const matNew = new THREE.MeshStandardMaterial({ map: faceNew, roughness: 0.5 }), matVan = new THREE.MeshStandardMaterial({ map: faceVan, roughness: 0.5 });
  const adaSign = (group, batch, x, z, facing, mat, lean = 0, portable = false) => {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.3, 8), M.galv);
    post.position.y = 1.15; post.castShadow = true; g.add(post);
    const face = new THREE.Mesh(signPlane(0.3, 0.46, 0, 1.95, 0, 'pz'), mat);
    face.rotation.y = { px: Math.PI / 2, nx: -Math.PI / 2, pz: 0, nz: Math.PI }[facing];
    face.position.set(facing === 'px' ? 0.04 : facing === 'nx' ? -0.04 : 0, 0, facing === 'pz' ? 0.04 : facing === 'nz' ? -0.04 : 0);
    g.add(face);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.46, 0.01), M.galv); back.position.y = 1.95; back.rotation.y = face.rotation.y; g.add(back);
    if (portable) { const base = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.45, 4), M.poleBase); base.position.y = 0.22; base.rotation.y = Math.PI / 4; base.castShadow = true; g.add(base); }
    else { const bol = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.0, 16), M.yellowPaint); bol.position.y = 0.5; bol.castShadow = true; g.add(bol); }
    g.position.set(x, 0, z); g.rotation.z = lean;
    group.add(g);
    circles.push({ x, z, r: portable ? 0.35 : 0.16, phase: group === after ? 'after' : 'before' });
  };
  for (const p of signPosts) adaSign(after, ab, p.x, p.z, p.facing, p.van ? matVan : matNew);
  const oldFace = new THREE.MeshStandardMaterial({ map: faceNew, color: '#d9d4c4', roughness: 0.7 });
  for (const [x, z, lean] of [[4.2, -1.6, 0], [11.4, -1.6, 0], [20.5, -1.6, 0.22], [44.5, -1.6, 0], [67.2, -1.6, 0], [110.6, -1.6, 0]]) adaSign(before, bb, x, z, 'nz', oldFace, lean, true);

  // ---------- light poles ----------
  const poles = [[R[0].xm, -37], [R[1].xm, -21], [R[1].xm, -50], [R[2].xm, -37], [R[3].xm, -21], [R[3].xm, -50], [R[4].xm, -37], [R[5].xm, -21], [R[5].xm, -50], [R[6].xm, -37]];
  const lampHeads = new Batch();
  const pools = [];
  for (const [x, z] of poles) {
    const base = new THREE.CylinderGeometry(0.34, 0.38, 0.8, 16); base.translate(x, 0.4, z); common.add('poleBase', base);
    const pole = new THREE.CylinderGeometry(0.09, 0.13, 9.4, 12); pole.translate(x, 0.8 + 4.7, z); common.add('pole', pole);
    common.add('pole', boxAt(x - 0.9, 10.05, z - 0.05, x + 0.9, 10.15, z + 0.05));
    for (const s of [-1, 1]) lampHeads.add('lampHead', boxAt(x + s * 0.95 - 0.34, 9.98, z - 0.2, x + s * 0.95 + 0.34, 10.12, z + 0.2));
    circles.push({ x, z, r: 0.42 });
    pools.push([x, z]);
  }
  lampHeads.build(M, root, { default: { cast: false, receive: false } });
  const poolGeo = new FlatBuilder(0.03);
  for (const [x, z] of pools) poolGeo.rect(x - 13, z - 13, x + 13, z + 13, 0.03);
  for (const e of [[-18, -74.3], [70, -74.3], [158, -74.3]]) poolGeo.rect(e[0] - 9, e[1] - 9, e[0] + 9, e[1] + 9, 0.03);
  const poolMesh = new THREE.Mesh(poolGeo.geometry(), M.pool); poolMesh.renderOrder = 3; root.add(poolMesh);

  // ---------- cart corrals ----------
  const corral = (batch, key, x0, z0, x1, z1) => {
    for (const z of [z0, z1]) for (const y of [0.55, 1.0]) batch.add(key, boxAt(x0, y, z - 0.03, x1, y + 0.05, z + 0.03));
    for (const x of [x0, x1]) for (const z of [z0, z1]) batch.add(key, boxAt(x - 0.03, 0, z - 0.03, x + 0.03, 1.05, z + 0.03));
    batch.add(key, boxAt(x1 - 0.03, 0.55, z0, x1 + 0.03, 1.05, z1));
  };
  corral(bb, 'rust', 30.2, -15.9, 35.6, -14.6); colliders.push({ x0: 30.2, x1: 35.6, z0: -15.9, z1: -14.6, phase: 'before' });
  corral(bb, 'rust', 20.1, -43.4, 25.5, -42.1); colliders.push({ x0: 20.1, x1: 25.5, z0: -43.4, z1: -42.1, phase: 'before' });
  corral(ab, 'galv', 118.4, -26.0, 123.2, -24.4); colliders.push({ x0: 118.4, x1: 123.2, z0: -26.0, z1: -24.4, phase: 'after' });

  // ---------- guardrail along the SW edge ----------
  const gr0 = [-9.2, -3.5], gr1 = [-34.6, -67.5];
  const dx = gr1[0] - gr0[0], dz = gr1[1] - gr0[1], len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
  const rail = new THREE.BoxGeometry(0.05, 0.32, len); rail.rotateY(ang); rail.translate((gr0[0] + gr1[0]) / 2, 0.68, (gr0[1] + gr1[1]) / 2); common.add('galv', rail);
  for (let d = 0; d <= len; d += 1.9) { const p = new THREE.BoxGeometry(0.12, 0.85, 0.12); p.translate(gr0[0] + (dx * d) / len - 0.08, 0.42, gr0[1] + (dz * d) / len); common.add('galv', p); }
  segments.push({ x0: gr0[0], z0: gr0[1], x1: gr1[0], z1: gr1[1], r: 0.2 });

  // ---------- pylon landscape island (proposed) ----------
  {
    const x0 = PYLON.x - 1.3, x1 = PYLON.x + 1.3, z0 = PYLON.z - 2.4, z1 = PYLON.z + 2.4;
    for (const [a, b, c2, d] of [[x0, z0, x1, z0 + 0.15], [x0, z1 - 0.15, x1, z1], [x0, z0, x0 + 0.15, z1], [x1 - 0.15, z0, x1, z1]]) ab.add('concrete', boxAt(a, 0, b, c2, 0.18, d));
    ab.add('mulch', boxAt(x0 + 0.15, 0, z0 + 0.15, x1 - 0.15, 0.12, z1 - 0.15));
    const rr = rng(9);
    for (let i = 0; i < 9; i++) {
      const s = new THREE.IcosahedronGeometry(0.28 + rr() * 0.12, 1);
      s.scale(1, 0.75, 1);
      const px2 = x0 + 0.45 + rr() * (x1 - x0 - 0.9), pz = z0 + 0.45 + rr() * (z1 - z0 - 0.9);
      if (Math.abs(pz - PYLON.z) < 1.9 && Math.abs(px2 - PYLON.x) < 0.5) continue;
      s.translate(px2, 0.3, pz);
      ab.add('shrub', s);
    }
  }

  common.build(M, root);
  bb.build(M, before);
  ab.build(M, after);

  return {
    root, before, after, colliders, circles, segments,
    setPhase(phase, light) {
      macroU.value = macro[phase];
      lotMat.color.set(phase === 'before' ? '#ffffff' : '#ffffff');
      const dusk = light === 'dusk';
      M.pool.opacity = dusk ? (phase === 'before' ? 0.32 : 0.55) : 0;
      poolMesh.visible = dusk;
      M.lampHead.emissiveIntensity = dusk ? (phase === 'before' ? 0.8 : 1.5) : 0;
    },
  };
}
