import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Deterministic PRNG (mulberry32) so the scene is identical on every load.
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Replace UVs with world-space coordinates (meters) projected along the dominant normal axis,
// oriented so textures read un-mirrored from outside. Keeps tiled textures continuous across boxes.
export function worldUV(g, scale = 1) {
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    let u, v;
    if (ax >= ay && ax >= az) { u = p.getZ(i) * -Math.sign(nx || 1); v = p.getY(i); }
    else if (ay >= az) { u = p.getX(i); v = -p.getZ(i); }
    else { u = p.getX(i) * Math.sign(nz || 1); v = p.getY(i); }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// Axis-aligned box from min/max corners, with world UVs.
export function boxAt(x0, y0, z0, x1, y1, z1) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return worldUV(g);
}

// Vertical quad (a wall face) between two XZ points, facing the side given by `face` normal sign.
export function quadGeo(a, b, c, d, uvs) {
  // a,b,c,d are [x,y,z] in counter-clockwise order as seen from the visible side
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array([...a, ...b, ...c, ...a, ...c, ...d]);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const uv = uvs || [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1];
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.computeVertexNormals();
  return g;
}

// A plane that displays a texture un-mirrored, centered at (x,y,z), facing direction 'nz'|'pz'|'nx'|'px'|'up'.
export function signPlane(w, h, x, y, z, facing = 'nz') {
  const g = new THREE.PlaneGeometry(w, h);
  const rot = { nz: Math.PI, pz: 0, nx: -Math.PI / 2, px: Math.PI / 2 }[facing];
  if (facing === 'up') g.rotateX(-Math.PI / 2); else g.rotateY(rot);
  g.translate(x, y, z);
  return g;
}

// Collects geometries per material key and merges them into one mesh per key.
export class Batch {
  constructor() { this.buckets = new Map(); }
  add(key, geo) {
    if (!this.buckets.has(key)) this.buckets.set(key, []);
    this.buckets.get(key).push(geo);
    return geo;
  }
  build(materials, parent, shadow = {}) {
    const out = {};
    for (const [key, list] of this.buckets) {
      const geos = list.map((g) => {
        let x = g.index ? g.toNonIndexed() : g;
        for (const name of Object.keys(x.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') x.deleteAttribute(name);
        if (!x.attributes.normal) x.computeVertexNormals();
        if (!x.attributes.uv) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
        x.clearGroups();
        return x;
      });
      const merged = mergeGeometries(geos, false);
      if (!merged) { console.warn('merge failed for', key); continue; }
      const mat = materials[key];
      if (!mat) { console.warn('missing material', key); continue; }
      const mesh = new THREE.Mesh(merged, mat);
      const s = shadow[key] ?? shadow.default ?? { cast: true, receive: true };
      mesh.castShadow = s.cast; mesh.receiveShadow = s.receive;
      mesh.name = key;
      parent.add(mesh);
      out[key] = mesh;
    }
    return out;
  }
}

// Builds flat (horizontal) geometry for ground markings: quads along segments and polygons.
export class FlatBuilder {
  constructor(y = 0.02) { this.y = y; this.pos = []; this.uv = []; }
  // quad from (x1,z1) to (x2,z2) with width w; u runs along the length in meters
  line(x1, z1, x2, z2, w, y = this.y) {
    const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz) || 1;
    const nx = (-dz / L) * (w / 2), nz = (dx / L) * (w / 2);
    const a = [x1 + nx, y, z1 + nz], b = [x2 + nx, y, z2 + nz], c = [x2 - nx, y, z2 - nz], d = [x1 - nx, y, z1 - nz];
    this._tri(a, b, c, [0, 0], [L, 0], [L, 1]);
    this._tri(a, c, d, [0, 0], [L, 1], [0, 1]);
  }
  // axis-aligned rectangle (z0 < z1) with texture coordinates 0..1 (for decals).
  // rot 0 reads upright for someone facing -Z (toward the road), 1 facing +X, 2 facing +Z, 3 facing -X.
  rect(x0, z0, x1, z1, y = this.y, rot = 0) {
    const P = [[x0, z1], [x1, z1], [x1, z0], [x0, z0]];
    const U = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const r = (i) => U[(i + rot) % 4];
    const p = (i) => [P[i][0], y, P[i][1]];
    this._tri(p(0), p(1), p(2), r(0), r(1), r(2));
    this._tri(p(0), p(2), p(3), r(0), r(2), r(3));
  }
  // oriented rectangle (center, half-sizes along the unit direction d and its normal) with 0..1 UVs
  orect(cx, cz, dx, dz, halfL, halfW, y = this.y) {
    const nx = -dz, nz = dx;
    const p = (s, t) => [cx + dx * halfL * s + nx * halfW * t, y, cz + dz * halfL * s + nz * halfW * t];
    const a = p(-1, -1), b = p(1, -1), c = p(1, 1), d = p(-1, 1);
    this._tri(a, b, c, [0, 0], [1, 0], [1, 1]);
    this._tri(a, c, d, [0, 0], [1, 1], [0, 1]);
  }
  _tri(a, b, c, ua, ub, uc) {
    // ensure upward-facing winding
    const ux = b[0] - a[0], uz = b[2] - a[2], vx = c[0] - a[0], vz = c[2] - a[2];
    const cross = ux * vz - uz * vx;
    if (cross > 0) { this.pos.push(...a, ...c, ...b); this.uv.push(...ua, ...uc, ...ub); }
    else { this.pos.push(...a, ...b, ...c); this.uv.push(...ua, ...ub, ...uc); }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.uv), 2));
    const n = new Float32Array(this.pos.length);
    for (let i = 1; i < n.length; i += 3) n[i] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    return g;
  }
  get empty() { return this.pos.length === 0; }
}

// Flat polygon in the XZ plane (points as [x,z]) at height y, with UVs = world meters (x, -z).
// When a bbox is given, 'uvMacro' holds coordinates normalized to it (canvas top row = bbox.z1).
export function flatPolygon(points, y = 0, bbox = null) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  const p = g.attributes.position;
  const uv = new Float32Array(p.count * 2), um = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    uv[i * 2] = x; uv[i * 2 + 1] = -z;
    if (bbox) { um[i * 2] = (x - bbox.x0) / (bbox.x1 - bbox.x0); um[i * 2 + 1] = (z - bbox.z0) / (bbox.z1 - bbox.z0); }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (bbox) g.setAttribute('uvMacro', new THREE.BufferAttribute(um, 2));
  return g;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function canvasTexture(c, { srgb = true, repeat = null, wrap = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  return t;
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
