import * as THREE from 'three';
import { VIEWS, DEFAULT_SCHEME } from './config.js';
import { createMaterials, applyLook } from './materials.js';
import { loadSignFonts } from './signs.js';
import { buildBuilding } from './building.js';
import { buildLot } from './lot.js';
import { buildPylon } from './pylon.js';
import { buildSurroundings } from './surroundings.js';
import { createLighting } from './lighting.js';
import { CameraRig } from './controls.js';
import { createUI } from './ui.js';

const tick = () => new Promise((r) => setTimeout(r, 30));
const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

async function main() {
  const state = { phase: 'after', scheme: DEFAULT_SCHEME, light: 'day', mode: 'orbit', touring: false };
  let rig, apply;
  const ui = createUI({
    onPhase: (p) => { state.phase = p; apply(); },
    onMode: (m) => { rig.setMode(m); },
    onLight: (l) => { state.light = l; apply(); },
    onScheme: (s) => { state.scheme = s; state.phase = 'after'; apply(); },
    onView: (key, o = {}) => { if (o.phase && state.phase !== o.phase) { state.phase = o.phase; apply(); } rig.stopTour(); rig.flyTo(key); ui.closeSheetOnPhone(); },
    onTour: () => { if (rig.tour) rig.stopTour(); else rig.startTour(); },
    onMapClick: (x, z) => { rig.stopTour(); rig.jumpTo(x, z); },
  });
  window.__ccReady = true;

  const canvas = document.getElementById('scene');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  } catch (e) {
    ui.fail('This browser could not start WebGL, which the 3D model needs. Try a current version of Chrome, Edge, Safari or Firefox, and check that hardware acceleration is turned on.');
    return;
  }
  const mobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 560;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.25, 7000);
  const resize = () => {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (!camera.userData.fixedFov) camera.fov = w / h < 0.8 ? 64 : 52;
    camera.updateProjectionMatrix();
  };
  resize();
  new ResizeObserver(resize).observe(canvas);

  ui.progress('Loading sign lettering', 0.08);
  await loadSignFonts();
  const banner = await loadImage(window.BENS_BANNER);
  ui.progress('Painting textures', 0.2); await tick();
  const ctx = createMaterials(renderer);
  ui.progress('Building the storefronts', 0.38); await tick();
  const building = buildBuilding(ctx, banner); scene.add(building.root);
  ui.progress('Striping the lot', 0.55); await tick();
  const lot = buildLot(ctx); scene.add(lot.root);
  const pylon = buildPylon(ctx, banner); scene.add(pylon.root);
  ui.progress('Planting trees and parking cars', 0.7); await tick();
  const env = buildSurroundings(ctx); scene.add(env.root);
  ui.progress('Lighting the scene', 0.85); await tick();
  const lights = createLighting(renderer, scene, { mobile });

  const world = {
    phase: state.phase,
    boxes: [...building.colliders, ...lot.colliders, ...pylon.colliders, ...env.colliders, ...env.carColliders],
    circles: [...building.circles, ...lot.circles, ...pylon.circles, ...env.circles],
    segments: [...lot.segments, ...env.segments],
    zones: building.walkZones,
  };
  rig = new CameraRig(camera, canvas, world);
  rig.bindJoystick(ui.joystick.base, ui.joystick.knob);
  rig.on('mode', (m) => { state.mode = m; ui.sync(state); });
  rig.on('tour', (t) => { state.touring = t; ui.sync(state); });

  let lastLight = null;
  apply = () => {
    applyLook(ctx, state.phase, state.scheme);
    for (const g of [building, lot, pylon]) { g.before.visible = state.phase === 'before'; g.after.visible = state.phase === 'after'; }
    building.setPhase(state.phase, state.light);
    lot.setPhase(state.phase, state.light);
    env.setPhase(state.phase, state.light);
    if (state.light !== lastLight) { lights.set(state.light); lastLight = state.light; }
    const glow = state.light === 'dusk' ? 1.7 : state.light === 'golden' ? 0.4 : 0.0;
    for (const m of ctx.signMats) m.emissiveIntensity = glow;
    ctx.M.backer.emissiveIntensity = ctx.M.backer.userData.lit ? glow * 0.45 : 0;
    ctx.M.soffitLight.emissiveIntensity = state.light === 'dusk' ? (state.phase === 'before' ? 1.1 : 2.6) : state.light === 'golden' ? 0.5 : 0;
    world.phase = state.phase;
    ui.sync(state);
  };
  // deep links: #pylon, #ace, #bens ... and #existing
  const hash = location.hash.replace('#', '');
  if (hash === 'existing' || hash === 'before') state.phase = 'before';
  apply();

  // warm up shaders for both phases so the first toggle is instant
  ui.progress('Compiling shaders', 0.93); await tick();
  renderer.compile(scene, camera);
  state.phase = state.phase === 'after' ? 'before' : 'after'; apply(); renderer.compile(scene, camera);
  state.phase = state.phase === 'after' ? 'before' : 'after'; apply();

  const clock = new THREE.Clock();
  let failed = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); failed = true; ui.fail('The graphics context was lost. Reload the page to continue.'); });
  const frame = (now) => {
    if (failed) return;
    const dt = Math.min(0.05, clock.getDelta());
    rig.update(dt);
    env.update(dt);
    renderer.render(scene, camera);
    ui.drawMap(rig.marker(), now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  ui.progress('Ready', 1);
  ui.done();
  if (VIEWS[hash]) setTimeout(() => rig.flyTo(hash), 400);
  // local test hook, e.g. #test:view=pylon,phase=before,light=dusk,mode=walk,cam=x:y:z:tx:ty:tz
  if (hash.startsWith('test:')) {
    const o = Object.fromEntries(hash.slice(5).split(',').map((kv) => kv.split('=')));
    if (o.phase) state.phase = o.phase;
    if (o.light) state.light = o.light;
    if (o.scheme) state.scheme = o.scheme;
    apply();
    const setCam = (p, t) => { camera.position.set(...p); rig.orbit.target.set(...t); rig.update(0.016); };
    if (o.view && VIEWS[o.view]) setCam(VIEWS[o.view].pos, VIEWS[o.view].target);
    if (o.cam) { const n = o.cam.split(':').map(Number); setCam(n.slice(0, 3), n.slice(3, 6)); }
    if (o.fov) { camera.fov = +o.fov; camera.updateProjectionMatrix(); camera.userData.fixedFov = true; }
    if (o.ui === '0') for (const sel of ['.titleblock', '.rail', '#minimap', '#panel', '#hint']) { const n = document.querySelector(sel); if (n) n.style.display = 'none'; }
    if (o.mode === 'walk') rig.setMode('walk');
    if (o.panel === '0') document.getElementById('panel').style.display = 'none';
    if (o.tab) document.getElementById(`tab-${o.tab}`)?.click();
    if (o.open) document.getElementById('panelBtn')?.click();
    // simulate held keys, e.g. hold=w:4 walks forward for 4 seconds
    if (o.hold) { const [k, secs] = o.hold.split(':'); rig.keys.add(k); for (let i = 0; i < +secs * 60; i++) rig.update(1 / 60); rig.keys.delete(k); }
    if (o.yaw) rig.walk.yaw = +o.yaw;
    if (o.tour) { rig.startTour(); for (let i = 0; i < +o.tour * 60; i++) rig.update(1 / 60); }
    for (let i = 0; i < 3; i++) { rig.update(0.016); env.update(0.016); }
    window.__walkPos = { ...rig.walk };
    if (o.debug) {
      const h = document.getElementById('hint'); h.hidden = false;
      const probe = rig.resolve(114, 5);
      h.textContent = `walk ${rig.walk.x.toFixed(2)},${rig.walk.z.toFixed(2)} boxes=${world.boxes.length} probe(114,5)->${probe.map((v) => v.toFixed(2))} phase=${world.phase}`;
    }
    renderer.render(scene, camera);
    ui.drawMap(rig.marker(), 1e9);
    window.__shotReady = true;
  }

  // expose for debugging and automated previews
  window.__cc = { THREE, scene, camera, renderer, rig, state, apply, ctx };
}

main().catch((err) => {
  console.error(err);
  const t = document.getElementById('loadText');
  if (t) t.textContent = `Something went wrong while building the model: ${err && err.message ? err.message : err}`;
});
