import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════
//  THEG I — Combat System
// ═══════════════════════════════════════════════════════════

export class CombatSystem {
  constructor(scene, camera, bulletSystem, wantedSystem) {
    this.scene        = scene;
    this.camera       = camera;
    this.bulletSystem = bulletSystem;
    this.wantedSystem = wantedSystem;
    this.lastShot     = 0;
  }

  /**
   * @param {Player} player
   * @param {Array} wAmmo
   * @param {Array} wRes
   * @param {Array} WEAPONS
   * @param {function} onNoAmmo - called when out of ammo
   * @param {function} onUpdateHUD
   * @param {function} onSpawnCop
   */
  shoot(player, wAmmo, wRes, WEAPONS, onNoAmmo, onUpdateHUD, onSpawnCop) {
    const w = WEAPONS[player.weaponIdx];
    const now = performance.now();
    if (now - this.lastShot < w.fr) return;
    if (w.ammo >= 0 && wAmmo[player.weaponIdx] <= 0) {
      if (onNoAmmo) onNoAmmo();
      return;
    }
    this.lastShot = now;
    if (w.ammo >= 0) wAmmo[player.weaponIdx]--;
    if (onUpdateHUD) onUpdateHUD();

    // Direction from cam center forward
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const spread = w.name === 'AK-47' ? .05 : .01;
    dir.x += (Math.random() - .5) * spread;
    dir.y += (Math.random() - .5) * spread * .5;
    dir.normalize();

    const origin = this.camera.position.clone().add(dir.clone().multiplyScalar(1));
    if (w.speed === 0) {
      // Melee hit
      const hits = new THREE.Raycaster(origin, dir, 0, w.rng).intersectObjects(this.scene.children, true);
      if (hits.length) { this.bulletSystem.spawnHit(hits[0].point); }
      this.wantedSystem.add(.5, onSpawnCop);
    } else {
      this.bulletSystem.fire(origin, dir, w.dmg, w.speed, w.rng, 'player');
      if (player.weaponIdx > 0) this.wantedSystem.add(.3, onSpawnCop);
    }
    // Muzzle flash
    this.bulletSystem.spawnHit(origin.clone().add(dir.clone().multiplyScalar(1.5)), 4, 0xFFDD44);
  }

  /**
   * @param {Player} player
   * @param {Array} wAmmo
   * @param {Array} wRes
   * @param {Array} WEAPONS
   * @param {function} onUpdateHUD
   */
  reload(player, wAmmo, wRes, WEAPONS, onUpdateHUD) {
    const w = WEAPONS[player.weaponIdx];
    if (w.ammo < 0) return;
    const need = w.ammo - wAmmo[player.weaponIdx];
    const give = Math.min(need, wRes[player.weaponIdx]);
    wAmmo[player.weaponIdx] += give;
    wRes[player.weaponIdx]  -= give;
    if (onUpdateHUD) onUpdateHUD();
  }
}
