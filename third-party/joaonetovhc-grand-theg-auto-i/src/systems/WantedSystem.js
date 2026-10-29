// ═══════════════════════════════════════════════════════════
//  THEG I — Wanted System
// ═══════════════════════════════════════════════════════════

export class WantedSystem {
  constructor() {
    this.level = 0;
    this.timer = 0;
  }

  /**
   * @param {number} n - amount to add
   * @param {function} onSpawnCop - called when level >= 2
   */
  add(n, onSpawnCop) {
    this.level = Math.min(5, this.level + n);
    this.timer = 600;
    if (this.level >= 2 && onSpawnCop) onSpawnCop();
  }

  reset() {
    this.level = 0;
    this.timer = 0;
  }

  /**
   * @param {number} dt
   * @param {function} onClearCops - called when level reaches 0
   */
  update(dt, onClearCops) {
    if (this.timer > 0) {
      this.timer -= dt * 60;
    } else if (this.level > 0) {
      this.level = Math.max(0, this.level - dt * .3);
      if (this.level <= 0 && onClearCops) onClearCops();
    }
  }
}
