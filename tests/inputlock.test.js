import { it, expect } from 'vitest';
import { createInputLock } from '../src/scene/inputlock.js';
it('only one acquire until released', () => {
  const l = createInputLock();
  expect(l.tryAcquire()).toBe(true);
  expect(l.tryAcquire()).toBe(false);
  l.release();
  expect(l.tryAcquire()).toBe(true);
});
