/* TrafficSystem — pooled AI traffic for Cutup.
 *
 * - A fixed pool of meshes is reused (no allocation while driving); geometry is swapped from a cache.
 * - Cars keep to their lane, follow the car ahead, and lanes have disjoint speed bands.
 * - Spawning keeps at least one lane open per row and a periodic "wall check" dissolves any row where
 *   all lanes would be blocked, so the player is never handed an impossible situation.
 */
import * as THREE from '../../vendor/three.module.js';
import { CAR_TYPES } from './AssetManager.js';

const TYPES = [['sedan', 5], ['suv', 3], ['van', 1.6], ['truck', 1.4]];
const COLORS = [0xc0392b, 0x2c5fa8, 0xe0b020, 0xf2f2f2, 0x2b2d31, 0x7a838c, 0x2f8f5b, 0xd9702a, 0x8e5aa8, 0x9aa5b1];
const TRUCK_COLORS = [0xf2f2f2, 0xd9702a, 0x2c5fa8, 0x2f8f5b, 0x9aa5b1];
const LANE_SPEED = [[23, 27], [19, 23], [15, 19], [12, 15]];  // m/s, lane 0 = far left (fast)

export class TrafficSystem {
  constructor(scene, assets, road, opts) {
    this.assets = assets; this.road = road;
    this.lanes = opts.lanes; this.laneW = opts.laneWidth;
    this.max = opts.max || 28;
    this.cars = [];
    this._tmp = {};
    for (let i = 0; i < this.max; i++) {
      const mesh = new THREE.Mesh(assets.carGeometry('sedan', 0xffffff), assets.material);
      mesh.visible = false; mesh.rotation.order = 'YXZ'; mesh.frustumCulled = true;
      scene.add(mesh);
      this.cars.push({ mesh, active: false, s: 0, d: 0, lane: 0, speed: 0, pref: 0, L: 4.6, W: 1.84, type: 'sedan', minGap: 99, inZone: false });
    }
    this.reset();
  }

  reset() {
    this.cars.forEach(c => { c.active = false; c.mesh.visible = false; });
    this.spawnDist = 0; this.nextGap = 40; this.wallT = 0;
  }

  _pickType() {
    let r = Math.random() * TYPES.reduce((a, t) => a + t[1], 0);
    for (const [t, w] of TYPES) { if ((r -= w) <= 0) return t; }
    return 'sedan';
  }

  /** Try to place one car at distance s. Returns true when spawned. */
  spawnAt(s, playerS) {
    const free = this.cars.find(c => !c.active);
    if (!free) return false;
    const type = this._pickType(), dims = CAR_TYPES[type];
    const order = Array.from({ length: this.lanes }, (_, i) => i).sort(() => Math.random() - 0.5);
    for (let lane of order) {
      if (type === 'truck' && lane < 2) lane = 2 + (Math.random() < 0.5 ? 0 : 1);
      let blocked = false, rowCount = 0, aheadSpeed = Infinity;
      for (const c of this.cars) {
        if (!c.active) continue;
        const ds = c.s - s;
        if (c.lane === lane) {
          if (Math.abs(ds) < (c.L + dims.L) / 2 + 16) { blocked = true; break; }
          if (ds > 0 && ds < 90) aheadSpeed = Math.min(aheadSpeed, c.speed);
        } else if (Math.abs(ds) < 24) rowCount++;
      }
      if (blocked || rowCount >= this.lanes - 1) continue;
      const band = LANE_SPEED[Math.min(lane, LANE_SPEED.length - 1)];
      let pref = band[0] + Math.random() * (band[1] - band[0]);
      if (type === 'truck') pref = Math.min(pref, 16);
      pref = Math.min(pref, aheadSpeed);
      const colors = type === 'truck' ? TRUCK_COLORS : COLORS;
      Object.assign(free, {
        active: true, s, lane, d: (lane - (this.lanes - 1) / 2) * this.laneW, speed: pref, pref, type, L: dims.L, W: dims.W, minGap: 99, inZone: false
      });
      free.mesh.geometry = this.assets.carGeometry(type, colors[Math.floor(Math.random() * colors.length)]);
      free.mesh.visible = true;
      this._place(free);
      return true;
    }
    return false;
  }

  /** Fill the road ahead so a run never starts on an empty highway. */
  prefill(playerS, viewDist, density) {
    for (let s = playerS + 110; s < playerS + viewDist * 0.85; s += (55 + Math.random() * 40) / density) this.spawnAt(s, playerS);
  }

  _place(c) {
    const p = this.road.at(c.s, this._tmp);
    c.mesh.position.set(p.x + p.rx * c.d, p.y + 0.02, p.z + p.rz * c.d);
    c.mesh.rotation.set(-Math.atan(p.slope), p.h, 0);
  }

  update(dt, playerS, playerSpeed, density, viewDist) {
    // spawn by distance travelled so density feels the same at every speed
    this.spawnDist += playerSpeed * dt;
    if (this.spawnDist >= this.nextGap) {
      const ok = this.spawnAt(playerS + viewDist * 0.9 + Math.random() * 30, playerS);
      this.spawnDist = ok ? 0 : this.nextGap * 0.6;
      this.nextGap = (62 / density) * (0.6 + Math.random() * 0.8);
    }

    const act = this.cars.filter(c => c.active);
    for (const c of act) {
      let target = c.pref, ahead = null, best = Infinity;
      for (const o of act) {
        if (o === c || o.lane !== c.lane || o.s <= c.s) continue;
        if (o.s - c.s < best) { best = o.s - c.s; ahead = o; }
      }
      if (ahead) {
        const gap = best - (c.L + ahead.L) / 2;
        if (gap < 14 + c.speed * 0.8) target = Math.min(target, ahead.speed * (gap < 8 ? 0.85 : 1));
      }
      c.speed += Math.max(-5 * dt, Math.min(3 * dt, target - c.speed));
      c.s += c.speed * dt;
    }

    // wall check: never allow every lane to be blocked within ~28 m of each other, ahead of the player
    this.wallT += dt;
    if (this.wallT > 0.3) {
      this.wallT = 0;
      for (const a of act) {
        if (a.s < playerS + 45) continue;
        const lanes = new Set(), group = [];
        for (const o of act) if (Math.abs(o.s - a.s) < 14) { lanes.add(o.lane); group.push(o); }
        if (lanes.size >= this.lanes) {
          const victim = group[Math.floor(Math.random() * group.length)];
          victim.pref = Math.max(9, victim.pref - 6);
          break;
        }
      }
    }

    for (const c of act) {
      if (c.s < playerS - 70 || c.s > playerS + viewDist + 140) { c.active = false; c.mesh.visible = false; continue; }
      this._place(c);
    }
  }

  dispose(scene) { this.cars.forEach(c => scene.remove(c.mesh)); this.cars = []; }
}
