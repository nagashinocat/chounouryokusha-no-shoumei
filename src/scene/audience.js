import * as THREE from 'three';
import { tierFor } from '../tiers.js';
import { ease } from './stage.js';

const MAX_FIGURES = 300;
const TIERS = ['room', 'theater', 'stadium', 'city', 'earth'];

// 0..1 に対数で正規化
const logProgress = (n, lo, hi) => Math.min(1, Math.max(0, Math.log(Math.max(n, lo) / lo) / Math.log(hi / lo)));

function seatLayout() {
  const seats = [];
  for (let r = 0; r < 12; r++) {
    const radius = 2.9 + r * 0.5, y = 0.15 + r * 0.38;
    const n = Math.round((2.3 * radius) / 0.5);
    for (let i = 0; i < n; i++) {
      const a = -1.15 + (2.3 * (i + 0.5)) / n + (r % 2 ? 0.08 : 0);
      const x = Math.sin(a) * radius;
      const hidden = Math.abs(x) < 0.85 && r < 6; // モニターの裏は後回し
      seats.push({ x, y, z: -Math.cos(a) * radius, pr: Math.abs(a) * 0.9 + r * 0.25 + (hidden ? 4 : 0) + Math.random() * 0.2 });
    }
  }
  seats.sort((p, q) => p.pr - q.pr);
  return seats.slice(0, MAX_FIGURES);
}

// 黒い仮面に、赤く光る目をひとつだけ書き殴る。球のUVで正面(+z)は u=0.25
function scrawledEyeTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 256);
  const cx = 128, cy = 118;
  const jitter = (v, a) => v + (Math.random() - 0.5) * a;
  g.lineCap = 'round'; g.lineJoin = 'round';
  // 目の輪郭を何度もなぞって書き殴る
  for (let pass = 0; pass < 7; pass++) {
    g.strokeStyle = `rgba(255,${20 + Math.random() * 30},${20 + Math.random() * 20},${0.55 + Math.random() * 0.45})`;
    g.lineWidth = 2 + Math.random() * 3.5;
    g.beginPath();
    const w = jitter(46, 10), h = jitter(20, 7), tilt = (Math.random() - 0.5) * 0.25;
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2 + pass * 0.3;
      const x = cx + Math.cos(a) * w + Math.sin(a) * h * tilt, y = cy + Math.sin(a) * h * (Math.cos(a) > 0 ? 1 : 1.15);
      i ? g.lineTo(jitter(x, 4), jitter(y, 4)) : g.moveTo(x, y);
    }
    g.stroke();
  }
  // ぐるぐる塗りつぶした瞳
  g.strokeStyle = '#ff2a1a';
  for (let i = 0; i < 26; i++) {
    g.lineWidth = 1.5 + Math.random() * 2.5;
    g.beginPath(); g.arc(jitter(cx, 5), jitter(cy, 4), 3 + Math.random() * 12, Math.random() * 6, Math.random() * 6 + 3); g.stroke();
  }
  g.fillStyle = '#ffd0b0'; g.beginPath(); g.arc(cx + 2, cy - 1, 3, 0, Math.PI * 2); g.fill();
  // 下へ垂れる線
  for (let i = 0; i < 4; i++) {
    g.strokeStyle = `rgba(230,10,10,${0.4 + Math.random() * 0.4})`; g.lineWidth = 1.5 + Math.random() * 2;
    let x = jitter(cx, 60), y = cy + 18;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { y += 6 + Math.random() * 10; g.lineTo(jitter(x, 3), y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function windowTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 512;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 128, 512);
  for (let y = 3; y < 512; y += 6) for (let x = 3; x < 128; x += 6) {
    if (Math.random() < 0.35) { g.fillStyle = Math.random() < 0.8 ? '#ffcf7a' : '#bfe3ff'; g.fillRect(x, y, 2, 3); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function earthTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#020611'; g.fillRect(0, 0, 1024, 512);
  // 大陸っぽいかたまり
  const blobs = [];
  for (let i = 0; i < 14; i++) blobs.push({ x: Math.random() * 1024, y: 90 + Math.random() * 330, r: 40 + Math.random() * 110 });
  g.fillStyle = '#0a0f12';
  for (const b of blobs) for (let k = 0; k < 30; k++) {
    g.beginPath(); g.arc(b.x + (Math.random() - 0.5) * b.r * 1.6, b.y + (Math.random() - 0.5) * b.r, b.r * (0.2 + Math.random() * 0.4), 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, blobs };
}

function cityLights(blobs, count) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < count; i++) {
    const b = blobs[i % blobs.length];
    const a = Math.random() * Math.PI * 2, d = Math.pow(Math.random(), 0.7) * b.r;
    const x = b.x + Math.cos(a) * d * 1.3, y = b.y + Math.sin(a) * d * 0.8;
    g.fillStyle = `rgba(255,${190 + Math.random() * 50},${110 + Math.random() * 60},${0.5 + Math.random() * 0.5})`;
    g.fillRect(x, y, 1.6, 1.6);
  }
  return c;
}

export function createAudience(stage) {
  const { scene } = stage;

  // ---- 仮面のマネキン(InstancedMesh) ----
  const seats = seatLayout();
  const bodyGeo = new THREE.CapsuleGeometry(0.17, 0.34, 4, 10);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b2b35, roughness: 0.85 });
  const maskGeo = new THREE.SphereGeometry(0.13, 32, 20);
  const eyeTex = scrawledEyeTexture();
  const maskMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.18, metalness: 0.3, emissive: 0xff1a10, emissiveMap: eyeTex, emissiveIntensity: 2.2 });
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, MAX_FIGURES);
  const masks = new THREE.InstancedMesh(maskGeo, maskMat, MAX_FIGURES);
  bodies.castShadow = true;
  scene.add(bodies, masks);
  const fig = seats.map((s) => ({ ...s, face: Math.atan2(-s.x, -s.z), tilt: 0, rise: 0, leave: 0, visible: false, phase: Math.random() * 6 }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  let figureCount = 0;

  // ---- スタジアムの群衆(点) ----
  const CROWD = 30000;
  const crowdPos = new Float32Array(CROWD * 3), crowdCol = new Float32Array(CROWD * 3);
  for (let i = 0; i < CROWD; i++) {
    const a = Math.random() * Math.PI * 2, r = 9 + Math.pow(Math.random(), 0.8) * 32;
    crowdPos.set([Math.cos(a) * r, -1 + (r - 9) * 0.55 + Math.random() * 0.4, Math.sin(a) * r], i * 3);
    const w = 0.4 + Math.random() * 0.6;
    crowdCol.set([w, w * (0.75 + Math.random() * 0.2), w * (0.6 + Math.random() * 0.3)], i * 3);
  }
  const crowdGeo = new THREE.BufferGeometry();
  crowdGeo.setAttribute('position', new THREE.BufferAttribute(crowdPos, 3));
  crowdGeo.setAttribute('color', new THREE.BufferAttribute(crowdCol, 3));
  const crowdMat = new THREE.PointsMaterial({ size: 0.11, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const crowd = new THREE.Points(crowdGeo, crowdMat); scene.add(crowd);
  const stadiumLights = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const l = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
    l.position.set(Math.cos(a) * 42, 26, Math.sin(a) * 42); l.lookAt(0, 0, 0); stadiumLights.add(l);
  }
  stadiumLights.visible = false; scene.add(stadiumLights);

  // ---- 夜の都市 ----
  const BUILDINGS = 1600;
  const winTex = windowTexture(); winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
  const cityMat = new THREE.MeshStandardMaterial({ color: 0x07080c, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 1.2, roughness: 1, fog: false });
  const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cityMat, BUILDINGS);
  for (let i = 0; i < BUILDINGS; i++) {
    const a = Math.random() * Math.PI * 2, r = 28 + Math.pow(Math.random(), 0.6) * 160;
    const w = 3 + Math.random() * 6, h = 20 + Math.random() * (25 + r * 0.35);
    m4.compose(v.set(Math.cos(a) * r, -30 + h / 2 + Math.random() * 4, Math.sin(a) * r), q.identity(), sc.set(w, h, w));
    city.setMatrixAt(i, m4);
  }
  city.count = 0; city.visible = false; scene.add(city);

  // ---- 宇宙と地球 ----
  const { tex: earthTex, blobs } = earthTexture();
  const lightCanvas = cityLights(blobs, 0);
  const lightTex = new THREE.CanvasTexture(lightCanvas); lightTex.colorSpace = THREE.SRGBColorSpace;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(48, 64, 48),
    new THREE.MeshStandardMaterial({ map: earthTex, emissive: 0xffffff, emissiveMap: lightTex, emissiveIntensity: 1.6, roughness: 1, fog: false }));
  earth.position.set(0, -32, -120); earth.rotation.set(0.35, 0, 0.1);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(49.5, 64, 48),
    new THREE.MeshBasicMaterial({ color: 0x3d7bff, transparent: true, opacity: 0.12, side: THREE.BackSide, fog: false }));
  atmo.position.copy(earth.position);
  const starGeo = new THREE.BufferGeometry(), sp = new Float32Array(3000 * 3);
  for (let i = 0; i < 3000; i++) { v.randomDirection().multiplyScalar(500); sp.set([v.x, Math.abs(v.y) * 0.8 - 30, v.z], i * 3); }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false, fog: false }));
  const space = new THREE.Group(); space.add(earth, atmo, stars); space.visible = false; scene.add(space);
  let earthPulse = 0;

  // ---- 毎フレーム ----
  let crowdTarget = 0, crowdShown = 0, cityTarget = 0, cityShown = 0, crowdFlash = 0;
  stage.onFrame((dt, t) => {
    let n = 0;
    for (let i = 0; i < fig.length; i++) {
      const f = fig[i];
      if (!f.visible && f.leave <= 0) continue;
      const away = f.leave;
      const yaw = f.face + Math.PI * Math.min(1, away * 2);
      const back = Math.max(0, away * 2 - 1);
      const k = 1 - back;
      const bob = Math.sin(t * 1.3 + f.phase) * 0.01;
      const px = f.x * (1 + back * 0.25), pz = f.z * (1 + back * 0.25);
      m4.compose(v.set(px, f.y + 0.4 + f.rise * 0.18 + bob, pz), q.setFromEuler(e.set(0, yaw, 0)), sc.set(k, k, k));
      bodies.setMatrixAt(n, m4);
      m4.compose(v.set(px, f.y + 0.85 + f.rise * 0.2 + bob, pz), q.setFromEuler(e.set(f.tilt * 0.4, yaw, f.tilt * 0.5)), sc.set(0.85 * k, 1.15 * k, 0.9 * k));
      masks.setMatrixAt(n, m4);
      n++;
    }
    bodies.count = masks.count = n;
    // 目の光がじわりと脈打ち、ときどき一斉にまたたく
    maskMat.emissiveIntensity = 1.8 + Math.sin(t * 2.1) * 0.5 + (Math.sin(t * 13.7) > 0.985 ? -1.6 : 0);
    bodies.instanceMatrix.needsUpdate = masks.instanceMatrix.needsUpdate = true;

    crowdShown += (crowdTarget - crowdShown) * Math.min(1, dt * 3);
    crowdGeo.setDrawRange(0, Math.round(crowdShown));
    crowdFlash = Math.max(0, crowdFlash - dt * 2);
    crowdMat.size = 0.11 + crowdFlash * 0.2;
    cityShown += (cityTarget - cityShown) * Math.min(1, dt * 3);
    city.count = Math.round(cityShown);
    cityMat.emissiveIntensity = 1.2 + crowdFlash * 1.5;
    if (space.visible) {
      earth.rotation.y += dt * 0.01;
      earthPulse = Math.max(0, earthPulse - dt);
      earth.material.emissiveIntensity = 1.6 + Math.sin(t * 6) * earthPulse * 0.8 + crowdFlash * 2;
    }
  });

  let tier = 'room', believers = 4;

  function figuresFor(n, tr) {
    if (tr === 'room') return Math.min(n, 100);
    if (tr === 'theater') return Math.round(100 + 200 * logProgress(n, 100, 10_000));
    return 0;
  }
  function setFigureCount(c) {
    figureCount = c;
    fig.forEach((f, i) => { f.visible = i < c; if (f.visible) f.leave = 0; });
  }
  function applyCounts(n) {
    setFigureCount(figuresFor(n, tier));
    crowdTarget = tier === 'stadium' ? 3000 + 27000 * logProgress(n, 10_000, 1_000_000) : 0;
    cityTarget = tier === 'city' ? 150 + (BUILDINGS - 150) * logProgress(n, 1_000_000, 100_000_000) : 0;
    if (tier === 'earth') {
      const c = Math.round(400 + 26000 * logProgress(n, 100_000_000, 8_200_000_000));
      lightTex.image = cityLights(blobs, c); lightTex.needsUpdate = true;
    }
  }

  async function setTier(next) {
    if (next === tier) return;
    const from = TIERS.indexOf(tier), to = TIERS.indexOf(next);
    tier = next;
    const walled = to <= 1;
    const pulled = stage.home.pos.clone().add(new THREE.Vector3(0, 1.4, 2.2));
    const camOut = stage.moveCamera(pulled, stage.home.target, 0.6, ease.out);
    // 壁と天井：スタジアム以上では沈んで消える
    const w0 = stage.walls[0].position.y, w1 = walled ? 3 : -3.2;
    const wallAnim = stage.tween(0.9, (k) => {
      for (const w of stage.walls) { w.position.y = w0 + (w1 - w0) * k; w.visible = w.position.y > -3.1; }
      stage.ceiling.visible = walled;
    });
    stage.floor.visible = to <= 2;
    stage.table.children[2].visible = to <= 2;
    crowd.visible = to === 2; crowdMat.opacity = to === 2 ? 1 : 0; stadiumLights.visible = to === 2;
    city.visible = to === 3;
    space.visible = to === 4;
    stage.scene.fog.near = to >= 2 ? 30 : 7; stage.scene.fog.far = to >= 2 ? 400 : 30;
    stage.ambient.intensity = to >= 2 ? 0.55 : 0.35;
    if (to >= 2 && from < 2) { crowdShown = 0; cityShown = 0; }
    applyCounts(believers);
    await Promise.all([camOut, wallAnim]);
    await stage.moveCamera(stage.home.pos, stage.home.target, 0.6, ease.inOut);
  }

  return {
    get tier() { return tier; },
    async setBelievers(n, { animate = true } = {}) {
      believers = n;
      const next = tierFor(Math.max(n, 1));
      if (next !== tier) {
        if (animate) await setTier(next);
        else { await Promise.race([setTier(next), Promise.resolve()]); }
      } else applyCounts(n);
    },
    cheer() {
      crowdFlash = 1;
      for (const f of fig) if (f.visible) { f.tiltDir = Math.random() < 0.5 ? -1 : 1; }
      return stage.tween(0.6, (k) => {
        const s = Math.sin(Math.PI * k);
        for (const f of fig) if (f.visible) { f.rise = s; f.tilt = s * f.tiltDir; }
      });
    },
    leave(fraction) {
      if (tier === 'room' || tier === 'theater') {
        const k = Math.max(1, Math.round(figureCount * fraction));
        const leaving = fig.slice(Math.max(0, figureCount - k), figureCount);
        return stage.tween(0.8, (t) => { for (const f of leaving) { f.leave = t; } }, ease.linear);
      }
      crowdTarget *= 1 - fraction; cityTarget *= 1 - fraction;
      return stage.wait(0.6);
    },
    pulseEarth(seconds = 3) { earthPulse = seconds; },
    flash() { crowdFlash = 1.5; },
    space, earth,
  };
}
