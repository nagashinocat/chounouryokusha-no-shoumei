// 「認められた超能力者」(全クリした人)のニックネーム。
// 名前は誰でも入れられる前提なので、ここでは形だけ整える。ひどいものは持ち主が Firebase の画面で消す。
export const NAME_MAX = 12;
const URLISH = /(https?:|www\.|\.(com|net|org|jp|io|me|ly|gg)\b)/i;

export function sanitizeNickname(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[<>"'`\\/]/g, '').replace(/\s+/g, ' ').trim();
  if (!s || URLISH.test(s)) return null;
  s = [...s].slice(0, NAME_MAX).join('').trim();
  return s || null;
}

export function tickerText(names) {
  return names.length ? `認められた超能力者　${names.join('　／　')}` : 'まだ誰もいない';
}

const TIMEOUT = 3000;
const withTimeout = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT))]);

export function createHall({ backend, storage }) {
  const localMine = () => { const n = storage.get('cm.myName'); return n ? [n] : []; };
  return {
    async fetchNames() {
      if (backend) { try { return await withTimeout(backend.listClearers()); } catch {} }
      return localMine();
    },
    async submit(raw) {
      const name = sanitizeNickname(raw);
      if (!name) return { ok: false, reason: 'invalid' };
      storage.set('cm.myName', name);
      if (backend) {
        try { await withTimeout(backend.addClearer(name)); return { ok: true, name, live: true }; } catch {}
      }
      return { ok: true, name, live: false };
    },
  };
}

// テレビの提供クレジットのように、1画面8人ずつに分ける
export function creditPages(names, per = 8) {
  if (!names.length) return [['まだ誰もいない']];
  const pages = [];
  for (let i = 0; i < names.length; i += per) pages.push(names.slice(i, i + per));
  return pages;
}
