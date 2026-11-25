import { GAME_CONFIG } from './Config.js';

export class GameLoop {
  constructor({ update, render, shouldUpdate = () => true }) {
    this.update = update;
    this.render = render;
    this.shouldUpdate = shouldUpdate;
    this.running = false;
    this.lastTime = 0;
    this.accumulator = 0;
    this.frame = this.frame.bind(this);
    this.frameHandle = 0;
    this.delta = 0;
    this.fps = 0;
    this.fpsFrames = 0;
    this.fpsTime = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  frame(now) {
    if (!this.running) return;
    const elapsed = Math.min((now - this.lastTime) / 1000, GAME_CONFIG.maxFrameDelta);
    this.lastTime = now;
    this.delta = elapsed;
    if (this.shouldUpdate()) {
      this.accumulator += elapsed;
      let steps = 0;
      while (this.accumulator >= GAME_CONFIG.fixedTimeStep && steps < GAME_CONFIG.maxSubSteps) {
        this.update(GAME_CONFIG.fixedTimeStep);
        this.accumulator -= GAME_CONFIG.fixedTimeStep;
        steps++;
      }
      if (steps === GAME_CONFIG.maxSubSteps) this.accumulator = 0;
    } else {
      this.accumulator = 0;
    }
    this.render(elapsed, now);
    this.fpsFrames++;
    this.fpsTime += elapsed;
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frameHandle);
  }
}
