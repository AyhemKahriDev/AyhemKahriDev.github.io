import * as THREE from 'three';
import { W, D } from '../config/game.config.js';

// ═══════════════════════════════════════════════════════════
//  THEG I — Pickup System
// ═══════════════════════════════════════════════════════════

export const PICKUP_TYPES = [
  { type: 'health', color: 0xFF3030, value: 40  },
  { type: 'armor',  color: 0x3099FF, value: 40  },
  { type: 'money',  color: 0xFFD700, value: 500 },
  { type: 'ammo',   color: 0xAAAAAA, value: 50  },
  { type: 'weapon', color: 0xFF8C00, value: 1   },
];

export class PickupSystem {
  constructor(scene, MAT) {
    this.scene   = scene;
    this.MAT     = MAT;
    this.pickups = [];
  }

  spawn(count, collision) {
    for (let i = 0; i < count; i++) {
      let x, z, tries = 0;
      do { x = Math.random() * W; z = Math.random() * D; tries++; }
      while (collision.isInside(x, z) && tries < 200);
      if (tries >= 200) continue;
      const pt = PICKUP_TYPES[Math.floor(Math.random() * PICKUP_TYPES.length)];
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(.8, .8, .8),
        this.MAT.pickup(pt.color)
      );
      m.position.set(x, .4, z);
      m.castShadow = true;
      this.scene.add(m);
      this.pickups.push({ mesh: m, type: pt.type, value: pt.value, pos: new THREE.Vector3(x, .4, z) });
    }
  }

  /**
   * @param {number} dt
   * @param {Player} player
   * @param {Array} wAmmo
   * @param {Array} wRes
   * @param {number} frame
   * @param {function} onCollect - called with (pickup) when collected
   */
  update(dt, player, wAmmo, wRes, frame, onCollect) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.mesh.rotation.y += dt * 2;
      p.mesh.position.y = .4 + Math.sin(frame * .05) * .15;
      if (player.pos.distanceTo(p.pos) < 2) {
        if (p.type === 'health') player.health = Math.min(100, player.health + p.value);
        if (p.type === 'armor')  player.armor  = Math.min(100, player.armor  + p.value);
        if (p.type === 'money')  player.money += p.value;
        if (p.type === 'ammo')   { wRes[1] += 50; wRes[2] += 80; wRes[3] += 10; }
        if (onCollect) onCollect(p);
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }

  clear() {
    this.pickups.forEach(p => {
      if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
    });
    this.pickups.length = 0;
  }
}
