import './styles/main.css';
import { Game } from './core/Game.js';

const canvas = document.getElementById('game-canvas');

try {
  const game = new Game({ canvas });
  window.addEventListener('beforeunload', () => game.dispose(), { once: true });
  canvas.addEventListener('click', () => {
    if (game.state.is('playing') && !game.input.pointerLocked) {
      game.input.requestPointerLock().catch(() => game.ui.showToast('POINTER LOCK UNAVAILABLE'));
    }
  });
  console.info('[TACTICAL STRIKE] Engine initialized. Press START TRAINING to enter the range.');
} catch (error) {
  console.error('[TACTICAL STRIKE] Initialization failed:', error);
  document.getElementById('error-screen').classList.remove('hidden');
  document.getElementById('error-message').textContent = error?.message ?? 'Unknown initialization error';
}
