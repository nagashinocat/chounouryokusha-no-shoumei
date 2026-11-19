import { it, expect } from 'vitest';
import { debugMode } from '../src/debug.js';
it('debug rig/miss only on localhost', () => {
  const p = (q) => new URLSearchParams(q);
  expect(debugMode(p('?debug=rig'), 'nagashinocat.github.io')).toBe(null);
  expect(debugMode(p('?debug=miss'), 'nagashinocat.github.io')).toBe(null);
  expect(debugMode(p('?debug=rig'), '127.0.0.1')).toBe('rig');
  expect(debugMode(p('?debug=miss'), 'localhost')).toBe('miss');
  expect(debugMode(p('?debug=x'), 'localhost')).toBe(null);
});
