import { mph, miles } from '../shared/engine/Units.js';
/* Cutup — fast highway traffic weaving with near-miss scoring. */
import * as THREE from '../vendor/three.module.js';
import { DrivingGame } from '../shared/engine/DrivingGame.js?v=arcade-platform-1';
import { RoadGenerator, smoothstep } from '../shared/engine/RoadGenerator.js';
import { color } from '../shared/engine/MeshBuilder.js';
import { addPine, addRound, addBush, addRock, addCactus, addBuilding, addLamp, addSegment } from '../shared/engine/Scenery.js';
import { TrafficSystem } from '../shared/engine/TrafficSystem.js';
import { CAR_TYPES } from '../shared/engine/AssetManager.js';

const LANES = 4, LANE_W = 3.6, HALF = LANES * LANE_W / 2;   // 7.2 m
const BARRIER = HALF + 1.8;
const ZONE_LEN = 1800;
const DENSITY = { low: 0.6, medium: 1, high: 1.5, extreme: 2.1 };
const COMBO_WINDOW = 3.2;

const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const zoneId = (k) => (k <= 0 ? 0 : Math.floor(hash(k) * 3));   // 0 forest, 1 desert, 2 city

class Cutup extends DrivingGame {
  constructor() {
    super({
      id: 'cutup', title: 'Cutup', tagline: 'Endless Highway Traffic',
      blurb: 'Hold your speed, weave through traffic and thread the gaps. Close passes build your combo.',
      preset: 'cutup', backHref: '../../arcade.html',
      hudFields: [{ id: 'score', label: 'Score', big: true }, { id: 'best', label: 'Best' }, { id: 'speed', label: 'mph' }, { id: 'mult', label: 'Combo' }],
      controlsExtra: [['W / S  or  ↑ / ↓', 'Boost / brake']],
      vehicleExtra: { limit: BARRIER - 0.5 - 0.95, roadHalf: HALF, grassDrag: 0, wallScrape: true },
      settingsFields: [
        { type: 'select', key: 'cutup.traffic', label: 'Traffic density', options: [['low', 'Light'], ['medium', 'Normal'], ['high', 'Heavy'], ['extreme', 'Rush hour']] },
        { type: 'select', key: 'cutup.timeOfDay', label: 'Time of day', options: [['auto', 'Match site theme'], ['day', 'Day'], ['sunset', 'Sunset'], ['night', 'Night']] },
        { type: 'select', key: 'cutup.weather', label: 'Weather', options: [['clear', 'Clear'], ['fog', 'Fog'], ['rain', 'Rain']] }
      ]
    });
    this.seed = 11 + Math.floor(Math.random() * 9999);
    this.t = 0; this.score = 0; this.combo = 0; this.comboT = 0; this.maxCombo = 0; this.passes = 0; this.dist0 = 0;
  }

  demoSpeed() { return 30; }

  _colors() {
    const p = this.palette;
    this.pc = {
      asphalt: p.asphalt, shoulder: p.asphalt.clone().lerp(p.shoulder, 0.35),
      line: p.page === 'signature' ? p.line : p.line, edge: p.page === 'signature' ? p.line : p.edge,
      zone: [[p.grassA, p.grassB], [p.sand, p.sand.clone().multiplyScalar(0.85)], [p.concrete.clone().multiplyScalar(0.55), p.concrete.clone().multiplyScalar(0.45)]]
    };
  }

  _ground(s) {
    const k = Math.floor(s / ZONE_LEN), f = smoothstep(0.84, 1, s / ZONE_LEN - k);
    const a = this.pc.zone[zoneId(k)], b = this.pc.zone[zoneId(k + 1)];
    return [a[0].clone().lerp(b[0], f), a[1].clone().lerp(b[1], f)];
  }

  createRoad() {
    this._colors();
    const g = this, r = Math.sin;
    const ph = [1.7, 0.4, 3.9, 2.6];
    return new RoadGenerator({
      seed: this.seed, halfWidth: HALF, material: this.assets.material,
      terrainAmp: 3.5, terrainEdge: HALF + 2.0, terrainSpan: 50,
      curvature: (s) => {
        const straight = smoothstep(0.05, 0.65, r(s / 1700 + ph[0]));
        return straight * (0.0016 * r(s / 520 + ph[1]) + 0.0012 * r(s / 230 + ph[2]));
      },
      elevation: (s) => 3 * r(s / 700 + ph[3]) + 1.5 * r(s / 290 + ph[0]),
      profile: (s, road) => {
        const c = g.pc, [ga, gb] = g._ground(s), out = [];
        const gr = (o) => ({ o, w: road.weight(o), c: ga, c2: gb, v: 0.04 });
        [-90, -60, -40, -28, -20, -14, -10.5].forEach(o => out.push(gr(o)));
        out.push({ o: -(HALF + 2), w: 0, c: ga, c2: gb, v: 0.04 });
        out.push({ o: -(HALF + 2), c: c.shoulder }, { o: -HALF, c: c.shoulder }, { o: -HALF, c: c.asphalt });
        out.push({ o: HALF, c: c.asphalt }, { o: HALF, c: c.shoulder }, { o: HALF + 2, c: c.shoulder });
        out.push({ o: HALF + 2, w: 0, c: ga, c2: gb, v: 0.04 });
        [10.5, 14, 20, 28, 40, 60, 90].forEach(o => out.push(gr(o)));
        return out;
      },
      markings: () => {
        const m = [{ o: -HALF + 0.3, w: 0.18, c: g.pc.edge }, { o: HALF - 0.3, w: 0.18, c: g.pc.edge }];
        for (let i = 1; i < LANES; i++) m.push({ o: -HALF + i * LANE_W, w: 0.14, c: g.pc.line, dash: 4 });
        return m;
      },
      decorate: (b, ctx) => g._decorate(b, ctx)
    });
  }

  onPaletteApplied() {
    this._colors();
  }

  _decorate(b, ctx) {
    const { road, rng, s0, s1, quality: q, N, D, c } = ctx, p = this.palette, concrete = p.concrete, steel = color(0x7b8088);
    const tmp = {};
    const pts = (i) => road.pts.get(i);

    for (let j = 0; j < N; j++) {
      const idx = ctx.i0 + j, a = pts(idx), bb = pts(idx + 1);
      // jersey barriers
      for (const side of [-1, 1]) {
        const o = side * BARRIER;
        addSegment(b, a.x - Math.cos(a.h) * o, a.y, a.z + Math.sin(a.h) * o, bb.x - Math.cos(bb.h) * o, bb.y, bb.z + Math.sin(bb.h) * o, 0.5, 0.95, concrete);
      }
      // street lamps every 30 m, alternating sides
      if (idx % 10 === 0) {
        const side = (idx / 10) % 2 === 0 ? -1 : 1, o = side * (BARRIER + 1.4);
        addLamp(b, a.x - Math.cos(a.h) * o, a.y, a.z + Math.sin(a.h) * o, -Math.sign(o) * -Math.cos(a.h), -Math.sign(o) * Math.sin(a.h), p);
      }
      // sign gantry every 480 m
      if (idx % 160 === 80) this._gantry(b, a, steel, concrete, p);
      // overpass every ~1.1 km
      if (idx % 360 === 200) this._overpass(b, a, concrete);
    }

    // zone scenery (chosen by the middle of the chunk)
    const sm = (s0 + s1) / 2, zone = zoneId(Math.floor(sm / ZONE_LEN));
    const place = (s, o) => road.surface(s, o, tmp);
    for (const side of [-1, 1]) {
      if (zone === 0) {
        for (let i = 0, n = Math.round(7 * q); i < n; i++) {
          const pt = place(s0 + rng() * (s1 - s0), side * (14 + Math.pow(rng(), 1.3) * 50)), sc = 0.9 + rng() * 0.9;
          if (rng() < 0.55) addPine(b, pt.x, pt.y, pt.z, sc, rng, p); else addRound(b, pt.x, pt.y, pt.z, sc, rng, p);
        }
        for (let i = 0, n = Math.round(3 * q); i < n; i++) { const pt = place(s0 + rng() * (s1 - s0), side * (11 + rng() * 8)); addBush(b, pt.x, pt.y, pt.z, 0.7 + rng() * 0.7, rng, p); }
      } else if (zone === 1) {
        for (let i = 0, n = Math.round(3 * q); i < n; i++) { const pt = place(s0 + rng() * (s1 - s0), side * (13 + rng() * 45)); addCactus(b, pt.x, pt.y, pt.z, 0.9 + rng() * 0.9, p); }
        for (let i = 0, n = Math.round(3 * q); i < n; i++) { const pt = place(s0 + rng() * (s1 - s0), side * (12 + rng() * 55)); addRock(b, pt.x, pt.y - 0.1, pt.z, 0.8 + rng() * 2.2, rng, p.sand.clone().multiplyScalar(0.7)); }
      } else {
        for (let i = 0, n = Math.round(3.5 * q); i < n; i++) {
          const pt = place(s0 + rng() * (s1 - s0), side * (20 + rng() * 42));
          addBuilding(b, pt.x, pt.y - 1, pt.z, 10 + rng() * 14, 10 + rng() * 12, 14 + Math.pow(rng(), 2) * 62, pt.h, p, rng);
        }
      }
    }
  }

  _gantry(b, a, steel, concrete, p) {
    const rx = -Math.cos(a.h), rz = Math.sin(a.h), at = (o, y) => [a.x + rx * o, a.y + y, a.z + rz * o];
    for (const s of [-1, 1]) { const [x, y, z] = at(s * (BARRIER + 1.2), 3.7); b.box(x, y, z, 0.5, 7.4, 0.5, a.h, steel); }
    const [bx, by, bz] = at(0, 7.3);
    b.box(bx, by, bz, (BARRIER + 1.2) * 2, 0.7, 0.6, a.h, steel);
    const green = p.page === 'signature' ? color(0x1d6b46) : p.accent.clone().multiplyScalar(0.55);
    const white = color(0xf4f6f2);
    for (const o of [-4.2, 4.2]) {
      const [x, y, z] = at(o, 5.9);
      b.box(x, y, z, 5.4, 2.2, 0.2, a.h, green);
      b.box(x, y + 0.45, z, 4.2, 0.18, 0.24, a.h, white);
      b.box(x, y - 0.1, z, 3.0, 0.18, 0.24, a.h, white);
    }
  }

  _overpass(b, a, concrete) {
    const rx = -Math.cos(a.h), rz = Math.sin(a.h);
    b.box(a.x, a.y + 7.2, a.z, 46, 1.1, 9, a.h, concrete, { bottom: true });
    for (const f of [-4.3, 4.3]) b.box(a.x + Math.sin(a.h) * f, a.y + 8.0, a.z + Math.cos(a.h) * f, 46, 0.55, 0.3, a.h, concrete);
    for (const s of [-1, 1]) {
      const o = s * (BARRIER + 3.5);
      b.box(a.x + rx * o, a.y + 3.3, a.z + rz * o, 1.6, 7.0, 3.4, a.h, concrete);
    }
  }

  createTraffic() {
    this.traffic = new TrafficSystem(this.scene, this.assets, this.road, { lanes: LANES, laneWidth: LANE_W, max: 28 });
  }

  async init(root) {
    await super.init(root);
    if (this.road) { this.createTraffic(); }
  }

  get densityMul() { return DENSITY[this.settings.get('cutup.traffic')] || 1; }

  /* ---------- run flow ---------- */
  resetRun() {
    this.t = 0; this.score = 0; this.combo = 0; this.comboT = 0; this.maxCombo = 0; this.passes = 0; this.newBest = false;
    this.traffic && this.traffic.reset();
  }

  onRunStart() {
    this.vehicle.speed = 30; this.vehicle.targetSpeed = 34;
    this.traffic.reset();
    this.traffic.prefill(this.vehicle.s, this.view, this.densityMul);
    this.hud.toast('GO', 'info');
  }

  beforeVehicle(dt, inp, st) {
    const v = this.vehicle;
    if (st !== 'playing') {
      if (st === 'title') { v.assist = 1; v.autoSpeed = true; v.targetSpeed = this.demoSpeed(); }
      return;
    }
    v.assist = 0; v.autoSpeed = true;
    const base = 34 + Math.min(1, this.t / 150) * 22;                  // gentle ramp to ~200 km/h
    v.targetSpeed = Math.max(27, Math.min(72, base + (inp.throttle > 0 ? 13 : inp.throttle < 0 ? -9 : 0)));
  }

  updateRun(dt, st) {
    const v = this.vehicle, T = this.traffic;
    if (!T) return;
    if (st === 'title') { return; }
    const dens = this.densityMul * (0.85 + 0.4 * Math.min(1, this.t / 150));
    T.update(dt, v.s, v.speed, dens, this.view);
    if (st !== 'playing') return;

    this.t += dt;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    const mult = this._mult();
    this.score += dt * (6 + v.speed * 0.5) * (1 + Math.min(this.t, 300) / 600) * mult;

    const P = CAR_TYPES.player;
    for (const c of T.cars) {
      if (!c.active) continue;
      const ds = c.s - v.s, dd = c.d - v.d;
      const hl = (P.L + c.L) / 2, hw = (P.W + c.W) / 2;
      if (Math.abs(ds) < hl && Math.abs(dd) < hw) { this._crash(dd); return; }
      const zone = P.L / 2 + c.L / 2 + 0.6;
      if (Math.abs(ds) < zone) {
        c.inZone = true;
        c.minGap = Math.min(c.minGap, Math.abs(dd) - (P.W + c.W) / 2);
      } else if (c.inZone) {
        c.inZone = false;
        if (ds < 0) this._passed(c.minGap);
        c.minGap = 99;
      }
    }
  }

  _mult() { return Math.min(6, 1 + this.combo * 0.5); }

  _passed(gap) {
    let base = 0, label = '', level = 0;
    if (gap < 0.75) { base = 200; label = 'NEAR MISS'; level = 2; }
    else if (gap < 1.3) { base = 80; label = 'CLOSE PASS'; level = 1; }
    else return;
    this.combo++; this.passes++; this.maxCombo = Math.max(this.maxCombo, this.combo); this.comboT = COMBO_WINDOW;
    const pts = Math.round(base * this._mult());
    this.score += pts;
    this.hud.toast(label + '  +' + pts, level === 2 ? 'hot' : 'ok');
    this.audio.nearMiss(level);
  }

  _crash(dd) {
    this.vehicle.crash(dd > 0 ? -1 : 1);
    this.audio.crash();
    this.cameraCtl.addShake(0.9);
    this.hud.flash();
    this.hud.toast('CRASH', 'bad');
    const final = Math.floor(this.score);
    this.newBest = this.settings.submitRecord('cutup.best', final);
    this.endRun(() => ({
      title: this.newBest ? 'New best!' : 'Crashed',
      score: final.toLocaleString() + ' pts',
      lines: [
        'Best: ' + Math.max(final, this.settings.record('cutup.best')).toLocaleString(),
        'Distance: ' + miles(this.vehicle.s),
        'Close passes: ' + this.passes + '   Best combo: ' + this.maxCombo,
        'Time: ' + Math.floor(this.t) + ' s'
      ],
      primary: 'Drive again'
    }), 1.3);
  }

  updateHud() {
    const v = this.vehicle, score = Math.floor(this.score), best = Math.max(score, this.settings.record('cutup.best'));
    this.hud.set('score', score.toLocaleString());
    this.hud.set('best', best.toLocaleString());
    this.hud.set('speed', String(mph(v.speed)));
    this.hud.set('mult', '×' + this._mult().toFixed(1));
    this.hud.bar(this.comboT / COMBO_WINDOW);
    this.hud.showPedals(this.settings.controlMode() === 'touch' || this.settings.controlMode() === 'tilt');
  }

  runMetrics() { return {score:Math.floor(this.score),seconds:this.t,distance:Math.max(0,this.vehicle.s-this.dist0),passes:this.passes,combo:this.maxCombo}; }
  titleRecord() {
    const b = this.settings.record('cutup.best');
    return b > 0 ? 'Best score: ' + b.toLocaleString() : '';
  }

  saveRecords() {
    if (this.state === 'playing' || this.state === 'paused') this.settings.submitRecord('cutup.best', Math.floor(this.score));
  }

  destroy() { this.traffic && this.traffic.dispose(this.scene); super.destroy(); }
}

export default Cutup;
