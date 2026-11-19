import * as THREE from 'three';
import { drawSymbol } from './symbols.js';
import { createInputLock } from './inputlock.js';
import { ease } from './stage.js';
export { createInputLock };

const W = 0.36, L = 0.5, T = 0.008, Y = 0.78 + T / 2 + 0.001;
export const CARD_POSITIONS = [[-0.23, -0.34], [0.23, -0.34], [-0.23, 0.24], [0.23, 0.24]];

function backTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 356;
  const g = c.getContext('2d');
  g.fillStyle = '#efe9dc'; g.fillRect(0, 0, 256, 356);
  g.fillStyle = '#5a0c12'; g.fillRect(12, 12, 232, 332);
  g.strokeStyle = '#c9a45a'; g.lineWidth = 3; g.strokeRect(22, 22, 212, 312);
  g.globalAlpha = 0.25;
  for (let i = -356; i < 356; i += 16) { g.beginPath(); g.moveTo(22 + i, 22); g.lineTo(22 + i + 312, 334); g.stroke(); }
  g.globalAlpha = 1;
  // 中央の目
  g.fillStyle = '#5a0c12'; g.beginPath(); g.ellipse(128, 178, 70, 40, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#e6c77a'; g.lineWidth = 5; g.beginPath(); g.ellipse(128, 178, 64, 34, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#e6c77a'; g.beginPath(); g.arc(128, 178, 18, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1a0306'; g.beginPath(); g.arc(128, 178, 8, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function frontCanvas(symbol) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 356;
  const g = c.getContext('2d');
  g.fillStyle = '#f3efe4'; g.fillRect(0, 0, 256, 356);
  g.strokeStyle = '#222'; g.lineWidth = 4; g.strokeRect(14, 14, 228, 328);
  drawSymbol(g, symbol, 128, 178, 160, '#141414', 13);
  return c;
}

export function createCards(stage) {
  const { scene, camera, renderer, home } = stage;
  const back = backTexture();
  const edge = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.8 });
  const backMat = new THREE.MeshStandardMaterial({ map: back, roughness: 0.55 });
  const cards = CARD_POSITIONS.map(([x, z], i) => {
    const tex = new THREE.CanvasTexture(frontCanvas('circle')); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0x000000 });
    // +y=裏面(伏せた状態で上)、-y=表
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(W, T, L), [edge, edge, backMat, front, edge, edge]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.position.set(x, Y, z); mesh.userData = { index: i, home: new THREE.Vector3(x, Y, z), front, tex };
    scene.add(mesh);
    return mesh;
  });

  const lock = createInputLock();
  let locked = true;
  const pickFns = new Set();
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (locked) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(cards, false)[0];
    if (!hit) return;
    if (!lock.tryAcquire()) return;
    locked = true;
    for (const fn of pickFns) fn(hit.object.userData.index);
  });

  function setFace(card, symbol) {
    const c = frontCanvas(symbol);
    card.userData.tex.image = c; card.userData.tex.needsUpdate = true;
    card.userData.front.emissive.setHex(0x000000); card.userData.front.color.setHex(0xffffff);
  }

  function flip(card, duration) {
    const h = card.userData.home;
    return stage.tween(duration, (k) => {
      card.rotation.z = Math.PI * k;
      card.position.y = h.y + Math.sin(Math.PI * k) * 0.14;
    });
  }

  return {
    meshes: cards,
    async deal(symbols) {
      // 全部伏せて中央から配る
      cards.forEach((c, i) => { setFace(c, symbols[i]); c.rotation.set(0, 0, 0); });
      await stage.tween(0.32, (k) => {
        cards.forEach((c) => {
          const h = c.userData.home;
          c.position.set(h.x * k, h.y + (1 - k) * 0.02, h.z * k + (1 - k) * -0.05);
          c.rotation.y = (1 - k) * 0.6;
        });
      }, ease.out);
    },
    onPick(fn) { pickFns.add(fn); return () => pickFns.delete(fn); },
    async reveal(index, hit, correctIndex = null, duration = 0.4) {
      const card = cards[index];
      await flip(card, duration);
      const f = card.userData.front;
      if (hit) f.emissive.setHex(0x6b4a00); else f.color.setHex(0xffb0b0);
      if (!hit && correctIndex != null && correctIndex !== index) {
        await flip(cards[correctIndex], duration * 0.6);
        cards[correctIndex].userData.front.emissive.setHex(0x3a2a00);
      }
    },
    focus(index, duration = 0.25) {
      const p = cards[index].userData.home;
      const pos = home.pos.clone().lerp(new THREE.Vector3(p.x, p.y + 1.0, p.z + 0.85), 0.35);
      const target = home.target.clone().lerp(p, 0.5);
      return stage.moveCamera(pos, target, duration);
    },
    unfocus(duration = 0.25) { return stage.moveCamera(home.pos, home.target, duration); },
    // 運命の選択用：4枚の上をカメラが回る
    centerOf() { return new THREE.Vector3(0, Y, -0.05); },
    lock() { locked = true; },
    unlock() { lock.release(); locked = false; },
    screenPos(i) {
      const v = cards[i].position.clone().project(camera);
      const r = renderer.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    },
  };
}
