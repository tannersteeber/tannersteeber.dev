/* VehicleController — arcade driving model in road-relative coordinates.
 *
 * The car's state is (s, d): distance along the road and lateral offset from the centre line.
 * Steering sets a lateral velocity (speed × tan(yaw angle)); curves add a mild outward "drift" the
 * player counters by steering, and an optional road assist cancels most of it and re-centres the car.
 * Roll and pitch use springs for a gentle suspension feel. Both games share this class with
 * different configs (Cruise: relaxed, Cutup: fast and responsive).
 */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (k, dt) => 1 - Math.exp(-k * dt);

export const VEHICLE_PRESETS = {
  cruise: {
    maxSpeed: 45,
    accel: 5,
    brake: 12,
    steerResponse: 5,
    lateralResponse: 4.2,
    maxYaw: 0.3,
    speedRef: 25,
    speedFalloff: 1.0,
    drift: 8,
    roll: 0.05,
    laneWidth: 3.4,
    lanes: 2,
  },
  cutup: {
    maxSpeed: 80,
    accel: 9,
    brake: 18,
    steerResponse: 10,
    lateralResponse: 9,
    maxYaw: 0.27,
    speedRef: 40,
    speedFalloff: 1.0,
    drift: 3,
    roll: 0.07,
    laneWidth: 3.6,
    lanes: 4,
  },
};

export class VehicleController {
  constructor(road, cfg) {
    this.road = road;
    this.cfg = Object.assign({}, cfg);
    this.sample = {};
    this.reset();
  }

  reset(s = 0, speed = 0) {
    this.s = s;
    this.d = 0;
    this.speed = speed;
    this.lat = 0;
    this.steer = 0;
    this.yaw = 0;
    this.roll = 0;
    this.rollV = 0;
    this.pitch = 0;
    this.pitchV = 0;
    this.heave = 0;
    this.prevSlope = 0;
    this.accelNow = 0;
    this.targetSpeed = speed;
    this.crashed = false;
    this.crashSpin = 0;
    this.crashRollV = 0;
    this.crashLat = 0;
    this.offRoad = false;
    this.scraping = false;
    this.slope = 0;
    this.assist = 0;
    this.autoSpeed = true;
    this.position = { x: 0, y: 0, z: 0 };
    this._place();
  }

  crash(dir = 1) {
    if (this.crashed) return;
    this.crashed = true;
    this.crashSpin = dir * (3 + Math.random() * 2);
    this.crashRollV = dir * 2.5;
    this.crashLat = dir * 3.5;
  }

  /** input: { steer, throttle }. opts: { autoSpeed, targetSpeed, assist(0..1), limit, roadHalf, grassDrag } */
  update(dt, input) {
    const c = this.cfg, road = this.road;
    const prevSpeed = this.speed;

    if (this.crashed) {
      this.speed *= Math.exp(-2.6 * dt);
      this.d += this.crashLat * dt;
      this.crashLat *= Math.exp(-1.5 * dt);
      this.yaw += this.crashSpin * dt;
      this.crashSpin *= Math.exp(-1.2 * dt);
      this.roll += this.crashRollV * dt;
      this.crashRollV *= Math.exp(-1.5 * dt);
      this.s += this.speed * dt;
      this._place();
      return;
    }

    // ----- steering: gradual input smoothing, speed-sensitive authority -----
    this.steer += (clamp(input.steer, -1, 1) - this.steer) * damp(c.steerResponse, dt);
    const v = this.speed;
    const maxYaw = c.maxYaw / (1 + Math.pow(v / c.speedRef, 2) * c.speedFalloff);
    const lowSpeed = clamp(v / 6, 0, 1); // can't swerve while stationary
    let latTarget = this.steer * v * Math.tan(maxYaw) * lowSpeed;

    // curve drift (outward push) and optional assist
    const k = this.road.at(this.s, this.sample).k;
    const assist = this.assist;
    latTarget += k * v * c.drift * (1 - 0.85 * assist);
    if (assist > 0) {
      const n = c.lanes,
        cen = (Math.round(this.d / c.laneWidth + (n - 1) / 2) - (n - 1) / 2) * c.laneWidth;
      const free = 1 - Math.min(1, Math.abs(this.steer) * 3); // yield to the player when they steer
      latTarget += -(this.d - clamp(cen, -c.laneWidth * (n - 1) / 2, c.laneWidth * (n - 1) / 2)) *
        0.8 * assist * free;
    }
    this.lat += (latTarget - this.lat) * damp(c.lateralResponse, dt);
    this.d += this.lat * dt;

    // ----- limits: soft road edge, hard wall -----
    const limit = c.limit, half = c.roadHalf;
    this.scraping = false;
    if (Math.abs(this.d) > limit) {
      this.d = clamp(this.d, -limit, limit);
      if (c.wallScrape) {
        this.scraping = true;
        this.speed *= Math.exp(-0.9 * dt);
      }
      this.lat *= 0.2;
    }
    this.offRoad = Math.abs(this.d) > half + 0.2;

    // ----- speed -----
    const max = c.maxSpeed;
    if (this.autoSpeed) {
      const err = this.targetSpeed - this.speed;
      this.speed += clamp(err * 0.9, -c.brake, c.accel) * dt;
    } else {
      const t = input.throttle;
      if (t > 0) this.speed += c.accel * t * (1 - this.speed / max) * dt;
      else if (t < 0) this.speed += c.brake * t * dt;
      else this.speed -= (0.6 + this.speed * 0.02) * dt;
      this.speed -= this.slope * 9.8 * 0.25 * dt;
    }
    if (this.offRoad && c.grassDrag) this.speed -= this.speed * c.grassDrag * dt;
    this.speed = clamp(this.speed, 0, max);
    this.accelNow += ((this.speed - prevSpeed) / Math.max(dt, 1e-4) - this.accelNow) * damp(6, dt);

    this.s += this.speed * dt;

    // ----- suspension springs -----
    const rollTarget = -this.steer * c.roll * clamp(v / c.speedRef, 0, 1.2) - this.lat * 0.004;
    this.rollV += (70 * (rollTarget - this.roll) - 9 * this.rollV) * dt;
    this.roll += this.rollV * dt;
    const pitchTarget = -this.accelNow * 0.006;
    this.pitchV += (60 * (pitchTarget - this.pitch) - 8 * this.pitchV) * dt;
    this.pitch += this.pitchV * dt;
    const smp = road.at(this.s, this.sample);
    const dSlope = (smp.slope - this.prevSlope) / Math.max(dt, 1e-4);
    this.prevSlope = smp.slope;
    const heaveTarget = clamp(-dSlope * this.speed * 0.02, -0.12, 0.12);
    this.heave += (heaveTarget - this.heave) * damp(7, dt);

    // visual yaw: heading of the road minus the angle of the lateral motion
    this.yaw = smp.h - Math.atan2(this.lat, Math.max(this.speed, 5));
    this._place();
  }

  _place() {
    const s = this.road.at(this.s, this.sample);
    this.slope = s.slope;
    this.position.x = s.x + s.rx * this.d;
    this.position.z = s.z + s.rz * this.d;
    this.position.y = s.y;
    this.roadHeading = s.h;
    if (!this.crashed) this.yaw = s.h - Math.atan2(this.lat, Math.max(this.speed, 5));
  }

  applyTo(obj) {
    obj.position.set(this.position.x, this.position.y + 0.02 + this.heave, this.position.z);
    obj.rotation.set(-Math.atan(this.slope) + this.pitch, this.yaw, this.roll);
  }
}
