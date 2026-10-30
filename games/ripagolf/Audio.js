// Original synthesized impact, chip and lounge tones. Nothing plays before a gesture.
export class GolfAudio {
  constructor(store) {
    this.store = store;
    this.ctx = null;
    this.active = false;
    this.tick = 0;
  }
  unlock() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      try {
        this.ctx = new C();
        this.fx = this.ctx.createGain();
        this.music = this.ctx.createGain();
        this.fx.connect(this.ctx.destination);
        this.music.connect(this.ctx.destination);
      } catch {
        return;
      }
    }
    this.ctx.resume().catch(() => {});
    this.volume();
  }
  volume() {
    if (!this.ctx) return;
    const s = this.store.settings, t = this.ctx.currentTime;
    this.fx.gain.setTargetAtTime(s.muted ? 0 : s.effects, t, .03);
    this.music.gain.setTargetAtTime(s.muted ? 0 : s.music, t, .1);
  }
  tone(freq, duration = .1, level = .15, type = 'sine', music = false, delay = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + duration);
    o.connect(g);
    g.connect(music ? this.music : this.fx);
    o.start(t);
    o.stop(t + duration + .03);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  click() {
    this.tone(720, .07, .1, 'triangle');
  }
  lock() {
    this.tone(440, .1, .12, 'triangle');
    this.tone(880, .2, .09, 'sine', false, .07);
  }
  hit(putt = false) {
    this.tone(putt ? 280 : 95, putt ? .07 : .14, .22, 'triangle');
    this.tone(putt ? 1000 : 1700, .035, .07, 'sine');
  }
  bounce(impact, lie = 'fairway') {
    this.tone(
      lie === 'sand' ? 80 : 180,
      lie === 'sand' ? .11 : .06,
      Math.min(.14, impact * .008),
      'triangle',
    );
  }
  roll(speed, lie, dt) {
    if (!this.ctx || this.store.settings.muted || speed < .15) return;
    this.rollTick = (this.rollTick || 0) - dt;
    if (this.rollTick > 0) return;
    this.rollTick = .14;
    this.tone(
      lie === 'sand' ? 65 : 100 + speed * 8,
      .065,
      Math.min(.012, speed * .002),
      'triangle',
    );
  }
  rim() {
    this.tone(950, .05, .05, 'triangle');
  }
  cup() {
    this.tone(430, .09, .12, 'triangle');
    this.tone(230, .16, .1, 'sine', false, .055);
  }
  result(won, milestone) {
    (won ? [523, 659, 784, 1047] : [330, 247, 165]).forEach((n, i) =>
      this.tone(n, .35, .14, 'sine', false, i * .12)
    );
    if (milestone) this.tone(1568, .7, .12, 'triangle', false, .55);
  }
  update(dt) {
    if (!this.ctx || !this.active) return;
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick = 2.4;
    const chords = [[196, 246.94, 293.66], [174.61, 220, 261.63], [164.81, 196, 246.94], [
      146.83,
      185,
      220,
    ]];
    const notes = chords[(this.chord = (this.chord ?? -1) + 1) % chords.length];
    notes.forEach((n, i) => this.tone(n, 2.3, .035, 'sine', true, i * .06));
  }
  pause() {
    this.active = false;
    if (this.ctx) this.ctx.suspend().catch(() => {});
  }
  destroy() {
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
