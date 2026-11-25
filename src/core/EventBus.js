export class EventBus {
  #listeners = new Map();

  on(eventName, callback) {
    if (typeof callback !== 'function') throw new TypeError('Event callback must be a function');
    const listeners = this.#listeners.get(eventName) ?? new Set();
    listeners.add(callback);
    this.#listeners.set(eventName, listeners);
    return () => this.off(eventName, callback);
  }

  once(eventName, callback) {
    const dispose = this.on(eventName, (payload) => {
      dispose();
      callback(payload);
    });
    return dispose;
  }

  off(eventName, callback) {
    const listeners = this.#listeners.get(eventName);
    if (!listeners) return;
    listeners.delete(callback);
    if (listeners.size === 0) this.#listeners.delete(eventName);
  }

  emit(eventName, payload = {}) {
    const listeners = this.#listeners.get(eventName);
    if (!listeners) return;
    for (const callback of [...listeners]) callback(payload);
  }

  clear() { this.#listeners.clear(); }
}
