import * as THREE from 'three';
import { ROAD, LOT } from './config.js';
import { Batch, FlatBuilder, boxAt, flatPolygon, rng } from './util.js';
import { rows, stallZ } from './lot.js';
import { fbm } from './textures.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// hip roof over an axis-aligned rectangle
function hipRoof(x0, z0, x1, z1, y0, rise) {
  const w = x1 - x0, d = z1 - z0, ridgeAlongX = w >= d, inset = Math.min(w, d) / 2;
  const cxm = (x0 + x1) / 2, czm = (z0 + z1) / 2, y1 = y0 + rise;
  const r0 = ridgeAlongX ? [x0 + inset, y1, czm] : [cxm, y1, z0 + inset];
  const r1 = ridgeAlongX ? [x1 - inset, y1, czm] : [cxm, y1, z1 - inset];
  const A = [x0, y0, z0], Bp = [x1, y0, z0], C = [x1, y0, z1], D = [x0, y0, z1];
  const faces = ridgeAlongX
    ? [[A, r0, r1, Bp], [C, r1, r0, D], [D, r0, A], [Bp, r1, C]]
    : [[A, Bp, r0], [Bp, C, r1, r0], [C, D, r1], [D, A, r0, r1]];
  const pos = [], uv = [];
  for (const f of faces) {
    const tris = f.length === 4 ? [[f[0], f[1], f[2]], [f[0], f[2], f[3]]] : [f];
    for (const t of tris) {
      // orient outward/up
      const u = [t[1][0] - t[0][0], t[1][1] - t[0][1], t[1][2] - t[0][2]], v = [t[2][0] - t[0][0], t[2][1] - t[0][1], t[2][2] - t[0][2]];
      const ny = u[2] * v[0] - u[0] * v[2];
      const tt = ny < 0 ? [t[0], t[2], t[1]] : t;
      for (const p of tt) { pos.push(...p); uv.push(p[0] + p[2] * 0.3, p[1] * 1.4 + p[2] * 0.2); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

function gableRoof(x0, z0, x1, z1, y0, rise, overhang = 0.4) {
  const shape = new THREE.Shape();
  const hz = (z1 - z0) / 2 + overhang;
  shape.moveTo(-hz, 0); shape.lineTo(hz, 0); shape.lineTo(0, rise); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0 + overhang * 2, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  g.translate(x0 - overhang, y0, (z0 + z1) / 2);
  return g;
}

// ---------- cars ----------
function carParts(type) {
  const suv = type === 'suv';
  const body = suv
    ? [[-2.4, 0.36], [2.4, 0.36], [2.43, 0.86], [2.1, 1.06], [1.35, 1.13], [-2.36, 1.16], [-2.43, 1.02]]
    : [[-2.35, 0.3], [2.35, 0.3], [2.38, 0.7], [2.02, 0.84], [1.25, 0.94], [-1.95, 0.99], [-2.36, 0.9]];
  const cabin = suv
    ? [[1.35, 1.11], [0.72, 1.62], [-2.18, 1.66], [-2.3, 1.13]]
    : [[1.25, 0.93], [0.55, 1.37], [-0.85, 1.4], [-1.86, 0.98]];
  const ext = (pts, depth, bevel) => {
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1 });
    g.translate(0, 0, -depth / 2);
    return g;
  };
  const paint = ext(body, 1.68, 0.06);
  const roofY0 = suv ? 1.62 : 1.37, roofX = suv ? [-2.18, 0.72] : [-0.85, 0.55];
  const roof = new THREE.BoxGeometry(roofX[1] - roofX[0], 0.06, suv ? 1.66 : 1.58); roof.translate((roofX[0] + roofX[1]) / 2, roofY0 + 0.02, 0);
  const glass = ext(cabin, suv ? 1.7 : 1.62, 0);
  const wheels = [];
  const r = suv ? 0.38 : 0.34;
  for (const x of suv ? [-1.55, 1.5] : [-1.45, 1.42]) for (const z of [-0.82, 0.82]) {
    const w = new THREE.CylinderGeometry(r, r, 0.26, 14); w.rotateX(Math.PI / 2); w.translate(x, r, z); wheels.push(w);
  }
  const tail = [], head = [];
  const bx = suv ? 2.4 : 2.35, ly = suv ? 0.92 : 0.74;
  for (const z of [-0.62, 0.62]) { const t = new THREE.BoxGeometry(0.05, 0.14, 0.34); t.translate(-bx - 0.02, ly, z); tail.push(t); const h = new THREE.BoxGeometry(0.05, 0.12, 0.3); h.translate(bx + 0.03, ly - 0.08, z); head.push(h); }
  const merge = (list) => { const b = new Batch(); list.forEach((g) => b.add('x', g)); const grp = new THREE.Group(); const out = b.build({ x: new THREE.MeshBasicMaterial() }, grp); return out.x.geometry; };
  return { paint: merge([paint, roof]), glass, tire: merge(wheels), tail: merge(tail), head: merge(head) };
}

export function buildSurroundings(ctx) {
  const { M, tx } = ctx;
  const root = new THREE.Group(); root.name = 'surroundings';
  const common = new Batch();
  const colliders = [], circles = [];
  const r = rng(404);

  // ground: subdivided so vertex colors can carry large, non-repeating variation in the lawn
  const gGeo = new THREE.PlaneGeometry(1660, 1800, 150, 160);
  gGeo.rotateX(-Math.PI / 2); gGeo.translate(70, -0.03, 0);
  const gp = gGeo.attributes.position, guv = gGeo.attributes.uv, gcol = new Float32Array(gp.count * 3);
  const gn = fbm(128, 501, [[4, 0.45], [8, 0.3], [16, 0.25]]);
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    guv.setXY(i, x, -z);
    const sx = (((x / 520) % 1) + 1) % 1, sz = (((z / 520) % 1) + 1) % 1;
    const n = Math.min(1, Math.max(0, (gn[((sz * 128) | 0) * 128 + ((sx * 128) | 0)] - 0.5) * 2.6 + 0.5));
    const k = 0.7 + n * 0.46, dry = Math.max(0, n - 0.62) * 1.5;
    gcol[i * 3] = k * (1 + dry * 0.4); gcol[i * 3 + 1] = k * (1 + dry * 0.1); gcol[i * 3 + 2] = k * (1 - dry * 0.25);
  }
  gGeo.setAttribute('color', new THREE.BufferAttribute(gcol, 3));
  M.grass.vertexColors = true;
  const ground = new THREE.Mesh(gGeo, M.grass);
  ground.receiveShadow = true; root.add(ground);

  // ---------- Lancaster Pike ----------
  const road = new THREE.Mesh(flatPolygon([[-760, ROAD.z1], [900, ROAD.z1], [900, ROAD.z0], [-760, ROAD.z0]], 0.0), M.road);
  road.receiveShadow = true; root.add(road);
  const rw = new FlatBuilder(0.01), ry = new FlatBuilder(0.01);
  rw.line(-760, ROAD.z0 - 0.3, 900, ROAD.z0 - 0.3, 0.12); rw.line(-760, ROAD.z1 + 0.3, 900, ROAD.z1 + 0.3, 0.12);
  const cl0 = -76.5, cl1 = -79.9;
  ry.line(-760, cl0 + 0.08, 900, cl0 + 0.08, 0.1); ry.line(-760, cl1 - 0.08, 900, cl1 - 0.08, 0.1);
  for (let x = -760; x < 900; x += 12) { ry.line(x, cl0 - 0.12, x + 3, cl0 - 0.12, 0.1); ry.line(x, cl1 + 0.12, x + 3, cl1 + 0.12, 0.1); }
  const rmw = new THREE.Mesh(rw.geometry(), new THREE.MeshStandardMaterial({ color: '#e9e9e4', roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  const rmy = new THREE.Mesh(ry.geometry(), new THREE.MeshStandardMaterial({ color: '#e0b83a', roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  rmw.receiveShadow = rmy.receiveShadow = true; root.add(rmw, rmy);
  // sidewalk on the far side
  common.add('concrete', boxAt(-760, 0, -88.2, 900, 0.12, -86.4));

  // ---------- utility poles and wires along the frontage ----------
  const poleXs = [];
  for (let x = -106; x < 250; x += 44) poleXs.push(x);
  const wireSegs = [];
  const poleZ = -71.1;
  poleXs.forEach((x, i) => {
    const p = new THREE.CylinderGeometry(0.13, 0.17, 11.6, 10); p.translate(x, 5.8, poleZ); common.add('wood', p);
    common.add('wood', boxAt(x - 0.07, 10.5, poleZ - 1.25, x + 0.07, 10.62, poleZ + 1.25));
    common.add('wood', boxAt(x - 0.06, 8.3, poleZ - 0.5, x + 0.06, 8.4, poleZ + 0.5));
    if (i % 2 === 0) {
      common.add('galv', boxAt(x - 0.05, 8.9, poleZ - 2.6, x + 0.05, 8.98, poleZ));
      const head = boxAt(x - 0.16, 8.75, poleZ - 3.05, x + 0.16, 8.95, poleZ - 2.4); common.add('lampHead', head);
    }
    circles.push({ x, z: poleZ, r: 0.25 });
    if (i < poleXs.length - 1) {
      const x2 = poleXs[i + 1];
      for (const [dz, y, sag] of [[-1.1, 10.64, 0.75], [0, 10.64, 0.7], [1.1, 10.64, 0.75], [0.45, 8.42, 0.55], [-0.45, 8.1, 0.6]]) {
        const N = 10;
        for (let k = 0; k < N; k++) {
          const t0 = k / N, t1 = (k + 1) / N;
          const f = (t) => y - sag * 4 * t * (1 - t);
          wireSegs.push(x + (x2 - x) * t0, f(t0), poleZ + dz, x + (x2 - x) * t1, f(t1), poleZ + dz);
        }
      }
    }
  });
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wireSegs, 3));
  root.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#2a2a2a', transparent: true, opacity: 0.85 })));

  // ---------- gas station (generic context, no branding) ----------
  root.add(Object.assign(new THREE.Mesh(flatPolygon([[134, -69.5], [178, -69.5], [178, -6], [134, -6]], 0.004), M.stationPave), { receiveShadow: true }));
  for (const [a, b] of [[137, 147], [164, 174]]) root.add(Object.assign(new THREE.Mesh(flatPolygon([[a, ROAD.z0], [b, ROAD.z0], [b, -69.5], [a, -69.5]], 0.003), M.stationPave), { receiveShadow: true }));
  common.add('canopyWhite', boxAt(139, 5.1, -60, 163, 6.0, -43));
  common.add('darkMetal', boxAt(138.95, 5.55, -60.05, 163.05, 5.68, -42.95));
  const under = new THREE.Mesh(new THREE.PlaneGeometry(24, 17).rotateX(Math.PI / 2).translate(151, 5.09, -51.5), M.canopyUnder); root.add(under);
  for (const x of [142.5, 151, 159.5]) for (const z of [-55.5, -47.5]) { common.add('white', boxAt(x - 0.22, 0, z - 0.22, x + 0.22, 5.1, z + 0.22)); colliders.push({ x0: x - 0.3, x1: x + 0.3, z0: z - 0.3, z1: z + 0.3 }); }
  for (const x of [142.5, 151, 159.5]) {
    common.add('concrete', boxAt(x - 0.6, 0, -54.4, x + 0.6, 0.2, -48.6));
    for (const z of [-52.9, -50.1]) common.add('nbGray', boxAt(x - 0.35, 0.2, z - 0.45, x + 0.35, 2.0, z + 0.45));
    colliders.push({ x0: x - 0.7, x1: x + 0.7, z0: -54.5, z1: -48.5 });
  }
  common.add('nbTan', boxAt(139, 0, -34, 158, 4.2, -19));
  common.add('white', boxAt(138.8, 3.5, -34.2, 158.2, 4.2, -18.8));
  common.add('nbGlass', boxAt(141, 0.4, -34.05, 156, 2.8, -34.0));
  common.add('nbShingle', hipRoof(138.4, -34.6, 158.6, -18.4, 4.2, 2.4));
  colliders.push({ x0: 139, x1: 158, z0: -34, z1: -19 });

  // fairground barns east of the service drive (oriented north-south, positions from the aerial)
  const nsAngle = Math.atan2(0.451, -0.892);
  const segs = [];
  for (const [cx, cz] of [[172.8, 6.3], [143.6, 61.6]]) {
    const b = new THREE.BoxGeometry(14, 5, 58); b.translate(0, 2.5, 0); b.rotateY(nsAngle); b.translate(cx, 0, cz); common.add('nbWhite', b);
    const rf = gableRoof(-29, -7.4, 29, 7.4, 5, 2.2, 0.3); rf.rotateY(nsAngle + Math.PI / 2); rf.translate(cx, 0, cz); common.add('nbRoofFlat', rf);
    segs.push({ x0: cx + 22 * 0.451, z0: cz - 22 * 0.892, x1: cx - 22 * 0.451, z1: cz + 22 * 0.892, r: 7.3 });
  }
  // service drive from the pike around the east side to the back of the center
  const sd = new FlatBuilder(0.003);
  const sdp = [[187.2, -72.5], [185, -58.4], [177.3, -43.2], [156.5, -6.6], [137.5, 26]];
  for (let i = 0; i < sdp.length - 1; i++) sd.line(sdp[i][0], sdp[i][1], sdp[i + 1][0], sdp[i + 1][1], 6);
  root.add(Object.assign(new THREE.Mesh(sd.geometry(), M.asphalt), { receiveShadow: true }));

  // ---------- buildings across Lancaster Pike (generic massing) ----------
  const nb = [
    { x: 36, z: -108, w: 20, d: 14, h: 4.6, wall: 'nbBrick', roof: 'flat' },
    { x: 77, z: -115, w: 18, d: 13, h: 4.2, wall: 'nbWhite', roof: 'flat' },
    { x: 122, z: -121, w: 26, d: 19, h: 3.8, wall: 'nbYellow', roof: 'hipGreen' },
    { x: 160, z: -106, w: 16, d: 12, h: 4.2, wall: 'nbTan', roof: 'flat' },
    { x: -8, z: -108, w: 22, d: 15, h: 4.0, wall: 'nbGray', roof: 'gable' },
    { x: -58, z: -99, w: 12, d: 9, h: 3.6, wall: 'nbWhite', roof: 'flat' },
    { x: 205, z: -112, w: 24, d: 16, h: 5.0, wall: 'nbTan', roof: 'flat' },
  ];
  for (const b of nb) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
    common.add(b.wall, boxAt(x0, 0, z0, x1, b.h, z1));
    common.add('nbGlass', boxAt(x0 + 1.5, 0.3, z1, x1 - 1.5, 2.6, z1 + 0.04));
    if (b.roof === 'flat') { common.add('nbRoofFlat', boxAt(x0 + 0.2, b.h, z0 + 0.2, x1 - 0.2, b.h + 0.05, z1 - 0.2)); common.add('white', boxAt(x0 - 0.05, b.h - 0.6, z0 - 0.05, x1 + 0.05, b.h + 0.4, z1 + 0.05)); }
    if (b.roof === 'hipGreen') common.add('nbGreenRoof', hipRoof(x0 - 0.6, z0 - 0.6, x1 + 0.6, z1 + 0.6, b.h, 2.8));
    if (b.roof === 'gable') common.add('nbShingle', gableRoof(x0, z0, x1, z1, b.h, 3.0));
    colliders.push({ x0, x1, z0, z1 });
    // its parking apron to the road
    root.add(Object.assign(new THREE.Mesh(flatPolygon([[x0 - 6, -88.2], [x1 + 6, -88.2], [x1 + 6, z1], [x0 - 6, z1]], 0.002), M.road), { receiveShadow: true }));
  }
  // houses further back
  for (let i = 0; i < 16; i++) {
    const x = -130 + i * 26 + (r() - 0.5) * 8, z = -150 - r() * 22, w = 9 + r() * 4, d = 8 + r() * 3;
    common.add(r() < 0.5 ? 'nbWhite' : 'nbTan', boxAt(x - w / 2, 0, z - d / 2, x + w / 2, 3.0, z + d / 2));
    common.add('nbShingle', gableRoof(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 3.0, 2.4));
    colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  }
  // grocery store to the southwest, mostly behind the trees
  common.add('nbGray', boxAt(-134, 0, 8, -54, 8, 92));
  common.add('nbRoofFlat', boxAt(-133.8, 8, 8.2, -54.2, 8.05, 91.8));

  // ---------- trees ----------
  const trees = [];
  const edgeX = (z) => -8 + z * 0.4029; // SW lot edge
  const noTree = [
    { x0: 132, x1: 180, z0: -72, z1: -4 },      // gas station
    { x0: 123, x1: 140, z0: -2, z1: 89 },       // east drive
    { x0: 49, x1: 140, z0: 21, z1: 89 },        // rear yard
    { x0: -6, x1: 52, z0: 77, z1: 89 },         // behind the anchor
  ];
  const segDist = (x, z, s) => {
    const dx = s.x1 - s.x0, dz = s.z1 - s.z0, t = Math.max(0, Math.min(1, ((x - s.x0) * dx + (z - s.z0) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - s.x0 - dx * t, z - s.z0 - dz * t);
  };
  const tryTree = (x, z, s = 1) => {
    if (z < -86 && z > -89) return; // far sidewalk
    if (z > ROAD.z1 - 1 && z < -69) return;
    for (const c of colliders) if (x > c.x0 - 3 && x < c.x1 + 3 && z > c.z0 - 3 && z < c.z1 + 3) return;
    for (const c of noTree) if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) return;
    for (const g of segs) if (segDist(x, z, g) < g.r + 3) return;
    for (let i = 0; i < sdp.length - 1; i++) if (segDist(x, z, { x0: sdp[i][0], z0: sdp[i][1], x1: sdp[i + 1][0], z1: sdp[i + 1][1] }) < 6) return;
    trees.push([x, z, s]);
  };
  for (let i = 0; i < 95; i++) { const z = -66 + r() * 168, x = -80 + r() * 72; if (z < 0 && x > edgeX(z) - 2.5) continue; if (z >= 0 && x > -4.5) continue; if (x < -52 && z > 4 && z < 96) continue; tryTree(x, z, 0.9 + r() * 0.5); }
  for (let i = 0; i < 60; i++) tryTree(-10 + r() * 150, 90 + r() * 45, 0.9 + r() * 0.5);
  for (let i = 0; i < 48; i++) tryTree(141 + r() * 80, -4 + r() * 130, 0.8 + r() * 0.5);
  for (let i = 0; i < 36; i++) tryTree(-150 + r() * 400, -95 - r() * 80, 0.7 + r() * 0.5);
  // canopy geometry variants: lumpy blobs
  const blob = (seed) => {
    // weld the icosphere's vertices so normals are smooth, then push out lumps for a leafy silhouette
    let g = new THREE.IcosahedronGeometry(1, 4);
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    g = mergeVertices(g);
    const p = g.attributes.position, rr = rng(seed);
    const bumps = Array.from({ length: 9 }, () => { const v = new THREE.Vector3(rr() - 0.5, rr() * 0.9 - 0.25, rr() - 0.5).normalize(); return [v, 0.12 + rr() * 0.22]; });
    const v = new THREE.Vector3(), cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      let k = 1;
      for (const [b, a] of bumps) k += a * Math.max(0, v.dot(b)) ** 3;
      const ripple = Math.sin(v.x * 17 + seed) * Math.sin(v.y * 15) * Math.sin(v.z * 19 + seed * 2) * 0.05;
      k += ripple;
      p.setXYZ(i, v.x * k, v.y * k * 0.82, v.z * k);
      const shade = 0.72 + (ripple + 0.05) * 3 + rr() * 0.14 + Math.max(0, v.y) * 0.18;
      cols[i * 3] = cols[i * 3 + 1] = cols[i * 3 + 2] = shade;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    return g;
  };
  const canopyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  const variants = [blob(1), blob(2)];
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1, 7); trunkGeo.translate(0, 0.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, M.trunk, trees.length);
  const cans = variants.map((g) => new THREE.InstancedMesh(g, canopyMat, trees.length));
  const counts = [0, 0];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color();
  trees.forEach(([x, z, s], i) => {
    const h = (9 + r() * 7) * s, cr = (3.2 + r() * 2.4) * s, trunkH = h * 0.42;
    m4.compose(ps.set(x, 0, z), q.identity(), sc.set(s * 1.2, trunkH + cr * 0.4, s * 1.2)); trunks.setMatrixAt(i, m4);
    const vi = i % 2, k = counts[vi]++;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2);
    m4.compose(ps.set(x, trunkH + cr * 0.75, z), q, sc.set(cr, cr * (0.9 + r() * 0.3), cr)); cans[vi].setMatrixAt(k, m4);
    const autumn = r() < 0.14;
    col.setHSL(autumn ? 0.11 + r() * 0.04 : 0.24 + r() * 0.05, autumn ? 0.55 : 0.38 + r() * 0.14, autumn ? 0.34 : 0.19 + r() * 0.08);
    cans[vi].setColorAt(k, col);
    circles.push({ x, z, r: 0.35 * s });
  });
  cans.forEach((c, vi) => { c.count = counts[vi]; c.instanceColor.needsUpdate = true; c.castShadow = true; c.receiveShadow = true; root.add(c); });
  trunks.castShadow = true; root.add(trunks);

  // ---------- cars ----------
  const R = rows();
  const palette = ['#f2f2f0', '#1c1d20', '#9ea3a8', '#5b6068', '#1f3a66', '#8e1b1b', '#2c63b8', '#3f3f42', '#c9c9c4', '#6b1f2a'];
  const spot = (rowIdx, half, k, flip = false) => {
    const row = R[rowIdx], x = half === 'w' ? (row.xw + row.xm) / 2 : (row.xm + row.xe) / 2;
    const z = (stallZ(k) + stallZ(k + 1)) / 2;
    const heading = (half === 'w') !== flip ? 0 : Math.PI; // nose toward the row centerline
    return { x, z, heading };
  };
  // [row, half, stall, phaseMask(b=before,a=after), type]
  const parked = [
    [3, 'e', 1, 'ba', 'sedan'], [3, 'e', 4, 'ba', 'suv'], [4, 'w', 0, 'ba', 'suv'], [4, 'w', 3, 'ba', 'sedan'], [3, 'w', 6, 'ba', 'sedan'],
    [6, 'e', 0, 'ba', 'suv'], [6, 'e', 1, 'ba', 'suv'], [6, 'e', 2, 'ba', 'sedan'], [6, 'e', 3, 'ba', 'suv'], [6, 'e', 5, 'ba', 'suv'], [6, 'w', 7, 'ba', 'sedan'],
    [4, 'e', 9, 'b', 'sedan'],
    [1, 'e', 3, 'a', 'sedan'], [1, 'e', 4, 'a', 'suv'], [1, 'e', 6, 'a', 'sedan'], [2, 'w', 3, 'a', 'suv'], [2, 'w', 5, 'a', 'sedan'], [2, 'w', 6, 'a', 'sedan'],
    [2, 'e', 4, 'a', 'suv'], [1, 'w', 8, 'a', 'sedan'], [5, 'e', 3, 'a', 'suv'], [5, 'e', 4, 'a', 'sedan'], [5, 'e', 7, 'a', 'suv'], [5, 'w', 2, 'a', 'sedan'],
    [6, 'w', 3, 'a', 'suv'], [6, 'w', 4, 'a', 'sedan'], [3, 'e', 7, 'a', 'sedan'], [4, 'w', 6, 'a', 'suv'], [0, 'e', 5, 'a', 'sedan'], [2, 'e', 10, 'a', 'sedan'],
  ];
  const types = { sedan: carParts('sedan'), suv: carParts('suv') };
  const carSets = {};
  const cars = [];
  for (const [ri, half, k, mask, type] of parked) cars.push({ ...spot(ri, half, k), mask, type, color: palette[Math.floor(r() * palette.length)] });
  // moving traffic on the pike
  const traffic = [];
  for (let i = 0; i < 7; i++) traffic.push({ lane: i % 2, x: -400 + r() * 900, speed: 12 + r() * 5, type: r() < 0.5 ? 'sedan' : 'suv', color: palette[Math.floor(r() * palette.length)] });
  for (const type of ['sedan', 'suv']) {
    const n = cars.filter((c) => c.type === type).length + traffic.filter((c) => c.type === type).length;
    const parts = types[type];
    const set = {
      paint: new THREE.InstancedMesh(parts.paint, M.carPaint, n), glass: new THREE.InstancedMesh(parts.glass, M.carGlass, n),
      tire: new THREE.InstancedMesh(parts.tire, M.tire, n), tail: new THREE.InstancedMesh(parts.tail, M.tailLight, n), head: new THREE.InstancedMesh(parts.head, M.headLight, n),
    };
    for (const m of Object.values(set)) { m.castShadow = true; m.receiveShadow = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(m); }
    set.tail.castShadow = set.head.castShadow = false;
    carSets[type] = { set, list: [] };
  }
  let idx = { sedan: 0, suv: 0 };
  for (const c of cars) { c.i = idx[c.type]++; carSets[c.type].list.push(c); carSets[c.type].set.paint.setColorAt(c.i, col.set(c.color)); }
  for (const c of traffic) { c.i = idx[c.type]++; carSets[c.type].set.paint.setColorAt(c.i, col.set(c.color)); }
  for (const t of ['sedan', 'suv']) carSets[t].set.paint.instanceColor.needsUpdate = true;
  const place = (c, x, z, heading, visible) => {
    const s = visible ? 1 : 0;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);
    m4.compose(ps.set(x, 0, z), q, sc.set(s, s, s));
    for (const m of Object.values(carSets[c.type].set)) m.setMatrixAt(c.i, m4);
  };
  const flush = () => { for (const t of ['sedan', 'suv']) for (const m of Object.values(carSets[t].set)) m.instanceMatrix.needsUpdate = true; };
  const carColliders = cars.map((c) => ({ x0: c.x - 2.4, x1: c.x + 2.4, z0: c.z - 0.95, z1: c.z + 0.95, mask: c.mask }));

  // ---------- clouds ----------
  const cloudMat = new THREE.MeshBasicMaterial({ map: tx.clouds, transparent: true, depthWrite: false, fog: false, opacity: 0.92, toneMapped: false });
  cloudMat.map.repeat.set(2.2, 2.2);
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(Math.PI / 2), cloudMat);
  clouds.position.set(60, 560, 0); clouds.renderOrder = -1; root.add(clouds);

  common.build(M, root);

  return {
    root, colliders, circles, carColliders, segments: segs,
    setPhase(phase, light) {
      for (const c of cars) place(c, c.x, c.z, c.heading, c.mask.includes(phase === 'before' ? 'b' : 'a'));
      flush();
      const dusk = light === 'dusk';
      M.tailLight.emissiveIntensity = dusk ? 2.0 : 0.15;
      M.headLight.emissiveIntensity = dusk ? 2.2 : 0.05;
      M.canopyUnder.emissiveIntensity = dusk ? 1.3 : 0.05;
      cloudMat.color.set(light === 'day' ? '#ffffff' : light === 'golden' ? '#f7c9a6' : '#39405c');
      cloudMat.opacity = light === 'dusk' ? 0.6 : 0.92;
    },
    update(dt) {
      for (const c of traffic) {
        c.x += (c.lane === 0 ? 1 : -1) * c.speed * dt;
        if (c.x > 600) c.x = -520; if (c.x < -520) c.x = 600;
        place(c, c.x, c.lane === 0 ? -74.7 : -81.6, c.lane === 0 ? 0 : Math.PI, true);
      }
      flush();
      cloudMat.map.offset.x += dt * 0.0012;
    },
  };
}
