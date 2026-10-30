import * as THREE from 'three';

// Sun directions are chosen to light the NNW-facing storefronts well; they are presentation lighting,
// not a solar study (the real storefronts only see direct sun on summer evenings).
const PRESETS = {
  day: {
    sun: [-0.42, 0.8, -0.44], sunColor: '#fff6ea', sunI: 3.3, hemiSky: '#cfe2ff', hemiGround: '#8b8570', hemiI: 0.42,
    top: '#2c68b8', horizon: '#c8dbeb', bottom: '#7d858a', glowColor: '#fff1dc', glow: 0.25, glowPow: 8, skyI: 1.05,
    exposure: 0.6, fog: '#c3d5e6', fogNear: 450, fogFar: 2600, env: 0.8, ground: '#6b685f',
  },
  golden: {
    sun: [-0.7, 0.19, -0.69], sunColor: '#ffc98f', sunI: 3.4, hemiSky: '#ffd9b8', hemiGround: '#6b5846', hemiI: 0.32,
    top: '#46669e', horizon: '#efc9a1', bottom: '#6b5a4a', glowColor: '#ffb46a', glow: 0.7, glowPow: 5, skyI: 1.0,
    exposure: 0.62, fog: '#e2c6a8', fogNear: 400, fogFar: 2200, env: 0.6, ground: '#3d3328',
  },
  dusk: {
    sun: [-0.72, -0.05, -0.69], sunColor: '#8391b8', sunI: 0.4, hemiSky: '#4d5a82', hemiGround: '#1c1c22', hemiI: 0.34,
    top: '#0c1430', horizon: '#46507a', bottom: '#15161b', glowColor: '#e38a5a', glow: 0.6, glowPow: 3, skyI: 1.0,
    exposure: 0.95, fog: '#2f3653', fogNear: 300, fogFar: 1800, env: 0.3, ground: '#0f1014',
    fill: [0.25, 1, -0.35],
  },
};

function skyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
      glowColor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) },
      glow: { value: 0.3 }, glowPow: { value: 8 }, intensity: { value: 1 }, disk: { value: 1 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDir = wp.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * wp;
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: `
      uniform vec3 top, horizon, bottom, glowColor, sunDir;
      uniform float glow, glowPow, intensity, disk;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, bottom, pow(min(1.0, -h * 4.0), 0.6));
        vec3 sd = normalize(sunDir);
        float s = max(dot(d, sd), 0.0);
        float band = 1.0 - smoothstep(0.0, 0.5, abs(h - max(sd.y, -0.1)));
        col += glowColor * glow * (pow(s, glowPow) * (0.6 + 0.4 * band) + pow(s, 90.0) * 0.8);
        col += glowColor * smoothstep(0.99955, 0.9997, s) * 6.0 * disk;
        gl_FragColor = vec4(col * intensity, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
}

export function createLighting(renderer, scene, { mobile }) {
  const skyMat = skyMaterial();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), skyMat);
  sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);

  const sun = new THREE.DirectionalLight('#ffffff', 3);
  sun.castShadow = true;
  const size = mobile ? 2048 : 4096;
  sun.shadow.mapSize.set(size, size);
  const cam = sun.shadow.camera;
  cam.left = -150; cam.right = 150; cam.top = 150; cam.bottom = -150; cam.near = 10; cam.far = 900;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.05;
  sun.target.position.set(62, 0, -5);
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight('#cfe2ff', '#8b8570', 0.9);
  scene.add(hemi);
  scene.fog = new THREE.Fog('#c9d8e8', 450, 2600);

  // environment map rendered from a copy of the sky plus a ground disc (reflections on glass and paint)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSkyMat = skyMaterial();
  envSkyMat.uniforms = skyMat.uniforms;
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), envSkyMat));
  const envGround = new THREE.Mesh(new THREE.CircleGeometry(880, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#4d4c44' }));
  envGround.position.y = -8;
  envScene.add(envGround);
  let envRT = null;

  function set(mode) {
    const p = PRESETS[mode];
    const dir = new THREE.Vector3(...p.sun).normalize();
    const U = skyMat.uniforms;
    U.top.value.set(p.top); U.horizon.value.set(p.horizon); U.bottom.value.set(p.bottom);
    U.glowColor.value.set(p.glowColor); U.glow.value = p.glow; U.glowPow.value = p.glowPow; U.intensity.value = p.skyI;
    U.sunDir.value.copy(dir); U.disk.value = dir.y > 0 ? 1 : 0;
    const lightDir = p.fill ? new THREE.Vector3(...p.fill).normalize() : dir;
    sun.position.copy(sun.target.position).addScaledVector(lightDir, 400);
    sun.color.set(p.sunColor);
    sun.intensity = p.sunI;
    hemi.color.set(p.hemiSky); hemi.groundColor.set(p.hemiGround); hemi.intensity = p.hemiI;
    scene.fog.color.set(p.fog); scene.fog.near = p.fogNear; scene.fog.far = p.fogFar;
    renderer.toneMappingExposure = p.exposure;
    envGround.material.color.set(p.ground);
    if (envRT) envRT.dispose();
    envRT = pmrem.fromScene(envScene, 0, 0.1, 2000);
    scene.environment = envRT.texture;
    if ('environmentIntensity' in scene) scene.environmentIntensity = p.env;
  }

  return { set, sun, hemi, sky };
}
