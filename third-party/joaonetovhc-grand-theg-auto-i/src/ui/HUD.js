// ═══════════════════════════════════════════════════════════
//  THEG I — HUD
// ═══════════════════════════════════════════════════════════

export class HUD {
  constructor() {
    this._msgTimer = 0;
  }

  /**
   * @param {Player} player
   * @param {Array} WEAPONS
   * @param {Array} wAmmo
   * @param {Array} wRes
   */
  update(player, WEAPONS, wAmmo, wRes) {
    document.getElementById('hpf').style.width    = player.health + '%';
    document.getElementById('apf').style.width    = player.armor  + '%';
    document.getElementById('money').textContent  = '$' + player.money.toLocaleString('pt-BR');
    const w = WEAPONS[player.weaponIdx];
    document.getElementById('wep-name').textContent = w.name;
    if (w.ammo < 0) {
      document.getElementById('ammo-cur').textContent = '';
      document.getElementById('ammo-res').textContent = '';
    } else {
      document.getElementById('ammo-cur').textContent = wAmmo[player.weaponIdx];
      document.getElementById('ammo-res').textContent = '/ ' + wRes[player.weaponIdx];
    }
  }

  updateWanted(level) {
    for (let i = 1; i <= 5; i++) {
      const s = document.getElementById('s' + i);
      s.className = 'star' + (i <= level ? ' on' : '');
    }
  }

  showMessage(text, duration = 180) {
    const el = document.getElementById('msg');
    el.innerHTML = text;
    el.style.opacity = '1';
    return duration;
  }

  setPrompt(text) {
    const el = document.getElementById('prompt');
    el.textContent = text;
    el.style.opacity = text ? '1' : '0';
  }
}
