import { Game } from './core/Game.js';

const canvas = document.getElementById('game-canvas');
const errorScreen = document.getElementById('error-screen');
const errorMessage = document.getElementById('error-message');

function showInitializationError(error) {
  console.error('[TACTICAL STRIKE] Initialization failed:', error);
  if (errorMessage) {
    const details = error instanceof Error ? error.message : String(error ?? 'Неизвестная ошибка');
    errorMessage.textContent = [
      details,
      '',
      'Проверьте, что открыт актуальный сайт в Safari/Chrome, включён JavaScript и браузеру разрешено использовать WebGL 2.'
    ].join('\n');
  }
  errorScreen?.classList.remove('hidden');
}

try {
  if (!canvas) throw new Error('Не найден игровой canvas #game-canvas.');
  const game = new Game({ canvas });

  window.addEventListener('beforeunload', () => game.dispose(), { once: true });
  canvas.addEventListener('click', () => {
    if (!game.input.isTouch && game.state.is('playing') && !game.input.pointerLocked) {
      game.input.requestPointerLock().catch(() => game.ui.showToast('БРАУЗЕР НЕ РАЗРЕШИЛ ЗАХВАТ МЫШИ'));
    }
  });
  document.getElementById('error-reload-button')?.addEventListener('click', () => window.location.reload());
  console.info('[TACTICAL STRIKE] Engine initialized. Press START TRAINING to enter the range.');
} catch (error) {
  showInitializationError(error);
}
