import * as THREE from 'three';
import { SCHEMES, EXISTING_LOOK, resolveLook } from './config.js';
import * as T from './textures.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
const rep = (t, meters, metersV = meters) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(1 / meters, 1 / metersV); return c; };

export function createMaterials(renderer) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const grain = T.asphaltGrain(), stone = T.stone(), ribs = T.ribs(), seams = T.seams();
  const tx = {
    grain: grain.map, grainBump: grain.bump, concrete: T.concrete(), grass: T.grass(), stone: stone.map, stoneBump: stone.bump,
    ribs: ribs.map, ribsBump: ribs.bump, seams: seams.map, seamsBump: seams.bump, soffit: T.soffitLines(), wood: T.woodSlats(),
    cmu: T.cmu(), membrane: T.membrane(), shingles: T.shingles(), grime: T.grime(), leaves: T.leaves(), wear: T.wear(),
    pool: T.lightPool(), clouds: T.clouds(),
  };
  for (const t of Object.values(tx)) t.anisotropy = aniso;

  const M = {};
  // ---- facade slots (colors set by applyLook) ----
  M.panel = std({ roughness: 0.72, metalness: 0.02 });
  M.frame = std({ roughness: 0.5, metalness: 0.3 });
  M.mansard = std({ map: rep(tx.seams, 0.45, 4), bumpMap: rep(tx.seamsBump, 0.45, 4), bumpScale: 2.2, roughness: 0.42, metalness: 0.45 });
  M.ribbed = std({ map: rep(tx.ribs, 0.3, 4), bumpMap: rep(tx.ribsBump, 0.3, 4), bumpScale: 2.5, roughness: 0.48, metalness: 0.4 });
  M.pier = std({ roughness: 0.88 });
  M.pierBand = std({ roughness: 0.6 });
  M.wall = std({ bumpMap: rep(tx.cmu, 0.8, 0.4), bumpScale: 1.6, roughness: 0.9 });   // painted CMU block
  M.endWall = std({ bumpMap: rep(tx.cmu, 0.8, 0.4), bumpScale: 1.6, roughness: 0.9 });
  for (const k of ['panelB', 'panelC', 'panelD', 'panelE']) M[k] = std({ roughness: 0.72, metalness: 0.02 });
  M.backer = std({ roughness: 0.72, metalness: 0.02 });                               // sign cabinet behind a tenant sign
  M.pylon = std({ roughness: 0.5, metalness: 0.3 });
  M.pylonAccent = std({ roughness: 0.6, metalness: 0.1 });
  M.accent = std({ roughness: 0.6, metalness: 0.1 });
  M.soffit = std({ map: rep(tx.soffit, 0.3, 4), roughness: 0.6 });
  M.soffit.userData.lines = M.soffit.map;
  M.soffit.userData.wood = rep(tx.wood, 1.2, 0.6);
  M.stone = std({ map: rep(tx.stone, 1.6, 1.2), bumpMap: rep(tx.stoneBump, 1.6, 1.2), bumpScale: 3, roughness: 0.95 });
  M.mullion = std({ roughness: 0.38, metalness: 0.65 });
  M.door = std({ roughness: 0.5, metalness: 0.2 });
  M.backWall = std({ map: rep(tx.cmu, 0.8, 0.4), roughness: 0.92 });
  // ---- fixed building materials ----
  M.roof = std({ map: rep(tx.membrane, 8), color: '#d3d4d0', roughness: 0.9 });
  M.glass = std({ color: '#2a3740', roughness: 0.05, metalness: 0.45, transparent: true, opacity: 0.5, envMapIntensity: 1.4, depthWrite: false });
  M.rtu = std({ color: '#b8bbbc', roughness: 0.45, metalness: 0.55 });
  M.darkGlass = std({ color: '#141b21', roughness: 0.06, metalness: 0.7, envMapIntensity: 1.3 });
  M.darkMetal = std({ color: '#2b2b2b', roughness: 0.5, metalness: 0.5 });
  M.soffitLight = std({ color: '#f1efe8', emissive: '#fff2d8', emissiveIntensity: 0, roughness: 0.3 });
  M.dockDoor = std({ map: rep(tx.ribs, 0.3, 4), color: '#9ea3a6', roughness: 0.5, metalness: 0.5 });
  M.paper = std({ color: '#c8b28b', roughness: 1 });
  // ---- site ----
  M.asphalt = std({ map: rep(tx.grain, 3), bumpMap: rep(tx.grainBump, 3), bumpScale: 0.6, roughness: 0.95 });
  M.road = std({ map: rep(tx.grain, 3), bumpMap: rep(tx.grainBump, 3), bumpScale: 0.6, color: '#5d5f61', roughness: 0.93 });
  M.concrete = std({ map: rep(tx.concrete, 1.6), roughness: 0.9 });
  M.stationPave = std({ map: rep(tx.concrete, 4.5), color: '#c9c7c1', roughness: 0.88 });
  M.curbPaint = std({ color: '#e8b923', roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.grass = std({ map: rep(tx.grass, 3.5), roughness: 1 });
  M.mulch = std({ color: '#4a3326', roughness: 1 });
  M.shrub = std({ map: rep(tx.leaves, 1.2), color: '#4f6b34', roughness: 1 });
  M.pole = std({ roughness: 0.55, metalness: 0.5 });
  M.poleBase = std({ map: rep(tx.concrete, 1.6), roughness: 0.85 });
  M.galv = std({ color: '#a9adaf', roughness: 0.45, metalness: 0.7 });
  M.rust = std({ color: '#8c6a50', roughness: 0.85, metalness: 0.3 });
  M.wood = std({ color: '#6c5a45', roughness: 0.95 });
  M.lampHead = std({ color: '#2d2d2d', emissive: '#fff4e0', emissiveIntensity: 0, roughness: 0.5, metalness: 0.4 });
  M.trunk = std({ color: '#5a4636', roughness: 1 });
  M.canopy = std({ map: rep(tx.leaves, 2.5), roughness: 0.95 });
  M.white = std({ color: '#f2f2ef', roughness: 0.6 });
  M.yellowPaint = std({ color: '#e5b92b', roughness: 0.6 });
  M.pool = new THREE.MeshBasicMaterial({ map: tx.pool, color: '#ffe2b8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  // neighbors (context only)
  M.nbBrick = std({ color: '#8d5a47', map: rep(tx.cmu, 0.8, 0.4), roughness: 0.9 });
  M.nbTan = std({ color: '#d6c7a4', map: rep(tx.cmu, 0.8, 0.4), roughness: 0.9 });
  M.nbWhite = std({ color: '#e7e5df', map: rep(tx.cmu, 0.8, 0.4), roughness: 0.9 });
  M.nbGray = std({ color: '#a9aba9', map: rep(tx.cmu, 0.8, 0.4), roughness: 0.9 });
  M.nbYellow = std({ color: '#e9d9a0', roughness: 0.9 });
  M.nbGreenRoof = std({ color: '#3f6a4b', map: rep(tx.seams, 0.45, 4), roughness: 0.5, metalness: 0.3 });
  M.nbShingle = std({ color: '#6e6c6a', map: rep(tx.shingles, 3), roughness: 0.95 });
  M.nbRoofFlat = std({ color: '#9c9d9a', map: rep(tx.membrane, 8), roughness: 0.9 });
  M.nbGlass = std({ color: '#1e2830', roughness: 0.1, metalness: 0.5 });
  M.canopyWhite = std({ color: '#f4f4f1', roughness: 0.5, metalness: 0.1 });
  M.canopyUnder = std({ color: '#e9e9e6', emissive: '#ffffff', emissiveIntensity: 0.05, roughness: 0.6 });
  // cars
  M.carPaint = std({ color: '#ffffff', roughness: 0.28, metalness: 0.55, envMapIntensity: 1.2 });
  M.carGlass = std({ color: '#141a20', roughness: 0.08, metalness: 0.6 });
  M.tire = std({ color: '#1b1b1b', roughness: 0.9 });
  M.tailLight = std({ color: '#7a0d0d', emissive: '#ff2a1a', emissiveIntensity: 0.2 });
  M.headLight = std({ color: '#dddddd', emissive: '#fff6e8', emissiveIntensity: 0.1 });

  const signMats = [];
  return { M, tx, signMats, aniso };
}

// Recolor the facade for the existing condition or a proposed scheme.
export function applyLook(ctx, phase, scheme) {
  const { M, tx } = ctx;
  const dirty = phase === 'before';
  const look = resolveLook(dirty ? EXISTING_LOOK : (SCHEMES[scheme] || Object.values(SCHEMES)[0]).look);
  for (const [slot, color] of Object.entries(look)) if (M[slot] && M[slot].color && typeof color === 'string' && color.startsWith('#')) M[slot].color.set(color);
  // weathering on the existing facade, clean surfaces once renovated
  for (const slot of ['panel', 'pier', 'wall', 'endWall']) {
    const want = dirty ? (M[slot].userData.grime ||= rep(tx.grime, 6)) : null;
    if (M[slot].map !== want) { M[slot].map = want; M[slot].needsUpdate = true; }
  }
  // sign cabinets show (and light up at dusk) only where they differ from the band
  M.backer.userData.lit = !dirty && look.backer.toLowerCase() !== look.panel.toLowerCase();
  M.backer.emissive.set(M.backer.userData.lit ? look.backer : '#000000');
  // cedar-tone soffit where a scheme asks for it
  const soffitMap = !dirty && look.soffitTexture === 'wood' ? M.soffit.userData.wood : M.soffit.userData.lines;
  if (M.soffit.map !== soffitMap) { M.soffit.map = soffitMap; M.soffit.needsUpdate = true; }
  // fake bounce light from the sunlit sidewalk onto the canopy soffit
  M.soffit.emissive.copy(M.soffit.color).multiplyScalar(0.16);
  M.pole.color.set(dirty ? '#6f6b63' : '#2e2e2e');
  M.poleBase.color.set(dirty ? '#d8b43a' : '#e6bd2e');
  M.concrete.color.set(dirty ? '#b3aea4' : '#cfccc5');
  M.curbPaint.color.set(dirty ? '#bfae6e' : '#e8b923');
  M.asphalt.color.set(dirty ? '#8e8b84' : '#303134');
}
