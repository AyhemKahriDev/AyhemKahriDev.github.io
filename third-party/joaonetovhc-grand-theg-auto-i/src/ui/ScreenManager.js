// ═══════════════════════════════════════════════════════════
//  THEG I — Screen Manager
// ═══════════════════════════════════════════════════════════
// Controla as telas: título, wasted, pausa e (futuro) menu.

export class ScreenManager {
  showTitle() {
    document.getElementById('title').style.display = 'flex';
  }

  hideTitle() {
    document.getElementById('title').style.display = 'none';
  }

  showWasted(stats) {
    document.getElementById('wasted-stats').textContent = stats;
    document.getElementById('wasted').style.display = 'flex';
  }

  hideWasted() {
    document.getElementById('wasted').style.display = 'none';
  }
}
