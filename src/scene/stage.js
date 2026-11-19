import * as THREE from 'three';
import { drawSymbol } from './symbols.js';

export const ease = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  linear: (t) => t,
};

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

function concreteTexture(seed = 1, base = 34) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = `rgb(${base},${base},${base + 2})`; g.fillRect(0, 0, 256, 256);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    const v = base + (rnd() - 0.5) * 22;
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createStage(canvas, { preserve = false } = {}) {
  if (!hasWebGL()) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: preserve });
  } catch { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 6, 22);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 2000);
  const home = { pos: new THREE.Vector3(0, 2.25, 1.5), target: new THREE.Vector3(0, 0.95, -1.0) };
  camera.position.copy(home.pos);
  const lookTarget = home.target.clone();
  camera.lookAt(lookTarget);

  // 部屋(窓なし、コンクリート)
  const room = new THREE.Group(); scene.add(room);
  const wallTex = concreteTexture(7, 30); wallTex.repeat.set(3, 2);
  const floorTex = concreteTexture(3, 22); floorTex.repeat.set(4, 4);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; room.add(floor);
  const walls = [];
  for (const [x, z, ry] of [[0, -5, 0], [-5, 0, Math.PI / 2], [5, 0, -Math.PI / 2], [0, 5, Math.PI]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), wallMat);
    w.position.set(x, 3, z); w.rotation.y = ry; w.receiveShadow = true; room.add(w); walls.push(w);
  }
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), wallMat);
  ceiling.position.y = 6; ceiling.rotation.x = Math.PI / 2; room.add(ceiling);

  // テーブル
  const table = new THREE.Group(); scene.add(table);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.06, 48),
    new THREE.MeshStandardMaterial({ color: 0x0c2a1c, roughness: 0.9 }));
  top.position.y = 0.75; top.receiveShadow = true; top.castShadow = true; table.add(top);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.03, 8, 64), new THREE.MeshStandardMaterial({ color: 0x1a120a, roughness: 0.6, metalness: 0.2 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.78; table.add(rim);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 0.75, 16), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 }));
  leg.position.y = 0.37; leg.castShadow = true; table.add(leg);

  // 手前の手元(袖)
  const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x1b1b22, roughness: 0.95 });
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.55, 6, 12), sleeveMat);
    arm.rotation.x = Math.PI / 2; arm.rotation.y = sx * 0.35;
    arm.position.set(sx * 0.5, 0.84, 0.78); arm.castShadow = true; scene.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshStandardMaterial({ color: 0xb08a72, roughness: 0.8 }));
    hand.scale.set(1, 0.6, 1.3); hand.position.set(sx * 0.4, 0.82, 0.48); scene.add(hand);
  }

  // 照明：真上のスポットライトひとつ＋ごく薄い環境光
  const ambient = new THREE.AmbientLight(0x30324a, 0.35); scene.add(ambient);
  const spot = new THREE.SpotLight(0xfff1d6, 60, 12, Math.PI / 7.5, 0.45, 1.6);
  spot.position.set(0, 5.6, -0.1); spot.target.position.set(0, 0.75, -0.1);
  spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005;
  scene.add(spot, spot.target);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.035, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.set(0, 3.2, -0.1); scene.add(cone);

  // 正面の壁のモニター
  const monCanvas = document.createElement('canvas'); monCanvas.width = 512; monCanvas.height = 320;
  const monTex = new THREE.CanvasTexture(monCanvas); monTex.colorSpace = THREE.SRGBColorSpace;
  const monitor = new THREE.Group();
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 0.08), new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.4, metalness: 0.5 }));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.58, 0.99), new THREE.MeshBasicMaterial({ map: monTex, toneMapped: false }));
  screen.position.z = 0.045; monitor.add(bezel, screen);
  monitor.position.set(0, 1.78, -2.4); monitor.lookAt(0, 2.25, 1.5);
  scene.add(monitor);
  const monGlow = new THREE.PointLight(0xff3344, 2.2, 5, 1.8); monGlow.position.set(0, 1.7, -2.0); scene.add(monGlow);
  let monSymbol = null, monFlash = 0;
  function drawMonitor(t = 0) {
    const g = monCanvas.getContext('2d');
    g.fillStyle = '#050608'; g.fillRect(0, 0, 512, 320);
    if (monSymbol) {
      g.fillStyle = '#ff2b3a'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center';
      g.fillText('こ れ を 当 て ろ', 256, 52);
      drawSymbol(g, monSymbol, 256, 185, 190, '#f4f4f4', 15);
    }
    // 走査線
    g.fillStyle = 'rgba(255,255,255,0.035)';
    for (let y = (t * 40) % 4; y < 320; y += 4) g.fillRect(0, y, 512, 1);
    if (monFlash > 0) { g.fillStyle = `rgba(255,255,255,${monFlash})`; g.fillRect(0, 0, 512, 320); }
    monTex.needsUpdate = true;
  }
  drawMonitor();

  const frameFns = new Set();
  const clock = new THREE.Clock();
  let elapsed = 0;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 縦長でもテーブル全体が入るように画角を広げる
    camera.fov = w / h < 0.62 ? 58 : 46;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  function render() { renderer.render(scene, camera); }
  function loop() {
    const dt = Math.min(clock.getDelta(), 0.1); elapsed += dt;
    if (monFlash > 0) monFlash = Math.max(0, monFlash - dt * 2.5);
    drawMonitor(elapsed);
    for (const fn of frameFns) fn(dt, elapsed);
    camera.lookAt(lookTarget);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function tween(duration, fn, easing = ease.inOut) {
    return new Promise((resolve) => {
      let t = 0;
      if (duration <= 0) { fn(1); resolve(); return; }
      const step = (dt) => {
        t = Math.min(1, t + dt / duration); fn(easing(t));
        if (t >= 1) { frameFns.delete(step); resolve(); }
      };
      frameFns.add(step);
    });
  }
  function moveCamera(pos, target, duration = 0.6, easing = ease.inOut) {
    const p0 = camera.position.clone(), t0 = lookTarget.clone();
    return tween(duration, (k) => { camera.position.lerpVectors(p0, pos, k); lookTarget.lerpVectors(t0, target, k); }, easing);
  }

  return {
    THREE, scene, camera, renderer, room, walls, ceiling, floor, table, spot, cone, ambient, monitor, monGlow, home, lookTarget,
    setMonitorSymbol(s) { monSymbol = s; monFlash = 0.8; },
    render, tween, moveCamera, wait: (s) => tween(s, () => {}, ease.linear),
    onFrame(fn) { frameFns.add(fn); return () => frameFns.delete(fn); },
    get elapsed() { return elapsed; },
  };
}
