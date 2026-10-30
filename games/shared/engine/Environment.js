/* Environment — palettes (driven by the site's page theme / light-dark mode), sky, lights,
 * fog, distant mountains and rain. Changing the site theme re-skins the whole 3D world. */
import * as THREE from '../../vendor/three.module.js';
import { SiteTheme } from './SettingsManager.js';

const C = (h) => new THREE.Color(h);
const mix = (a, b, t) => a.clone().lerp(b, t);
const hsl = (h, s, l) => new THREE.Color().setHSL((((h % 360) + 360) % 360) / 360, s, l);

function natural(tod) {
  const P = {
    day: {
      skyTop: 0x3f86de,
      skyBottom: 0xcfe6ff,
      fog: 0xcfe6ff,
      sun: 0xfff0d2,
      sunI: 2.1,
      sunDir: [0.4, 0.8, 0.35],
      hemiSky: 0xcfe2ff,
      hemiGround: 0x55663a,
      hemiI: 1.0,
      grassA: 0x5f9e3f,
      grassB: 0x86b04a,
      treeA: 0x2f7a3a,
      treeB: 0x4f9c45,
      trunk: 0x5a3d28,
      asphalt: 0x3a3c41,
      shoulder: 0x8c8068,
      line: 0xf2f2ee,
      edge: 0xf2f2ee,
      mountain: 0x7e93b8,
      sand: 0xd9b975,
      concrete: 0xbdbdb6,
      building: 0x8d97a6,
      window: 0x7aa2c4,
      lamp: 0xfff6cf,
      accent: 0x1f6feb,
      sunDisc: 0xfff6e0,
    },
    sunset: {
      skyTop: 0x433b88,
      skyBottom: 0xffa66a,
      fog: 0xf0a37c,
      sun: 0xffb36e,
      sunI: 1.6,
      sunDir: [-0.85, 0.22, 0.4],
      hemiSky: 0xffc9a0,
      hemiGround: 0x3b3342,
      hemiI: 0.8,
      grassA: 0x6d8a3a,
      grassB: 0x8f9a47,
      treeA: 0x3a6a35,
      treeB: 0x6a7d3a,
      trunk: 0x4a3226,
      asphalt: 0x37363c,
      shoulder: 0x7a6a5e,
      line: 0xf5e8d8,
      edge: 0xf5e8d8,
      mountain: 0x87648a,
      sand: 0xe0a870,
      concrete: 0xb0a49c,
      building: 0x7b7388,
      window: 0xffc27a,
      lamp: 0xffe2a8,
      accent: 0xff7a3c,
      sunDisc: 0xffd9a0,
    },
    night: {
      skyTop: 0x04070f,
      skyBottom: 0x1b2748,
      fog: 0x101831,
      sun: 0x8aa4ff,
      sunI: 0.55,
      sunDir: [-0.3, 0.7, 0.4],
      hemiSky: 0x7186b8,
      hemiGround: 0x303c50,
      hemiI: 1.05,
      grassA: 0x1d3a2a,
      grassB: 0x274a35,
      treeA: 0x14382a,
      treeB: 0x1d4a36,
      trunk: 0x2a1d16,
      asphalt: 0x1d1e23,
      shoulder: 0x34363b,
      line: 0xc9d0dc,
      edge: 0xc9d0dc,
      mountain: 0x1a2342,
      sand: 0x4a4458,
      concrete: 0x5a5d66,
      building: 0x2a3042,
      window: 0xffd27a,
      lamp: 0xffe6a0,
      accent: 0x4a9bff,
      sunDisc: 0xdfe8ff,
    },
  };
  const p = P[tod] || P.day, o = {};
  for (const k in p) {
    o[k] = Array.isArray(p[k])
      ? new THREE.Vector3(...p[k]).normalize()
      : (typeof p[k] === 'number' && k !== 'sunI' && k !== 'hemiI' ? C(p[k]) : p[k]);
  }
  o.night = tod === 'night';
  o.lampsOn = tod === 'night' || tod === 'sunset';
  o.fogNear = 0.35;
  return o;
}

function retro() {
  return {
    skyTop: C(0x16073a),
    skyBottom: C(0xff5ca8),
    fog: C(0x3b1457),
    sun: C(0xff9ad0),
    sunI: 1.3,
    sunDir: new THREE.Vector3(-0.2, 0.18, 0.95).normalize(),
    hemiSky: C(0x9a6cff),
    hemiGround: C(0x2a1050),
    hemiI: 0.95,
    grassA: C(0x2b1456),
    grassB: C(0x3d1f7a),
    treeA: C(0xff3ea5),
    treeB: C(0x33e0ff),
    trunk: C(0x2a1050),
    asphalt: C(0x1a1236),
    shoulder: C(0x3b2a6e),
    line: C(0xffe95c),
    edge: C(0x33e0ff),
    mountain: C(0x6a2a9a),
    sand: C(0x6a3a9a),
    concrete: C(0x7a5ac8),
    building: C(0x3a2278),
    window: C(0xff5ca8),
    lamp: C(0xffe95c),
    accent: C(0xffd84a),
    sunDisc: C(0xffb35c),
    night: true,
    lampsOn: true,
    fogNear: 0.3,
  };
}

function rain(h) {
  return {
    skyTop: C(0x000000),
    skyBottom: hsl(h, 0.9, 0.05),
    fog: hsl(h, 0.9, 0.035),
    sun: hsl(h, 0.9, 0.6),
    sunI: 0.5,
    sunDir: new THREE.Vector3(0.2, 0.8, 0.3).normalize(),
    hemiSky: hsl(h, 0.8, 0.28),
    hemiGround: hsl(h, 0.8, 0.08),
    hemiI: 0.9,
    grassA: hsl(h, 0.8, 0.07),
    grassB: hsl(h, 0.85, 0.11),
    treeA: hsl(h, 0.95, 0.3),
    treeB: hsl(h, 1, 0.45),
    trunk: hsl(h, 0.7, 0.1),
    asphalt: hsl(h, 0.6, 0.035),
    shoulder: hsl(h, 0.7, 0.1),
    line: hsl(h, 1, 0.62),
    edge: hsl(h, 1, 0.5),
    mountain: hsl(h, 0.8, 0.12),
    sand: hsl(h, 0.7, 0.14),
    concrete: hsl(h, 0.6, 0.2),
    building: hsl(h, 0.7, 0.1),
    window: hsl(h, 1, 0.55),
    lamp: hsl(h, 1, 0.7),
    accent: hsl(h, 0.95, 0.55),
    sunDisc: hsl(h, 1, 0.7),
    night: true,
    lampsOn: true,
    fogNear: 0.3,
  };
}

export function getPalette(settings, gameId) {
  const page = SiteTheme.pageTheme(), dark = SiteTheme.isDark();
  let tod = settings.get(gameId + '.timeOfDay');
  if (tod === 'auto') tod = dark ? 'night' : 'day';
  const weather = settings.get(gameId + '.weather');
  const p = page === 'retro' ? retro() : page === 'rain' ? rain(SiteTheme.rainHue()) : natural(tod);
  p.page = page;
  p.weather = weather;
  p.fogFar = 0.98;
  p.rain = false;
  if (weather === 'fog') {
    const g = C(p.night ? 0x1a2030 : 0xb9c2cc);
    p.fog = mix(p.fog, g, 0.7);
    p.skyBottom = mix(p.skyBottom, p.fog, 0.8);
    p.skyTop = mix(p.skyTop, p.fog, 0.6);
    p.sunI *= 0.5;
    p.fogNear = 0.02;
    p.fogFar = 0.42;
  } else if (weather === 'rain') {
    const g = C(p.night ? 0x1c222c : 0x6a7480);
    p.fog = mix(p.fog, g, 0.55);
    p.skyBottom = mix(p.skyBottom, g, 0.6);
    p.skyTop = mix(p.skyTop, g, 0.7);
    p.sunI *= 0.45;
    p.hemiI *= 0.85;
    p.fogNear = 0.1;
    p.fogFar = 0.62;
    p.rain = true;
  }
  return p;
}

export class Environment {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    scene.add(this.hemi, this.sun, this.sun.target);

    // sky dome with vertex-colour gradient
    const sg = new THREE.SphereGeometry(1800, 18, 12);
    sg.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(new Float32Array(sg.attributes.position.count * 3), 3),
    );
    this.sky = new THREE.Mesh(
      sg,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1, 28),
      new THREE.MeshBasicMaterial({ fog: false, depthWrite: false, depthTest: false }),
    );
    this.sunDisc.renderOrder = -9;
    this.sunDisc.frustumCulled = false;
    scene.add(this.sky, this.sunDisc);

    this.ridges = [this._ridge(1250, 3.1, 260), this._ridge(1050, 7.7, 170)];
    this.ridges.forEach((m) => scene.add(m));

    // rain streaks
    const N = 520;
    this.rainLocal = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this.rainLocal[i * 3] = (Math.random() - 0.5) * 50;
      this.rainLocal[i * 3 + 1] = Math.random() * 24 - 6;
      this.rainLocal[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 6), 3));
    this.rainLines = new THREE.LineSegments(
      rg,
      new THREE.LineBasicMaterial({
        color: 0xb4c2d4,
        transparent: true,
        opacity: 0.45,
        fog: false,
        depthWrite: false,
      }),
    );
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;
    scene.add(this.rainLines);

    // Two small, original glyph sprites batch all falling binary digits into two draw calls.
    this.binaryTextures = ['0', '1'].map((digit) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.font = 'bold 54px monospace';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(digit, 32, 34);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    });
    this.binaryRain = this.binaryTextures.map((texture) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(new Float32Array(N / 2 * 3), 3),
      );
      const material = new THREE.PointsMaterial({
        map: texture,
        color: 0x44ff88,
        size: 0.55,
        transparent: true,
        opacity: 0.75,
        alphaTest: 0.1,
        depthWrite: false,
        fog: true,
      });
      const points = new THREE.Points(geometry, material);
      points.frustumCulled = false;
      points.visible = false;
      scene.add(points);
      return points;
    });
    this.palette = null;
  }

  _ridge(R, seed, amp) {
    const N = 96, pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const n = 0.5 +
        0.5 *
          (Math.sin(a * 3 + seed) * 0.5 + Math.sin(a * 7 + seed * 2) * 0.3 +
            Math.sin(a * 19 + seed * 3) * 0.2);
      const h = 30 + amp * Math.pow(n, 1.6);
      pos.push(Math.cos(a) * R, h, Math.sin(a) * R, Math.cos(a) * R, -80, Math.sin(a) * R);
      if (i < N) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: false }),
    );
    m.renderOrder = -5;
    m.frustumCulled = false;
    return m;
  }

  apply(p, viewDist) {
    this.palette = p;
    const far = viewDist * p.fogFar, near = far * p.fogNear;
    this.scene.fog = new THREE.Fog(p.fog, near, far);
    this.scene.background = p.fog;
    this.hemi.color.copy(p.hemiSky);
    this.hemi.groundColor.copy(p.hemiGround);
    this.hemi.intensity = p.hemiI;
    this.sun.color.copy(p.sun);
    this.sun.intensity = p.sunI;
    this.sunDir = p.sunDir.clone();

    const col = this.sky.geometry.attributes.color,
      pos = this.sky.geometry.attributes.position,
      tmp = new THREE.Color();
    for (let i = 0; i < col.count; i++) {
      const y = pos.getY(i) / 1800;
      const t = Math.min(1, Math.max(0, (y + 0.02) / 0.62));
      tmp.copy(p.skyBottom).lerp(p.skyTop, Math.pow(t, 0.7));
      if (y < 0) tmp.copy(p.fog);
      col.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    col.needsUpdate = true;

    this.sunDisc.material.color.copy(p.sunDisc);
    this.sunDisc.scale.setScalar(p.page === 'retro' ? 230 : p.night ? 55 : 80);
    this.sunDisc.visible = p.page !== 'rain' && p.weather === 'clear';
    this.ridges[0].material.color.copy(p.mountain).lerp(p.fog, 0.45);
    this.ridges[1].material.color.copy(p.mountain).lerp(p.fog, 0.2);
    this.ridges.forEach((r) => {
      r.visible = p.weather !== 'fog';
    });
    this.rainLines.visible = p.rain && p.page !== 'rain';
    this.binaryRain.forEach((points) => {
      points.visible = p.page === 'rain';
      points.material.color.copy(p.accent);
    });
  }

  update(dt, focusY) {
    const cam = this.camera.position;
    this.sky.position.copy(cam);
    this.ridges.forEach((r) => r.position.set(cam.x, focusY - 25, cam.z));
    if (this.sunDir) {
      this.sunDisc.position.copy(cam).addScaledVector(this.sunDir, 1500);
      this.sunDisc.lookAt(cam);
      this.sun.position.set(
        cam.x + this.sunDir.x * 200,
        cam.y + this.sunDir.y * 200,
        cam.z + this.sunDir.z * 200,
      );
      this.sun.target.position.copy(cam);
    }
    const binary = this.binaryRain[0].visible;
    if (this.rainLines.visible || binary) {
      const a = this.rainLines.geometry.attributes.position, L = this.rainLocal;
      const digits = this.binaryRain.map((points) => points.geometry.attributes.position);
      for (let i = 0; i < L.length / 3; i++) {
        // A slower fall keeps binary characters readable; normal weather keeps its streaks.
        L[i * 3 + 1] -= (binary ? 7 + (i % 5) : 38) * dt;
        if (L[i * 3 + 1] < -6) L[i * 3 + 1] += 26;
        const x = cam.x + L[i * 3], y = cam.y + L[i * 3 + 1], z = cam.z + L[i * 3 + 2];
        if (binary) digits[i % 2].setXYZ(Math.floor(i / 2), x, y, z);
        else {
          a.setXYZ(i * 2, x, y, z);
          a.setXYZ(i * 2 + 1, x - 0.1, y + 0.9, z - 0.05);
        }
      }
      if (binary) {
        digits.forEach((attribute) => {
          attribute.needsUpdate = true;
        });
      } else a.needsUpdate = true;
    }
  }

  dispose() {
    [this.sky, this.sunDisc, this.rainLines, ...this.binaryRain, ...this.ridges].forEach((m) => {
      m.geometry.dispose();
      m.material.dispose();
      this.scene.remove(m);
    });
    this.binaryTextures.forEach((texture) => texture.dispose());
    this.scene.remove(this.hemi, this.sun, this.sun.target);
  }
}
