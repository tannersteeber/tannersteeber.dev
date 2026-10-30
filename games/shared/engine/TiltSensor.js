/* TiltSensor — device-rotation steering.
 *
 * Rather than trusting one raw axis, the steering angle is the rotation of the phone about
 * its own screen normal ("twist"), which is what a player does both when holding the phone
 * like a wheel and when spinning a phone that lies flat:
 *   - upright posture: twist = angle of gravity inside the screen plane
 *   - flat posture:    twist = heading change of the phone's top edge in the horizontal plane
 * Posture is detected automatically (with hysteresis) and the neutral angle is re-captured
 * whenever it changes, on calibration, and after a screen rotation.
 * Positive twist = counter-clockwise as seen by the player = steer left.
 */
const D2R = Math.PI / 180;
const wrap = (a) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};

export class TiltSensor {
  constructor() {
    this.supported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    this.needsPermission = this.supported &&
      typeof window.DeviceOrientationEvent.requestPermission === 'function';
    this.status = this.supported ? 'idle' : 'unavailable'; // idle | requesting | active | denied | unavailable
    this.message = this.supported
      ? 'Tilt steering is off.'
      : 'This device or browser does not expose motion sensors.';
    this.posture = null;
    this.neutral = 0;
    this.twist = 0; // latest raw twist (rad)
    this.hasSample = false;
    this._handler = (e) => this._onOrientation(e);
    this._timer = 0;
    this._permissionAsked = false;
    this.onStatus = null;
    this._onRotate = () => {
      setTimeout(() => this.calibrate(), 350);
    };
  }

  get active() {
    if (this.status === 'active' && performance.now() - this._lastSample > 2500) {
      this.disable();
      this._set('unavailable', 'Orientation readings stopped. Touch steering is available.');
    }
    return this.status === 'active';
  }

  _set(status, message) {
    this.status = status;
    this.message = message;
    if (this.onStatus) this.onStatus(status, message);
  }

  /** Must be called directly from a user gesture (click/tap). */
  async enable() {
    if (!this.supported) {
      this._set(
        'unavailable',
        'This device or browser does not expose motion sensors. Use touch steering.',
      );
      return false;
    }
    if (this.status === 'active') return true;
    if (this.needsPermission && !this._permissionAsked) {
      this._permissionAsked = true;
      this._set('requesting', 'Waiting for motion permission…');
      try {
        const res = await window.DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') {
          this._set(
            'denied',
            'Motion access was denied. Enable it for this site in Safari settings, or use touch steering.',
          );
          return false;
        }
      } catch (err) {
        this._set('denied', 'Motion permission could not be requested. Use touch steering.');
        return false;
      }
    } else if (this.needsPermission && this._permissionAsked && this.status === 'denied') {
      this._set(
        'denied',
        'Motion access was denied earlier. Enable it for this site in your browser settings, then reload, or use touch steering.',
      );
      return false;
    }
    return this._start();
  }

  _start() {
    this.hasSample = false;
    window.addEventListener('deviceorientation', this._handler);
    window.addEventListener('orientationchange', this._onRotate);
    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', this._onRotate);
    }
    this._set('requesting', 'Reading sensors…');
    return new Promise((resolve) => {
      clearTimeout(this._timer);
      this._timer = setTimeout(() => {
        if (!this.hasSample) {
          this.disable();
          this._set(
            'unavailable',
            'No usable orientation data was received. Use touch steering instead.',
          );
          resolve(false);
        } else resolve(true);
      }, 1600);
    });
  }

  disable() {
    clearTimeout(this._timer);
    window.removeEventListener('deviceorientation', this._handler);
    window.removeEventListener('orientationchange', this._onRotate);
    if (window.screen && window.screen.orientation) {
      window.screen.orientation.removeEventListener('change', this._onRotate);
    }
    if (this.status === 'active' || this.status === 'requesting') {
      this._set('idle', 'Tilt steering is off.');
    }
    this.hasSample = false;
    this.posture = null;
  }

  _onOrientation(e) {
    if (!Number.isFinite(e.beta) || !Number.isFinite(e.gamma)) return; // desktop browsers fire empty events
    const a = (e.alpha || 0) * D2R, b = e.beta * D2R, g = e.gamma * D2R;
    const ca = Math.cos(a),
      sa = Math.sin(a),
      cb = Math.cos(b),
      sb = Math.sin(b),
      cg = Math.cos(g),
      sg = Math.sin(g);
    // Third row of R = Rz(a)·Rx(b)·Ry(g): world-up expressed in device axes
    const ux = -cb * sg, uy = sb, uz = cb * cg;
    const flatness = Math.abs(uz);
    // heading of the device's top edge in the horizontal plane
    const topX = -sa * cb, topY = ca * cb;
    const flatTwist = Math.atan2(topY, topX) * (uz >= 0 ? 1 : -1);
    const uprightTwist = Math.atan2(ux, uy);

    let posture = this.posture;
    if (posture === null) posture = flatness > 0.6 ? 'flat' : 'upright';
    else if (posture === 'upright' && flatness > 0.78) posture = 'flat';
    else if (posture === 'flat' && flatness < 0.5) posture = 'upright';

    if (posture === 'flat' && !Number.isFinite(e.alpha)) return;
    this._lastSample = performance.now();
    const twist = posture === 'flat' ? flatTwist : uprightTwist;
    if (posture !== this.posture) {
      this.posture = posture;
      this.neutral = twist;
    }
    this.twist = twist;
    if (!this.hasSample) {
      this.hasSample = true;
      this.neutral = twist;
      this._set('active', 'Tilt steering is active. Rotate the phone left or right to steer.');
    }
  }

  calibrate() {
    if (!this.hasSample) return false;
    this.neutral = this.twist;
    return true;
  }

  /** Signed angle from neutral in radians; positive = rotated left. */
  angle() {
    return this.hasSample ? wrap(this.twist - this.neutral) : 0;
  }
}
