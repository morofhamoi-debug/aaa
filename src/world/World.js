import * as THREE from 'three';
import { MATERIALS, createGroundTexture } from './Materials.js';

export class World {
  constructor(scene, collisionWorld, events) {
    this.scene = scene;
    this.collisions = collisionWorld;
    this.events = events;
    this.targets = [];
    this.objects = [];
    this.#buildEnvironment();
    this.#buildTargets();
  }

  #box(name, position, size, material, { solid = true, surface = 'concrete', receiveShadow = true } = {}) {
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = receiveShadow;
    mesh.userData.surface = surface;
    this.scene.add(mesh);
    this.objects.push(mesh);
    if (solid) {
      const half = size.clone().multiplyScalar(0.5);
      this.collisions.addBox(position.clone().sub(half), position.clone().add(half), { material: surface, mesh, tag: name });
    }
    return mesh;
  }

  #buildEnvironment() {
    const groundTexture = createGroundTexture();
    const floorMaterial = MATERIALS.floor.clone();
    floorMaterial.map = groundTexture;
    floorMaterial.needsUpdate = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(48, 72), floorMaterial);
    floor.name = 'TrainingRangeFloor';
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -4);
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.objects.push(floor);

    // Boundary walls form a contained test range without an artificial ceiling.
    this.#box('NorthRangeWall', new THREE.Vector3(0, 3, -39), new THREE.Vector3(48, 6, 0.8), MATERIALS.concreteDark);
    this.#box('SouthRangeWall', new THREE.Vector3(0, 3, 31), new THREE.Vector3(48, 6, 0.8), MATERIALS.concreteDark);
    this.#box('WestRangeWall', new THREE.Vector3(-24, 3, -4), new THREE.Vector3(0.8, 6, 70), MATERIALS.concreteDark);
    this.#box('EastRangeWall', new THREE.Vector3(24, 3, -4), new THREE.Vector3(0.8, 6, 70), MATERIALS.concreteDark);

    // Backstop and firing lanes.
    this.#box('Backstop', new THREE.Vector3(0, 4.5, -31), new THREE.Vector3(29, 9, 1.4), MATERIALS.concrete);
    for (let lane = -2; lane <= 2; lane++) {
      this.#box(`LaneDivider${lane}`, new THREE.Vector3(lane * 4.2 + 2.1, 0.85, -13), new THREE.Vector3(0.12, 1.7, 18), MATERIALS.metal, { surface: 'metal' });
      this.#box(`LaneMark${lane}`, new THREE.Vector3(lane * 4.2, 0.012, -5), new THREE.Vector3(0.055, 0.012, 28), MATERIALS.warning, { solid: false });
    }

    // Cover objects, crates, a low obstacle and a ceiling test passage.
    this.#box('ConcreteCoverLeft', new THREE.Vector3(-8.2, 0.85, 2), new THREE.Vector3(3.4, 1.7, 2.2), MATERIALS.concrete);
    this.#box('ConcreteCoverRight', new THREE.Vector3(8.4, 1.15, -4), new THREE.Vector3(3.2, 2.3, 2.1), MATERIALS.concrete);
    this.#box('MetalCrateA', new THREE.Vector3(-3.1, 0.65, -2.5), new THREE.Vector3(1.4, 1.3, 1.4), MATERIALS.metal, { surface: 'metal' });
    this.#box('MetalCrateB', new THREE.Vector3(-1.45, 0.65, -4.05), new THREE.Vector3(1.4, 1.3, 1.4), MATERIALS.metal, { surface: 'metal' });
    this.#box('WoodenTrainingCrate', new THREE.Vector3(5.2, 0.55, 5.1), new THREE.Vector3(1.8, 1.1, 1.8), MATERIALS.warning, { surface: 'wood' });
    this.#box('LowObstacle', new THREE.Vector3(0, 0.18, 4.2), new THREE.Vector3(2.8, 0.36, 0.7), MATERIALS.concrete);
    this.#box('CeilingBeamLeft', new THREE.Vector3(-12.5, 1.66, 9), new THREE.Vector3(5.8, 0.22, 6), MATERIALS.metal);
    this.#box('CeilingBeamRight', new THREE.Vector3(12.5, 1.66, 9), new THREE.Vector3(5.8, 0.22, 6), MATERIALS.metal);

    // Raised platforms create a genuine vertical collision test.
    this.#box('PlatformLow', new THREE.Vector3(-14, 0.38, -4), new THREE.Vector3(4.5, 0.76, 4.2), MATERIALS.concrete);
    this.#box('PlatformHigh', new THREE.Vector3(14, 0.9, -11), new THREE.Vector3(4.5, 1.8, 4.2), MATERIALS.concrete);

    const ambient = new THREE.HemisphereLight(0xb9c9d3, 0x34302a, 1.15);
    this.scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffe4c2, 2.35);
    key.position.set(-13, 22, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -32;
    key.shadow.camera.right = 32;
    key.shadow.camera.top = 32;
    key.shadow.camera.bottom = -32;
    key.shadow.normalBias = 0.035;
    this.scene.add(key);
    const fill = new THREE.PointLight(0x9ab7c9, 18, 36, 2);
    fill.position.set(14, 7, -16);
    this.scene.add(fill);
    const overhead = new THREE.PointLight(0xe3e5db, 14, 26, 2);
    overhead.position.set(-2, 7, 7);
    this.scene.add(overhead);

    // Structural details add scale cues while staying inexpensive.
    for (let i = 0; i < 9; i++) {
      this.#box(`SupportColumn${i}`, new THREE.Vector3(-20 + i * 5, 2.6, -37.8), new THREE.Vector3(0.35, 5.2, 0.35), MATERIALS.metal, { surface: 'metal' });
    }
    const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0x9b7840, roughness: 0.7 });
    for (let i = 0; i < 5; i++) {
      this.#box(`RangeNumberPlate${i}`, new THREE.Vector3((i - 2) * 4.2, 2.4, -29.9), new THREE.Vector3(1.45, 0.7, 0.08), stripeMaterial, { solid: false });
    }
  }

  #buildTargets() {
    const positions = [
      [-8.4, 0, -23], [-4.2, 0, -23], [0, 0, -23], [4.2, 0, -23], [8.4, 0, -23],
      [-12.5, 0, -17], [12.5, 0, -17]
    ];
    positions.forEach(([x, y, z], index) => {
      const group = new THREE.Group();
      group.name = `TrainingTarget_${index + 1}`;
      group.position.set(x, y, z);
      const target = {
        id: index + 1,
        health: 100,
        maxHealth: 100,
        applyDamage: (amount, zone) => {
          target.health = Math.max(0, target.health - amount);
          this.events.emit('combat:targetDamaged', { targetId: target.id, health: target.health, amount, zone });
          if (target.health <= 0) {
            target.health = 100;
            this.events.emit('combat:targetReset', { targetId: target.id });
          }
        }
      };
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.82, 4, 8), MATERIALS.target);
      body.position.y = 0.84;
      body.castShadow = true;
      body.userData.damageTarget = target;
      body.userData.hitZone = 'body';
      group.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), MATERIALS.targetDark);
      head.position.y = 1.55;
      head.castShadow = true;
      head.userData.damageTarget = target;
      head.userData.hitZone = 'head';
      group.add(head);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.12), MATERIALS.targetDark);
      plate.position.y = 0.96;
      plate.position.z = -0.16;
      plate.receiveShadow = true;
      group.add(plate);
      this.scene.add(group);
      this.targets.push({ group, target });
    });
  }

  resetTargets() { this.targets.forEach(({ target }) => { target.health = target.maxHealth; }); }

  dispose() {
    for (const object of this.objects) {
      this.scene.remove(object);
      object.geometry?.dispose();
    }
    for (const { group } of this.targets) {
      this.scene.remove(group);
      group.traverse((object) => object.geometry?.dispose());
    }
  }
}
