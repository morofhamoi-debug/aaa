import * as THREE from 'three';
import { GAME_CONFIG, GRAPHICS_PROFILES } from './Config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.isTouch = Boolean(
      (navigator.maxTouchPoints ?? 0) > 0 ||
      window.matchMedia?.('(pointer: coarse)').matches
    );
    const profileName = this.isTouch ? 'MEDIUM' : GAME_CONFIG.graphics.profile;
    const profile = GRAPHICS_PROFILES[profileName] ?? GRAPHICS_PROFILES.MEDIUM;
    const attributes = {
      alpha: false,
      antialias: profile.antialias && !this.isTouch,
      depth: true,
      stencil: false,
      powerPreference: this.isTouch ? 'default' : 'high-performance',
      preserveDrawingBuffer: false
    };

    const context = canvas.getContext('webgl2', attributes);
    if (!context) {
      throw new Error(
        'Браузер не предоставил WebGL 2. На этом устройстве Three.js не может запуститься. ' +
        'Откройте страницу в актуальном Safari/Chrome и проверьте настройки WebGL или ограничения режима энергосбережения.'
      );
    }

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        context,
        antialias: attributes.antialias,
        alpha: false,
        powerPreference: attributes.powerPreference,
        stencil: false,
        depth: true
      });
    } catch (error) {
      throw new Error(`Не удалось создать Three.js WebGLRenderer: ${error?.message ?? error}`);
    }

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = GAME_CONFIG.graphics.exposure;
    this.renderer.shadowMap.enabled = profile.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.profile = profile;
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize, { passive: true });
    window.visualViewport?.addEventListener('resize', this.resize, { passive: true });
    this.resize();
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    const deviceRatio = window.devicePixelRatio || 1;
    const ratioCap = this.isTouch ? Math.min(GAME_CONFIG.graphics.maxPixelRatio, 1.25) : GAME_CONFIG.graphics.maxPixelRatio;
    const ratio = Math.min(deviceRatio, ratioCap, this.profile.pixelRatio);
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
    window.visualViewport?.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }
}
