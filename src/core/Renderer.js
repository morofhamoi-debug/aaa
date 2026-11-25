import * as THREE from 'three';
import { GAME_CONFIG, GRAPHICS_PROFILES } from './Config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const profile = GRAPHICS_PROFILES[GAME_CONFIG.graphics.profile] ?? GRAPHICS_PROFILES.MEDIUM;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: profile.antialias,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = GAME_CONFIG.graphics.exposure;
    this.renderer.shadowMap.enabled = profile.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.profile = profile;
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize, { passive: true });
    this.resize();
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, GAME_CONFIG.graphics.maxPixelRatio, this.profile.pixelRatio);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
  }

  setProfile(name) {
    const profile = GRAPHICS_PROFILES[name];
    if (!profile) throw new Error(`Unknown graphics profile: ${name}`);
    this.profile = profile;
    this.renderer.shadowMap.enabled = profile.shadows;
    this.resize();
  }

  render(scene, camera) { this.renderer.render(scene, camera); }
  getInfo() { return this.renderer.info; }
  dispose() {
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }
}
