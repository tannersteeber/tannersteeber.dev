/* Scenery — low-poly props written into a MeshBuilder (so each chunk's scenery is one draw call).
 * Colours come from the active palette, so every prop follows the page theme. */
import * as THREE from '../../vendor/three.module.js';
import { color } from './MeshBuilder.js';

const tmp = new THREE.Color();
const shade = (c, k) => tmp.copy(c).multiplyScalar(k);

export function addPine(b, x, y, z, s, rng, p, autumn = 0) {
  const base = p.treeA.clone().lerp(p.treeB, rng());
  b.cyl(x, y - 0.3, z, 0.3 * s, 0.2 * s, 1.9 * s, 5, p.trunk);
  const tiers = [[2.3, 3.3, 1.2], [1.8, 3.0, 3.1], [1.2, 2.6, 4.9]];
  tiers.forEach(([r, hgt, off], i) => {
    const low = shade(base, 0.78 + i * 0.12).clone(), top = shade(base, 1.0 + i * 0.1).clone();
    b.cyl(x, y + off * s, z, r * s, 0.05 * s, hgt * s, 6, low, top);
  });
}

export function addRound(b, x, y, z, s, rng, p, autumn = 0) {
  let base = p.treeA.clone().lerp(p.treeB, rng());
  if (autumn > 0) {
    base.lerp(tmp.set(rng() < 0.5 ? 0xd98a2b : 0xc2552a), autumn * (0.55 + 0.45 * rng()));
  }
  b.cyl(x, y - 0.3, z, 0.34 * s, 0.24 * s, 2.5 * s, 5, p.trunk);
  const lo = shade(base, 0.82).clone(), hi = shade(base, 1.12).clone();
  b.cyl(x, y + 1.7 * s, z, 2.3 * s, 1.2 * s, 2.3 * s, 7, lo, base);
  b.cyl(x, y + 3.7 * s, z, 1.2 * s, 0.1 * s, 1.9 * s, 7, base, hi);
}

export function addBush(b, x, y, z, s, rng, p) {
  const c = p.treeA.clone().lerp(p.treeB, rng());
  b.cyl(x, y - 0.1, z, 1.1 * s, 0.35 * s, 1.0 * s, 6, shade(c, 0.85).clone(), c);
}

export function addRock(b, x, y, z, s, rng, col) {
  const c = col.clone().multiplyScalar(0.8 + rng() * 0.4);
  b.box(x, y + 0.25 * s, z, 1.6 * s, 0.9 * s, 1.2 * s, rng() * 3, c);
  b.box(
    x + 0.4 * s,
    y + 0.6 * s,
    z + 0.2 * s,
    0.9 * s,
    0.7 * s,
    0.8 * s,
    rng() * 3,
    shade(c, 1.1).clone(),
  );
}

export function addCactus(b, x, y, z, s, p) {
  const c = p.treeA.clone().lerp(p.sand, 0.15);
  b.cyl(x, y - 0.1, z, 0.28 * s, 0.24 * s, 2.6 * s, 6, c, shade(c, 1.1).clone(), { cap: true });
  b.cyl(x + 0.5 * s, y + 1.1 * s, z, 0.14 * s, 0.14 * s, 0.9 * s, 5, c, c, { cap: true });
  b.cyl(x - 0.45 * s, y + 0.8 * s, z, 0.14 * s, 0.14 * s, 0.7 * s, 5, c, c, { cap: true });
}

export function addHouse(b, x, y, z, yaw, p, rng) {
  const wall = new THREE.Color().setHSL(0.08 + rng() * 0.06, 0.25, p.night ? 0.2 : 0.7);
  const roof = p.trunk.clone().lerp(color(0x7a2f2a), 0.7);
  b.box(x, y + 1.6, z, 7, 3.2, 5.2, yaw, wall);
  b.cyl(x, y + 3.2, z, 5.6, 0.1, 2.0, 4, roof, roof, { rot: yaw + Math.PI / 4 });
  b.box(
    x + Math.cos(yaw) * 1.8,
    y + 4.2,
    z - Math.sin(yaw) * 1.8,
    0.7,
    1.6,
    0.7,
    yaw,
    color(0x6b5448),
  );
}

export function addBuilding(b, x, y, z, w, d, hgt, yaw, p, rng) {
  const base = p.building.clone().multiplyScalar(0.8 + rng() * 0.45);
  b.box(x, y + hgt / 2, z, w, hgt, d, yaw, base);
  const lit = p.window, dim = p.window.clone().multiplyScalar(p.night ? 0.25 : 0.55);
  const bands = Math.max(2, Math.min(7, Math.floor(hgt / 6)));
  for (let i = 0; i < bands; i++) {
    const yy = y + 3 + i * (hgt - 4) / bands;
    const c = rng() < (p.night ? 0.6 : 0.25) ? lit : dim;
    b.box(x, yy, z, w + 0.12, 1.5, d + 0.12, yaw, c);
  }
  b.box(x, y + hgt + 0.3, z, w * 0.96, 0.6, d * 0.96, yaw, shade(base, 0.7).clone());
}

/** Street lamp. (dx,dz) is the unit vector from the pole toward the road. */
export function addLamp(b, x, y, z, dx, dz, p) {
  const yaw = Math.atan2(dx, dz);
  b.box(x, y + 3.6, z, 0.16, 7.2, 0.16, yaw, color(0x6a6e75));
  b.box(x + dx * 1.2, y + 7.15, z + dz * 1.2, 0.12, 0.12, 2.6, yaw, color(0x6a6e75));
  b.box(
    x + dx * 2.4,
    y + 7.05,
    z + dz * 2.4,
    0.4,
    0.12,
    0.8,
    yaw,
    p.lampsOn ? p.lamp : color(0xc9ccd2),
  );
}

/** Boxed segment along the road between two samples (barriers, rails). */
export function addSegment(b, ax, ay, az, bx, by, bz, w, hgt, c, lift = 0) {
  const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) + 0.05;
  b.box(
    (ax + bx) / 2,
    (ay + by) / 2 + hgt / 2 + lift,
    (az + bz) / 2,
    w,
    hgt,
    len,
    Math.atan2(dx, dz),
    c,
  );
}
