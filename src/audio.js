// すべて WebAudio で合成する(外部の音声ファイルなし)。

// オリジナルの子守歌風の旋律(イ短調・3拍子)。[音, 拍, 低音]
export const MUSIC_BOX_MELODY = [
  ['E5', 1, 'A3'], ['A5', 1], ['C6', 1],
  ['B5', 2, 'E3'], ['A5', 1],
  ['G#5', 1, 'E3'], ['A5', 1], ['B5', 1],
  ['E5', 3, 'A3'],
  ['F5', 1, 'D3'], ['A5', 1], ['D6', 1],
  ['C6', 2, 'A3'], ['B5', 1],
  ['A5', 1, 'D3'], ['G#5', 1], ['F5', 1],
  ['E5', 3, 'E3'],
  ['C6', 1, 'A3'], ['B5', 1], ['A5', 1],
  ['D6', 2, 'F3'], ['C6', 1],
  ['B5', 1, 'E3'], ['A5', 1], ['G#5', 1],
  ['A5', 3, 'A3'],
  [null, 3],
];
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteFreq(name) {
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  const midi = 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] ? 1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}
export function createAudio(storage) {
  let ctx = null, master = null;
  let muted = storage?.get('cm.muted') === '1';

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
    return ctx;
  }
  function noiseBuffer(sec = 1) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function env(node, t, a, peak, r) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + r);
  }
  function noise({ t = ctx.currentTime, dur = 0.2, freq = 1000, q = 1, type = 'bandpass', peak = 0.3, a = 0.005 }) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuffer(dur + 0.1);
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t, a, peak, dur);
    s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + a + dur + 0.05);
    return { f, g };
  }
  function tone({ t = ctx.currentTime, freq = 60, dur = 0.3, type = 'sine', peak = 0.5, a = 0.01, slide = null }) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + a + dur);
    const g = ctx.createGain(); env(g, t, a, peak, dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + a + dur + 0.05);
  }

  const sounds = {
    flip() { noise({ dur: 0.08, freq: 3200, q: 0.8, peak: 0.12 }); },
    cheer() {
      const t = ctx.currentTime;
      // ざわめき：帯域を変えたノイズを重ねてふくらませる
      for (const [fr, p] of [[500, 0.22], [900, 0.18], [1600, 0.1]]) noise({ t, dur: 1.1, freq: fr, q: 0.6, peak: p, a: 0.25 });
      tone({ t, freq: 220, dur: 0.6, type: 'triangle', peak: 0.06, a: 0.05, slide: 330 });
    },
    leave() {
      const t = ctx.currentTime;
      noise({ t, dur: 0.5, freq: 300, q: 0.7, peak: 0.12, a: 0.05 });
      for (let i = 0; i < 6; i++) tone({ t: t + 0.12 + i * 0.13, freq: 90, dur: 0.07, peak: 0.25, slide: 55 }); // 足音
      tone({ t, freq: 140, dur: 0.5, type: 'sawtooth', peak: 0.04, slide: 70 });
    },
    heartbeat() {
      const t = ctx.currentTime;
      for (let i = 0; i < 5; i++) {
        tone({ t: t + i * 0.85, freq: 58, dur: 0.12, peak: 0.7, slide: 40 });
        tone({ t: t + i * 0.85 + 0.2, freq: 52, dur: 0.14, peak: 0.5, slide: 38 });
      }
    },
    clear() {
      const t = ctx.currentTime;
      for (const f of [261.6, 329.6, 392, 523.3, 659.3]) tone({ t, freq: f, dur: 3.5, type: 'triangle', peak: 0.08, a: 1.2 });
      for (const [fr, p] of [[500, 0.25], [1000, 0.2], [2000, 0.12]]) noise({ t: t + 0.6, dur: 3, freq: fr, q: 0.5, peak: p, a: 0.8 });
    },
    blackout() {
      const t = ctx.currentTime;
      tone({ t, freq: 70, dur: 2.2, type: 'sawtooth', peak: 0.12, slide: 25 });
      noise({ t, dur: 0.6, freq: 120, q: 0.5, type: 'lowpass', peak: 0.5 });
    },
  };

  // ---- 不気味なオルゴール ----
  let box = null;
  function impulse(sec = 2.8) {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    return b;
  }
  // オルゴールの歯：基音＋金属っぽい倍音、鋭い立ち上がりと長い減衰
  function plink(freq, t, vel = 1) {
    const cents = (Math.random() - 0.5) * 22; // ねじが緩んだような音程の揺れ
    const f = freq * Math.pow(2, cents / 1200);
    for (const [mul, amp, dec] of [[1, 0.5, 1.9], [3.01, 0.12, 0.7], [5.93, 0.05, 0.25]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp * vel, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g).connect(box.in); o.start(t); o.stop(t + dec + 0.05);
    }
  }
  function startBgm() {
    if (box || !ensure()) return;
    const out = ctx.createGain(); out.gain.value = 0; out.connect(master);
    out.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 2);
    const inp = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    const dry = ctx.createGain(); dry.gain.value = 0.55;
    const verb = ctx.createConvolver(); verb.buffer = impulse();
    const wet = ctx.createGain(); wet.gain.value = 0.6;
    inp.connect(lp); lp.connect(dry).connect(out); lp.connect(verb); verb.connect(wet).connect(out);
    box = { in: inp, out, next: ctx.currentTime + 0.3, i: 0, loop: 0 };
    const tick = () => schedule(1.2);
    if (typeof window.setInterval === 'function') box.timer = window.setInterval(tick, 250);
    tick();
  }
  function schedule(ahead) {
    if (!box) return;
    const until = ctx.currentTime + ahead;
    while (box.next < until) {
      const [note, beats, bass] = MUSIC_BOX_MELODY[box.i];
      // 回るたびに少しずつ遅くなり、ぜんまいが切れかけたように揺れる
      const beat = (0.46 + box.loop * 0.015) * (1 + (Math.random() - 0.5) * 0.06);
      if (note) plink(noteFreq(note), box.next, 0.9 + Math.random() * 0.2);
      if (bass) plink(noteFreq(bass), box.next + 0.01, 0.45);
      box.next += beats * beat;
      box.i = (box.i + 1) % MUSIC_BOX_MELODY.length;
      if (box.i === 0) { box.loop = (box.loop + 1) % 6; box.next += 1.2; }
    }
  }

  return {
    unlock() { if (ensure() && ctx.state !== 'running') ctx.resume(); },
    bgm(on) { if (on) startBgm(); },
    _tick(sec) { if (ctx) { const t = ctx.currentTime; for (let x = 0; x <= sec; x += 0.25) { ctx.currentTime = t + x; schedule(1.2); } } },
    play(name) { if (!ensure() || muted) return; try { sounds[name]?.(); } catch {} },
    get muted() { return muted; },
    setMuted(m) {
      muted = m; storage?.set('cm.muted', m ? '1' : '0');
      if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
    },
  };
}

export function mountMuteButton(ui, audio) {
  const b = document.createElement('button');
  b.className = 'mute interactive'; b.setAttribute('aria-label', '音のオン・オフ');
  const draw = () => { b.textContent = audio.muted ? '🔇' : '🔊'; };
  b.addEventListener('click', () => { audio.unlock(); audio.setMuted(!audio.muted); draw(); });
  draw(); ui.appendChild(b);
}
