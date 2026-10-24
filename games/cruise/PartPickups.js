/* A small, bounded pool of original car-part collectibles, placed in road coordinates. */
import * as THREE from '../vendor/three.module.js';
import { MeshBuilder, color } from '../shared/engine/MeshBuilder.js';
import { mulberry32 } from '../shared/engine/RoadGenerator.js';

const TYPES = [{ name: 'Piston', points: 100 }, { name: 'Brake rotor', points: 150 }];
function append(b, geometry, tint) {
  const p = geometry.attributes.position, n = geometry.attributes.normal, start = b.n;
  for (let i = 0; i < p.count; i++) b.vert(p.getX(i), p.getY(i), p.getZ(i), tint, n.getX(i), n.getY(i), n.getZ(i));
  const indices = geometry.index;
  for (let i = 0; i < (indices ? indices.count : p.count); i += 3) b.tri(...[0, 1, 2].map(j => start + (indices ? indices.getX(i + j) : i + j)));
  geometry.dispose();
}
function models() {
  const steel = color(0xc6d2df), dark = color(0x344355), light = color(0xe8edf4);
  const piston = new MeshBuilder();
  piston.cyl(0, 0.12, 0, .29, .29, .42, 16, steel, light, { cap: true });
  for (const y of [.38, .47]) append(piston, new THREE.TorusGeometry(.291, .018, 5, 20).rotateX(Math.PI / 2).translate(0, y, 0), dark);
  piston.box(0, -.16, 0, .13, .56, .14, 0, steel);
  append(piston, new THREE.TorusGeometry(.15, .05, 6, 16).translate(0, -.49, 0), light);
  const rotor = new MeshBuilder();
  append(rotor, new THREE.RingGeometry(.2, .55, 24).translate(0, 0, .055), steel);
  append(rotor, new THREE.RingGeometry(.2, .55, 24).rotateY(Math.PI).translate(0, 0, -.055), steel);
  append(rotor, new THREE.TorusGeometry(.53, .04, 6, 24), light);
  append(rotor, new THREE.CylinderGeometry(.21, .21, .18, 12).rotateX(Math.PI / 2), dark);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    rotor.box(Math.cos(a) * .39, Math.sin(a) * .39, .06, .045, .13, .018, 0, dark);
  }
  return [piston.build(), rotor.build()];
}

export class PartPickups {
  constructor(scene, road, seed, palette, onCollect) {
    this.scene = scene; this.road = road; this.seed = seed; this.onCollect = onCollect;
    this.geometry = models();
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.haloMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: .65, depthWrite: false, side: THREE.DoubleSide });
    this.haloGeometry = new THREE.RingGeometry(.62, .71, 24);
    this.items = Array.from({ length: 12 }, () => {
      const mesh = new THREE.Mesh(this.geometry[0], this.material);
      const halo = new THREE.Mesh(this.haloGeometry, this.haloMaterial); halo.rotation.x = -Math.PI / 2;
      mesh.visible = halo.visible = false; scene.add(mesh, halo);
      return { mesh, halo, active: false, s: 0, d: 0, type: 0 };
    });
    this.sample = {}; this.setPalette(palette); this.reset(0);
  }
  setPalette(palette) {
    this.haloMaterial.color.copy(palette.accent);
    this.material.emissive.copy(palette.accent).multiplyScalar(.12);
  }
  reset(view) {
    this.rng = mulberry32(this.seed + 6197); this.nextS = 45; this.time = 0; this.lastS = 0; this.lastD = 0;
    for (const item of this.items) { item.active = false; item.mesh.visible = item.halo.visible = false; }
    this.update(0, { s: 0, d: 0 }, false, view);
  }
  update(dt, vehicle, collect, view) {
    this.time += dt;
    for (const item of this.items) {
      if (!item.active) continue;
      const span = vehicle.s - this.lastS;
      const t = span > 0 ? Math.max(0, Math.min(1, (item.s - this.lastS) / span)) : 1;
      const d = this.lastD + (vehicle.d - this.lastD) * t;
      const crossed = Math.min(this.lastS, vehicle.s) <= item.s + 2.5 && Math.max(this.lastS, vehicle.s) >= item.s - 2.5;
      if (collect && crossed && Math.abs(d - item.d) < 1.3) {
        item.active = false; item.mesh.visible = item.halo.visible = false;
        this.onCollect(TYPES[item.type]);
      } else if (item.s < vehicle.s - 6 || item.s > vehicle.s + view + 30) {
        item.active = false; item.mesh.visible = item.halo.visible = false;
      }
    }
    // Recycling never creates a part behind or on top of the player.
    this.nextS = Math.max(this.nextS, vehicle.s + 30);
    for (const item of this.items) {
      if (item.active || this.nextS > vehicle.s + view * .85) continue;
      item.s = this.nextS; item.d = [-2.3, -1.7, 0, 1.7, 2.3][Math.floor(this.rng() * 5)];
      item.type = Math.floor(this.rng() * TYPES.length); item.active = true;
      item.mesh.geometry = this.geometry[item.type]; item.mesh.visible = item.halo.visible = true;
      this.nextS += 65 + this.rng() * 40;
    }
    for (const item of this.items) {
      if (!item.active) continue;
      const p = this.road.at(item.s, this.sample), x = p.x + p.rx * item.d, z = p.z + p.rz * item.d;
      item.mesh.position.set(x, p.y + .95 + Math.sin(this.time * 2 + item.s) * .12, z);
      item.mesh.rotation.y = this.time * .85 + item.s;
      item.halo.position.set(x, p.y + .075, z);
    }
    this.lastS = vehicle.s; this.lastD = vehicle.d;
  }
  dispose() {
    for (const item of this.items) this.scene.remove(item.mesh, item.halo);
    this.geometry.forEach(g => g.dispose()); this.haloGeometry.dispose(); this.material.dispose(); this.haloMaterial.dispose();
  }
}
