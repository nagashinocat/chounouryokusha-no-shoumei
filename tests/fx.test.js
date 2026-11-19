import { it, expect } from 'vitest';
import * as THREE from 'three';
import { createFx } from '../src/scene/fx.js';

function fakeStage() {
  const stage = {
    spot: { angle: 0.4, intensity: 60 }, cone: { material: { opacity: 0.035 } }, ambient: { intensity: 0.35 }, monGlow: { intensity: 0.7 },
    home: { pos: new THREE.Vector3(0, 2, 1), target: new THREE.Vector3(0, 1, -1) },
    camera: { position: new THREE.Vector3(0, 2, 1) }, lookTarget: new THREE.Vector3(),
    tween: async (d, fn) => fn(1), moveCamera: async () => {},
  };
  return stage;
}
it('after a clear, fate lighting is fully restored for the next game', async () => {
  const s = fakeStage();
  const audience = { pulseEarth() {}, flash() {}, space: { visible: false }, earth: { material: { emissiveIntensity: 1 } } };
  const fx = createFx(s, { centerOf: () => new THREE.Vector3() }, audience);
  await fx.fateIntro();
  await fx.clear();
  await fx.resetAfterClear();
  expect(s.spot.angle).toBe(0.4);
  expect(s.spot.intensity).toBe(60);
  expect(s.cone.material.opacity).toBe(0.035);
  expect(s.monGlow.intensity).toBe(0.7);
  expect(s.ambient.intensity).toBe(0.35);
});
