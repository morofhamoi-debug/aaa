import * as THREE from 'three';

export class SpreadSystem {
  constructor() { this.current = 0; }

  update(dt, weapon, player, aiming) {
    const config = weapon.config;
    const state = player.getSnapshot();
    let target = config.spread;
    target += config.movementSpread * Math.min(1, state.horizontalSpeed / 5.8);
    if (!state.grounded) target += config.airborneSpread ?? 0.05;
    if (state.crouched) target *= config.crouchMultiplier ?? 0.72;
    if (aiming) target *= config.aimMultiplier ?? 0.66;
    target = Math.min(config.maximumSpread ?? 0.12, target);
    const speed = target > this.current ? 16 : 6;
    this.current = THREE.MathUtils.damp(this.current, target, speed, dt);
    return this.current;
  }

  sampleDirection(baseDirection, spread, pelletIndex = 0, pelletCount = 1) {
    const direction = baseDirection.clone().normalize();
    const worldUp = Math.abs(direction.y) > 0.98 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(direction, worldUp).normalize();
    const up = new THREE.Vector3().crossVectors(right, direction).normalize();
    let radius;
    let angle;
    if (pelletCount > 1) {
      // A deterministic ring pattern avoids clumping while preserving slight per-shot variation.
      radius = Math.sqrt((pelletIndex + 0.5) / pelletCount) * spread;
      angle = pelletIndex * 2.399963229728653 + Math.random() * 0.12;
    } else {
      radius = Math.sqrt(Math.random()) * spread;
      angle = Math.random() * Math.PI * 2;
    }
    direction.addScaledVector(right, Math.cos(angle) * radius);
    direction.addScaledVector(up, Math.sin(angle) * radius);
    return direction.normalize();
  }
}
