/* Renderer — WebGL renderer wrapper: quality presets, responsive sizing, adaptive resolution. */
import * as THREE from '../../vendor/three.module.js';

export const QUALITY = {
  low: { dprCap: 1, scale: 0.8, view: 300, density: 0.45, antialias: false },
  medium: { dprCap: 1.5, scale: 1, view: 460, density: 0.75, antialias: false },
  high: { dprCap: 2, scale: 1, view: 650, density: 1, antialias: true },
};

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    const context = window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl'));
    if (context) context.getExtension('WEBGL_lose_context')?.loseContext();
    return !!context;
  } catch (e) {
    return false;
  }
}

export class GameRenderer {
  constructor(container, quality) {
    this.container = container;
    this.quality = quality;
    this.autoScale = 1; // lowered automatically when the frame rate drops
    this.renderer = new THREE.WebGLRenderer({
      antialias: QUALITY[quality].antialias,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'g-canvas';
    container.prepend(this.canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.4, 2600);
    this.resize();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
    this._onWin = () => this.resize();
    window.addEventListener('orientationchange', this._onWin);
  }

  setQuality(q) {
    this.quality = q;
    this.autoScale = 1;
    this._applyRatio();
  }

  _ratio() {
    const q = QUALITY[this.quality];
    return Math.max(
      0.5,
      Math.min(window.devicePixelRatio || 1, q.dprCap) * q.scale * this.autoScale,
    );
  }

  _applyRatio() {
    this.renderer.setPixelRatio(this._ratio());
    this.renderer.setSize(this.w, this.h, false);
  }

  resize() {
    const r = this.container.getBoundingClientRect();
    this.w = Math.max(2, Math.floor(r.width));
    this.h = Math.max(2, Math.floor(r.height));
    this._applyRatio();
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
  }

  /** Called with a smoothed frame time; trades resolution for frame rate when needed. */
  adapt(avgDt, now) {
    if (now - (this._lastAdapt || 0) < 1500) return;
    this._lastAdapt = now;
    if (avgDt > 1 / 38 && this.autoScale > 0.6) {
      this.autoScale = Math.max(0.6, this.autoScale - 0.1);
      this._applyRatio();
    } else if (avgDt < 1 / 57 && this.autoScale < 1 && now - (this._lastDrop || 0) > 8000) {
      this.autoScale = Math.min(1, this.autoScale + 0.05);
      this._applyRatio();
    }
    if (avgDt > 1 / 38) this._lastDrop = now;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this._ro.disconnect();
    window.removeEventListener('orientationchange', this._onWin);
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
