export class InputManager {
  constructor(element, eventBus) {
    this.element = element;
    this.events = eventBus;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseButtons = new Set();
    this.mousePressed = new Set();
    this.wheelDirection = 0;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.touchLookDeltaX = 0;
    this.touchLookDeltaY = 0;
    this.pointerLocked = false;
    this.isTouch = Boolean((navigator.maxTouchPoints ?? 0) > 0 || window.matchMedia?.('(pointer: coarse)').matches);
    this.virtualMove = { x: 0, y: 0 };
    this.touchKeys = new Set();
    this.touchKeyOwners = new Map();
    this.touchMouseOwners = new Map();
    this.touchActionPointers = new Map();
    this.joystickPointerId = null;
    this.lookPointerId = null;
    this.lastLookPoint = null;
    this.disposers = [];
    this.#bind();
    if (this.isTouch) this.#bindTouchControls();
  }

  #listen(target, name, handler, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(name, handler, options);
    this.disposers.push(() => target.removeEventListener(name, handler, options));
  }

  #bind() {
    this.#listen(window, 'keydown', (event) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (!this.keys.has(event.code)) this.pressed.add(event.code);
      this.keys.add(event.code);
      this.events?.emit('input:keyDown', { code: event.code });
    });
    this.#listen(window, 'keyup', (event) => {
      this.keys.delete(event.code);
      this.events?.emit('input:keyUp', { code: event.code });
    });
    this.#listen(this.element, 'mousedown', (event) => {
      if (!this.mouseButtons.has(event.button)) this.mousePressed.add(event.button);
      this.mouseButtons.add(event.button);
      this.events?.emit('input:mouseDown', { button: event.button });
    });
    this.#listen(window, 'mouseup', (event) => {
      this.mouseButtons.delete(event.button);
      this.events?.emit('input:mouseUp', { button: event.button });
    });
    this.#listen(window, 'mousemove', (event) => {
      if (!this.pointerLocked) return;
      this.mouseDeltaX += event.movementX || 0;
      this.mouseDeltaY += event.movementY || 0;
    });
    this.#listen(this.element, 'contextmenu', (event) => event.preventDefault());
    this.#listen(this.element, 'wheel', (event) => {
      if (this.pointerLocked) event.preventDefault();
      this.wheelDirection = Math.sign(event.deltaY);
      this.events?.emit('input:wheel', { direction: this.wheelDirection });
    }, { passive: false });
    this.#listen(document, 'pointerlockchange', () => {
      const wasLocked = this.pointerLocked;
      this.pointerLocked = document.pointerLockElement === this.element;
      this.events?.emit('input:pointerLock', { locked: this.pointerLocked, wasLocked });
    });
    this.#listen(document, 'pointerlockerror', () => this.events?.emit('input:pointerLockError', {}));
    this.#listen(window, 'blur', () => this.reset());
    this.#listen(document, 'visibilitychange', () => { if (document.hidden) this.reset(); });
  }

  #ownPointer(ownerMap, activeSet, pointerId, value, active, onFirstDown) {
    if (active) {
      let owners = ownerMap.get(value);
      if (!owners) {
        owners = new Set();
        ownerMap.set(value, owners);
      }
      if (owners.size === 0) onFirstDown?.();
      owners.add(pointerId);
      activeSet.add(value);
      return;
    }
    const owners = ownerMap.get(value);
    if (!owners) return;
    owners.delete(pointerId);
    if (owners.size === 0) {
      ownerMap.delete(value);
      activeSet.delete(value);
    }
  }

  #bindTouchControls() {
    const joystick = document.getElementById('touch-joystick');
    const knob = document.getElementById('touch-joystick-knob');
    const lookZone = document.getElementById('touch-look-zone');

    const updateJoystick = (event) => {
      if (this.joystickPointerId !== event.pointerId) return;
      const rect = joystick.getBoundingClientRect();
      const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.34);
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      const scale = distance > radius ? radius / distance : 1;
      const x = dx * scale;
      const y = dy * scale;
      this.virtualMove.x = x / radius;
      this.virtualMove.y = y / radius;
      if (knob) knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    };

    this.#listen(joystick, 'pointerdown', (event) => {
      if (event.pointerType !== 'touch') return;
      event.preventDefault();
      this.joystickPointerId = event.pointerId;
      joystick.setPointerCapture?.(event.pointerId);
      updateJoystick(event);
    });
    this.#listen(joystick, 'pointermove', updateJoystick);
    const releaseJoystick = (event) => {
      if (this.joystickPointerId !== event.pointerId) return;
      this.joystickPointerId = null;
      this.virtualMove.x = 0;
      this.virtualMove.y = 0;
      if (knob) knob.style.transform = 'translate(-50%, -50%)';
    };
    this.#listen(joystick, 'pointerup', releaseJoystick);
    this.#listen(joystick, 'pointercancel', releaseJoystick);
    this.#listen(joystick, 'lostpointercapture', releaseJoystick);

    this.#listen(lookZone, 'pointerdown', (event) => {
      if (event.pointerType !== 'touch') return;
      event.preventDefault();
      this.lookPointerId = event.pointerId;
      this.lastLookPoint = { x: event.clientX, y: event.clientY };
      lookZone.setPointerCapture?.(event.pointerId);
    });
    this.#listen(lookZone, 'pointermove', (event) => {
      if (event.pointerId !== this.lookPointerId || !this.lastLookPoint) return;
      event.preventDefault();
      this.touchLookDeltaX += event.clientX - this.lastLookPoint.x;
      this.touchLookDeltaY += event.clientY - this.lastLookPoint.y;
      this.lastLookPoint = { x: event.clientX, y: event.clientY };
    });
    const releaseLook = (event) => {
      if (event.pointerId !== this.lookPointerId) return;
      this.lookPointerId = null;
      this.lastLookPoint = null;
    };
    this.#listen(lookZone, 'pointerup', releaseLook);
    this.#listen(lookZone, 'pointercancel', releaseLook);
    this.#listen(lookZone, 'lostpointercapture', releaseLook);

    document.querySelectorAll('[data-touch-key], [data-touch-mouse]').forEach((button) => {
      this.#listen(button, 'pointerdown', (event) => {
        if (event.pointerType !== 'touch') return;
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        const key = button.dataset.touchKey || null;
        const mouse = button.dataset.touchMouse === undefined ? null : Number(button.dataset.touchMouse);
        this.touchActionPointers.set(event.pointerId, { key, mouse });
        if (key) this.#ownPointer(this.touchKeyOwners, this.touchKeys, event.pointerId, key, true, () => this.pressed.add(key));
        if (mouse !== null && Number.isFinite(mouse)) {
          this.#ownPointer(this.touchMouseOwners, this.mouseButtons, event.pointerId, mouse, true, () => this.mousePressed.add(mouse));
        }
      });
      const releaseAction = (event) => {
        const action = this.touchActionPointers.get(event.pointerId);
        if (!action) return;
        if (action.key) this.#ownPointer(this.touchKeyOwners, this.touchKeys, event.pointerId, action.key, false);
        if (action.mouse !== null) this.#ownPointer(this.touchMouseOwners, this.mouseButtons, event.pointerId, action.mouse, false);
        this.touchActionPointers.delete(event.pointerId);
      };
      this.#listen(button, 'pointerup', releaseAction);
      this.#listen(button, 'pointercancel', releaseAction);
      this.#listen(button, 'lostpointercapture', releaseAction);
    });
  }

  requestPointerLock() {
    if (this.isTouch) return Promise.resolve(false);
    if (!this.element?.requestPointerLock) return Promise.reject(new Error('Pointer Lock API is unavailable'));
    try {
      const request = this.element.requestPointerLock({ unadjustedMovement: true });
      return Promise.resolve(request).catch(() => this.element.requestPointerLock());
    } catch {
      try { return Promise.resolve(this.element.requestPointerLock()); }
      catch (error) { return Promise.reject(error); }
    }
  }

  getKey(code) {
    if (this.keys.has(code) || this.touchKeys.has(code)) return true;
    if (code === 'KeyW') return this.virtualMove.y < -0.2;
    if (code === 'KeyS') return this.virtualMove.y > 0.2;
    if (code === 'KeyA') return this.virtualMove.x < -0.2;
    if (code === 'KeyD') return this.virtualMove.x > 0.2;
    return false;
  }

  consumeKey(code) { const value = this.pressed.has(code); this.pressed.delete(code); return value; }
  getMouse(button) { return this.mouseButtons.has(button); }
  consumeMouse(button) { const value = this.mousePressed.has(button); this.mousePressed.delete(button); return value; }

  consumeMouseDelta() {
    const delta = { x: this.mouseDeltaX + this.touchLookDeltaX, y: this.mouseDeltaY + this.touchLookDeltaY };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.touchLookDeltaX = 0;
    this.touchLookDeltaY = 0;
    return delta;
  }

  endFrame() {
    this.pressed.clear();
    this.mousePressed.clear();
    this.wheelDirection = 0;
  }

  reset() {
    this.keys.clear();
    this.pressed.clear();
    this.mouseButtons.clear();
    this.mousePressed.clear();
    this.touchKeys.clear();
    this.touchKeyOwners.clear();
    this.touchMouseOwners.clear();
    this.touchActionPointers.clear();
    this.joystickPointerId = null;
    this.lookPointerId = null;
    this.lastLookPoint = null;
    this.virtualMove.x = 0;
    this.virtualMove.y = 0;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.touchLookDeltaX = 0;
    this.touchLookDeltaY = 0;
    this.wheelDirection = 0;
    const knob = document.getElementById('touch-joystick-knob');
    if (knob) knob.style.transform = 'translate(-50%, -50%)';
  }

  dispose() { this.reset(); this.disposers.forEach((dispose) => dispose()); this.disposers.length = 0; }
}
