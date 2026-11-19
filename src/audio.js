// すべて WebAudio で合成する(外部の音声ファイルなし)。

// 持ち主がドレミで書いた旋律(ボイスメモの鼻歌をもとにしたもの)。
// シ ミ レ♯ | シ レ ド♯ | ラ ド シ | ソ ラ シ | ラ ソ ミ | ミ ファ♯ ソ | ファ♯ ミ レ♯ | ド♯ レ♯ ミ
// 3音ずつ「8分・8分・4分」のまとまりで、4小節を2回くり返して8小節のループにする。
// 歌った高さ(シ3〜ミ4)を2オクターブ上げてオルゴールの音域にする。
const SOLFEGE = [59, 64, 63, 59, 62, 61, 57, 60, 59, 55, 57, 59, 57, 55, 52, 52, 54, 55, 54, 52, 51, 49, 51, 52];
const SUNG = [...SOLFEGE, ...SOLFEGE].map((m, i) => [Math.floor(i / 3) * 4 + (i % 3), m]);
export const LOOP_STEPS = 64;
export const STEP_SEC = 60 / 115 / 2;
export const MELODY = SUNG.map(([st, m], i) => {
  return [st, m + 24, i % 3 === 2 ? 2 : 1];
});
const melodyAt = new Map(MELODY.map((e) => [e[0], e]));
const midiFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 小節ごとの和音：ホ短調まわりの和音から、その小節の旋律と半音でぶつかりにくいものを選ぶ
export const CHORD_CANDIDATES = [
  { name: 'Em', root: 4, tones: [4, 7, 11] }, { name: 'Am', root: 9, tones: [9, 0, 4] },
  { name: 'A', root: 9, tones: [9, 1, 4] }, { name: 'B', root: 11, tones: [11, 3, 6] },
  { name: 'C', root: 0, tones: [0, 4, 7] }, { name: 'D', root: 2, tones: [2, 6, 9] },
  { name: 'G', root: 7, tones: [7, 11, 2] },
];
export const CHORDS = Array.from({ length: 8 }, (_, bar) => {
  const notes = MELODY.filter(([st]) => st >= bar * 8 && st < bar * 8 + 8);
  let best = CHORD_CANDIDATES[0], bestScore = -Infinity;
  for (const c of CHORD_CANDIDATES) {
    // 旋律と半音でぶつかる音は大きく減点(聴き心地を優先)
    const sc = notes.reduce((t, [st, m, len]) => {
      if (c.tones.includes(m % 12)) return t + len + (st % 8 === 0 ? 1 : 0);
      if (c.tones.some((x) => [1, 11].includes(((m - x) % 12 + 12) % 12))) return t - 10 * len;
      return t;
    }, 0);
    if (sc > bestScore) { best = c; bestScore = sc; }
  }
  return best;
});
const inRange = (pc, lo) => lo + ((pc - lo) % 12 + 12) % 12; // lo 以上で最初に出てくるその音

// 信者が増えると楽器が増える。1つ目は必ずバスドラ「ダン、ダダん」
export function layersForTier(tier) { return ['room', 'theater', 'stadium', 'city', 'earth'].indexOf(tier); }
export function eventsAt(step, layers) {
  const s = ((step % LOOP_STEPS) + LOOP_STEPS) % LOOP_STEPS, ev = [];
  const chord = CHORDS[Math.floor(s / 8)];
  const mel = melodyAt.get(s);
  if (mel) ev.push({ inst: 'box', midi: mel[1], len: mel[2] });
  if (layers >= 1 && [0, 4, 5].includes(s % 8)) ev.push({ inst: 'kick' });
  if (layers >= 2 && s % 4 === 0) { const r = inRange(chord.root, 40); ev.push({ inst: 'bass', midi: r, notes: [r], len: 4 }); }
  if (layers >= 3 && s % 8 === 0) ev.push({ inst: 'pad', notes: chord.tones.map((pc) => inRange(pc, 52)), len: 8 });
  if (layers >= 4 && s % 8 === 0) {
    const r = inRange(chord.root, 57);
    ev.push({ inst: 'choir', notes: [r, inRange(chord.tones[2], r)], len: 8 });
  }
  return ev;
}

// 0.5秒の無音WAV(8kHz・8bit・モノラル)
const SILENT_WAV = (() => {
  const n = 4000, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
  const w = (o, s) => [...s].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
  let s = ''; for (const x of b) s += String.fromCharCode(x);
  return 'data:audio/wav;base64,' + btoa(s);
})();

export function createAudio(storage, nav = globalThis.navigator, { context = null } = {}) {
  let ctx = null, master = null, probeAn = null, keepAlive = null;
  let muted = storage?.get('cm.muted') === '1';

  function ensure() {
    if (ctx) return ctx;
    if (!context) {
      // iOS は通知やほかのアプリの音で WebAudio を「中断」する。戻れるときは自分で再開する
      const AC0 = window.AudioContext || window.webkitAudioContext;
      if (AC0) {
        ctx = new AC0();
        master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
        const revive = () => { if (ctx.state !== 'running' && (globalThis.document?.visibilityState ?? 'visible') === 'visible') { try { ctx.resume()?.catch?.(() => {}); } catch {} } };
        ctx.onstatechange = revive;
        globalThis.document?.addEventListener?.('visibilitychange', revive);
        return ctx;
      }
    }
    if (context) { ctx = context; master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination); return ctx; }
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
  function plink(freq, t, vel, dest) {
    const cents = (Math.random() - 0.5) * 8; // ごくわずかな音程の揺れ(気持ち悪くならない程度)
    const f = freq * Math.pow(2, cents / 1200);
    for (const [mul, amp, dec] of [[1, 0.5, 1.9], [3.01, 0.12, 0.7], [5.93, 0.05, 0.25]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp * vel, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g).connect(dest); o.start(t); o.stop(t + dec + 0.05);
    }
  }
  function kick(t, dest) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(dest); o.start(t); o.stop(t + 0.5);
    // スマホのスピーカーでも聞こえるよう、打った瞬間の「ドッ」を足す
    const c = ctx.createOscillator(); c.type = 'triangle';
    c.frequency.setValueAtTime(260, t); c.frequency.exponentialRampToValueAtTime(90, t + 0.05);
    const cg = ctx.createGain(); cg.gain.setValueAtTime(0.0001, t);
    cg.gain.exponentialRampToValueAtTime(0.35, t + 0.002); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    c.connect(cg).connect(dest); c.start(t); c.stop(t + 0.1);
  }
  function bass(freq, t, dur, dest) {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = freq * 1.003;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(dest);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  function pad(freq, t, dur, dest) {
    // 少しずつずらしたのこぎり波を重ね、暗く濁った弦の響きにする
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.05);
    lp.connect(g).connect(dest);
    for (const [mul, det] of [[1, -4], [1, 4]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq * mul; o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur * 1.1);
    }
  }
  function choir(freq, t, dur, dest) {
    // 「あー」の声の響き(ホルマント)を3つの帯域で作る
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.1, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.05);
    g.connect(dest);
    const src = [];
    for (const [mul, det] of [[1, -5], [1, 5]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq * mul; o.detune.value = det; src.push(o);
    }
    for (const [fr, q, amp] of [[800, 8, 1], [1150, 9, 0.6], [2900, 12, 0.25]]) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = q;
      const ag = ctx.createGain(); ag.gain.value = amp;
      for (const o of src) o.connect(bp);
      bp.connect(ag).connect(g);
    }
    for (const o of src) { o.start(t); o.stop(t + dur * 1.1); }
  }

  const LEVELS = { box: 0.55, kick: 0.9, bass: 0.6, pad: 0.7, choir: 0.6 };
  let layers = 0;
  function startBgm() {
    if (box || !ensure()) return;
    const out = ctx.createGain(); out.gain.value = 0; out.connect(master);
    out.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2);
    const verb = ctx.createConvolver(); verb.buffer = impulse();
    const wet = ctx.createGain(); wet.gain.value = 0.5; verb.connect(wet).connect(out);
    const bus = {};
    for (const [name, lv] of Object.entries(LEVELS)) {
      const g = ctx.createGain(); g.gain.value = name === 'box' ? lv : 0;
      g.connect(out);
      const send = ctx.createGain(); send.gain.value = name === 'kick' ? 0.15 : 0.7; g.connect(send).connect(verb);
      bus[name] = g;
    }
    box = { bus, next: ctx.currentTime + 0.3, step: 0 };
    applyLayers(true);
    const tick = () => schedule(1.2);
    if (typeof window.setInterval === 'function') box.timer = window.setInterval(tick, 250);
    tick();
  }
  function applyLayers(instant = false, at = null) {
    if (!box) return;
    ['kick', 'bass', 'pad', 'choir'].forEach((n, i) => {
      const target = layers > i ? LEVELS[n] : 0;
      const p = box.bus[n].gain;
      if (instant) p.value = target; else p.setTargetAtTime(target, at ?? ctx.currentTime, 0.8);
    });
  }
  function schedule(ahead) {
    if (!box) return;
    const until = ctx.currentTime + ahead;
    while (box.next < until) {
      const t = box.next;
      for (const e of eventsAt(box.step, layers)) {
        const dur = (e.len ?? 1) * STEP_SEC;
        if (e.inst === 'box') plink(midiFreq(e.midi), t, 0.85 + Math.random() * 0.3, box.bus.box);
        else if (e.inst === 'kick') kick(t, box.bus.kick);
        else if (e.inst === 'bass') bass(midiFreq(e.midi), t, dur * 0.9, box.bus.bass);
        else if (e.inst === 'pad') for (const m of e.notes) pad(midiFreq(m), t, dur, box.bus.pad);
        else if (e.inst === 'choir') for (const m of e.notes) choir(midiFreq(m), t, dur, box.bus.choir);
      }
      box.next += STEP_SEC;
      box.step = (box.step + 1) % LOOP_STEPS;
    }
  }

  return {
    // タップの処理の中で同期的に呼ぶこと(iOS は指を離したタップでしか音を許さない)
    unlock() {
      // iOS のマナーモードでも鳴るようにする(Safari 17 以降)
      try { if (nav?.audioSession && nav.audioSession.type !== 'playback') nav.audioSession.type = 'playback'; } catch {}
      // 無音の <audio> をくり返し流して、iOS が音声を止めにくくする(古い iOS ではマナーモード対策にもなる)
      if (!keepAlive && globalThis.document?.createElement) {
        try {
          keepAlive = document.createElement('audio');
          keepAlive.loop = true; keepAlive.setAttribute('playsinline', ''); keepAlive.src = SILENT_WAV;
          keepAlive.play()?.catch?.(() => { keepAlive = null; });
        } catch { keepAlive = null; }
      } else if (keepAlive?.paused) { keepAlive.play()?.catch?.(() => {}); }
      if (!ensure()) return;
      if (ctx.state !== 'running') {
        try { ctx.resume(); } catch {}
        // 無音を1つ鳴らして音声を起こす(古い iOS 向け)
        try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0); } catch {}
      }
    },
    bgm(on) { if (on) startBgm(); },
    setLayers(n, at = null) { layers = Math.max(0, Math.min(4, n)); applyLayers(false, at); },
    _schedule: (ahead) => schedule(ahead),
    _tick(sec) { if (ctx) { const t = ctx.currentTime; for (let x = 0; x <= sec; x += 0.25) { ctx.currentTime = t + x; schedule(1.2); } } },
    play(name) { if (!ensure() || muted) return; try { sounds[name]?.(); } catch {} },
    get muted() { return muted; },
    get state() { return ctx ? ctx.state : 'none'; },
    get bgmPlaying() { return !!box; },
    // 調査用：いま実際に出ている音の大きさ(RMS)と、BGMの予定の進み
    _probe() {
      if (!ctx) return {};
      if (!probeAn) { probeAn = ctx.createAnalyser(); probeAn.fftSize = 2048; master.connect(probeAn); }
      const d = new Float32Array(probeAn.fftSize); probeAn.getFloatTimeDomainData(d);
      let r = 0; for (const v of d) r += v * v;
      return { t: +ctx.currentTime.toFixed(2), next: box ? +box.next.toFixed(2) : null, rms: +Math.sqrt(r / d.length).toFixed(4), master: master.gain.value };
    },
    setMuted(m) {
      muted = m; storage?.set('cm.muted', m ? '1' : '0');
      if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
    },
  };
}

export function installUnlock(target, audio) {
  const fn = () => audio.unlock();
  for (const type of ['touchend', 'click', 'pointerdown', 'keydown']) target.addEventListener(type, fn, { capture: true, passive: true });
  // 別のアプリから戻ったとき(iOS の interrupted)も、次のタップで再開できるようにしておく
}

export function mountMuteButton(ui, audio) {
  const b = document.createElement('button');
  b.className = 'mute interactive'; b.setAttribute('aria-label', '音のオン・オフ');
  const draw = () => { b.textContent = audio.muted ? '🔇' : '🔊'; };
  b.addEventListener('click', () => { audio.unlock(); audio.setMuted(!audio.muted); draw(); });
  draw(); ui.appendChild(b);
}
