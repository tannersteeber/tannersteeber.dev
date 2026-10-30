/* RoadGenerator — endless procedural road.
 *
 * The centre line is integrated from a curvature function sampled every `D` metres (so curves are
 * perfectly smooth and the road can never have gaps). Chunks of N samples are turned into one merged,
 * vertex-coloured mesh (ground + road + markings) plus one scenery mesh. Chunks behind the player are
 * disposed and chunks ahead are built incrementally, so cost stays constant however far the car travels.
 *
 * Coordinate convention: heading h gives forward f = (sin h, 0, cos h); right = (-cos h, 0, sin h);
 * increasing h turns left. Lateral offset o is positive to the right of the centre line.
 */
import * as THREE from '../../vendor/three.module.js';
import { MeshBuilder } from './MeshBuilder.js';

import { mulberry32, smoothstep } from './MathUtils.js';

// Preserve the existing module API for driving-game extensions.
export { mulberry32, smoothstep } from './MathUtils.js';

const START = -40; // first sample index (chunk -2 starts here)

export class RoadGenerator {
  /**
   * opts: seed, halfWidth, curvature(s), elevation(s), profile(s, road) -> [{o,dy,w,c,c2,v}],
   *       markings(road) -> [{o,w,c,dash}], decorate(builder, ctx), material,
   *       terrainAmp, terrainEdge, terrainSpan
   */
  constructor(opts) {
    this.D = 3;
    this.N = 20;
    Object.assign(this, opts);
    this.seed = opts.seed || 1;
    const r = mulberry32(this.seed * 31 + 7);
    this.ph = Array.from({ length: 8 }, () => r() * Math.PI * 2);
    this.terrainSpan = opts.terrainSpan || 40;
    this.terrainAmp = opts.terrainAmp || 0;
    this.quality = 1;
    this.group = new THREE.Group();
    this.pts = new Map();
    this.chunks = new Map();
    this._e0 = this.elevation(0);
    this._col = new THREE.Color();
    this._tmpA = {};
    this._tmpB = {};
    const p0 = {
      x: 0,
      y: this.elevation(START * this.D) - this._e0,
      z: 0,
      h: 0,
      k: this.curvature(START * this.D),
    };
    this.pts.set(START, p0);
    this.genIdx = START;
  }

  reset() {
    this.rebuildAll();
    this.pts.clear();
    this.pts.set(START, {
      x: 0,
      y: this.elevation(START * this.D) - this._e0,
      z: 0,
      h: 0,
      k: this.curvature(START * this.D),
    });
    this.genIdx = START;
  }

  _ensure(idx) {
    while (this.genIdx < idx) {
      const i = this.genIdx, prev = this.pts.get(i);
      const h = prev.h + prev.k * this.D, havg = (prev.h + h) / 2;
      const s = (i + 1) * this.D;
      this.pts.set(i + 1, {
        x: prev.x + Math.sin(havg) * this.D,
        z: prev.z + Math.cos(havg) * this.D,
        y: this.elevation(s) - this._e0,
        h,
        k: this.curvature(s),
      });
      this.genIdx = i + 1;
    }
  }

  /** Interpolated centre-line sample at distance s (written into out). */
  at(s, out) {
    out = out || {};
    const fi = s / this.D, i = Math.floor(fi), t = fi - i;
    this._ensure(i + 2);
    const a = this.pts.get(i) || this.pts.get(START), b = this.pts.get(i + 1) || a;
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.z = a.z + (b.z - a.z) * t;
    out.h = a.h + (b.h - a.h) * t;
    out.k = a.k;
    out.fx = Math.sin(out.h);
    out.fz = Math.cos(out.h);
    out.rx = -out.fz;
    out.rz = out.fx;
    out.slope = (b.y - a.y) / this.D;
    return out;
  }

  /* ----- terrain helpers (shared by the mesh and by scenery placement) ----- */
  weight(o) {
    return smoothstep(
      this.terrainEdge || 0,
      (this.terrainEdge || 0) + this.terrainSpan,
      Math.abs(o),
    );
  }
  noise(x, z) {
    const p = this.ph;
    return Math.sin(x * 0.0113 + p[0]) * Math.cos(z * 0.0097 + p[1]) * 0.6 +
      Math.sin(x * 0.027 + z * 0.019 + p[2]) * 0.25 + Math.sin(z * 0.045 - x * 0.031 + p[3]) * 0.15;
  }
  patch(x, z) {
    const p = this.ph;
    return 0.5 +
      0.5 * Math.sin(x * 0.006 + z * 0.004 + p[4]) * Math.sin(z * 0.007 - x * 0.003 + p[5]);
  }
  terrainHeight(x, z) {
    return this.terrainAmp * (0.5 + 0.5 * this.noise(x, z));
  }

  /** World position of the ground at distance s, lateral offset o. */
  surface(s, o, out) {
    out = out || {};
    const p = this.at(s, this._tmpB);
    const x = p.x + p.rx * o, z = p.z + p.rz * o;
    out.x = x;
    out.z = z;
    out.h = p.h;
    out.y = p.y + this.terrainHeight(x, z) * this.weight(o);
    return out;
  }

  _tint(e, x, z) {
    const c = this._col.copy(e.c);
    if (e.c2) c.lerp(e.c2, this.patch(x, z));
    if (e.v) c.multiplyScalar(1 + Math.sin(x * 0.37 + z * 0.29) * e.v);
    return c;
  }

  _buildChunk(c) {
    const N = this.N, D = this.D, i0 = c * N;
    this._ensure(i0 + N + 2);
    const g = new MeshBuilder();
    let prev = null;
    for (let j = 0; j <= N; j++) {
      const idx = i0 + j, p = this.pts.get(idx);
      const rx = -Math.cos(p.h), rz = Math.sin(p.h);
      const prof = this.profile(idx * D, this);
      const row = [];
      for (const e of prof) {
        const x = p.x + rx * e.o, z = p.z + rz * e.o;
        let y = p.y + (e.dy || 0);
        if (e.w) y += this.terrainHeight(x, z) * e.w;
        row.push(g.vert(x, y, z, this._tint(e, x, z)));
      }
      if (prev) {
        for (let k = 0; k < row.length - 1; k++) g.quad(prev[k], prev[k + 1], row[k + 1], row[k]);
      }
      prev = row;
    }
    // lane markings (slightly raised quads)
    const marks = this.markings ? this.markings(this) : [];
    for (const m of marks) {
      for (let j = 0; j < N; j++) {
        const idx = i0 + j;
        if (m.dash && (idx % m.dash) >= m.dash / 2) continue;
        const a = this.pts.get(idx), b = this.pts.get(idx + 1);
        const ar = [-Math.cos(a.h), Math.sin(a.h)],
          br = [-Math.cos(b.h), Math.sin(b.h)],
          hw = m.w / 2;
        const y = 0.04;
        const q = [
          g.vert(a.x + ar[0] * (m.o - hw), a.y + y, a.z + ar[1] * (m.o - hw), m.c),
          g.vert(a.x + ar[0] * (m.o + hw), a.y + y, a.z + ar[1] * (m.o + hw), m.c),
          g.vert(b.x + br[0] * (m.o + hw), b.y + y, b.z + br[1] * (m.o + hw), m.c),
          g.vert(b.x + br[0] * (m.o - hw), b.y + y, b.z + br[1] * (m.o - hw), m.c),
        ];
        g.quad(q[0], q[1], q[2], q[3]);
      }
    }
    const chunk = { c, ground: new THREE.Mesh(g.build(true), this.material), scenery: null };
    chunk.ground.matrixAutoUpdate = false;
    chunk.ground.updateMatrix();
    this.group.add(chunk.ground);
    if (this.decorate) {
      const sb = new MeshBuilder();
      this.decorate(sb, {
        c,
        i0,
        N,
        D,
        road: this,
        rng: mulberry32(this.seed * 7919 + c * 104729 + 13),
        s0: i0 * D,
        s1: (i0 + N) * D,
        quality: this.quality,
      });
      if (!sb.empty) {
        chunk.scenery = new THREE.Mesh(sb.build(false), this.material);
        chunk.scenery.matrixAutoUpdate = false;
        chunk.scenery.updateMatrix();
        this.group.add(chunk.scenery);
      }
    }
    this.chunks.set(c, chunk);
  }

  _removeChunk(c, ch, keepPoints) {
    for (const m of [ch.ground, ch.scenery]) {
      if (m) {
        this.group.remove(m);
        m.geometry.dispose();
      }
    }
    this.chunks.delete(c);
    if (!keepPoints) { for (let i = c * this.N; i < c * this.N + this.N; i++) this.pts.delete(i); }
  }

  /** Keep chunks covering [sCar - back, sCar + ahead]; build up to `budget` new chunks this call. */
  update(sCar, ahead, back, budget = 1) {
    const span = this.N * this.D;
    const cStart = Math.max(-2, Math.floor((sCar - back) / span)),
      cEnd = Math.floor((sCar + ahead) / span);
    this._ensure((cEnd + 2) * this.N);
    for (const i of this.pts.keys()) if (i < cStart * this.N) this.pts.delete(i);
    for (const [c, ch] of Array.from(this.chunks)) {
      if (c < cStart || c > cEnd) this._removeChunk(c, ch, false);
    }
    const cur = Math.floor(sCar / span), todo = [];
    for (let c = cStart; c <= cEnd; c++) if (!this.chunks.has(c)) todo.push(c);
    todo.sort((a, b) => Math.abs(a - cur) - Math.abs(b - cur));
    for (let i = 0; i < todo.length && i < budget; i++) this._buildChunk(todo[i]);
    return todo.length > budget ? todo.length - budget : 0; // chunks still pending
  }

  /** Drop all meshes (e.g. palette changed); they are rebuilt on the next update(). */
  rebuildAll() {
    for (const [c, ch] of Array.from(this.chunks)) this._removeChunk(c, ch, true);
  }

  dispose() {
    this.rebuildAll();
    this.pts.clear();
  }
}
