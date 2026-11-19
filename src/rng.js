// 偏りのない 0..n-1。上の端数は捨てて引き直す(棄却法)。
export function randomIndex(n, source = globalThis.crypto) {
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    source.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}
