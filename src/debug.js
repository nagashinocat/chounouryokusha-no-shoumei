// テスト用の ?debug=rig / ?debug=miss は手元(localhost)でだけ効く。
const LOCAL = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
export function debugMode(params, hostname) {
  if (!LOCAL.has(hostname)) return null;
  const d = params.get('debug');
  return d === 'rig' || d === 'miss' || d === 'fatemiss' ? d : null;
}

// 手元(localhost)で動かすときは本物の共有カウンターを使わない(テストで世界人口を減らさない)
export function useSharedCounter(hostname) {
  return !LOCAL.has(hostname);
}

// 確認用：?power=true|half で挑戦者の能力を決め打ち(手元でだけ)
export function debugPower(params, hostname) {
  if (!LOCAL.has(hostname)) return undefined;
  const p = params.get('power');
  return p === 'true' || p === 'half' ? p : undefined;
}
