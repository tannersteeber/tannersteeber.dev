// games/shared/engine/MathUtils.js
function mulberry32(a) {
  return function() {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// games/ripagolf/SurfacePhysics.js?v=20261026-touch-9
var SURFACE_PHYSICS = Object.freeze({
  green: {
    restitution: 0.16,
    contactFriction: 0.38,
    landingDrag: 0.035,
    rolling: 0.22,
    grip: 0.25,
    launch: 1
  },
  fairway: {
    restitution: 0.34,
    contactFriction: 0.11,
    rolling: 0.85,
    speedDrag: 0.02,
    grip: 1.05,
    launch: 1
  },
  tee: { restitution: 0.32, contactFriction: 0.1, rolling: 0.8, speedDrag: 0.02, grip: 1, launch: 1 },
  rough: {
    restitution: 0.13,
    contactFriction: 0.36,
    rolling: 2.25,
    speedDrag: 0.03,
    grip: 2.7,
    launch: 0.8
  },
  sand: {
    restitution: 0.04,
    contactFriction: 0.72,
    rolling: 4.8,
    speedDrag: 0.04,
    grip: 5.5,
    launch: 0.65
  },
  water: { restitution: 0, contactFriction: 1, rolling: 8, grip: 8, launch: 0 }
});
var surfacePhysics = (lie) => SURFACE_PHYSICS[lie] || SURFACE_PHYSICS.rough;

// games/ripagolf/rules.js?v=20261026-touch-9
var CLUBS = [
  { id: "driver", name: "Driver", speed: 75, loft: 16, spin: 2400, accuracy: 7, carry: 246 },
  { id: "wood", name: "Fairway wood", speed: 64, loft: 19, spin: 3200, accuracy: 6, carry: 228 },
  { id: "hybrid", name: "Hybrid", speed: 57, loft: 23, spin: 4e3, accuracy: 5, carry: 218 },
  { id: "long", name: "Long iron", speed: 51, loft: 28, spin: 4700, accuracy: 4.5, carry: 201 },
  { id: "mid", name: "Mid iron", speed: 44, loft: 34, spin: 5600, accuracy: 4, carry: 161 },
  { id: "short", name: "Short iron", speed: 37, loft: 41, spin: 6600, accuracy: 3.5, carry: 117 },
  { id: "pitch", name: "Pitching wedge", speed: 30, loft: 48, spin: 7600, accuracy: 3, carry: 77 },
  { id: "sand", name: "Sand wedge", speed: 24, loft: 56, spin: 8400, accuracy: 2.5, carry: 47 },
  { id: "putter", name: "Putter", speed: 4.4, loft: 0, spin: 0, accuracy: 2, carry: 40 }
];
var clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// games/ripagolf/Course.js
var Course = class {
  constructor(seed, index = 1) {
    this.seed = seed >>> 0;
    this.index = index;
    const r = this.rng = mulberry32(this.seed);
    this.par = [3, 4, 5][Math.floor(r() * 3)];
    this.length = { 3: 115, 4: 245, 5: 365 }[this.par] + r() * { 3: 55, 4: 90, 5: 95 }[this.par];
    this.bend = (r() - 0.5) * (this.par === 3 ? 18 : 58);
    this.phase = r() * 6.28;
    this.width = 16 - Math.min(index / 20, 3) + r() * 3;
    this.pin = { x: this.center(this.length) + (r() - 0.5) * 6, z: this.length };
    this.greenRadius = 15 + r() * 3;
    this.greenX = (r() - 0.5) * 0.025;
    this.greenZ = (r() - 0.5) * 0.025;
    this.terrainStrength = 1;
    this.greenBase = this.baseHeight(this.pin.x, this.pin.z) + 2.4;
    this.tee = { x: 0, z: 0 };
    this.hazards = [];
    for (let i = 0; i < 2 + (this.par > 3 ? 2 : 0); i++) {
      const z = 35 + r() * Math.max(15, this.length - 75), side = r() < 0.5 ? -1 : 1, water = i === 0 && this.par > 3;
      this.hazards.push({
        x: this.center(z) + side * (this.width + 10 + r() * 9),
        z,
        rx: water ? 9 + r() * 5 : 5 + r() * 4,
        rz: water ? 16 + r() * 9 : 7 + r() * 7,
        type: water ? "water" : "sand"
      });
    }
    this.hazards.push({
      x: this.pin.x + (r() < 0.5 ? -1 : 1) * (this.greenRadius + 6),
      z: this.length - 6,
      rx: 5,
      rz: 9,
      type: "sand"
    });
    for (const h of this.hazards) if (h.type === "water") h.level = this.baseHeight(h.x, h.z) - 0.65;
    const angle = r() * Math.PI * 2, speed = 1.5 + r() * (3.2 + Math.min(index, 20) * 0.08);
    this.wind = { x: Math.sin(angle) * speed, z: Math.cos(angle) * speed, speed, angle };
    this.trees = [];
    for (let i = 0; i < 90; i++) {
      const z = -15 + r() * (this.length + 60), x = (r() < 0.5 ? -1 : 1) * (38 + r() * 42);
      if (Math.hypot(x - this.pin.x, z - this.pin.z) < this.greenRadius + 8 || this.surface(x, z) !== "rough" || Math.abs(x - this.center(z)) < this.width + 5) continue;
      this.trees.push({ x, z, scale: 0.8 + r() * 1.1 });
    }
    this.rebuildTerrain();
    for (let attempt = 0; !this.validation.valid && attempt < 4; attempt++) {
      this.terrainStrength *= 0.65;
      this.rebuildTerrain();
    }
    if (!this.validation.valid) throw new Error("Course failed playability validation");
  }
  center(z) {
    return this.bend * Math.pow(Math.sin(clamp(z / this.length, 0, 1) * Math.PI), 2);
  }
  baseHeight(x, z) {
    const t = this.terrainStrength ?? 1;
    return t * (5.8 * Math.sin(z / 87 + this.phase) + 2.6 * Math.sin(z / 39 + this.phase * 0.7) + 2.5 * Math.sin(x / 61 + this.phase) * Math.sin(z / 113 + 0.4) + 0.6 * Math.sin(x / 22 + z / 36));
  }
  rawHeight(x, z) {
    let y = this.baseHeight(x, z), t = this.terrainStrength ?? 1;
    const g = 1 - smoothstep(
      this.greenRadius - 3,
      this.greenRadius + 12,
      Math.hypot(x - this.pin.x, z - this.pin.z)
    );
    const green = this.baseHeight(this.pin.x, this.pin.z) + 2.4 * t + (x - this.pin.x) * this.greenX + (z - this.pin.z) * this.greenZ;
    y = y * (1 - g) + green * g;
    const tee = 1 - smoothstep(5, 23, Math.hypot(x, z));
    y = y * (1 - tee) + (this.baseHeight(0, 0) + 1.8 * t) * tee;
    for (const h of this.hazards) {
      const radius = Math.hypot((x - h.x) / h.rx, (z - h.z) / h.rz), blend = 1 - smoothstep(0.25, 1.12, radius);
      if (h.type === "sand") y -= 0.85 * t * blend;
      else y = y * (1 - blend) + (h.level - 1.5) * blend;
    }
    return y;
  }
  rebuildTerrain() {
    const step = 1.5, sorted = (min, max, extra) => [
      .../* @__PURE__ */ new Set([
        ...Array.from(
          { length: Math.ceil((max - min) / step) + 1 },
          (_, i) => Math.min(max, min + i * step)
        ),
        ...extra
      ])
    ].sort((a, b) => a - b);
    const xs = sorted(-91, 91, [this.pin.x - 0.25, this.pin.x + 0.25]), zs = sorted(-30, this.length + 70, [this.pin.z - 0.25, this.pin.z + 0.25]);
    const heights = new Float32Array(xs.length * zs.length);
    for (let j = 0; j < zs.length; j++) {
      for (let i = 0; i < xs.length; i++) {
        heights[j * xs.length + i] = this.rawHeight(xs[i], zs[j]);
      }
    }
    this.heightfield = { xs, zs, heights };
    this.validation = this.validate();
  }
  cell(axis, value) {
    let lo = 0, hi = axis.length - 1;
    while (hi - lo > 1) {
      const mid = lo + hi >> 1;
      if (axis[mid] <= value) lo = mid;
      else hi = mid;
    }
    return lo;
  }
  sample(x, z) {
    const f = this.heightfield;
    if (!f || x < f.xs[0] || x > f.xs.at(-1) || z < f.zs[0] || z > f.zs.at(-1)) {
      return { height: this.rawHeight(x, z), slope: null };
    }
    const i = this.cell(f.xs, x), j = this.cell(f.zs, z), dx = f.xs[i + 1] - f.xs[i], dz = f.zs[j + 1] - f.zs[j], u = (x - f.xs[i]) / dx, v = (z - f.zs[j]) / dz, k = j * f.xs.length + i;
    const a = f.heights[k], b = f.heights[k + f.xs.length], c = f.heights[k + 1], d = f.heights[k + f.xs.length + 1];
    return u + v <= 1 ? { height: a + u * (c - a) + v * (b - a), slope: { x: (c - a) / dx, z: (b - a) / dz } } : {
      height: d + (1 - u) * (b - d) + (1 - v) * (c - d),
      slope: { x: (d - b) / dx, z: (d - c) / dz }
    };
  }
  height(x, z) {
    return this.sample(x, z).height;
  }
  slope(x, z) {
    const value = this.sample(x, z);
    if (value.slope) return value.slope;
    const e = 0.05;
    return {
      x: (this.rawHeight(x + e, z) - this.rawHeight(x - e, z)) / (2 * e),
      z: (this.rawHeight(x, z + e) - this.rawHeight(x, z - e)) / (2 * e)
    };
  }
  waterAt(x, z) {
    const h = this.hazards.find(
      (h2) => h2.type === "water" && ((x - h2.x) / h2.rx) ** 2 + ((z - h2.z) / h2.rz) ** 2 < 1
    );
    return h ? { level: h.level } : null;
  }
  validate() {
    let maxSlope = 0;
    const issues = [];
    for (let z = 0; z <= this.length; z += 3) {
      const x = this.center(z), s = this.slope(x, z);
      maxSlope = Math.max(maxSlope, Math.hypot(s.x, s.z));
      if (!["tee", "fairway", "green"].includes(this.surface(x, z))) issues.push("blocked route");
    }
    if (maxSlope > 0.28) issues.push("route slope");
    if (this.surface(this.pin.x, this.pin.z) !== "green" || !this.inBounds(this.pin.x, this.pin.z)) issues.push("pin");
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8, s = this.slope(this.pin.x + Math.cos(a) * 4, this.pin.z + Math.sin(a) * 4);
      if (Math.hypot(s.x, s.z) > 0.035) issues.push("putting slope");
    }
    return { valid: issues.length === 0, maxSlope, issues: [...new Set(issues)] };
  }
  surface(x, z) {
    if (Math.hypot(x - this.pin.x, z - this.pin.z) < this.greenRadius) return "green";
    if (Math.hypot(x, z) < 7) return "tee";
    for (const h of this.hazards) {
      if (((x - h.x) / h.rx) ** 2 + ((z - h.z) / h.rz) ** 2 < 1) return h.type;
    }
    if (z >= 0 && z <= this.length && Math.abs(x - this.center(z)) < this.width * (0.9 + 0.1 * Math.sin(z / 30))) return "fairway";
    return "rough";
  }
  inBounds(x, z) {
    return Math.abs(x) < 88 && z > -24 && z < this.length + 48;
  }
  relief(x, z) {
    let at = clamp(z - 8, 8, this.length - 20);
    while (this.surface(this.center(at), at) === "water" && at > 8) at -= 4;
    return { x: this.center(at), z: at };
  }
  windAt(time) {
    const factor = 1 + 0.08 * Math.sin(time * 0.25 + this.phase);
    return { x: this.wind.x * factor, z: this.wind.z * factor };
  }
  distance(x, z) {
    return Math.hypot(x - this.pin.x, z - this.pin.z);
  }
};

// games/ripagolf/CupPhysics.js?v=20261026-touch-9
var BALL_RADIUS = 0.04267 / 2;
var CUP_RADIUS = 0.108 / 2;
var CUP_DEPTH = 0.1016;
var CUP_CLEARANCE = CUP_RADIUS - BALL_RADIUS;
function cupSweep(a, b, pin, radius = CUP_CLEARANCE) {
  const x = a.x - pin.x, z = a.z - pin.z, dx = b.x - a.x, dz = b.z - a.z, A = dx * dx + dz * dz;
  const closest = A ? clamp(-(x * dx + z * dz) / A, 0, 1) : 0;
  const miss = Math.hypot(x + dx * closest, z + dz * closest);
  if (miss > radius) return null;
  if (A < 1e-14) return { enter: 0, exit: 1, closest, miss };
  const B = 2 * (x * dx + z * dz), D = B * B - 4 * A * (x * x + z * z - radius * radius);
  if (D < 0) return null;
  const enter = Math.max(0, (-B - Math.sqrt(D)) / (2 * A)), exit = Math.min(1, (-B + Math.sqrt(D)) / (2 * A));
  return enter <= exit ? { enter, exit, closest, miss } : null;
}
function cupContact(before, after, velocity, course, rolling) {
  const pin = course.pin, level = course.height(pin.x, pin.z), speed = Math.hypot(velocity.x, velocity.z);
  const hit = cupSweep(before, after, pin);
  if (hit) {
    const chord = 2 * Math.sqrt(Math.max(0, CUP_CLEARANCE * CUP_CLEARANCE - hit.miss * hit.miss));
    const fallTime = Math.sqrt(2 * BALL_RADIUS * 0.55 / 9.81);
    const slow = speed < Math.max(0.18, chord / fallTime);
    const crossing = before.y >= level + BALL_RADIUS - 2e-3 && after.y <= level + BALL_RADIUS;
    const steep = velocity.y < -0.4 && -velocity.y > speed * 1.5;
    if (rolling && slow || !rolling && crossing && (slow || steep)) {
      const t = rolling ? hit.closest : clamp((before.y - level - BALL_RADIUS) / (before.y - after.y || 1), 0, 1);
      const x = before.x + (after.x - before.x) * t, z = before.z + (after.z - before.z) * t;
      if (Math.hypot(x - pin.x, z - pin.z) <= CUP_CLEARANCE + 1e-5) {
        return { type: "entry", x, z, level };
      }
    }
  }
  const dx = after.x - before.x, dz = after.z - before.z, travel = Math.hypot(dx, dz);
  const impactParameter = travel ? Math.abs((before.x - pin.x) * dz - (before.z - pin.z) * dx) / travel : Infinity;
  const rim = cupSweep(before, after, pin, CUP_RADIUS + BALL_RADIUS * 0.5);
  if (rolling && rim && impactParameter > CUP_CLEARANCE * 0.82 && rim.enter > 0 && speed > 0.3) {
    const x = before.x + (after.x - before.x) * rim.enter - pin.x, z = before.z + (after.z - before.z) * rim.enter - pin.z, d = Math.hypot(x, z) || 1;
    return { type: "rim", nx: x / d, nz: z / d };
  }
  return null;
}

// games/ripagolf/Aerodynamics.js?v=20261026-touch-9
function airAcceleration(v, wind, spin, sideSpin = 0) {
  const x = v.x - wind.x, y = v.y, z = v.z - wind.z, speed = Math.hypot(x, y, z), horizontal = Math.hypot(x, z);
  if (speed < 1e-3) return { x: 0, y: -9.81, z: 0 };
  const ratio = Math.abs(spin) * Math.PI / 30 * BALL_RADIUS / speed;
  const lift = 0.0185 * Math.min(0.24, 0.65 * ratio) * speed * speed * Math.sign(spin);
  const drag = 31e-4 * speed, curve = 0.0185 * 0.075 * sideSpin * speed;
  return {
    x: -drag * x - (horizontal ? lift * y * x / (speed * horizontal) : 0) + curve * z,
    y: -9.81 - drag * y + lift * horizontal / speed,
    z: -drag * z - (horizontal ? lift * y * z / (speed * horizontal) : 0) - curve * x
  };
}

// games/ripagolf/BallPhysics.js
var STEP = 1 / 120;
var contactHeight = (course, x, z) => {
  const s = course.slope(x, z);
  return course.height(x, z) + BALL_RADIUS * Math.hypot(1, s.x, s.z);
};
var BallPhysics = class {
  constructor(course) {
    this.course = course;
    this.reset(course.tee);
  }
  reset(p) {
    this.p = { x: p.x, y: contactHeight(this.course, p.x, p.z), z: p.z };
    this.previous = { ...this.p };
    this.v = { x: 0, y: 0, z: 0 };
    this.status = "rest";
    this.spin = 0;
    this.sideSpin = 0;
    this.age = 0;
    this.restTime = 0;
    this.origin = { ...this.p };
    this.accumulator = 0;
    this.windClock = null;
    this.cupTime = 0;
    this.shot = null;
  }
  launch({ club = 4, power = 0.8, aim = 0, error = 0, spin = 0, shape = 0, loft = 0 }) {
    if (this.status !== "rest") return false;
    const c = CLUBS[club];
    if (!c) return false;
    this.origin = { ...this.p };
    const lie = this.course.surface(this.p.x, this.p.z), surface = surfacePhysics(lie);
    const resistance = lie === "sand" && club === 7 ? 0.9 : surface.launch;
    const speed = c.speed * Math.pow(clamp(power, 2e-3, 1), club === 8 ? 0.7 : 0.5) * resistance;
    const theta = (club === 8 ? 0 : clamp(c.loft + loft, 5, 70)) * Math.PI / 180, yaw = aim + clamp(error, -1, 1) * c.accuracy * Math.PI / 180;
    this.v = {
      x: Math.sin(yaw) * speed * Math.cos(theta),
      y: club === 8 ? 0 : speed * Math.sin(theta),
      z: Math.cos(yaw) * speed * Math.cos(theta)
    };
    this.spin = club === 8 ? 0 : c.spin * (1 + clamp(spin, -1, 1) * (spin < 0 ? 1.25 : 0.55));
    this.sideSpin = clamp(shape + error * 0.18, -1, 1);
    this.status = club === 8 ? "rolling" : "flight";
    this.age = 0;
    this.restTime = 0;
    this.accumulator = 0;
    this.windClock = null;
    this.cupTime = 0;
    this.shot = {
      club,
      power: clamp(power, 2e-3, 1),
      carry: club === 8 ? 0 : null,
      total: 0,
      lie,
      launchSpeed: speed
    };
    return true;
  }
  snapshot() {
    return {
      version: 2,
      p: { ...this.p },
      v: { ...this.v },
      status: this.status,
      spin: this.spin,
      sideSpin: this.sideSpin,
      age: this.age,
      origin: { ...this.origin },
      restTime: this.restTime,
      accumulator: this.accumulator,
      windClock: this.windClock,
      cupTime: this.cupTime,
      shot: this.shot ? { ...this.shot } : null
    };
  }
  restore(s) {
    if (!s?.p || !s?.v || ![s.p.x, s.p.y, s.p.z, s.v.x, s.v.y, s.v.z].every(Number.isFinite)) {
      return;
    }
    this.p = { ...s.p };
    this.previous = { ...this.p };
    this.v = { ...s.v };
    this.status = ["rest", "flight", "rolling", "cupping", "holed"].includes(s.status) ? s.status : "rest";
    this.spin = Number.isFinite(s.spin) ? s.spin : 0;
    this.sideSpin = Number.isFinite(s.sideSpin) ? s.sideSpin : 0;
    this.age = s.age || 0;
    this.origin = { ...s.origin || s.p };
    this.restTime = s.restTime || 0;
    this.accumulator = clamp(s.accumulator || 0, 0, STEP);
    this.windClock = Number.isFinite(s.windClock) ? s.windClock : null;
    this.cupTime = s.cupTime || 0;
    this.shot = s.shot ? { ...s.shot } : null;
    if (s.version !== 2) {
      this.p.y = contactHeight(this.course, this.p.x, this.p.z);
      if (this.status !== "holed") this.status = "rest";
      this.v = { x: 0, y: 0, z: 0 };
    }
  }
  renderedPosition() {
    const a = clamp(this.accumulator / STEP, 0, 1);
    return this.status === "rest" || this.status === "holed" ? this.p : {
      x: this.previous.x + (this.p.x - this.previous.x) * a,
      y: this.previous.y + (this.p.y - this.previous.y) * a,
      z: this.previous.z + (this.p.z - this.previous.z) * a
    };
  }
  summary() {
    return this.shot ? {
      ...this.shot,
      total: Math.hypot(this.p.x - this.origin.x, this.p.z - this.origin.z),
      lie: this.status === "holed" ? "cup" : this.course.surface(this.p.x, this.p.z),
      remaining: this.course.distance?.(this.p.x, this.p.z) ?? Math.hypot(this.p.x - this.course.pin.x, this.p.z - this.course.pin.z)
    } : null;
  }
  update(dt, windTime = 0) {
    if (this.status === "rest" || this.status === "holed") return null;
    if (this.windClock === null) this.windClock = windTime - dt;
    this.accumulator += Math.min(Math.max(0, dt), 0.1);
    let event = null;
    while (this.accumulator + 1e-12 >= STEP) {
      this.accumulator = Math.max(0, this.accumulator - STEP);
      this.previous = { ...this.p };
      this.windClock += STEP;
      event = this.step(STEP, this.windClock);
      if (event) break;
    }
    return event;
  }
  dropIntoCup(dt) {
    const p = this.p, v = this.v, c = this.course, level = c.height(c.pin.x, c.pin.z), floor = level - CUP_DEPTH + BALL_RADIUS;
    this.cupTime += dt;
    v.y -= 9.81 * dt;
    p.x += v.x * dt;
    p.z += v.z * dt;
    p.y += v.y * dt;
    const x = p.x - c.pin.x, z = p.z - c.pin.z, d = Math.hypot(x, z);
    if (d > CUP_CLEARANCE) {
      const nx = x / d, nz = z / d, dot = v.x * nx + v.z * nz;
      p.x = c.pin.x + nx * CUP_CLEARANCE;
      p.z = c.pin.z + nz * CUP_CLEARANCE;
      if (dot > 0) {
        v.x -= 1.15 * dot * nx;
        v.z -= 1.15 * dot * nz;
      }
    }
    if (p.y <= floor) {
      p.y = floor;
      v.x *= 0.5;
      v.z *= 0.5;
      v.y = Math.min(0.55, Math.abs(v.y) * 0.08);
      if (this.cupTime > 0.16 && Math.hypot(v.x, v.y, v.z) < 0.16) {
        this.status = "holed";
        v.x = v.y = v.z = 0;
        return { type: "holed" };
      }
    }
    return null;
  }
  step(dt, time) {
    if (this.status === "cupping") return this.dropIntoCup(dt);
    const p = this.p, v = this.v, c = this.course, before = { ...p };
    this.age += dt;
    const rolling = this.status === "rolling";
    if (!rolling) {
      const a = airAcceleration(v, c.windAt(time), this.spin, this.sideSpin);
      v.x += a.x * dt;
      v.y += a.y * dt;
      v.z += a.z * dt;
      this.spin *= Math.exp(-0.025 * dt);
    } else {
      const s = c.slope(p.x, p.z), mat = surfacePhysics(c.surface(p.x, p.z)), den = 1 + s.x * s.x + s.z * s.z;
      const gx = -9.81 * s.x / den, gz = -9.81 * s.z / den, slopeForce = Math.hypot(gx, gz), speed = Math.hypot(v.x, v.z);
      if (speed < 0.018 && slopeForce < mat.grip) {
        v.x = v.z = 0;
        this.restTime += dt;
      } else {
        this.restTime = 0;
        v.x += gx * dt;
        v.z += gz * dt;
        const moving = Math.hypot(v.x, v.z), deceleration = mat.rolling + moving * 0.012 + ((mat.speedDrag || 0) + (this.shot?.club < 8 ? mat.landingDrag || 0 : 0)) * moving * moving, f = Math.max(0, 1 - deceleration * dt / (moving || 1));
        v.x *= f;
        v.z *= f;
      }
      v.y = 0;
      if (this.restTime > 0.15) {
        this.status = "rest";
        return { type: "rest" };
      }
    }
    p.x += v.x * dt;
    p.z += v.z * dt;
    p.y += v.y * dt;
    if (rolling) p.y = contactHeight(c, p.x, p.z);
    const water = c.waterAt?.(p.x, p.z);
    if (water && p.y - BALL_RADIUS <= water.level || c.surface(p.x, p.z) === "water" && p.y - BALL_RADIUS <= c.height(p.x, p.z) + 5e-3) {
      const summary = this.summary(), drop = c.relief(p.x, p.z);
      this.reset(drop);
      return {
        type: "penalty",
        reason: "Water \xB7 one penalty stroke and fairway relief",
        penalty: 1,
        summary
      };
    }
    if (!c.inBounds(p.x, p.z)) {
      const summary = this.summary();
      this.reset(this.origin);
      return {
        type: "penalty",
        reason: "Out of bounds \xB7 stroke and distance",
        penalty: 1,
        summary
      };
    }
    const cup = cupContact(before, p, v, c, rolling);
    if (cup?.type === "entry") {
      if (this.shot?.carry === null) {
        this.shot.carry = Math.hypot(cup.x - this.origin.x, cup.z - this.origin.z);
      }
      p.x = cup.x;
      p.z = cup.z;
      p.y = Math.min(p.y, cup.level + BALL_RADIUS);
      v.x *= 0.35;
      v.z *= 0.35;
      v.y = Math.min(v.y, -0.08);
      this.status = "cupping";
      this.cupTime = 0;
      return { type: "cup-entry" };
    }
    if (cup?.type === "rim") {
      const dot = v.x * cup.nx + v.z * cup.nz;
      if (dot < 0) {
        v.x -= 1.2 * dot * cup.nx;
        v.z -= 1.2 * dot * cup.nz;
        this.onRim?.();
      }
    }
    const ground = contactHeight(c, p.x, p.z);
    if (!rolling && p.y <= ground) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 12; i++) {
        const t = (lo + hi) / 2, x2 = before.x + (p.x - before.x) * t, z2 = before.z + (p.z - before.z) * t, y = before.y + (p.y - before.y) * t;
        if (y > contactHeight(c, x2, z2)) lo = t;
        else hi = t;
      }
      const x = before.x + (p.x - before.x) * hi, z = before.z + (p.z - before.z) * hi;
      p.x = x;
      p.z = z;
      p.y = contactHeight(c, x, z);
      const lie = c.surface(x, z), mat = surfacePhysics(lie), s = c.slope(x, z), len = Math.hypot(s.x, 1, s.z), n = { x: -s.x / len, y: 1 / len, z: -s.z / len };
      const normal = v.x * n.x + v.y * n.y + v.z * n.z, impact = Math.max(0, -normal);
      if (this.shot?.carry === null) {
        this.shot.carry = Math.hypot(p.x - this.origin.x, p.z - this.origin.z);
      }
      if (normal < 0) {
        const tx = v.x - normal * n.x, ty = v.y - normal * n.y, tz = v.z - normal * n.z;
        const spinBrake = clamp(this.spin / 1e4, 0, 0.6), retain = Math.max(0.05, 1 - mat.contactFriction - spinBrake * impact / 24);
        v.x = tx * retain - normal * mat.restitution * n.x;
        v.y = ty * retain - normal * mat.restitution * n.y;
        v.z = tz * retain - normal * mat.restitution * n.z;
        this.spin *= 0.38;
        if (impact > 1) this.onBounce?.(impact, lie);
      }
      if (impact * mat.restitution < 0.5) {
        this.status = "rolling";
        v.y = 0;
      }
    }
    for (const tree of c.trees) {
      const x = p.x - tree.x, z = p.z - tree.z, d = Math.hypot(x, z), radius = (0.4 - 0.15 * clamp((p.y - c.height(tree.x, tree.z)) / (3.5 * tree.scale), 0, 1)) * tree.scale + BALL_RADIUS;
      if (d < radius && p.y < c.height(tree.x, tree.z) + 3.5 * tree.scale) {
        const nx = x / (d || 1), nz = z / (d || 1), dot = v.x * nx + v.z * nz;
        if (dot < 0) {
          v.x -= 1.45 * dot * nx;
          v.z -= 1.45 * dot * nz;
          p.x = tree.x + nx * radius;
          p.z = tree.z + nz * radius;
        }
      }
    }
    return null;
  }
};

// games/ripagolf/rules.js
var PREDICTIONS = [
  { id: "bogey", name: "Bogey or better", mult: 0.5, delta: 1, exact: false },
  { id: "par", name: "Par or better", mult: 1, delta: 0, exact: false },
  { id: "exact-par", name: "Exact par", mult: 1.5, delta: 0, exact: true },
  { id: "birdie", name: "Birdie or better", mult: 2, delta: -1, exact: false },
  { id: "exact-birdie", name: "Exact birdie", mult: 3, delta: -1, exact: true },
  { id: "eagle", name: "Eagle or better", mult: 5, delta: -2, exact: false },
  { id: "exact-eagle", name: "Exact eagle", mult: 8, delta: -2, exact: true },
  { id: "ace", name: "Hole-in-one", mult: 20, strokes: 1, exact: true }
];
function predictions(par) {
  return PREDICTIONS.filter(
    (p) => par === 3 ? !["eagle", "exact-eagle"].includes(p.id) : p.id !== "ace"
  );
}
function predictionWon(id, par, strokes) {
  const p = predictions(par).find((p2) => p2.id === id);
  if (!p || !Number.isInteger(strokes) || strokes < 1) return false;
  const target = p.strokes ?? par + p.delta;
  return p.exact ? strokes === target : strokes <= target;
}
function scoreName(par, strokes) {
  if (strokes === 1) return "Hole-in-one";
  const relative = strokes - par;
  return {
    "-3": "Albatross",
    "-2": "Eagle",
    "-1": "Birdie",
    0: "Par",
    1: "Bogey",
    2: "Double bogey",
    3: "Triple bogey"
  }[relative] ?? (relative < 0 ? `${-relative} under par` : `${relative} over par`);
}
function reward(id, streak) {
  const p = PREDICTIONS.find((p2) => p2.id === id);
  return p ? Math.round(1e3 * p.mult * (1 + Math.min(50, Math.max(0, streak - 1)) * 0.04)) : 0;
}

// games/shared/services/golf-validator.js
var GOLF_VERSION = "golf-v1";
function golfCourse(seed, index) {
  return new Course(Number(seed) + Math.imul(index, 2654435769) >>> 0, index);
}
function validateGolf(session, request) {
  const state = structuredClone(session.state), metrics = {};
  if (!Number.isInteger(state.holeIndex) || state.holeIndex < 1 || state.holeIndex > 1e4) {
    throw new Error("Invalid course state");
  }
  const course = golfCourse(session.seed, state.holeIndex);
  if (request.operation === "prediction") {
    if (state.prediction || state.result) throw new Error("Prediction is already locked");
    if (!predictions(course.par).some((p) => p.id === request.prediction)) {
      throw new Error("Invalid prediction");
    }
    state.prediction = request.prediction;
  } else if (request.operation === "next") {
    if (!state.result?.won) throw new Error("Win the current hole before continuing");
    state.holeIndex++;
    state.strokes = 0;
    state.prediction = null;
    state.ball = null;
    state.windTime = 0;
    state.result = null;
  } else if (request.operation === "shot") {
    if (!state.prediction || state.result) throw new Error("Lock a prediction before shooting");
    if (state.strokes >= 30) throw new Error("Stroke limit reached. Start a new run.");
    const spec = request.spec;
    if (!spec || !Number.isInteger(spec.club) || spec.club < 0 || spec.club > 8) {
      throw new Error("Invalid club");
    }
    for (const [key, lo, hi] of [
      ["power", 5e-3, 1],
      ["aim", -Math.PI, Math.PI],
      ["error", -1, 1],
      ["spin", -1, 1],
      ["shape", -1, 1],
      ["loft", -10, 10]
    ]) {
      if (!Number.isFinite(spec[key]) || spec[key] < lo || spec[key] > hi) {
        throw new Error("Invalid " + key);
      }
    }
    const wait = request.wait ?? 0;
    if (!Number.isFinite(wait) || wait < 0 || wait > 120) throw new Error("Invalid shot timing");
    const ball = new BallPhysics(course);
    if (state.ball) ball.restore(state.ball);
    const windStart = (state.windTime || 0) + wait;
    if (!ball.launch(spec)) throw new Error("Ball is not ready");
    state.strokes++;
    let event, time = windStart, steps = 0;
    for (; steps < 120 * 60; steps++) {
      time += 1 / 120;
      event = ball.update(1 / 120, time);
      if (event?.type === "penalty" || ball.status === "rest" || ball.status === "holed") break;
    }
    if (steps === 120 * 60) throw new Error("Shot did not settle within the simulation limit");
    state.windTime = time;
    state.ball = ball.snapshot();
    state.lastShot = { spec, windStart, steps: steps + 1, event: event?.type ?? null };
    if (event?.type === "penalty") state.strokes += event.penalty;
    metrics.strokes = 1 + (event?.type === "penalty" ? event.penalty : 0);
    if (ball.status === "holed") {
      const won = predictionWon(state.prediction, course.par, state.strokes);
      state.streak = won ? state.streak + 1 : 0;
      const points = won ? reward(state.prediction, state.streak) : 0;
      state.score += points;
      state.result = {
        won,
        points,
        streak: state.streak,
        score: state.score,
        name: scoreName(course.par, state.strokes)
      };
      Object.assign(metrics, {
        holes: 1,
        game_points: points,
        relative_over: Math.max(0, state.strokes - course.par),
        relative_under: Math.max(0, course.par - state.strokes),
        birdies: Number(state.strokes - course.par === -1),
        eagles: Number(state.strokes - course.par === -2),
        aces: Number(state.strokes === 1),
        won: Number(won),
        lost: Number(!won),
        streak: state.streak,
        score: state.score
      });
    }
  } else throw new Error("Unknown golf operation");
  return { state, metrics, finished: !!state.result && !state.result.won };
}
export {
  GOLF_VERSION,
  golfCourse,
  validateGolf
};
