import * as THREE from 'three';
import { GAME_CONFIG } from '../core/Config.js';
import { Movement } from './Movement.js';
import { PlayerPhysics } from './PlayerPhysics.js';
import { PlayerCamera } from './PlayerCamera.js';
import { CameraEffects } from './CameraEffects.js';

export class Player {
  constructor({ scene, camera, input, collisionWorld, events }) {
    this.scene = scene;
    this.camera = camera;
    this.input = input;
    this.events = events;
    this.position = new THREE.Vector3(0, 0, 14);
    this.movement = new Movement();
    this.physics = new PlayerPhysics(collisionWorld);
    this.cameraRig = new PlayerCamera(camera, input, events);
    this.cameraEffects = new CameraEffects();
    this.currentHeight = GAME_CONFIG.player.standingHeight;
    this.viewModelAnchor = new THREE.Group();
    this.viewModelAnchor.name = 'FirstPersonViewModelAnchor';
    this.camera.add(this.viewModelAnchor);
    this.camera.position.set(0, GAME_CONFIG.player.standingEyeHeight, 7);
    this.health = 100;
    this.alive = true;
    this._landOff = events.on('player:landed', ({ impactSpeed }) => this.cameraEffects.onLand(impactSpeed));
  }

  update(dt) {
    this.cameraRig.updateLook();
    const jump = this.input.consumeKey('Space');
    this.movement.update(this.input, this.cameraRig.yaw, dt, this.physics.grounded);
    this.physics.update(this, dt, jump);
    this.cameraRig.apply(this.position, this.currentHeight <= GAME_CONFIG.player.crouchingHeight + 0.1
      ? GAME_CONFIG.player.crouchingEyeHeight : THREE.MathUtils.lerp(GAME_CONFIG.player.crouchingEyeHeight, GAME_CONFIG.player.standingEyeHeight,
        THREE.MathUtils.clamp((this.currentHeight - GAME_CONFIG.player.crouchingHeight) / (GAME_CONFIG.player.standingHeight - GAME_CONFIG.player.crouchingHeight), 0, 1)),
    this.cameraEffects.update(dt, this.movement, this.physics.grounded));
    this.events.emit('player:updated', this.getSnapshot());
  }

  getSnapshot() {
    return {
      position: this.position.clone(),
      velocity: this.movement.velocity.clone(),
      horizontalSpeed: this.movement.horizontalSpeed,
      verticalSpeed: this.movement.velocity.y,
      grounded: this.physics.grounded,
      crouched: this.movement.crouched,
      sprinting: this.movement.sprinting,
      yaw: this.cameraRig.yaw,
      pitch: this.cameraRig.pitch,
      height: this.currentHeight,
      health: this.health
    };
  }

  dispose() { this._landOff?.(); this.camera.remove(this.viewModelAnchor); }
}
