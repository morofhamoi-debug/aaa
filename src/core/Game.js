import * as THREE from 'three';
import { GAME_CONFIG } from './Config.js';
import { EventBus } from './EventBus.js';
import { StateManager } from './StateManager.js';
import { Renderer } from './Renderer.js';
import { GameLoop } from './GameLoop.js';
import { SceneManager } from './SceneManager.js';
import { AssetManager } from './AssetManager.js';
import { CollisionWorld } from '../world/CollisionWorld.js';
import { World } from '../world/World.js';
import { InputManager } from '../player/InputManager.js';
import { Player } from '../player/Player.js';
import { WeaponManager } from '../weapons/WeaponManager.js';
import { UIManager } from '../interface/UIManager.js';

export class Game {
  constructor({ canvas }) {
    this.canvas = canvas;
    this.events = new EventBus();
    this.state = new StateManager('menu', this.events);
    this.sceneManager = new SceneManager();
    this.renderer = new Renderer(canvas);
    this.sceneManager.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
    this.assets = new AssetManager(this.events);
    this.collisionWorld = new CollisionWorld();
    this.world = new World(this.sceneManager.scene, this.collisionWorld, this.events);
    this.input = new InputManager(canvas, this.events);
    this.player = new Player({
      scene: this.sceneManager.scene,
      camera: this.sceneManager.camera,
      input: this.input,
      collisionWorld: this.collisionWorld,
      events: this.events
    });
    this.weapons = new WeaponManager({ player: this.player, scene: this.sceneManager.scene, input: this.input, events: this.events });
    this.ui = new UIManager(this, this.events);
    this.frameCount = 0;
    this.onResize = this.onResize.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onPointerLock = this.onPointerLock.bind(this);
    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('keydown', this.onKeyDown);
    this.events.on('input:pointerLock', this.onPointerLock);
    this.events.on('input:pointerLockError', () => this.events.emit('ui:toast', { message: 'POINTER LOCK ERROR' }));
    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (dt) => this.render(dt),
      shouldUpdate: () => this.state.is('playing')
    });
    this.loop.start();
  }

  async startTraining() {
    if (!this.state.is('menu')) return;
    this.state.set('loading');
    const pointerLockRequest = this.input.requestPointerLock().catch(() => false);
    await this.weapons.unlockAudio().catch(() => false);
    this.world.resetTargets();
    this.player.position.set(0, 0, 14);
    this.player.movement.velocity.set(0, 0, 0);
    this.player.currentHeight = GAME_CONFIG.player.standingHeight;
    this.player.physics.grounded = true;
    this.player.cameraRig.yaw = 0;
    this.player.cameraRig.pitch = -0.02;
    this.player.cameraRig.recoilPitch = 0;
    this.player.cameraRig.recoilYaw = 0;
    this.state.set('playing');
    pointerLockRequest.then((locked) => { if (locked === false) this.ui.showToast('CLICK THE GAME VIEW TO CAPTURE MOUSE'); });
  }

  resume() {
    if (!this.state.is('paused')) return;
    this.state.set('playing');
    this.input.requestPointerLock().catch(() => this.ui.showToast('CLICK THE GAME VIEW TO CAPTURE MOUSE'));
  }

  pause() {
    if (!this.state.is('playing')) return;
    this.state.set('paused');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  returnToMenu() {
    if (this.state.is('playing')) this.pause();
    if (this.state.is('paused') || this.state.is('playing')) this.state.set('menu');
  }

  onPointerLock({ locked }) {
    if (!locked && this.state.is('playing')) this.pause();
    if (locked && this.state.is('playing')) this.events.emit('ui:toast', { message: 'MOUSE CAPTURED' });
  }

  onKeyDown(event) {
    if (event.code === 'Escape' && this.state.is('playing') && !document.pointerLockElement) this.pause();
    if (event.code === 'F3') this.ui.toggleDebug();
  }

  onResize() {
    this.renderer.resize();
    this.sceneManager.resize(this.canvas.clientWidth || window.innerWidth, this.canvas.clientHeight || window.innerHeight);
  }

  update(dt) {
    this.player.update(dt);
    this.weapons.update(dt);
    this.input.endFrame();
  }

  render(dt) {
    this.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
    this.frameCount++;
    if (this.state.is('playing') && this.frameCount % 8 === 0) this.ui.updateFrame(dt * 8, this.loop.fps, this.renderer.getInfo(), this.player.getSnapshot());
  }

  dispose() {
    this.loop.stop();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    this.input.dispose();
    this.weapons.dispose();
    this.player.dispose();
    this.world.dispose();
    this.assets.clear();
    this.renderer.dispose();
    this.sceneManager.dispose();
    this.events.clear();
  }
}
