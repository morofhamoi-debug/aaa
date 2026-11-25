const ALLOWED = {
  menu: new Set(['loading', 'playing']),
  loading: new Set(['playing', 'menu']),
  playing: new Set(['paused', 'menu']),
  paused: new Set(['playing', 'menu'])
};

export class StateManager {
  constructor(initialState = 'menu', eventBus) {
    this.current = initialState;
    this.events = eventBus;
  }

  set(nextState) {
    if (nextState === this.current) return false;
    if (!ALLOWED[this.current]?.has(nextState)) {
      throw new Error(`Invalid game state transition: ${this.current} -> ${nextState}`);
    }
    const previous = this.current;
    this.current = nextState;
    this.events?.emit('game:stateChanged', { previous, current: nextState });
    return true;
  }

  is(state) { return this.current === state; }
}
