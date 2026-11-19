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
  scene.fog = new THREE.Fog(0x000000, 7, 30);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 2000);
  const home = { pos: new THREE.Vector3(0, 2.3, 1.5), target: new THREE.Vector3(0, 1.3, -1.4) };
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
  // 観客席をうっすら照らす冷たい光
  const fill = new THREE.DirectionalLight(0x9fb0d0, 0.55); fill.position.set(0, 4, 3); scene.add(fill);
  const spot = new THREE.SpotLight(0xfff1d6, 60, 12, Math.PI / 7.5, 0.45, 1.6);
  spot.position.set(0, 5.6, -0.1); spot.target.position.set(0, 0.75, -0.1);
  spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005;
  scene.add(spot, spot.target);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.035, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.set(0, 3.2, -0.1); scene.add(cone);

  // 正面の壁のモニター
  // 寄ったときにも文字がにじまないよう、2倍の解像度で描く(描く座標は 512×320 のまま)
  const monCanvas = document.createElement('canvas'); monCanvas.width = 1024; monCanvas.height = 640;
  const monTex = new THREE.CanvasTexture(monCanvas); monTex.colorSpace = THREE.SRGBColorSpace;
  const monitor = new THREE.Group();
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.92, 0.08), new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.4, metalness: 0.5 }));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.81), new THREE.MeshBasicMaterial({ map: monTex, toneMapped: false }));
  screen.position.z = 0.045; monitor.add(bezel, screen);
  monitor.position.set(0, 2.05, -2.3); monitor.lookAt(0, 2.3, 1.5);
  scene.add(monitor);
  const monGlow = new THREE.PointLight(0xff3344, 0.7, 3.5, 2); monGlow.position.set(0, 1.7, -2.0); scene.add(monGlow);
  let monSymbol = null, monFlash = 0, tickerText = '', tickerX = 512;
  // 砂嵐：小さなノイズ画像を毎フレーム作り直して引き伸ばす
  const noise = document.createElement('canvas'); noise.width = 128; noise.height = 80;
  const ng = noise.getContext('2d'), nimg = ng.createImageData(128, 80);
  let monitorMode = 'game', credits = [['まだ誰もいない']], creditT = 0;
  function drawMonitor(t = 0, dt = 0) {
    const g = monCanvas.getContext('2d');
    g.setTransform(2, 0, 0, 2, 0, 0);
    for (let i = 0; i < nimg.data.length; i += 4) {
      const v = Math.random() * 255;
      nimg.data[i] = nimg.data[i + 1] = nimg.data[i + 2] = v; nimg.data[i + 3] = 255;
    }
    ng.putImageData(nimg, 0, 0);
    g.imageSmoothingEnabled = false;
    g.globalAlpha = 1; g.drawImage(noise, 0, 0, 512, 320);
    g.fillStyle = monitorMode === 'credits' ? 'rgba(4,4,6,0.86)' : 'rgba(5,6,8,0.7)'; g.fillRect(0, 0, 512, 320); // 砂嵐は背景として少し沈める
    if (monitorMode === 'credits') { drawCredits(g, dt); monTex.needsUpdate = true; return; }
    if (monSymbol) {
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.arc(256, 168, 112, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(130, 18, 252, 40);
      g.fillStyle = '#ff2b3a'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center';
      g.fillText('こ れ を 当 て ろ', 256, 46);
      drawSymbol(g, monSymbol, 256, 170, 180, '#f4f4f4', 15);
    }
    // 下の帯：認められた超能力者の名前が右から左へ流れる
    if (tickerText) {
      g.fillStyle = 'rgba(0,0,0,0.78)'; g.fillRect(0, 272, 512, 48);
      g.font = 'bold 24px sans-serif'; g.textAlign = 'left'; g.fillStyle = '#ffd76a';
      const w = g.measureText(tickerText).width;
      tickerX -= dt * 70;
      if (tickerX < -w) tickerX = 512;
      g.fillText(tickerText, tickerX, 305);
    }
    // 走査線
    g.fillStyle = 'rgba(255,255,255,0.035)';
    for (let y = (t * 40) % 4; y < 320; y += 4) g.fillRect(0, y, 512, 1);
    if (monFlash > 0) { g.fillStyle = `rgba(255,255,255,${monFlash})`; g.fillRect(0, 0, 512, 320); }
    monTex.needsUpdate = true;
  }
  // テレビの提供クレジット風：「認められた超能力者」と名前の一覧。8人を超えたら数秒ごとにめくる
  function drawCredits(g, dt) {
    creditT += dt;
    const page = Math.floor(creditT / 3.5) % credits.length, names = credits[page];
    const fade = credits.length > 1 ? Math.min(1, (creditT % 3.5) / 0.35, (3.5 - (creditT % 3.5)) / 0.35) : 1;
    const serif = '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP","Noto Serif CJK JP",serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ff2b3a'; g.font = `bold 22px ${serif}`;
    g.fillText('認められた超能力者', 256, 48);
    g.fillStyle = 'rgba(255,43,58,0.6)'; g.fillRect(90, 47, 50, 2); g.fillRect(372, 47, 50, 2);
    g.globalAlpha = fade; g.fillStyle = '#ffffff'; g.font = `bold 25px ${serif}`;
    const cols = names.length > 4 ? 2 : 1, rows = Math.ceil(names.length / cols);
    names.forEach((n, i) => {
      const c = cols === 2 ? i % 2 : 0, r = cols === 2 ? Math.floor(i / 2) : i;
      const x = cols === 2 ? (c ? 362 : 150) : 256, y = 168 + (r - (rows - 1) / 2) * 44;
      g.fillText(n, x, y, cols === 2 ? 200 : 400);
    });
    g.globalAlpha = 1;
    g.fillStyle = '#8a8a8a'; g.font = `14px ${serif}`;
    g.fillText('この番組は、ご覧の超能力者の提供でお送りします', 256, 292);
    g.textBaseline = 'alphabetic';
  }
  drawMonitor();

  const frameFns = new Set();
  const tweens = new Set();
  const clock = new THREE.Clock();
  let elapsed = 0;
  // 画面の縦横比に合わせて、モニターの上端(HUDの下)と手前のカードの下端(下のボタンの上)が
  // 両方収まる向きと画角を探す
  const monitorTop = new THREE.Vector3(0, 2.52, -2.3);
  const nearCards = [new THREE.Vector3(-0.42, 0.78, 0.5), new THREE.Vector3(0.42, 0.78, 0.5)];
  function fitCamera(w, h) {
    const topNdc = 1 - 2 * (118 / h), bottomNdc = -1 + 2 * (84 / h);
    const v = new THREE.Vector3();
    let best = null;
    for (let fov = 46; fov <= 84 && !best; fov += 1) {
      for (let ty = 1.5; ty >= 0.6 && !best; ty -= 0.05) {
        camera.fov = fov; camera.aspect = w / h; camera.updateProjectionMatrix();
        camera.position.copy(home.pos); camera.lookAt(0, ty, -1.4); camera.updateMatrixWorld();
        const top = v.copy(monitorTop).project(camera).y;
        const bottom = Math.min(...nearCards.map((p) => v.copy(p).project(camera).y));
        if (top <= topNdc && bottom >= bottomNdc) best = { fov, ty };
      }
    }
    best ??= { fov: 84, ty: 1.0 };
    camera.fov = best.fov; camera.updateProjectionMatrix();
    home.target.set(0, best.ty, -1.4);
  }
  function resize() {
    const vv = window.visualViewport;
    const w = Math.round(vv?.width ?? window.innerWidth), h = Math.round(vv?.height ?? window.innerHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    fitCamera(w, h);
    camera.position.copy(home.pos); lookTarget.copy(home.target);
  }
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  resize();

  function render() { renderer.render(scene, camera); }
  function loop() {
    const dt = Math.min(clock.getDelta(), 0.1); elapsed += dt;
    if (monFlash > 0) monFlash = Math.max(0, monFlash - dt * 2.5);
    drawMonitor(elapsed, dt);
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
        if (t >= 1) { frameFns.delete(step); tweens.delete(step); resolve(); }
      };
      frameFns.add(step); tweens.add(step);
    });
  }
  function moveCamera(pos, target, duration = 0.6, easing = ease.inOut) {
    const p0 = camera.position.clone(), t0 = lookTarget.clone();
    return tween(duration, (k) => { camera.position.lerpVectors(p0, pos, k); lookTarget.lerpVectors(t0, target, k); }, easing);
  }

  return {
    THREE, scene, camera, renderer, room, walls, ceiling, floor, table, spot, cone, ambient, monitor, monGlow, home, lookTarget,
    setMonitorSymbol(s) { monSymbol = s; monFlash = 0.8; },
    get monitorMode() { return monitorMode; },
    setCredits(pages) { credits = pages; creditT = 0; },
    // カメラをモニターの正面へぐいっと寄せる(画面いっぱいに収まる距離)
    async focusMonitor(duration = 1.1) {
      monitorMode = 'credits'; creditT = 0;
      const center = new THREE.Vector3(); monitor.getWorldPosition(center);
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(monitor.quaternion).normalize();
      const vfov = THREE.MathUtils.degToRad(camera.fov), hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
      const dist = Math.max(0.78 / Math.tan(hfov / 2), 0.52 / Math.tan(vfov / 2));
      // 少し行き過ぎてから戻る「ぐいっ」
      const over = center.clone().add(normal.clone().multiplyScalar(dist * 0.9));
      await moveCamera(over, center, duration * 0.75, ease.inOut);
      await moveCamera(center.clone().add(normal.multiplyScalar(dist)), center, duration * 0.25, ease.out);
    },
    async unfocusMonitor(duration = 0.8) {
      await moveCamera(home.pos, home.target, duration, ease.inOut);
      monitorMode = 'game';
    },
    cameraToMonitor() { const c = new THREE.Vector3(); monitor.getWorldPosition(c); return camera.position.distanceTo(c); },
    setTicker(text) { if (text !== tickerText) { tickerText = text; tickerX = 512; } },
    get tickerText() { return tickerText; },
    monitorNoise: true,
    render, tween, moveCamera, wait: (s) => tween(s, () => {}, ease.linear),
    // 動いている途中の tween をすべて終わらせる(最後の値まで進めてから止める)
    stopTweens() { for (const fn of [...tweens]) fn(Infinity); },
    onFrame(fn) { frameFns.add(fn); return () => frameFns.delete(fn); },
    get elapsed() { return elapsed; },
  };
}
