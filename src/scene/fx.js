import * as THREE from 'three';
import { ease } from './stage.js';

export function createFx(stage, cards, audience) {
  const { spot, cone, ambient, monGlow, home } = stage;
  const base = { spotAngle: spot.angle, spotI: spot.intensity, amb: ambient.intensity, glow: monGlow.intensity };

  return {
    // 運命の選択：照明が落ち、4枚だけが照らされ、カメラが回り込む
    async fateIntro() {
      const c = cards.centerOf();
      const a0 = ambient.intensity;
      await stage.tween(0.8, (k) => {
        ambient.intensity = a0 * (1 - k * 0.85);
        spot.angle = base.spotAngle * (1 - k * 0.45);
        spot.intensity = base.spotI * (1 + k * 0.6);
        cone.material.opacity = 0.035 + k * 0.05;
        monGlow.intensity = base.glow * (1 + k * 3);
      });
      audience.pulseEarth?.(6);
      const r = 1.55, h = 1.35, target = c.clone().add(new THREE.Vector3(0, 0.05, 0));
      const start = Math.atan2(home.pos.x - c.x, home.pos.z - c.z);
      const p0 = stage.camera.position.clone(), t0 = stage.lookTarget.clone();
      await stage.tween(2.6, (k) => {
        const a = start + k * Math.PI * 2;
        const orbit = new THREE.Vector3(c.x + Math.sin(a) * r, c.y + h, c.z + Math.cos(a) * r);
        const m = Math.min(1, k * 4);
        stage.camera.position.lerpVectors(p0, orbit, m);
        stage.lookTarget.lerpVectors(t0, target, m);
      }, ease.inOut);
      await stage.moveCamera(new THREE.Vector3(0, 1.9, 1.05), new THREE.Vector3(0, 0.9, -0.5), 0.8);
    },
    async fateEnd() {
      await Promise.all([
        stage.tween(0.6, (k) => {
          ambient.intensity = base.amb * k + ambient.intensity * (1 - k);
          spot.angle = base.spotAngle; spot.intensity = base.spotI;
          cone.material.opacity = 0.035; monGlow.intensity = base.glow;
        }),
        stage.moveCamera(home.pos, home.target, 0.6),
      ]);
    },
    // クリア：地球中が灯る
    async clear() {
      audience.flash?.();
      if (audience.space) audience.space.visible = true;
      await stage.moveCamera(home.pos.clone().add(new THREE.Vector3(0, 3, 4)), new THREE.Vector3(0, -5, -100), 2.4, ease.inOut);
      await stage.tween(1.6, (k) => {
        audience.earth.material.emissiveIntensity = 1.6 + k * 6;
        ambient.intensity = base.amb + k * 1.2;
      });
    },
    async resetAfterClear() {
      ambient.intensity = base.amb;
      await stage.moveCamera(home.pos, home.target, 0.01);
    },
  };
}
