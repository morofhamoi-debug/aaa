import * as THREE from 'three';
import { GAME_CONFIG } from '../core/Config.js';

export class CameraEffects {
  constructor() {
    this.time = 0;
    this.landing = 0;
    this.enabled = true;
    this.offset = new THREE.Vector2();
  }

  onLand(impactSpeed) { this.landing = Math.min(0.065, impactSpeed * 0.0025); }

  update(dt, movement, grounded) {
    if (!this.enabled) { this.offset.set(0, 0); return this.offset; }
    this.time += dt * (movement.sprinting ? 13 : 9);
    const speedFactor = Math.min(1, movement.horizontalSpeed / Math.max(1, GAME_CONFIG.player.sprintSpeed));
    const intensity = GAME_CONFIG.player.cameraBob * speedFactor * (movement.crouched ? 0.35 : 1);
    this.landing = THREE.MathUtils.damp(this.landing, 0, 15, dt);
    this.offset.x = Math.cos(this.time * 0.5) * intensity * 0.42;
    this.offset.y = (Math.abs(Math.sin(this.time)) * intensity - this.landing) * (grounded ? 1 : 0.2);
    return this.offset;
  }
}
