import assert from 'node:assert/strict';
import { EventBus } from '../src/core/EventBus.js';
import { StateManager } from '../src/core/StateManager.js';
import { WeaponBase } from '../src/weapons/WeaponBase.js';
import { WEAPON_CONFIG } from '../src/weapons/WeaponConfig.js';

const bus = new EventBus();
let received = 0;
const off = bus.on('sample', ({ value }) => { received += value; });
bus.emit('sample', { value: 2 });
off();
bus.emit('sample', { value: 3 });
assert.equal(received, 2, 'EventBus should unsubscribe listeners');

const stateEvents = new EventBus();
const states = new StateManager('menu', stateEvents);
assert.equal(states.set('loading'), true);
assert.equal(states.set('playing'), true);
assert.equal(states.set('playing'), false);
assert.throws(() => states.set('loading'), /Invalid game state transition/);

const rifle = new WeaponBase(WEAPON_CONFIG.ak47);
assert.equal(rifle.magazine, 30);
assert.equal(rifle.consumeShot(), true);
assert.equal(rifle.magazine, 29);
assert.equal(rifle.canFire(), false, 'Fire-rate cooldown should block consecutive shots');
rifle.update(0.2);
assert.equal(rifle.canFire(), true);
assert.equal(rifle.startReload(), true);
assert.equal(rifle.startReload(), false, 'Reload should not be started twice');
rifle.update(2.5);
assert.equal(rifle.magazine, 30);
assert.equal(rifle.reserve, 89);
assert.equal(rifle.reloading, false);

const shotgun = new WeaponBase(WEAPON_CONFIG.nova);
shotgun.magazine = 0;
assert.equal(shotgun.startReload(), true);
shotgun.update(0.7);
assert.equal(shotgun.magazine, 1, 'Tube-fed reload should insert shells incrementally');
assert.equal(shotgun.reserve, 31);
assert.equal(shotgun.reloading, true);

const knife = new WeaponBase(WEAPON_CONFIG.knife);
assert.equal(knife.canFire(), true, 'Melee weapons do not use magazine ammo');
assert.equal(knife.consumeShot(), true);
assert.equal(knife.magazine, 0);

console.log('Unit tests passed: event bus, state transitions, rifle ammo/reload, shell reload and melee fire.');
