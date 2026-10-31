import * as THREE from 'three';
import { makeHumanoid } from '../utils/helpers.js';
import { PLAYER_H, W, D } from '../config/game.config.js';

// ═══════════════════════════════════════════════════════════
//  THEG I — NPC System
// ═══════════════════════════════════════════════════════════

const NPC_COLS = [0xF4A460, 0xD2691E, 0xFFDAB9, 0x8B4513, 0xDEB887];

export class NPCSystem {
  constructor(scene, MAT) {
    this.scene = scene;
    this.MAT   = MAT;
    this.npcs  = [];
  }

  spawn(count, collision, startX, startZ) {
    const MAT = this.MAT;
    for (let i = 0; i < count; i++) {
      let x, z, tries = 0;
      do {
        x = Math.random() * W; z = Math.random() * D; tries++;
      } while ((collision.isInside(x, z) || Math.hypot(x - startX, z - startZ) < 30) && tries < 200);
      if (tries >= 200) continue;

      const skinColor  = NPC_COLS[Math.floor(Math.random() * NPC_COLS.length)];
      const shirtColor = new THREE.Color(Math.random() * 0xffffff);
      const pantColor  = new THREE.Color(Math.random() * .3 * 0xffffff);
      const mesh = makeHumanoid(
        new THREE.MeshLambertMaterial({ color: shirtColor }),
        new THREE.MeshLambertMaterial({ color: skinColor }),
        new THREE.MeshLambertMaterial({ color: pantColor })
      );
      mesh.traverse(m => { if (m.isMesh) m.castShadow = true; });
      mesh.scale.setScalar(.9 + Math.random() * .2);
      this.scene.add(mesh);

      this.npcs.push({
        mesh, dead: false, hostile: false,
        pos: new THREE.Vector3(x, PLAYER_H / 2, z),
        vel: new THREE.Vector3(),
        health: 60, angle: Math.random() * Math.PI * 2,
        state: 'wander', timer: 0,
        wanderAngle: Math.random() * Math.PI * 2,
      });
    }
  }

  update(dt, playerPos, wantedLevel, collision, frame) {
    this.npcs.forEach(n => {
      if (n.dead) return;
      n.timer -= dt;
      const dp = playerPos.distanceTo(n.pos);
      if (dp < 60 && wantedLevel > 0 && !n.hostile) {
        // Flee
        const fa = Math.atan2(n.pos.x - playerPos.x, n.pos.z - playerPos.z);
        n.pos.x += Math.sin(fa) * 4 * dt;
        n.pos.z += Math.cos(fa) * 4 * dt;
        n.angle = fa;
      } else {
        // Wander
        if (n.timer <= 0) { n.timer = 2 + Math.random() * 4; n.wanderAngle = Math.random() * Math.PI * 2; }
        n.pos.x += Math.sin(n.wanderAngle) * .8 * dt;
        n.pos.z += Math.cos(n.wanderAngle) * .8 * dt;
        n.angle = n.wanderAngle;
        if (collision.isInside(n.pos.x, n.pos.z)) {
          n.pos.x -= Math.sin(n.wanderAngle) * 2;
          n.pos.z -= Math.cos(n.wanderAngle) * 2;
          n.wanderAngle += Math.PI;
        }
      }
      n.pos.x = Math.max(1, Math.min(W - 1, n.pos.x));
      n.pos.z = Math.max(1, Math.min(D - 1, n.pos.z));
      n.mesh.position.set(n.pos.x, 0, n.pos.z);
      n.mesh.rotation.y = Math.PI + n.angle;
      // Walk animation
      const ls = Math.sin(frame * .2) * 0.35;
      n.mesh._legL.rotation.x =  ls;
      n.mesh._legR.rotation.x = -ls;
    });
  }

  /**
   * @param {object} npc
   * @param {number} dmg
   * @param {BulletSystem} bulletSystem - for spawnBlood
   * @param {function} onKill - called with (hostile) when npc dies
   */
  hurt(npc, dmg, bulletSystem, onKill) {
    npc.health -= dmg;
    bulletSystem.spawnBlood(npc.pos.clone().add(new THREE.Vector3(0, .5, 0)));
    if (npc.health <= 0 && !npc.dead) {
      npc.dead = true;
      npc.mesh.rotation.x = Math.PI / 2;
      npc.mesh.position.y = -0.5;
      if (onKill) onKill(npc.hostile);
    }
  }

  clear() {
    this.npcs.forEach(n => {
      if (n.mesh && n.mesh.parent) n.mesh.parent.remove(n.mesh);
    });
    this.npcs.length = 0;
  }
}
