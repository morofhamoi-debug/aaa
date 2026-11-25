import * as THREE from 'three';
import { WEAPON_CONFIG, WEAPON_SLOTS } from './WeaponConfig.js';
import { WeaponBase } from './WeaponBase.js';
import { createWeaponViewModel } from './WeaponModelFactory.js';
import { RecoilSystem } from './RecoilSystem.js';
import { SpreadSystem } from './SpreadSystem.js';
import { BallisticsSystem } from './BallisticsSystem.js';
import { WeaponEffects } from './WeaponEffects.js';
import { WeaponAudio } from './WeaponAudio.js';

export class WeaponManager {
  constructor({ player, scene, input, events }) {
    this.player = player;
    this.scene = scene;
    this.input = input;
    this.events = events;
    this.weapons = new Map(Object.entries(WEAPON_CONFIG).map(([id, config]) => [id, new WeaponBase(config)]));
    this.models = new Map();
    this.activeId = null;
    this.activeModel = null;
    this.aiming = false;
    this.inspectTimer = 0;
    this.switchCooldown = 0;
    this.baseFov = player.camera.fov;
    this.recoil = new RecoilSystem(player.cameraRig);
    this.spread = new SpreadSystem();
    this.effects = new WeaponEffects(scene);
    this.ballistics = new BallisticsSystem(scene, events, this.effects);
    this.audio = new WeaponAudio();
    this.bobTime = 0;
    this.lastYaw = player.cameraRig.yaw;
    this.lastPitch = player.cameraRig.pitch;
    this.mouseRotation = new THREE.Vector2();
    this._wheelOff = events.on('input:wheel', ({ direction }) => {
      if (!this.input.pointerLocked) return;
      const ids = WEAPON_SLOTS;
      const current = Math.max(0, ids.indexOf(this.activeId));
      const next = (current + (direction > 0 ? 1 : ids.length - 1)) % ids.length;
      this.switchTo(ids[next]);
    });
    this.switchTo('ak47', true);
  }

  async unlockAudio() { return this.audio.unlock(); }

  #getModel(id) {
    if (!this.models.has(id)) {
      const model = createWeaponViewModel(WEAPON_CONFIG[id]);
      model.visible = false;
      this.models.set(id, model);
    }
    return this.models.get(id);
  }

  switchTo(id, immediate = false) {
    const next = this.weapons.get(id);
    if (!next || this.activeId === id || (!immediate && this.switchCooldown > 0)) return false;
    const previousId = this.activeId;
    if (this.activeId) {
      this.weapons.get(this.activeId)?.cancelReload();
      this.events.emit('weapon:unequipped', { id: this.activeId });
    }
    if (this.activeModel) {
      this.activeModel.visible = false;
      this.player.viewModelAnchor.remove(this.activeModel);
    }
    this.activeId = id;
    this.activeModel = this.#getModel(id);
    this.player.viewModelAnchor.add(this.activeModel);
    this.activeModel.visible = true;
    this.switchCooldown = immediate ? 0 : 0.38;
    this.inspectTimer = 0;
    this.aiming = false;
    this.player.camera.fov = this.baseFov;
    this.player.camera.updateProjectionMatrix();
    this.recoil.resetPattern();
    this.audio.play('equip', id);
    this.events.emit('weapon:equipped', { previous: previousId, current: id, weapon: next.getSnapshot(), config: next.config });
    this.events.emit('weapon:ammoChanged', next.getSnapshot());
    return true;
  }

  #handleHotkeys() {
    if (this.input.consumeKey('Digit1')) this.switchTo('ak47');
    if (this.input.consumeKey('Digit2')) this.switchTo('glock18');
    if (this.input.consumeKey('Digit3')) this.switchTo('knife');
    if (this.input.consumeKey('Digit4')) this.switchTo('awp');
    if (this.input.consumeKey('Digit5')) this.switchTo('m4a4');
    if (this.input.consumeKey('Digit6')) this.switchTo('m4a1s');
    if (this.input.consumeKey('Digit7')) this.switchTo('ssg08');
    if (this.input.consumeKey('Digit8')) this.switchTo('usps');
    if (this.input.consumeKey('Digit9')) this.switchTo('deagle');
    if (this.input.consumeKey('Digit0')) this.switchTo('mp5sd');
    if (this.input.consumeKey('KeyK')) this.switchTo('mac10');
    if (this.input.consumeKey('KeyJ')) this.switchTo('nova');
    if (this.input.consumeKey('KeyL')) this.switchTo('xm1014');
  }

  #fire(weapon) {
    if (!weapon.canFire()) {
      if (weapon.magazine <= 0 && weapon.emptyClickCooldown <= 0) {
        weapon.emptyClickCooldown = 0.22;
        this.audio.play('empty', weapon.config.id);
        this.events.emit('weapon:empty', { id: weapon.config.id });
      }
      return false;
    }
    if (!weapon.consumeShot()) return false;
    const spread = this.spread.current;
    const result = this.ballistics.fire(this.player.camera, weapon.config, spread, { pellets: weapon.config.pellets ?? 1 });
    this.recoil.addShot(weapon.config);
    if (result.some((entry) => entry.damage > 0)) this.audio.play('hit', weapon.config.id);
    else if (result.length) this.audio.play('impact', weapon.config.id);
    if (weapon.config.fireMode !== 'melee') {
      this.effects.addMuzzleFlash(this.activeModel?.userData.attachments?.muzzle);
      if (!weapon.config.suppressor) this.effects.addShell(this.activeModel?.userData.attachments?.eject);
    }
    this.audio.play('fire', weapon.config.id);
    this.events.emit('weapon:fired', { id: weapon.config.id, ammo: weapon.magazine, spread, hits: result.length });
    this.events.emit('weapon:ammoChanged', weapon.getSnapshot());
    return true;
  }

  #handleReload(weapon) {
    if (!this.input.consumeKey('KeyR')) return;
    if (weapon.startReload()) {
      this.aiming = false;
      this.audio.play('reload', weapon.config.id);
      this.events.emit('weapon:reloadStarted', weapon.getSnapshot());
    }
  }

  #updateModel(dt, playerSnapshot) {
    if (!this.activeModel) return;
    const config = this.weapons.get(this.activeId).config;
    const model = this.activeModel;
    this.bobTime += dt * (playerSnapshot.sprinting ? 12 : 8);
    const speedFactor = Math.min(1, playerSnapshot.horizontalSpeed / 5.8);
    const bob = speedFactor * (playerSnapshot.crouched ? 0.35 : 1);
    const target = this.aiming ? config.aimPosition : config.viewPosition;
    const equipDrop = this.switchCooldown > 0 ? Math.sin((this.switchCooldown / 0.38) * Math.PI) * 0.1 : 0;
    const inspect = this.inspectTimer > 0 ? Math.sin((1.15 - this.inspectTimer) * Math.PI / 1.15) : 0;
    const swayYaw = THREE.MathUtils.clamp(this.player.cameraRig.yaw - this.lastYaw, -0.08, 0.08);
    const swayPitch = THREE.MathUtils.clamp(this.player.cameraRig.pitch - this.lastPitch, -0.08, 0.08);
    this.lastYaw = this.player.cameraRig.yaw;
    this.lastPitch = this.player.cameraRig.pitch;
    const offsetX = Math.sin(this.bobTime * 0.5) * 0.012 * bob;
    const offsetY = Math.abs(Math.cos(this.bobTime)) * 0.012 * bob;
    const lerp = 1 - Math.exp((this.aiming ? -16 : -12) * dt);
    model.position.x = THREE.MathUtils.lerp(model.position.x, target[0] + offsetX - swayYaw * 0.45, lerp);
    model.position.y = THREE.MathUtils.lerp(model.position.y, target[1] + offsetY - equipDrop - this.recoil.visualPitch * 0.04, lerp);
    model.position.z = THREE.MathUtils.lerp(model.position.z, target[2] + this.recoil.visualPitch * 0.02, lerp);
    model.rotation.x = THREE.MathUtils.lerp(model.rotation.x, swayPitch * 0.42 + this.recoil.visualPitch * 0.5, lerp);
    model.rotation.y = THREE.MathUtils.lerp(model.rotation.y, -swayYaw * 0.55 + this.recoil.visualYaw * 0.4, lerp);
    model.rotation.z = THREE.MathUtils.lerp(model.rotation.z, -swayYaw * 0.4 + this.recoil.visualRoll * 0.4, lerp);
    const magazine = model.userData.magazine;
    if (magazine && this.weapons.get(this.activeId).reloading) {
      const weapon = this.weapons.get(this.activeId);
      const progress = 1 - Math.min(1, weapon.reloadTimer / Math.max(0.01, config.reloadTime));
      magazine.position.y = model.userData.magazineRestY - Math.sin(progress * Math.PI) * 0.12;
    } else if (magazine) {
      magazine.position.y = THREE.MathUtils.damp(magazine.position.y, model.userData.magazineRestY, 16, dt);
    }
    if (this.weapons.get(this.activeId).reloading && config.reloadStyle === 'shell') {
      model.rotation.x += Math.sin(this.weapons.get(this.activeId).reloadTimer * 10) * 0.025;
    }
    if (this.inspectTimer > 0) {
      model.rotation.y += inspect * 0.62;
      model.rotation.x += inspect * 0.22;
    }
  }

  update(dt) {
    this.#handleHotkeys();
    const weapon = this.weapons.get(this.activeId);
    if (!weapon) return;
    this.switchCooldown = Math.max(0, this.switchCooldown - dt);
    const wasInspecting = this.inspectTimer > 0;
    this.inspectTimer = Math.max(0, this.inspectTimer - dt);
    if (wasInspecting && this.inspectTimer === 0) this.events.emit('weapon:inspectEnded', { id: this.activeId });
    const previousAim = this.aiming;
    this.aiming = this.input.getMouse(2) && !weapon.reloading && this.inspectTimer <= 0;
    if (this.aiming !== previousAim) this.events.emit(this.aiming ? 'weapon:aimStarted' : 'weapon:aimEnded', { id: this.activeId });
    const targetFov = this.aiming ? (weapon.config.aimFov ?? 62) : this.baseFov;
    this.player.camera.fov = THREE.MathUtils.damp(this.player.camera.fov, targetFov, 14, dt);
    this.player.camera.updateProjectionMatrix();

    this.#handleReload(weapon);
    const reloadResult = weapon.update(dt);
    if (reloadResult) {
      this.audio.play('reload', this.activeId);
      this.events.emit('weapon:ammoChanged', weapon.getSnapshot());
      this.events.emit('weapon:reloaded', { ...weapon.getSnapshot(), complete: reloadResult.complete, shell: reloadResult.shell });
    }

    if (this.input.consumeKey('KeyQ') && !weapon.reloading && this.switchCooldown <= 0) {
      this.inspectTimer = 1.15;
      this.aiming = false;
      this.events.emit('weapon:inspectStarted', { id: this.activeId });
    }
    const click = this.input.consumeMouse(0);
    const wantsFire = this.input.getMouse(0) && weapon.config.fireMode === 'auto' || click;
    if (wantsFire && this.input.pointerLocked && this.inspectTimer <= 0 && this.switchCooldown <= 0) this.#fire(weapon);

    this.spread.update(dt, weapon, this.player, this.aiming);
    this.recoil.update(dt, weapon.config);
    this.#updateModel(dt, this.player.getSnapshot());
    this.effects.update(dt);
    this.events.emit('weapon:state', { ...weapon.getSnapshot(), aiming: this.aiming, spread: this.spread.current });
  }

  getSnapshot() { return this.weapons.get(this.activeId)?.getSnapshot() ?? null; }

  dispose() {
    this._wheelOff?.();
    this.effects.dispose();
    this.audio.dispose();
    for (const model of this.models.values()) {
      this.player.viewModelAnchor.remove(model);
      model.traverse((object) => { object.geometry?.dispose(); if (object.material && !Array.isArray(object.material)) object.material.dispose(); });
    }
    this.models.clear();
  }
}
