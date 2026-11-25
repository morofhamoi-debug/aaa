export class UIManager {
  constructor(game, events) {
    this.game = game;
    this.events = events;
    this.elements = Object.fromEntries([
      'main-menu', 'pause-menu', 'loading-screen', 'hud', 'error-screen', 'error-message', 'start-button', 'resume-button', 'exit-button',
      'weapon-name', 'weapon-type', 'ammo-current', 'ammo-reserve', 'health-value', 'stance-indicator', 'fps-counter', 'time-counter',
      'debug-panel', 'hit-marker', 'toast', 'interaction-prompt'
    ].map((id) => [id, document.getElementById(id)]));
    this.sessionTime = 0;
    this.toastTimer = 0;
    this.debug = false;
    this.#bind();
  }

  #bind() {
    this.elements['start-button'].addEventListener('click', () => this.game.startTraining());
    this.elements['resume-button'].addEventListener('click', () => this.game.resume());
    this.elements['exit-button'].addEventListener('click', () => this.game.returnToMenu());
    this.events.on('weapon:equipped', ({ config }) => this.updateWeapon(config));
    this.events.on('weapon:ammoChanged', (data) => this.updateAmmo(data));
    this.events.on('weapon:state', (data) => this.updateAmmo(data));
    this.events.on('player:updated', (data) => this.updatePlayer(data));
    this.events.on('combat:targetDamaged', ({ zone }) => this.showHit(zone));
    this.events.on('weapon:empty', () => this.showToast('MAGAZINE EMPTY'));
    this.events.on('weapon:reloadStarted', () => this.showToast('RELOADING'));
    this.events.on('input:pointerLockError', () => this.showToast('MOUSE LOCK UNAVAILABLE — CLICK GAME VIEW'));
    this.events.on('ui:toast', ({ message }) => this.showToast(message));
    this.events.on('input:pointerLock', ({ locked }) => this.elements['interaction-prompt'].classList.toggle('hidden', locked));
    this.events.on('game:stateChanged', ({ current }) => this.setState(current));
  }

  setState(state) {
    this.elements['main-menu'].classList.toggle('hidden', state !== 'menu');
    this.elements['pause-menu'].classList.toggle('hidden', state !== 'paused');
    this.elements['loading-screen'].classList.toggle('hidden', state !== 'loading');
    this.elements.hud.classList.toggle('hidden', state !== 'playing');
    if (state === 'playing') this.sessionTime = 0;
  }

  showError(message) {
    this.elements['error-screen'].classList.remove('hidden');
    this.elements['error-message'].textContent = message;
  }

  updateWeapon(config) {
    if (!config) return;
    this.elements['weapon-name'].textContent = config.name;
    this.elements['weapon-type'].textContent = config.type;
  }

  updateAmmo(data) {
    if (!data) return;
    this.elements['ammo-current'].textContent = String(data.magazine ?? 0).padStart(2, '0');
    this.elements['ammo-reserve'].textContent = String(data.reserve ?? 0).padStart(2, '0');
  }

  updatePlayer(player) {
    this.elements['health-value'].textContent = String(Math.round(player.health));
    this.elements['stance-indicator'].textContent = player.crouched ? 'CROUCH' : player.sprinting ? 'SPRINT' : player.horizontalSpeed > 0.2 ? 'MOVING' : 'STANDING';
  }

  showHit(zone) {
    const marker = this.elements['hit-marker'];
    marker.classList.remove('hidden', 'headshot');
    if (zone === 'head') marker.classList.add('headshot');
    clearTimeout(this.hitTimeout);
    this.hitTimeout = setTimeout(() => marker.classList.add('hidden'), 115);
  }

  showToast(message) {
    const toast = this.elements.toast;
    toast.textContent = message;
    toast.classList.add('visible');
    this.toastTimer = 1.3;
  }

  updateFrame(dt, fps, rendererInfo, player) {
    this.sessionTime += dt;
    const seconds = Math.floor(this.sessionTime);
    this.elements['time-counter'].textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    this.elements['fps-counter'].textContent = `${fps || '--'} FPS`;
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.elements.toast.classList.remove('visible');
    }
    if (player && this.debug) {
      const pos = player.position;
      this.elements['debug-panel'].textContent = `XYZ ${pos.x.toFixed(2)} / ${pos.y.toFixed(2)} / ${pos.z.toFixed(2)}\nSPEED ${player.horizontalSpeed.toFixed(2)} m/s\nVY ${player.verticalSpeed.toFixed(2)}\nGROUND ${player.grounded}\nHEIGHT ${player.height.toFixed(2)} m\nDRAW CALLS ${rendererInfo.render.calls}\nTRIANGLES ${rendererInfo.render.triangles.toLocaleString()}`;
    }
  }

  toggleDebug() {
    this.debug = !this.debug;
    this.elements['debug-panel'].classList.toggle('hidden', !this.debug);
  }
}
