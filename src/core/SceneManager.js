import * as THREE from 'three';

export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x171e22);
    this.scene.fog = new THREE.Fog(0x171e22, 32, 105);
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.06, 180);
    this.camera.name = 'PlayerFirstPersonCamera';
    this.scene.add(this.camera);
  }

  resize(width, height) {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.scene.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose();
    });
  }
}
