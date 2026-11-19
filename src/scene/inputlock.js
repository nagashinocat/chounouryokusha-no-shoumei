export function createInputLock() {
  let held = false;
  return {
    tryAcquire() { if (held) return false; held = true; return true; },
    release() { held = false; },
  };
}
