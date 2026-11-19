// テスト用の ?debug=rig / ?debug=miss は手元(localhost)でだけ効く。
const LOCAL = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
export function debugMode(params, hostname) {
  if (!LOCAL.has(hostname)) return null;
  const d = params.get('debug');
  return d === 'rig' || d === 'miss' ? d : null;
}
