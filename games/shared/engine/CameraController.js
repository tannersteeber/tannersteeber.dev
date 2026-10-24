/* CameraController — smoothed chase / hood / first-person cameras.
 * Chase cameras follow a smoothed heading (not the car's raw yaw) and keep exact distance
 * behind the car, so they stay stable through curves, hills and fast lane changes. */
import * as THREE from '../../vendor/three.module.js';

const damp = (k, dt) => 1 - Math.exp(-k * dt);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export const CAMERA_MODES = {
  close: { label: 'Close chase', dist: 6.2, height: 2.3, look: 9, fov: 62, yawK: 5.5 },
  far:   { label: 'Far chase',   dist: 11.5, height: 4.4, look: 16, fov: 60, yawK: 4 },
  hood:  { label: 'Hood',        local: [0, 1.12, 0.55], fov: 72 },
  first: { label: 'Driver',      local: [-0.32, 1.22, -0.1], fov: 80, hideCar: true }
};

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'close';
    this.camYaw = 0;
    this.res = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.shake = 0;
    this.fov = 62;
    this.hidesCar = false;
    this._v = new THREE.Vector3();
    this._init = false;
  }

  setMode(m) { if (CAMERA_MODES[m]) { this.mode = m; this._init = false; } }
  addShake(a) { this.shake = Math.max(this.shake, a); }
  snap() { this._init = false; }

  update(dt, vehicle, carObj, speed01) {
    const m = CAMERA_MODES[this.mode], cam = this.camera, p = vehicle.position;
    this.hidesCar = !!m.hideCar;
    const targetFov = m.fov + speed01 * 9;
    this.fov += (targetFov - this.fov) * damp(3, dt);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }

    if (m.local) {
      carObj.updateMatrixWorld(true);
      this._v.set(m.local[0], m.local[1], m.local[2]);
      carObj.localToWorld(this._v);
      cam.position.copy(this._v);
      // look along the car's heading on a level plane so roll/bounce never tilt the horizon
      const yaw = vehicle.yaw;
      this.look.set(this._v.x + Math.sin(yaw) * 30, this._v.y + vehicle.slope * 30 * 0.8 - 0.2, this._v.z + Math.cos(yaw) * 30);
      cam.lookAt(this.look);
      this._applyShake(dt);
      return;
    }

    if (!this._init) { this.camYaw = vehicle.yaw; this.res.set(0, 0, 0); this._init = true; }
    this.camYaw += wrap(vehicle.yaw - this.camYaw) * damp(m.yawK, dt);
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    this.target.set(p.x - fx * m.dist, p.y + m.height, p.z - fz * m.dist);

    // residual = last camera pos minus new target; keep distance exact, smooth sideways + vertical
    this.res.copy(cam.position).sub(this.target);
    const along = this.res.x * fx + this.res.z * fz;
    this.res.x -= fx * along; this.res.z -= fz * along;
    this.res.multiplyScalar(Math.exp(-9 * dt));
    if (this.res.lengthSq() > 400) this.res.set(0, 0, 0);
    cam.position.copy(this.target).add(this.res);

    this.look.set(p.x + fx * m.look, p.y + 1.1 + vehicle.slope * m.look, p.z + fz * m.look);
    cam.lookAt(this.look);
    this._applyShake(dt);
  }

  _applyShake(dt) {
    if (this.shake > 0.001) {
      const s = this.shake;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
      this.shake *= Math.exp(-6 * dt);
    }
  }
}
