import * as THREE from '../vendor/three.module.js';
// Seeded, seamless detail maps generated once; geometry, scores and themes never depend on them.
export const TERRAIN_MATERIALS = ['rough', 'fairway', 'green', 'sand', 'water', 'tee'];
export function surfaceTextures(renderer) {
  const textures = {}, size = 256;
  let state = 9173;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (const type of TERRAIN_MATERIALS) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = random() - .5, grain = type === 'rough' ? 32 : type === 'sand' ? 18 : 10;
        const ripple = type === 'sand'
          ? Math.sin(y * Math.PI / 8 + Math.sin(x * Math.PI / 128) * 1.4) * 8
          : type === 'water'
          ? Math.sin(x * Math.PI / 32 + y * Math.PI / 64) * 10 + Math.sin(y * Math.PI / 16) * 4
          : 0;
        const stripe = type === 'fairway' || type === 'tee' ? Math.cos(y * Math.PI / 64) * 5 : 0;
        const base = type === 'rough' ? 211 : type === 'sand' ? 238 : type === 'water' ? 204 : 232,
          v = Math.max(0, Math.min(255, base + n * grain + ripple + stripe)),
          i = (y * size + x) * 4;
        pixels.data.set([v, v, v, 255], i);
      }
    }
    ctx.putImageData(pixels, 0, 0);
    if (type === 'rough') {
      for (let i = 0; i < 3200; i++) {
        const x = random() * size, y = random() * size;
        ctx.strokeStyle = `rgba(${random() > .5 ? '255,255,255' : '70,70,70'},.09)`;
        ctx.lineWidth = .6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (random() - .5) * 3, y - 1 - random() * 4);
        ctx.stroke();
      }
    }
    if (type === 'sand') {
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = 'rgba(100,100,100,.09)';
        ctx.fillRect(random() * size, random() * size, .7, .7);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texture.colorSpace = THREE.SRGBColorSpace;
    textures[type] = texture;
  }
  return textures;
}
export function terrainMaterials(textures) {
  return TERRAIN_MATERIALS.map((type) =>
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: textures[type],
      bumpMap: textures[type],
      bumpScale: type === 'rough' ? .035 : type === 'sand' ? .025 : type === 'green' ? .002 : .008,
      roughness: type === 'sand' ? .96 : type === 'green' ? .8 : .9,
    })
  );
}
