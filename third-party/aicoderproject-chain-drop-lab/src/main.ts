import './style.css';
import { Game } from './game/game';
import { GameMode } from './game/types';
import { SoundManager } from './game/audio';

const MODE_DESCRIPTIONS: Record<GameMode, string> = {
  NORMAL: `【Normal Mode】<br>5つの色付きジェムを落とし、同じ色を4つ以上つなげて消す標準モード。ハイスコアを目指しましょう！`,
  BOOST: `【Chain Boost Mode】<br>登場する色が3色（赤・青・緑）に減少！ 適当に配置するだけで、10連鎖を超える気持ちよい大連鎖が勝手に巻き起こる爽快仕様です。`,
  PRACTICE: `【Practice Mode】<br>ゲームオーバーがありません。↑(ArrowUp)キーによるクイックドロップ機能を使用して、自由に連鎖の組み方を練習できます。`,
  DEMO: `【Demo Chain Mode】<br>AIによる自動実演モード。コンピュータが芸術的にジェムを組み立て、目の前で完璧な大連鎖（10連鎖〜15連鎖）を実行します。`,
};

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    console.error('Canvas element not found!');
    return;
  }

  // Create game instance
  const game = new Game(canvas);
  game.start();
  canvas.focus();

  // Mute button logic
  const muteBtn = document.getElementById('btn-mute') as HTMLButtonElement | null;
  const updateMuteButtonUI = () => {
    if (!muteBtn) return;
    const isMuted = SoundManager.getMuted();
    if (isMuted) {
      muteBtn.textContent = '🔇 Mute ON';
      muteBtn.classList.add('muted');
    } else {
      muteBtn.textContent = '🔊 Volume ON';
      muteBtn.classList.remove('muted');
    }
  };

  if (muteBtn) {
    updateMuteButtonUI();
    muteBtn.addEventListener('click', () => {
      const isCurrentlyMuted = SoundManager.getMuted();
      SoundManager.setMuted(!isCurrentlyMuted);
      updateMuteButtonUI();
      muteBtn.blur();
      canvas.focus();
    });
  }

  // Handle game mode selections
  const modes: GameMode[] = ['NORMAL', 'BOOST', 'PRACTICE', 'DEMO'];
  modes.forEach(mode => {
    const btnId = `btn-${mode.toLowerCase()}`;
    const button = document.getElementById(btnId);
    const descText = document.getElementById('mode-desc-text');

    if (button) {
      button.addEventListener('click', () => {
        // Toggle active button styling
        document.querySelectorAll('.mode-btn').forEach(btn => {
          btn.classList.remove('active');
        });
        button.classList.add('active');

        // Update description panel
        if (descText) {
          descText.innerHTML = MODE_DESCRIPTIONS[mode];
        }

        // Start new game with the chosen mode
        game.startNewGame(mode);
        
        // Remove focus to prevent spacebar from triggering button clicks
        button.blur();
        canvas.focus();
      });
    }
  });
});
