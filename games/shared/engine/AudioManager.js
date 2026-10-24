/* AudioManager — lightweight synthesized audio (no sample files, nothing copyrighted).
 * The AudioContext is created only after a user gesture via unlock(). */
export class AudioManager {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.running = false;
    this._off = settings.onChange((k) => { if (k === 'volume' || k === 'muted') this._applyVolume(); });
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      this._build();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this._applyVolume();
  }

  _noise() {
    const c = this.ctx, len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _build() {
    const c = this.ctx;
    this.master = c.createGain(); this.master.connect(c.destination);
    this.noiseBuf = this._noise();

    // engine: two detuned oscillators through a low-pass
    this.engGain = c.createGain(); this.engGain.gain.value = 0;
    this.engFilter = c.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 500;
    this.osc1 = c.createOscillator(); this.osc1.type = 'sawtooth';
    this.osc2 = c.createOscillator(); this.osc2.type = 'square';
    this.osc1.connect(this.engFilter); this.osc2.connect(this.engFilter);
    this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
    this.osc1.start(); this.osc2.start();

    // wind
    this.windGain = c.createGain(); this.windGain.gain.value = 0;
    this.windFilter = c.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 600; this.windFilter.Q.value = 0.5;
    this.windSrc = c.createBufferSource(); this.windSrc.buffer = this.noiseBuf; this.windSrc.loop = true;
    this.windSrc.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.master);
    this.windSrc.start();

    // tires / rough surface
    this.tireGain = c.createGain(); this.tireGain.gain.value = 0;
    this.tireFilter = c.createBiquadFilter(); this.tireFilter.type = 'bandpass'; this.tireFilter.frequency.value = 1100; this.tireFilter.Q.value = 1.2;
    this.tireSrc = c.createBufferSource(); this.tireSrc.buffer = this.noiseBuf; this.tireSrc.loop = true;
    this.tireSrc.connect(this.tireFilter); this.tireFilter.connect(this.tireGain); this.tireGain.connect(this.master);
    this.tireSrc.start();
  }

  _applyVolume() {
    if (!this.ctx) return;
    const v = this.settings.get('muted') ? 0 : this.settings.get('volume');
    this.master.gain.setTargetAtTime(v * 0.9, this.ctx.currentTime, 0.05);
  }

  setRunning(on) {
    this.running = on;
    if (!this.ctx) return;
    if (!on) {
      const t = this.ctx.currentTime;
      this.engGain.gain.setTargetAtTime(0, t, 0.08);
      this.windGain.gain.setTargetAtTime(0, t, 0.08);
      this.tireGain.gain.setTargetAtTime(0, t, 0.08);
    }
  }

  /** speed01 0..1, slip01 0..1 (lateral movement), rough01 0..1 (off-road) */
  update(speed01, slip01, rough01) {
    if (!this.ctx || !this.running) return;
    const t = this.ctx.currentTime;
    const f = 48 + speed01 * 120;
    this.osc1.frequency.setTargetAtTime(f, t, 0.06);
    this.osc2.frequency.setTargetAtTime(f * 0.5, t, 0.06);
    this.engFilter.frequency.setTargetAtTime(260 + speed01 * 900, t, 0.08);
    this.engGain.gain.setTargetAtTime(0.05 + speed01 * 0.07, t, 0.08);
    this.windFilter.frequency.setTargetAtTime(350 + speed01 * 1500, t, 0.1);
    this.windGain.gain.setTargetAtTime(speed01 * speed01 * 0.22, t, 0.1);
    this.tireGain.gain.setTargetAtTime(Math.min(0.2, slip01 * speed01 * 0.12 + rough01 * 0.14 * (0.3 + speed01)), t, 0.06);
  }

  _blip(freq, dur, type = 'sine', vol = 0.2, slideTo = null) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  click() { this._blip(660, 0.07, 'triangle', 0.12, 880); }
  nearMiss(level = 1) { this._blip(520 + level * 120, 0.16, 'sine', 0.2, 1040 + level * 200); }
  crash() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(120, t + 0.7);
    const g = c.createGain(); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.85);
    this._blip(90, 0.5, 'sawtooth', 0.3, 40);
  }

  destroy() {
    this._off && this._off();
    if (this.ctx) { try { this.ctx.close(); } catch (e) { /* ignore */ } this.ctx = null; }
  }
}
