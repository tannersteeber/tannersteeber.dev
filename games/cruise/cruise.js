import { PartPickups } from './PartPickups.js';
import { mph, miles } from '../shared/engine/Units.js';
/* Cruise — endless, relaxing drive along winding procedural backroads. */
import * as THREE from '../vendor/three.module.js';
import { DrivingGame } from '../shared/engine/DrivingGame.js?v=20261026-brand-1';
import { RoadGenerator, smoothstep } from '../shared/engine/RoadGenerator.js';
import { color } from '../shared/engine/MeshBuilder.js';
import { addPine, addRound, addBush, addRock, addHouse } from '../shared/engine/Scenery.js';

const HALF = 3.4;        // half road width (two 3.4 m lanes)
const SHOULDER = 5.2;    // outer edge of the gravel shoulder

const forest = (s) => smoothstep(-0.25, 0.55, Math.sin(s / 1300 + 2.1) + 0.55 * Math.sin(s / 430 + 0.7));
const pineShare = (s) => 0.5 + 0.5 * Math.sin(s / 1700 + 4);
const autumnAt = (s) => smoothstep(0.35, 0.8, Math.sin(s / 2800 + 0.4));

class Cruise extends DrivingGame {
  constructor() {
    super({
      id: 'cruise', title: 'Cruise', tagline: 'Endless Scenic Driving',
      blurb: 'Wind through hills, forests and open fields and collect small car parts along the way.',
      preset: 'cruise', backHref: '../../arcade.html',
      hudFields: [{ id: 'speed', label: 'mph', big: true }, { id: 'dist', label: 'Distance' }, { id: 'time', label: 'Time' }, { id: 'parts', label: 'Parts' }, { id: 'score', label: 'Score' }],
      controlsExtra: [['W / S  or  ↑ / ↓', 'Faster / slower']],
      vehicleExtra: { limit: 8.4, roadHalf: HALF, grassDrag: 0.45, wallScrape: false },
      settingsFields: [
        { type: 'check', key: 'cruise.autoSpeed', label: 'Automatic speed' },
        { type: 'range', key: 'cruise.speed', label: 'Cruising speed', min: 8, max: 40, step: 1, format: v => mph(v) + ' mph', show: () => true },
        { type: 'check', key: 'cruise.assist', label: 'Road assist (keeps you in lane)' },
        { type: 'select', key: 'cruise.timeOfDay', label: 'Time of day', options: [['auto', 'Match site theme'], ['day', 'Day'], ['sunset', 'Sunset'], ['night', 'Night']] },
        { type: 'select', key: 'cruise.weather', label: 'Weather', options: [['clear', 'Clear'], ['fog', 'Fog'], ['rain', 'Rain']] }
      ]
    });
    const q = new URLSearchParams(location.search).get('seed');
    this.seed = q ? (parseInt(q, 10) || 1) : 1 + Math.floor(Math.random() * 99999);
    this.runTime = 0; this.speedAdj = 0;
  }

  async init(root) {
    await super.init(root);
    if (!this.road) return;
    this.pickups = new PartPickups(this.scene, this.road, this.seed, this.palette, part => {
      this.parts++; this.score += part.points;
      this.hud.toast(part.name + '  +' + part.points, 'ok');
      this.audio.nearMiss(1);
      this.updateHud();
    });
    this.pickups.reset(this.view);
  }

  demoSpeed() { return 18; }

  _colors() {
    const p = this.palette;
    this.pc = {
      grassA: p.grassA, grassB: p.grassB, asphalt: p.asphalt, shoulder: p.shoulder,
      edge: p.page === 'signature' ? p.line : p.edge,
      center: p.page === 'signature' ? color(0xe9b92e) : p.line
    };
  }

  createRoad() {
    this._colors();
    const g = this, r = (s) => Math.sin(s);
    const prof = (s, road) => {
      const c = g.pc, w = (o) => road.weight(o), out = [];
      const grass = (o) => ({ o, w: w(o), c: c.grassA, c2: c.grassB, v: 0.05 });
      [-70, -48, -34, -24, -16, -10, -6.8].forEach(o => out.push(grass(o)));
      out.push({ o: -SHOULDER, w: 0, c: c.grassA, c2: c.grassB, v: 0.05 });
      out.push({ o: -SHOULDER, c: c.shoulder }, { o: -HALF, c: c.shoulder }, { o: -HALF, c: c.asphalt });
      out.push({ o: HALF, c: c.asphalt }, { o: HALF, c: c.shoulder }, { o: SHOULDER, c: c.shoulder });
      out.push({ o: SHOULDER, w: 0, c: c.grassA, c2: c.grassB, v: 0.05 });
      [6.8, 10, 16, 24, 34, 48, 70].forEach(o => out.push(grass(o)));
      return out;
    };
    const ph = [0.7, 2.1, 4.4, 1.3, 5.2, 3.3];
    return new RoadGenerator({
      seed: this.seed, halfWidth: HALF, material: this.assets.material,
      terrainAmp: 8, terrainEdge: SHOULDER, terrainSpan: 45,
      curvature: (s) => {
        const tight = 1 + 1.5 * Math.pow(Math.max(0, r(s / 1100 + ph[4])), 2);
        const k = 0.0045 * r(s / 260 + ph[0]) + 0.004 * r(s / 130 + ph[1]) + 0.003 * r(s / 610 + ph[2]) + 0.004 * tight * r(s / 55 + ph[3]) * 0.8;
        return Math.max(-0.0125, Math.min(0.0125, k));
      },
      elevation: (s) => 6 * r(s / 310 + ph[5]) + 3 * r(s / 140 + ph[1]) + 4 * r(s / 700 + ph[0]),
      profile: prof,
      markings: () => [
        { o: -HALF + 0.3, w: 0.14, c: g.pc.edge }, { o: HALF - 0.3, w: 0.14, c: g.pc.edge },
        { o: 0, w: 0.14, c: g.pc.center, dash: 4 }
      ],
      decorate: (b, ctx) => g._decorate(b, ctx)
    });
  }

  onPaletteApplied() { this._colors(); this.pickups?.setPalette(this.palette); }

  _decorate(b, ctx) {
    const { road, rng, s0, s1, quality: q } = ctx, p = this.palette, o3 = {};
    const sm = (s0 + s1) / 2, f = forest(sm), pines = pineShare(sm), aut = autumnAt(sm);
    const place = (s, o) => road.surface(s, o, o3);

    const trees = Math.round((3 + 30 * f) * q);
    for (const side of [-1, 1]) {
      for (let i = 0; i < trees; i++) {
        const s = s0 + rng() * (s1 - s0), o = side * (6.8 + Math.pow(rng(), 1.5) * 50), sc = 0.8 + rng() * 0.9;
        const pt = place(s, o);
        if (rng() < pines) addPine(b, pt.x, pt.y, pt.z, sc, rng, p); else addRound(b, pt.x, pt.y, pt.z, sc, rng, p, aut);
      }
      const bushes = Math.round((3 + 8 * f) * q);
      for (let i = 0; i < bushes; i++) {
        const s = s0 + rng() * (s1 - s0), o = side * (6.2 + rng() * 9);
        const pt = place(s, o);
        addBush(b, pt.x, pt.y, pt.z, 0.6 + rng() * 0.8, rng, p);
      }
    }
    // rocks
    for (let i = 0, n = Math.round(3 * q); i < n; i++) {
      const pt = place(s0 + rng() * (s1 - s0), (rng() < 0.5 ? -1 : 1) * (7 + rng() * 35));
      addRock(b, pt.x, pt.y - 0.1, pt.z, 0.6 + rng() * 1.6, rng, p.mountain);
    }
    // open-field details: fences and the odd house
    if (f < 0.35) {
      if (rng() < 0.75) {
        const rail = p.trunk.clone().lerp(color(0xb89a70), 0.45);
        const side = rng() < 0.5 ? -1 : 1;
        for (let j = 0; j < ctx.N; j += 2) {
          const a = road.surface(s0 + j * ctx.D, side * 6.9, {}), c2 = road.surface(s0 + (j + 2) * ctx.D, side * 6.9, {});
          b.box(a.x, a.y + 0.5, a.z, 0.14, 1.0, 0.14, a.h, rail);
          const dx = c2.x - a.x, dz = c2.z - a.z;
          b.box((a.x + c2.x) / 2, (a.y + c2.y) / 2 + 0.85, (a.z + c2.z) / 2, 0.06, 0.12, Math.hypot(dx, dz), Math.atan2(dx, dz), rail);
        }
      }
      if (rng() < 0.1) {
        const side = rng() < 0.5 ? -1 : 1, pt = place(s0 + rng() * (s1 - s0), side * (22 + rng() * 22));
        addHouse(b, pt.x, pt.y - 0.2, pt.z, pt.h + (rng() < 0.5 ? 0 : Math.PI / 2), p, rng);
      }
    }
    // reflector posts
    const post = color(0xf0f0ee);
    for (const side of [-1, 1]) {
      const pt = place(s0 + 15, side * (SHOULDER + 0.2));
      b.box(pt.x, pt.y + 0.45, pt.z, 0.08, 0.9, 0.08, 0, post);
    }
  }

  beforeVehicle(dt, inp, st) {
    const v = this.vehicle, s = this.settings;
    if (st !== 'playing') { v.assist = 1; v.autoSpeed = true; v.targetSpeed = this.demoSpeed(); return; }
    v.assist = s.get('cruise.assist') ? 1 : 0;
    v.autoSpeed = s.get('cruise.autoSpeed');
    if (v.autoSpeed) {
      this.speedAdj = Math.max(-16, Math.min(16, this.speedAdj + inp.throttle * 9 * dt));
      v.targetSpeed = Math.max(6, Math.min(42, s.get('cruise.speed') + this.speedAdj));
    }
  }

  resetRun() { this.runTime = 0; this.speedAdj = 0; this.parts = 0; this.score = 0; this.pickups?.reset(this.view); }
  onRunStart() { this.vehicle.speed = Math.max(this.vehicle.speed, 8); }

  updateRun(dt, st) {
    if (st === 'playing') this.runTime += dt;
    this.pickups?.update(dt, this.vehicle, st === 'playing', this.view);
  }

  updateHud() {
    const v = this.vehicle, t = Math.floor(this.runTime);
    this.hud.set('speed', String(mph(v.speed)));
    this.hud.set('dist', miles(v.s));
    this.hud.set('parts', String(this.parts));
    this.hud.set('score', this.score.toLocaleString());
    this.hud.set('time', Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'));
    this.hud.showPedals(this.state === 'playing');
  }

  titleRecord() {
    const d = this.settings.record('cruise.distance');
    return d > 0 ? 'Longest drive: ' + miles(d) : '';
  }

  destroy() { this.pickups?.dispose(); super.destroy(); }

  saveRecords() {
    if (this.vehicle && (this.state === 'playing' || this.state === 'paused')) this.settings.submitRecord('cruise.distance', Math.round(this.vehicle.s));
  }
}

export default Cruise;
