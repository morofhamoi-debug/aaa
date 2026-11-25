import * as THREE from 'three';
import { GAME_CONFIG } from '../core/Config.js';

export class Movement {
  constructor() {
    this.velocity = new THREE.Vector3();
    this.wishDirection = new THREE.Vector3();
    this.onGround = true;
    this.crouched = false;
    this.sprinting = false;
    this.lastMoveMagnitude = 0;
    this.acceleration = new THREE.Vector3();
  }

  update(input, yaw, dt, onGround) {
    const cfg = GAME_CONFIG.player;
    this.onGround = onGround;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const x = Number(input.getKey('KeyD')) - Number(input.getKey('KeyA'));
    const z = Number(input.getKey('KeyW')) - Number(input.getKey('KeyS'));
    this.wishDirection.set(0, 0, 0).addScaledVector(right, x).addScaledVector(forward, z);
    if (this.wishDirection.lengthSq() > 1) this.wishDirection.normalize();
    this.crouched = input.getKey('ControlLeft') || input.getKey('ControlRight');
    this.sprinting = !this.crouched && input.getKey('ShiftLeft') && z > 0;
    const targetSpeed = this.crouched ? cfg.crouchSpeed : this.sprinting ? cfg.sprintSpeed : cfg.walkSpeed;
    const lateralScale = x !== 0 && z === 0 ? 0.9 : 1;
    const backwardScale = z < 0 ? 0.78 : 1;
    const target = this.wishDirection.clone().multiplyScalar(targetSpeed * lateralScale * backwardScale);
    const horizontal = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
    if (this.wishDirection.lengthSq() > 0) {
      const accel = this.onGround ? cfg.groundAcceleration : cfg.airAcceleration * cfg.airControl;
      const difference = target.sub(horizontal);
      const maxChange = accel * dt;
      if (difference.length() > maxChange) difference.setLength(maxChange);
      horizontal.add(difference);
    } else if (this.onGround) {
      const friction = Math.exp(-cfg.groundFriction * dt);
      horizontal.multiplyScalar(friction);
      if (horizontal.lengthSq() < 0.001) horizontal.set(0, 0, 0);
    }
    this.velocity.x = horizontal.x;
    this.velocity.z = horizontal.z;
    this.lastMoveMagnitude = horizontal.length();
    return this.velocity;
  }

  setVerticalVelocity(value) { this.velocity.y = value; }
  get horizontalSpeed() { return Math.hypot(this.velocity.x, this.velocity.z); }
}
