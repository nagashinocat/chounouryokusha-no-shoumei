// localStorage が使えないときは、その場の記憶だけで動く。
export function createStorage(ls = globalThis.localStorage) {
  const mem = new Map();
  const get = (k) => { try { const v = ls?.getItem(k); if (v != null) return v; } catch {} return mem.get(k) ?? null; };
  const set = (k, v) => { mem.set(k, String(v)); try { ls?.setItem(k, String(v)); } catch {} };
  const num = (k) => Number(get(k)) || 0;
  return {
    loadBest: () => num('cm.best'),
    saveBest: (n) => { if (n > num('cm.best')) set('cm.best', n); },
    nextChallengerNumber: () => { const n = num('cm.challenger') + 1; set('cm.challenger', n); return n; },
    isFirstVisit: () => num('cm.challenger') <= 1,
    loadLastVanished: () => num('cm.vanished'),
    saveLastVanished: (n) => set('cm.vanished', n),
    get: (k) => get(k), set: (k, v) => set(k, v),
  };
}
