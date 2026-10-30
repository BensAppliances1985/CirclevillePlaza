import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VIEWS, TOUR } from './config.js';
import { clamp, easeInOut } from './util.js';

const BOUNDS = { x0: -70, x1: 215, z0: -125, z1: 105 };
const EYE = 1.65, RADIUS = 0.32;
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class CameraRig {
  constructor(camera, dom, world) {
    this.camera = camera; this.dom = dom; this.world = world;
    const o = (this.orbit = new OrbitControls(camera, dom));
    Object.assign(o, { enableDamping: true, dampingFactor: 0.08, minDistance: 3, maxDistance: 480, maxPolarAngle: Math.PI * 0.496, screenSpacePanning: false, panSpeed: 0.9, rotateSpeed: 0.55, zoomSpeed: 0.9, keyPanSpeed: 18 });
    o.listenToKeyEvents(window);
    o.target.set(...VIEWS.overview.target);
    camera.position.set(...VIEWS.overview.pos);
    o.maxPolarAngle = Math.PI * 0.75;
    o.update();
    this.walk = { x: 60, z: -30, yaw: 0, pitch: 0, vx: 0, vz: 0, ground: 0, bob: 0 };
    this.keys = new Set();
    this.mode = 'orbit';
    this.anim = null;
    this.tour = null;
    this.drag = null;
    this.joy = { active: false, id: null, dx: 0, dy: 0 };
    this.listeners = { mode: [], tour: [], input: [] };
    this._bind();
  }
  on(evt, fn) { this.listeners[evt].push(fn); }
  emit(evt, v) { for (const fn of this.listeners[evt]) fn(v); }

  _bind() {
    const el = this.dom;
    const userInput = () => { if (this.tour) this.stopTour(); this.emit('input'); };
    el.addEventListener('pointerdown', (e) => {
      userInput();
      if (this.mode !== 'walk') return;
      if (this.drag) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' };
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.drag || e.pointerId !== this.drag.id || this.mode !== 'walk') return;
      const k = this.drag.touch ? 0.0055 : 0.0038;
      this.walk.yaw -= (e.clientX - this.drag.x) * k;
      this.walk.pitch = clamp(this.walk.pitch - (e.clientY - this.drag.y) * k, -1.35, 1.35);
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      this.anim = null;
    });
    const end = (e) => { if (this.drag && e.pointerId === this.drag.id) this.drag = null; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', () => userInput(), { passive: true });
    window.addEventListener('keydown', (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
        if (this.mode === 'walk' && k.startsWith('arrow')) e.preventDefault();
        this.keys.add(k); userInput();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  bindJoystick(base, knob) {
    const R = 46;
    const move = (e) => {
      const r = base.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy); if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      this.joy.dx = dx / R; this.joy.dy = dy / R;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    base.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.joy.active = true; this.joy.id = e.pointerId; base.setPointerCapture?.(e.pointerId); move(e); if (this.tour) this.stopTour(); });
    base.addEventListener('pointermove', (e) => { if (this.joy.active && e.pointerId === this.joy.id) move(e); });
    const end = (e) => { if (e.pointerId !== this.joy.id) return; this.joy.active = false; this.joy.dx = this.joy.dy = 0; knob.style.transform = ''; };
    base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end);
  }

  // ---------- modes ----------
  setMode(mode) {
    if (mode === this.mode) return;
    const cam = this.camera, w = this.walk;
    this.anim = null;
    if (mode === 'walk') {
      const t = this.orbit.target, dir = new THREE.Vector3().subVectors(t, cam.position);
      dir.y = 0; if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1); dir.normalize();
      let x, z;
      if (cam.position.y < 3.2) { x = cam.position.x; z = cam.position.z; }
      else { x = t.x - dir.x * 10; z = t.z - dir.z * 10; }
      [x, z] = this.resolve(clamp(x, BOUNDS.x0, BOUNDS.x1), clamp(z, BOUNDS.z0, BOUNDS.z1));
      Object.assign(w, { x, z, yaw: Math.atan2(-dir.x, -dir.z), pitch: -0.04, vx: 0, vz: 0 });
      w.ground = this.groundAt(x, z);
      this.orbit.enabled = false;
      cam.rotation.order = 'YXZ';
    } else {
      const f = new THREE.Vector3(-Math.sin(w.yaw), 0, -Math.cos(w.yaw));
      this.orbit.target.set(w.x + f.x * 15, 2, w.z + f.z * 15);
      this.orbit.enabled = true;
      this.orbit.update();
    }
    this.mode = mode;
    this.emit('mode', mode);
  }

  groundAt(x, z) {
    for (const zn of this.world.zones) if (x > zn.x0 && x < zn.x1 && z > zn.z0 && z < zn.z1) return zn.y;
    return 0;
  }

  resolve(x, z) {
    const phase = this.world.phase, r = RADIUS;
    for (const b of this.world.boxes) {
      if (b.phase && b.phase !== phase) continue;
      if (b.mask && !b.mask.includes(phase === 'before' ? 'b' : 'a')) continue;
      if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) {
        const dl = x - (b.x0 - r), dr = b.x1 + r - x, dn = z - (b.z0 - r), df = b.z1 + r - z;
        const m = Math.min(dl, dr, dn, df);
        if (m === dl) x = b.x0 - r; else if (m === dr) x = b.x1 + r; else if (m === dn) z = b.z0 - r; else z = b.z1 + r;
      }
    }
    for (const c of this.world.circles) {
      if (c.phase && c.phase !== phase) continue;
      const dx = x - c.x, dz = z - c.z, R = c.r + r;
      if (Math.abs(dx) > R || Math.abs(dz) > R) continue;
      const d = Math.hypot(dx, dz);
      if (d < R && d > 1e-6) { x = c.x + (dx / d) * R; z = c.z + (dz / d) * R; }
    }
    for (const s of this.world.segments) {
      const sx = s.x1 - s.x0, sz = s.z1 - s.z0;
      const t = clamp(((x - s.x0) * sx + (z - s.z0) * sz) / (sx * sx + sz * sz), 0, 1);
      const px = s.x0 + sx * t, pz = s.z0 + sz * t, dx = x - px, dz = z - pz, d = Math.hypot(dx, dz), R = s.r + r;
      if (d < R && d > 1e-6) { x = px + (dx / d) * R; z = pz + (dz / d) * R; }
    }
    return [clamp(x, BOUNDS.x0, BOUNDS.x1), clamp(z, BOUNDS.z0, BOUNDS.z1)];
  }

  // ---------- viewpoints ----------
  flyTo(key, opts = {}) {
    const v = VIEWS[key];
    if (!v) return;
    if (this.mode === 'walk' && v.eye) {
      const dir = new THREE.Vector3(v.target[0] - v.pos[0], v.target[1] - v.pos[1], v.target[2] - v.pos[2]);
      const yaw = Math.atan2(-dir.x, -dir.z), pitch = Math.atan2(dir.y - (EYE - 1.65), Math.hypot(dir.x, dir.z));
      const w = this.walk;
      this.anim = { walk: true, t: 0, duration: opts.duration ?? 1.4, from: { x: w.x, z: w.z, yaw: w.yaw, pitch: w.pitch }, to: { x: v.pos[0], z: v.pos[2], yaw: w.yaw + wrapAngle(yaw - w.yaw), pitch } };
      return;
    }
    if (this.mode === 'walk') this.setMode('orbit');
    const from = { pos: this.camera.position.clone(), target: this.orbit.target.clone() };
    const to = { pos: new THREE.Vector3(...v.pos), target: new THREE.Vector3(...v.target) };
    const dist = from.pos.distanceTo(to.pos);
    this.anim = { t: 0, duration: (opts.duration ?? 1.9) * clamp(dist / 140, 0.75, 1.5), from, to, lift: Math.min(45, dist * 0.22) * (to.pos.y < 3 && from.pos.y < 3 ? 0.4 : 1) };
    this.orbit.enabled = false;
  }

  jumpTo(x, z) {
    if (this.mode === 'walk') {
      const [nx, nz] = this.resolve(x, z);
      this.anim = { walk: true, t: 0, duration: 0.9, from: { x: this.walk.x, z: this.walk.z, yaw: this.walk.yaw, pitch: this.walk.pitch }, to: { x: nx, z: nz, yaw: this.walk.yaw, pitch: this.walk.pitch } };
    } else {
      const off = new THREE.Vector3().subVectors(this.camera.position, this.orbit.target);
      const to = { target: new THREE.Vector3(x, 2, z) }; to.pos = to.target.clone().add(off);
      this.anim = { t: 0, duration: 1.1, from: { pos: this.camera.position.clone(), target: this.orbit.target.clone() }, to, lift: 0 };
      this.orbit.enabled = false;
    }
  }

  startTour() {
    if (this.mode === 'walk') this.setMode('orbit');
    this.tour = { i: 0, hold: 0 };
    this.flyTo(TOUR[0], { duration: 2.4 });
    this.emit('tour', true);
  }
  stopTour() {
    if (!this.tour) return;
    this.tour = null; this.orbit.autoRotate = false;
    this.emit('tour', false);
  }

  marker() {
    const cam = this.camera;
    const d = new THREE.Vector3(); cam.getWorldDirection(d);
    return { x: cam.position.x, z: cam.position.z, yaw: Math.atan2(-d.x, -d.z) };
  }

  // ---------- per frame ----------
  update(dt) {
    const cam = this.camera;
    if (this.anim && !this.anim.walk) {
      const a = this.anim; a.t = Math.min(1, a.t + dt / a.duration);
      const e = easeInOut(a.t);
      cam.position.lerpVectors(a.from.pos, a.to.pos, e); cam.position.y += Math.sin(Math.PI * e) * a.lift;
      this.orbit.target.lerpVectors(a.from.target, a.to.target, e);
      cam.lookAt(this.orbit.target);
      if (a.t >= 1) {
        this.anim = null; this.orbit.enabled = true;
        const dist = cam.position.distanceTo(this.orbit.target) || 1;
        this.orbit.maxPolarAngle = Math.acos(clamp((0.9 - this.orbit.target.y) / dist, -1, 1));
        this.orbit.update();
        if (this.tour) this.tour.hold = 0;
      }
      return;
    }
    if (this.mode === 'orbit') {
      if (this.tour) this._tourTick(dt);
      // let the camera sit below its target (looking up at signs) but never below the ground
      const dist = cam.position.distanceTo(this.orbit.target) || 1;
      this.orbit.maxPolarAngle = Math.acos(clamp((0.9 - this.orbit.target.y) / dist, -1, 1));
      this.orbit.update();
      const t = this.orbit.target;
      t.x = clamp(t.x, BOUNDS.x0, BOUNDS.x1); t.z = clamp(t.z, BOUNDS.z0 - 40, BOUNDS.z1); t.y = clamp(t.y, 0, 30);
      if (cam.position.y < 0.6) cam.position.y = 0.6;
      return;
    }
    this._walkTick(dt);
  }

  _tourTick(dt) {
    const tr = this.tour, key = TOUR[tr.i], v = VIEWS[key];
    tr.hold += dt;
    if (v.eye) {
      const t = this.orbit.target, p = this.camera.position;
      const d = p.distanceTo(t);
      if (d > 8) p.lerp(t, Math.min(1, dt * 0.018));
      this.orbit.autoRotate = false;
    } else { this.orbit.autoRotate = true; this.orbit.autoRotateSpeed = 0.45; }
    if (tr.hold > (v.eye ? 4.2 : 5.2)) {
      this.orbit.autoRotate = false;
      tr.i = (tr.i + 1) % TOUR.length; tr.hold = 0;
      this.flyTo(TOUR[tr.i], { duration: 2.4 });
    }
  }

  _walkTick(dt) {
    const w = this.walk, cam = this.camera, k = this.keys;
    if (this.anim && this.anim.walk) {
      const a = this.anim; a.t = Math.min(1, a.t + dt / a.duration);
      const e = easeInOut(a.t);
      w.x = a.from.x + (a.to.x - a.from.x) * e; w.z = a.from.z + (a.to.z - a.from.z) * e;
      w.yaw = a.from.yaw + (a.to.yaw - a.from.yaw) * e; w.pitch = a.from.pitch + (a.to.pitch - a.from.pitch) * e;
      if (a.t >= 1) this.anim = null;
    } else {
      let f = 0, s = 0, turn = 0;
      if (k.has('w') || k.has('arrowup')) f += 1;
      if (k.has('s') || k.has('arrowdown')) f -= 1;
      if (k.has('a')) s -= 1;
      if (k.has('d')) s += 1;
      if (k.has('arrowleft') || k.has('q')) turn += 1;
      if (k.has('arrowright') || k.has('e')) turn -= 1;
      if (this.joy.active) { f -= this.joy.dy; s += this.joy.dx; }
      w.yaw += turn * 1.7 * dt;
      const mag = Math.hypot(f, s); if (mag > 1) { f /= mag; s /= mag; }
      const speed = k.has('shift') ? 8 : 3.4;
      const fx = -Math.sin(w.yaw), fz = -Math.cos(w.yaw), rx = Math.cos(w.yaw), rz = -Math.sin(w.yaw);
      const tvx = (fx * f + rx * s) * speed, tvz = (fz * f + rz * s) * speed;
      const blend = 1 - Math.exp(-dt * 10);
      w.vx += (tvx - w.vx) * blend; w.vz += (tvz - w.vz) * blend;
      let [x, z] = this.resolve(w.x + w.vx * dt, w.z);
      [x, z] = this.resolve(x, z + w.vz * dt);
      w.x = x; w.z = z;
      const moving = Math.hypot(w.vx, w.vz);
      w.bob += dt * moving * 2.4;
    }
    const g = this.groundAt(w.x, w.z);
    w.ground += (g - w.ground) * Math.min(1, dt * 14);
    const bob = Math.sin(w.bob) * 0.025 * Math.min(1, Math.hypot(w.vx, w.vz) / 3);
    cam.position.set(w.x, w.ground + EYE + bob, w.z);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(w.pitch, w.yaw, 0);
  }
}
