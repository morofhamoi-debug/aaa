import * as THREE from 'three';
import { GAME_CONFIG } from '../core/Config.js';

export class PlayerCamera {
  constructor(camera, input, events) {
    this.camera = camera;
    this.input = input;
    this.events = events;
    this.yaw = 0;
    this.pitch = -0.02;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.effectsOffset = new THREE.Vector3();
    this.sensitivity = GAME_CONFIG.player.mouseSensitivity;
    this.enabled = true;
  }

  updateLook() {
    if (!this.enabled || !this.input.pointerLocked) return;
    const delta = this.input.consumeMouseDelta();
    const cfg = GAME_CONFIG.player;
    this.yaw -= delta.x * this.sensitivity;
    this.pitch -= delta.y * this.sensitivity * cfg.verticalSensitivity * (cfg.invertY ? -1 : 1);
    this.pitch = THREE.MathUtils.clamp(this.pitch, cfg.minPitch, cfg.maxPitch);
  }

  apply(position, eyeHeight, effects = { x: 0, y: 0 }) {
    this.camera.position.set(position.x + effects.x, position.y + eyeHeight + effects.y, position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch + this.recoilPitch, this.yaw + this.recoilYaw, 0, 'YXZ');
  }

  setSensitivity(value) { this.sensitivity = THREE.MathUtils.clamp(value, 0.0002, 0.008); }
}
