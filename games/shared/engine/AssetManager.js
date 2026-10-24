/* AssetManager — shared materials and cached, procedurally generated vehicle geometry.
 * Vehicles are built from boxes/wheels merged into a single mesh, so traffic costs one draw
 * call per car. To add a custom model later, register a builder with registerCarType(). */
import * as THREE from '../../vendor/three.module.js';
import { MeshBuilder, color } from './MeshBuilder.js';

const GLASS = 0x141b26, TIRE = 0x101114, TRIM = 0x1d1f24;

/** Dimensions (metres) used for rendering and for collision boxes. */
export const CAR_TYPES = {
  player: { L: 4.4, W: 1.88 },
  sedan:  { L: 4.6, W: 1.84 },
  suv:    { L: 4.8, W: 1.96 },
  van:    { L: 5.4, W: 2.05 },
  truck:  { L: 8.6, W: 2.5 }
};

const builders = {
  player(b, c, d) {
    const { L, W } = d;
    b.box(0, 0.54, 0, W, 0.5, L, 0, c);
    b.box(0, 0.86, -0.15, W * 0.94, 0.14, L * 0.62, 0, c);
    b.box(0, 1.16, -0.38, W * 0.88, 0.44, L * 0.42, 0, color(GLASS));
    b.box(0, 1.4, -0.38, W * 0.84, 0.06, L * 0.4, 0, c);
    b.box(0, 0.98, -L / 2 + 0.2, W * 0.86, 0.05, 0.42, 0, c);            // rear wing
    b.box(-W * 0.3, 0.84, -L / 2 + 0.22, 0.06, 0.2, 0.08, 0, color(TRIM));
    b.box(W * 0.3, 0.84, -L / 2 + 0.22, 0.06, 0.2, 0.08, 0, color(TRIM));
    b.box(0, 0.36, L / 2 - 0.04, W * 0.98, 0.16, 0.14, 0, color(TRIM));   // splitter
    wheels(b, d, 0.34, 0.26, 0.3);
  },
  sedan(b, c, d) {
    const { L, W } = d;
    b.box(0, 0.6, 0, W, 0.62, L, 0, c);
    b.box(0, 1.17, -L * 0.06, W * 0.9, 0.52, L * 0.48, 0, color(GLASS));
    b.box(0, 1.46, -L * 0.06, W * 0.86, 0.07, L * 0.44, 0, c);
    bumpers(b, d);
    wheels(b, d, 0.34, 0.24, 0.31);
  },
  suv(b, c, d) {
    const { L, W } = d;
    b.box(0, 0.68, 0, W, 0.78, L, 0, c);
    b.box(0, 1.34, -L * 0.08, W * 0.92, 0.6, L * 0.62, 0, color(GLASS));
    b.box(0, 1.68, -L * 0.08, W * 0.9, 0.08, L * 0.64, 0, c);
    bumpers(b, d);
    wheels(b, d, 0.38, 0.26, 0.31);
  },
  van(b, c, d) {
    const { L, W } = d;
    b.box(0, 0.98, 0, W, 1.4, L, 0, c);
    b.box(0, 1.3, L / 2 - 0.02, W * 0.9, 0.62, 0.08, 0, color(GLASS));
    b.box(0, 1.34, L * 0.1, W + 0.02, 0.46, L * 0.42, 0, color(GLASS));
    b.box(0, 1.72, 0, W * 0.96, 0.05, L * 0.96, 0, color(0xd8dadd));
    bumpers(b, d);
    wheels(b, d, 0.36, 0.24, 0.32);
  },
  truck(b, c, d) {
    const { L, W } = d;
    b.box(0, 0.62, 0, W * 0.92, 0.5, L, 0, color(TRIM));                       // chassis
    b.box(0, 1.38, L / 2 - 1.0, W, 1.7, 2.0, 0, c);                            // cab
    b.box(0, 1.8, L / 2 - 1.1, W + 0.02, 0.55, 1.2, 0, color(GLASS));
    b.box(0, 2.1, -1.1, W, 2.5, L - 2.3, 0, color(0xe4e6e9));                  // cargo box
    wheelAt(b, W, 0.5, 0.34, L / 2 - 1.3);
    wheelAt(b, W, 0.5, 0.34, -L / 2 + 1.1);
    wheelAt(b, W, 0.5, 0.34, -L / 2 + 2.5);
  }
};

function bumpers(b, d) {
  b.box(0, 0.42, d.L / 2 - 0.05, d.W * 0.98, 0.18, 0.14, 0, color(TRIM));
  b.box(0, 0.42, -d.L / 2 + 0.05, d.W * 0.98, 0.18, 0.14, 0, color(TRIM));
}
function wheelAt(b, W, r, w, z) {
  b.wheel(W / 2 - 0.08, r, z, r, w, color(TIRE));
  b.wheel(-W / 2 + 0.08, r, z, r, w, color(TIRE));
}
function wheels(b, d, r, w, zf) {
  wheelAt(b, d.W, r, w, d.L * zf);
  wheelAt(b, d.W, r, w, -d.L * zf);
}

function lightsInto(b, d, tall, end) {
  const { L, W } = d, y = tall ? 0.95 : 0.66;
  for (const s of [-1, 1]) {
    if (end !== 'rear') b.box(s * W * 0.33, y, L / 2 + 0.01, 0.34, 0.14, 0.06, 0, color(0xfff4c9));
    if (end !== 'front') b.box(s * W * 0.34, y + 0.02, -L / 2 - 0.01, 0.34, 0.14, 0.06, 0, color(0xff2b2b));
  }
}

export function registerCarType(name, dims, builder) { CAR_TYPES[name] = dims; builders[name] = builder; }

export class AssetManager {
  constructor() {
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.brakeMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x595959 });
    this.carGeos = new Map();
    this.lightGeos = new Map();
    this._shadowTex = null;
  }

  /** Cached merged geometry for a vehicle (lights baked in unless separateLights). */
  carGeometry(type, hex, separateLights) {
    const key = type + ':' + hex + ':' + (separateLights ? 1 : 0);
    let g = this.carGeos.get(key);
    if (!g) {
      const d = CAR_TYPES[type], b = new MeshBuilder();
      (builders[type] || builders.sedan)(b, color(hex), d, hex);
      if (!separateLights) lightsInto(b, d, type === 'van' || type === 'suv');
      g = b.build();
      this.carGeos.set(key, g);
    }
    return g;
  }

  carLightGeometry(type, end) {
    const key = type + ':' + (end || 'both');
    let g = this.lightGeos.get(key);
    if (!g) { const b = new MeshBuilder(); lightsInto(b, CAR_TYPES[type], false, end); g = b.build(); this.lightGeos.set(key, g); }
    return g;
  }

  shadowTexture() {
    if (this._shadowTex) return this._shadowTex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 4, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    this._shadowTex = new THREE.CanvasTexture(c);
    return this._shadowTex;
  }

  /** Player vehicle: body, glowing lights and a soft blob shadow. */
  createPlayerCar(hex) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.carGeometry('player', hex, true), this.material);
    const lights = new THREE.Mesh(this.carLightGeometry('player', 'front'), this.glowMaterial);
    const brakeLights = new THREE.Mesh(this.carLightGeometry('player', 'rear'), this.brakeMaterial);
    group.add(body, lights, brakeLights);
    group.rotation.order = 'YXZ';
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.4), new THREE.MeshBasicMaterial({
      map: this.shadowTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    }));
    shadow.rotation.x = -Math.PI / 2;
    return { group, body, lights, brakeLights, shadow, paintHex: hex, dims: CAR_TYPES.player };
  }

  setBraking(car, braking) {
    car.brakeLights.material.color.setScalar(braking ? 1.5 : 0.35);
  }

  /** Replace the player's paint (e.g. when the page theme changes). */
  repaintPlayer(car, hex) {
    if (car.paintHex === hex) return;
    const previous = car.body.geometry;
    car.body.geometry = this.carGeometry('player', hex, true);
    this.carGeos.delete('player:' + car.paintHex + ':1');
    previous.dispose();
    car.paintHex = hex;
  }

  dispose() {
    this.carGeos.forEach(g => g.dispose());
    this.lightGeos.forEach(g => g.dispose());
    this.carGeos.clear(); this.lightGeos.clear();
    this.material.dispose(); this.glowMaterial.dispose(); this.brakeMaterial.dispose();
    if (this._shadowTex) this._shadowTex.dispose();
  }
}
