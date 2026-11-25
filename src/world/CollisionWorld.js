import * as THREE from 'three';

const EPSILON = 1e-4;

export class CollisionWorld {
  constructor() {
    this.colliders = [];
  }

  addBox(min, max, metadata = {}) {
    const collider = {
      min: new THREE.Vector3(min.x, min.y, min.z),
      max: new THREE.Vector3(max.x, max.y, max.z),
      material: metadata.material ?? 'concrete',
      mesh: metadata.mesh ?? null,
      tag: metadata.tag ?? 'world',
      enabled: true
    };
    this.colliders.push(collider);
    return collider;
  }

  remove(collider) { const index = this.colliders.indexOf(collider); if (index >= 0) this.colliders.splice(index, 1); }

  #overlaps(position, height, radius, collider) {
    return position.x + radius > collider.min.x + EPSILON && position.x - radius < collider.max.x - EPSILON
      && position.z + radius > collider.min.z + EPSILON && position.z - radius < collider.max.z - EPSILON
      && position.y + height > collider.min.y + EPSILON && position.y < collider.max.y - EPSILON;
  }

  #isClear(position, height, radius, ignore = null) {
    return !this.colliders.some((collider) => collider.enabled && collider !== ignore && this.#overlaps(position, height, radius, collider));
  }

  moveHorizontal(position, velocity, deltaTime, height, radius, maxStepHeight) {
    const result = position.clone();
    const moved = { x: 0, z: 0 };
    for (const axis of ['x', 'z']) {
      const amount = velocity[axis] * deltaTime;
      if (Math.abs(amount) < EPSILON) continue;
      const candidate = result.clone();
      candidate[axis] += amount;
      let blocking = this.colliders.find((collider) => collider.enabled && this.#overlaps(candidate, height, radius, collider));
      if (!blocking) {
        result[axis] = candidate[axis];
        moved[axis] = amount;
        continue;
      }
      const canStep = blocking.max.y > result.y + 0.04 && blocking.max.y <= result.y + maxStepHeight + EPSILON;
      if (canStep) {
        const stepped = candidate.clone();
        stepped.y = blocking.max.y + EPSILON;
        if (this.#isClear(stepped, height, radius)) {
          result.copy(stepped);
          moved[axis] = amount;
          continue;
        }
      }
      const boundary = amount > 0 ? blocking.min[axis] - radius - EPSILON : blocking.max[axis] + radius + EPSILON;
      const clamped = result.clone();
      clamped[axis] = boundary;
      if (this.#isClear(clamped, height, radius)) {
        moved[axis] = boundary - result[axis];
        result[axis] = boundary;
      }
      velocity[axis] = 0;
    }
    return { position: result, moved };
  }

  moveVertical(position, verticalVelocity, deltaTime, height, radius) {
    const result = position.clone();
    const candidateFeet = result.y + verticalVelocity * deltaTime;
    if (verticalVelocity <= 0) {
      let landing = null;
      for (const collider of this.colliders) {
        if (!collider.enabled) continue;
        const horizontalOverlap = result.x + radius > collider.min.x + EPSILON && result.x - radius < collider.max.x - EPSILON
          && result.z + radius > collider.min.z + EPSILON && result.z - radius < collider.max.z - EPSILON;
        if (!horizontalOverlap) continue;
        if (result.y >= collider.max.y - 0.06 && candidateFeet <= collider.max.y + EPSILON) {
          if (!landing || collider.max.y > landing.max.y) landing = collider;
        }
      }
      if (landing) return { position: new THREE.Vector3(result.x, landing.max.y, result.z), grounded: true, hit: landing };
      if (candidateFeet <= 0) return { position: new THREE.Vector3(result.x, 0, result.z), grounded: true, hit: null };
    } else {
      const currentHead = result.y + height;
      const nextHead = candidateFeet + height;
      for (const collider of this.colliders) {
        if (!collider.enabled) continue;
        const horizontalOverlap = result.x + radius > collider.min.x + EPSILON && result.x - radius < collider.max.x - EPSILON
          && result.z + radius > collider.min.z + EPSILON && result.z - radius < collider.max.z - EPSILON;
        if (horizontalOverlap && currentHead <= collider.min.y + 0.06 && nextHead >= collider.min.y) {
          return { position: new THREE.Vector3(result.x, collider.min.y - height - EPSILON, result.z), grounded: false, hit: collider, ceiling: true };
        }
      }
    }
    result.y = candidateFeet;
    return { position: result, grounded: false, hit: null };
  }

  hasClearance(position, height, radius) { return this.#isClear(position, height, radius); }

  getSurfaceBelow(position, radius, maxDistance = 0.25) {
    let best = null;
    for (const collider of this.colliders) {
      const inside = position.x + radius > collider.min.x && position.x - radius < collider.max.x
        && position.z + radius > collider.min.z && position.z - radius < collider.max.z;
      if (!inside || collider.max.y > position.y + 0.05) continue;
      const distance = position.y - collider.max.y;
      if (distance <= maxDistance && (!best || distance < best.distance)) best = { collider, distance };
    }
    return best;
  }
}
