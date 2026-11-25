import * as THREE from 'three';

export const MATERIALS = {
  concrete: new THREE.MeshStandardMaterial({ color: 0x777a78, roughness: 0.94, metalness: 0.02 }),
  concreteDark: new THREE.MeshStandardMaterial({ color: 0x454b4d, roughness: 0.9, metalness: 0.04 }),
  floor: new THREE.MeshStandardMaterial({ color: 0x555a58, roughness: 0.96, metalness: 0.01 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x4f5b60, roughness: 0.48, metalness: 0.72 }),
  metalLight: new THREE.MeshStandardMaterial({ color: 0x879296, roughness: 0.35, metalness: 0.78 }),
  warning: new THREE.MeshStandardMaterial({ color: 0xb48b42, roughness: 0.78, metalness: 0.12 }),
  target: new THREE.MeshStandardMaterial({ color: 0x986d4b, roughness: 0.82, metalness: 0.02 }),
  targetDark: new THREE.MeshStandardMaterial({ color: 0x353b3d, roughness: 0.85, metalness: 0.06 })
};

export function createGroundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  context.fillStyle = '#555a58';
  context.fillRect(0, 0, 512, 512);
  context.strokeStyle = 'rgba(205,210,205,.055)';
  context.lineWidth = 1;
  for (let i = 0; i <= 512; i += 32) {
    context.beginPath(); context.moveTo(i, 0); context.lineTo(i, 512); context.stroke();
    context.beginPath(); context.moveTo(0, i); context.lineTo(512, i); context.stroke();
  }
  let seed = 19;
  const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (let i = 0; i < 1400; i++) {
    const alpha = random() * 0.05;
    context.fillStyle = `rgba(230,230,220,${alpha})`;
    context.fillRect(random() * 512, random() * 512, 1 + random() * 2, 1 + random() * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 16);
  texture.anisotropy = 4;
  return texture;
}
