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
    this.pointerLocked = false;
    this.disposers = [];
    this.#bind();
  }

  #listen(target, name, handler, options) {
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
    this.#listen(this.element, 'wheel', (event) => { if (this.pointerLocked) event.preventDefault(); this.wheelDirection = Math.sign(event.deltaY); this.events?.emit('input:wheel', { direction: this.wheelDirection }); }, { passive: false });
    this.#listen(document, 'pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.element;
      this.events?.emit('input:pointerLock', { locked: this.pointerLocked });
    });
    this.#listen(document, 'pointerlockerror', () => this.events?.emit('input:pointerLockError', {}));
    this.#listen(window, 'blur', () => this.reset());
    this.#listen(document, 'visibilitychange', () => { if (document.hidden) this.reset(); });
  }

  requestPointerLock() {
    if (!this.element?.requestPointerLock) return Promise.reject(new Error('Pointer Lock API is unavailable'));
    try {
      const result = this.element.requestPointerLock({ unadjustedMovement: true });
      return result instanceof Promise ? result.catch(() => this.element.requestPointerLock()) : Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  getKey(code) { return this.keys.has(code); }
  consumeKey(code) { const value = this.pressed.has(code); this.pressed.delete(code); return value; }
  getMouse(button) { return this.mouseButtons.has(button); }
  consumeMouse(button) { const value = this.mousePressed.has(button); this.mousePressed.delete(button); return value; }
  consumeMouseDelta() {
    const delta = { x: this.mouseDeltaX, y: this.mouseDeltaY };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
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
    this.wheelDirection = 0;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
  }

  dispose() { this.reset(); this.disposers.forEach((dispose) => dispose()); this.disposers.length = 0; }
}
