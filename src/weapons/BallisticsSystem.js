import * as THREE from 'three';

const ZONE_MULTIPLIER = Object.freeze({ head: 4, body: 1, arms: 0.8, legs: 0.75 });

export class BallisticsSystem {
  constructor(scene, events, effects) {
    this.scene = scene;
    this.events = events;
    this.effects = effects;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 150;
    this.hitMeshes = [];
    this.lastShot = 0;
  }

  #isViewModel(object) {
    let current = object;
    while (current) {
      if (current.userData?.ignoreRaycast) return true;
      current = current.parent;
    }
    return false;
  }

  fire(camera, config, spread, { pellets = 1 } = {}) {
    const origin = camera.getWorldPosition(new THREE.Vector3());
    const baseDirection = camera.getWorldDirection(new THREE.Vector3());
    const results = [];
    for (let pellet = 0; pellet < pellets; pellet++) {
      const direction = pellets === 1 ? baseDirection.clone() : this.#pelletDirection(baseDirection, spread, pellet, pellets);
      if (pellets === 1 && spread > 0) direction.copy(this.#sample(baseDirection, spread));
      this.raycaster.set(origin, direction);
      this.raycaster.far = config.range;
      const intersections = this.raycaster.intersectObjects(this.scene.children, true);
      const hit = intersections.find((entry) => !this.#isViewModel(entry.object) && entry.object.visible && entry.object.material?.visible !== false);
      if (!hit) {
        this.effects?.addTracer(origin, origin.clone().addScaledVector(direction, Math.min(config.range, 32)), config.id);
        continue;
      }
      const zone = hit.object.userData.hitZone ?? 'surface';
      const damageTarget = hit.object.userData.damageTarget;
      let damage = 0;
      if (damageTarget) {
        damage = Math.round(config.damage * (ZONE_MULTIPLIER[zone] ?? 1));
        damageTarget.applyDamage(damage, zone);
        this.events.emit('weapon:hit', { weapon: config.id, targetId: damageTarget.id, zone, damage, point: hit.point.clone() });
      } else {
        this.events.emit('weapon:impact', { weapon: config.id, point: hit.point.clone(), normal: hit.face?.normal?.clone() ?? new THREE.Vector3(0, 1, 0), material: hit.object.userData.surface ?? 'concrete' });
      }
      this.effects?.addImpact(hit.point, hit.face?.normal ?? new THREE.Vector3(0, 1, 0), hit.object.userData.surface ?? 'concrete');
      this.effects?.addTracer(origin, hit.point, config.id);
      results.push({ hit, damage, zone });
    }
    this.lastShot = performance.now();
    return results;
  }

  #sample(baseDirection, spread) {
    const direction = baseDirection.clone();
    const worldUp = Math.abs(direction.y) > 0.98 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(direction, worldUp).normalize();
    const up = new THREE.Vector3().crossVectors(right, direction).normalize();
    const radius = Math.sqrt(Math.random()) * spread;
    const angle = Math.random() * Math.PI * 2;
    return direction.addScaledVector(right, Math.cos(angle) * radius).addScaledVector(up, Math.sin(angle) * radius).normalize();
  }

  #pelletDirection(baseDirection, spread, index, count) {
    const direction = baseDirection.clone();
    const worldUp = Math.abs(direction.y) > 0.98 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(direction, worldUp).normalize();
    const up = new THREE.Vector3().crossVectors(right, direction).normalize();
    const radius = Math.sqrt((index + 0.5) / count) * spread;
    const angle = index * 2.399963229728653;
    return direction.addScaledVector(right, Math.cos(angle) * radius).addScaledVector(up, Math.sin(angle) * radius).normalize();
  }
}
