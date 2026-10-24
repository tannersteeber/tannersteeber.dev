/* MeshBuilder — accumulates vertex-coloured triangles so a whole road chunk, a car, or a
 * stretch of scenery becomes ONE draw call. */
import * as THREE from '../../vendor/three.module.js';

const _c = {};
export function color(hex) { return _c[hex] || (_c[hex] = new THREE.Color(hex)); }

export class MeshBuilder {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.idx = []; this.n = 0; }

  vert(x, y, z, c, nx = 0, ny = 1, nz = 0) {
    this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.col.push(c.r, c.g, c.b);
    return this.n++;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }

  /** Flat polygon (3 or 4 points) with the winding auto-corrected to face `out`. */
  face(pts, c, out) {
    const [p0, p1, p2] = pts;
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p2[0] - p1[0], vy = p2[1] - p1[1], vz = p2[2] - p1[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let list = pts;
    if (nx * out[0] + ny * out[1] + nz * out[2] < 0) { list = pts.slice().reverse(); nx = -nx; ny = -ny; nz = -nz; }
    const ids = list.map(p => this.vert(p[0], p[1], p[2], c, nx, ny, nz));
    this.tri(ids[0], ids[1], ids[2]);
    if (ids.length === 4) this.tri(ids[0], ids[2], ids[3]);
  }

  /** Box centred at (cx,cy,cz). Local z follows `yaw` (matches three.js rotation.y). */
  box(cx, cy, cz, sx, sy, sz, yaw, c, opts) {
    const cs = Math.cos(yaw), sn = Math.sin(yaw), hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const P = (lx, ly, lz) => [cx + lx * cs + lz * sn, cy + ly, cz - lx * sn + lz * cs];
    this.face([P(-hx, hy, -hz), P(-hx, hy, hz), P(hx, hy, hz), P(hx, hy, -hz)], c, [0, 1, 0]);
    this.face([P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz)], c, [sn, 0, cs]);
    this.face([P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz)], c, [-sn, 0, -cs]);
    this.face([P(hx, -hy, -hz), P(hx, -hy, hz), P(hx, hy, hz), P(hx, hy, -hz)], c, [cs, 0, -sn]);
    this.face([P(-hx, -hy, -hz), P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz)], c, [-cs, 0, sn]);
    if (opts && opts.bottom) this.face([P(-hx, -hy, -hz), P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, -hy, -hz)], c, [0, -1, 0]);
  }

  /** Upright cone / frustum / cylinder; colour blends from c (base) to c2 (top). */
  cyl(cx, cy, cz, rb, rt, h, seg, c, c2, opts) {
    c2 = c2 || c;
    const slope = (rb - rt) / h, rot = (opts && opts.rot) || 0;
    const b = [], t = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2 + rot, co = Math.cos(a), si = Math.sin(a);
      const l = Math.hypot(1, slope);
      b.push(this.vert(cx + rb * co, cy, cz + rb * si, c, co / l, slope / l, si / l));
      t.push(this.vert(cx + rt * co, cy + h, cz + rt * si, c2, co / l, slope / l, si / l));
    }
    for (let i = 0; i < seg; i++) {
      this.tri(b[i + 1], b[i], t[i]);
      if (rt > 0) this.tri(b[i + 1], t[i], t[i + 1]);
    }
    if (opts && opts.cap && rt > 0) {
      const ctr = this.vert(cx, cy + h, cz, c2, 0, 1, 0);
      const ring = t.map((_, i) => this.vert(cx + rt * Math.cos((i / seg) * Math.PI * 2), cy + h, cz + rt * Math.sin((i / seg) * Math.PI * 2), c2, 0, 1, 0));
      for (let i = 0; i < seg; i++) this.tri(ctr, ring[i + 1], ring[i]);
    }
  }

  /** Wheel with its axle along x. */
  wheel(cx, cy, cz, r, w, c) {
    const seg = 10, hw = w / 2;
    const ring = (s) => Array.from({ length: seg }, (_, i) => {
      const a = (i / seg) * Math.PI * 2;
      return [cx + s * hw, cy + r * Math.cos(a), cz + r * Math.sin(a)];
    });
    const L = ring(-1), R = ring(1);
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg, m = ((i + 0.5) / seg) * Math.PI * 2;
      this.face([L[i], L[j], R[j], R[i]], c, [0, Math.cos(m), Math.sin(m)]);
      this.face([[cx - hw, cy, cz], L[i], L[j]], c, [-1, 0, 0]);
      this.face([[cx + hw, cy, cz], R[i], R[j]], c, [1, 0, 0]);
    }
  }

  build(computeNormals) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(new THREE.BufferAttribute(new (this.n > 65535 ? Uint32Array : Uint16Array)(this.idx), 1));
    if (computeNormals) g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }

  get empty() { return this.n === 0; }
}
