import * as THREE from 'three';
import { PYLON } from './config.js';
import { Batch, boxAt, signPlane, makeCanvas, canvasTexture } from './util.js';
import * as S from './signs.js';

// Gable cap along Z (the sign faces point along the road, +X and -X).
function cap(x, z, halfX, halfZ, y0, rise) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfX, 0); shape.lineTo(halfX, 0); shape.lineTo(0, rise); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: halfZ * 2, bevelEnabled: false });
  g.translate(x, y0, z - halfZ);
  return g;
}

function addressTexture() {
  const c = makeCanvas(512, 128), ctx = c.getContext('2d');
  ctx.fillStyle = '#f1eee6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 92px ${S.F.cond}`;
  ctx.fillText('201 – 213', 256, 68);
  const t = canvasTexture(c, { wrap: false });
  return t;
}

export function buildPylon(ctx, banner) {
  const { M, signMats } = ctx;
  const root = new THREE.Group(); root.name = 'pylon';
  const before = new THREE.Group(), after = new THREE.Group();
  root.add(before, after);
  const x = PYLON.x, z = PYLON.z;
  const bb = new Batch(), ab = new Batch();
  const faceMat = (tex, transparent = false) => {
    const m = new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0, roughness: 0.45, transparent, alphaTest: transparent ? 0.1 : 0 });
    signMats.push(m);
    return m;
  };
  const faces = (group, tex, w, h, y, halfX, transparent) => {
    const mat = faceMat(tex, transparent);
    for (const side of ['px', 'nx']) {
      const m = new THREE.Mesh(signPlane(w, h, x + (side === 'px' ? halfX : -halfX), y, z, side), mat);
      m.castShadow = false; m.receiveShadow = true; group.add(m);
    }
  };

  // Dimensions: the tenant-panel cabinet is 10 ft (3.05 m) tall, per the 10/6 tape measurement; the rest is scaled
  // from photo 20260929_145824 (meter socket and post width): cabinet bottom ~1.0 m above grade, about 19 ft overall.
  const CAB = { y0: 1.0, h: 3.05, w: 2.62 };          // tenant cabinet face (canvas 1024 x 1190)
  const NAME = { w: 3.2, h: 1.25 };                    // name cabinet face (canvas 1024 x 400)
  const POST_Z = CAB.w / 2 + 0.2;

  // ---------- proposed ----------
  const aCab0 = 1.05, aName0 = aCab0 + CAB.h + 0.14, aTop = aName0 + NAME.h + 0.06;
  // the proposed pylon takes the scheme's pylon color (always dark or bold, so the light lettering reads)
  for (const dz of [-POST_Z, POST_Z]) ab.add('pylon', boxAt(x - 0.24, 0, z + dz - 0.24, x + 0.24, aTop, z + dz + 0.24));
  ab.add('stone', boxAt(x - 0.5, 0, z - POST_Z - 0.42, x + 0.5, 0.95, z + POST_Z + 0.42));
  ab.add('pylon', boxAt(x - 0.56, 0.95, z - POST_Z - 0.48, x + 0.56, 1.02, z + POST_Z + 0.48));
  ab.add('pylon', boxAt(x - 0.24, aCab0 - 0.04, z - CAB.w / 2 - 0.06, x + 0.24, aCab0 + CAB.h + 0.04, z + CAB.w / 2 + 0.06));
  ab.add('pylon', boxAt(x - 0.32, aName0 - 0.04, z - NAME.w / 2 - 0.08, x + 0.32, aTop, z + NAME.w / 2 + 0.08));
  ab.add('pylonAccent', boxAt(x - 0.36, aTop, z - NAME.w / 2 - 0.14, x + 0.36, aTop + 0.08, z + NAME.w / 2 + 0.14));
  ab.add('pylon', cap(x, z, 0.44, NAME.w / 2 + 0.22, aTop + 0.08, 0.45));
  faces(after, S.pylonTenants(banner, 'after'), CAB.w, CAB.h, aCab0 + CAB.h / 2, 0.245, true);
  faces(after, S.pylonName('after'), NAME.w, NAME.h, aName0 + NAME.h / 2, 0.325, true);
  faces(after, addressTexture(), 1.6, 0.4, 0.52, 0.505, true);

  // ---------- existing ----------
  const oldPost = new THREE.MeshStandardMaterial({ color: '#b35d51', roughness: 0.75, metalness: 0.1 });
  const oldCab = new THREE.MeshStandardMaterial({ color: '#e6e2d7', roughness: 0.7 });
  const oldName = new THREE.MeshStandardMaterial({ color: '#d8ccad', roughness: 0.75 });
  const oldCap = new THREE.MeshStandardMaterial({ color: '#efece5', roughness: 0.6 });
  const oldBox = new THREE.MeshStandardMaterial({ color: '#c9ccc9', roughness: 0.5, metalness: 0.4 });
  Object.assign(M, { pyOldPost: oldPost, pyOldCab: oldCab, pyOldName: oldName, pyOldCap: oldCap, pyOldBox: oldBox });
  const bName0 = CAB.y0 + CAB.h + 0.1, bTop = bName0 + NAME.h + 0.1;
  for (const dz of [-POST_Z, POST_Z]) bb.add('pyOldPost', boxAt(x - 0.2, 0, z + dz - 0.2, x + 0.2, bTop - 0.05, z + dz + 0.2));
  bb.add('pyOldCab', boxAt(x - 0.2, CAB.y0 - 0.02, z - CAB.w / 2 - 0.02, x + 0.2, CAB.y0 + CAB.h + 0.02, z + CAB.w / 2 + 0.02));
  bb.add('pyOldName', boxAt(x - 0.28, bName0 - 0.05, z - NAME.w / 2 - 0.05, x + 0.28, bTop, z + NAME.w / 2 + 0.05));
  bb.add('pyOldCap', cap(x, z, 0.4, NAME.w / 2 + 0.15, bTop, 0.32));
  bb.add('pyOldBox', boxAt(x + 0.2, 1.15, z + POST_Z - 0.2, x + 0.48, 1.7, z + POST_Z + 0.22));
  faces(before, S.pylonTenants(banner, 'before'), CAB.w, CAB.h, CAB.y0 + CAB.h / 2, 0.205, false);
  faces(before, S.pylonName('before'), NAME.w, NAME.h, bName0 + NAME.h / 2, 0.285, false);

  bb.build(M, before);
  ab.build(M, after);

  const circles = [{ x, z: z - POST_Z, r: 0.35 }, { x, z: z + POST_Z, r: 0.35 }];
  const colliders = [{ x0: x - 1.3, x1: x + 1.3, z0: z - 2.4, z1: z + 2.4, phase: 'after' }];
  return { root, before, after, circles, colliders };
}
