// すべて WebAudio で合成する(外部の音声ファイルなし)。
export function createAudio(storage) {
  let ctx = null, master = null, bgmNodes = null;
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

  function startBgm() {
    if (bgmNodes || !ensure()) return;
    const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
    g.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 3);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.connect(g);
    const oscs = [55, 55.4, 82.4, 110.2].map((f, i) => {
      const o = ctx.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'sine'; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = i < 2 ? 0.25 : 0.18; o.connect(og).connect(lp); o.start(); return o;
    });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 140; lfo.connect(lg).connect(lp.frequency); lfo.start();
    bgmNodes = { g, oscs, lfo };
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    bgm(on) { if (on) startBgm(); },
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
