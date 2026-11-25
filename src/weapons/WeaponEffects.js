import * as THREE from 'three';

export class WeaponEffects {
  constructor(scene, maxTracers = 14, maxParticles = 120) {
    this.scene = scene;
    this.maxTracers = maxTracers;
    this.maxParticles = maxParticles;
    this.tracers = [];
    this.particles = [];
    this.flashes = [];
    this.shells = [];
    this.maxShells = 28;
    this.shellGeometry = new THREE.CylinderGeometry(0.012, 0.012, 0.038, 8);
    this.shellMaterial = new THREE.MeshStandardMaterial({ color: 0xb78b48, metalness: 0.88, roughness: 0.28 });
    this.sharedParticleGeometry = new THREE.SphereGeometry(0.018, 5, 4);
    this.sharedParticleMaterial = new THREE.MeshBasicMaterial({ color: 0xc8ad80, transparent: true, opacity: 0.85 });
    this.sharedFlashGeometry = new THREE.ConeGeometry(0.055, 0.24, 6);
    this.sharedFlashMaterial = new THREE.MeshBasicMaterial({ color: 0xffbd72, transparent: true, opacity: 0.95, depthWrite: false });
    this.sharedTracerMaterial = new THREE.LineBasicMaterial({ color: 0xffdfac, transparent: true, opacity: 0.55 });
  }

  addMuzzleFlash(anchor) {
    if (!anchor) return;
    const flash = new THREE.Mesh(this.sharedFlashGeometry, this.sharedFlashMaterial.clone());
    flash.name = 'TransientMuzzleFlash';
    flash.userData.ignoreRaycast = true;
    flash.scale.set(0.7 + Math.random() * 0.5, 0.65 + Math.random() * 0.7, 0.7 + Math.random() * 0.5);
    flash.rotation.x = Math.PI / 2;
    anchor.getWorldPosition(flash.position);
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(anchor.getWorldQuaternion(new THREE.Quaternion()));
    flash.position.addScaledVector(direction, 0.11);
    flash.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    this.scene.add(flash);
    this.flashes.push({ mesh: flash, life: 0.045 });
    if (this.flashes.length > 6) this.#removeFlash(this.flashes.shift());
  }

  addShell(anchor) {
    if (!anchor) return;
    if (this.shells.length >= this.maxShells) this.#removeShell(this.shells.shift());
    const mesh = new THREE.Mesh(this.shellGeometry, this.shellMaterial);
    mesh.name = 'TransientBrassCasing';
    mesh.userData.ignoreRaycast = true;
    anchor.getWorldPosition(mesh.position);
    const rotation = anchor.getWorldQuaternion(new THREE.Quaternion());
    const velocity = new THREE.Vector3(1, 0.35, 0.1).applyQuaternion(rotation).normalize().multiplyScalar(2 + Math.random() * 1.6);
    velocity.y += 1 + Math.random() * 0.8;
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    this.scene.add(mesh);
    this.shells.push({ mesh, velocity, angular: new THREE.Vector3(8 + Math.random() * 9, 5, 7), life: 2.4 });
  }

  #removeShell(entry) { this.scene.remove(entry.mesh); }

  addImpact(point, normal, material = 'concrete') {
    const colors = { concrete: 0xc0b9a9, metal: 0xe3b25d, wood: 0xa98258, glass: 0x8cc8d5, earth: 0x9a8167 };
    const color = colors[material] ?? colors.concrete;
    const count = material === 'metal' ? 7 : 4;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) this.#removeParticle(this.particles.shift());
      const mesh = new THREE.Mesh(this.sharedParticleGeometry, this.sharedParticleMaterial.clone());
      mesh.userData.ignoreRaycast = true;
      mesh.material.color.setHex(color);
      mesh.position.copy(point).addScaledVector(normal, 0.012);
      this.scene.add(mesh);
      const velocity = normal.clone().multiplyScalar(0.25 + Math.random() * 0.6);
      velocity.x += (Math.random() - 0.5) * 0.9;
      velocity.y += Math.random() * 0.8;
      velocity.z += (Math.random() - 0.5) * 0.9;
      this.particles.push({ mesh, velocity, life: 0.18 + Math.random() * 0.22, maxLife: 0.4 });
    }
  }

  addTracer(start, end, weaponId) {
    if (this.tracers.length >= this.maxTracers) this.#removeTracer(this.tracers.shift());
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = this.sharedTracerMaterial.clone();
    if (weaponId === 'awp' || weaponId === 'ssg08') material.opacity = 0.78;
    const line = new THREE.Line(geometry, material);
    line.name = 'TransientBulletTracer';
    line.userData.ignoreRaycast = true;
    this.scene.add(line);
    this.tracers.push({ line, life: 0.075 });
  }

  #removeFlash(entry) { this.scene.remove(entry.mesh); entry.mesh.material.dispose(); }
  #removeParticle(entry) { this.scene.remove(entry.mesh); entry.mesh.material.dispose(); }
  #removeTracer(entry) { this.scene.remove(entry.line); entry.line.geometry.dispose(); entry.line.material.dispose(); }

  update(dt) {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const item = this.flashes[i];
      item.life -= dt;
      item.mesh.material.opacity = Math.max(0, item.life / 0.045);
      if (item.life <= 0) { this.#removeFlash(item); this.flashes.splice(i, 1); }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const item = this.tracers[i];
      item.life -= dt;
      item.line.material.opacity = Math.max(0, item.life / 0.075) * 0.55;
      if (item.life <= 0) { this.#removeTracer(item); this.tracers.splice(i, 1); }
    }
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const item = this.shells[i];
      item.life -= dt;
      item.velocity.y -= 9.81 * dt;
      item.mesh.position.addScaledVector(item.velocity, dt);
      item.mesh.rotation.x += item.angular.x * dt;
      item.mesh.rotation.y += item.angular.y * dt;
      item.mesh.rotation.z += item.angular.z * dt;
      if (item.mesh.position.y < 0.025) {
        item.mesh.position.y = 0.025;
        item.velocity.y = Math.abs(item.velocity.y) * 0.28;
        item.velocity.x *= 0.72;
        item.velocity.z *= 0.72;
      }
      if (item.life <= 0) { this.#removeShell(item); this.shells.splice(i, 1); }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const item = this.particles[i];
      item.life -= dt;
      item.velocity.y -= 4.5 * dt;
      item.mesh.position.addScaledVector(item.velocity, dt);
      item.mesh.material.opacity = Math.max(0, item.life / item.maxLife) * 0.8;
      if (item.life <= 0) { this.#removeParticle(item); this.particles.splice(i, 1); }
    }
  }

  dispose() {
    this.flashes.forEach((item) => this.#removeFlash(item));
    this.shells.forEach((item) => this.#removeShell(item));
    this.tracers.forEach((item) => this.#removeTracer(item));
    this.particles.forEach((item) => this.#removeParticle(item));
    this.shellGeometry.dispose();
    this.shellMaterial.dispose();
    this.sharedParticleGeometry.dispose();
    this.sharedParticleMaterial.dispose();
    this.sharedFlashGeometry.dispose();
    this.sharedFlashMaterial.dispose();
    this.sharedTracerMaterial.dispose();
  }
}
