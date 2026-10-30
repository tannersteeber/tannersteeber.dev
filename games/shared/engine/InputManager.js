/* InputManager — one configurable steering input shared by every game.
 * Sources: keyboard (always), mouse hold-halves, touch hold-halves, device tilt.
 * Output after update(dt): this.steer in [-1, 1] (negative = left) and this.throttle in [-1, 1]. */
import { TiltSensor } from './TiltSensor.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const GAS = new Set(['KeyW', 'ArrowUp']);
const BRAKE = new Set(['KeyS', 'ArrowDown']);
const UI_SELECTOR = 'button, a, input, select, textarea, label, [data-ui]';

export class InputManager {
  constructor(surface, settings) {
    this.surface = surface; // element that receives hold-to-steer pointers
    this.settings = settings;
    this.tilt = new TiltSensor();
    this.enabled = false;
    this.keys = new Set();
    this.holds = new Map(); // pointerId -> -1 | 1
    this.kbAxis = 0;
    this.ptrAxis = 0;
    this.tiltAxis = 0;
    this.steer = 0;
    this.throttle = 0;
    this.pedal = 0; // set by on-screen pedals
    this.onPause = null;
    this._bound = [];
    this._attach();
  }

  _on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this._bound.push(() => target.removeEventListener(type, fn, opts));
  }

  _attach() {
    this._on(window, 'keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.onPause && !e.repeat) this.onPause();
        return;
      }
      if (!this.enabled) return;
      if (LEFT.has(e.code) || RIGHT.has(e.code) || GAS.has(e.code) || BRAKE.has(e.code)) {
        if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
        this.keys.add(e.code);
        e.preventDefault();
      }
    });
    this._on(window, 'keyup', (e) => this.keys.delete(e.code));
    this._on(window, 'blur', () => this.reset());

    const s = this.surface;
    this._on(s, 'pointerdown', (e) => {
      if (!this.enabled || !this._pointerAllowed(e)) return;
      if (e.target.closest && e.target.closest(UI_SELECTOR)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.holds.set(e.pointerId, this._side(e));
      try {
        s.setPointerCapture(e.pointerId);
      } catch (err) { /* ignore */ }
      e.preventDefault();
    });
    this._on(s, 'pointermove', (e) => {
      if (this.holds.has(e.pointerId)) this.holds.set(e.pointerId, this._side(e));
    });
    const up = (e) => {
      this.holds.delete(e.pointerId);
    };
    this._on(s, 'pointerup', up);
    this._on(s, 'pointercancel', up);
    this._on(s, 'lostpointercapture', up);
    this._on(s, 'contextmenu', (e) => e.preventDefault());
    // prevent browser scrolling / pinch while playing
    this._on(s, 'touchmove', (e) => {
      if (this.enabled && !e.target.closest(UI_SELECTOR)) e.preventDefault();
    }, { passive: false });
  }

  _side(e) {
    const r = this.surface.getBoundingClientRect();
    return e.clientX < r.left + r.width / 2 ? -1 : 1;
  }

  _pointerAllowed(e) {
    const mode = this.settings.controlMode();
    if (mode === 'mouse') return e.pointerType === 'mouse';
    if (mode === 'touch') return e.pointerType === 'touch' || e.pointerType === 'pen';
    if (mode === 'tilt') {
      return !this.tilt.active && (e.pointerType === 'touch' || e.pointerType === 'pen'); // touch fallback
    }
    return false; // keyboard mode
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.reset();
  }

  reset() {
    this.keys.clear();
    this.holds.clear();
    this.pedal = 0;
    this.kbAxis =
      this.ptrAxis =
      this.tiltAxis =
      this.steer =
      this.throttle =
        0;
  }

  update(dt) {
    const st = this.settings;
    if (!this.enabled) {
      this.steer = 0;
      this.throttle = 0;
      return;
    }

    // keyboard: gradual ramp, never a snap
    let kt = 0;
    for (const k of this.keys) {
      if (LEFT.has(k)) kt -= 1;
      else if (RIGHT.has(k)) kt += 1;
    }
    kt = clamp(kt, -1, 1);
    this.kbAxis = this._ramp(this.kbAxis, kt, dt, 3.4, 5.5);

    // hold-to-steer pointers
    let l = 0, r = 0;
    for (const side of this.holds.values()) {
      if (side < 0) l = 1;
      else r = 1;
    }
    this.ptrAxis = this._ramp(this.ptrAxis, r - l, dt, 4.2, 6.5);

    // tilt
    let tiltTarget = 0;
    if (st.controlMode() === 'tilt' && this.tilt.active) {
      const range = Math.max(8, st.get('tiltRange')) * Math.PI / 180;
      const dz = clamp(st.get('tiltDeadzone'), 0, 12) * Math.PI / 180;
      const a = this.tilt.angle(); // + = rotated left
      const mag = Math.max(0, Math.abs(a) - dz) / Math.max(0.01, range - dz);
      tiltTarget = -Math.sign(a) * clamp(mag, 0, 1);
    }
    this.tiltAxis += (tiltTarget - this.tiltAxis) * (1 - Math.exp(-14 * dt)); // low-pass filter

    const sens = st.get('sensitivity') * (st.get('invert') ? -1 : 1);
    this.steer = clamp((this.kbAxis + this.ptrAxis + this.tiltAxis) * sens, -1, 1);

    let t = this.pedal;
    for (const k of this.keys) {
      if (GAS.has(k)) t += 1;
      else if (BRAKE.has(k)) t -= 1;
    }
    this.throttle = clamp(t, -1, 1);
  }

  _ramp(cur, target, dt, up, down) {
    const rate = target === 0
      ? down
      : (Math.sign(target) !== Math.sign(cur) && cur !== 0 ? up * 1.8 : up);
    const step = rate * dt;
    return Math.abs(target - cur) <= step ? target : cur + Math.sign(target - cur) * step;
  }

  destroy() {
    this._bound.forEach((off) => off());
    this._bound = [];
    this.tilt.disable();
  }
}
