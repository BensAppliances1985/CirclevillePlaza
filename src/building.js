import * as THREE from 'three';
import { B, G, WZ, WALK, FACADE, RECESS, UNITS } from './config.js';
import { Batch, FlatBuilder, boxAt, signPlane, rng } from './util.js';
import * as S from './signs.js';

const SHADOW = {
  default: { cast: true, receive: true },
  glass: { cast: false, receive: false },
  darkGlass: { cast: false, receive: true },
  soffitLight: { cast: false, receive: false },
  panel: { cast: false, receive: true },
  panelB: { cast: false, receive: true },
  panelC: { cast: false, receive: true },
  panelD: { cast: false, receive: true },
  panelE: { cast: false, receive: true },
  backer: { cast: false, receive: true },
  soffit: { cast: false, receive: true },
  olive: { cast: false, receive: true },
};

// quad from 4 points (p0..p3 counter-clockwise seen from the visible side) with matching uvs
function quad(p0, p1, p2, p3, u0, u1, u2, u3) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...p0, ...p1, ...p2, ...p0, ...p2, ...p3]), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([...u0, ...u1, ...u2, ...u0, ...u2, ...u3]), 2));
  g.computeVertexNormals();
  return g;
}
function hplane(x0, z0, x1, z1, y, up = true) {
  const a = [x0, y, z0], b = [x1, y, z0], c = [x1, y, z1], d = [x0, y, z1];
  return up ? quad(a, d, c, b, [x0, -z0], [x0, -z1], [x1, -z1], [x1, -z0]) : quad(a, b, c, d, [x0, z0], [x1, z0], [x1, z1], [x0, z1]);
}
// prism along x from a (z, y) outline (counter-clockwise when seen from +x)
function prismX(pts, x0, x1) {
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(-z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  g.translate(x0, 0, 0);
  return g;
}

export function buildBuilding(ctx, banner) {
  const { M } = ctx;
  const root = new THREE.Group(); root.name = 'building';
  const before = new THREE.Group(), after = new THREE.Group();
  before.name = 'building-before'; after.name = 'building-after';
  root.add(before, after);
  const common = new Batch(), bb = new Batch(), ab = new Batch();
  const colliders = [], circles = [];
  const glassGeos = [];
  const r = rng(5);
  const A = B.anchor, I = B.inline, FZ = B.fasciaZ;
  const inAnchor = (x) => x < A.x1;
  const topAt = (x) => (inAnchor(x) ? A.soffitPeak + 0.06 : B.soffitBack + 0.06);   // storefront wall top
  const headAt = (x) => WALK + (inAnchor(x) ? 3.11 : 3.16);                           // storefront glass head

  // ---------------- sidewalk ----------------
  common.add('concrete', boxAt(0, 0, 0, B.length, WALK, G));
  ab.add('curbPaint', signPlane(B.length, 0.14, B.length / 2, 0.078, -0.004, 'nz'));

  // ---------------- roof masses ----------------
  for (const [i, m] of B.masses.entries()) {
    common.add('roof', boxAt(m.x0, m.roof - 0.25, WZ, m.x1, m.roof, m.z1 - 0.3));
    common.add('backWall', boxAt(m.x0, 0, m.z1 - 0.3, m.x1, m.wall, m.z1));
    // side walls only where they are outside walls: the building ends, or beyond a shallower neighbour
    // (interior demising walls would otherwise block the recess glass)
    const prev = B.masses[i - 1], next = B.masses[i + 1];
    if (!prev || prev.z1 < m.z1) common.add('backWall', boxAt(m.x0, 0, prev ? prev.z1 - 0.3 : WZ, m.x0 + 0.3, m.wall, m.z1));
    if (!next || next.z1 < m.z1) common.add('backWall', boxAt(m.x1 - 0.3, 0, next ? next.z1 - 0.3 : (i === 3 ? G + 2.0 : WZ), m.x1, m.wall, m.z1));
    if (i === 3) common.add('frame', boxAt(m.x1 - 0.35, m.wall, G + 2.0, m.x1 + 0.05, m.wall + 0.1, m.z1 + 0.05));
    // front wall above the storefronts (behind the canopy)
    const fx0 = Math.max(m.x0, B.tanBox.x1), fx1 = Math.min(m.x1, B.neEnd.x0);
    if (fx1 > fx0) common.add('backWall', boxAt(fx0, inAnchor(fx0) ? A.soffitPeak : B.soffitBack, G, fx1, m.roof, WZ));
    // the recess is cut out of the storefront zone; keep its glass walls solid
    if (RECESS.x0 <= m.x1 && RECESS.x1 >= m.x0) {
      const zb = G + RECESS.depth;
      if (m.x0 < RECESS.x0) colliders.push({ x0: m.x0, x1: RECESS.x0, z0: G - 0.02, z1: m.z1 });
      if (m.x1 > RECESS.x1) colliders.push({ x0: RECESS.x1, x1: m.x1, z0: G - 0.02, z1: m.z1 });
      colliders.push({ x0: Math.max(m.x0, RECESS.x0), x1: Math.min(m.x1, RECESS.x1), z0: zb - 0.04, z1: m.z1 });
    } else colliders.push({ x0: m.x0, x1: m.x1, z0: G - 0.02, z1: m.z1 });
  }
  // rear service doors and docks
  for (const x of [18, 26]) {
    common.add('dockDoor', boxAt(x, 0.9, 79.5, x + 3, 3.9, 79.56));
    common.add('darkMetal', boxAt(x - 0.2, 0.8, 79.5, x + 3.2, 0.95, 79.9));
  }
  for (const u of UNITS) if (u.id !== 'bens') {
    const cx = (u.x0 + u.x1) / 2, m = B.masses.find((mm) => cx >= mm.x0 && cx <= mm.x1);
    common.add('door', boxAt(cx - 0.5, 0, m.z1, cx + 0.5, 2.15, m.z1 + 0.05));
  }
  common.add('door', boxAt(40, 0, 79.5, 41, 2.15, 79.56));

  // ---------------- end blocks (no canopy, set back at the glass line) ----------------
  const T = B.tanBox, NE = B.neEnd;
  common.add('endWall', boxAt(T.x0, 0, G, T.x1, T.top, WZ));
  common.add('frame', boxAt(T.x0 - 0.04, T.top, G - 0.06, T.x1 + 0.04, T.top + 0.12, WZ));
  common.add('mullion', boxAt(6.92, WALK, G - 0.03, 8.08, 2.42, G));
  common.add('door', boxAt(7.02, WALK, G - 0.06, 7.98, 2.32, G - 0.02));
  common.add('galv', boxAt(7.12, 1.0, G - 0.1, 7.17, 1.08, G - 0.06));
  // the stone facing wraps the NE corner for about 2 m, then the side wall is plain block
  common.add('stone', boxAt(NE.x0, 0, G, NE.x1, NE.top, G + 2.0));
  common.add('frame', boxAt(NE.x0, NE.top, G - 0.06, NE.x1 + 0.04, NE.top + 0.1, G + 2.0));
  // old sign patch on the NE block (existing) and the downspout run along its base
  bb.add('panel', signPlane(1.2, 1.4, 122.7, 4.5, G - 0.004, 'nz'));
  const drain = new THREE.CylinderGeometry(0.05, 0.05, NE.x1 - NE.x0 - 0.6, 10); drain.rotateZ(Math.PI / 2); drain.translate((NE.x0 + NE.x1) / 2, 0.42, G - 0.08); common.add('galv', drain);

  // ---------------- canopies ----------------
  const canopy = (c, { closeStart, closeEnd, gables }) => {
    const { x0, x1, bottom, fasciaTop: fT, mansardTop: mT, parapetTop: pT, run } = c;
    const zt = run, zs = 0.0;
    common.add('frame', boxAt(x0, bottom, FZ, x1, fT, 0.22));
    const L = Math.hypot(mT - fT, zt - zs);
    common.add('mansard', quad([x0, fT - 0.01, zs], [x0, mT, zt], [x1, mT, zt], [x1, fT - 0.01, zs], [x0, 0], [x0, L], [x1, L], [x1, 0]));
    common.add('ribbed', boxAt(x0, mT - 0.06, zt, x1, pT, zt + 0.15));
    common.add('frame', boxAt(x0 - 0.02, pT, zt - 0.04, x1 + 0.02, pT + 0.08, zt + 0.19));
    common.add('roof', boxAt(x0, mT - 0.32, zt + 0.15, x1, mT - 0.28, WZ));
    const endCap = (x, dir) => {
      const outline = [[0.22, bottom], [G, bottom], [G, mT], [zt + 0.15, mT], [zt + 0.15, pT], [zt, pT], [zt, mT], [zs, fT], [0.22, fT]];
      common.add('ribbed', prismX(outline, dir > 0 ? x - 0.12 : x, dir > 0 ? x : x + 0.12));
    };
    if (closeStart) endCap(x0, -1);
    if (closeEnd) endCap(x1, +1);
    // soffit
    if (!gables) {
      common.add('soffit', quad([x0, bottom, 0.22], [x1, bottom, 0.22], [x1, B.soffitBack, G], [x0, B.soffitBack, G], [x0, 0.22], [x1, 0.22], [x1, G], [x0, G]));
    } else {
      const lo = bottom + 0.05, hi = c.soffitPeak;
      const ps = [x0, ...B.posts.filter((p) => p > x0 + 0.2 && p < x1 - 0.2), x1];
      for (let k = 0; k < ps.length - 1; k++) {
        const pa = ps[k], pb = ps[k + 1], mx = (pa + pb) / 2;
        if (pb - pa < 1.0) { common.add('soffit', hplane(pa, 0.22, pb, G, lo, false)); continue; }
        common.add('soffit', quad([pa, lo, 0.22], [mx, hi, 0.22], [mx, hi, G], [pa, lo, G], [pa, 0.22], [mx, 0.22], [mx, G], [pa, G]));
        common.add('soffit', quad([mx, hi, 0.22], [pb, lo, 0.22], [pb, lo, G], [mx, hi, G], [mx, 0.22], [pb, 0.22], [pb, G], [mx, G]));
      }
      // close the gables against the back of the sign band
      const back = new THREE.BufferGeometry();
      const pos = [];
      for (let k = 0; k < ps.length - 1; k++) {
        const pa = ps[k], pb = ps[k + 1], mx = (pa + pb) / 2;
        pos.push(pa, lo, 0.221, pb, lo, 0.221, mx, hi, 0.221);
      }
      back.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      back.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
      back.computeVertexNormals();
      common.add('frame', back);
    }
  };
  canopy(A, { closeStart: true, closeEnd: true, gables: true });
  canopy(I, { closeStart: false, closeEnd: true, gables: false });
  // expansion joint between the anchor and inline sign bands
  common.add('concrete', boxAt(A.x1 - 0.15, A.bottom, FZ - 0.03, A.x1 + 0.15, A.fasciaTop, FZ + 0.01));

  // sign-band panels (inset); the existing Domino's panel is olive
  const panelPlane = (batch, xa, xb, c, key = 'panel') => {
    const h = c.fasciaTop - c.bottom;
    batch.add(key, signPlane(xb - xa - 0.26, h - 0.26, (xa + xb) / 2, c.bottom + h / 2, FZ - 0.006, 'nz'));
  };
  const runPanels = (batch, joints, c, merge = []) => {
    for (let k = 0; k < joints.length - 1; k++) {
      const xa = joints[k], xb = joints[k + 1];
      if (merge.some(([m0, m1]) => xa >= m0 - 0.01 && xb <= m1 + 0.01)) continue;
      panelPlane(batch, xa, xb, c, batch === bb && Math.abs(xa - 68.58) < 0.05 ? 'olive' : 'panel');
    }
    for (const [m0, m1] of merge) panelPlane(batch, m0, m1, c);
  };
  runPanels(bb, B.joints.anchor, A);
  runPanels(bb, B.joints.inline, I);
  // proposed: panels behind tenant signs use 'panel'; the blank ones cycle through panelB-E (only Color Block
  // gives those their own colors)
  const signXs = [26.28, 59.32, 71.9, 84.81, 106.1];
  const blankKeys = ['panelB', 'panelC', 'panelD', 'panelE'];
  let blank = 0;
  const runAfter = (joints, c, merge) => {
    const list = merge.map((m) => m.slice());
    for (let k = 0; k < joints.length - 1; k++) {
      const xa = joints[k], xb = joints[k + 1];
      if (!merge.some(([m0, m1]) => xa >= m0 - 0.01 && xb <= m1 + 0.01)) list.push([xa, xb]);
    }
    list.sort((p, q) => p[0] - q[0]);
    for (const [xa, xb] of list) {
      const hasSign = signXs.some((sx) => sx > xa && sx < xb);
      panelPlane(ab, xa, xb, c, hasSign ? 'panel' : blankKeys[blank++ % blankKeys.length]);
    }
  };
  runAfter(B.joints.anchor, A, [[19.76, 32.81]]);
  runAfter(B.joints.inline, I, [[93.44, 118.8]]);
  // frame ribs at the joints
  for (const x of [...B.joints.anchor.slice(1, -1), ...B.joints.inline.slice(1, -1)]) {
    const c = x < A.x1 ? A : I;
    common.add('frame', boxAt(x - 0.07, c.bottom, FZ - 0.012, x + 0.07, c.fasciaTop, FZ));
  }

  // ---------------- posts ----------------
  for (const x of B.posts) {
    const s = B.post, z0 = B.postZ - s / 2, z1 = B.postZ + s / 2;
    const top = inAnchor(x) ? A.bottom + 0.1 : I.bottom + 0.05;
    common.add('pier', boxAt(x - s / 2, WALK, z0, x + s / 2, top, z1));
    for (const hb of B.postBands) common.add('pierBand', boxAt(x - s / 2 - 0.012, hb, z0 - 0.012, x + s / 2 + 0.012, hb + 0.07, z1 + 0.012));
    common.add('pier', boxAt(x - s / 2 - 0.02, WALK, z0 - 0.02, x + s / 2 + 0.02, WALK + 0.1, z1 + 0.02));
    colliders.push({ x0: x - s / 2, x1: x + s / 2, z0, z1 });
  }

  // soffit lights, one per bay, with light pools on the walk at dusk
  const light = new THREE.CylinderGeometry(0.17, 0.17, 0.06, 20);
  const walkPools = new FlatBuilder(0.17);
  const lightXs = [];
  for (let k = 0; k < B.posts.length - 1; k++) {
    const a = B.posts[k], b2 = B.posts[k + 1];
    if (b2 - a < 3.5) continue;
    lightXs.push((a + b2) / 2);
  }
  for (const x of lightXs) {
    const y = inAnchor(x) ? A.soffitPeak - 0.03 : I.bottom + ((1.6 - 0.22) / (G - 0.22)) * (B.soffitBack - I.bottom) - 0.03;
    const g = light.clone(); g.translate(x, y, 1.6); common.add('soffitLight', g);
    walkPools.rect(x - 3.2, 0.05, x + 3.2, G - 0.04, WALK + 0.015);
  }

  // ---------------- storefronts ----------------
  const mull = (x0, y0, x1, y1) => common.add('mullion', boxAt(x0, y0, G - 0.03, x1, y1, G + 0.07));
  const glassPane = (x0, y0, x1, y1, list = glassGeos) => list.push(signPlane(x1 - x0, y1 - y0, (x0 + x1) / 2, (y0 + y1) / 2, G + 0.02, 'nz'));
  const header = (x0, x1, y0) => common.add(inAnchor(x0) ? 'wall' : 'mullion', boxAt(x0, y0, G, x1, topAt(x0), WZ));
  const panes = (x0, x1, y0, y1, n) => {
    glassPane(x0, y0, x1, y1);
    for (let k = 1; k < n; k++) { const x = x0 + ((x1 - x0) * k) / n; mull(x - 0.035, y0, x + 0.035, y1); }
    mull(x0 - 0.04, y0 - 0.06, x0 + 0.04, y1 + 0.06); mull(x1 - 0.04, y0 - 0.06, x1 + 0.04, y1 + 0.06);
    mull(x0, y0 - 0.06, x1, y0); mull(x0, y1, x1, y1 + 0.07);
  };
  const doorLeaf = (x0, x1, y0, y1, hingeLeft) => {
    mull(x0, y0, x0 + 0.08, y1); mull(x1 - 0.08, y0, x1, y1); mull(x0, y0, x1, y0 + 0.24); mull(x0, y1 - 0.09, x1, y1);
    glassPane(x0 + 0.08, y0 + 0.24, x1 - 0.08, y1 - 0.09);
    const hx = hingeLeft ? x1 - 0.17 : x0 + 0.17;
    common.add('galv', boxAt(hx - 0.02, 0.95, G - 0.1, hx + 0.02, 1.55, G - 0.05));
  };
  const labels = [];
  for (const e of FACADE) {
    const { x0, x1 } = e, top = topAt(x0), head = headAt(x0);
    if (e.t === 'brick') common.add('wall', boxAt(x0, WALK, G, x1, top, WZ));
    else if (e.t === 'stone') common.add('stone', boxAt(x0, WALK, G - 0.05, x1, top, WZ));
    else if (e.t === 'column') common.add('pier', boxAt(x0, WALK, G - 0.1, x1, top, WZ));
    else if (e.t === 'mullion') { mull(x0, WALK, x1, head + 0.08); header(x0, x1, head + 0.08); common.add('wall', boxAt(x0, WALK, G + 0.07, x1, head, WZ)); }
    else if (e.t === 'window') {
      const sill = WALK + e.sill;
      common.add(e.knee === 'brick' ? 'wall' : 'stone', boxAt(x0, WALK, e.knee === 'brick' ? G : G - 0.04, x1, sill - 0.06, WZ));
      panes(x0, x1, sill, head, e.panes || 1);
      header(x0, x1, head + 0.07);
      if (e.dark) bb.add('darkGlass', signPlane(x1 - x0 - 0.1, head - sill - 0.05, (x0 + x1) / 2, (sill + head) / 2, G + 0.06, 'nz'));
    } else if (e.t === 'glass') {
      panes(x0, x1, WALK + 0.12, head, 1);
      common.add('mullion', boxAt(x0, WALK, G - 0.03, x1, WALK + 0.06, WZ));
      header(x0, x1, head + 0.07);
    } else if (e.t === 'glassfull') {
      common.add('mullion', boxAt(x0, WALK, G - 0.03, x1, WALK + 0.17, WZ));
      panes(x0, x1, WALK + 0.23, head, e.panes || 4);
      header(x0, x1, head + 0.07);
    } else if (e.t === 'clerestory') {
      const st = WALK + e.stoneTop;
      common.add('stone', boxAt(x0, WALK, G - 0.04, x1, st, WZ));
      panes(x0, x1, st + 0.06, head, e.panes || 2);
      header(x0, x1, head + 0.07);
    } else if (e.t === 'auto') {
      const side = e.side || 0, dx0 = x0 + side, dx1 = x1 - side, dh = WALK + 2.34;
      if (side) {
        for (const [a, b2] of [[x0, dx0], [dx1, x1]]) {
          panes(a, b2, WALK + 0.12, dh, 1);
          if (e.graphics) bb.add('bigLots', signPlane(b2 - a - 0.12, dh - WALK - 0.3, (a + b2) / 2, (WALK + 0.2 + dh) / 2, G - 0.012, 'nz'));
        }
      }
      const w = dx1 - dx0;
      for (let k = 0; k < 2; k++) doorLeaf(dx0 + (k * w) / 2, dx0 + ((k + 1) * w) / 2, WALK, dh, k === 0);
      common.add('mullion', boxAt(dx0 - 0.04, dh, G - 0.16, dx1 + 0.04, dh + 0.16, G + 0.08));    // operator housing
      panes(x0, x1, dh + 0.16, head, Math.max(2, Math.round((x1 - x0) / 1.4)));                   // transom
      header(x0, x1, head + 0.07);
      common.add('concrete', boxAt(x0, WALK, G - 0.4, x1, WALK + 0.01, G));
      if (e.label) labels.push({ text: e.label, x: (x0 + x1) / 2, y: (dh + 0.16 + head) / 2, face: 'nz', z: G - 0.045, w: 0.9, groups: [root] });
    } else if (e.t === 'door') {
      const dh = WALK + 2.36, n = e.leaves || 1, w = (x1 - x0) / n;
      for (let k = 0; k < n; k++) doorLeaf(x0 + k * w, x0 + (k + 1) * w, WALK, dh, n === 2 ? k === 0 : true);
      mull(x0, dh, x1, dh + 0.08);
      panes(x0, x1, dh + 0.08, head, 1);
      header(x0, x1, head + 0.07);
      common.add('concrete', boxAt(x0, WALK, G - 0.4, x1, WALK + 0.01, G));
      if (e.label) labels.push({ text: e.label, x: (x0 + x1) / 2, y: (dh + 0.08 + head) / 2, face: 'nz', z: G - 0.045, w: 0.7, groups: [root] });
    }
  }

  // ---------------- shared entry recess ----------------
  const RX0 = RECESS.x0, RX1 = RECESS.x1, ZB = G + RECESS.depth, rTop = B.soffitBack;
  {
    common.add('concrete', boxAt(RX0, 0, G - 0.01, RX1, WALK, ZB));
    common.add('soffit', hplane(RX0, G, RX1, ZB, rTop, false));
    const lg = light.clone(); lg.translate((RX0 + RX1) / 2, rTop - 0.03, G + RECESS.depth / 2); common.add('soffitLight', lg);
    walkPools.rect(RX0 + 0.1, G + 0.1, RX1 - 0.1, ZB - 0.1, WALK + 0.015);
    common.add('mullion', boxAt(RX0, rTop, G - 0.03, RX1, topAt(RX0), WZ));            // header over the opening
    // back wall: Rent-2-Own glass, the 209 door with a sidelight, a stone pilaster, 211's window
    const bz = ZB, bmull = (a, y0, b2, y1) => common.add('mullion', boxAt(a, y0, bz - 0.07, b2, y1, bz + 0.03));
    const bglass = (a, y0, b2, y1) => glassGeos.push(signPlane(b2 - a, y1 - y0, (a + b2) / 2, (y0 + y1) / 2, bz - 0.02, 'nz'));
    const bhead = WALK + 3.1, dhead = WALK + 2.36;
    common.add('mullion', boxAt(RX0, bhead, bz, RX1, rTop + 0.1, bz + 0.3));
    // Rent-2-Own sidelight 88.0-88.6, door 88.6-89.9, sidelight 89.9-90.6
    bmull(RX0, WALK, RX0 + 0.06, bhead); bglass(RX0 + 0.06, WALK + 0.2, 88.6, bhead); bmull(88.6, WALK, 88.68, bhead);
    bmull(88.68, WALK, 89.82, WALK + 0.24); bmull(88.68, dhead - 0.09, 89.82, dhead); bmull(89.82, WALK, 89.9, bhead);
    bglass(88.76, WALK + 0.24, 89.74, dhead - 0.09); bmull(88.68, WALK, 88.76, dhead); bmull(89.74, WALK, 89.82, dhead);
    bglass(88.68, dhead, 89.82, bhead);
    common.add('galv', boxAt(89.55, 0.95, bz - 0.13, 89.59, 1.55, bz - 0.08));
    bglass(89.9, WALK + 0.2, 90.55, bhead); bmull(90.55, WALK, 90.6, bhead);
    common.add('mullion', boxAt(RX0, WALK, bz - 0.07, 90.6, WALK + 0.2, bz + 0.03));
    common.add('stone', boxAt(90.6, WALK, bz - 0.05, 91.05, bhead + 0.1, bz + 0.3));
    // 211 window on a stone base
    common.add('stone', boxAt(91.05, WALK, bz - 0.04, RX1, WALK + 0.9, bz + 0.3));
    bglass(91.1, WALK + 0.95, RX1 - 0.05, bhead); bmull(91.05, WALK + 0.9, RX1, WALK + 0.96); bmull(91.05, WALK + 0.9, 91.11, bhead); bmull(RX1 - 0.06, WALK + 0.9, RX1, bhead);
    labels.push({ text: '209', sub: 'LANCASTER PIKE', x: 89.25, y: (dhead + bhead) / 2, face: 'nz', z: bz - 0.06, w: 0.95, groups: [root] });
    // SW side wall: Rent-2-Own glass looking into the showroom
    const sx = RX0, smull = (z0, y0, z1, y1) => common.add('mullion', boxAt(sx, y0, z0, sx + 0.1, y1, z1));
    common.add('mullion', boxAt(sx - 0.02, WALK, G, sx + 0.1, WALK + 0.2, ZB));
    for (const [z0, z1] of [[G + 0.05, G + 2.0], [G + 2.0, ZB - 0.05]]) {
      glassGeos.push(signPlane(z1 - z0 - 0.08, bhead - WALK - 0.25, sx + 0.05, (WALK + 0.2 + bhead) / 2, (z0 + z1) / 2, 'px'));
      smull(z0 - 0.04, WALK, z0 + 0.04, bhead); smull(z1 - 0.04, WALK, z1 + 0.04, bhead);
    }
    common.add('mullion', boxAt(sx - 0.02, bhead, G, sx + 0.1, rTop + 0.1, ZB));
    // NE side wall: stone with 211's glazed entrance
    const nx = RX1, d0 = G + 0.9, d1 = G + 1.95, s1 = G + 2.75;
    common.add('stone', boxAt(nx, WALK, G, nx + 0.3, rTop + 0.1, d0));
    common.add('stone', boxAt(nx, WALK, s1, nx + 0.3, rTop + 0.1, ZB));
    common.add('mullion', boxAt(nx, bhead, d0, nx + 0.3, rTop + 0.1, s1));
    const nmull = (z0, y0, z1, y1) => common.add('mullion', boxAt(nx - 0.07, y0, z0, nx + 0.04, y1, z1));
    nmull(d0, WALK, d0 + 0.08, bhead); nmull(d1 - 0.04, WALK, d1 + 0.04, bhead); nmull(s1 - 0.08, WALK, s1, bhead);
    nmull(d0, WALK, d1, WALK + 0.24); nmull(d0, dhead - 0.09, s1, dhead); nmull(d1, WALK, s1, WALK + 0.2);
    glassGeos.push(signPlane(d1 - d0 - 0.12, dhead - WALK - 0.33, nx - 0.02, (WALK + 0.24 + dhead - 0.09) / 2, (d0 + d1) / 2, 'nx'));
    glassGeos.push(signPlane(s1 - d1 - 0.12, dhead - WALK - 0.25, nx - 0.02, (WALK + 0.2 + dhead) / 2, (d1 + s1) / 2, 'nx'));
    glassGeos.push(signPlane(s1 - d0 - 0.1, bhead - dhead - 0.05, nx - 0.02, (dhead + bhead) / 2, (d0 + s1) / 2, 'nx'));
    common.add('galv', boxAt(nx - 0.13, 0.95, d0 + 0.14, nx - 0.09, 1.55, d0 + 0.18));
    common.add('concrete', boxAt(nx - 0.25, 0, d0, nx + 0.3, WALK + 0.005, s1));
    labels.push({ text: '211', ace: true, x: nx - 0.06, y: (dhead + bhead) / 2, face: 'nx', z: (d0 + s1) / 2, w: 1.1, before: true });
    // steel pipe column at the mouth of the recess
    const pipe = new THREE.CylinderGeometry(0.055, 0.055, rTop - WALK, 12); pipe.translate(RECESS.pipeX, WALK + (rTop - WALK) / 2, G + 0.05);
    common.add('galv', pipe);
    circles.push({ x: RECESS.pipeX, z: G + 0.05, r: 0.08 });
    // Rent-2-Own tire display beside the recess (existing condition)
    const cx = 86.6, cz = 2.15;
    bb.add('galv', boxAt(cx - 0.75, WALK, cz - 0.3, cx - 0.72, 1.75, cz + 0.3));
    bb.add('galv', boxAt(cx + 0.72, WALK, cz - 0.3, cx + 0.75, 1.75, cz + 0.3));
    bb.add('galv', boxAt(cx - 0.75, 1.72, cz - 0.3, cx + 0.75, 1.75, cz + 0.3));
    // tires stand on their treads side by side on two shelves, as on the real rack
    for (let k = 0; k < 6; k++) { const t = new THREE.CylinderGeometry(0.34, 0.34, 0.21, 18); t.rotateZ(Math.PI / 2); t.translate(cx - 0.56 + k * 0.224, WALK + 0.47, cz); bb.add('tire', t); }
    for (let k = 0; k < 3; k++) { const t = new THREE.CylinderGeometry(0.34, 0.34, 0.21, 18); t.rotateZ(Math.PI / 2); t.translate(cx - 0.36 + k * 0.36, 1.75 + 0.36, cz); bb.add('tire', t); }
    bb.add('galv', boxAt(cx - 0.75, WALK + 0.1, cz - 0.3, cx + 0.75, WALK + 0.13, cz + 0.3));
    for (const [bx, bz2] of [[85.35, 2.0], [88.25, 2.3]]) for (let k = 0; k < 3; k++) {
      const bag = new THREE.CylinderGeometry(0.36, 0.38, 0.38, 16); bag.translate(bx, WALK + 0.19 + k * 0.38, bz2); bb.add('tireBag', bag);
    }
    colliders.push({ x0: cx - 0.78, x1: cx + 0.78, z0: cz - 0.32, z1: cz + 0.32, phase: 'before' });
    circles.push({ x: 85.35, z: 2.0, r: 0.4, phase: 'before' }, { x: 88.25, z: 2.3, r: 0.4, phase: 'before' });
  }
  // the former tanning tenant's sun decal is still on 211's glass (existing condition)
  const tan = new THREE.Mesh(signPlane(0.95, 1.0, 94.4, 2.15, G - 0.01, 'nz'), new THREE.MeshStandardMaterial({ map: S.tanHereDecal(), transparent: true, alphaTest: 0.05, roughness: 0.8 }));
  before.add(tan);

  // ---------------- interiors ----------------
  const rooms = [];
  const room = (id, x0, x1, depth, h, opts = {}) => {
    const z0 = opts.z0 ?? WZ + 0.02, z1 = z0 + depth;
    const art = new THREE.MeshStandardMaterial({ roughness: 0.9, emissive: '#ffffff', emissiveIntensity: 0 });
    const side = new THREE.MeshStandardMaterial({ color: '#d9d6cf', roughness: 0.95, emissive: '#fff8ee', emissiveIntensity: 0 });
    const ceil = new THREE.MeshStandardMaterial({ roughness: 0.9, emissive: '#ffffff', emissiveIntensity: 0 });
    const floor = new THREE.MeshStandardMaterial({ color: '#c9c5bd', roughness: 0.35, metalness: 0.05 });
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(signPlane(x1 - x0, h, (x0 + x1) / 2, WALK + h / 2, z1, 'nz'), art));
    if (!opts.openX0) grp.add(new THREE.Mesh(signPlane(depth, h, x0, WALK + h / 2, (z0 + z1) / 2, 'px'), side));
    if (!opts.openX1) grp.add(new THREE.Mesh(signPlane(depth, h, x1, WALK + h / 2, (z0 + z1) / 2, 'nx'), side));
    grp.add(new THREE.Mesh(hplane(x0, z0, x1, z1, WALK + 0.01, true), floor));
    const cg = hplane(x0, z0, x1, z1, WALK + h, false);
    const uv = cg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 4);
    ceil.map = S.ceilingArt(true); ceil.map.wrapS = ceil.map.wrapT = THREE.RepeatWrapping; ceil.emissiveMap = ceil.map;
    grp.add(new THREE.Mesh(cg, ceil));
    grp.traverse((o) => { if (o.isMesh) { o.receiveShadow = false; o.castShadow = false; } });
    root.add(grp);
    rooms.push({ id, art, side, ceil });
  };
  room('bens', 13.3, 39.2, 13, 3.0);
  room('pumas', 53.95, 64.75, 8, 3.1);
  room('pumas205', 64.85, 68.65, 8, 3.1);
  room('dominos', 69.6, 74.97, 7, 3.1);
  room('rent2own', 75.92, RX0, 9, 3.1, { openX1: true });
  room('rent2ownBack', RX0, 90.58, 4, 3.0, { z0: ZB + 0.32, openX0: true });
  room('ace211back', 91.08, RX1, 4, 3.0, { z0: ZB + 0.32 });
  room('ace211', RX1, 103.6, 10, 3.1, { openX0: true });
  room('ace213', 103.72, 118.7, 10, 3.1);
  const art = {
    bens: S.interiorArt('bens', 2), ace: S.interiorArt('ace', 3), dominos: S.interiorArt('dominos', 4), rent2own: S.interiorArt('rent2own', 5),
    pumas: S.interiorArt('pumas', 6), vanilla: S.interiorArt('vanilla', 7), dark: S.interiorArt('vacant', 8),
  };
  const roomArt = {
    before: { bens: 'vanilla', pumas: 'pumas', pumas205: 'pumas', dominos: 'dominos', rent2own: 'rent2own', rent2ownBack: 'rent2own', ace211back: 'dark', ace211: 'dark', ace213: 'dark' },
    after: { bens: 'bens', pumas: 'pumas', pumas205: 'pumas', dominos: 'dominos', rent2own: 'rent2own', rent2ownBack: 'rent2own', ace211back: 'ace', ace211: 'ace', ace213: 'ace' },
  };

  // ---------------- rooftop billboard ----------------
  const bd = B.billboard, aroof = B.masses[0].roof;
  for (const px of bd.posts) common.add('frame', boxAt(px - 0.18, aroof, bd.z - 0.18, px + 0.18, bd.bottom + 0.2, bd.z + 0.18));
  common.add('frame', boxAt(bd.cx - bd.w / 2 - 0.16, bd.bottom - 0.16, bd.z - bd.depth / 2, bd.cx + bd.w / 2 + 0.16, bd.bottom + bd.h + 0.16, bd.z + bd.depth / 2));
  common.add('ribbed', signPlane(bd.w, bd.h, bd.cx, bd.bottom + bd.h / 2, bd.z + bd.depth / 2 + 0.01, 'pz'));
  const bbFaceBefore = S.billboardBefore(), bbFaceAfter = S.billboardAfter(banner);
  const billboardMat = new THREE.MeshStandardMaterial({ map: bbFaceAfter, emissive: '#ffffff', emissiveMap: bbFaceAfter, emissiveIntensity: 0, roughness: 0.6 });
  const bbMesh = new THREE.Mesh(signPlane(bd.w, bd.h, bd.cx, bd.bottom + bd.h / 2, bd.z - bd.depth / 2 - 0.012, 'nz'), billboardMat);
  bbMesh.castShadow = false; bbMesh.receiveShadow = true;
  root.add(bbMesh);

  // ---------------- rooftop units ----------------
  const rtu = (x, z, y) => { common.add('rtu', boxAt(x - 1.1, y, z - 0.75, x + 1.1, y + 1.25, z + 0.75)); common.add('rtu', boxAt(x - 0.5, y + 1.25, z - 0.5, x + 0.5, y + 1.35, z + 0.5)); };
  for (const x of [7, 19, 31, 43]) for (const z of [18, 31, 44, 57, 70]) if (r() > 0.32) rtu(x + (r() - 0.5) * 3, z + (r() - 0.5) * 3, aroof);
  for (const [x, z] of [[58, 12], [66, 17], [80, 14], [84, 30], [97, 12], [106, 24], [116, 32], [119, 14]]) {
    const m = B.masses.find((mm) => x >= mm.x0 && x <= mm.x1);
    rtu(x, z, m.roof);
  }

  // ---------------- signs ----------------
  const signMats = ctx.signMats;
  const sign = (group, tex, w, h, x, y, z, facing = 'nz') => {
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.04, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0, roughness: 0.55 });
    const mesh = new THREE.Mesh(signPlane(w, h, x, y, z, facing), mat);
    mesh.castShadow = false; mesh.receiveShadow = false;
    group.add(mesh); signMats.push(mat);
    return mesh;
  };
  // signs stand 5 cm proud of the band (like channel letters); a sign cabinet sits between sign and panel
  const inlineY = (I.bottom + I.fasciaTop) / 2, anchorY = (A.bottom + A.fasciaTop) / 2, zS = FZ - 0.05;
  const cabinet = (x, y, w, h) => ab.add('backer', signPlane(w, h, x, y, FZ - 0.028, 'nz'));
  cabinet(26.28, anchorY, 10.3, 1.84);   // Ben's Appliances
  cabinet(59.32, inlineY, 4.4, 1.08);    // Pumas Rest
  cabinet(71.9, inlineY, 5.7, 1.26);     // Domino's
  cabinet(106.1, inlineY, 10.0, 1.28);   // ACE Hardware (Rent-2-Own's sign is its own red cabinet)
  const tx = {
    ace: S.fasciaSign('ace'), dominos: S.fasciaSign('dominos'), rent2own: S.fasciaSign('rent2own'), pumas: S.fasciaSign('pumas'), forlease: S.fasciaSign('forlease'),
  };
  const bannerTex = new THREE.Texture(banner); bannerTex.colorSpace = THREE.SRGBColorSpace; bannerTex.anisotropy = ctx.aniso; bannerTex.needsUpdate = true;
  const bannerAspect = banner.width / banner.height;
  // tenant signs that stay (positions measured on the 10/6 photo mosaic)
  for (const g of [before, after]) {
    sign(g, tx.pumas, 4.0, 4.0 / 4.57, 59.32, inlineY, zS);
    sign(g, tx.dominos, 5.4, 5.4 / 4.57, 71.9, inlineY, zS);
    sign(g, tx.rent2own, 5.3, 5.3 / 4.57, 84.81, inlineY + 0.02, zS);
  }
  // existing
  sign(before, tx.forlease, 7.24, I.fasciaTop - I.bottom, 96.67, inlineY, zS);
  // proposed: Ben's Appliances on the anchor band, ACE across 211 + 213 and on the stone end block
  sign(after, bannerTex, 9.8, 9.8 / bannerAspect, 26.28, anchorY, zS);
  sign(after, tx.ace, 9.6, 1.2, 106.1, inlineY, zS);
  sign(after, tx.ace, 4.8, 0.6, 121.65, 4.45, G - 0.02);

  // transom lettering
  for (const l of labels) {
    const runs = l.ace ? null : [[l.text, '#ffffff']];
    const mk = (group, txt) => {
      const m = new THREE.Mesh(signPlane(l.w, 0.24, l.x, l.y, l.z, l.face), new THREE.MeshStandardMaterial({ map: S.transomText(txt), transparent: true, alphaTest: 0.1, roughness: 0.6 }));
      group.add(m);
    };
    if (l.ace) { mk(before, [['211', '#ffffff']]); mk(after, [['ACE', '#e0313f'], [' HARDWARE', '#ffffff']]); }
    else if (l.sub) for (const g of l.groups) mk(g, [[l.text + ' ', '#ffffff'], [l.sub, '#e8e3d8']]);
    else for (const g of l.groups) mk(g, runs);
  }

  // ---------------- merge ----------------
  if (!M.olive) M.olive = new THREE.MeshStandardMaterial({ color: '#a29a70', roughness: 0.8 });
  if (!M.bigLots) { const t = S.bigLotsGraphic(); M.bigLots = new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }); }
  if (!M.tireBag) M.tireBag = new THREE.MeshStandardMaterial({ color: '#b3202b', roughness: 0.55 });
  common.build(M, root, SHADOW);
  bb.build(M, before, SHADOW);
  ab.build(M, after, SHADOW);
  const glassMesh = new THREE.Mesh(mergeAll(glassGeos), M.glass);
  glassMesh.renderOrder = 2; glassMesh.name = 'glass';
  root.add(glassMesh);
  const walkPoolMat = new THREE.MeshBasicMaterial({ map: ctx.tx.pool, color: '#ffd9a8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const walkPoolMesh = new THREE.Mesh(walkPools.geometry(), walkPoolMat);
  walkPoolMesh.renderOrder = 3; walkPoolMesh.visible = false;
  root.add(walkPoolMesh);

  const walkZones = [
    { x0: 0, x1: B.length, z0: 0, z1: G, y: WALK },
    { x0: RX0, x1: RX1, z0: G - 0.02, z1: ZB, y: WALK },
  ];

  return {
    root, before, after, colliders, circles, walkZones,
    setPhase(phase, light) {
      billboardMat.map = phase === 'before' ? bbFaceBefore : bbFaceAfter;
      billboardMat.emissiveMap = billboardMat.map;
      billboardMat.needsUpdate = true;
      const set = roomArt[phase];
      for (const rm of rooms) {
        const key = set[rm.id], t = art[key];
        rm.art.map = t; rm.art.emissiveMap = t; rm.art.needsUpdate = true;
        const dark = key === 'dark';
        const k = light === 'dusk' ? 1.35 : light === 'golden' ? 0.75 : 0.55;
        rm.art.emissiveIntensity = dark ? 0.02 : k;
        rm.side.emissiveIntensity = dark ? 0.0 : k * 0.55;
        rm.side.color.set(dark ? '#5d5953' : '#dcd9d2');
        rm.ceil.emissiveIntensity = dark ? 0 : k * 0.8;
        rm.ceil.color.set(dark ? '#3a3835' : '#ffffff');
      }
      const lit = light === 'dusk' ? 1.6 : light === 'golden' ? 0.35 : 0;
      billboardMat.emissiveIntensity = phase === 'before' ? lit * 0.25 : lit * 0.9;
      walkPoolMesh.visible = light === 'dusk';
      walkPoolMat.opacity = phase === 'before' ? 0.35 : 0.7;
      M.glass.opacity = light === 'dusk' ? 0.34 : 0.5;
    },
  };
}

function mergeAll(geos) {
  const pos = [], uv = [], nor = [];
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array); uv.push(...g.attributes.uv.array); nor.push(...g.attributes.normal.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
