import { BASE_POPULATION, firebaseConfig, appCheckSiteKey } from './config.js';

const TIMEOUT = 3000;
const withTimeout = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT))]);

// backend が null(設定未入力)なら外へは一切つながない。
export function createCounter({ backend, storage }) {
  const popOf = (v) => BASE_POPULATION - v;
  return {
    async fetchPopulation() {
      if (backend) {
        try {
          const vanished = await withTimeout(backend.getCount());
          storage.saveLastVanished(vanished);
          return { population: popOf(vanished), vanished, live: true };
        } catch {}
      }
      const vanished = storage.loadLastVanished();
      return { population: popOf(vanished), vanished, live: false };
    },
    async reportVanished() {
      if (backend) {
        try {
          const vanished = await withTimeout(backend.increment());
          storage.saveLastVanished(vanished);
          return { vanished, live: true };
        } catch {}
      }
      const vanished = storage.loadLastVanished() + 1;
      storage.saveLastVanished(vanished);
      return { vanished, live: false };
    },
  };
}

export function isConfigured(cfg = firebaseConfig) {
  return !!cfg.apiKey && cfg.apiKey !== 'YOUR_API_KEY' && !!cfg.projectId;
}

const V = '11.0.2';
const CDN = `https://www.gstatic.com/firebasejs/${V}`;

// 本番用。Firebase SDK は設定済みのときだけ読み込む。
export function firebaseBackend(cfg = firebaseConfig) {
  if (!isConfigured(cfg)) return null;
  let ready;
  const init = () => ready ??= (async () => {
    const [{ initializeApp }, auth, fs] = await Promise.all([
      import(`${CDN}/firebase-app.js`), import(`${CDN}/firebase-auth.js`), import(`${CDN}/firebase-firestore.js`),
    ]);
    const app = initializeApp(cfg);
    if (appCheckSiteKey) {
      const ac = await import(`${CDN}/firebase-app-check.js`);
      ac.initializeAppCheck(app, { provider: new ac.ReCaptchaV3Provider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
    }
    const a = auth.getAuth(app);
    const db = fs.getFirestore(app);
    return { a, auth, db, fs };
  })();
  return {
    async getCount() {
      const { db, fs } = await init();
      const snap = await fs.getDoc(fs.doc(db, 'meta/vanished'));
      return snap.data()?.count ?? 0;
    },
    async increment() {
      const { a, auth, db, fs } = await init();
      const user = a.currentUser ?? (await auth.signInAnonymously(a)).user;
      const b = fs.writeBatch(db);
      b.update(fs.doc(db, 'meta/vanished'), { count: fs.increment(1) });
      b.set(fs.doc(db, `players/${user.uid}`), { lastAt: fs.serverTimestamp() });
      await b.commit();
      const snap = await fs.getDoc(fs.doc(db, 'meta/vanished'));
      return snap.data()?.count ?? 0;
    },
  };
}
