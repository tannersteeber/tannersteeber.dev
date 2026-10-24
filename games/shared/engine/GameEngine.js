/* GameEngine — requestAnimationFrame loop with delta-time clamping, tab-visibility pausing and
 * adaptive resolution. Games supply update(dt) and the engine renders the shared scene. */
export class GameEngine {
  constructor(gameRenderer) {
    this.gr = gameRenderer;
    this.update = null;          // (dt) => void
    this.onHidden = null;        // called when the tab is hidden
    this.running = false;
    this.avg = 1 / 60;
    this._raf = 0;
    this._last = 0;
    this._tick = (t) => this._frame(t);
    this._vis = () => {
      if (document.hidden) { if (this.onHidden) this.onHidden(); }
      this._last = performance.now();
    };
    document.addEventListener('visibilitychange', this._vis);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._tick);
  }

  stop() { this.running = false; cancelAnimationFrame(this._raf); }

  _frame(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._tick);
    if (document.hidden) { this._last = now; return; }
    const raw = (now - this._last) / 1000;
    this._last = now;
    const dt = Math.min(0.05, Math.max(0, raw));      // clamp so a hitch never teleports the car
    this.avg += (Math.min(raw, 0.2) - this.avg) * 0.05;
    this.gr.adapt(this.avg, now);
    if (this.update) this.update(dt);
    this.gr.render();
  }

  destroy() {
    this.stop();
    document.removeEventListener('visibilitychange', this._vis);
  }
}
