export const BASE_POPULATION = 8_200_000_000;
export const START_BELIEVERS = 4;
export const MAX_MISSES = 16; // 16回外したらゲームオーバー
export const SYMBOLS = ['circle', 'plus', 'wave', 'star'];

// Firebase の設定値。README の手順で書き換える。プレースホルダのままなら共有カウンターは使わない。
// ブラウザに公開される前提の値(秘密の鍵ではない)。守りは Firestore のルールと App Check で行う。
export const firebaseConfig = {
  apiKey: 'AIzaSyCdCFObOlxjxbJ69ehMMkWhjYeQSA8hr6c',
  authDomain: 'chounouryokusha-no-shoum-2de1b.firebaseapp.com',
  projectId: 'chounouryokusha-no-shoum-2de1b',
  storageBucket: 'chounouryokusha-no-shoum-2de1b.firebasestorage.app',
  messagingSenderId: '789492957231',
  appId: '1:789492957231:web:7b48e80d433cecfd3986da',
};
export const appCheckSiteKey = '';
export const GAME_TITLE = '超能力者の証明';
export const GAME_URL = 'https://nagashinocat.github.io/chounouryokusha-no-shoumei/';
